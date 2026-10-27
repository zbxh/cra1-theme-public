import {pluginLink} from '../../lib'
import {usePaymentReturn} from '../../ui/use-payment-return'
import AppPresetTasks from './app-presets'
import HostCustomFields from './custom-fields'
import {hostPayload} from '../../compat'
import {useAccess,Guard} from '../../ui/access'
import {dialogPermission} from '../../permissions'
import { ChartTooltip } from '../../ui/chart-tooltip'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy, MonitorPlay, ChevronDown, MapPin, CircleAlert,
  Wallet, CalendarClock, RefreshCw, Cpu, MemoryStick, HardDrive, Wifi, Activity,
  ArrowUpDown, KeyRound, Info,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, PolarAngleAxis, RadialBar,
  RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PageHeader, Card, CardContent, CardHeader as CHeader, CardTitle as CTitle } from '../../ui/card'
import { Button } from '../../ui/button'
import { Badge, Alert, EmptyState, Skeleton } from '../../ui/feedback'
import {
  BentoGrid, BentoCell, SpotlightCard, BorderBeam, HeroGridBg, PulseDot, NumberTicker,
} from '../../ui/aceternity'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { useToast } from '../../ui/toast'
import { get, api as requestApi, formatDate, formatDateTime, commonData, memberContentConfig } from '../../lib'
import { cn } from '../../ui/utils'
import { createServerApi, detectServerModule } from './api'
import { formatBytes, remainDays, formatFlowReset, flowCycleStart } from './format'
import {
  NetworkCard, DiskCard, BackupCard, SecurityGroupCard, LogTab, OrderTab, CopyText,
} from './manage'
import { ServerPanelDialogs, PayDialog } from './dialogs'
import { copyToClipboard } from './clipboard'
import MonitoringTab from './monitoring'
import InstanceActionsMenu from './instance-actions'
import { PanelRefreshContext, usePanelReader, usePanelRefresh } from './use-panel-refresh'
import { orderOperation, refreshForOperation } from './refresh-policy'
import AutoRenewControl from './auto-renew-control'
import { releaseTimeText } from './auto-release-time'

/**
 * 服务器控制面板（productdetail 重写版）
 *
 * 全 React 原生，替换旧「注入 mf_cloud/product_detail.html (Vue2)」的方案。
 * 布局 = aceternity bento（浅色改良）× 阿里云 ECS 概览的信息架构：
 *   英雄区(状态/电源/IP/配置) → 到期续费(流光边框) → 实时占用/监控/流量 →
 *   网络/磁盘/备份快照 → 操作/属性/日志。
 * 仅对本站 mf_cloud / mf_dcim 产品生效；其他模块由外层回退到 ModuleView。
 */

const HOST_STATUS = {
  Unpaid: { label: '未付款', tone: 'warning' },
  Pending: { label: '开通中', tone: 'default' },
  Active: { label: '已开通', tone: 'success' },
  Suspended: { label: '已暂停', tone: 'danger' },
  Deleted: { label: '已删除', tone: 'muted' },
  Failed: { label: '开通失败', tone: 'danger' },
}

/* 电源状态（/status）→ 灯与文案 */
const POWER_STATE = {
  on: { label: '运行中', tone: 'success' },
  off: { label: '已关机', tone: 'muted' },
  operating: { label: '操作执行中', tone: 'warning' },
  fault: { label: '故障', tone: 'danger' },
  suspend: { label: '已暂停', tone: 'warning' },
  pending: { label: '等待中', tone: 'default' },
}

