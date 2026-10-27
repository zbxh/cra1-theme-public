import { forwardRef } from 'react'
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
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
    'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white hover:bg-brand-hover shadow-sm',
        outline:
          'border border-line bg-surface text-ink hover:bg-surface-alt hover:border-brand/40',
        ghost: 'text-body hover:bg-surface-alt hover:text-ink',
        danger: 'bg-danger text-white hover:brightness-95 shadow-sm',
        link: 'text-brand underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-[13px] rounded-md [&_svg]:size-3.5',
        default: 'h-10 px-4 text-sm rounded-lg [&_svg]:size-4',
        lg: 'h-11 px-6 text-sm rounded-lg [&_svg]:size-4',
        icon: 'h-9 w-9 rounded-lg [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const Button = forwardRef(function Button(
  { className, variant, size, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
})

export { Button, buttonVariants }
