import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createAutoRenewController } from './auto-renew-state'

export function useAutoRenewControl({ api, active = true, disabledReason = '', onConfirmed }) {
  const [state, setState] = useState({ phase: 'loading', enabled: null, target: null, error: '' })
  const controller = useRef(null)
  const stateRef = useRef(state), lastRead = useRef(0), confirmed = useRef(onConfirmed)
  stateRef.current = state; confirmed.current = onConfirmed
  useEffect(() => {
    lastRead.current = 0
    setState({ phase: 'loading', enabled: null, target: null, error: '' })
    if (disabledReason) return
    const current = createAutoRenewController(api, next => {
      stateRef.current = next; setState(next)
      if (next.phase === 'ready') { lastRead.current = Date.now(); confirmed.current?.(next.enabled) }
    })
    controller.current = current
    return () => { current.dispose(); if (controller.current === current) controller.current = null }
  }, [api, disabledReason])
  // The controller lives with the card, so closing its menu cannot cancel
  // confirmation of a submitted setting or lose an uncertain result.
  useEffect(() => {
    if (active && !disabledReason && (!lastRead.current || Date.now() - lastRead.current >= 10000)) controller.current?.read()
  }, [active, api, disabledReason])
  return { state, activate: () => stateRef.current.phase === 'error' ? controller.current?.read() : controller.current?.toggle() }
}

export const AutoRenewButton = forwardRef(function AutoRenewButton({ state, disabledReason = '', onActivate, errorId, className = '', compact = false, ...props }, ref) {
  const button = useRef(null)
  const restoreFocus = useRef(false)
  const busy = ['loading', 'saving', 'confirming'].includes(state.phase) && !disabledReason
  useEffect(() => {
    if (!busy && restoreFocus.current) {
      // 原生 disabled 会移走键盘焦点；保存后返回开关，但不打断用户在其他控件的操作。
      if (document.activeElement === document.body || document.activeElement === button.current) button.current?.focus()
      restoreFocus.current = false
    }
  }, [busy])
  const known = typeof state.enabled === 'boolean' && state.phase !== 'error' && !disabledReason
  const label = disabledReason ? '不支持自动续费'
    : state.phase === 'loading' ? '正在读取自动续费…'
      : state.phase === 'error' ? '自动续费状态未确认'
        : state.phase === 'saving' || state.phase === 'confirming'
          ? `正在${state.target ? '开启' : '关闭'}自动续费…`
          : `已${state.enabled ? '开启' : '关闭'}自动续费`
  const displayLabel = !compact ? label : disabledReason ? '不可用'
    : state.phase === 'loading' ? '读取中…'
      : state.phase === 'error' ? '状态未确认'
        : state.phase === 'saving' || state.phase === 'confirming' ? `${state.target ? '开启' : '关闭'}中…`
          : `已${state.enabled ? '开启' : '关闭'}`

  return <button
        {...props}
        ref={node => { button.current = node; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node }}
        type="button" className={`ar-switch ${className}`}
        role={props.role || (known ? 'switch' : undefined)}
        aria-label={props['aria-label'] || (known ? '自动续费' : label)}
        aria-checked={props['aria-checked'] ?? (known ? state.enabled : undefined)}
        aria-busy={busy}
        aria-describedby={state.error && !disabledReason ? errorId : undefined}
        data-on={known && state.enabled}
        disabled={busy || state.phase === 'error' || !!disabledReason || props.disabled}
        title={disabledReason || (compact ? label : undefined)}
        onClick={event => {
          restoreFocus.current = document.activeElement === button.current
          if (props.onClick) props.onClick(event)
          else onActivate?.()
        }}
      >
        <span className="ar-track">
          <span className="ar-label" aria-live="polite" aria-atomic="true">{displayLabel}</span>
          <span className="ar-knob" aria-hidden="true">
            {busy ? <Loader2 className="ar-loader" /> : null}
          </span>
        </span>
      </button>
})

export default function AutoRenewControl({ api, disabledReason = '' }) {
  const control = useAutoRenewControl({ api, disabledReason })
  const { state } = control, errorId = useId()
  return (
    <div className="server-auto-renew">
      <AutoRenewButton state={state} disabledReason={disabledReason} onActivate={control.activate} errorId={errorId} />
      {state.error && !disabledReason ? <p id={errorId} className="ar-error" role="alert">{state.error}</p> : null}
    </div>
  )
}
