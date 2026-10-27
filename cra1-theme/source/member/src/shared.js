/* Thin React adapter; both shell headers load the same runtime. */
const release = import.meta.env.VITE_CRA1_SHARED_BASE || '/cra1-shared/releases/20261017-member-auth-v2'
function ready() {
  if (window.CRA1Shared?.UI && window.CRA1Shared?.Request) return Promise.resolve(window.CRA1Shared)
  if (window.__CRA1_SHARED_PROMISE__) return window.__CRA1_SHARED_PROMISE__
  // A previously cached HTML page can load a newer entry during publication.
  // The compatibility bootstrap still loads the same bundle, never a second implementation.
  window.__CRA1_SHARED_PROMISE__ = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${release}/cra1-shared.css"]`)) {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${release}/cra1-shared.css`; document.head.appendChild(css)
    }
    const script = document.createElement('script'); script.src = `${release}/cra1-shared.js`
    script.onload = () => resolve(window.CRA1Shared)
    script.onerror = () => { window.__CRA1_SHARED_PROMISE__ = null; script.remove(); reject(new Error('页面暂时无法加载，请刷新重试')) }
    document.head.appendChild(script)
  })
  return window.__CRA1_SHARED_PROMISE__
}
export { ready as sharedReady }
ready().catch(() => {})
export async function request(path, options) { return (await ready()).Request.request(path, options) }
export async function copyToClipboard(text) { return (await ready()).UI.copy(text) }
export function notify(text, tone = 'info') { ready().then(shared => shared.UI.toast(text, tone)).catch(() => {}) }
