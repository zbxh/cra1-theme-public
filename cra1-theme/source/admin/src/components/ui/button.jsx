import { Children, cloneElement, forwardRef, isValidElement } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from './utils'

/**
 * Button（shadcn 风格）
 * 变体与尺寸用 cva 声明；焦点态、禁用态、按压缩放按主题 7.6 约束实现。
 * 说明：单位全部用 px（见 app.css 顶部注释：系统 rem 适配会放大 rem）。
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ' +
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'admin-button-primary text-white shadow-sm',
        outline:
          'border border-line bg-surface text-ink hover:bg-surface-alt',
        ghost: 'text-body hover:bg-surface-alt hover:text-ink',
        danger: 'bg-danger text-white hover:brightness-95 shadow-sm',
        link: 'text-brand underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3 text-[13px] rounded-control [&_svg]:size-3.5',
        default: 'h-10 px-4 text-sm rounded-control [&_svg]:size-4',
        lg: 'h-11 px-6 text-sm rounded-control [&_svg]:size-4',
        icon: 'h-9 w-9 rounded-control [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const Button = forwardRef(function Button(
  { className, variant = 'default', size, type = 'button', children, disabled, asChild = false, ...props },
  ref
) {
  const ordinary = size !== 'icon' && ['default', 'outline'].includes(variant)
  const classes = cn(buttonVariants({ variant, size }), ordinary && 'cui-button',
    variant === 'outline' && ordinary && 'cui-button--outline', variant === 'danger' && 'cui-button--danger', className)
  const glow = ordinary && <span className="cui-button-glow" aria-hidden="true" />
  if (asChild && isValidElement(children)) {
    const child = Children.only(children)
    return cloneElement(child, {
      ...props, ref, 'data-admin-button': variant, className: cn(classes, child.props.className),
      'aria-disabled': disabled || child.props['aria-disabled'],
      onClick: event => {
        if (disabled) { event.preventDefault(); return }
        child.props.onClick?.(event)
        if (!event.defaultPrevented) props.onClick?.(event)
      },
      children: <>{glow}{child.props.children}</>,
    })
  }
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      data-admin-button={variant}
      className={classes}
      {...props}
    >
      {glow}
      {children}
    </button>
  )
})

export { Button, buttonVariants }
