import HostCustomFields from './serverPanel/custom-fields'
import HostAccessGate from './host-access-gate'
import {hostPayload} from '../compat'
import { useState, useEffect } from 'react'
import { Package, LayoutGrid, Server, RefreshCw, Plus } from 'lucide-react'
import { PageHeader, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge, Alert, EmptyState, Skeleton } from '../ui/feedback'
import { ModuleView } from '../ui/module-view'
import { get, formatDate, formatMoney, formatDateTime } from '../lib'
import { cn } from '../ui/utils'
import ServerPanel from './serverPanel/index'
import ProductListPage from './productList'
import { detectServerModule } from './serverPanel/api'
import { releaseTimeText } from './serverPanel/auto-release-time'

/**
 * 产品系列页面（四个页面共用一份实现，靠入口传入 mode 区分）
 *
 * 系统里有两条完全不同的「产品」路径，之前被错误地合并成了一个列表页：
 *
 *   A. 自定义导航列表 —— 侧边栏「魔方云(自定义配置)」这类菜单项，URL 是
 *      product.htm?m=2364 或 crossModule.htm?m=2364。菜单记录里带 module /
 *      res_module 字段，列表由对应模块后端渲染成 HTML 返回，前端只负责注入。
 *      接口：GET /console/v1/menu/:id/host  → data.content
 *
 *   B. 我的产品总览 —— productList.htm，按状态分页展示当前账户全部产品。
 *      接口：GET /console/v1/host?tab=using|expiring|overdue|deleted
 *
 *   C. 产品内页 —— productdetail.htm?id=15，模块提供的实例管理界面。
 *      接口：GET /console/v1/host/:id/view → data.content
 *
 * 三者视觉上统一在新外壳里，但内容来源不同，不能互相替代。
 * 另有 product_list.htm 是商品订购的 iframe 承载页，依赖未安装的插件，
 * 单独在 product_list 入口里做降级处理。
 */

const HOST_STATUS = {
  Unpaid: { label: '未付款', tone: 'warning' },
  Pending: { label: '开通中', tone: 'default' },
  Active: { label: '已开通', tone: 'success' },
  Suspended: { label: '已暂停', tone: 'danger' },
  Deleted: { label: '已删除', tone: 'muted' },
  Failed: { label: '开通失败', tone: 'danger' },
}

/* -------------------------------------------------------------------------- */
/* A. 自定义导航产品列表（模块渲染）                                             */
/* -------------------------------------------------------------------------- */

