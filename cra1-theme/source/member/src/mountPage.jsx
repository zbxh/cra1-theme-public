import { AccessProvider } from './ui/access'
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { ToastProvider } from './ui/toast'
import { AnnouncementSlot } from './ui/announcement-slot'

/**
 * 页面挂载器（整个主题的统一入口）
 *
 * 主题有两种页面形态：
 *   A. 外壳页（account / finance / security ...）：PHP 含 .template 外壳，
 *      由 Vue 挂载侧边栏与顶栏，React 只渲染内容槽 #cra1-content-slot。
 *   B. 独立页（login / regist / forget / 错误页 ...）：无 Vue 外壳，
 *      React 直接挂到 #root。
 *
 * ⚠️ 关键时序约束（曾导致「页面永久显示骨架屏」的线上问题，勿改）
 *
 *   Vue 2 编译器的模板来源是 el.outerHTML。若 React 在 Vue 挂载前就往
 *   .template 里渲染了内容（例如骨架屏），Vue 会把这些 DOM 当作模板的一部分
 *   重新编译并替换，React 的 root 随即脱离文档 —— 而 React 侧又认为已挂载，
 *   不会再挂第二次。结果是骨架屏被固化成静态节点，永远不消失。
 *
 *   因此外壳页必须严格「只等 Vue 完成挂载后的事件」，**不允许任何提前挂载兜底**。
 *   若外壳脚本异常，由下方超时逻辑进入可诊断的错误态，而不是抢先渲染。
 */
function render(container, node) {
  createRoot(container).render(
    <StrictMode>
      <ToastProvider>{node}</ToastProvider>
    </StrictMode>
  )
}

/** 外壳页：必须在 Vue 完成挂载后才挂载 React */
export function mountShellPage(Component) {
  let mounted = false

  function tryMount() {
    if (mounted) return true
    // ① 必须等 Vue 外壳完成挂载。
    //    否则 React 先渲染的内容会被 Vue 当作模板的一部分重建掉，
    //    React root 随之脱离文档，表现为「永久骨架屏」。
    if (!window.__CRA1_SHELL_READY__) return false
    // ② 槽必须存在且仍连接在文档中（Vue 重建 DOM 后旧节点会 disconnected）
    var slot = document.getElementById('cra1-content-slot')
    if (!slot || slot.isConnected === false) return false
    mounted = true
    render(slot, <AccessProvider><Component /></AccessProvider>)
    return true
  }

  if (tryMount()) return

  // 事件路径：正常情况下 shell.js 会在 mounted + $nextTick 后派发
  window.addEventListener('cra1:shell-ready', function () { tryMount() })

  // 轮询兜底：module script 与 shell.js 的执行顺序不定，
  // 事件可能在监听器注册前就已派发，这里靠标志位补上。
  var tries = 0
  var poll = window.setInterval(function () {
    tries += 1
    if (tryMount() || tries > 250) {          // 250 × 40ms ≈ 10s
      window.clearInterval(poll)
      if (!mounted) {
        var slot = document.getElementById('cra1-content-slot')
        if (slot) {
          slot.innerHTML =
            '<div style="padding:24px;font:14px/1.6 system-ui,sans-serif;color:#B42318">' +
            '页面暂时无法加载，请刷新重试。如仍无法打开，请联系客服。' +
            '</div>'
        }
        var overlay = document.getElementById('mainLoading')
        if (overlay) overlay.style.display = 'none'
      }
    }
  }, 40)

  // 监听器注册后立刻再试一次，覆盖「事件刚好在注册前派发」的窗口
  tryMount()
}

/** 独立页：直接挂到 #root */
export function mountStandalonePage(Component, { noticesInLayout = false } = {}) {
  const container = document.getElementById('root')
  if (!container) return
  render(container, <>{!noticesInLayout && <AnnouncementSlot />}<Component /></>)
}

/**
 * 兼容入口：按页面形态自动选择挂载方式。
 * 保留该名字以避免改动全部 entry；新代码请优先使用上面两个显式函数。
 */
export function mountPage(Component) {
  const slot = document.getElementById('cra1-content-slot')
  const standalone = document.getElementById('root')

  if (standalone && !slot) {
    mountStandalonePage(Component)
    return
  }
  mountShellPage(Component)
}
