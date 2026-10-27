import * as DialogPrimitive from '@radix-ui/react-dialog'
import { createContext, useContext, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from './utils'
import { Button } from './button'

/**
 * Dialog（基于 Radix）
 * 可访问性由 Radix 保证：焦点移入、焦点陷阱、关闭后焦点归还、Escape 关闭、
 * aria-modal / role=dialog；遮罩与内容入场按主题 7.5 约束（≤300ms、非 scale(0)）。
 */
const DialogFocusOrigin = createContext(null)
export function Dialog({ open, defaultOpen = false, onOpenChange, ...props }) {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const isOpen = open === undefined ? localOpen : open
  const currentOrigin = () => typeof document === 'undefined' ? null : focusOrigin(document.activeElement)
  const [focus, setFocus] = useState(() => ({ open: isOpen, target: isOpen ? currentOrigin() : null }))
  // Capture the opening transition before React commits any autoFocus inputs or
  // removes the selected menu item. Keep the target during the close lifecycle.
  if (focus.open !== isOpen) setFocus({ open: isOpen, target: isOpen ? currentOrigin() : focus.target })
  return <DialogFocusOrigin.Provider value={focus.target}>
    <DialogPrimitive.Root {...props} open={isOpen} onOpenChange={(next) => {
      if (open === undefined) setLocalOpen(next)
      onOpenChange?.(next)
    }} />
  </DialogFocusOrigin.Provider>
}
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

function focusOrigin(element) {
  if (!element || element === document.body || element === document.documentElement) return null
  // Menu items disappear in the same commit that opens their dialog. Keep the
  // persistent menu trigger as the return target, before that item is removed.
  const menu = element.closest('[role="menu"]')
  if (!menu) return element
  return document.getElementById(menu.getAttribute('aria-labelledby')) ||
    [...document.querySelectorAll('[aria-haspopup="menu"][aria-controls]')]
      .find(trigger => trigger.getAttribute('aria-controls') === menu.id) || null
}

export function DialogContent({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }) {
  const openingTarget = useContext(DialogFocusOrigin)
  const returnFocus = useRef(typeof document === 'undefined' ? null : focusOrigin(document.activeElement))
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'cui-dialog-overlay fixed inset-0 z-[100] backdrop-blur-[2px]',
          'data-[state=open]:animate-[cra1-fade-in_180ms_ease-out]',
          // 关闭后 Radix 会保留该节点用于出场动画，并在其上写内联
          // style="pointer-events: auto" —— 内联样式优先于任何 CSS 类，
          // 因此 data-[state=closed]:pointer-events-none 不会生效，
          // 残留节点会继续覆盖全屏并拦截点击（实测挡住保存按钮）。
          // 用 display:none 彻底移除其命中区域，不受内联 PE 影响。
          'data-[state=closed]:hidden',
          'data-[state=closed]:animate-[cra1-fade-out_140ms_ease-out]'
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[101] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2',
          'cui-dialog max-h-[88vh] overflow-y-auto p-5',
          'data-[state=open]:animate-[cra1-dialog-in_200ms_cubic-bezier(0.23,1,0.32,1)]',
          className
        )}
        {...props}
        onOpenAutoFocus={(event) => {
          // Always-mounted, controlled dialogs need a fresh origin on each open.
          // A newly mounted menu dialog may already have lost the focused item.
          const active = focusOrigin(document.activeElement)
          if (openingTarget) returnFocus.current = openingTarget
          else if (active && !event.target.contains(active)) returnFocus.current = active
          onOpenAutoFocus?.(event)
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          if (event.defaultPrevented) return
          // Radix skips its open-autofocus event when an autoFocus child already
          // owns focus, so the opening-transition snapshot is authoritative.
          const target = openingTarget || returnFocus.current
          if (!target?.isConnected || target.matches(':disabled') || !target.getClientRects().length) return
          const activeDialog = document.activeElement?.closest('[role="dialog"][data-state="open"]')
          // A replacement or nested dialog owns focus until it closes.
          if (activeDialog && !activeDialog.contains(target)) { event.preventDefault(); return }
          event.preventDefault()
          target.focus({ preventScroll: true })
        }}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'cui-button cui-button--ghost cui-button--icon cui-dialog-close absolute right-2.5 top-2.5'
          )}
          aria-label="关闭"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('mb-4 pr-8', className)} {...props} />
}

export function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title className={cn('text-[15px] font-semibold text-ink', className)} {...props} />
  )
}

export function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn('mt-1 text-xs leading-5 text-muted', className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('cui-dialog-footer mt-5 flex justify-end gap-2', className)} {...props} />
}

/** 确认弹窗（替代原生 confirm()，语义与焦点管理更完整） */
export function ConfirmDialog({ open, title, description, confirmText = '确认', tone = 'default', onConfirm, onCancel, busy }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel?.()}>
      <DialogContent className="w-[min(92vw,384px)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            取消
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '处理中…' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
