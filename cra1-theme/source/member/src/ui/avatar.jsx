import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from './utils'

/**
 * 头像容器：flex 居中必须用 inline style 兜底。
 *
 * 原因（线上问题：头像字母偏左上）：系统 reset.css 含**未分层**的
 * `div, span { ... }` 类规则，按 CSS 级联「未分层规则优先于 @layer」，
 * Tailwind 的 items-center/justify-center（utilities 层）会被压掉，
 * 导致 AvatarFallback/子元素的 flex 居中失效——容器 64px、字宽 12px，
 * 全部靠左上。inline style 不参与层级比较，任何 reset 都影响不到它。
 */
export function Avatar({ className, style, ...props }) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-lg', className)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}
      {...props}
    />
  )
}

export function AvatarImage({ className, ...props }) {
  return <AvatarPrimitive.Image className={cn('aspect-square size-full', className)} {...props} />
}

export function AvatarFallback({ className, ...props }) {
  return (
    <AvatarPrimitive.Fallback
      className={cn('flex size-full items-center justify-center rounded-lg bg-brand text-[13px] font-semibold text-white', className)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      {...props}
    />
  )
}
