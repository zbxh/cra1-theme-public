import { ChevronLeft, ChevronRight, Search, X, ArrowUpDown } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { cn } from './utils'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from './table'

/**
 * DataTable（shadcn dashboard-01 数据表格模式）
 *
 * 结构 = 工具栏（搜索 + 筛选 + 操作） + 表格 + 底部分页
 * 与 shadcn 的差异：不引入 @tanstack/react-table（体积大且需适配服务端分页），
 * 改为轻量实现，保持同样的视觉与交互（列头、斑马纹可选、吸顶、空态、分页）。
 */
export function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  empty,
  // 工具栏
  search,
  onSearchChange,
  searchPlaceholder = '搜索…',
  filters,
  actions,
  // 分页（服务端）
  page,
  total,
  limit = 10,
  // When the API omits a real count, navigate by the returned page instead.
  hasMore,
  onPageChange,
  className,
}) {
  const maxPage = Math.max(1, Math.ceil((total || 0) / limit))
  const unknownTotal = typeof hasMore === 'boolean'
  const showPager = unknownTotal ? page > 1 || hasMore : total > limit
  const isEmpty = !loading && !error && rows.length === 0

  // 表格最小宽度 = 各列期望宽度之和（未声明的列按 140px 计）。
  // 必要性：table-layout:auto 下浏览器会把「可换行」的列压到 min-content，
  // 于是像操作日志的「操作」列在手机端被压成一字一行，而同排的 IP 列因为是
  // 不可断开的地址整串会撑开本应紧凑的表格列。
  // 给定 min-width 后，窄屏由外层 overflow-x-auto 容器横向滚动，列宽不再被压塌。
  const minTableWidth = columns.reduce(
    (sum, c) => sum + (Number(c.width) || Number(c.minWidth) || 140),
    0
  )

  return (
    <div className={cn('space-y-4', className)}>
      {(search !== undefined || filters || actions) && (
        <div className="flex flex-wrap items-center gap-2">
          {search !== undefined && (
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-8"
                aria-label={searchPlaceholder}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange?.('')}
                  aria-label="清除搜索"
                  className="absolute right-1.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-surface-alt hover:text-ink"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {filters}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
          页面错误，请刷新重试
        </div>
      )}

      <div>
      <Table style={{ minWidth: minTableWidth }} wrapperClassName={isEmpty ? 'rounded-b-none border-b-0' : undefined}>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn(c.align === 'right' && 'text-right', c.className)}
                // width 用 minWidth 而非 width：auto 布局下 width 只是「建议值」，
                // 浏览器仍可能把该列压到 min-content（中文逐字换行）。
                // 用 min-width 才能阻止列被压塌，窄屏交给外层容器横向滚动。
                style={c.width ? { minWidth: c.width } : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {c.title}
                  {c.sortable && <ArrowUpDown className="size-3 text-muted-foreground/60" aria-hidden="true" />}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeleton rows={limit > 8 ? 8 : limit} cols={columns.length} />
          ) : rows.length === 0 ? (
            null
          ) : (
            rows.map((row, i) => (
              <TableRow key={row.id ?? i}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(c.align === 'right' && 'text-right', c.cellClassName)}>
                    {c.render ? c.render(row, i) : row[c.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {isEmpty && <div role="status" className="rounded-b-2xl border border-t-0 border-line px-4 py-12 text-center text-muted-foreground">{empty || '暂无数据'}</div>}
      </div>

      {showPager && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {unknownTotal ? `第 ${page} 页` : `共 ${total} 条 · 第 ${page}/${maxPage} 页`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => onPageChange?.(page - 1)}>
              <ChevronLeft className="size-3.5" />上一页
            </Button>
            <Button variant="outline" size="sm" disabled={loading || !!error || (unknownTotal ? !hasMore : page >= maxPage)} onClick={() => onPageChange?.(page + 1)}>
              下一页<ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
