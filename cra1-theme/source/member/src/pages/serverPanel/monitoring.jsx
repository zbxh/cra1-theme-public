import { ChartTooltip } from '../../ui/chart-tooltip'
import { ChoiceButton } from '../../ui/choice'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, RotateCw, X, Cpu, MemoryStick, Wifi, HardDrive } from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/feedback'
import { Label } from '../../ui/input'
import { DateTimePicker } from '../../ui/date-time-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog'
import { cn } from '../../ui/utils'
import { chartTimeLabel, formatBps, formatBytes } from './format'

/**
 * 监控标签页：CPU / 内存 / 网卡（带宽）/ 硬盘 IO 四个独立模块。
 * 每个模块**各自**选择时间范围（快捷档 + 自定义弹窗），互不影响；
 * 自定义时间通过弹窗选择（datetime-local 起止 → 秒级 API）。
 *
 * 数据：GET /mf_cloud/:id/chart {type, start_time, dev}
 *   cpu → [{time, value(0-100)}]；memory → [{time, total, used(B)}]
 *   bw  → [{time, in_bw, out_bw(bps)}]；disk_io → [{time, read_bytes, write_bytes(B/s), ...}]
 */

const QUICK_SPANS = [
  { key: 3600, label: '1小时' },
  { key: 6 * 3600, label: '6小时' },
  { key: 24 * 3600, label: '24小时' },
  { key: 3 * 86400, label: '3天' },
  { key: 7 * 86400, label: '7天' },
  { key: 30 * 86400, label: '30天' },
]

const MODULES = [
  {
    key: 'cpu', title: 'CPU 使用率', Icon: Cpu, yFmt: (v) => `${v}%`, domain: [0, 100],
    series: [{ key: 'value', name: 'CPU', color: 'var(--cui-titanium)', fmt: (v) => `${v}%` }],
  },
  {
    key: 'memory', title: '内存使用', Icon: MemoryStick, yFmt: (v) => `${v}%`, domain: [0, 100],
    series: [
      { key: 'memTotal', name: '总量', color: 'rgba(29,33,41,0.18)', width: 1.2 },
      { key: 'memUsed', name: '已用', color: 'var(--cui-titanium)', fmt: (v) => `${v}%` },
    ],
  },
  {
    key: 'bw', title: '网卡（带宽）', Icon: Wifi, yFmt: (v) => formatBps(v, 0),
    series: [
      { key: 'inBps', name: '入带宽', color: 'var(--cui-titanium)', fmt: (v) => formatBps(v) },
      { key: 'outBps', name: '出带宽', color: '#06B6D4', fmt: (v) => formatBps(v) },
    ],
  },
  {
    key: 'disk_io', title: '硬盘 IO', Icon: HardDrive, yFmt: (v) => `${v}M`,
    series: [
      { key: 'read', name: '读', color: 'var(--cui-titanium)', fmt: (v) => `${v} MB/s` },
      { key: 'write', name: '写', color: '#06B6D4', fmt: (v) => `${v} MB/s` },
    ],
  },
]

/** 时间戳（秒）→ datetime-local 输入值（本地时区） */
function toLocalInput(sec) {
  const d = new Date(sec * 1000)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v) {
  const t = new Date(v).getTime()
  return isFinite(t) ? Math.floor(t / 1000) : null
}
function fmtFull(sec) {
  if (!sec) return ''
  const d = new Date(sec * 1000)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MonitoringTab({ api, hostId }) {
  /* 每个模块独立的时间范围状态：{ [key]: { span } } 或 { [key]: { start, end } } */
  const [ranges, setRanges] = useState(() =>
    Object.fromEntries(MODULES.map((m) => [m.key, { span: 24 * 3600 }]))
  )

  const rangeOf = useCallback((key) => {
    const r = ranges[key] || { span: 24 * 3600 }
    if (r.start && r.end) return r
    const end = Math.floor(Date.now() / 1000)
    return { start: end - (r.span || 86400), end }
  }, [ranges])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {MODULES.map((m) => (
        <ChartModule
          key={m.key}
          api={api}
          hostId={hostId}
          module={m}
          range={rangeOf(m.key)}
          rangeState={ranges[m.key] || { span: 86400 }}
          onRangeChange={(next) => setRanges((r) => ({ ...r, [m.key]: next }))}
        />
      ))}
    </div>
  )
}

/**
 * 图表数据缓存（模块级，跨组件挂载保留）。
 *
 * 监控标签页是条件渲染：切到其它标签时整棵树卸载，切回来重新挂载 →
 * 每次都要重发 4 个图表请求（实测切 5 次 = 20 个请求），且图表闪一下骨架。
 * 缓存命中时直接渲染旧数据（后台静默续拉），避免重复请求与闪烁。
 *
 * key = `${hostId}|${type}|${start}`；值 = 数据数组。
 * 上限 40 条（4 模块 × 10 个档位），超出按插入顺序淘汰最旧。
 */
const chartCache = new Map()
const CHART_CACHE_MAX = 40
function cacheGet(key) {
  return chartCache.has(key) ? chartCache.get(key) : undefined
}
function cacheSet(key, val) {
  if (chartCache.size >= CHART_CACHE_MAX && !chartCache.has(key)) {
    const oldest = chartCache.keys().next().value
    chartCache.delete(oldest)
  }
  chartCache.set(key, val)
}

