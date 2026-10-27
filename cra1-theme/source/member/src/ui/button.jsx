import { useAccess } from './access'
import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from './utils'

/**
 * Button（shadcn 风格）
 * 变体与尺寸用 cva 声明；焦点态、禁用态、按压缩放按主题 7.6 约束实现。
 * 说明：单位全部用 px（见 app.css 顶部注释：系统 rem 适配会放大 rem）。
 */
const buttonVariants = cva(
  'cui-button',
  {
    variants: {
      variant: {
        default: 'cui-button--primary',
        outline: 'cui-button--outline',
        ghost: 'cui-button--ghost',
        danger: 'cui-button--danger',
        link: 'cui-button--link',
      },
      size: {
        sm: 'cui-button--sm',
        default: '',
        lg: 'cui-button--lg',
        icon: 'cui-button--icon',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const Button = forwardRef(function Button(
  { className, variant, size, permission, type = 'button', ...props },
  ref
) {
  const {can} = useAccess()
  if (permission && !can(permission)) return null
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
