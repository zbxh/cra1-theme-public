import {useAccess,Guard} from '../ui/access'
import {pluginLink} from '../lib'
import { iconStyleVars } from '../lib/icon-style'
import { articleSource, articleSourceInfo, articleRequest, articleRows } from '../lib/article-timeline'
import { useState, useEffect, useRef, useId } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  Server, Wallet, CalendarClock, Plus, ArrowUpRight,
  LifeBuoy, Newspaper, ArrowRight, Package, Ticket, Users,
  Shield, ShoppingCart, FileText, CreditCard, Lock, Clock, Gift, Headphones,
  CheckCircle2, RefreshCw, Check, LayoutGrid, History, Trash2, ChevronDown, X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Alert, EmptyState, Skeleton } from '../ui/feedback'
import { get, formatDate, memberContentConfig, featureFlags } from '../lib'
import { cn } from '../ui/utils'
import { DueCell } from '../components/due-cell'
import { homeProductCategories, loadHomeProducts } from '../lib/home-products'
import { memberProductCategories } from '../lib/member-navigation'

/* 财务类快捷入口受特征位约束：提现规则关闭时剔除 withdrawal 链接（全站口径
   一致，见 lib.js featureFlags） */
function filterFinanceLinks(items, feat) {
  if (feat && feat.ready && !feat.withdraw_open) {
    return items.filter((x) => !/withdrawal\.htm/i.test(x.url || ''))
  }
  return items
}

/* 等 featureFlags 两个探测请求落地（window.__CRA1_FEAT__.ready=true） */
function featureFlagsReady() {
  return new Promise((resolve) => {
    const flag = featureFlags()
    if (flag.ready) return resolve(flag)
    window.addEventListener('cra1:feature-flags', function fn() {
      window.removeEventListener('cra1:feature-flags', fn)
      resolve(flag)
    })
  })
}

/**
 * 快捷入口图标映射：icon 键来自后台白名单（member_store.php allowedIcons），
 * 前台不认识时回落 package —— 不可控字符串永远不下发到 className。
 */
const QUICK_ICONS = {
  wallet: Wallet,
  package: Package,
  'arrow-up-right': ArrowUpRight,
  'life-buoy': LifeBuoy,
  users: Users,
  shield: Shield,
  newspaper: Newspaper,
  'shopping-cart': ShoppingCart,
  'file-text': FileText,
  server: Server,
  'credit-card': CreditCard,
  lock: Lock,
  clock: Clock,
  gift: Gift,
  headphones: Headphones,
}

/**
 * 会员中心首页（/home.htm）
 *
 * 契约（读自 IndexController / HostController）：
 *   GET /console/v1/index                 账户概览
 *        account.{username,email,phone,credit,host_num,host_active_num,
 *                 unpaid_order,consume,this_month_consume,
 *                 this_month_consume_percent,expiring_count}
 *   GET /console/v1/home/host             产品列表（按导航关联商品分类，完整分页）
 *        list[].{id,product_name,name,due_time,status,client_notes,module,dedicate_ip}
 *   会员导航公开快照 /menu                 分类名称、顺序及关联商品
 *   GET /console/v1/index/host            待续费产品
 *   GET /console/v1/ticket?limit=         工单（插件 idcsmart_ticket）
 *        list[].{id,ticket_num,title,name,status,color,last_reply_time}
 *   GET /console/v1/news/index?limit=     公告/新闻（插件 idcsmart_news）
 *        list[].{id,title,type,create_time}
 *
 * 插件类接口（ticket / news）在插件未启用时会返回整页 HTML 导致 JSON 解析失败，
 * 因此各自独立 try/catch，任一失败不影响其余区块。
 */

const HOST_STATUS = {
  Unpaid: { label: '未付款', tone: 'warning' },
  Pending: { label: '开通中', tone: 'default' },
  Active: { label: '已开通', tone: 'success' },
  Suspended: { label: '已暂停', tone: 'danger' },
  Deleted: { label: '已删除', tone: 'muted' },
}

