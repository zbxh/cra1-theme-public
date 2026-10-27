import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from './utils'

/**
 * Tabs（基于 Radix，获得完整键盘导航与 ARIA 语义）
 * 键盘：←/→ 切换，Home/End 跳首尾；aria-selected/aria-controls 由 Radix 自动管理。
 */
export function Tabs({ className, ...props }) {
  return <TabsPrimitive.Root className={cn('w-full', className)} {...props} />
}

export function TabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'mb-4 inline-flex flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1',
        className
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-body',
        'transition-[background-color,color] duration-150',
        'hover:bg-surface-alt hover:text-ink',
        'data-[state=active]:bg-brand data-[state=active]:text-white',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand',
        className
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      className={cn('focus-visible:outline-none', className)}
      {...props}
    />
  )
}
