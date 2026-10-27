import { Guard, useAccess } from '../ui/access'
import {sharedReady} from '../shared'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Trash2, Eye, Receipt, RefreshCw, ArrowUpRight, Plus, Wallet, Clock,
} from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Select } from '../ui/input'
import { Badge, Alert, EmptyState } from '../ui/feedback'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { usePageTab } from './usePageTab'
import { ConfirmDialog } from '../ui/dialog'
import { DataTable } from '../ui/data-table'
import { useToast } from '../ui/toast'
import { cn } from '../ui/utils'
import { get, del, formatDateTime, formatMoney, featureFlags, commonData, creditTypeText, ORDER_TYPE, orderTypeText } from '../lib'

/**
 * 财务中心（shadcn dashboard 布局）
 * 结构 = 费用概览指标条 + 单记录卡（卡内 tabs：订单 / 余额 / 冻结）
 * 接口见 app/home/controller/OrderController.php
 */

const ORDER_STATUS = {
  Unpaid: { label: '未付款', tone: 'warning' },
  Paid: { label: '已付款', tone: 'success' },
  WaitUpload: { label: '待上传凭证', tone: 'warning' },
  WaitReview: { label: '待审核', tone: 'default' },
  ReviewFail: { label: '审核失败', tone: 'danger' },
  Cancelled: { label: '已取消', tone: 'muted' },
  Refunded: { label: '已退款', tone: 'muted' },
}

/* 订单类型映射来自 lib.js（ORDER_TYPE + orderTypeText，值域含 recharge/combine
   等——官方 default 主题文案）；此前本地表缺 recharge，订单列表会裸露英文 */

// 同 account：标签需可被侧边栏三级导航直接链接（/finance.htm?tab=freeze）
const FINANCE_TABS = ['orders', 'credit', 'freeze', 'transactions']

