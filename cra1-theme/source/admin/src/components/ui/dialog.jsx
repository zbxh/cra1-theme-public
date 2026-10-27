import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from './utils'

/**
 * Dialog（基于 Radix）
 * 可访问性由 Radix 保证：焦点移入、焦点陷阱、关闭后焦点归还、Escape 关闭、
 * aria-modal / role=dialog；遮罩与内容入场按主题 7.5 约束（≤300ms、非 scale(0)）。
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({ className, children, onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown, ...props }) {
  const focusOrigin = useRef(null)
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-[100] bg-ink/40 backdrop-blur-[2px]',
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
        onEscapeKeyDown={(event) => {
          // Radix listens on document before the native picker receives Esc.
          // Let the topmost icon dialog discard its draft without closing this editor.
          if (event.target?.closest?.('dialog.ip-dialog[open]')) { event.preventDefault(); return }
          onEscapeKeyDown?.(event)
        }}
        onOpenAutoFocus={(event) => { focusOrigin.current = document.activeElement; onOpenAutoFocus?.(event) }}
        onCloseAutoFocus={(event) => { onCloseAutoFocus?.(event); if (!event.defaultPrevented && focusOrigin.current?.isConnected) { event.preventDefault(); focusOrigin.current.focus() } }}
        className={cn(
          'fixed left-1/2 top-1/2 z-[101] w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2',
          'max-h-[88vh] overflow-y-auto rounded-xl border border-line bg-surface p-5',
          'shadow-[0_2px_5px_rgba(22,32,51,0.06),0_24px_48px_rgba(22,32,51,0.16)]',
          'data-[state=open]:animate-[cra1-dialog-in_200ms_cubic-bezier(0.23,1,0.32,1)]',
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-3.5 top-3.5 rounded-md p-1 text-muted',
            'transition-colors duration-150 hover:bg-surface-alt hover:text-ink',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
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
  return <div className={cn('mt-5 flex justify-end gap-2', className)} {...props} />
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
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-line bg-surface px-4 text-sm text-ink transition-colors duration-150 hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'h-10 rounded-lg px-4 text-sm font-medium text-white transition-[background-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50',
              tone === 'danger' ? 'bg-danger hover:brightness-95' : 'bg-brand hover:bg-brand-hover'
            )}
          >
            {busy ? '处理中…' : confirmText}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
