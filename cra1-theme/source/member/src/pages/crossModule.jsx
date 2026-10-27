import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Package, SearchX } from 'lucide-react'
import { PageHeader, Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input, Select } from '../ui/input'
import { Badge, Alert, EmptyState } from '../ui/feedback'
import { DataTable } from '../ui/data-table'
import { get, formatDate, formatMoney } from '../lib'

/**
 * 跨模块产品列表（crossModule.htm?m=菜单ID）
 *
 * 与 product.htm?m= 的区别：
 *   product.htm?m=      单模块，列表 HTML 由该模块后端渲染（第三方边界，不可重写）
 *   crossModule.htm?m=  多模块混合，列表由系统接口 /console/v1/home/host 返回
 *                       结构化 JSON，列由菜单的 select_field 决定，可在本主题实现
 *
 * 契约（读自 HostController::homeHostList）：
 *   GET /console/v1/home/host
 *     m            导航ID
 *     tab          using|expiring|overdue|deleted
 *     status       产品状态（Unpaid/Pending/Active/Suspended/Deleted）
 *     keywords     商品名称/产品名称/IP
 *     country_id / city / area   数据中心筛选
 *     page / limit / orderby(id,due_time,status) / sort
 *   返回 list[]（含 country/city/area、dedicate_ip、assign_ip、power_status、
 *   image_name、base_info、self_defined_field）以及各状态计数与 data_center[]。
 */

const HOST_STATUS = {
  Unpaid: { label: '未付款', tone: 'warning' },
  Pending: { label: '开通中', tone: 'default' },
  Active: { label: '已开通', tone: 'success' },
  Suspended: { label: '已暂停', tone: 'danger' },
  Deleted: { label: '已删除', tone: 'muted' },
  Failed: { label: '开通失败', tone: 'danger' },
}

const POWER_STATUS = {
  on: { label: '开机', tone: 'success' },
  off: { label: '关机', tone: 'muted' },
  operating: { label: '操作中', tone: 'warning' },
  fault: { label: '故障', tone: 'danger' },
}

const TABS = [
  { value: 'using', label: '使用中' },
  { value: 'expiring', label: '即将到期' },
  { value: 'overdue', label: '已逾期' },
  { value: 'deleted', label: '已删除' },
]

const STATUS_OPTIONS = Object.entries(HOST_STATUS).map(([value, v]) => ({ value, label: v.label }))