/** 单个监控模块：独立时间选择（快捷 + 自定义弹窗）+ 图表 */
function ChartModule({ api, hostId, module: m, range, rangeState, onRangeChange }) {
  /* 缓存键用「档位标识」而不是绝对 start：
     快捷档位的 range.start 由 Date.now() 现算（每秒都不同），
     若拿它做 key 则缓存永不命中。快捷档用 span（稳定），自定义档用 start。 */
  const cacheKey = `${hostId}|${m.key}|${rangeState.start && rangeState.end ? `c${rangeState.start}` : `s${rangeState.span || 86400}`}`
  const [list, setList] = useState(() => cacheGet(cacheKey) ?? null)
  const [loading, setLoading] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)

  const spanHours = Math.max((range.end - range.start) / 3600, 1)

  const load = useCallback(() => {
    if (!api) return
    const cached = cacheGet(cacheKey)
    /* 有缓存：先渲染缓存（不显示骨架），再静默续拉最新数据 */
    if (cached !== undefined) setList(cached)
    else setLoading(true)
    api.chart({ type: m.key, start_time: range.start })
      .then((r) => {
        const rows = r.data?.list || []
        cacheSet(cacheKey, rows)
        setList(rows)
      })
      .catch(() => { if (cached === undefined) setList([]) })
      .finally(() => setLoading(false))
  }, [api, m.key, range.start, cacheKey])

  useEffect(() => { load() }, [load])

  const rows = (list || []).map((p) => {
    if (m.key === 'cpu') return { time: chartTimeLabel(p.time, spanHours), value: p.value, raw: p }
    if (m.key === 'memory') {
      return {
        time: chartTimeLabel(p.time, spanHours),
        memUsed: p.total ? Number(((p.used / p.total) * 100).toFixed(1)) : undefined,
        memTotal: p.total ? 100 : undefined,
        raw: p,
      }
    }
    if (m.key === 'bw') return { time: chartTimeLabel(p.time, spanHours), inBps: p.in_bw, outBps: p.out_bw, raw: p }
    return {
      time: chartTimeLabel(p.time, spanHours),
      read: p.read_bytes !== undefined ? Number((p.read_bytes / 1024 / 1024).toFixed(2)) : undefined,
      write: p.write_bytes !== undefined ? Number((p.write_bytes / 1024 / 1024).toFixed(2)) : undefined,
      raw: p,
    }
  })

  const isCustom = !!(rangeState.start && rangeState.end)
  const tooltipExtra = (payload) => {
    const p = payload?.raw
    if (m.key === 'memory' && p?.total) return ` ${formatBytes(p.used)} / ${formatBytes(p.total)}`
    return ''
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-0">
        <CardTitle className="flex items-center gap-1.5">
          <m.Icon className="size-4 shrink-0 text-brand" />
          {m.title}
        </CardTitle>
        {/* 该模块自己的时间选择 */}
        <div className="flex flex-wrap items-center gap-1">
          {QUICK_SPANS.map((s) => (
            <ChoiceButton
              key={s.key}
              type="button"
              onClick={() => onRangeChange({ span: s.key })}
              selected={!isCustom && rangeState.span === s.key}
            >
              {s.label}
            </ChoiceButton>
          ))}
          <ChoiceButton
            type="button"
            onClick={() => setCustomOpen(true)}
            selected={isCustom} className="inline-flex items-center gap-1"
            title="自定义时间范围"
          >
            <CalendarRange className="size-3" />
            自定义
          </ChoiceButton>
          <button
            type="button"
            onClick={load}
            className="cui-button cui-button--outline cui-button--icon"
            aria-label="刷新"
          >
            <RotateCw className={cn('size-3', loading && 'animate-spin')} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <p className="mb-1 text-right text-[11px] text-muted-foreground">
          {fmtFull(range.start)} ~ {fmtFull(range.end)}
        </p>
        <div className="h-52 w-full">
          {loading && !rows.length ? (
            <Skeleton className="h-full w-full" />
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">暂无监控数据</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  interval="preserveStartEnd"
                  minTickGap={36}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-line)' }}
                />
                <YAxis
                  domain={m.domain}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickFormatter={m.yFmt}
                  width={62}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip formatter={(v, k, item) => {
                    const s = m.series.find((x) => x.key === k || x.name === k)
                    const label = s ? (s.fmt ? s.fmt(v) : v) : v
                    return [`${label}${tooltipExtra(item?.payload)}`, s?.name || k]
                  }} />} />
                {m.series.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={s.width ?? 1.6} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        {m.series.length > 1 ? (
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            {m.series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>

      <CustomRangeDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        range={range}
        onApply={(next) => { onRangeChange(next); setCustomOpen(false) }}
      />
    </Card>
  )
}

/** 自定义时间范围弹窗（每模块独立打开；默认回填当前范围） */
function CustomRangeDialog({ open, onClose, range, onApply }) {
  const [draft, setDraft] = useState({ start: toLocalInput(range.start), end: toLocalInput(range.end) })
  useEffect(() => {
    if (open) setDraft({ start: toLocalInput(range.start), end: toLocalInput(range.end) })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => {
    const s = fromLocalInput(draft.start)
    const e = fromLocalInput(draft.end)
    if (!s || !e || s >= e) return
    onApply({ start: s, end: e })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[min(92vw,400px)]">
        <DialogHeader>
          <DialogTitle>自定义时间范围</DialogTitle>
          <DialogDescription>选择起止时间（精确到分钟），查询该区间的监控数据。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cr-start">开始时间</Label>
            <DateTimePicker id="cr-start" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="cr-end">结束时间</Label>
            <DateTimePicker id="cr-end" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={apply}>查询</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
