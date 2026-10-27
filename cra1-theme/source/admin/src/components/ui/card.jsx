import { cn } from './utils'

/**
 * Card：阿里云工作台式白卡（8px 圆角 + 1px 描边 + 极淡阴影；描边为主、阴影为辅）。
 *
 * glow 变体：在卡片内叠加 2~3 个低透明度彩色光斑（品牌蓝/靛蓝/青，8%~14%，
 * blur 24px），形成阿里云卡片式的「不规则彩色朦胧背景」。光斑是独立绝对定位
 * 层（pointer-events:none），浮在外层纯白底之上——不触碰 cra1-shell.css 对
 * .bg-surface 的 !important 白底覆盖（插件页同享），因此稳定可控、不影响插件页。
 */
const GLOW_LAYER = (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-0"
    style={{
      background:
        'radial-gradient(32% 46% at 92% 6%, rgba(23, 119, 255, 0.12) 0%, transparent 70%),' +
        'radial-gradient(30% 44% at 4% 96%, rgba(99, 102, 241, 0.10) 0%, transparent 70%),' +
        'radial-gradient(26% 40% at 70% 100%, rgba(6, 182, 212, 0.09) 0%, transparent 70%)',
      filter: 'blur(24px)',
    }}
  />
)

export function Card({ className, glow, ...props }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className
      )}
      {...props}
    >
      {glow ? GLOW_LAYER : null}
      {props.children}
    </div>
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('relative flex flex-col gap-1.5 p-5', className)} {...props} />
}

/** 卡片头排式（阿里云）：14px/600 标题；如需「查看全部 >」右侧链接，用 CardHeader + flex 行自行组合 */
export function CardTitle({ className, ...props }) {
  return <h3 className={cn('relative text-[14px] font-semibold text-ink', className)} {...props} />
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
        <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
