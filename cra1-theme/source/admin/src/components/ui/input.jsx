import { forwardRef, useId, useRef, useLayoutEffect } from 'react'
import { cn } from './utils'

const base =
  'flex h-10 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-muted transition-[border-color,box-shadow] duration-150 ' +
  'focus-visible:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-muted ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15'

export const Input = forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={cn(base, className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(base, 'h-auto resize-y py-2.5 leading-6', className)}
      {...props}
    />
  )
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(base, 'cursor-pointer pr-8', className)} {...props}>
      {children}
    </select>
  )
})

export const Label = forwardRef(function Label({ className, ...props }, ref) {
  const id = useId()
  const local = useRef(null)
  useLayoutEffect(() => {
    const label = local.current
    if (!label || label.htmlFor) return
    const control = label.parentElement?.querySelector('input, textarea, select, [role="combobox"]')
    if (control) { if (!control.id) control.id = `field-${id}`; label.htmlFor = control.id }
  })
  return (
    <label
      ref={(el) => { local.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el }}
      className={cn('mb-1.5 block text-[13px] font-medium text-body', className)}
      {...props}
    />
  )
})

/** 字段容器：标签 + 控件 + 错误提示（表单统一结构） */
export function Field({ label, htmlFor, error, hint, required, children, className }) {
  return (
    <div className={cn('mb-4', className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export function Checkbox({ className, ...props }) {
  return (
    <input
      type="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded border-line text-brand accent-[#1769E0] ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className
      )}
      {...props}
    />
  )
}
