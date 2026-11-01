import {useAccess} from './access'
import { useEffect, useState } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from './utils'

export function DropdownMenu({ open, defaultOpen = false, onOpenChange, ...props }) {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const isOpen = open === undefined ? localOpen : open
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return
    const viewport = window.visualViewport
    const size = () => [window.innerWidth, window.innerHeight, viewport?.width, viewport?.height]
    const openingSize = size()
    // A menu opened before rotation or a keyboard/viewport resize can retain
    // its old collision height. Reopening lets Radix position it afresh.
    const closeOnResize = () => {
      if (!size().some((value, index) => Math.abs((value ?? 0) - (openingSize[index] ?? 0)) > 1)) return
      if (open === undefined) setLocalOpen(false)
      onOpenChange?.(false)
    }
    window.addEventListener('resize', closeOnResize)
    viewport?.addEventListener('resize', closeOnResize)
    return () => {
      window.removeEventListener('resize', closeOnResize)
      viewport?.removeEventListener('resize', closeOnResize)
    }
  }, [isOpen, open, onOpenChange])
  return <DropdownMenuPrimitive.Root {...props} open={isOpen} onOpenChange={next => {
    if (open === undefined) setLocalOpen(next)
    onOpenChange?.(next)
  }} />
}
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal
export const DropdownMenuSub = DropdownMenuPrimitive.Sub
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup
export const DropdownMenuCheckboxItem = DropdownMenuPrimitive.CheckboxItem

export function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'cui-popover z-[120] min-w-[180px] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto p-1',
          'data-[state=open]:animate-[cra1-pop-in_150ms_cubic-bezier(0.23,1,0.32,1)]',
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({ className, inset, permission, variant = 'default', ...props }) {
  const {can}=useAccess(); if(permission && !can(permission))return null
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'cui-menu-item',
        variant === 'destructive' && 'cui-menu-item--danger',
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
