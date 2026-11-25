import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, ChevronLeft, ChevronRight, Cpu, HardDrive, Layers2, MapPin, MemoryStick, Network, Package, Pin, RefreshCw, Search, ShoppingCart } from 'lucide-react'
import { PageHeader, Card, CardContent } from '../ui/card'
import { Button, buttonVariants } from '../ui/button'
import { Alert, EmptyState, Skeleton } from '../ui/feedback'
import { Select } from '../ui/select'
import { api, commonData, formatDate, formatDateTime, memberContentConfig } from '../lib'
import { usePageTab } from './usePageTab'
import { completeHostDisplayData, findProductCategory, hostCardTitle, hostDisplayFields, loadCategoryHosts, productListSources } from '../lib/product-config'
import { memberProductNavigation } from '../lib/member-navigation'
import { loadProductCardSummaries, productCardPrice, productCardSpecs, productNetwork, productPageNumbers, productSystemIcon, projectServerCard } from '../lib/product-card-data'
import ProductQuickActions from './product-quick-actions'
import { CopyText } from '../ui/copy-text'
import { productActionRequest } from '../lib/product-action-client'

const DEFAULT_TAB = 'current'
const STANDARD_TABS = [
  { value: DEFAULT_TAB, label: '当前产品' },
  { value: 'using', label: '使用中' },
  { value: 'expiring', label: '即将到期' },
  { value: 'overdue', label: '已逾期' },
  { value: 'all', label: '全部产品' },
]
const TABS = [...STANDARD_TABS, { value: 'deleted', label: '已删除' }]
const TAB_VALUES = TABS.map(t => t.value)
const VISIBLE_TAB_VALUES = STANDARD_TABS.map(t => t.value)
const readCategoryKey = () => new URLSearchParams(location.search).get('cloud_menu') || new URLSearchParams(location.search).get('m') || 'all'

function useProductListConfig() {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    let alive = true
    memberContentConfig().then(cfg => {
      if (alive) setConfig(cfg?.product_list)
    }).catch(() => { if (alive) setConfig(null) })
    return () => { alive = false }
  }, [])
  return config
}

function hostStatus(host) {
  const now = Number(host.list_server_time) * 1000 || Date.now()
  const due = Number(host.due_time) * 1000
  const recurring = !['free', 'onetime', 'on_demand', '免费', '一次性', '按需', ''].includes(host.billing_cycle_code ?? host.billing_cycle)
  const renewalWindowEnd = Number(host.renewal_window_end) * 1000
  if (host.status === 'Active' && recurring && due > 0 && due <= now) return { label: '已逾期', tone: 'danger' }
  if (host.status === 'Active' && recurring && due > now && due <= renewalWindowEnd) return { label: '即将到期', tone: 'warning' }
  return ({
    Active: { label: '已开通', tone: 'success' },
    Unpaid: { label: '未付款', tone: 'warning' },
    Pending: { label: '开通中', tone: 'muted' },
    Suspended: { label: '已暂停', tone: 'danger' },
    Deleted: { label: '已删除', tone: 'muted' },
    Failed: { label: '开通失败', tone: 'danger' },
    Grace: { label: '宽限期', tone: 'warning' },
    Keep: { label: '保留期', tone: 'warning' },
  })[host.status] || { label: host.status || '状态待同步', tone: 'muted' }
}

