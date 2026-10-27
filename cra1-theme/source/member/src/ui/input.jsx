import { forwardRef } from 'react'
import { cn } from './utils'

const base = 'cui-input'

export const Input = forwardRef(function Input({ className, type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={cn(base, className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(base, 'cui-textarea', className)}
      {...props}
    />
  )
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(base, 'cui-select', className)} {...props}>
      {children}
    </select>
  )
})

export const Label = forwardRef(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn('cui-label', className)}
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
        'cui-checkbox rounded border-line',
        className
      )}
      {...props}
    />
  )
}
