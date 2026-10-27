import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from './utils'

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal
export const DropdownMenuSub = DropdownMenuPrimitive.Sub
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

export function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-[120] min-w-[180px] overflow-hidden rounded-lg border border-line bg-surface p-1',
          'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.08),0_2px_4px_-2px_rgba(0,0,0,0.06)]',
          'data-[state=open]:animate-[cra1-pop-in_150ms_cubic-bezier(0.23,1,0.32,1)]',
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({ className, inset, variant = 'default', ...props }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 h-8 text-[13px] outline-none',
        'transition-colors duration-150 focus:bg-surface-alt',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        variant === 'destructive' && 'text-danger focus:bg-danger/8',
        inset && 'pl-8',
        '[&>svg]:size-3.5 [&>svg]:shrink-0',
        className
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, inset, ...props }) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-2 py-1.5 text-[13px] font-semibold', inset && 'pl-8', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({ className, ...props }) {
  return <DropdownMenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />
}

export function DropdownMenuShortcut({ className, ...props }) {
  return <span className={cn('ml-auto text-xs tracking-widest text-muted', className)} {...props} />
}
