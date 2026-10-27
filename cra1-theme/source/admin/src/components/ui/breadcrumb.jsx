import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from './utils'

/** Breadcrumb（shadcn 规范）：语义化 nav + ol，含 aria-current */
export function Breadcrumb({ className, ...props }) {
  return <nav aria-label="breadcrumb" className={cn(className)} {...props} />
}

export function BreadcrumbList({ className, ...props }) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground', className)} {...props} />
  )
}

export function BreadcrumbItem({ className, ...props }) {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />
}

export function BreadcrumbLink({ className, ...props }) {
  return <a className={cn('transition-colors duration-150 hover:text-ink', className)} {...props} />
}

export function BreadcrumbPage({ className, ...props }) {
  return (
    <span role="link" aria-disabled="true" aria-current="page" className={cn('font-medium text-ink', className)} {...props} />
  )
}

export function BreadcrumbSeparator({ children, className, ...props }) {
  return (
    <li role="presentation" aria-hidden="true" className={cn('[&>svg]:size-3.5', className)} {...props}>
      {children ?? <ChevronRight />}
    </li>
  )
}

export function BreadcrumbEllipsis({ className, ...props }) {
  return (
    <span role="presentation" aria-hidden="true" className={cn('flex size-9 items-center justify-center', className)} {...props}>
      <MoreHorizontal className="size-4" />
      <span className="sr-only">更多</span>
    </span>
  )
}
