import * as SheetPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { cn } from './utils'
import { useDialogViewport } from './use-dialog-viewport'

/**
 * Sheet（shadcn 规范）：侧边抽屉，基于 Radix Dialog
 * 可访问性由 Radix 保证：焦点陷阱、焦点归还、Escape 关闭、aria-modal。
 */
const SheetOpen = createContext(false)
export function Sheet({ open, defaultOpen = false, onOpenChange, ...props }) {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const isOpen = open === undefined ? localOpen : open
  return <SheetOpen.Provider value={isOpen}><SheetPrimitive.Root {...props} open={isOpen} onOpenChange={next => {
    if (open === undefined) setLocalOpen(next)
    onOpenChange?.(next)
  }} /></SheetOpen.Provider>
}
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close

export function SheetContent({ className, children, side = 'left', style, ref, ...props }) {
  const contentRef = useRef(null)
  const setContentRef = useCallback(node => { contentRef.current = node; if (typeof ref === 'function') return ref(node); if (ref) ref.current = node }, [ref])
  const viewportStyle = useDialogViewport(useContext(SheetOpen), contentRef)
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        className={cn(
          'cui-dialog-overlay fixed inset-0 z-[100]',
          'data-[state=open]:animate-[cra1-fade-in_180ms_ease-out]',
          'data-[state=closed]:animate-[cra1-fade-out_140ms_ease-out] data-[state=closed]:hidden'
        )}
      />
      <SheetPrimitive.Content
        ref={setContentRef}
        className={cn(
          'cui-sheet cui-member-sheet fixed z-[101] flex w-[280px] flex-col bg-surface',
          'data-[state=open]:transition-transform data-[state=open]:duration-200 data-[state=open]:ease-out',
          side === 'left'
            ? 'left-0 border-r border-line data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0'
            : 'right-0 border-l border-line data-[state=closed]:translate-x-full data-[state=open]:translate-x-0',
          className
        )}
        style={{ ...viewportStyle, ...style }}
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