function HostCard({ host, fields, onOperation, ticketEntry, pinsAvailable, pendingPin, onPin }) {
  const pointer = useRef(null)
  const summary = host.card_summary || {}, state = hostStatus(host), network = productNetwork(host)
  const title = hostCardTitle(host, fields), imageName = summary.imageName || host.image_name || ''
  const area = summary.dataCenter || host.data_center || ''
  const shortArea = area.split(/\s*[·-]\s*/).filter(Boolean).slice(-2).filter((v, i, a) => i === 0 || v !== a[i - 1]).join(' · ')
  const ip = host.dedicate_ip || summary.ip || String(host.assign_ip || '').split(',').filter(Boolean)[0] || ''
  const showSpecs = fields.has('base_info') && Number(host.show_base_info ?? 1) !== 0
  const specs = productCardSpecs(host)
  const items = [
    ['cpu', 'CPU', Cpu], ['memory', '内存', MemoryStick], ['disk', '磁盘', HardDrive], ['bandwidth', '带宽', Network],
    ['traffic', '流量', ArrowUpDown],
  ]
  const server = ['mf_cloud', 'mf_dcim'].includes(host.module)
  const specItems = server ? items.filter(([key]) => specs[key]) : []
  const showSystem = Boolean(fields.has('os') && imageName || fields.has('area') && area)
  const showTechnical = showSystem || showSpecs && (specItems.length > 0 || !server && host.base_info)
  const price = productCardPrice(host, commonData())
  const lifetime = ['free', 'onetime', '免费', '一次性', ''].includes(host.billing_cycle)
  const expiry = Number(host.due_time) > 0 && !lifetime
  const showDue = fields.has('due_time') && (expiry || server && lifetime)
  const days = expiry ? Math.ceil((Number(host.due_time) * 1000 - Date.now()) / 86400000) : null
  const extras = [
    fields.has('billing_cycle') && ['计费周期', host.billing_cycle_name || host.billing_cycle || '—'],
    fields.has('is_auto_renew') && host.is_auto_renew!=null && ['自动续费', Number(host.is_auto_renew) ? '已开启' : '已关闭'],
    fields.has('power_status') && server && ['电源状态', ({ on: '运行中', off: '已关机', operating: '操作执行中', fault: '故障', suspend: '已暂停', pending: '等待中' })[host.power_status] || '待同步'],
    fields.has('active_time') && ['开通时间', formatDateTime(host.active_time)],
  ].filter(Boolean)
  const panelUrl = `/productdetail.htm?id=${host.id}`
  const titleIsIdentifier = !fields.has('product_name') && fields.has('instance_name') && host.name
  const startPointer = event => {
    const selection = window.getSelection()
    pointer.current = { x: event.clientX, y: event.clientY, moved: false, selected: Boolean(selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) }
  }
  const movePointer = event => {
    if (pointer.current && event.buttons === 1 && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 5) pointer.current.moved = true
  }
  const openPanel = event => {
    if (event.button !== 0 || !event.currentTarget.contains(event.target)) return
    if (event.detail > 0 && (pointer.current?.selected || pointer.current?.moved)) { if (event.target.closest('a')) event.preventDefault(); return }
    if (event.target.closest('a,button,input,select,textarea,[role="menuitem"],[data-card-interactive]')) return
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return
    if (event.ctrlKey || event.metaKey || event.shiftKey) window.open(panelUrl, '_blank', 'noopener,noreferrer')
    else window.location.assign(panelUrl)
  }
  return (
    <article className="cui-card cra1-product-card" role="listitem" data-host-id={host.id} onPointerDown={startPointer} onPointerMove={movePointer} onClick={openPanel}>
      <div className="cra1-product-card__identity">
        <div className="cra1-product-card__heading">
          <div className="cra1-product-card__names">
            {host.pinned && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Pin className="size-3" aria-hidden="true" />已置顶</span>}
            {titleIsIdentifier ? <><CopyText value={host.name} label="主机标识" className="cra1-product-card__title" /><a className="sr-only cra1-product-card__panel-link" href={panelUrl}>进入 {host.name} 控制面板</a></>
              : <a className="cra1-product-card__title cra1-product-card__panel-link" href={panelUrl} title={title} aria-label={`进入 ${title} 控制面板`}>{title}</a>}
            {fields.has('product_name') && fields.has('instance_name') && host.name && <CopyText value={host.name} label="主机标识" className="cra1-product-card__instance" />}
            {fields.has('ip') && (ip || server && network.type) && <div className="cra1-product-card__ip-line" data-network-type={network.type}>
              {network.icon && <img className="cra1-product-card__network-icon" src={network.icon} alt={network.label} />}
              {ip && <CopyText value={ip} label="IP" className="cra1-product-card__ip" />}
              {server && network.label && <span className="cra1-product-card__network-label">{network.label}</span>}
            </div>}
          </div>
          {(fields.has('status') || showDue) && <div className="cra1-product-card__state">
            {fields.has('status') && <span className="cra1-product-card__status" data-tone={state.tone}>{state.label}</span>}
            {showDue && <p className="cra1-product-card__due" data-tone={expiry && days <= 0 ? 'danger' : undefined}>
              {expiry ? <><span>到期时间</span><time dateTime={new Date(Number(host.due_time) * 1000).toISOString()}>{formatDate(host.due_time)}</time>{state.label === '即将到期' && <small>{days === 0 ? '今天到期' : `剩余 ${days} 天`}</small>}</> : '长期有效'}
            </p>}
          </div>}
        </div>
      </div>
      {showTechnical && <div className="cra1-product-card__technical">
        {showSystem && <div className="cra1-product-card__system">
          {fields.has('os') && imageName && <><img className="cra1-product-card__os-icon" src={productSystemIcon(host)} alt="" onError={event => { const img = event.currentTarget; if (!img.dataset.fallback) { img.dataset.fallback = 'true'; img.src = productSystemIcon({ module: host.module }) } }} /><span className="cra1-product-card__os-name" title={imageName}>{imageName}</span></>}
          {fields.has('area') && area && <span className="cra1-product-card__location" title={area}><MapPin aria-hidden="true" />{shortArea}</span>}
        </div>}
        {showSpecs && specItems.length > 0 && <dl className="cra1-product-card__specs">
          {specItems.map(([key, label, Icon]) => <div key={key} data-spec={key} data-spec-numeric={/^\d+(?:\.\d+)?(?:核|GB?|Mbps)?$/i.test(String(specs[key].value)) || undefined} title={`${key === 'traffic' ? '流量上限' : label}：${specs[key].value}${specs[key].unit}`}>
            <dt>{Icon ? <><Icon aria-hidden="true" /><span className="sr-only">{label}</span></> : <span>{label}</span>}</dt><dd>{specs[key].value}{specs[key].unit && <small>{specs[key].unit}</small>}</dd>
          </div>)}
        </dl>}
        {showSpecs && !server && host.base_info && <p className="cra1-product-card__other-config" title={host.base_info}>{host.base_info}</p>}
      </div>}
      {(fields.has('notes') && host.client_notes || extras.length > 0) && <div className="cra1-product-card__extra">
        {fields.has('notes') && host.client_notes && <p className="cra1-product-card__notes" title={host.client_notes}>备注：{host.client_notes}</p>}
        {extras.map(([label, value]) => <p key={label} title={`${label}：${value}`}><span>{label}</span>{value}</p>)}
      </div>}
      <div className="cra1-product-card__footer">
        <div className="cra1-product-card__billing">
          {price && <p className="cra1-product-card__price"><span className="cra1-product-card__currency">{price.prefix}</span><strong>{price.amount}</strong>{price.suffix && <span className="cra1-product-card__currency">{price.suffix}</span>}{price.cycle && <span className="cra1-product-card__cycle">/ {price.cycle}</span>}</p>}
        </div>
        <div className="cra1-product-card__actions" data-card-interactive>
          <ProductQuickActions host={host} onChanged={onOperation} ticketEntry={ticketEntry}
            onPin={pinsAvailable ? () => onPin(host) : undefined} pendingPin={pendingPin} />
        </div>
      </div>
    </article>
  )
}

