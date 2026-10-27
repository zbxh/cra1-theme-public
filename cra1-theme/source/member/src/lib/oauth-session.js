// V10 consumes the OAuth session when /oauth/token is read. Only read after
// the provider's callback has closed its window, as the native theme does.
export function createOAuthFlow({ request, open, origin, now = Date.now, schedule = setTimeout, unschedule = clearTimeout }) {
  let active = null
  return function start(name, { onResult, onError, onBound } = {}) {
    active?.()
    const popup = open('about:blank', 'cra1-oauth', 'width=650,height=760')
    if (!popup) { onError?.(new Error('请允许授权窗口打开后重试')); return () => {} }
    const startedAt = now()
    let timer, stopped = false
    const stop = () => {
      stopped = true
      unschedule(timer)
      try { popup.close() } catch { /* The provider window may already be gone. */ }
      if (active === stop) active = null
    }
    active = stop
    const fail = error => { if (!stopped) { stop(); onError?.(error) } }
    const watch = async () => {
      if (stopped) return
      if (now() - startedAt >= 600000) { fail(new Error('授权已过期，请重新发起')); return }
      if (!popup.closed) { timer = schedule(watch, 300); return }
      try {
        const response = await request('/oauth/token')
        if (stopped) return
        const data = response.data || {}
        if (data.jwt || data.url) {
          if (!data.jwt) {
            const target = new URL(data.url, origin)
            if (target.origin !== origin || target.pathname !== '/oauth.htm' || target.username || target.password) throw new Error('授权返回地址无效，请重新登录')
          }
          await onResult?.(response)
        } else if (onBound) {
          // Native binding clears the session. Refresh the actual binding list;
          // a closed window alone does not prove successful binding.
          await onBound()
        } else throw new Error('授权未完成或已过期，请重试')
        stop()
      } catch (error) { fail(error) }
    }
    request(`/oauth/${encodeURIComponent(name)}`).then(response => {
      if (stopped) return
      if (popup.closed) throw new Error('授权窗口已关闭，请重新发起')
      if (!response.data?.url) throw new Error('授权暂时不可用')
      const url = new URL(response.data.url, origin)
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error('授权地址无效，请重新发起')
      popup.location.href = url.href
      timer = schedule(watch, 300)
    }).catch(fail)
    return stop
  }
}
