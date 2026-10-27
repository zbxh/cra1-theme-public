import { cn } from './utils'

/** Badge：状态标签（胶囊形，浅底主色字，对齐主题 7.4） */
const tones = {
  default: 'bg-brand/8 text-brand border-brand/15',
  success: 'bg-[#00B42A]/8 text-[#00B42A] border-[#00B42A]/15',
  warning: 'bg-[#B45309]/8 text-[#B45309] border-[#B45309]/15',
  danger: 'bg-danger/8 text-danger border-danger/15',
  muted: 'bg-surface-alt text-muted border-line',
}

export function Badge({ tone = 'default', className, ...props }) {
  return (
    <span
      className={cn(
        // whitespace-nowrap：Badge 常置于受宽度约束的表格单元格内，
        // 缺少它时中文标签会被逐字换行（「入站」竖排成两行）。
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
        tones[tone] || tones.default,
        className
      )}
      {...props}
    />
  )
}

/** Alert：页面级提示（错误/成功/警告/信息），带 role 便于读屏播报 */
const alertTones = {
  error: 'border-danger/20 bg-danger/6 text-danger',
  success: 'border-[#00B42A]/20 bg-[#00B42A]/6 text-[#00B42A]',
  warning: 'border-[#B45309]/20 bg-[#B45309]/6 text-[#B45309]',
  info: 'border-brand/20 bg-brand/6 text-brand',
}

export function Alert({ tone = 'info', className, children, ...props }) {
  const role = tone === 'error' ? 'alert' : 'status'
  return (
    <div
      role={role}
      className={cn('rounded-lg border px-3.5 py-2.5 text-[13px]', alertTones[tone], className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** 空态：列表/异步区无数据时使用（不得留白） */
export function EmptyState({ icon: Icon, title = '暂无数据', description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon && <Icon className="mb-3 size-8 text-muted/60" aria-hidden="true" />}
      <p className="text-sm font-medium text-body">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-5 text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** 骨架块（通用加载占位） */
export function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded bg-line/60', className)} {...props} />
}

/** 分割线 */
export function Separator({ className }) {
  return <div className={cn('h-px w-full bg-line', className)} role="separator" />
}