export default function ProductListPage() {
  const showDeleted = Number(window.__CRA1_RUNTIME__?.features?.show_deleted_products) === 1
  const tabs = showDeleted ? TABS : STANDARD_TABS
  const [tab, setTab] = usePageTab(DEFAULT_TAB, showDeleted ? TAB_VALUES : VISIBLE_TAB_VALUES)
  const [categories, setCategories] = useState(null), [categoryKey, setCategoryKey] = useState(readCategoryKey)
  const [overviewAliases, setOverviewAliases] = useState([])
  const [entries, setEntries] = useState(() => new Map())
  const [search, setSearch] = useState(''), [keywords, setKeywords] = useState('')
  const [page, setPage] = useState(1), [limit, setLimit] = useState(6)
  const [rows, setRows] = useState([]), [total, setTotal] = useState(0), [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0)
  const [categoryError, setCategoryError] = useState('')
  const [onlyPinned, setOnlyPinned] = useState(false)
  const [pinsAvailable, setPinsAvailable] = useState(true)
  const [ticketEntry, setTicketEntry] = useState('')
  const [pinFeedback, setPinFeedback] = useState(null)
  const [pendingPin, setPendingPin] = useState(null)
  const pinRequest = useRef(false)
  const pinFocus = useRef(null)
  const filterPinButton = useRef(null)

  useEffect(() => {
    if (loading || !pinFocus.current) return
    const id = pinFocus.current
    pinFocus.current = null
    if (document.activeElement !== document.body) return
    const trigger = document.querySelector(`[data-host-id="${id}"] .cra1-product-card__quick`)
    ;(trigger || filterPinButton.current)?.focus({ preventScroll:true })
  }, [loading])

  useEffect(() => {
    let alive = true
    memberProductNavigation().then(result => {
      if (!alive) return
      setCategories(result.categories); setOverviewAliases(result.overviewAliases); setEntries(result.entries)
    }).catch(() => { if (alive) { setCategoryError('导航分类读取失败，请刷新重试。'); setCategories([]) } })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const onPop = () => { setCategoryKey(readCategoryKey()); setPage(1) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const activeCategory = findProductCategory(categories || [], categoryKey)
  const isOverview = categoryKey === 'all' || overviewAliases.includes(categoryKey)
  const category = useMemo(() => activeCategory || (isOverview ? null : { product_id: [] }), [activeCategory, isOverview])
  const fields = useMemo(() => hostDisplayFields(category), [category])
  const config = useProductListConfig()
  const sources = productListSources(config, entries, categoryKey, tab, activeCategory)
  const intro = sources.copy
  const purchase = !categoryError && (categoryKey === 'all' || activeCategory || isOverview)
    ? sources.purchase
    : null
  const categoryName = activeCategory?.name || '全部分类', tabName = TABS.find(t => t.value === tab).label
  const missingCategory = categories !== null && !isOverview && !activeCategory

  useEffect(() => {
    const term = search.trim()
    if (term === keywords) return
    const timer = setTimeout(() => { setKeywords(term); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [search, keywords])

  useEffect(() => {
    if (categories === null) return
    const controller = new AbortController()
    const read = (path, params) => api(path, { params, signal: controller.signal, timeout: 12000 })
    setCounts(null)
    Promise.all(tabs.map(t => loadCategoryHosts(read, { tab: t.value, count_only: 1, only_pinned: onlyPinned ? 1 : 0 }, category).then(data => [t.value, Number(data.count)])))
      .then(values => { if (!controller.signal.aborted && values.every(([, n]) => Number.isFinite(n))) setCounts(Object.fromEntries(values)) })
      .catch(() => {})
    return () => controller.abort()
  }, [categories, category, refresh, tabs, onlyPinned])

  useEffect(() => {
    if (categories === null) return
    const controller = new AbortController()
    const read = (path, params) => (/^\/(mf_cloud|mf_dcim)\/\d+(?:\/status)?$/.test(path) ? productActionRequest : api)(path, { params, signal: controller.signal, timeout: 12000 })
    setLoading(true); setError('')
    loadCategoryHosts(read, { tab, page, limit, keywords, only_pinned: onlyPinned ? 1 : 0, include_actions: 1 }, category)
      .then(async data => {
        if (!Array.isArray(data.list) || !Number.isFinite(Number(data.count))) throw Error('产品数据不完整，请重试')
        if (controller.signal.aborted) return
        setPinsAvailable(data.pins_available !== false)
        setTicketEntry(data.ticket_entry || '')
        const maxPage = Math.max(1, Math.ceil(Number(data.count) / limit))
        if (page > maxPage) { setPage(maxPage); return }
        const list = await completeHostDisplayData(read, data.list, category)
        if (controller.signal.aborted) return
        setRows(list); setTotal(Number(data.count)); setLoading(false)
        loadProductCardSummaries(read, list, fields, {
          isCancelled: () => controller.signal.aborted,
          onUpdate: (id, summary, failed) => setRows(current => current.map(h => String(h.id) === String(id) ? { ...h, card_summary: summary, card_summary_failed: failed } : h)),
        }).catch(() => {})
      })
      .catch(err => { if (!controller.signal.aborted) { setError(err.message || '产品读取失败，请重试'); setLoading(false) } })
    return () => controller.abort()
  }, [categories, category, tab, page, limit, keywords, refresh, fields, onlyPinned])

  async function changePin(host) {
    if (pinRequest.current) return
    pinRequest.current = true
    setPendingPin(host.id)
    setPinFeedback(null)
    try {
      await api('/cra1-theme/member/product-list/' + host.id + '/pin', { method: 'PUT', body: { pinned: !host.pinned } })
      if (document.activeElement?.closest(`[data-host-id="${host.id}"]`) || document.activeElement === document.body) pinFocus.current = host.id
      setRows(current => current.map(row => row.id === host.id ? { ...row, pinned: !host.pinned } : row))
      setPinFeedback({ message: host.pinned ? '已取消置顶' : '已置顶，可在列表前面找到此产品' })
      setPage(1)
      setRefresh(value => value + 1)
    } catch (error) {
      setPinFeedback({ message: error.data?.msg || '置顶状态暂时无法保存，请重试。', host })
    } finally {
      pinRequest.current = false
      setPendingPin(null)
    }
  }

  const changeCategory = key => {
    setCategoryKey(key); setPage(1)
    const url = new URL(location.href)
    url.searchParams.delete('m')
    if (key === 'all') url.searchParams.delete('cloud_menu')
    else url.searchParams.set('cloud_menu', key)
    window.history.pushState({}, '', url)
  }
  const changeTab = value => { setTab(value); setPage(1) }
  const reset = () => { setSearch(''); setKeywords(''); setOnlyPinned(false); changeCategory('all'); setTab(DEFAULT_TAB) }
  const pages = Math.max(1, Math.ceil(total / limit)), start = (page - 1) * limit
  const hasSummaryFailure = rows.some(h => h.card_summary_failed)
  const onHostOperation = ({ id, detail, power, host: updatedHost }) => setRows(current => current.map(host => String(host.id) === String(id)
    ? { ...host, ...(updatedHost ? Object.fromEntries(['due_time', 'billing_cycle', 'billing_cycle_name', 'renew_amount', 'status', 'renew_forbidden', 'is_auto_renew'].filter(key => updatedHost[key] !== undefined).map(key => [key, updatedHost[key]])) : {}), ...(power ? { power_status: power.status } : {}), ...(detail ? { card_summary: projectServerCard(detail, host.module), card_summary_failed: false } : {}) }
    : host))

  return (
    <div className="cra1-products">
      <PageHeader title={sources.title} description={sources.description}
        className={purchase ? 'cra1-products__header--purchase flex-nowrap items-center gap-2' : undefined}
        actions={(counts || purchase) && <>
          {counts && <span className="cra1-products__head-count">当前产品 <strong>{counts[DEFAULT_TAB]}</strong> 个</span>}
          {purchase && <a className={buttonVariants({ size: 'sm', className: 'cra1-products__purchase' })}
            href={purchase.url} target={purchase.newTab ? '_blank' : undefined} rel={purchase.newTab ? 'noopener' : undefined}
            data-cui-button-glow="primary" title={purchase.text}>
            <ShoppingCart aria-hidden="true" /><span className="cra1-products__purchase-text">{purchase.text}</span>
            <span className="cui-button-glow" aria-hidden="true" />
          </a>}
        </>} />
      {intro?.html && <Card><CardContent className="cra1-rich-text p-4 text-[13px] leading-6 text-body" dangerouslySetInnerHTML={{ __html: intro.html }} /></Card>}
      {categoryError && <Alert tone="warning">{categoryError}</Alert>}
      {missingCategory && !categoryError && <Alert tone="warning">该导航已不存在，请重新选择产品分类。</Alert>}
      <section className="cui-card cra1-products__filters" aria-label="产品筛选">
        {categories?.length > 0 && <div className="cra1-products__filter-row">
          <span className="cra1-products__filter-label">产品分类</span>
          <div className="cra1-products__categories" role="group" aria-label="产品分类">
            <button type="button" className="cra1-products__category" data-category="all" aria-pressed={isOverview} onClick={() => changeCategory('all')}><Layers2 aria-hidden="true" />全部分类</button>
            {categories.map(c => <button key={c.key} type="button" className="cra1-products__category" data-category={c.key} aria-pressed={activeCategory?.key === c.key} onClick={() => changeCategory(c.key)}><Package aria-hidden="true" />{c.name}</button>)}
          </div>
        </div>}
        <div className="cra1-products__filter-row">
          <span className="cra1-products__filter-label">产品状态</span>
          <div className="cra1-products__statuses" role="group" aria-label="产品状态">
            {tabs.map(t => <button key={t.value} type="button" className="cra1-products__status" data-status={t.value} aria-pressed={tab === t.value} onClick={() => changeTab(t.value)}>{t.label}{counts && <small>{counts[t.value]}</small>}</button>)}
          </div>
          <label className="cra1-products__search"><Search aria-hidden="true" /><input type="search" aria-label="搜索产品" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索产品、配置、地区或备注" /></label>
          <Button ref={filterPinButton} type="button" size="sm" variant={onlyPinned ? 'secondary' : 'outline'} aria-pressed={onlyPinned}
            disabled={!pinsAvailable && !onlyPinned} onClick={() => { setOnlyPinned(value => !value); setPage(1) }}>
            <Pin aria-hidden="true" />只看置顶
          </Button>
        </div>
      </section>
      <div className="cra1-products__list-head">
        <p aria-live="polite"><strong>{categoryName}</strong><span> / {tabName}{loading ? ' · 加载中…' : error ? ' · 读取失败' : ` · ${total} 个产品`}</span></p>
        <span className="cra1-products__order">{tab === 'deleted' ? '按产品编号从新到旧排列' : '置顶优先，其余按产品编号从新到旧排列'}</span>
      </div>
      {!pinsAvailable && <Alert tone="warning">置顶暂时无法读取。<Button size="sm" variant="ghost" onClick={() => setRefresh(value => value + 1)}>重试</Button></Alert>}
      {pinFeedback && <Alert tone={pinFeedback.host ? 'warning' : 'info'} role={pinFeedback.host ? 'alert' : 'status'}>{pinFeedback.message}
        {pinFeedback.host && <Button size="sm" variant="ghost" disabled={pendingPin !== null} onClick={() => changePin(pinFeedback.host)}>重试</Button>}
      </Alert>}
      {hasSummaryFailure && !loading && !error && <p className="cra1-products__sync-note" role="status">部分产品的配置信息暂时无法读取。 <Button type="button" size="sm" variant="ghost" onClick={() => setRefresh(n => n + 1)}>重新加载</Button></p>}
      {error ? <Alert tone="error" role="alert">
        <span>产品列表暂时无法读取。</span> <Button type="button" size="sm" variant="outline" onClick={() => setRefresh(n => n + 1)}>重新加载</Button>
      </Alert>
        : loading ? <div className="cra1-products__grid" aria-label="产品加载中" aria-busy="true">{Array.from({ length: limit }).map((_, i) => <Skeleton key={i} className="h-[220px] rounded-2xl" />)}</div>
          : rows.length === 0 ? <div className="cra1-products__empty"><EmptyState icon={Package} title={onlyPinned ? '没有符合条件的置顶产品' : keywords ? '没有符合条件的产品' : tab === 'deleted' ? '没有已删除的产品' : '暂无产品'} description={onlyPinned ? '可取消筛选，或打开产品的更多操作将它置顶。' : keywords ? '试试名称、IP、客户备注，或“Ubuntu 香港 100Mbps”。' : tab === 'deleted' ? '此分类下没有已删除的产品。' : '当前分类及状态下没有产品。'} action={<div className="cra1-products__empty-actions"><Button size="sm" variant="outline" onClick={reset}>清除筛选</Button>{!onlyPinned && !keywords && tab !== 'deleted' && <Button size="sm" onClick={() => { window.location.href = '/cart/goodsList.htm' }}>浏览产品</Button>}</div>} /></div>
            : <div className="cra1-products__grid" role="list" aria-label="产品卡片">{rows.map(h => <HostCard key={h.id} host={h} fields={fields} onOperation={onHostOperation} ticketEntry={ticketEntry}
              pinsAvailable={pinsAvailable && h.status !== 'Deleted' && h.status !== 'Cancelled'} pendingPin={pendingPin !== null} onPin={changePin} />)}</div>}
      {!error && <footer className="cra1-products__pagination" aria-label="产品列表分页">
        <p className="cra1-products__range" aria-live="polite">{loading ? '正在读取产品…' : total > 0 ? `显示 ${start + 1}–${Math.min(start + limit, total)} 条，共 ${total} 条` : '共 0 条'}</p>
        <div className="cra1-products__page-tools">
          <label className="cra1-products__page-size">每页 <Select size="sm" aria-label="每页显示数量" value={String(limit)} onChange={event => { setLimit(Number(event.target.value)); setPage(1) }}>{[6, 9, 12].map(n => <option key={n} value={n}>{n} 条</option>)}</Select></label>
          <nav className="cra1-products__pages" aria-label="分页">
            <button type="button" className="cra1-products__page-button" aria-label="上一页" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft aria-hidden="true" /></button>
            {productPageNumbers(page, pages).map((n, i) => n === '…' ? <span key={`gap-${i}`} className="cra1-products__page-gap">…</span> : <button type="button" key={n} className="cra1-products__page-button" aria-label={`第 ${n} 页`} aria-current={page === n ? 'page' : undefined} disabled={loading} onClick={() => setPage(n)}>{n}</button>)}
            <button type="button" className="cra1-products__page-button" aria-label="下一页" disabled={loading || page >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight aria-hidden="true" /></button>
          </nav>
        </div>
      </footer>}
    </div>
  )
}