export default function FinancePage() {
  const { can } = useAccess()
  const tabRules = {orders:'Order::list',credit:'Account::creditList',transactions:'Transaction::list'}
  const [tab, setTab] = usePageTab('orders', FINANCE_TABS.filter(t => !tabRules[t] || can(tabRules[t])))
  const [stats, setStats] = useState(null)
  const [frozen, setFrozen] = useState(null)     // null = 未确认；读取失败不能当作零元
  // 财务功能特征位：提现规则关闭 → 隐藏「申请提现」；充值开关关闭 → 隐藏充值
  const [feat, setFeat] = useState(() => featureFlags())

  useEffect(() => {
    const sync = () => setFeat({ ...featureFlags() })
    window.addEventListener('cra1:feature-flags', sync)
    sync()
    return () => window.removeEventListener('cra1:feature-flags', sync)
  }, [])

  useEffect(() => {
    // 费用概览指标：账户汇总；接口失败不阻断页面（指标显示 —）
    get('/index')
      .then((res) => {
        const acc = res.data?.account || {}
        setStats((s) => ({
          ...(s || {}),
          credit: acc.credit, consume: acc.consume, totalConsume: acc.consume,
          unpaid: acc.unpaid_order,
          thisMonth: acc.this_month_consume,
        }))
      })
      .catch(() => {})
  }, [])

  const currency = commonData().currency_prefix || ''
  const thisMonth = stats?.thisMonth ?? '—'

  return (
    <div className="space-y-4">
      {/* 页标题（紧凑式，与概览条一体） */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">财务中心</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">管理订单、余额与消费记录</p>
      </div>

      {/* 费用概览指标条（华为云式：一张卡横向多段指标，充值/提现并入余额段） */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-y-4 p-5">
          {/* 余额段（主指标 + 充值/提现操作） */}
          <div className="flex min-w-[220px] flex-1 items-center gap-5">
            <div>
              <p className="text-[13px] text-muted-foreground">账户余额</p>
              <p className="mt-1 text-[26px] font-semibold tabular-nums leading-8 tracking-tight text-ink">
                {stats ? formatMoney(stats.credit) : '—'}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {!!feat.recharge_open && <RechargeButton />}
              {!!feat.withdraw_open && (
                <Button size="sm" variant="outline"
                        onClick={() => { window.location.href = '/withdrawal.htm' }}>
                  <ArrowUpRight className="size-3.5" />提现
                </Button>
              )}
            </div>
          </div>
          {/* 其余指标段 */}
          <div className="flex w-full flex-wrap items-center gap-x-8 gap-y-4 sm:w-auto sm:flex-1 sm:pl-8 sm:[&>div:not(:first-child)]:border-l sm:[&>div:not(:first-child)]:border-line sm:[&>div:not(:first-child)]:pl-8">
            <Metric label="本月消费" value={stats ? formatMoney(stats.thisMonth ?? 0) : '—'} />
            <Metric label="累计消费" value={stats ? formatMoney(stats.totalConsume ?? 0) : '—'} />
            <Metric label="待支付" value={stats ? String(stats.unpaid ?? '—') : '—'}
                    tone={Number(stats?.unpaid) > 0 ? 'danger' : 'ink'}
                    onClick={() => setTab('orders')} />
            <Metric label="冻结中" value={frozen === null ? '—' : formatMoney(frozen)}
                    onClick={() => setTab('freeze')} />
          </div>
        </CardContent>
      </Card>

      {/* 单记录卡：tab 头在卡内（页面层级更扁） */}
      <Card>
        <CardContent className="p-5">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger permission="Order::list" value="orders">我的订单</TabsTrigger>
              <TabsTrigger permission="Account::creditList" value="credit">余额记录</TabsTrigger>
              <TabsTrigger value="freeze">冻结记录</TabsTrigger>
              <TabsTrigger permission="Transaction::list" value="transactions">交易记录</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-4">
            {tab === 'orders' && <Guard permission="Order::list"><OrderPanel /></Guard>}
            {tab === 'credit' && <Guard permission="Account::creditList"><CreditPanel /></Guard>}
            {tab === 'freeze' && <FreezePanel onLoaded={setFrozen} />}
            {tab === 'transactions' && <Guard permission="Transaction::list"><TransactionPanel /></Guard>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* 指标段（概览条内的一段）：label + 值；可点击（切对应 tab） */
function Metric({ label, value, tone = 'ink', onClick }) {
  return (
    <div className="min-w-[96px]">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={cn(
        'mt-1 text-lg font-semibold tabular-nums tracking-tight',
        tone === 'danger' ? 'text-danger' : 'text-ink',
        onClick && 'cursor-pointer hover:text-brand'
      )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}>
        {value}
      </p>
    </div>
  )
}

/* 余额充值：专门页 /recharge.htm（后台 recharge_open 控制入口显隐，              */
/* 页面内渲染限额/实名/提示等全部后台限制）                                        */
/* -------------------------------------------------------------------------- */
function RechargeButton() {
  return (
    <Button permission="Pay::recharge" size="sm" onClick={() => { window.location.href = '/recharge.htm' }}>
      <Plus className="size-3.5" />充值
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/* 订单                                                                        */
/* -------------------------------------------------------------------------- */
/* 详情页跳转与原版主题同格式：orderDetail.htm?id={订单号}（订单号列、商品列、
   操作列查看按钮均可点）；?order_status= 参数兼容首页「待付订单」卡跳转 */
function goOrderDetail(id) {
  window.location.href = '/orderDetail.htm?id=' + id
}

function OrderPanel() {
  const {can}=useAccess()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [keywords, setKeywords] = useState('')
  // ?order_status=Unpaid（原版首页待付订单卡跳转格式）→ 初始化状态筛选
  const [status, setStatus] = useState(() => {
    const s = new URLSearchParams(location.search).get('order_status') || ''
    return ORDER_STATUS[s] ? s : ''
  })
  const [type, setType] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const limit = 10

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    get('/order', { page, limit, keywords, status, type })
      .then((res) => { setRows(res.data?.list || []); setTotal(res.data?.count || 0) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, keywords, status, type])

  // 筛选条件变化时回到第 1 页
  useEffect(() => { setPage(1) }, [keywords, status, type])
  useEffect(load, [load])

  async function remove(id) {
    try {
      await del(`/order/${id}`)
      toast('订单已删除', 'success')
      setConfirmDel(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const columns = [
    { key: 'id', title: '订单号', width: 100,
      render: (r) => (
        <button type="button" disabled={!can('Order::index')} onClick={() => goOrderDetail(r.id)}
                className="font-mono text-xs text-brand hover:underline">
          {r.id}
        </button>
      ) },
    { key: 'type', title: '类型', width: 80,
      render: (r) => orderTypeText(r.type) },
    { key: 'product', title: '商品',
      render: (r) => {
        const names = (r.product_names || []).slice(0, 2).join('、')
        const more = (r.product_names || []).length > 2 ? ` 等 ${r.product_names.length} 项` : ''
        return (
          <button type="button" disabled={!can('Order::index')} onClick={() => goOrderDetail(r.id)}
                  className="line-clamp-1 max-w-full text-left text-brand hover:underline">
            {names ? names + more : (r.description || '—')}
          </button>
        )
      } },
    { key: 'amount', title: '金额', width: 110, align: 'right',
      render: (r) => <span className="font-medium tabular-nums">{formatMoney(r.amount)}</span> },
    { key: 'status', title: '状态', width: 110,
      render: (r) => {
        const st = ORDER_STATUS[r.status] || { label: r.status, tone: 'muted' }
        return <Badge tone={st.tone}>{st.label}</Badge>
      } },
    { key: 'create_time', title: '创建时间', width: 150,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.create_time)}</span> },
    { key: 'actions', title: '操作', width: 130, align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {['Unpaid','WaitUpload','ReviewFail','WaitReview'].includes(r.status)&&<Button permission="Pay::pay" variant="ghost" size="sm" onClick={()=>sharedReady().then(shared=>shared.Payments.navigate({orderId:r.id,operation:'order'})).catch(e=>toast(e.message,'error'))}>{r.status==='Unpaid'?'付款':'进度'}</Button>}
          <Button permission="Order::index" variant="ghost" size="sm" onClick={() => goOrderDetail(r.id)} aria-label="查看详情">
            <Eye className="size-3.5" />
          </Button>
          <Button permission="Order::delete" variant="ghost" size="sm" className="text-danger hover:bg-danger/8"
                  onClick={() => setConfirmDel(r)} aria-label="删除订单">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        search={keywords}
        onSearchChange={setKeywords}
        searchPlaceholder="搜索订单号"
        filters={
          <>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="h-9 w-[130px] text-[13px]" aria-label="订单状态">
              <option value="">全部状态</option>
              {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)}
                    className="h-9 w-[130px] text-[13px]" aria-label="订单类型">
              <option value="">全部类型</option>
              {Object.entries(ORDER_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </>
        }
        actions={<Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" />刷新</Button>}
        page={page}
        total={total}
        limit={limit}
        onPageChange={setPage}
        empty={
          <EmptyState
            icon={Receipt}
            title="暂无订单"
            description="新购、续费与升降级的订单会显示在这里"
            action={<Button size="sm" onClick={() => { window.location.href = '/cart/goodsList.htm' }}>浏览产品</Button>}
          />
        }
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="删除订单"
        description={confirmDel ? `确认删除订单 ${confirmDel.id}？删除后不可恢复。` : ''}
        confirmText="删除"
        tone="danger"
        onConfirm={() => remove(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* 余额 / 冻结                                                                  */
/* -------------------------------------------------------------------------- */
function CreditPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  useEffect(() => {
    setLoading(true)
    get('/credit', { page, limit })
      .then((res) => { setRows(res.data?.list || []); setTotal(res.data?.count || 0) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page])

  const columns = [
    { key: 'create_time', title: '时间', width: 150,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.create_time)}</span> },
    { key: 'type', title: '类型', width: 110, render: (r) => creditTypeText(r.type) },
    { key: 'amount', title: '金额', width: 120, align: 'right',
      render: (r) => (
        <span className={Number(r.amount) >= 0 ? 'font-medium text-[#00B42A]' : 'font-medium text-danger'}>
          {Number(r.amount) >= 0 ? '+' : ''}{formatMoney(r.amount)}
        </span>
      ) },
    { key: 'credit', title: '余额', width: 120, align: 'right',
      render: (r) => <span className="tabular-nums">{formatMoney(r.credit)}</span> },
    // 余额记录实际字段为 notes（不是 description），且响应无 balance
    { key: 'notes', title: '说明',
      render: (r) => <span className="text-muted-foreground">{r.notes || r.description || '—'}</span> },
  ]

  return (
    <Card>
      <CardContent className="p-5">
        <DataTable columns={columns} rows={rows} loading={loading} error={error}
                   page={page} total={total} limit={limit} onPageChange={setPage}
                   empty={
                     <EmptyState
                       icon={Wallet}
                       title="暂无余额记录"
                       description="充值、支付与退款产生的余额流水会显示在这里"
                       action={<Button size="sm" onClick={() => { window.location.href = '/cart/goodsList.htm' }}>浏览产品</Button>}
                     />
                   } />
      </CardContent>
    </Card>
  )
}

function FreezePanel({ onLoaded }) {
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const limit = 20

  // 后端 freezeList 无分页（全量返回），前端切片分页
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    get('/account/credit/freeze')
      .then((res) => {
        if (!alive) return
        const list = res.data?.list || []
        setRows(list)
        onLoaded(list.reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0).toFixed(2))
      })
      .catch((e) => { if (alive) { setError(e.message); onLoaded(null) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [attempt, onLoaded])

  const columns = [
    { key: 'create_time', title: '时间', width: 150,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.create_time)}</span> },
    { key: 'amount', title: '金额', width: 120, align: 'right',
      render: (r) => <span className="font-medium tabular-nums">{formatMoney(r.amount)}</span> },
    // 接口字段为 client_notes（冻结流水备注），响应无 description
    { key: 'client_notes', title: '说明',
      render: (r) => <span className="text-muted-foreground">{r.client_notes || r.notes || r.description || '—'}</span> },
  ]

  return (
    <Card>
      <CardContent className="p-5">
        <DataTable columns={columns} rows={rows.slice((page - 1) * limit, page * limit)}
                   loading={loading} error={error} onRetry={() => setAttempt(n => n + 1)}
                   page={page} total={rows.length} limit={limit} onPageChange={setPage}
                   empty={
                     <EmptyState
                       icon={Clock}
                       title="暂无冻结记录"
                       description="订单支付中临时冻结的金额会显示在这里"
                     />
                   } />
      </CardContent>
    </Card>
  )
}

function TransactionPanel(){
 const {can}=useAccess()
 const [rows,setRows]=useState([]),[total,setTotal]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('')
 useEffect(()=>{let alive=true;setLoading(true);setError('');get('/transaction',{page,limit:10}).then(r=>{if(alive){setRows(r.data?.list||[]);setTotal(r.data?.count||0)}}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[page])
 const columns=[{key:'create_time',title:'时间',render:r=>formatDateTime(r.create_time)},{key:'transaction_number',title:'交易流水号'},{key:'order_id',title:'订单',render:r=>can('Order::index')?<a href={`/orderDetail.htm?id=${r.order_id}`}>{r.order_id}</a>:r.order_id},{key:'type',title:'类型',render:r=>orderTypeText(r.type)},{key:'gateway',title:'支付方式'},{key:'amount',title:'金额',render:r=>formatMoney(r.amount)}]
 return <DataTable columns={columns} rows={rows} total={total} page={page} limit={10} loading={loading} error={error} onPageChange={setPage}/>
}
