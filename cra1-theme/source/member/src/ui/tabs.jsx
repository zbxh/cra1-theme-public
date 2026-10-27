import { useAccess } from './access'
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
        'cui-tabs mb-4 flex-wrap',
        className
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, permission, ...props }) {
  const {can} = useAccess(); if (permission && !can(permission)) return null
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'cui-tabs__trigger',
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
