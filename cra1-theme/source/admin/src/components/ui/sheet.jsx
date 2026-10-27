import * as SheetPrimitive from '@radix-ui/react-dialog'
import { useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from './utils'

/**
 * Sheet（shadcn 规范）：侧边抽屉，基于 Radix Dialog
 * 可访问性由 Radix 保证：焦点陷阱、焦点归还、Escape 关闭、aria-modal。
 */
export const Sheet = SheetPrimitive.Root
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close

export function SheetContent({ className, children, side = 'left', onOpenAutoFocus, onCloseAutoFocus, ...props }) {
  const focusOrigin = useRef(null)
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-[100] bg-black/50',
          'data-[state=open]:animate-[cra1-fade-in_180ms_ease-out]',
          'data-[state=closed]:animate-[cra1-fade-out_140ms_ease-out]'
        )}
      />
      <SheetPrimitive.Content
        onOpenAutoFocus={(event) => { focusOrigin.current = document.activeElement; onOpenAutoFocus?.(event) }}
        onCloseAutoFocus={(event) => { onCloseAutoFocus?.(event); if (!event.defaultPrevented && focusOrigin.current?.isConnected) { event.preventDefault(); focusOrigin.current.focus() } }}
        aria-describedby={undefined}
        className={cn(
          'fixed inset-y-0 z-[101] flex h-full w-[280px] flex-col bg-surface',
          'data-[state=open]:transition-transform data-[state=open]:duration-200 data-[state=open]:ease-out',
          side === 'left'
            ? 'left-0 border-r border-line data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0'
            : 'right-0 border-l border-line data-[state=closed]:translate-x-full data-[state=open]:translate-x-0',
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          className="absolute right-3 top-3 rounded-md p-1 text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          aria-label="关闭"
        >
          <X className="size-4" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 p-4', className)} {...props} />
}

export function SheetTitle({ className, ...props }) {
  return <SheetPrimitive.Title className={cn('text-sm font-semibold text-ink', className)} {...props} />
}

export function SheetDescription({ className, ...props }) {
  return <SheetPrimitive.Description className={cn('text-xs text-muted', className)} {...props} />
}
