import { formatDate } from '../lib'

/**
 * 到期时间单元格：日期 + 到期临近倒计时徽标（阿里云资源列表式）。
 *
 * 阈值语义：
 *   - 已逾期（due < now）    → 红字日期 +「已逾期」
 *   - 30 天内到期            → 正常日期 + 橙色「N 天后到期」
 *   - 其余                   → 正常灰日期，不加徽标
 * due_time 为 0/空（长期有效）时只显示「长期」。
 */
export function DueCell({ dueTime }) {
  if (!dueTime) return <span className="text-muted-foreground">长期有效</span>
  const ms = dueTime * 1000
  const diffDays = Math.ceil((ms - Date.now()) / 86400000)
  if (diffDays < 0) {
    return (
      <span className="inline-flex flex-col">
        <span className="font-medium text-danger">{formatDate(dueTime)}</span>
        <span className="mt-0.5 inline-flex w-fit items-center rounded-full border border-danger/15 bg-danger/8 px-1.5 py-px text-[11px] font-medium text-danger">
          已逾期
        </span>
      </span>
    )
  }
  if (diffDays <= 30) {
    return (
      <span className="inline-flex flex-col">
        <span className="text-muted-foreground">{formatDate(dueTime)}</span>
        <span className="mt-0.5 inline-flex w-fit items-center rounded-full border border-warning/15 bg-warning/8 px-1.5 py-px text-[11px] font-medium text-warning">
          {diffDays === 0 ? '今天到期' : `${diffDays} 天后到期`}
        </span>
      </span>
    )
  }
  return <span className="text-muted-foreground">{formatDate(dueTime)}</span>
}
