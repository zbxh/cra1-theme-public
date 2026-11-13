import { cn } from './utils'

/**
 * Card：阿里云工作台式白卡（8px 圆角 + 1px 描边 + 极淡阴影；描边为主、阴影为辅）。
 *
 * glow 变体仅在悬停时使用共用沿边光，默认保留普通边框。
 */
export function Card({ className, glow, ...props }) {
  return (
    <div
      data-cui-edge={glow ? 'hover' : undefined}
      className={cn(
        'admin-card relative overflow-hidden rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        glow && 'cui-edge--card', className
      )}
      {...props}
    >
      {glow ? <span className="cui-edge-segment" aria-hidden="true" /> : null}
      {props.children}
    </div>
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('relative flex flex-col gap-1.5 p-5', className)} {...props} />
}

/** 卡片头排式（阿里云）：14px/600 标题；如需「查看全部 >」右侧链接，用 CardHeader + flex 行自行组合 */
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('relative text-[14px] font-semibold text-title', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('relative text-xs leading-5 text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('relative p-5 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('relative flex items-center p-5 pt-0', className)} {...props} />
}

/** 页面标题区（每个页面顶部统一使用） */
export function PageHeader({ title, description, actions, className }) {
  return (
    <div data-page-header className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-title">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
