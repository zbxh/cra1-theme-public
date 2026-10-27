import { useEffect, useRef, useCallback } from 'react'
import { api } from '../lib'

/**
 * 图形验证码（对接系统 TpCaptcha 插件）
 *
 * 契约（读自 CommonController::captcha 与插件模板）：
 *   GET /console/v1/captcha → { status, data: { html } }
 *   html 是一段**自包含的模态框**：自带 <style>、依赖 jQuery、内含 token，
 *   并在校验通过后调用全局函数 captchaCheckSuccsss(true, code, token)；
 *   取消时调用 captchaCheckCancel()。
 *
 * 因此本组件负责三件事：
 *   1. 保证本地 jQuery 就绪（插件 HTML 用 $.ajax，且其内置 CDN 引用必须被拦住）；
 *   2. 注册上述两个全局回调，把结果交回调用方；
 *   3. 把 html 注入容器（style/script 需用 Range 解析才能执行）。
 */
const JQUERY_SRC = '/clientarea/template/pc/default/js/common/jquery.mini.js'

/** 加载本地 jQuery（只加载一次，全局复用） */
let jqPromise = null
function ensureJQuery() {
  if (window.jQuery) return Promise.resolve(window.jQuery)
  if (jqPromise) return jqPromise
  jqPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = JQUERY_SRC
    s.onload = () => resolve(window.jQuery)
    s.onerror = () => reject(new Error('jQuery 加载失败'))
    document.head.appendChild(s)
  })
  return jqPromise
}

/**
 * 注入 HTML 片段并执行其中的 <script>。
 * 直接用 innerHTML 不会执行 script，这里逐个重建 script 节点。
 */
function injectHtml(container, html) {
  container.innerHTML = html
  container.querySelectorAll('script').forEach((old) => {
    const s = document.createElement('script')
    if (old.src) {
      // 拦截插件 HTML 内置的外部 CDN 引用（主题要求运行时零 CDN），
      // 本地 jQuery 已由 ensureJQuery 提供，跳过即可。
      if (/^https?:\/\//i.test(old.src)) {
        old.remove()
        return
      }
      s.src = old.src
    } else {
      s.textContent = old.textContent
    }
    old.parentNode.replaceChild(s, old)
  })
}

/**
 * 打开验证码弹窗
 * @returns {Promise<{code:string, token:string}|null>} 通过返回凭据，取消返回 null
 */
export function useCaptcha() {
  const holderRef = useRef(null)
  const resolverRef = useRef(null)

  if (!holderRef.current) {
    holderRef.current = document.createElement('div')
    holderRef.current.id = 'cra1-captcha-holder'
    holderRef.current.setAttribute('data-cra1-captcha', '')
  }

  // 全局回调：插件 HTML 校验通过/取消时调用
  useEffect(() => {
    const holder = holderRef.current
    if (holder && !holder.isConnected) document.body.appendChild(holder)

    window.captchaCheckSuccsss = (ok, code, token) => {
      if (ok && resolverRef.current) {
        const resolve = resolverRef.current
        resolverRef.current = null
        resolve({ code, token })
      }
    }
    window.captchaCheckCancel = () => {
      if (resolverRef.current) {
        const resolve = resolverRef.current
        resolverRef.current = null
        resolve(null)
      }
    }
    return () => {
      delete window.captchaCheckSuccsss
      delete window.captchaCheckCancel
    }
  }, [])

  const open = useCallback(async () => {
    const holder = holderRef.current
    if (!holder) return null
    if (!holder.isConnected) document.body.appendChild(holder)

    try {
      await ensureJQuery()
      const res = await api('/captcha')
      const html = res.data?.html || ''
      if (!html) return null
      injectHtml(holder, html)
      return await new Promise((resolve) => {
        resolverRef.current = resolve
      })
    } catch (e) {
      holder.innerHTML = ''
      return null
    }
  }, [])

  const close = useCallback(() => {
    const holder = holderRef.current
    if (holder) holder.innerHTML = ''
    if (resolverRef.current) {
      const resolve = resolverRef.current
      resolverRef.current = null
      resolve(null)
    }
  }, [])

  return { open, close }
}