export default function ServerPanel({ hostId, onFallback, initialDetected = null }) {
  const toast = useToast()
  const [phase, setPhase] = useState('detect') // detect | ok | fallback | missing
  const [module, setModule] = useState('mf_cloud')
  const [host, setHost] = useState(null)
  const [cloud, setCloud] = useState(null)
  const [power, setPower] = useState({ status: 'pending', desc: '' })
  const [remote, setRemote] = useState(null)
  const [ips, setIps] = useState(null)
  const [ipv6, setIpv6] = useState({ list: [], count: 0 })
  const [flow, setFlow] = useState(null)
  const [real, setReal] = useState(null)
  const [tab, setTab] = useState('overview') // overview | monitor
  const [flowCurve, setFlowCurve] = useState(null)
  const [busy, setBusy] = useState(false)
  const {can}=useAccess()
  const [dlg, rawSetDlg] = useState(null)
  const setDlg = value => { if (!value || typeof value==='function' || can(dialogPermission(value.type))) rawSetDlg(value) } // {type, payload?}
  const [payOrder, setPayOrder] = useState(null) // 面板内下单后打开统一支付
  /* 商品级订购配置（/product/:pid/mf_cloud/order_page 的 config）：
     support_ssh_key、rand_ssh_port*、backup_enable/snap_enable 等都在这里；mf_cloud detail 的 config 不含这些 */
  const [orderCfg, setOrderCfg] = useState(null)
  /* 「订单记录」标签页控制（主题后台 会员中心主题→内容设置→服务器面板·订单记录）：
     enabled 关闭时不显示标签也不发订单请求；fetch_page/fetch_max 控制取数条数。
     快照不可用时返回默认（开 / 100 / 1000），行为与未配置前一致。 */
  const [hostOrders, setHostOrders] = useState({ enabled: 0, fetch_page: 100, fetch_max: 1000 })
  /* 求助入口（工单中心）：取自主题后台「首页快捷入口」里的工单项；
     未配置时 LoadError 内部兜底插件默认路径 —— 加载失败时的求助出口 */
  const [supportUrl, setSupportUrl] = useState(pluginLink('ticket'))
  /* 配置异步到达：若「订单记录」被后台关闭而当前正停留该标签 → 切回概览（避免空态） */
  useEffect(() => {
    if (!hostOrders.enabled && tab === 'orders') setTab('overview')
  }, [hostOrders.enabled, tab])
  const apiRef = useRef(null)
  const api = apiRef.current
  // SelfChangeIp 插件地址（productdetail.php 注入；未安装为空 → 隐藏入口）
  const selfChangeUrl = typeof window !== 'undefined' ? window.__CRA1_SELF_CHANGE_IP_URL__ : ''

  /* ---------------------------------------------------------------- 探测 */
  useEffect(() => {
    let alive = true
    setPhase('detect')
    Promise.all([
      get(`/theme/host/${hostId}`).then((r) => (r.data?.host?.id ? hostPayload(r.data) : null)).catch(() => null),
      /* 外层 HostDetailPage 已探测过则直接复用（避免同一实例详情重复请求） */
      initialDetected ? Promise.resolve(initialDetected) : detectServerModule(hostId),
    ]).then(([h, detected]) => {
      if (!alive) return
      if (!h) {
        setPhase('missing')
        return
      }
      setHost(h)
      window.dispatchEvent(new CustomEvent('cra1:page-title', {
        detail: { name: h.product_name || h.name || `产品 #${h.id}` },
      }))
      if (!detected) {
        setPhase('fallback')
        onFallback?.(h)
        return
      }
      setModule(detected.module)
      setCloud(detected.detail)
      apiRef.current = createServerApi(detected.module, hostId)
      // 商品级配置（ssh_key 支持等，仅 mf_cloud 有该接口；失败不阻塞）
      if (detected.module === 'mf_cloud') {
        get(`/product/${h.product_id}/mf_cloud/order_page`).then((r) => {
          if (alive) setOrderCfg(r.data?.config || null)
        }).catch(() => {})
      }
      // 主题设置：服务器面板「订单记录」控制（会员中心快照；失败保持默认=显示）
      memberContentConfig().then((cfg) => {
        if (!alive) return
        if (cfg?.host_orders) {
          setHostOrders({
            enabled: Number(cfg.host_orders.enabled ?? 1) === 1 ? 1 : 0,
            fetch_page: Number(cfg.host_orders.fetch_page) || 100,
            fetch_max: Number(cfg.host_orders.fetch_max) || 1000,
          })
        }
        /* 工单入口（联系客服按钮跳转目标）：从快捷入口配置里找工单项 */
        const ticket = (cfg?.home_quick_links?.items || []).find(
          (it) => Number(it.enabled) === 1 && /ticket|工单/i.test(`${it.url || ''} ${it.label || ''}`)
        )
        if (ticket?.url) setSupportUrl(ticket.url.startsWith('/') ? ticket.url : `/${ticket.url}`)
      }).catch(() => {})
      setPhase('ok')
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId])

  const { controller: refresh, summary: readIssues } = usePanelRefresh({
    enabled: phase === 'ok', scope: `${module}:${hostId}`,
  })
  const readFailed = id => readIssues.some(issue => issue.id === id && issue.error)
  const readerScope = phase === 'ok' ? api : null
  const overviewScope = tab === 'overview' ? readerScope : null
  const cra1Scope = module === 'mf_cloud' ? overviewScope : null
  const read = (method, select = r => r.data) => async ({ signal }) =>
    select(await createServerApi(module, hostId, signal)[method]())
  const detailFingerprint = d => [d?.cpu, d?.memory, d?.bw, d?.flow, d?.image, d?.system_disk,
    d?.data_disk, d?.ip_num, d?.ipv6_num, d?.network_type, d?.vpc_private_ip, d?.security_group,
    d?.backup_num, d?.snap_num, d?.line, d?.peak_defence]
  usePanelReader({ controller: refresh, id: 'host', scope: readerScope, initialData: host, readOnMount: false,
    fetch: async ({ signal }) => {
      const r = await requestApi(`/theme/host/${hostId}`, { signal })
      if (!r.data?.host?.id) throw new Error('实例信息读取失败')
      return hostPayload(r.data)
    }, apply: setHost,
    fingerprint: h => [h?.due_time, h?.billing_cycle, h?.renew_amount, h?.status, h?.auto_release_time, h?.change_billing_cycle_id],
  })
  usePanelReader({ controller: refresh, id: 'detail', scope: readerScope, initialData: cloud, readOnMount: false,
    fetch: read('detail'), apply: setCloud, fingerprint: detailFingerprint,
  })
  usePanelReader({ controller: refresh, id: 'power', scope: readerScope,
    fetch: read('status'), apply: setPower, pending: d => ['operating', 'pending'].includes(d?.status),
    fingerprint: d => d?.status,
    onSettled: () => refresh.refresh(['usage']),
  })
  usePanelReader({ controller: refresh, id: 'remote', scope: readerScope, fetch: read('remoteSummary'), apply: setRemote })
  usePanelReader({ controller: refresh, id: 'ipv4', scope: overviewScope, fetch: read('ipList'), apply: setIps })
  usePanelReader({ controller: refresh, id: 'ipv6', scope: cra1Scope, fetch: read('ipv6List'), apply: setIpv6 })
  usePanelReader({ controller: refresh, id: 'usage', scope: cra1Scope, fetch: read('realData'), apply: setReal })
  usePanelReader({ controller: refresh, id: 'flow', scope: cra1Scope, fetch: read('flow'), apply: setFlow,
    fingerprint: d => [d?.total_num, d?.flow_packet?.total_size, d?.reset_flow_time],
    onSettled: () => refresh.refresh(['flowCurve']),
  })
  usePanelReader({ controller: refresh, id: 'flowCurve', scope: cra1Scope && flow ? cra1Scope : null,
    fetch: async ({ signal }) => (await createServerApi(module, hostId, signal).flowData({
      start_time: flowCycleStart(flow), end_time: Math.floor(Date.now() / 1000),
    })).data?.list || [], apply: setFlowCurve,
  })

  const onOperation = useCallback((type, context = {}) => {
    const policy = refreshForOperation(type, context)
    refresh.refresh(policy.once)
    const expected = {}
    if (type === 'power' && ['powerOn', 'powerOff', 'hardOff'].includes(context.action)) {
      expected.power = value => value?.status === (context.action === 'powerOn' ? 'on' : 'off')
    }
    if (type === 'power' && ['reboot', 'hardReboot'].includes(context.action)) {
      const sentAt = Date.now()
      expected.power = value => value?.status === 'on' && Date.now() - sentAt >= 4000
    }
    if (type === 'diskMount' && context.diskId) {
      expected.disks = list => list.some(d => d.id === context.diskId && Number(d.status) === context.status)
    }
    if (type === 'diskDelete' && context.diskId) expected.disks = list => !list.some(d => d.id === context.diskId)
    if (type === 'securityGroup') expected.detail = data => Number(data?.security_group?.id || 0) === context.securityGroupId
    if (type === 'upgradeElastic' && context.configuration) {
      expected.detail = data => Object.entries(context.configuration).filter(([, value]) => value !== undefined)
        .every(([key, value]) => String(key === 'image_id' ? data?.image?.id : data?.[key]) === String(value))
    }
    const onSettled = {}
    if (['resetPass', 'rescue', 'rescueExit', 'reinstall', 'bsRestore'].includes(type)) {
      onSettled.power = () => refresh.refresh(['remote', 'usage'])
    }
    if (type === 'vpc') onSettled.detail = () => refresh.refresh(['ipv4', 'ipv6'])
    if (type === 'upgradeElastic') onSettled.detail = () => refresh.refresh(['host', ...(context.resources || []).filter(id => ['usage', 'flowCurve'].includes(id))])
    if (['diskOrder', 'diskResize', 'bsConfig', 'defence', 'upgradePackage'].includes(type)) {
      onSettled.detail = () => refresh.refresh(['host', ...(type === 'upgradePackage' ? ['usage'] : [])])
    }
    refresh.refresh(policy.track, { track: true, expected, onSettled })
  }, [refresh])
  const openPayment = useCallback((id, operation, context) => {
    setPayOrder({ id, operation, context, hostId })
    // 下单只更新订单记录，资源在付款确认后追踪。
    refresh.refresh(['orders'])
  }, [refresh])
  usePaymentReturn(hostId, onOperation)
  const openDialog = value => {
    if (value?.type === 'loginInfo') refresh.refresh(['remote'])
    setDlg(value)
  }

  const appSupported=module==='mf_cloud' && !!window.__CRA1_RUNTIME__?.app_presets
  /* ---------------------------------------------------------- 能力开关 */
  const caps = useMemo(() => {
    const d = cloud || {}
    const cfg = d.config || {}
    const oc = orderCfg || {}
    return {
      manualManage: !!cfg.manual_manage,
      backup: d.backup_num > 0 || !!d.backup_mode,
      snapshot: d.snap_num > 0 || !!d.backup_mode,
      natAcl: (d.nat_acl_limit || 0) > 0,
      natWeb: (d.nat_web_limit || 0) > 0,
      firewall: !!(d.line && d.line.sync_firewall_rule),
      /* 实例是否按需计费（原版 isDemandFee = hostData.billing_cycle === 'on_demand'） */
      onDemand: host?.billing_cycle === 'on_demand',
      /* 按需三开关来自 host.product_on_demand（HostModel.php:1722-1736 组装，默认全 0）
         —— cloud.product_on_demand 恒不存在，此前误读导致功能永不显示 */
      autoDelete: Number(host?.product_on_demand?.client_auto_delete || 0) === 1,
      toDuration: Number(host?.product_on_demand?.on_demand_to_duration || 0) === 1,
      toOnDemand: Number(host?.product_on_demand?.duration_to_on_demand || 0) === 1,
      /* SSH 密钥支持来自 order_page config（实测 mf_cloud detail config 不含 support_ssh_key）；
         原版重装门控：configObj.support_ssh_key === 1 && cra1Config.manual_manage === 0 */
      sshKey: Number(oc.support_ssh_key || 0) === 1 && !Number(cfg.manual_manage || 0),
      /* 重装端口规则（order_page config）：0=默认 1=随机区间 2=指定系统固定 3=下单可选 */
      portMode: Number(oc.rand_ssh_port ?? 0),
      portCfg: {
        start: oc.rand_ssh_port_start,
        end: oc.rand_ssh_port_end,
        windows: oc.rand_ssh_port_windows,
        linux: oc.rand_ssh_port_linux,
      },
      simulate: module === 'mf_cloud' && Number(cfg.simulate_physical_machine_enable || 0) === 1,
      /* 当前计费周期是否允许申请停用；allow_refund 仅决定能否退款。 */
      unsubscribe: !!window.__CRA1_RUNTIME__?.features?.refund && Number(d.support_apply_for_suspend ?? 1) === 1,
      /* 转按需申请中（>0 表示已提交转按需订单，原版模板据此显示「到期后转按需 + 取消转换」） */
      changeCycleId: Number(host?.change_billing_cycle_id || 0),
      /* 线路带宽计费（转按需仅支持 bw 线路：原版 tranferDemand 条件 bill_type === 'bw'） */
      lineBillBw: d.line?.bill_type === 'bw',
    }
  }, [cloud, host, orderCfg, module])

  /* ------------------------------------------------------- 电源动作执行 */
  /** 执行电源/操作类指令；返回 true 表示成功（调用方据此关闭弹窗）。
   *  需要操作密码时不抛错，改为在弹窗上置 needPassword 保留输入框。 */
  const runPower = async (action, extra) => {
    if (!api) return false
    setBusy(true)
    try {
      await api[action](extra || {})
      toast('指令已下发，等待实例响应', 'success')
      setDlg(null)
      // 指令已接收，独立跟踪实例状态；稳定后再读取用量。
      setPower({ status: 'operating', desc: '' })
      onOperation('power', { action })
      return true
    } catch (e) {
      if (e?.data?.data?.operate_password === 1) {
        // 需要操作密码：保留弹窗、显示密码输入框（函数式更新避免闭包旧值）
        setDlg((d) => ({ ...(d || {}), needPassword: true, pending: action }))
        toast('该操作需要验证操作密码', 'warning')
        return false
      }
      toast(e.message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const openVnc = async () => {
    if (!api) return
    setBusy(true)
    try {
      const r = await api.vnc({})
      const url = r.data?.url || r.data?.vnc_url
      if (url) window.open(url, '_blank')
      else toast('未获取到控制台地址', 'error')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  /* ------------------------------------------------------------ 渲染 */
  if (phase === 'detect') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Skeleton className="h-56 lg:col-span-8" />
          <Skeleton className="h-56 lg:col-span-4" />
        </div>
      </div>
    )
  }
  if (phase === 'missing') {
    return (
      <Card>
        <CardContent className="p-5">
          <EmptyState icon={CircleAlert} title="产品不存在" description="该产品不存在或无权访问。" />
        </CardContent>
      </Card>
    )
  }
  // phase === 'fallback'：外层（HostDetailPage）负责渲染旧版三段式布局
  if (phase !== 'ok') return null

  const hStatus = HOST_STATUS[host.status] || { label: host.status, tone: 'default' }
  const pState = POWER_STATE[power.status] || POWER_STATE.pending
  // 主 IP：优先 /ip 列表，回退 detail 的 ip 字段（string 或 array）
  const primaryIp = ips?.list?.[0]?.ip
    || (Array.isArray(cloud?.ip) ? cloud.ip[0] : cloud?.ip)
    || ''
  const dc = cloud?.data_center || {}
  const image = cloud?.image || {}
  const due = remainDays(host.due_time)
  const isWin = /win/i.test(image.name || '')

  return (
    <PanelRefreshContext.Provider value={refresh}>
    <div className="server-panel space-y-4 pb-2">
      {/* 面板内下单统一支付 */}
      <PayDialog
        orderId={payOrder}
        onClose={() => setPayOrder(null)}
        onPaid={() => onOperation(payOrder?.operation || 'unknownOrder', payOrder?.context)}
      />

      <ServerPanelDialogs
        dlg={dlg}
        setDlg={setDlg}
        host={host}
        cloud={cloud}
        module={module}
        caps={caps}
        api={api}
        busy={busy}
        setBusy={setBusy}
        ips={ips}
        selfChangeUrl={selfChangeUrl}
        remote={remote}
        power={power}
        runPower={runPower}
        openVnc={openVnc}
        onOpenPay={openPayment}
        onOperation={onOperation}
      />

      <PageHeader
        title={<CopyText value={host.name || host.product_name} className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand" />}
        description={host.product_name}
        actions={
          <>
            <Badge tone={hStatus.tone}>{hStatus.label}</Badge>
            {(host.notes || host.client_notes) ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">备注：{host.notes || host.client_notes}</span>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setDlg({ type: 'notes' })}>编辑备注</Button>
          </>
        }
      />

      {/* 非正常态提示（对齐旧布局：暂停原因 / 开通失败） */}
      {host.status === 'Suspended' ? (
        <Alert tone="warning">
          该产品已暂停。{host.suspend_reason ? `原因：${host.suspend_reason}` : '请查看账单或联系客服了解详情。'}
        </Alert>
      ) : null}
      {host.status === 'Failed' ? (
        <Alert tone="error">
          实例开通失败，请检查配置或联系管理员处理后重新开通。
        </Alert>
      ) : null}

      <BentoGrid>
        {/* ---------------- 英雄区：状态 + 电源 + IP + 配置 ---------------- */}
        <BentoCell colSpan="lg:col-span-8">
          <SpotlightCard className="h-full">
            <div className="relative p-5">
              <HeroGridBg />
              {/* 左：服务器配置信息；右上：按钮堆叠（不换行落左） */}
              <div className="relative flex flex-col-reverse items-start gap-4 sm:flex-row sm:flex-nowrap sm:justify-between sm:gap-3">
                {/* 左：配置信息区（占据剩余宽度） */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={hStatus.tone}>{hStatus.label}</Badge>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-alt px-2.5 py-0.5 text-xs text-body">
                      <PulseDot tone={pState.tone} />
                      {pState.label}
                      {/* 上游 desc 仅在过渡/异常态展示（运行/关机态的 desc 常与语义重复） */}
                      {['operating', 'pending', 'fault', 'suspend'].includes(power.status) && power.desc && power.desc !== pState.label
                        ? <span className="text-muted">· {power.desc}</span>
                        : null}
                    </span>
                    {dc.country || dc.city ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {dc.iso ? (
                          <img
                            src={`/upload/common/country/${dc.iso}.png`}
                            alt=""
                            className="h-3.5 w-5 rounded-[2px] object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        ) : null}
                        <MapPin className="size-3.5" />
                        {[dc.country, dc.city, dc.area].filter(Boolean).join(' · ')}
                      </span>
                    ) : null}
                    {cloud?.line?.name ? (
                      <span className="rounded-full border border-line bg-surface-alt px-2 py-0.5 text-xs text-body">
                        {cloud.line.name}
                      </span>
                    ) : null}
                    {cloud?.network_type === 'vpc' ? (
                      <span className="rounded-full border border-line bg-surface-alt px-2 py-0.5 text-xs text-body">VPC 网络</span>
                    ) : null}
                  </div>

                  {/* IP 区（主 IP 大字等宽 + 一键复制） */}
                  <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    {primaryIp ? (
                      <div>
                        <p className="text-xs text-muted-foreground">主 IP 地址</p>
                        <button
                          type="button"
                          className="group/ip mt-0.5 inline-flex items-center gap-2 font-mono text-xl font-semibold tracking-tight text-ink"
                          onClick={async () => {
                            const ok = await copyToClipboard(primaryIp)
                            toast(ok ? 'IP 已复制' : '复制失败，请手动复制', ok ? 'success' : 'error')
                          }}
                        >
                          {primaryIp}
                          <Copy className="size-3.5 text-muted transition-colors group-hover/ip:text-brand" />
                        </button>
                      </div>
                    ) : null}
                    {cloud?.vpc_private_ip ? (
                      <div>
                        <p className="text-xs text-muted-foreground">内网 IP</p>
                        <p className="mt-0.5 font-mono text-sm text-body">{cloud.vpc_private_ip}</p>
                      </div>
                    ) : null}
                    {image.name ? (
                      <div>
                        <p className="text-xs text-muted-foreground">操作系统</p>
                        <p className="mt-0.5 text-sm text-body">{image.name}</p>
                      </div>
                    ) : null}
                  </div>

                  {/* 配置摘要 chips */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Chip icon={Cpu} label="CPU" value={cloud?.cpu ? `${cloud.cpu} 核` : null} />
                    <Chip icon={MemoryStick} label="内存" value={cloud?.memory ? `${cloud.memory} GB` : null} />
                    <Chip icon={HardDrive} label="系统盘" value={cloud?.system_disk?.size ? `${cloud.system_disk.size} GB ${cloud.system_disk.type || ''}` : null} />
                    <Chip icon={Wifi} label="带宽" value={cloud?.bw ? `${cloud.bw} Mbps` : null} />
                    {cloud?.flow ? <Chip icon={Activity} label="月流量" value={`${cloud.flow} GB`} /> : null}
                    <Chip icon={HardDrive} label="数据盘" value={cloud?.data_disk?.count ? `${cloud.data_disk.count} 块 / ${cloud.data_disk.total_size} GB` : null} />
                  </div>
                </div>

                {/* 保留常用入口，其他操作集中到实例操作；手机端同样为两列。 */}
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-64">
                  {caps.manualManage ? (
                    <Alert tone="info" className="text-xs sm:max-w-none">该实例由管理员手动管理</Alert>
                  ) : (
                    <>
                      {/* 行1：VNC 控制台 + 登录信息（用户要求同行） */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button permission="action:control" size="sm" onClick={openVnc} disabled={busy}>
                          <MonitorPlay className="size-4" />
                          VNC 控制台
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openDialog({ type: 'loginInfo' })}>
                          <KeyRound className="size-4" />
                          登录信息
                        </Button>
                      </div>
                      {/* 行2：升降级 + 实例操作 */}
                      <div className="grid grid-cols-2 gap-2">
                        <Guard permission="action:billing"><UpgradeMenu module={module} caps={caps} host={host} setDlg={setDlg} /></Guard>
                        <InstanceActionsMenu key={`${module}:${host.id}`} api={api} power={power} busy={busy} setDlg={setDlg} module={module} caps={caps} isWin={isWin} host={host} remote={remote} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </SpotlightCard>
        </BentoCell>

        {/* ---------------- 到期 / 续费（流光边框） ---------------- */}
        <BentoCell colSpan="lg:col-span-4">
          <SpotlightCard className="h-full">
            <div className="relative p-5">
              <BorderBeam size={72} duration={7} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-body">
                    <CalendarClock className="mr-1.5 inline size-4 text-brand" />
                    到期时间
                  </p>
                </div>
                <p className={cn('mt-1.5 text-xl font-semibold tabular-nums', due !== null && due < 0 ? 'text-danger' : 'text-ink')}>
                  {host.due_time ? formatDate(host.due_time) : '--'}
                </p>
                <p className={cn('mt-1 text-xs', due !== null && due <= 7 ? 'text-warning' : 'text-muted-foreground')}>
                  {due === null
                    ? ''
                    : due < 0
                      ? `已过期 ${-due} 天，请尽快续费`
                      : `剩余 ${due} 天`}
                </p>

                <div className="mt-4 flex items-end justify-between gap-3 rounded-lg border border-line bg-surface-alt px-3 py-2.5">
                  <div>
                    <p className="text-xs text-muted-foreground">续费金额 / {host.billing_cycle_name || host.billing_cycle || '周期'}</p>
                    <p className="mt-0.5 text-lg font-semibold text-ink tabular-nums">
                      <NumberTicker value={Number(host.renew_amount || 0)} decimals={2} prefix={commonData().currency_prefix || ''} suffix={commonData().currency_suffix || ''} />
                    </p>
                  </div>
                </div>

                <div className="server-renew-actions">
                  {host.status === 'Unpaid' ? (
                    <Button permission="action:billing" size="sm" className="server-renew-manual" onClick={() => { location.href = '/finance.htm?order_status=Unpaid' }}>
                      <Wallet className="size-4" />
                      去支付
                    </Button>
                  ) : window.__CRA1_RUNTIME__?.features?.renew ? (
                    <Button permission="action:billing" size="sm" className="server-renew-manual" disabled={host.renew_forbidden === 1} onClick={() => setDlg({ type: 'renew' })}>
                      <RefreshCw className="size-4" />
                      续费
                    </Button>
                  ) : null}
                  {window.__CRA1_RUNTIME__?.features?.renew && <Guard permission="action:billing"><AutoRenewControl key={host.id} api={api} disabledReason={
                    ['onetime', 'on_demand'].includes(host.billing_cycle)
                      ? '一次性或按需计费的实例不支持自动续费' : ''
                  } /></Guard>}
                </div>
                {Number(host.auto_release_time) > 0 || (due !== null && due < 0) ? (
                  <p className="mt-2 flex items-start gap-1 text-xs leading-5 text-danger">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 break-words">{Number(host.auto_release_time) > 0
                      ? `已设置于 ${releaseTimeText(host.auto_release_time)} 自动删除；余额充足也会执行，数据不可恢复。`
                      : '实例已逾期'}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </SpotlightCard>
        </BentoCell>
      </BentoGrid>

      {/* 标签页：概览 | 监控 | 操作日志 | 订单记录（末项受主题后台开关控制） */}
      <div className="cui-tabs flex flex-wrap" role="tablist" aria-label="服务器信息">
        {(hostOrders.enabled
          ? [['overview', '概览'], ['monitor', '监控'], ['logs', '操作日志'], ['orders', '订单记录']]
          : [['overview', '概览'], ['monitor', '监控'], ['logs', '操作日志']]
        ).concat(appSupported?[['applications','应用管理']]:[]).filter(([k])=>k!=='orders'||can('Order::list')).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            role="tab"
            aria-selected={tab === k}
            className="cui-tabs__trigger"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'applications' && appSupported ? <AppPresetTasks hostId={hostId} onInstall={()=>setDlg({type:'reinstall'})}/> : tab === 'monitor' ? (
        <MonitoringTab api={api} hostId={hostId} />
      ) : tab === 'logs' ? (
        <LogTab api={api} supportUrl={supportUrl} />
      ) : tab === 'orders' && hostOrders.enabled && can('Order::list') ? (
        <OrderTab
          api={api} host={host} toast={toast}
          fetchPage={hostOrders.fetch_page} fetchMax={hostOrders.fetch_max}
          supportUrl={supportUrl}
          onOpenPay={(id, amount, order) => { openPayment(id, orderOperation(order)); setPayOrder(p => ({ ...p, amount })) }}
        />
      ) : (
        <>
      {/* ---------------- 实时占用 + 流量（监控图表见「监控」标签页） ---------------- */}
      <BentoGrid>
        <BentoCell colSpan="lg:col-span-5">
          <UsageCard real={real} module={module} host={host} cloud={cloud} setDlg={setDlg} caps={caps} error={readFailed('usage')} onRetry={() => refresh.refresh(['usage'])} />
        </BentoCell>
        <BentoCell colSpan="lg:col-span-7">
          <TrafficCard flow={flow} curve={flowCurve} module={module} error={readFailed('flow')} curveError={readFailed('flowCurve')} onRetry={() => refresh.refresh(['flow', 'flowCurve'])} onBuy={window.__CRA1_RUNTIME__?.features?.flow_packet ? () => setDlg({type:'flowPacket'}) : null} />
        </BentoCell>
      </BentoGrid>

      {/* ---------------- 管理：网络 / 磁盘 / 备份 / 操作 ---------------- */}
      <BentoGrid>
        <BentoCell colSpan="lg:col-span-6">
          <NetworkCard
            api={api} module={module} caps={caps} ips={ips || {list:[]}} ipsKnown={ips !== null} ipsError={readFailed('ipv4')} onRetryIps={() => refresh.refresh(['ipv4'])} ipv6={ipv6} cloud={cloud}
            host={host} setDlg={setDlg} toast={toast} selfChangeUrl={selfChangeUrl}
          />
        </BentoCell>
        {module === 'mf_cloud' ? (
          <BentoCell colSpan="lg:col-span-6">
            <DiskCard api={api} module={module} caps={caps} cloud={cloud} setDlg={setDlg} toast={toast} onChanged={onOperation} supportUrl={supportUrl} />
          </BentoCell>
        ) : null}
        {module === 'mf_cloud' ? (
          <BentoCell colSpan="lg:col-span-6">
            <SecurityGroupCard api={api} cloud={cloud} host={host} setDlg={setDlg} toast={toast} onChanged={onOperation} supportUrl={supportUrl} />
          </BentoCell>
        ) : null}
        {caps.backup || caps.snapshot ? (
          <BentoCell colSpan="lg:col-span-6">
            <BackupCard api={api} module={module} caps={caps} cloud={cloud} setDlg={setDlg} toast={toast} onChanged={onOperation} supportUrl={supportUrl} />
          </BentoCell>
        ) : null}
      </BentoGrid>
        </>
      )}
    </div>
    </PanelRefreshContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */
/* 小组件                                                                      */
/* -------------------------------------------------------------------------- */

function Chip({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-body">
      <Icon className="size-3.5 text-brand" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </span>
  )
}

/** 升降级下拉：套餐升降级（recommend_config）与弹性升降级（order_page 档位）分离 */
function UpgradeMenu({ module, caps, host, setDlg }) {
  if (module !== 'mf_cloud') return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" aria-label="升降级" className="flex-1">
          <ArrowUpDown className="size-4" />
          升降级
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem permission="action:billing" onClick={() => setDlg({ type: 'upgradePackage' })}>
          <ArrowUpDown className="mr-2 size-3.5" />
          套餐升降级
        </DropdownMenuItem>
        <DropdownMenuItem permission="action:billing" onClick={() => setDlg({ type: 'upgradeElastic' })}>
          <Activity className="mr-2 size-3.5" />
          弹性升降级
        </DropdownMenuItem>
        {/* 计费模式转换按商品开关显隐（对齐原版 product_detail.html:368-384）：
            按需→包月：on_demand_to_duration=1 且未在转换中且带宽计费且未同步防火墙；
            包月→按需：duration_to_on_demand=1 且未在转换中 */}
        {caps.onDemand && caps.toDuration && !caps.changeCycleId && caps.lineBillBw && !caps.firewall ? (
          <DropdownMenuItem permission="action:billing" onClick={() => setDlg({ type: 'billingConvert' })}>
            <Wallet className="mr-2 size-3.5" />
            转为包年包月
          </DropdownMenuItem>
        ) : null}
        {!caps.onDemand && caps.toOnDemand && !caps.changeCycleId ? (
          <DropdownMenuItem permission="action:billing" onClick={() => setDlg({ type: 'billingConvert' })}>
            <Wallet className="mr-2 size-3.5" />
            转为按需计费
          </DropdownMenuItem>
        ) : null}
        {!caps.onDemand && caps.changeCycleId ? (
          <DropdownMenuItem permission="action:billing" onClick={() => setDlg({ type: 'billingConvert' })}>
            <Wallet className="mr-2 size-3.5" />
            取消转按需
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------------- 实时占用（RadialBar × 2） ---------------- */
function ResourceReadState({ label, error, onRetry }) {
  return <div className="py-4 text-center text-xs text-muted-foreground" role="status">
    <p>{error ? `暂时无法读取${label}，请稍后重试` : `正在读取${label}…`}</p>
    {error && <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>重试</Button>}
  </div>
}

function UsageCard({ real, module, host, cloud, setDlg, caps, error, onRetry }) {
  const cpu = Number(real?.cpu_usage)
  const mem = Number(real?.memory_usage)
  const ok = module === 'mf_cloud' && real && cpu >= 0
  const cpuVal = ok ? Math.min(cpu, 100) : 0
  const memVal = ok && mem >= 0 ? Math.min(mem, 100) : 0

  /* 基础信息（原实例属性融合于此；用户要求标题改「基础信息」、上下排列） */
  const attrRows = [
    ['产品', host?.product_name],
    ['计费周期', host?.billing_cycle_name || host?.billing_cycle],
    ['开通时间', host?.active_time ? formatDateTime(host.active_time) : null],
    ['到期时间', host?.due_time ? formatDateTime(host.due_time) : null],
    /* 自动释放行：开关开启（可设置）或已有释放时间（数据安全必须展示）时显示；
       开关关闭且无时间 → 整行隐藏（商品未开启时该功能不显示） */
    ['自动释放', (caps?.autoDelete || Number(host?.auto_release_time || 0) > 0)
      ? (Number(host?.auto_release_time) > 0 ? releaseTimeText(host.auto_release_time) : '未设置')
      : null],
    ['订单编号', host?.order_id ? `#${host.order_id}` : null],
    ['数据中心', cloud?.data_center ? [cloud.data_center.country, cloud.data_center.city, cloud.data_center.area].filter(Boolean).join(' · ') : null],
    ['镜像', cloud?.image?.name],
    ['网络类型', cloud?.network_type === 'vpc' ? 'VPC 专有网络' : cloud?.network_type === 'normal' ? '经典网络' : null],
    ['线路', cloud?.line?.name],
    ['CPU', cloud?.cpu ? `${cloud.cpu} 核` : null],
    ['内存', cloud?.memory ? `${cloud.memory} GB` : null],
    ['系统盘', cloud?.system_disk?.size ? `${cloud.system_disk.size} GB${cloud.system_disk.type ? ` (${cloud.system_disk.type})` : ''}` : null],
    /* SSH 行对齐原版 template:219-232：仅「已绑定密钥」或「救援模式密码存在」时显示 */
    ['SSH 密钥', cloud?.ssh_key?.id > 0 ? cloud.ssh_key.name : null],
    ['备注', host?.notes || host?.client_notes || null],
  ].filter(([, v]) => v)

  const bar = (label, val, color) => (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-ink">
          <NumberTicker value={val} decimals={0} suffix="%" />
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${val}%`, background: `linear-gradient(90deg, ${color}, ${color}bb)` }}
        />
      </div>
    </div>
  )

  return (
    <SpotlightCard className="h-full">
      <CHeader className="flex-row items-center justify-between pb-0">
        <CTitle className="flex items-center gap-1.5">
          <Info className="size-4 shrink-0 text-brand" />
          基础信息
        </CTitle>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDlg?.({ type: 'notes' })}>
          编辑备注
        </Button>
      </CHeader>
      <CardContent className="pt-2">
        {/* 上：占用（扁平化进度条） */}
        {ok ? (
          <div className="space-y-3">
            {bar('CPU', cpuVal, 'var(--cui-titanium)')}
            {bar('内存', memVal, '#06B6D4')}
            {ok && Number(real?.memory_total) > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                内存 {formatBytes(real.memory_usable * 1024 * 1024)} 可用 / {formatBytes(real.memory_total * 1024 * 1024)}
              </p>
            ) : null}
          </div>
        ) : !real && module === 'mf_cloud' ? <ResourceReadState label="实时占用" error={error} onRetry={onRetry} /> : (
          <p className="py-4 text-center text-xs text-muted-foreground">暂无实时占用数据</p>
        )}
        {/* 下：基础属性（上下排列） */}
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-line/70 pt-3 sm:grid-cols-2">
          {attrRows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/50 py-1">
              <dt className="shrink-0 text-xs text-muted-foreground">{k}</dt>
              {k === 'SSH 密钥' ? (
                <button
                  type="button"
                  onClick={() => { window.location.href = '/security_ssh.htm' }}
                  className="truncate text-xs font-medium text-brand hover:underline"
                  title="前往 SSH 密钥管理"
                >
                  {v} · 管理
                </button>
              ) : k === '自动释放' && caps?.autoDelete ? (
                <button
                  type="button"
                  onClick={() => setDlg?.({ type: 'autoRelease' })}
                  className="min-w-0 break-words text-right text-xs font-medium tabular-nums text-brand hover:underline"
                  title={`${v}，点击设置自动释放时间`}
                >
                  {v || '未设置'} · 设置
                </button>
              ) : (
                <dd className={cn('text-xs font-medium tabular-nums text-ink', k === '自动释放' ? 'min-w-0 break-words text-right' : 'truncate')}>{v}</dd>
              )}
            </div>
          ))}
          <HostCustomFields host={host}/>
        </dl>
      </CardContent>
    </SpotlightCard>
  )
}

/* ---------------- 流量卡（整月用量 + 全周期曲线 + 流量包） ---------------- */
function TrafficCard({ flow, curve, module, onBuy, error, curveError, onRetry }) {
  if (module !== 'mf_cloud') return null
  /* /flow 契约：total/used/leave 为带单位的展示字符串（"100GB"），
     total_num/used_num 为数值 GB（total_num=0 表示不限流量），
     reset_flow_time / timestamp 为云端真实周期边界，旧接口日期串兼容 */
  const unlimited = Number(flow?.total_num) === 0
  const usedNum = Number(flow?.used_num)
  const totalNum = Number(flow?.total_num)
  const pct = unlimited || !isFinite(totalNum) || totalNum <= 0 ? 0 : Math.min((usedNum / totalNum) * 100, 100)
  // flow_data：time 为日期串，in/out 为 B（接口 unit 字段）
  const data = (curve || []).map((p) => ({
    time: String(p.time || '').slice(5, 13),
    in: isFinite(Number(p.in)) ? Number((Number(p.in) / 1024 / 1024 / 1024).toFixed(3)) : 0,
    out: isFinite(Number(p.out)) ? Number((Number(p.out) / 1024 / 1024 / 1024).toFixed(3)) : 0,
  }))
  const usedText = isFinite(usedNum) ? `${usedNum.toFixed(2)} GB` : String(flow?.used ?? '--')
  const resetExact = formatFlowReset(flow)
  return (
    <SpotlightCard className="h-full">
      <CHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-0">
        <CTitle className="flex shrink-0 items-center gap-1.5">
          <Activity className="size-4 shrink-0 text-brand" />
          本月流量
        </CTitle>
        <div className="flex items-center gap-2">
          {flow?.flow_packet?.leave_size ? (
            <span className="whitespace-nowrap rounded-full border border-line bg-surface-alt px-2 py-0.5 text-xs text-body">
              临时流量包剩余：{flow.flow_packet.leave_size} GB
            </span>
          ) : null}
          {onBuy && <Button permission="action:billing" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onBuy}>
            购买流量包
          </Button>}
        </div>
      </CHeader>
      <CardContent className="pt-2">
        {!flow ? (
          <ResourceReadState label="流量数据" error={error} onRetry={onRetry} />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold tabular-nums text-ink">
                  {unlimited ? '不限流量' : usedText}
                </p>
                {!unlimited ? <p className="text-xs text-muted-foreground">/ {String(flow?.total ?? '--')}</p> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {resetExact ? `下次重置：${resetExact}` : ''}
              </p>
            </div>
            {!unlimited ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className={cn('h-full rounded-full transition-[width] duration-500', pct > 90 ? 'bg-danger' : 'bg-brand')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : null}
            {!unlimited ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                剩余 {String(flow?.leave ?? '--')}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">已用 {usedText}</p>
            )}
            <div className="mt-3 h-52 w-full">
              {data.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="flowIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--cui-titanium)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--cui-titanium)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="flowOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                      interval="preserveStartEnd"
                      minTickGap={48}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--color-line)' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                      tickFormatter={(v) => `${v}G`}
                      width={44}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v, k, item) => [`${v} GB`, item.dataKey === 'in' ? '入流量' : '出流量']} />} />
                    <Area type="monotone" dataKey="in" name="入流量" stroke="var(--cui-titanium)" strokeWidth={1.6} fill="url(#flowIn)" />
                    <Area type="monotone" dataKey="out" name="出流量" stroke="#06B6D4" strokeWidth={1.6} fill="url(#flowOut)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : curve === null ? <ResourceReadState label="流量曲线" error={curveError} onRetry={onRetry} /> : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">暂无曲线数据</div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </SpotlightCard>
  )
}
