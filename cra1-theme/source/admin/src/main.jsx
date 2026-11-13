import { createRoot } from 'react-dom/client'
import { StrictMode, useEffect } from 'react'
import { ToastProvider } from '@ui/toast'
import App from './app'
import './app.css'
import '../../../../public/cra1-shared/src/ui-effects.js'

/**
 * CRA1 后台入口。
 *
 * 挂载点 #cra1-admin-root 由 PHP 壳输出（登录态已校验）。
 * csrf / base / 管理员名通过 window.__CRA1_ADMIN__ 注入，
 * 避免从 DOM data-* 读取时与 React 初始化产生竞态。
 */
const el = document.getElementById('cra1-admin-root')
function AdminEffects({ children }) {
  useEffect(() => {
    document.documentElement.dataset.cra1Ui = 'admin'
    window.CRA1Shared?.UIEffects?.start()
    return () => window.CRA1Shared?.UIEffects?.destroy()
  }, [])
  return children
}
if (el) {
  document.documentElement.dataset.cra1Ui = 'admin'
  createRoot(el).render(
    <StrictMode>
      <AdminEffects><ToastProvider>
        <App />
      </ToastProvider></AdminEffects>
    </StrictMode>
  )
}
