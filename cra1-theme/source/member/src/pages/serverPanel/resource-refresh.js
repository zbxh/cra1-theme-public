/** 每类资源独立计时。常规读取不作废慢响应，写操作才使旧响应失效。 */
export function createResourceRefreshController({
  now = Date.now, isVisible = () => true, setTimer = setTimeout, clearTimer = clearTimeout,
  fastWindow = 90000,
} = {}) {
  const resources = new Map(), listeners = new Set()
  let started = false, stopped = false, paused = false
  const visible = () => started && !stopped && !paused && isVisible()
  const emit = () => listeners.forEach(fn => fn())
  const entry = id => {
    if (!resources.has(id)) resources.set(id, {
      id, descriptor: null, generation: 0, hasData: false, data: null, dirty: true,
      lastRead: 0, error: null, timer: null, running: false, queued: false, tracking: null,
    })
    return resources.get(id)
  }
  const cancel = e => { if (e.timer !== null) clearTimer(e.timer); e.timer = null }
  const fingerprint = (e, data) => JSON.stringify(e.fingerprint ? e.fingerprint(data) : data)
  const pending = (e, data) => Boolean(e.descriptor?.pending?.(data))
  const interval = e => {
    if (e.tracking) {
      if (now() - e.tracking.since < fastWindow) return e.descriptor.activeInterval || 2000
      // 长时间运行的任务降频，按需读取的资源也保留后续确认。
      return Math.max(15000, Math.min(e.descriptor.interval || 30000, 60000))
    }
    return e.descriptor?.interval || (e.error ? 15000 : 0)
  }
  const schedule = (e, remaining = false) => {
    cancel(e)
    if (!visible() || !e.descriptor || e.running) return
    const period = interval(e)
    const delay = remaining ? Math.max(1, period - (now() - (e.lastAttempt ?? e.lastRead))) : period
    if (period) e.timer = setTimer(() => { void run(e) }, delay)
  }
  const stopTracking = e => {
    const callback = e.tracking?.onSettled
    e.tracking = null
    if (callback) callback(e.data)
    else e.descriptor?.onSettled?.(e.data)
  }
  async function run(e) {
    cancel(e)
    if (!visible() || !e.descriptor) return
    if (e.running) return
    const descriptor = e.descriptor, generation = e.generation
    e.running = true; e.queued = false
    const abort = new AbortController()
    e.abort = abort
    const current = () => !stopped && e.generation === generation && e.descriptor === descriptor
    try {
      const data = await descriptor.read({ signal: abort.signal, isCurrent: current })
      if (!current()) return
      e.data = data; e.hasData = true; e.lastRead = now(); e.dirty = false; e.error = null
      descriptor.apply?.(data)
      const busy = pending(e, data)
      if (e.tracking) {
        const t = e.tracking
        if (busy) t.sawPending = true
        const changed = t.baseline !== undefined && fingerprint(e, data) !== t.baseline
        const confirmed = t.expected ? t.expected(data) : (changed || t.sawPending || t.baseline === undefined)
        if (!busy && confirmed) stopTracking(e)
      } else if (busy && !e.observedPending) {
        e.tracking = { since: now(), baseline: fingerprint(e, data), sawPending: true }
      }
      e.observedPending = busy
    } catch (error) {
      if (current()) { e.error = error; descriptor.onError?.(error) }
    } finally {
      e.running = false
      e.lastAttempt = now()
      if (e.abort === abort) e.abort = null
      if (!stopped) {
        emit()
        if (e.queued && visible() && e.descriptor) void run(e)
        else schedule(e)
      }
    }
  }
  const expired = e => e.descriptor?.interval && now() - e.lastRead >= e.descriptor.interval
  return {
    register(id, descriptor) {
      const e = entry(id)
      if (e.descriptor) throw new Error(`重复注册资源：${id}`)
      if (e.scope !== undefined && e.scope !== descriptor.scope) {
        e.hasData = false; e.data = null; e.error = null; e.lastRead = 0; e.dirty = true
        e.lastAttempt = undefined
        if (e.tracking) e.tracking.baseline = undefined
      }
      e.scope = descriptor.scope; e.descriptor = descriptor; e.generation++
      e.fingerprint = descriptor.fingerprint
      if (descriptor.readOnMount === true) e.dirty = true
      if (!e.hasData && descriptor.initialData !== undefined) {
        e.data = descriptor.initialData; e.hasData = true; e.lastRead = now()
        e.lastAttempt = e.lastRead
        if (!e.tracking && descriptor.readOnMount === false) e.dirty = false
      }
      if (e.hasData) descriptor.apply?.(e.data)
      if (e.error) descriptor.onError?.(e.error)
      if (!e.hasData || e.dirty || expired(e) || e.tracking) {
        if (e.running) e.queued = true
        else void run(e)
      } else schedule(e, true)
      return () => {
        if (e.descriptor !== descriptor) return
        e.generation++; e.abort?.abort(); cancel(e); e.descriptor = null
      }
    },
    refresh(ids, { track = false, expected = {}, onSettled = {} } = {}) {
      for (const id of new Set(ids)) {
        const e = entry(id)
        e.generation++; e.abort?.abort(); cancel(e); e.dirty = true
        if (track) e.tracking = {
          since: now(), baseline: e.hasData ? fingerprint(e, e.data) : undefined,
          sawPending: false, expected: expected[id], onSettled: onSettled[id],
        }
        if (e.running) e.queued = true
        else void run(e)
      }
      emit()
    },
    start() { stopped = false; started = true; this.resume() },
    pause() { paused = true; resources.forEach(cancel) },
    resume() {
      paused = false
      for (const e of resources.values()) {
        if (!e.descriptor || !visible() || e.running || e.timer !== null) continue
        if (e.dirty || !e.hasData || expired(e) || (e.tracking && now() - (e.lastAttempt ?? e.lastRead) >= interval(e))) void run(e)
        else schedule(e, true)
      }
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    summary() {
      return [...resources.values()].filter(e => e.descriptor).map(e => ({
        id: e.id, error: Boolean(e.error), delayed: Boolean(e.tracking && now() - e.tracking.since >= fastWindow),
      })).filter(e => e.error || e.delayed)
    },
    destroy() {
      stopped = true
      resources.forEach(e => { e.generation++; e.abort?.abort(); cancel(e) })
      listeners.clear()
    },
  }
}
