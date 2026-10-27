import { cn } from './utils'
import { Card, CardDescription, CardHeader, CardTitle } from './card'

/* 语义色调（图标块底色/前景色）：全部走 @theme 令牌（§8 禁止散落硬编码色值） */
const ICON_TONES = {
  brand: 'bg-brand/8 text-brand',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  muted: 'bg-muted-bg text-muted-foreground',
}

/* 可点击统计卡的交互层：阿里云工作台式——描边转主色 + 阴影浮起 */
const CLICKABLE = cn(
  'transition-all duration-150 cursor-pointer',
  'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-brand/40',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
)

/**
 * StatCard（重构：阿里云工作台大数字卡）
 *
 * 结构 = 顶部一行（13px 灰标签 + 可选徽标）+ 大号数值（tabular-nums）+
 * 底部辅助行（hint 强调 + sub 灰说明）。去掉旧版渐变底与图标块前置，
 * 数字是绝对主角；href/onClick 传入时整卡可点击。
 * 可选 icon：渲染在右上角的小图标位（弱化装饰、保留辨识度）。
 */
export function StatCard({ label, value, badge, hint, sub, icon: Icon, tone = 'brand', href, onClick, bar, className }) {
  const iconTone = ICON_TONES[tone] || ICON_TONES.brand
  /* 进度条槽位（华为云安全评估式）：bar = { percent: 0-100, tone } */
  const barEl = bar && (
    <div className="px-5 pb-4">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/70">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            bar.tone === 'warning' ? 'bg-warning' : bar.tone === 'danger' ? 'bg-danger' : 'bg-brand'
          )}
          style={{ width: `${Math.max(0, Math.min(100, Number(bar.percent) || 0))}%` }}
        />
      </div>
    </div>
  )

  const inner = (
    <CardHeader className="relative pb-2">
      <div className="flex items-center justify-between gap-2">
        <CardDescription className="text-[13px]">{label}</CardDescription>
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', iconTone)} aria-hidden="true">
              <Icon className="size-4" />
            </span>
          )}
          {badge && badge}
        </div>
      </div>
      <CardTitle className="mt-2 text-[26px] font-semibold tabular-nums leading-8 tracking-tight">{value}</CardTitle>
    </CardHeader>
  )
  const footer = (hint || sub) && (
    <div className="flex flex-col gap-0.5 px-5 pb-4 text-[12px]">
      {hint && <div className="font-medium text-body">{hint}</div>}
      {sub && <div className="text-muted-foreground">{sub}</div>}
    </div>
  )

  const body = (
    <>
      {inner}
      {barEl}
      {footer}
    </>
  )

  if (href) {
    return (
      <a href={href} className={cn('group relative block overflow-hidden rounded-lg', CLICKABLE, className)}>
        {body}
      </a>
    )
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn('relative block w-full overflow-hidden rounded-lg text-left', CLICKABLE, className)}
      >
        {body}
      </button>
    )
  }
  return (
    <Card glow className={cn('relative overflow-hidden', className)}>
      {body}
    </Card>
  )
}

/**
 * StatGrid（统计卡容器）：响应式 1/2/4 列，与 shadcn dashboard 一致
 */
export function StatGrid({ children, className }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {children}
    </div>
  )
}