export default function HomePage() {
  const [account, setAccount] = useState(null)
  const [quickLinks, setQuickLinks] = useState(null)   // null = 未加载；[] = 无可用入口
  const [homeTodo, setHomeTodo] = useState(null)       // 后台「待办事项」配置
  const [homeBanner, setHomeBanner] = useState(null)   // 后台「推荐位」配置
  const [homeNews, setHomeNews] = useState(null)       // 后台「公告时间轴」配置
  const [homeSecurity, setHomeSecurity] = useState(null) // 后台「安全概览」配置
  const [error, setError] = useState('')
  const [accountAttempt, setAccountAttempt] = useState(0)

  // 首页内容模块（快捷入口/待办/推荐位）；快照晚于首屏到达时监听刷新。
  // 财务类入口受特征位约束：提现规则关闭时隐藏「申请提现」等 withdrawal 链接
  useEffect(() => {
    let alive = true
    Promise.all([memberContentConfig(), featureFlagsReady()]).then(([c, feat]) => {
      if (!alive) return
      const ql = c?.home_quick_links
      const items = ql && Number(ql.enabled) === 1
        ? (ql.items || []).filter((x) => Number(x.enabled) === 1 && x.url)
        : []
      setQuickLinks(filterFinanceLinks(items, feat))
      setHomeTodo(c?.home_todo || null)
      setHomeBanner(c?.home_banner || null)
      setHomeNews(c?.home_news || null)
      setHomeSecurity(c?.home_security || null)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    setError('')
    get('/index')
      .then((res) => { if (alive) setAccount(res.data?.account || null) })
      .catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [accountAttempt])

  return (
    <div className="space-y-4">
      <HomeQuickbar />

      {error && <Alert tone="error">账户信息暂时无法读取。<Button size="sm" variant="outline" className="ml-3" onClick={() => setAccountAttempt(n => n + 1)}>重新加载</Button></Alert>}

      {/* 推荐位（阿里云营销位式图文卡）：后台 home_banner 配置 */}
      <BannerRow cfg={homeBanner} />

      {/* 第二行：待办事项 2/3 + 常用功能 1/3 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <TodoSection cfg={homeTodo} account={account} />
        </div>
        <div className="min-w-0 lg:col-span-1">
          {quickLinks && quickLinks.length > 0 ? <QuickLinks items={quickLinks} /> : null}
        </div>
      </div>

      {/* 我的产品（分类 tab + 产品卡片网格） */}
      <HostSection />

      {/* 底部三栏：公告时间轴 | 我的工单 | 账户安全概览 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <NewsSection cfg={homeNews} />
        <Guard permission="addon\\idcsmart_ticket\\controller\\clientarea\\TicketController::ticketList"><TicketSection /></Guard>
        <SecurityOverview cfg={homeSecurity} account={account} />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 最近访问：沿用会员分桶记录；空记录时隐藏左侧内容，保留右侧快捷操作             */
/* -------------------------------------------------------------------------- */

function recentIcon(url) {
  url = url.split('?')[0]
  if (/^cart\//i.test(url)) return ShoppingCart
  if (/ticket/i.test(url)) return Ticket
  if (/product|module\//i.test(url)) return Server
  if (/finance|order|recharge|withdrawal/i.test(url)) return Wallet
  if (/news|announce/i.test(url)) return Newspaper
  if (/help|document/i.test(url)) return FileText
  if (/security|authentication|certification/i.test(url)) return Shield
  if (/account/i.test(url)) return Users
  return History
}

function visitTime(ts) {
  const diff = Math.max(0, Date.now() - ts)
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  const days = Math.floor(diff / 86400000)
  return days >= 7 ? `${Math.floor(days / 7)} 周前` : `${days} 天前`
}

function HomeQuickbar() {
  const [recent, setRecent] = useState(() => window.__CRA1_RECENT_VISITS__ || null)
  const financeButton = useRef(null)
  useEffect(() => {
    const update = (event) => setRecent(event.detail || null)
    window.addEventListener('cra1:recent-visits', update)
    // Vue 外壳可能在 React 挂载之前完成请求，也可能在之后广播。
    setRecent(window.__CRA1_RECENT_VISITS__ || null)
    return () => window.removeEventListener('cra1:recent-visits', update)
  }, [])

  const available = recent?.ready && recent.enabled && recent.items?.length > 0
  const clear = () => {
    window.dispatchEvent(new CustomEvent('cra1:recent-visits-clear'))
    financeButton.current?.focus()
  }
  const buttonClass = 'cui-button--tile min-w-0 w-full flex-col gap-1 px-1 text-xs md:h-8 md:w-auto md:flex-row md:gap-2 md:px-3 md:text-[13px]'
  return (
    <div className="grid grid-cols-4 items-center gap-2 md:flex md:flex-wrap md:justify-between md:gap-3" data-home-quickbar>
      {available && <RecentVisits recent={recent} onClear={clear} />}
      <div className={cn('grid min-w-0 grid-cols-3 gap-2 md:ml-auto md:flex md:shrink-0', available ? 'col-span-3' : 'col-span-4')} data-home-actions>
        <Button ref={financeButton} variant="outline" size="sm" className={buttonClass} onClick={() => { window.location.href = '/finance.htm' }}>
          <Wallet className="size-3.5" aria-hidden="true" />财务中心
        </Button>
        <Button permission="addon\\idcsmart_ticket\\controller\\clientarea\\TicketController::create" hidden={!pluginLink('ticket')} variant="outline" size="sm" className={buttonClass} onClick={() => { window.location.href = pluginLink('ticket','addTicket.htm') }}>
          <LifeBuoy className="size-3.5" aria-hidden="true" />提交工单
        </Button>
        <Button permission="Product::settle" size="sm" className={buttonClass} onClick={() => { window.location.href = '/cart/goodsList.htm' }}>
          <Package className="size-3.5" aria-hidden="true" />浏览产品
        </Button>
      </div>
    </div>
  )
}

function RecentVisitLink({ item, newTab, card = false, onVisit, linkRef }) {
  const Icon = recentIcon(item.url)
  return (
    <a
      ref={linkRef} key={item.url} href={'/' + item.url}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      title={`${item.name} · ${visitTime(item.ts)}`}
      onClick={onVisit}
      className={cn(
        'items-center rounded-md border border-line text-[13px] text-body transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        card ? 'flex min-cui-button--tile w-full gap-3 bg-surface-alt px-3 py-2' : 'inline-flex min-h-9 shrink-0 gap-2 bg-surface px-3'
      )}
      data-recent-card={card ? '' : undefined}
    >
      <Icon className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
      <span className={card ? 'min-w-0 flex-1 break-words leading-5' : 'max-w-48 truncate'} data-recent-name>{item.name}</span>
      <time className="ml-1 shrink-0 whitespace-nowrap text-[11px] font-normal text-muted-foreground" dateTime={new Date(item.ts).toISOString()} data-recent-time>
        {visitTime(item.ts)}
      </time>
    </a>
  )
}

function RecentVisits({ recent, onClear }) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [open, setOpen] = useState(false)
  const clearing = useRef(false)
  const firstLink = useRef(null)
  const titleId = useId()
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const change = () => { setMobile(query.matches); setOpen(false) }
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  const title = recent.title || '最近访问'
  const clear = () => { clearing.current = true; onClear() }

  if (mobile) return (
    <div className="min-w-0" data-home-recent>
      <Popover.Root open={open} onOpenChange={(value) => { if (value) clearing.current = false; setOpen(value) }}>
        <Popover.Trigger asChild>
          <Button variant="outline" size="sm" className="cui-button--tile w-full min-w-0 flex-col gap-1 px-1 text-xs" aria-label={title} data-recent-trigger>
            <span className="flex items-center gap-1" aria-hidden="true">
              <History className="size-3.5 text-brand" />
              <ChevronDown className={cn('size-3 text-muted-foreground', open && 'rotate-180')} />
            </span>
            <span className="max-w-full truncate">{title}</span>
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom" align="start" sideOffset={8} collisionPadding={16}
            aria-labelledby={titleId} data-recent-dialog
            className="cui-popover z-[120] flex w-[calc(100vw-32px)] max-w-[420px] max-h-[min(65dvh,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-3 font-sans text-[13px] data-[state=closed]:hidden"
            onOpenAutoFocus={(event) => { event.preventDefault(); firstLink.current?.focus({ preventScroll: true }) }}
            onCloseAutoFocus={(event) => { if (clearing.current) event.preventDefault() }}
          >
            <div className="mb-2 flex shrink-0 items-center gap-2">
              <h2 id={titleId} className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{title}</h2>
              <Button variant="ghost" size="sm" className="h-11 px-2" aria-label="清空最近访问" onClick={clear}>
                <Trash2 className="size-3.5" aria-hidden="true" />清空
              </Button>
              <Popover.Close asChild>
                <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="关闭最近访问">
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </Popover.Close>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-1" data-recent-links>
              <div className="grid gap-2">
                {recent.items.map((item, index) => (
                  <RecentVisitLink key={item.url} item={item} newTab={recent.newTab} card linkRef={index === 0 ? firstLink : undefined} onVisit={() => setOpen(false)} />
                ))}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )

  return (
    <section className="min-w-0 flex-1 basis-full lg:basis-0" aria-labelledby="home-recent-title" data-home-recent>
      <div className="mb-1.5 flex items-center gap-3">
        <h2 id="home-recent-title" className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-ink">
          <History className="size-4 shrink-0 text-brand" aria-hidden="true" />
          <span className="truncate">{title}</span>
        </h2>
        <Button
          variant="ghost" size="sm" className="h-9 shrink-0 max-sm:h-11"
          aria-label="清空最近访问"
          onClick={clear}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />清空
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 pb-1" data-recent-links>
        {recent.items.map((item) => <RecentVisitLink key={item.url} item={item} newTab={recent.newTab} />)}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* 到期续费待办（后台 home_todo 配置；数据 /index/host）                          */
/* -------------------------------------------------------------------------- */

function TodoSection({ cfg, account }) {
  const {can}=useAccess()
  const ticketAvailable=!!window.__CRA1_RUNTIME__?.features?.ticket && can("addon\\idcsmart_ticket\\controller\\clientarea\\TicketController::ticketList")
  const orderAvailable=can("Order::list")
  const mailAvailable=!!window.__CRA1_RUNTIME__?.features?.client_care
  const [hosts, setHosts] = useState(null)
  const [tickets, setTickets] = useState(null)
  const [orders, setOrders] = useState(null)
  const [mails, setMails] = useState(null)     // null = 插件不可用
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('renew')      // renew | ticket | order | mail
  const [failed, setFailed] = useState({})
  const [attempt, setAttempt] = useState(0)

  const enabled = cfg && Number(cfg.enabled) === 1
  const days = Math.max(7, Math.min(90, Number(cfg?.days) || 30))
  const maxRows = Math.max(3, Math.min(10, Number(cfg?.limit) || 5))
  const title = (cfg?.title || '待办事项').slice(0, 20)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let alive = true
    setLoading(true)
    setFailed({})
    const tasks=[]
    const failure = key => { if (alive) setFailed(value => ({ ...value, [key]:true })) }
    tasks.push(get('/index/host',{page:1,limit:100}).then(r=>{if(alive)setHosts(r.data?.list || [])}).catch(()=>failure('renew')))
    if(ticketAvailable)tasks.push(get('/ticket',{page:1,limit:50,'status[]':3}).then(r=>{if(alive)setTickets(r.data?.list || [])}).catch(()=>failure('ticket')))
    if(orderAvailable)tasks.push(get('/order',{page:1,limit:50,status:'Unpaid'}).then(r=>{if(alive)setOrders(r.data?.list || [])}).catch(()=>failure('order')))
    if(mailAvailable)tasks.push(get('/client_care/mail',{page:1,limit:50}).then(r=>{if(alive)setMails((r.data?.list || []).filter(m=>Number(m.is_read)!==1))}).catch(()=>failure('mail')))
    Promise.allSettled(tasks).then(()=>{if(alive)setLoading(false)})
    return () => { alive = false }
  }, [enabled, ticketAvailable, orderAvailable, mailAvailable, attempt])

  const now = Date.now()
  const windowMs = days * 86400000
  const renewList = (hosts || [])
    .filter((h) => h.status === 'Active' && h.due_time > 0 && h.due_time * 1000 - now <= windowMs)
    .sort((a, b) => a.due_time - b.due_time)
  const ticketList = tickets || []
  const orderList = orders || []
  const mailList = mails || []

  if (!enabled || loading) return null

  const cats = [
    { key: 'renew', label: '待续费产品', n: renewList.length },
    ...(ticketAvailable ? [{ key:'ticket',label:'待回复工单',n:ticketList.length }] : []),
    ...(orderAvailable ? [{ key:'order',label:'待支付订单',n:orderList.length }] : []),
    ...(mailAvailable ? [{ key: 'mail', label: '待读站内信', n: mailList.length }] : []),
  ].map(c => ({...c, n:failed[c.key] ? '—' : c.n}))
  const cur = cats.find((c) => c.key === cat)
  const curN = cur ? cur.n : 0

  /* 横向滑动容器：超宽卡片不换行，改为 overflow-x 滑动 */
  return (
    <Card glow>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-warning" aria-hidden="true" />{title}
            </CardTitle>
            <CardDescription>需要你处理的事项：待续费产品、待回复工单、待支付订单、待读站内信</CardDescription>
          </div>
        </div>
        {/* 分类 tab（含数量徽标） */}
        <div className="mt-1 flex flex-wrap gap-1.5" role="tablist" aria-label="待办分类">
          {cats.map((c) => (
            <button key={c.key} type="button" role="tab" aria-selected={cat === c.key}
                    onClick={() => setCat(c.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150',
                      cat === c.key ? 'border-brand bg-brand/5 text-brand' : 'border-line bg-surface text-body hover:border-brand/40'
                    )}>
              {c.label}
              <span className={cn('rounded-full px-1.5 text-[11px] font-semibold',
                c.n > 0 ? (cat === c.key ? 'bg-brand text-white' : c.key === 'renew' ? 'bg-warning/15 text-warning' : 'bg-brand/10 text-brand') : 'bg-muted-bg text-muted-foreground')}>
                {c.n}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {failed[cat] ? <ReadFailure onRetry={() => setAttempt(n => n + 1)} /> : curN === 0 ? (
          <TodoEmpty
            ok={cats.some((c) => c.key !== cat && c.n > 0)}
            text={`当前分类没有待办事项`}
            tip={cats.some((c) => c.key !== cat && c.n > 0) ? '其他分类有待处理事项，可切换查看' : ''}
            onSwitch={(() => {
              const other = cats.find((c) => c.key !== cat && c.n > 0)
              return other ? () => setCat(other.key) : null
            })()}
          />
        ) : cat === 'renew' ? (
          /* 横向滑动：卡片超宽时不换行，滚动查看（scrollbar 弱化） */
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] [&>*]:shrink-0" role="list" aria-label="待续费产品">
            {renewList.slice(0, maxRows).map((h) => {
              const remain = Math.ceil((h.due_time * 1000 - now) / 86400000)
              const urgent = remain <= 7
              return (
                <div key={h.id} className="cui-card flex w-[240px] flex-col gap-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <a href={`/productdetail.htm?id=${h.id}`}
                       className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink hover:text-brand hover:underline"
                       title={h.product_name || h.name}>
                      {h.product_name || h.name || `产品 #${h.id}`}
                    </a>
                    <span className={cn(
                      'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      urgent ? 'border-danger/20 bg-danger/8 text-danger' : 'border-warning/20 bg-warning/8 text-warning'
                    )}>
                      {remain <= 0 ? '已到期' : `剩 ${remain} 天`}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(h.due_time)} 到期{h.name ? ` · ${h.name}` : ''}
                  </p>
                  <Button size="sm" className="mt-auto w-full"
                          onClick={() => { window.location.href = `/productdetail.htm?id=${h.id}` }}>
                    去续费
                  </Button>
                </div>
              )
            })}
          </div>
        ) : cat === 'ticket' ? (
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] [&>*]:shrink-0" role="list" aria-label="待回复工单">
            {ticketList.slice(0, maxRows).map((t) => (
              <div key={t.id} className="cui-card flex w-[260px] flex-col gap-2 p-3.5">
                <a href={pluginLink('ticket','ticketDetails.htm',`id=${t.id}`)}
                   className="min-w-0 truncate text-[13px] font-medium text-ink hover:text-brand hover:underline"
                   title={t.title || `工单 #${t.id}`}>
                  {t.title || `工单 #${t.id}`}
                </a>
                <p className="truncate text-xs text-muted-foreground">
                  #{t.ticket_num}{t.name ? ` · ${t.name}` : ''}
                  {t.last_time > 0 && ` · 回复于 ${formatDate(t.last_time)}`}
                </p>
                <Button size="sm" variant="outline" className="mt-auto w-full"
                        onClick={() => { window.location.href = pluginLink('ticket','ticketDetails.htm',`id=${t.id}`) }}>
                  去查看并回复
                </Button>
              </div>
            ))}
          </div>
        ) : cat === 'order' ? (
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] [&>*]:shrink-0" role="list" aria-label="待支付订单">
            {orderList.slice(0, maxRows).map((o) => (
              <div key={o.id} className="cui-card flex w-[240px] flex-col gap-2 p-3.5">
                <a href={`/orderDetail.htm?id=${o.id}`}
                   className="min-w-0 truncate text-[13px] font-medium text-ink hover:text-brand hover:underline">
                  订单 #{o.id}
                </a>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(o.create_time)}{o.amount !== undefined && ` · 金额 ${(o.amount)}`}
                </p>
                <Button size="sm" className="mt-auto w-full"
                        onClick={() => { window.location.href = `/orderDetail.htm?id=${o.id}` }}>
                  去支付
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin] [&>*]:shrink-0" role="list" aria-label="待读站内信">
            {mailList.slice(0, maxRows).map((m, i) => (
              <div key={m.id || i} className="cui-card flex w-[260px] flex-col gap-2 p-3.5">
                <p className="min-w-0 truncate text-[13px] font-medium text-ink" title={m.subject || m.title || '站内信'}>
                  {m.subject || m.title || '站内信'}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.create_time ? formatDate(m.create_time) : ''}
                </p>
                <Button size="sm" variant="outline" className="mt-auto w-full"
                        onClick={() => { window.location.href = '/account.htm?type=3' }}>
                  去查看
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* 待办空态：分类为空时的引导（另一分类有内容时可一键切换） */
function TodoEmpty({ text, tip, onSwitch }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-surface-alt/40 px-4 py-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success/10 text-success" aria-hidden="true">
        <CheckCircle2 className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{text}</p>
        {tip && <p className="text-xs text-muted-foreground">{tip}</p>}
      </div>
      {onSwitch && (
        <Button size="sm" variant="outline" onClick={onSwitch}>
          去查看<ArrowRight className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

function ReadFailure({ onRetry, className }) {
  return <div role="status" className={cn('flex flex-wrap items-center justify-between gap-3 py-5 text-[13px] text-muted-foreground', className)}>
    <span>暂时无法读取内容，请稍后重试</span>
    <Button variant="outline" size="sm" onClick={onRetry}>重新加载</Button>
  </div>
}

/* -------------------------------------------------------------------------- */
/* 推荐位（后台 home_banner 配置；图文卡 ≤3）                                    */
/* -------------------------------------------------------------------------- */

const BANNER_GRADS = [
  'linear-gradient(120deg, var(--cui-titanium) 0%, var(--cui-graphite) 100%)',
  'linear-gradient(120deg, var(--cui-silver) 0%, var(--cui-graphite) 100%)',
  'linear-gradient(120deg, var(--cui-champagne) 0%, var(--cui-titanium) 100%)',
]

function BannerRow({ cfg }) {
  const enabled = cfg && Number(cfg.enabled) === 1
  const items = (cfg?.items || []).filter((x) => Number(x.enabled) === 1 && x.link)
  if (!enabled || items.length === 0) return null

  return (
    <div className={cn('grid gap-4', items.length === 1 ? 'grid-cols-1' : items.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3')}>
      {items.map((it, i) => (
        <a key={it.id || i} href={it.link}
           className="cui-card group relative flex min-h-[104px] items-center gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
           aria-label={it.title}>
          {it.image ? (
            <img src={it.image} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0" style={{ background: BANNER_GRADS[i % BANNER_GRADS.length] }} aria-hidden="true" />
          )}
          {/* 图上可读性压暗层（无图时透明） */}
          <span className="absolute inset-0 bg-black/0 transition-colors duration-150 group-hover:bg-black/10" aria-hidden="true" />
          <span className="relative z-10 min-w-0 flex-1 p-4">
            <span className="block truncate text-[15px] font-semibold text-white drop-shadow">
              {it.title}
            </span>
            {it.description && (
              <span className="mt-1 block truncate text-xs text-white/85">{it.description}</span>
            )}
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-white/95">
              立即查看<ArrowRight className="size-3" aria-hidden="true" />
            </span>
          </span>
        </a>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 费用卡（右栏第一位，腾讯云费用中心式）：余额大数字 + 充值/提现 + 消费/待付      */
/* -------------------------------------------------------------------------- */

/* 顶部三指标卡（华为云概览条式，替代旧费用卡）：余额+充值/提现 | 待办合计 | 待支付订单 */
/* -------------------------------------------------------------------------- */
/* 常用功能宫格（后台「首页快捷入口」配置渲染）                                    */
/* -------------------------------------------------------------------------- */

function QuickLinks({ items }) {
  /* 列数按容器宽度自适应（auto-fill），最小列宽取「当前配置里最长标签」
     实测出来的单元格宽度——文本任何情况下都不压缩、不省略。
     字宽估算：text-xs(12px) 下 CJK ≈12px/字，拉丁/数字 ≈7px；
     固定开销 = 图标 32 + 图标文字间距 10 + 左右内边距 20 ≈ 62px。 */
  const textW = (s) => [...String(s || '')].reduce(
    (w, ch) => w + (/[\u2E80-\u9FFF\uF900-\uFFEF]/.test(ch) ? 12 : 7), 0)
  const minCell = Math.max(104, ...items.map((it) => textW(it.label) + 66))
  return (
    <Card glow>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="size-4 text-brand" aria-hidden="true" />常用功能
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-3">
        <ul
          className="grid gap-1"
          role="list"
          aria-label="常用功能"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCell}px, 1fr))` }}
        >
          {items.map((it) => {
            const Icon = QUICK_ICONS[it.icon] || Package
            const url = String(it.url || '').replace(/^\//, '')
            return (
              <li key={it.id}>
                <a
                  href={`/${url}`}
                  className="group flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2.5 transition-colors duration-150 hover:border-line hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md cui-business-icon cui-business-icon--tile" data-cra1-icon-label={it.label} data-cui-icon-style={it.icon_style ? '1' : undefined} style={iconStyleVars(it.icon_style)}>
                    {it.icon_resolved?.url ? (it.icon_resolved.colorable ? <span className="cui-icon-mask" style={{'--cui-icon-url':`url("${it.icon_resolved.url}")`,width:16,height:16}} aria-hidden="true"/> : <img src={it.icon_resolved.url} width="16" height="16" alt=""/>) : <Icon className="size-4" aria-hidden="true" />}
                  </span>
                  <span className="whitespace-nowrap text-xs font-medium text-ink">{it.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* 我的产品                                                                    */
/* -------------------------------------------------------------------------- */

function HostSection() {
  const [rows, setRows] = useState([])
  const [renewalError, setRenewalError] = useState(false)
  const [navigation, setNavigation] = useState([])
  const [cat, setCat] = useState('all')
  const [visibleCount, setVisibleCount] = useState(12)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError('')
    setRenewalError(false)
    let alive = true
    Promise.all([loadHomeProducts(get, () => !alive), memberProductCategories()])
      .then(([result, categories]) => { if (alive) { setRows(result.rows); setRenewalError(result.renewalError); setNavigation(categories) } })
      .catch((e) => { if (alive) setError(e.message) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [attempt])

  const categories = homeProductCategories(rows, navigation)
  const selected = categories.find(c => c.key === cat) || categories[0]
  const shown = selected.rows.slice(0, visibleCount)

  const stMap = {
    using: { label: '使用中', cls: 'text-success' },
    grace: { label: '使用中（宽限期）', cls: 'text-warning' },
    expired: { label: '已到期 · 可续费', cls: 'text-danger' },
  }

  return (
    <Card glow>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-4 text-brand" aria-hidden="true" />我的产品
            </CardTitle>
            <CardDescription>{loading ? '正在读取产品分类…' : error ? '产品列表暂时无法加载' : `按导航关联的商品分类，共 ${rows.length} 项`}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = '/productList.htm' }}>
            全部产品<ArrowRight className="size-3.5" />
          </Button>
        </div>
        {/* Match sidebar names, order and product associations exactly. */}
        <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1.5" role="tablist" aria-label="产品分类">
          {!loading && !error && categories.map((c) => {
            const active = selected.key === c.key
            return (
              <button key={c.key} type="button" role="tab" aria-selected={active}
                      onClick={() => { setCat(c.key); setVisibleCount(12) }}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150',
                        active ? 'bg-brand/8 text-brand' : 'text-body hover:bg-muted-bg'
                      )}>
                {c.label}
                <span className={cn('ml-1', active ? 'text-brand' : 'text-muted-foreground')}>
                  ({c.rows.length})
                </span>
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent>
        {!loading && renewalError && (
          <Alert tone="warning" className="mb-4">
            部分到期产品的续费资格暂时无法确认，当前仅显示已确认可用的产品。
            <Button variant="outline" size="sm" className="ml-3" onClick={() => setAttempt(n => n + 1)}>重新检查</Button>
          </Alert>
        )}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : error ? (
          <Alert tone="error">
            {error}
            <Button variant="outline" size="sm" className="ml-3" onClick={() => setAttempt(n => n + 1)}>重试</Button>
          </Alert>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Server}
            title="暂无在用或可续费恢复的产品"
            description="可在“全部产品”中查看其他产品及其状态"
            action={<Button size="sm" onClick={() => { window.location.href = '/productList.htm' }}>
              查看全部产品
            </Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list" aria-label="产品卡片">
            {shown.map((h) => {
              const st = stMap[h.home_state]
              const dueLabel = h.billing_cycle === 'on_demand'
                ? (h.home_state === 'grace' ? `宽限至 ${formatDate(h.end_grace_time)}` : '按需计费')
                : (['free', 'onetime'].includes(h.billing_cycle) || Number(h.due_time) === 0 ? '长期有效' : formatDate(h.due_time))
              return (
                <div key={h.id}
                     className="cui-card flex gap-3 p-4">
                  {/* 左：名称/标识/IP/配置 */}
                  <div className="min-w-0 flex-1">
                    <a href={`/productdetail.htm?id=${h.id}`}
                       className="block truncate text-[13px] font-medium text-ink hover:text-brand"
                       title={h.product_name || '—'}>
                      {h.product_name || '—'}
                    </a>
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={h.name || ''}>
                      {h.name || '—'}
                    </p>
                    {(h.dedicate_ip || h.assign_ip || h.ip) && (
                      <p className="mt-0.5 truncate font-mono text-xs text-body">
                        {h.dedicate_ip || h.assign_ip || h.ip}
                      </p>
                    )}
                    {h.base_info && Number(h.show_base_info) === 1 && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={h.base_info}>
                        {h.base_info}{h.billing_cycle_name ? ` · ${h.billing_cycle_name}付` : ''}
                      </p>
                    )}
                  </div>
                  {/* 右：状态 + 到期（灰字，不重复状态） */}
                  <div className="flex shrink-0 flex-col items-end justify-between">
                    <span className={cn('text-xs font-medium', st.cls)}>{st.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {dueLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {!loading && !error && selected.rows.length > shown.length && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setVisibleCount(n => n + 12)}>
              显示更多产品（剩余 {selected.rows.length - shown.length} 项）
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* 工单                                                                        */
/* -------------------------------------------------------------------------- */

function TicketSection() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const available = !!window.__CRA1_RUNTIME__?.features?.ticket
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!available) return
    let alive = true
    setLoading(true)
    setFailed(false)
    // 多拉一些：前端过滤「已关闭」后仍保留足够的近期工单
    get('/ticket', { page: 1, limit: 20 })
      .then((res) => { if (alive) setRows((res.data?.list || []).filter((t) => t.status_id !== 4)) })
      .catch(() => { if (alive) setFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [available, attempt])

  if (!available) return null

  /* 状态文本映射（用户视角）：用户已回复/处理中 → 处理中；已回复 → 待反馈；
     已关闭不显示（上面已过滤）；自定义状态（后台新增）用原名 */
  const statusText = (t) => {
    if (t.status_id === 2 || t.status_id === 5) return '处理中'
    if (t.status_id === 3) return '待反馈'
    return t.status || '—'
  }
  const statusCls = (t) => {
    if (t.status_id === 2 || t.status_id === 5) return { color: '#FF7D00' }
    if (t.status_id === 3) return { color: 'var(--cui-titanium)' }
    return t.color ? { color: t.color, background: `${t.color}14` } : undefined
  }

  return (
    <Card glow>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="size-4 text-brand" aria-hidden="true" />我的工单
            </CardTitle>
            <CardDescription>最近的工单与回复</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = pluginLink('ticket') }}>
            全部<ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 px-5 pb-5">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : failed ? <ReadFailure className="px-5" onRetry={() => setAttempt(n => n + 1)} /> : rows.length === 0 ? (
          <div className="px-5 pb-4">
            <EmptyState
              className="py-7"
              icon={Ticket}
              title="暂无工单"
              description="遇到问题可提交工单，我们会尽快回复"
              action={<Button size="sm" onClick={() => { window.location.href = pluginLink('ticket') }}>
                提交工单
              </Button>}
            />
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {rows.slice(0, 5).map((t) => (
              <li key={t.id}>
                <a href={pluginLink('ticket','ticketDetails.htm',`id=${t.id}`)}
                   className="flex items-start gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-muted-bg">
                  <span className="mt-0.5 shrink-0">
                    <span
                      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                      style={statusCls(t)}
                    >
                      {statusText(t)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      #{t.ticket_num} {t.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {t.name || '—'}
                      {t.last_reply_time > 0 && ` · 最近回复 ${formatDate(t.last_reply_time)}`}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
/* -------------------------------------------------------------------------- */
/* 公告 / 新闻                                                                  */
/* -------------------------------------------------------------------------- */

function NewsSection({ cfg }) {
  const [result, setResult] = useState({ key: '', rows: [], loading: true, failed: false })
  const [attempt, setAttempt] = useState(0)

  const source = articleSource(cfg?.source)
  const info = articleSourceInfo(source)
  const enabled = cfg && Number(cfg.enabled) === 1 && !!window.__CRA1_RUNTIME__?.features?.[source]
  const title = cfg?.title?.trim() || '公告'
  const description = cfg?.description ?? '产品动态与重要通知'
  const typeId = Number(cfg?.type_id) || 0
  const limit = Math.max(3, Math.min(10, Number(cfg?.limit) || 6))
  const key = `${source}:${typeId}:${limit}`
  const current = result.key === key ? result : { rows: [], loading: true, failed: false }
  const { rows, loading, failed } = current

  useEffect(() => {
    if (!enabled) return
    let alive = true
    setResult({ key, rows: [], loading: true, failed: false })
    get(articleRequest(source, typeId, limit))
      .then(res => { const rows = articleRows(res, source, typeId, limit); if (alive) setResult({ key, rows, loading: false, failed: false }) })
      .catch(() => { if (alive) setResult({ key, rows: [], loading: false, failed: true }) })
    return () => { alive = false }
  }, [enabled, source, typeId, limit, key, attempt])

  if (!enabled) return null

  return (
    <Card glow>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              {source === 'help' ? <FileText className="size-4 text-brand" aria-hidden="true" /> : <Newspaper className="size-4 text-brand" aria-hidden="true" />}{title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = pluginLink(source) }}>
            更多<ArrowRight className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : failed ? <ReadFailure onRetry={() => setAttempt(n => n + 1)} /> : rows.length === 0 ? (
          <EmptyState className="py-8" icon={source === 'help' ? FileText : Newspaper} title={`暂无${info.label}`} description="内容发布后会显示在这里" />
        ) : (
          /* 竖向时间轴（华为云公告式）：左侧圆点+连线，右侧日期+标题 */
          <ol className="relative space-y-4 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-px before:bg-line" aria-label={title + '时间轴'}>
            {rows.map((n) => (
              <li key={n.id} className="relative pl-6">
                <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-brand bg-surface" aria-hidden="true" />
                <a href={pluginLink(source, info.view, `id=${Number(n.id)}`)} className="group block">
                  {n.create_time && <span className="text-xs text-muted-foreground">{formatDate(n.create_time)}</span>}
                  <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-body transition-colors duration-150 group-hover:text-brand">
                    {n.title}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
/* -------------------------------------------------------------------------- */

function percentText(v, thisMonth) {
  // 后端在「本月无消费 / 无上月基准」时会返回 100 作为占位，
  // 直接渲染成「较上月增长 100%」属于误导，这里按真实语义处理。
  if (!Number(thisMonth)) return '本月暂无消费'
  const n = Number(v)
  if (!Number.isFinite(n)) return '较上月无对比数据'
  if (n === 0) return '与上月持平'
  return n > 0 ? `较上月增长 ${n}%` : `较上月下降 ${Math.abs(n)}%`
}

/* -------------------------------------------------------------------------- */
/* 账户安全概览（右下角，华为云安全监控式环形仪表）：                            */
/* 评分项（实名/手机/邮箱/资料）由后台 home_security.items 开关，               */
/* 分数 = 已完成项 / 参与评分项 × 100                                           */
/* -------------------------------------------------------------------------- */

function SecurityOverview({ cfg, account }) {
  const [cert, setCert] = useState(null)   // /certification/info（实名状态）
  const [certLoading, setCertLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const enabled = cfg && Number(cfg.enabled) === 1
  const items = (cfg?.items || {})

  useEffect(() => {
    if (!enabled || !Number(items.certification) || !pluginLink('certification')) return
    let alive = true
    setCertLoading(true)
    get('/certification/info')
      .then((res) => { if (alive) setCert(res.data || null) })
      .catch(() => { if (alive) setCert(null) })
      .finally(() => { if (alive) setCertLoading(false) })
    return () => { alive = false }
  }, [enabled, items.certification, attempt])

  if (!enabled) return null

  /* 检查项：label / 是否完成（cert 依赖异步加载中先视为未完成） */
  const checks = []
  if (Number(items.certification) === 1 && pluginLink('certification')) {
    checks.push({
      label: '实名认证',
      done: cert ? cert.is_certification === true : false,
      loading: certLoading,
      unknown: cert === null,
      href: pluginLink('certification'),
    })
  }
  if (Number(items.phone) === 1) {
    checks.push({ label: '绑定手机号', done: !!account?.phone, unknown: !account, href: '/account.htm?tab=security' })
  }
  if (Number(items.email) === 1) {
    checks.push({ label: '绑定邮箱', done: !!account?.email, unknown: !account, href: '/account.htm?tab=security' })
  }
  if (Number(items.profile) === 1) {
    checks.push({ label: '完善账号资料', done: !!(account?.username && account?.id), unknown: !account, href: '/account.htm' })
  }

  const doneN = checks.filter((c) => c.done).length
  const percent = checks.length ? Math.round((doneN / checks.length) * 100) : 0
  const pending = checks.some(c => c.loading)
  const unknown = checks.some(c => c.unknown || c.loading)

  /* 环形仪表：SVG stroke-dasharray（半径 54，周长 ≈ 339.29） */
  const R = 54
  const CIRC = 2 * Math.PI * R

  return (
    <Card glow>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-4 text-brand" aria-hidden="true" />账户安全概览
            </CardTitle>
            <CardDescription>完善以下信息，提升账户安全性</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        {/* 环形仪表 */}
        <div className="relative shrink-0" role="img" aria-label={unknown ? '安全状态暂未确认' : `安全评分 ${percent} 分`}>
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r={R} fill="none" stroke="#E5E8ED" strokeWidth="10" />
            <circle
              cx="66" cy="66" r={R} fill="none"
              stroke={percent >= 75 ? '#00B42A' : percent >= 40 ? '#FF7D00' : '#E5484D'}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${unknown ? 0 : (CIRC * percent) / 100} ${CIRC}`}
              transform="rotate(-90 66 66)"
              style={{ transition: 'stroke-dasharray 400ms ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {unknown ? (
              <span className="text-xl font-semibold text-muted-foreground">--</span>
            ) : (
              <span className={cn('text-[26px] font-semibold tabular-nums leading-7',
                percent >= 75 ? 'text-success' : percent >= 40 ? 'text-warning' : 'text-danger')}>
                {percent}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{pending ? '检测中' : unknown ? '暂未确认' : '安全评分'}</span>
          </div>
        </div>

        {/* 检查项列表 */}
        <ul className="min-w-0 flex-1 space-y-2.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2.5 text-[13px]">
              <span className={cn(
                'flex size-4.5 shrink-0 items-center justify-center rounded-full',
                c.loading || c.unknown ? 'bg-muted-bg text-muted-foreground'
                  : c.done ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              )} aria-hidden="true">
                {c.loading ? <RefreshCw className="size-3 animate-spin" /> : c.unknown ? <span>—</span> : c.done ? <Check className="size-3" strokeWidth={3} /> : <span className="text-[10px] leading-none">!</span>}
              </span>
              <span className={cn('min-w-0 flex-1 truncate', c.done ? 'text-body' : 'font-medium text-ink')}>
                {c.label}
              </span>
              {c.unknown && !c.loading && (c.label === '实名认证'
                ? <button type="button" className="text-xs text-brand" onClick={() => setAttempt(n => n + 1)}>重试</button>
                : <span className="text-xs text-muted-foreground">暂未确认</span>)}
              {!c.loading && !c.unknown && !c.done && (
                <a href={c.href} className="shrink-0 text-xs font-medium text-brand hover:underline">去完善</a>
              )}
              {!c.loading && c.done && (
                <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