export default function CrossModulePage() {
  const menuId = new URLSearchParams(location.search).get('m') || ''
  const [stats, setStats] = useState(null)          // 各状态计数（标量，值不变即不触发重渲染）
  // 数据中心与可选列只在首屏需要，且每次响应都是新数组。
  // 放进 state 再作为 useEffect 依赖会造成「响应 → 新数组 → 依赖变化 → 再请求」的死循环，
  // 因此用 ref 持有，只在派生渲染值时读取。
  const metaRef = useRef({ data_center: [], select_field: [] })
  const [, forceRender] = useState(0)
  const [menuName, setMenuName] = useState('')
  const [tab, setTab] = useState('using')
  const [status, setStatus] = useState('')
  const [keywords, setKeywords] = useState('')
  const [dcIdx, setDcIdx] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 10

  useEffect(() => {
    get('/menu')
      .then((res) => {
        const flat = []
        ;(res.data?.menu || []).forEach((m) => { flat.push(m); (m.child || []).forEach((c) => flat.push(c)) })
        const hit = flat.find((m) => String(m.id) === String(menuId))
        if (hit) setMenuName(hit.name)
      })
      .catch(() => {})
  }, [menuId])

  // 数据中心/可选列的首屏快照：只在第一次成功响应时写入
  const metaInit = useRef(false)
  const dcOptions = metaRef.current.data_center || []
  const selectField = metaRef.current.select_field || []
  const hasArea = selectField.includes('area') && dcOptions.length > 0

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const dc = metaRef.current.data_center?.[dcIdx]
    const params = { page, limit, tab, keywords, status, m: menuId }
    if (dc) Object.assign(params, { country_id: dc.country_id, city: dc.city, area: dc.area })
    get('/home/host', params)
      .then((res) => {
        const d = res.data || {}
        setRows(d.list || [])
        setTotal(d.count || 0)
        setStats({
          all: d.all_count,
          using: d.using_count,
          expiring: d.expiring_count,
          overdue: d.overdue_count,
        })
        if (!metaInit.current) {
          metaInit.current = true
          metaRef.current = {
            data_center: d.data_center || [],
            select_field: d.select_field || [],
          }
          forceRender((n) => n + 1)   // 让筛选器与动态列按真实字段重渲染一次
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, limit, tab, keywords, status, menuId, dcIdx, hasArea])

  useEffect(load, [load])
  useEffect(() => { setPage(1) }, [tab, keywords, status, dcIdx])

  const columns = [
    { key: 'id', title: 'ID', width: 80,
      render: (h) => (
        <a href={`/productdetail.htm?id=${h.id}`} className="font-mono text-xs text-brand hover:underline">{h.id}</a>
      ) },
    ...(hasArea ? [{
      key: 'data_center', title: '区域', width: 200,
      render: (h) => (
        <div className="min-w-0">
          <div className="truncate text-[13px]">{h.country || '—'}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {[h.city, h.area].filter(Boolean).join(' / ') || '—'}
          </div>
        </div>
      ),
    }] : []),
    { key: 'product_name', title: '产品',
      render: (h) => (
        <div className="min-w-0">
          <a href={`/productdetail.htm?id=${h.id}`} className="truncate font-medium text-brand hover:underline">
            {h.product_name || '—'}
          </a>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{h.base_info || h.name || '—'}</div>
        </div>
      ) },
    ...(selectField.includes('ip') ? [{
      key: 'ip', title: 'IP', width: 160,
      render: (h) => (
        <div className="min-w-0 font-mono text-xs">
          <div className="truncate">{h.dedicate_ip || '—'}</div>
          {h.assign_ip && <div className="truncate text-muted-foreground">{h.assign_ip}</div>}
        </div>
      ),
    }] : []),
    { key: 'status', title: '状态', width: 100,
      render: (h) => {
        const st = HOST_STATUS[h.status] || { label: h.status, tone: 'muted' }
        return <Badge tone={st.tone}>{st.label}</Badge>
      } },
    ...(selectField.includes('power_status') ? [{
      key: 'power_status', title: '电源', width: 90,
      render: (h) => {
        if (!h.power_status) return <span className="text-muted-foreground">—</span>
        const ps = POWER_STATUS[h.power_status] || { label: h.power_status, tone: 'muted' }
        return <Badge tone={ps.tone}>{ps.label}</Badge>
      },
    }] : []),
    { key: 'due_time', title: '到期时间', width: 120,
      render: (h) => <span className="text-muted-foreground">{formatDate(h.due_time)}</span> },
    { key: 'renew_amount', title: '续费金额', width: 120, align: 'right',
      render: (h) => (
        <span className="font-medium tabular-nums">
          {h.renew_forbidden ? <span className="text-xs text-muted-foreground">不可续费</span> : formatMoney(h.renew_amount)}
        </span>
      ) },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={menuName || '产品列表'}
        description="跨模块汇总，同一视图内查看不同模块的产品"
        actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" />刷新</Button>}
      />

      <Card>
        <CardContent className="p-5">
          {/* 状态分页用徽标而非 Tabs，与下方筛选器同处一行，减少视觉层级 */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                aria-pressed={tab === t.value}
                className={
                  'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ' +
                  (tab === t.value
                    ? 'bg-brand text-white'
                    : 'bg-muted-bg text-muted-foreground hover:bg-line/60 hover:text-ink')
                }
              >
                {t.label}
                {stats?.[t.value] != null && (
                  <span className="ml-1.5 tabular-nums opacity-70">{stats[t.value]}</span>
                )}
              </button>
            ))}
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            error={error}
            search={keywords}
            onSearchChange={setKeywords}
            searchPlaceholder="商品名称 / 产品名称 / IP"
            filters={
              <>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}
                        className="h-9 w-[130px] text-[13px]" aria-label="产品状态">
                  <option value="">全部状态</option>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                {hasArea && (
                  <Select value={dcIdx} onChange={(e) => setDcIdx(e.target.value)}
                          className="h-9 w-[170px] text-[13px]" aria-label="数据中心">
                    <option value="">全部数据中心</option>
                    {dcOptions.map((dc, i) => (
                      <option key={`${dc.country_id}-${dc.city}-${dc.area}-${i}`} value={i}>
                        {[dc.country_name, dc.city, dc.area].filter(Boolean).join('-')}
                      </option>
                    ))}
                  </Select>
                )}
              </>
            }
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            empty={
              <EmptyState
                icon={SearchX}
                title="没有符合条件的产品"
                description={keywords || status ? '换个关键字或状态试试。' : '这个分类下还没有产品。'}
              />
            }
          />
        </CardContent>
      </Card>

      {!menuId && (
        <Alert tone="info">
          当前未带导航参数（?m=），显示的是全部模块的产品。从侧边栏分类进入可只看该分类。
        </Alert>
      )}
    </div>
  )
}
