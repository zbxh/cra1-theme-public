import { useEffect, useRef, useCallback } from 'react'
import { api } from '../lib'

// Uses V10's installed CAPTCHA HTML and callbacks. A challenge is never cached.
const JQUERY_SRC = '/clientarea/template/pc/default/js/common/jquery.mini.js'
let jqPromise = null, activeChallenge = null
function ensureJQuery() {
  if (window.jQuery) return Promise.resolve(window.jQuery)
  if (!jqPromise) jqPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = JQUERY_SRC
    script.onload = () => resolve(window.jQuery)
    script.onerror = () => { jqPromise = null; script.remove(); reject(new Error('图形验证加载失败')) }
    document.head.appendChild(script)
  })
  return jqPromise
}
async function injectHtml(container, html, current) {
  container.innerHTML = html
  for (const old of Array.from(container.querySelectorAll('script'))) {
    if (!current()) return
    const script = document.createElement('script')
    if (old.src) {
      // Reuse local jQuery, while retaining any actual native CAPTCHA dependencies.
      if (/\/jquery(?:[./-]|$)/i.test(old.src) && window.jQuery) { old.remove(); continue }
      await new Promise((resolve, reject) => {
        script.async = false; script.src = old.src
        script.onload = resolve; script.onerror = () => reject(new Error('图形验证加载失败'))
        old.replaceWith(script)
      })
    } else { script.textContent = old.textContent; old.replaceWith(script) }
  }
}
export function useCaptcha() {
  const holder = useRef(null), pending = useRef(null), generation = useRef(0), alive = useRef(true)
  const close = useCallback(() => {
    generation.current++
    const resolve = pending.current; pending.current = null
    if (activeChallenge?.owner === holder) {
      const active = activeChallenge; activeChallenge = null
      clearTimeout(window.captchaTimer)
      document.removeEventListener('keydown', active.keydown, true)
      if (window.captchaCheckSuccsss === active.success) window.captchaCheckSuccsss = active.previousSuccess
      if (window.captchaCheckCancel === active.cancel) window.captchaCheckCancel = active.previousCancel
      if (active.focus?.isConnected) active.focus.focus()
    }
    holder.current?.remove(); holder.current = null
    resolve?.(null)
  }, [])
  useEffect(() => { alive.current = true; return () => { alive.current = false; close() } }, [close])
  const open = useCallback(async () => {
    activeChallenge?.cancel()
    close()
    const current = ++generation.current
    try {
      await ensureJQuery()
      if (!alive.current || current !== generation.current) return null
      const response = await api('/captcha')
      if (!alive.current || current !== generation.current || !response.data?.html) return null
      const container = document.createElement('div'); container.setAttribute('data-cra1-captcha', '')
      holder.current = container; document.body.appendChild(container)
      return await new Promise(resolve => {
        pending.current = resolve
        const challenge = { owner: holder, focus: document.activeElement, previousSuccess: window.captchaCheckSuccsss, previousCancel: window.captchaCheckCancel }
        const settle = value => { if (current !== generation.current) return; const finish = pending.current; pending.current = null; close(); finish?.(value) }
        challenge.success = (ok, code, token) => { if (ok) settle({ code, token }) }
        challenge.cancel = () => settle(null)
        challenge.keydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); challenge.cancel() } }
        document.addEventListener('keydown', challenge.keydown, true)
        // Native image CAPTCHA binds its buttons after a delay. Cancellation
        // must also work immediately, before that native timer has fired.
        container.addEventListener('click', event => {
          if (event.target.closest?.('#cancel-btn')) { event.preventDefault(); event.stopPropagation(); challenge.cancel() }
        }, true)
        activeChallenge = challenge; window.captchaCheckSuccsss = challenge.success; window.captchaCheckCancel = challenge.cancel
        injectHtml(container, response.data.html, () => alive.current && current === generation.current).catch(() => { if (current === generation.current) close() })
      })
    } catch { close(); return null }
  }, [close])
  return { open, close }
}
