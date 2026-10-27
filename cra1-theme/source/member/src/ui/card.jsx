import { cn } from './utils'

/** Shared exterior carries the preview glow; the inner element clips content.
 * Layout and business props stay on the original outer component. */
export function Card({ className, glow, variant = 'default', children, ...props }) {
  const outside = (className || '').split(/\s+/).filter(x => !['overflow-hidden', 'overflow-clip'].includes(x)).join(' ')
  return (
    <div className={cn('cui-card relative', variant === 'featured' && 'cui-card--featured', outside)} {...props}>
      <div className="cui-card__clip">
        {glow ? <span className="cui-card__glow" aria-hidden="true" /> : null}
        {children}
      </div>
    </div>
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('cui-card__header relative', className)} {...props} />
}

/** 卡片头排式（阿里云）：14px/600 标题；如需「查看全部 >」右侧链接，用 CardHeader + flex 行自行组合 */
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('cui-card__title relative', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('cui-card__description relative', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('cui-card__content relative', className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('cui-card__footer relative', className)} {...props} />
}

/** 页面标题区（每个页面顶部统一使用） */
export function PageHeader({ title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
