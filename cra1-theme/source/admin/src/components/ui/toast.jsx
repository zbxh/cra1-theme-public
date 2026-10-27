import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from './utils'

/**
 * Toast 提示
 * 两种触发方式：
 *   1. 组件内：const toast = useToast(); toast('保存成功')
 *   2. 任意位置（含非 React 代码）：window.dispatchEvent(new CustomEvent('cra1:toast', { detail:{ text, tone } }))
 * 可访问性：容器 aria-live="polite"，消息即时播报；不阻塞交互。
 */
const ToastContext = createContext(() => {})

export function useToast() {
  return useContext(ToastContext)
}

let seq = 0

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((text, tone = 'info') => {
    const id = ++seq
    setItems((list) => [...list, { id, text, tone }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3200)
  }, [])

  // 桥接：让非 React 代码（如 Vue 外壳）也能弹提示
  useEffect(() => {
    const handler = (e) => push(e.detail?.text || '', e.detail?.tone || 'info')
    window.addEventListener('cra1:toast', handler)
    return () => window.removeEventListener('cra1:toast', handler)
  }, [push])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-5 top-5 z-[200] flex w-[min(92vw,352px)] flex-col gap-2"
      >
        {items.map((t) => (
          <ToastItem key={t.id} {...t} onClose={() => setItems((l) => l.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const tones = {
  success: { icon: CheckCircle2, cls: 'text-[#00B42A]' },
  error: { icon: AlertCircle, cls: 'text-danger' },
  info: { icon: Info, cls: 'text-brand' },
}

function ToastItem({ text, tone = 'info', onClose }) {
  const { icon: Icon, cls } = tones[tone] || tones.info
  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3',
        'shadow-[0_2px_5px_rgba(22,32,51,0.06),0_12px_28px_rgba(22,32,51,0.12)]',
        'animate-[cra1-toast-in_200ms_cubic-bezier(0.23,1,0.32,1)]'
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', cls)} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13px] leading-5 text-ink">{text}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭提示"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