function CustomNavPage({ menuId }) {
  const [menuName, setMenuName] = useState('')

  useEffect(() => {
    // 菜单名从 /menu 拿，避免标题与侧边栏不一致
    get('/menu')
      .then((res) => {
        const flat = []
        ;(res.data?.menu || []).forEach((m) => {
          flat.push(m)
          ;(m.child || []).forEach((c) => flat.push(c))
        })
        const hit = flat.find((m) => String(m.id) === String(menuId))
        if (hit) setMenuName(hit.name)
      })
      .catch(() => {})
  }, [menuId])

  if (!menuId) {
    return (
      <>
        <PageHeader title="自定义导航产品" description="按菜单分类查看产品" />
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={LayoutGrid}
              title="缺少导航参数"
              description="本页需要通过侧边栏菜单进入，请从左侧自定义导航中打开对应分类。"
              action={<Button size="sm" onClick={() => { window.location.href = '/productList.htm' }}>前往我的产品</Button>}
            />
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={menuName || '产品列表'}
        description="该分类下的产品由对应模块提供，支持筛选、批量续费与状态管理"
        actions={<Button variant="outline" size="sm" onClick={() => { window.location.href = '/productList.htm' }}>全部产品</Button>}
      />
      <ModuleView
        url={`/menu/${menuId}/host`}
        title={menuName}
        empty={
          <Card>
            <CardContent className="p-5">
              <EmptyState
                icon={Package}
                title="该分类暂无产品"
                description="此分类下暂无可显示的产品。"
              />
            </CardContent>
          </Card>
        }
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* B. 我的产品总览                                                              */
/* -------------------------------------------------------------------------- */

function MyProductsPage() {
  return <ProductListPage />
}

function HostDetailPage({ hostId }) {
  const [host, setHost] = useState(null)
  const [loading, setLoading] = useState(!!hostId)
  const [readError, setReadError] = useState('')
  /* 云模块探测：mf_cloud / mf_dcim 产品 → 渲染全新 React 控制面板；
     其他模块（idcsmart_common 等）→ false，走下方旧版三段式 + ModuleView。null=探测中 */
  const [serverReady, setServerReady] = useState(null)
  /* 探测结果缓存：外层已请求过 /mf_cloud/:id（或 /mf_dcim/:id），
     传给 ServerPanel 复用，避免其内部再次探测造成同一请求发两次 */
  const [serverDetected, setServerDetected] = useState(null)

  useEffect(() => {
    if (!hostId) return
    setLoading(true)
    let alive = true
    /* 先探测云模块：mf_cloud / mf_dcim 产品由 ServerPanel 接管（自取数据），
       通用产品只读取其实际产品资料，避免重复请求 */
    detectServerModule(hostId)
      .catch(() => null)
      .then((detected) => {
        if (!alive) return
        setServerReady(!!detected)
        if (detected) {
          setServerDetected(detected)
          setLoading(false)
          return
        }
        return get(`/theme/host/${hostId}`)
          // 后端对不存在的产品返回 status:200 + host:{}（不是 404），
          // 必须用 host.id 判断是否真的取到了数据，否则会渲染一屏「—」。
          .then((res) => {
            const h = res.data?.host
            setHost(h && h.id ? hostPayload(res.data) : null)
            // 侧栏「最近访问」回填：同一地址（productdetail.htm?id=N）内容随产品
            // 不同，这里广播具体名称，让记录显示产品标识而非笼统的「产品详情」
            if (h && h.id) {
              window.dispatchEvent(new CustomEvent('cra1:page-title', {
                detail: { name: h.product_name || h.name || `产品 #${h.id}` },
              }))
            }
          })
          .catch(() => {setReadError('页面错误，请刷新重试');setHost(null)})
          .finally(() => setLoading(false))
      })
    return () => { alive = false }
  }, [hostId])

  if (!hostId) {
    return (
      <>
        <PageHeader title="产品详情" description="管理实例、查看运行状态" />
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={Server}
              title="缺少产品 ID"
              description="请从「我的产品」列表中点击产品进入详情。"
              action={<Button size="sm" onClick={() => { window.location.href = '/productList.htm' }}>前往我的产品</Button>}
            />
          </CardContent>
        </Card>
      </>
    )
  }

  /* 云产品：全新控制面板（云模块探测命中即接管整个详情页） */
  if (serverReady) {
    return <ServerPanel hostId={hostId} initialDetected={serverDetected} />
  }

  if (loading || (serverReady === null && !host)) {
    return (
      <>
        <PageHeader title="产品详情" description="正在加载产品信息…" />
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  if (!host) {
    return (
      <>
        <PageHeader title="产品详情" description="管理实例、查看运行状态" />
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={Server}
              title={readError || '产品不存在'}
              description={readError ? '' : '该产品可能已被删除，或不属于当前账户。'}
              action={<Button size="sm" onClick={() => { window.location.href = '/productList.htm' }}>返回我的产品</Button>}
            />
          </CardContent>
        </Card>
      </>
    )
  }

  const suspended = host.status === 'Suspended'
  const overdue = host.status === 'Active' && host.due_time && host.due_time * 1000 <= Date.now()
  const recurring = !!host.billing_cycle && !['free','onetime','on_demand'].includes(host.billing_cycle)

  /* 完全重构：打散重排为三层结构（阿里云 ECS 详情页式）
     概要横条（IP/配置/到期/快捷操作）→ 左侧属性卡 → 右侧模块控制面板 */
  return (
    <div className="cra1-generic-product space-y-5">
      <PageHeader
        title={host.product_name || '产品详情'}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={(HOST_STATUS[host.status] || {}).tone || 'muted'}>
              {(HOST_STATUS[host.status] || {}).label || host.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => { window.location.href = '/productList.htm' }}>
              返回列表
            </Button>
          </div>
        }
      />

      {suspended && (
        <Alert tone="warning">
          该产品已暂停。{host.suspend_reason ? `原因：${host.suspend_reason}` : '请查看账单或联系客服了解详情。'}
        </Alert>
      )}

      {/* 概要横条：IP/配置/到期 + 快捷操作 */}
      <Card glow>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
          <div><p className="text-xs text-muted-foreground">产品标识</p><p className="mt-1 font-medium text-ink break-all">{host.name || `#${host.id}`}</p></div>
          {host.base_info && (
            <div>
              <p className="text-xs text-muted-foreground">配置</p>
              <p className="mt-0.5 text-[15px] font-medium text-ink">{host.base_info}</p>
            </div>
          )}
          {Number(host.due_time)>0 && recurring && <div>
            <p className="text-xs text-muted-foreground">到期时间</p>
            <p className={cn('mt-0.5 text-[15px] font-medium',
              overdue ? 'text-danger' : 'text-ink')}>
              {formatDate(host.due_time)}
            </p>
          </div>}
          {recurring && host.renew_amount!=null && !host.renew_forbidden && <div>
            <p className="text-xs text-muted-foreground">续费金额</p>
            <p className="mt-0.5 text-[15px] font-medium tabular-nums text-ink">
              {formatMoney(host.renew_amount)}
            </p>
          </div>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* 左栏：实例属性卡（详细属性，sticky） */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="p-4">
            <p className="mb-3 text-[13px] font-semibold text-ink">产品属性</p>
            <dl className="space-y-2.5 text-[12px]">
              <SideItem label="产品 ID" value={host.id} mono />
              <SideItem label="产品标识" value={host.name} mono />
              <SideItem label="计费周期" value={host.billing_cycle_name || host.billing_cycle} />
              {Number(host.active_time)>0 && <SideItem label="开通时间" value={formatDateTime(host.active_time)} />}
              {host.first_payment_amount!=null && <SideItem label="首次付款" value={formatMoney(host.first_payment_amount)} />}
              {recurring && host.is_auto_renew!=null && <SideItem label="自动续费" value={Number(host.is_auto_renew) ? '已开启' : '未开启'} />}
              {Number(host.auto_release_time)>0 && <SideItem
                label="自动释放"
                value={releaseTimeText(host.auto_release_time)}
              />}
              <HostCustomFields host={host}/>

            </dl>
          </CardContent>
        </Card>

        {/* 右主区：模块控制面板 */}
        <div className="min-w-0">
          <ModuleView
            url={`/host/${hostId}/view`}
            params={{ id: hostId }}
            title={host.product_name}
            deps="detail"
            empty={
              <Card>
                <CardContent className="p-5">
                  <EmptyState
                    icon={Server}
                    title="该产品暂无可管理的内页"
                    description="请返回产品列表或联系客服。"
                  />
                </CardContent>
              </Card>
            }
          />
        </div>
      </div>
    </div>
  )
}

/* 侧栏紧凑 key-value 行 */
function SideItem({ label, value, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 break-words text-right text-ink', mono && 'font-mono')} title={String(value ?? '')}>
        {value ?? '—'}
      </dd>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export default function ProductPage({ mode = 'mylist' }) {
  if (mode === 'customnav') {
    const menuId = new URLSearchParams(location.search).get('m') || ''
    return <CustomNavPage menuId={menuId} />
  }
  if (mode === 'detail') {
    const hostId = new URLSearchParams(location.search).get('id') || ''
    return hostId ? <HostAccessGate hostId={hostId}><HostDetailPage hostId={hostId} /></HostAccessGate> : <HostDetailPage hostId={hostId} />
  }
  return <MyProductsPage />
}
