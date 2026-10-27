import { websiteApi } from './api'
// Shared successful results and in-flight subscriptions; cancelling one picker
// cannot cancel requests still used by another picker on the same edit page.
const results = new Map(), requests = new Map(), resolutions = new Map()
let version = '', catalog = null, queue = [], scheduled = false
const aborted = () => new DOMException('图标请求已取消', 'AbortError')
function checked(response) {
  if (response?.status !== 200) throw new Error(response?.msg || '图标加载失败，请重试')
  const data = response.data || {}
  if (data.version && version && data.version !== version) { results.clear(); resolutions.clear(); catalog = null }
  if (data.version) version = data.version
  return data
}
function shared(key, run, signal) {
  if (signal?.aborted) return Promise.reject(aborted())
  if (results.has(key)) return Promise.resolve(results.get(key))
  let item = requests.get(key)
  if (!item || item.controller.signal.aborted) {
    item = { controller: new AbortController(), users: 0 }
    const current = item
    item.promise = run(item.controller.signal).then(checked).then(data => { results.set(key, data); return data }).finally(() => { if (requests.get(key) === current) requests.delete(key) })
    // Subscribers attach rejection handlers below, including abandoned consumers.
    requests.set(key, item)
  }
  item.users++
  return new Promise((resolve, reject) => {
    let ended = false
    const done = () => { if (ended) return false; ended = true; item.users--; signal?.removeEventListener('abort', cancel); return true }
    const cancel = () => { if (done()) { if (!item.users) item.controller.abort(); reject(aborted()) } }
    signal?.addEventListener('abort', cancel, { once: true })
    item.promise.then(data => { if (done()) resolve(data) }, error => { if (done()) reject(error) })
  })
}
export const peekIconCatalog = () => catalog
export const peekIconPage = (prefix, page = 0) => results.get(`page:${prefix}:${page}`)
export async function iconCatalog(category = 'builtin', signal) {
  if (catalog) return catalog
  const data = await shared(`catalog:${category}`, s => websiteApi.iconsCatalog({ version: 2, category }, { signal: s }), signal)
  catalog = data
  results.set(`page:${category}:0`, data.initial)
  remember(data.initial?.icons || [])
  return data
}
function remember(icons) { for (const it of icons) resolutions.set(JSON.stringify([it.id, 'website', '']), it) }
export async function iconPage(prefix, page = 0, signal) {
  const data = await shared(`page:${prefix}:${page}`, s => websiteApi.iconsPage({ prefix, page, per: 60 }, { signal: s }), signal)
  remember(data.icons || [])
  return data
}
export const iconSearch = (q, signal, preferred = '') => {
  const query = q.trim().toLowerCase()
  return shared(`search:rank2:${preferred}:${query}`, s => websiteApi.iconSearch({ q: query, source: 'local', preferred }, { signal: s }), signal)
}
export const onlineSearch = async (q, signal) => checked(await websiteApi.iconSearch({ q, source: 'online' }, { signal }))
export const onlinePreviews = async (ids, signal) => checked(await websiteApi.iconsPreview({ ids }, { signal }))
export const importIcon = async (value, signal) => {
  const data = checked(await websiteApi.iconsApply({ value }, { signal }))
  // An earlier manual check can have cached an unavailable value in a member
  // context. A successful import makes that descriptor obsolete everywhere.
  for (const key of resolutions.keys()) {
    if (String(JSON.parse(key)[0]).replace(/^iconify:/, '') === value) resolutions.delete(key)
  }
  resolutions.set(JSON.stringify([value, 'website', '']), data.icon)
  return data.icon
}
export function peekIcon(value, context = 'website', defaultKey = '') { return resolutions.get(JSON.stringify([value || '', context, defaultKey])) }
export function resolveIcon(value, context = 'website', defaultKey = '', signal) {
  const key = JSON.stringify([value || '', context, defaultKey])
  if (signal?.aborted) return Promise.reject(aborted())
  if (resolutions.has(key)) return Promise.resolve(resolutions.get(key))
  return new Promise((resolve, reject) => {
    const entry = { key, value: value || '', context, default: defaultKey, resolve, reject, signal, cancelled: false }
    const cancel = () => { entry.cancelled = true; reject(aborted()) }
    entry.cleanup = () => signal?.removeEventListener('abort', cancel)
    signal?.addEventListener('abort', cancel, { once: true })
    queue.push(entry)
    if (!scheduled) { scheduled = true; queueMicrotask(flush) }
  })
}
async function flush() {
  scheduled = false
  const pending = queue.splice(0).filter(e => !e.cancelled), byKey = new Map()
  for (const e of pending) { if (!byKey.has(e.key)) byKey.set(e.key, []); byKey.get(e.key).push(e) }
  const entries = [...byKey.values()]
  for (let i = 0; i < entries.length; i += 100) {
    const batch = entries.slice(i, i + 100)
    const controller = new AbortController()
    const check = () => { if (batch.every(group => group.every(e => e.cancelled))) controller.abort() }
    for (const group of batch) for (const e of group) e.signal?.addEventListener('abort', check, { once: true })
    try {
      const data = checked(await websiteApi.iconsResolve({ items: batch.map(([e]) => ({ value: e.value, context: e.context, default: e.default })) }, { signal: controller.signal }))
      batch.forEach((group, index) => {
        const d = data.icons[index]
        if (!d) throw new Error('图标解析响应不完整')
        resolutions.set(group[0].key, d)
        for (const e of group) if (!e.cancelled) e.resolve(d)
      })
    } catch (error) { for (const group of batch) for (const e of group) if (!e.cancelled) e.reject(error) }
    finally { for (const group of batch) for (const e of group) { e.cleanup(); e.signal?.removeEventListener('abort', check) } }
  }
}
export const uniqueIcons = icons => [...new Map(icons.map(it => [it.id, it])).values()]
