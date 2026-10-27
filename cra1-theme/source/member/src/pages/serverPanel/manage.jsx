import {pluginLink} from '../../lib'
import { useAccess } from '../../ui/access'
import { ChoiceButton } from '../../ui/choice'
import { useMemo, useState } from 'react'
import {
  Globe, Network as NetIcon, ShieldCheck, HardDrive, DatabaseBackup, TerminalSquare,
  KeyRound, LifeBuoy, FileDown, Info, ArrowUpDown, RefreshCw, Plus, Trash2,
  MonitorPlay, Copy, Eye, EyeOff, Repeat, ArrowLeftRight, CheckCircle2, Loader2, ChevronDown, Check,
  Receipt, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import { Badge, EmptyState, Skeleton } from '../../ui/feedback'
import { SpotlightCard } from '../../ui/aceternity'
import { get, api as requestApi, formatDateTime, formatMoney } from '../../lib'
import { useToast } from '../../ui/toast'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { cn } from '../../ui/utils'
import { BS_STATUS, DISK_STATUS } from './format'
import { copyToClipboard } from './clipboard'
import { ConfirmDialog } from '../../ui/dialog'
import { usePanelResource } from './use-resource'

/**
 * 管理区卡片：网络 / 磁盘 / 备份快照 / 操作 / 属性 / 日志。
 * 数据就地拉取；写操作走 setDlg 打开对应弹窗（弹窗内完成后回调刷新）。
 */


/** 点击复制的文本（网络卡等处用）：有值才渲染 */
export function CopyText({ value, className }) {
  const toast = useToast()
  if (value === undefined || value === null || value === '' || value === '--') {
    return <span className={cn(className, 'text-muted-foreground')}>{value || '--'}</span>
  }
  return (
    <button
      type="button"
      title={`点击复制：${value}`}
      onClick={async () => {
        const ok = await copyToClipboard(value)
        toast(ok ? '已复制' : '复制失败，请手动复制', ok ? 'success' : 'error')
      }}
      className={cn('text-left transition-colors hover:text-brand', className)}
    >
      {value}
    </button>
  )
}

/**
 * 列表加载失败块：区分「加载失败」与「确实没有数据」。
 * 此前各卡片把失败静默吞成空数组 → 用户看到「暂无数据」，
 * 无法判断是接口出问题还是真的没有内容，也没有重试途径。
 *
 * 除重试外提供「联系支持」引导：重试无效时用户需要求助出口
 * （工单入口取自主题后台「首页快捷入口」配置里的工单项，未配置则用插件默认路径）。
 */
function LoadError({ onRetry, label = '加载失败', supportUrl }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-xs text-muted-foreground">{label}，请稍后重试</p>
      <div className="flex items-center gap-2">
        {onRetry ? (
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            重试
          </Button>
        ) : null}
        <Button
          size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-muted-foreground"
          onClick={() => { window.location.href = supportUrl || pluginLink('ticket') }}
        >
          <LifeBuoy className="size-3.5" />
          联系客服
        </Button>
      </div>
    </div>
  )
}

/* ---------------- 网络：IPv4/IPv6/VPC/安全组/NAT/IP防御 ---------------- */
export function NetworkCard({ api, module, caps, ips, ipsKnown = true, ipsError, onRetryIps, ipv6, cloud, host, setDlg, toast, selfChangeUrl, onChanged }) {
  const { data: vpcList, error: vpcError, load: loadVpc } = usePanelResource({
    id: 'vpc',
    scope: api && module === 'mf_cloud' && !caps.manualManage ? api : null,
    fetch: async ({ signal }) => (await api.withSignal(signal).vpcNetworkList()).data?.list || [],
  })


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <Globe className="size-4 shrink-0 text-brand" />
          网络
        </CardTitle>
        <div className="flex gap-2">
          {selfChangeUrl ? (
            <Button permission="addon\\self_change_ip\\controller\\clientarea\\IndexController::entry" size="sm" variant="outline" onClick={() => window.open(`${selfChangeUrl}?host_id=${host.id}`, '_self')}>
              <Repeat className="size-3.5" />
              更换 IP
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* IPv4 */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Globe className="size-3.5" />
            IPv4（{ipsKnown ? ips.list?.length || 0 : '—'}）
          </p>
          {!ipsKnown ? (ipsError ? <LoadError label="网络信息读取失败" onRetry={onRetryIps} /> : <p className="py-2 text-xs text-muted-foreground">正在读取网络信息…</p>) : ips.list?.length ? (
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <table className="w-full min-w-[380px] text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1.5 font-medium">IP 地址</th>
                    <th className="py-1.5 font-medium">子网掩码</th>
                    <th className="py-1.5 font-medium">网关</th>
                  </tr>
                </thead>
                <tbody>
                  {ips.list.map((x, i) => (
                    <tr key={i} className="border-t border-line/70">
                      <td className="py-1.5">
                        <CopyText value={x.ip} className="font-mono text-ink" />
                      </td>
                      <td className="py-1.5"><CopyText value={x.subnet_mask || '--'} className="font-mono text-body" /></td>
                      <td className="py-1.5"><CopyText value={x.gateway || '--'} className="font-mono text-body" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">暂无 IPv4</p>
          )}
        </div>

        {/* IPv6（无则整块隐藏） */}
        {module === 'mf_cloud' && ipv6.list?.length ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">IPv6（{ipv6.list.length}）</p>
            <div className="flex flex-wrap gap-1.5">
              {ipv6.list.map((x, i) => (
                <CopyText
                  key={i}
                  value={x.ip || x}
                  className="rounded-md border border-line bg-surface-alt px-2 py-0.5 font-mono text-xs text-body"
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* 网络类型与 VPC（经典网络显示经典网络；VPC 显示 VPC 与内网网段；无内容隐藏） */}
        {module === 'mf_cloud' && cloud?.network_type !== 'vpc' ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <NetIcon className="size-3.5" />
            网络类型：经典网络（公网 IP 直接绑定实例）
          </p>
        ) : null}
        {module === 'mf_cloud' && cloud?.network_type === 'vpc' ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <NetIcon className="size-3.5" />
                VPC 专有网络
              </p>
              {!caps.manualManage ? (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" permission="action:control" onClick={() => setDlg({ type: 'vpc' })}>
                  管理
                </Button>
              ) : null}
            </div>
            {vpcError && vpcList === null ? (
              <LoadError onRetry={loadVpc} label="网络信息暂时无法获取" />
            ) : vpcList === null ? (
              <Skeleton className="h-8 w-full" />
            ) : vpcList.length ? (
              <div className="space-y-1.5">
                {vpcList.map((v) => (
                  <div key={v.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md border border-line bg-surface-alt px-2 py-0.5 text-body">
                      {v.name || v.network_name || `VPC #${v.id}`}
                    </span>
                    {v.private_ip ? <CopyText value={v.private_ip} className="font-mono text-body" /> : null}
                    {v.cidr ? <CopyText value={v.cidr} className="font-mono text-muted-foreground" /> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-1 text-xs text-muted-foreground">未加入 VPC 网络</p>
            )}
            {cloud?.vpc_private_ip ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                内网 IP：<CopyText value={cloud.vpc_private_ip} className="font-mono text-ink" />
              </p>
            ) : null}
          </div>
        ) : null}

        {/* NAT / IP 防御 / 更换IP（安全组已独立成卡） */}
        <div className="flex flex-wrap gap-2 border-t border-line/70 pt-3">
          {caps.natAcl || caps.natWeb ? (
            <Button permission="action:control" size="sm" variant="outline" onClick={() => setDlg({ type: 'nat' })}>
              NAT 转发{caps.natWeb ? '/建站' : ''}
            </Button>
          ) : null}
          {caps.firewall ? (
            <Button size="sm" variant="outline" permission="action:billing" onClick={() => setDlg({ type: 'defence' })}>
              IP 防御
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------------- 磁盘：列表 / 挂载卸载 / 扩容 / 购盘 ---------------- */
export function DiskCard({ api, module, caps, cloud, setDlg, toast, onChanged, supportUrl }) {
  const {can} = useAccess()
  const [busyId, setBusyId] = useState(0)
  const [removing, setRemoving] = useState(null)
  const { data: list, error: loadErr, load } = usePanelResource({
    id: 'disks', pending: list => list.some(d => d.type2 === 'data' && [2, 3].includes(Number(d.status))),
    scope: api && !caps.manualManage && (module === 'mf_cloud' || module === 'mf_dcim') ? api : null,
    fetch: async ({ signal }) => (await api.withSignal(signal).diskList()).data?.list || [],
  })
  if (caps.manualManage) return null

  const toggleMount = async (d) => {
    if (!can('action:control') || busyId) return
    setBusyId(d.id)
    try {
      const mounted = Number(d.status) === 1
      await (mounted ? api.diskUnmount(d.id, {}) : api.diskMount(d.id, {}))
      toast(mounted ? '已卸载' : '已挂载', 'success')
      if (onChanged) onChanged('diskMount', { diskId: d.id, status: mounted ? 0 : 1 })
      else load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusyId(0)
    }
  }

  const removeFailed = async () => {
    if (!removing || busyId || !can('action:delete')) return
    setBusyId(removing.id)
    try {
      await api.deleteFailedDisk(removing.id)
      toast('已删除创建失败的磁盘记录', 'success')
      setRemoving(null)
      if (onChanged) onChanged('diskDelete', { diskId: removing.id })
      else load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusyId(0)
    }
  }

  return (
    <>
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <HardDrive className="size-4 shrink-0 text-brand" />
          磁盘
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" permission="action:billing" onClick={() => setDlg({ type: 'diskResize' })}>
            <ArrowUpDown className="size-3.5" />
            扩容
          </Button>
          <Button size="sm" variant="outline" permission="action:billing" onClick={() => setDlg({ type: 'diskOrder' })}>
            <Plus className="size-3.5" />
            购买磁盘
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadErr && list === null ? (
          <LoadError onRetry={load} label="磁盘列表加载失败" supportUrl={supportUrl} />
        ) : list === null ? (
          <Skeleton className="h-20 w-full" />
        ) : list.length === 0 ? (
          <EmptyState icon={HardDrive} title="暂无磁盘" description="实例尚未挂载磁盘。" />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">名称</th>
                  <th className="py-1.5 font-medium">容量</th>
                  <th className="py-1.5 font-medium">类型</th>
                  <th className="py-1.5 font-medium">状态</th>
                  <th className="py-1.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} className="border-t border-line/70">
                    <td className="py-2 text-ink">{d.name || `磁盘 #${d.id}`}</td>
                    <td className="py-2 tabular-nums text-body">{d.size} GB</td>
                    <td className="py-2 text-body">{d.type2 === 'system' ? '系统盘' : '数据盘'}{d.type ? ` · ${d.type}` : ''}</td>
                    <td className="py-2">
                      <span className={cn(
                        d.type2 === 'system' || Number(d.status) === 1 ? 'text-success' : Number(d.status) === 4 ? 'text-danger' : Number(d.status) === 0 ? 'text-muted-foreground' : 'text-warning',
                      )}>
                        {d.type2 === 'system' ? '使用中' : (DISK_STATUS[d.status] ?? '--')}
                      </span>
                      {Number(d.status) === 4 && d.failure_reason ? (
                        <span className="mt-0.5 block max-w-40 truncate text-muted-foreground" title={d.failure_reason}>{d.failure_reason}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right">
                      {d.type2 === 'data' && Number(d.status) === 4 && d.can_delete === true ? (
                        <Button permission="action:delete" size="sm" variant="ghost" className="h-7 px-2 text-xs text-danger" disabled={busyId !== 0}
                          aria-label={`删除创建失败的磁盘：${d.name || d.id}`} onClick={() => setRemoving(d)}>
                          <Trash2 className="size-3.5" />删除
                        </Button>
                      ) : d.type2 === 'data' && (Number(d.status) === 0 || Number(d.status) === 1) ? (
                        <Button
                          permission="action:control" size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={busyId === d.id}
                          onClick={() => toggleMount(d)}
                        >
                          {busyId === d.id ? <Loader2 className="size-3.5 animate-spin" /> : null}
                          {Number(d.status) === 1 ? '卸载' : '挂载'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">{Number(d.status) === 4 ? '待确认' : '不支持'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
    <ConfirmDialog
      open={Boolean(removing)} title="删除创建失败的磁盘？" tone="danger" confirmText="删除失败记录"
      description={`删除“${removing?.name || '该磁盘'}”的失败记录。不会操作服务器或已创建的磁盘，历史订单保留。`}
      busy={busyId !== 0} onConfirm={removeFailed} onCancel={() => { if (!busyId) setRemoving(null) }}
    />
    </>
  )
}

/* ---------------- 备份 / 快照 ---------------- */
export function BackupCard({ api, module, caps, cloud, setDlg, toast, supportUrl }) {
  const [tab, setTab] = useState(caps.backup ? 'backup' : 'snapshot')
  const scope = api && module === 'mf_cloud' ? api : null
  const { data: list, error: loadErr, load } = usePanelResource({
    id: tab, scope, activeInterval: 3000,
    pending: list => list.some(item => Number(item.status) === 0),
    fetch: async ({ signal }) => (await (tab === 'backup' ? api.withSignal(signal).backupList() : api.withSignal(signal).snapshotList())).data?.list || [],
  })

  const isBackup = tab === 'backup'
  const quotaLabel = isBackup
    ? `备份数量 ${cloud?.backup_num ?? '--'}`
    : `快照数量 ${cloud?.snap_num ?? '--'}`

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-y-2">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-1.5 whitespace-nowrap">
            <DatabaseBackup className="size-4 shrink-0 text-brand" />
            备份与快照
          </CardTitle>
          <div className="cui-tabs flex">
            {caps.backup ? (
              <button
                type="button"
                onClick={() => setTab('backup')}
                aria-pressed={tab === 'backup'} className="cui-tabs__trigger flex-1"
              >
                备份
              </button>
            ) : null}
            {caps.snapshot ? (
              <button
                type="button"
                onClick={() => setTab('snapshot')}
                aria-pressed={tab === 'snapshot'} className="cui-tabs__trigger flex-1"
              >
                快照
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{quotaLabel}</span>
          {/* A7：space 备份空间模式无数量概念（后端直接拒绝），隐藏数量调整 */}
          {cloud?.backup_mode !== 'space' || !isBackup ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" permission="action:billing" onClick={() => setDlg({ type: 'bsConfig', isBackup, usedBackup: isBackup ? list?.length ?? 0 : 0, usedSnap: !isBackup ? list?.length ?? 0 : 0 })}>
              数量调整
            </Button>
          ) : null}
          <Button size="sm" permission="action:control" onClick={() => setDlg({ type: 'bsCreate', isBackup, onDone: load })}>
            <Plus className="size-3.5" />
            创建{isBackup ? '备份' : '快照'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadErr && list === null ? (
          <LoadError onRetry={load} label={`${isBackup ? '备份' : '快照'}列表加载失败`} supportUrl={supportUrl} />
        ) : list === null ? (
          <Skeleton className="h-20 w-full" />
        ) : list.length === 0 ? (
          <EmptyState
            icon={DatabaseBackup}
            title={`暂无${isBackup ? '备份' : '快照'}`}
            description={`创建${isBackup ? '备份' : '快照'}后可在此还原或删除。`}
          />
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[420px] text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">名称</th>
                  <th className="py-1.5 font-medium">创建时间</th>
                  <th className="py-1.5 font-medium">状态</th>
                  <th className="py-1.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className="border-t border-line/70">
                    <td className="py-2 text-ink">{b.name || `#${b.id}`}</td>
                    <td className="py-2 tabular-nums text-body">{formatDateTime(b.create_time)}</td>
                    <td className="py-2">
                      <span className={b.status === 1 ? 'text-success' : 'text-warning'}>
                        {BS_STATUS[b.status] ?? '--'}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className="inline-flex gap-1">
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2 text-xs"
                          disabled={b.status !== 1}
                          permission="action:control" onClick={() => setDlg({ type: 'bsRestore', isBackup, item: b, onDone: load })}
                        >
                          还原
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 px-2 text-xs text-danger"
                          permission="action:delete" onClick={() => setDlg({ type: 'bsDelete', isBackup, item: b, onDone: load })}
                        >
                          删除
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------------- 安全组独立模块卡：当前绑定 + 规则列表 + 修改跳转 ---------------- */
/* 契约：GET /security_group/:id/rule → list[{description,direction,protocol,port,ip}]；
   修改规则 = 跳转该安全组自己的规则页 /group_rules.htm?id= */
const SG_DIRECTION = { in: '入方向', out: '出方向' }

export function SecurityGroupCard({ api, cloud, host, setDlg, toast, supportUrl }) {
  const bound = cloud?.security_group?.id ? cloud.security_group : null
  const { data: rules, error: rulesErr, load: loadRules } = usePanelResource({
    id: 'securityRules', scope: api && bound?.id ? `${host.id}:${bound.id}` : null,
    fetch: async ({ signal }) => (await requestApi(`/security_group/${bound.id}/rule`, { signal })).data?.list || [],
  })

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <ShieldCheck className={cn('size-4 shrink-0', bound ? 'text-success' : 'text-muted-foreground')} />
          安全组
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" permission="action:control" onClick={() => setDlg({ type: 'securityGroup' })}>
            {bound ? '更换绑定' : '绑定安全组'}
          </Button>
          {bound ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => { window.location.href = `/group_rules.htm?id=${bound.id}` }}
            >
              修改规则 →
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          {bound ? (
            <>当前绑定：<span className="font-medium text-ink">{bound.name || `安全组 #${bound.id}`}</span></>
          ) : (
            <>未绑定安全组（实例流量不经防火墙规则过滤）</>
          )}
        </p>
        {bound ? (
          rulesErr && rules === null ? (
            <div className="mt-3"><LoadError label="规则列表加载失败" onRetry={loadRules} supportUrl={supportUrl} /></div>
          ) : rules === null ? (
            <Skeleton className="mt-3 h-20 w-full" />
          ) : rules.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">该安全组暂无规则，全部流量默认放行或拒绝以实例配置为准。</p>
          ) : (
            <div className="-mx-1 mt-3 overflow-x-auto px-1">
              <table className="w-full min-w-[420px] text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1.5 font-medium">方向</th>
                    <th className="py-1.5 font-medium">协议</th>
                    <th className="py-1.5 font-medium">端口</th>
                    <th className="py-1.5 font-medium">来源/目标</th>
                    <th className="py-1.5 font-medium">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-t border-line/70">
                      <td className="py-1.5">
                        <span className={cn('rounded px-1.5 py-0.5 text-[11px]', r.direction === 'in' ? 'bg-brand/10 text-brand' : 'bg-surface-alt text-body')}>
                          {SG_DIRECTION[r.direction] || r.direction}
                        </span>
                      </td>
                      <td className="py-1.5 uppercase text-body">{r.protocol}</td>
                      <td className="py-1.5 font-mono text-body">{r.port || '--'}</td>
                      <td className="py-1.5 font-mono text-body">{r.ip || '--'}</td>
                      <td className="py-1.5 text-muted-foreground">{r.description || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  )
}

/* ---------------- 操作日志（独立标签页：全量取数 + 客户端精确分页） ---------------- */
/* 后端 SystemLogModel 的 count 硬编码为 100000000（非真实总数，系统核心文件不改），
   因此改为「一次拉取全量可见日志 + 客户端分页」：页数完全精确 ——
   有 N 页就渲染 N 个页码，最多展示 5 个，仅 1 页时只显示「1」。 */
const LOG_FETCH_CAP = 1000 // 单次拉取上限（足够覆盖单实例日志量级；超出时提示）

export function LogTab({ api, supportUrl }) {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const { data: all, error: loadErr, load } = usePanelResource({
    id: 'logs', scope: api, readOnMount: true,
    fetch: async ({ signal }) => (await api.withSignal(signal).log({ page: 1, limit: LOG_FETCH_CAP })).data?.list || [],
  })

  const total = all?.length || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const cur = Math.min(page, totalPages)
  const rows = (all || []).slice((cur - 1) * limit, cur * limit)

  const goto = (v) => {
    const n = Math.max(1, Math.min(Math.floor(Number(v) || 1), totalPages))
    setPage(n)
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5">
          <TerminalSquare className="size-4 shrink-0 text-brand" />
          操作日志
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          每页
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="每页条数">
                {limit} 条
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-28">
              {[10, 20, 50].map((n) => (
                <DropdownMenuItem key={n} data-selected={n === limit} onClick={() => { setLimit(n); setPage(1) }}>
                  {n === limit ? <Check className="mr-2 size-3.5" /> : <span className="mr-2 inline-block size-3.5" />}
                  {n} 条
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {loadErr && all === null ? (
          <LoadError label="日志加载失败" onRetry={load} supportUrl={supportUrl} />
        ) : all === null ? (
          <Skeleton className="h-40 w-full" />
        ) : total === 0 ? (
          <EmptyState icon={TerminalSquare} title="暂无日志" />
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-4 border-b border-line/50 pb-2 last:border-0">
                  <span className="min-w-0 text-xs leading-5 text-body">{l.description}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDateTime(l.create_time)}</span>
                </li>
              ))}
            </ul>
            {/* 分页：精确页数（最多 5 个页码，单页只显示 1） */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>共 {total} 条 · 第 {cur}/{totalPages} 页</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>上一页</Button>
                {visiblePages(cur, totalPages).map((n) => (
                  <ChoiceButton
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === cur ? 'page' : undefined}
                    selected={n === cur} className="cui-choice--page"
                  >
                    {n}
                  </ChoiceButton>
                ))}
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>下一页</Button>
                {totalPages > 5 ? (
                  <span className="inline-flex items-center gap-1">
                    跳至
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      defaultValue=""
                      onKeyDown={(e) => { if (e.key === 'Enter') { goto(e.target.value); e.target.value = '' } }}
                      className="h-7 w-16 text-xs"
                      aria-label="跳转页码"
                      placeholder="页码"
                    />
                    页
                  </span>
                ) : null}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** 页码窗口：总页数 ≤5 全显示；>5 显示当前页附近的 5 个（含首尾感知） */
function visiblePages(cur, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  let start = Math.max(1, cur - 2)
  let end = start + 4
  if (end > totalPages) {
    end = totalPages
    start = end - 4
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}


/* ================================ 订单记录 ================================ */

/* 取数条数不再硬编码：由主题后台「服务器面板 · 订单记录」配置下发
   （fetch_page 单次条数 / fetch_max 拉取上限），此处仅保留兜底默认值，
   保证快照不可用（后台未配置/改名/不可达）时行为与未配置前一致。 */
const ORDER_FETCH_PAGE_DEFAULT = 100
const ORDER_FETCH_MAX_DEFAULT = 1000

/** 订单类型 → 文案（order.type；对齐后台/前台口径） */
export const ORDER_TYPE_LABEL = {
  new: '新购',
  renew: '续费',
  upgrade: '升降级',
  artificial: '人工',
  on_demand: '按需',
  change_billing_cycle: '计费转换',
  combine: '合并账单',
  recharge: '充值',
}

/** 订单状态 → 文案 + 徽章色调（Unpaid/Paid/WaitUpload/WaitReview/ReviewFail/Cancelled/Refunded） */
const ORDER_STATUS_META = {
  Unpaid: { label: '未支付', tone: 'warning' },
  Paid: { label: '已支付', tone: 'success' },
  WaitUpload: { label: '待上传', tone: 'warning' },
  WaitReview: { label: '待审核', tone: 'default' },
  ReviewFail: { label: '审核失败', tone: 'danger' },
  Cancelled: { label: '已取消', tone: 'default' },
  Refunded: { label: '已退款', tone: 'default' },
}

/**
 * 订单记录标签页。
 * 数据来源（三路并集，按订单 id 去重）：
 *  ① host_id 精确过滤：覆盖所有订单子项绑定了本机的订单
 *     （新购/续费/升降级/计费转换/插件创建的人工订单——它们的 order_item.host_id 均写入本机 ID）；
 *  ② 人工订单类型拉取（type=artificial）：后台手动创建的人工订单不绑定 host_id，
 *     需在前端按主机标识做文本匹配（后端 keywords 只搜 host.name，不搜 order_item.description，
 *     故不能依赖它覆盖这一场景）；
 *  ③ 与 ①② 天然按「是否绑定机器 ID」分区，去重后无重复。
 * 快捷支付：仅 status === 'Unpaid'（已取消/已删除订单后台列表本就排除，双保险再判一次）。
 */
export function OrderTab({ api, host, toast, onOpenPay, fetchPage, fetchMax, supportUrl }) {
  const tx = useToast()
  const notify = toast || tx
  const hostName = host?.name || ''
  /* 后台配置的取数条数（钳制到与后端 normalizeContent 相同的区间，双保险） */
  const pageSize = Math.max(10, Math.min(200, Number(fetchPage) || ORDER_FETCH_PAGE_DEFAULT))
  const maxSize = Math.max(pageSize, Math.max(100, Math.min(5000, Number(fetchMax) || ORDER_FETCH_MAX_DEFAULT)))
  /* 筛选（本地过滤，不重新请求）：状态 + 类型 */
  const [filterStatus, setFilterStatus] = useState('') // '' = 全部
  const [filterType, setFilterType] = useState('')     // '' = 全部
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const { data: result, error: loadErr, load } = usePanelResource({
    id: 'orders', scope: api, readOnMount: true,
    fetch: async ({ signal }) => {
      const reader = api.withSignal(signal)
    /* 分页拉取某条件下的全部订单：按页累加，取完（或达安全上限）为止。
       典型情况（单机订单 <100）只需 1 次请求；超量时才逐页拉，避免"看起来只有 100 条"。 */
    const fetchAllOrders = async (params) => {
      const acc = []
      let total = Infinity
      let page = 1
      let failed = false
      while (acc.length < Math.min(total, maxSize)) {
        const r = await reader.orderList({ ...params, page, limit: pageSize }).catch(() => { failed = true; return null })
        const list = r?.data?.list || []
        total = Number(r?.data?.count ?? acc.length + list.length)
        acc.push(...list)
        if (list.length < pageSize) break
        page += 1
      }
      return { list: acc.slice(0, maxSize), truncated: total > maxSize, failed }
    }
    /* ① 按机器 ID 精确过滤；
       ② 人工订单单独拉取，前端按「描述/产品标识含主机标识」匹配（覆盖未绑定 ID 的后台人工订单） */
    const jobs = [
      fetchAllOrders({ host_id: host.id }),
      hostName ? fetchAllOrders({ type: 'artificial' }) : Promise.resolve({ list: [], truncated: false }),
    ]
    const [byHostId, artificial] = await Promise.all(jobs)
    if (byHostId.failed || artificial.failed) throw new Error('订单记录读取失败')
    {
      const seen = new Set()
      const merged = []
      for (const o of (byHostId?.list || [])) {
        if (!o || seen.has(o.id)) continue
        seen.add(o.id)
        merged.push(o)
      }
      /* 人工订单：仅保留描述/标识里提到本机标识的（无标识时跳过该路，避免把他机人工单也带进来） */
      if (hostName) {
        for (const o of (artificial?.list || [])) {
          if (!o || seen.has(o.id)) continue
          const text = `${o.description || ''} ${o.host_name || ''} ${(o.product_names || []).join(' ')}`
          if (!text.includes(hostName)) continue
          seen.add(o.id)
          merged.push(o)
        }
      }
      /* 仅当达安全上限（1000）才提示截断——正常单机订单量不会触发 */
      merged.sort((a, b) => Number(b.create_time || 0) - Number(a.create_time || 0))
      return { list: merged, truncated: !!(byHostId?.truncated || artificial?.truncated) }
    }
    },
  })
  const all = result?.list ?? null
  const truncated = result?.truncated || false

  /* 本地筛选（数据已全量拉取，切换筛选不需要重新请求） */
  const filtered = useMemo(() => {
    let list = all || []
    if (filterStatus) list = list.filter((o) => o.status === filterStatus)
    if (filterType) list = list.filter((o) => o.type === filterType)
    return list
  }, [all, filterStatus, filterType])
  /* 状态/类型选项：只列出当前数据里实际出现的值（避免大量空选项） */
  const statusOptions = useMemo(() => [...new Set((all || []).map((o) => o.status).filter(Boolean))], [all])
  const typeOptions = useMemo(() => [...new Set((all || []).map((o) => o.type).filter(Boolean))], [all])
  const filtering = !!(filterStatus || filterType)

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const cur = Math.min(page, totalPages)
  const rows = filtered.slice((cur - 1) * limit, cur * limit)

  const goto = (v) => {
    const n = Math.max(1, Math.min(Math.floor(Number(v) || 1), totalPages))
    setPage(n)
  }

  /* 已取消/已删除不可支付：后台列表已排除这两类，此处再判一次（防并发下的边界） */
  const payable = (o) => o.status === 'Unpaid'

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-1.5">
          <Receipt className="size-4 shrink-0 text-brand" />
          订单记录
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {/* 筛选：状态 + 类型（本地过滤，数据已全量拉取；选项只列实际出现的值） */}
          {all && all.length > 0 ? (
            <>
              {statusOptions.length > 1 ? (
                <Select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
                  size="sm" className="w-auto min-w-[112px]"
                  aria-label="按状态筛选"
                >
                  <option value="">全部状态</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{(ORDER_STATUS_META[s] || {}).label || s}</option>
                  ))}
                </Select>
              ) : null}
              {typeOptions.length > 1 ? (
                <Select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
                  size="sm" className="w-auto min-w-[112px]"
                  aria-label="按类型筛选"
                >
                  <option value="">全部类型</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{ORDER_TYPE_LABEL[t] || t}</option>
                  ))}
                </Select>
              ) : null}
              {filtering ? (
                <Button
                  size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => { setFilterStatus(''); setFilterType(''); setPage(1) }}
                >
                  清除筛选
                </Button>
              ) : null}
            </>
          ) : null}
          每页
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="每页条数">
                {limit} 条
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-28">
              {[10, 20, 50].map((n) => (
                <DropdownMenuItem key={n} data-selected={n === limit} onClick={() => { setLimit(n); setPage(1) }}>
                  {n === limit ? <Check className="mr-2 size-3.5" /> : <span className="mr-2 inline-block size-3.5" />}
                  {n} 条
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {loadErr && all === null ? (
          <LoadError label="订单记录加载失败" onRetry={load} supportUrl={supportUrl} />
        ) : all === null ? (
          <Skeleton className="h-40 w-full" />
        ) : total === 0 ? (
          /* 区分「本来就没有订单」与「筛选后无匹配」 */
          filtering ? (
            <EmptyState
              icon={Receipt} title="没有符合条件的订单"
              description="试试调整筛选条件，或点击「清除筛选」查看全部。"
              action={<Button size="sm" variant="outline" onClick={() => { setFilterStatus(''); setFilterType(''); setPage(1) }}>清除筛选</Button>}
            />
          ) : (
            <EmptyState icon={Receipt} title="暂无订单记录" description="该服务器还没有关联的订单。" />
          )
        ) : (
          <>
            {truncated ? (
              <p className="mb-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-1.5 text-xs text-warning">
                订单量较多，仅展示最近 {maxSize} 条；完整记录请前往「财务」页查看。
              </p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">订单号</th>
                    <th className="py-2 pr-3 font-medium">类型</th>
                    <th className="py-2 pr-3 font-medium">描述</th>
                    <th className="py-2 pr-3 font-medium">金额</th>
                    <th className="py-2 pr-3 font-medium">状态</th>
                    <th className="py-2 pr-3 font-medium">创建时间</th>
                    <th className="py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => {
                    const meta = ORDER_STATUS_META[o.status] || { label: o.status, tone: 'default' }
                    return (
                      <tr key={o.id} className="border-b border-line/50 last:border-0">
                        <td className="py-2 pr-3 font-medium tabular-nums text-ink">#{o.id}</td>
                        <td className="py-2 pr-3">
                          <Badge tone="default">{ORDER_TYPE_LABEL[o.type] || o.type || '--'}</Badge>
                        </td>
                        <td className="max-w-[260px] py-2 pr-3">
                          <span className="block truncate text-body" title={o.description || o.host_name || ''}>
                            {o.description || o.host_name || '--'}
                          </span>
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-ink">{formatMoney(o.amount)}</td>
                        <td className="py-2 pr-3">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">{formatDateTime(o.create_time)}</td>
                        <td className="py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {payable(o) ? (
                              <Button
                                size="sm" permission="Pay::pay"
                                className="h-7 px-2.5 text-xs"
                                onClick={() => onOpenPay?.(o.id, o.amount, o)}
                              >
                                <Wallet className="size-3.5" />
                                支付
                              </Button>
                            ) : null}
                            <Button
                              size="sm" permission="Order::index"
                              variant="outline"
                              className="h-7 px-2.5 text-xs"
                              onClick={() => { window.location.href = `/orderDetail.htm?id=${o.id}` }}
                            >
                              详情
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* 分页：与操作日志一致的交互（每页数量 / 页码窗口 / 跳页） */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>共 {total} 条 · 第 {cur}/{totalPages} 页</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>上一页</Button>
                {visiblePages(cur, totalPages).map((n) => (
                  <ChoiceButton
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === cur ? 'page' : undefined}
                    selected={n === cur} className="cui-choice--page"
                  >
                    {n}
                  </ChoiceButton>
                ))}
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={cur >= totalPages} onClick={() => setPage(cur + 1)}>下一页</Button>
                {totalPages > 5 ? (
                  <span className="inline-flex items-center gap-1">
                    跳至
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      defaultValue=""
                      onKeyDown={(e) => { if (e.key === 'Enter') { goto(e.target.value); e.target.value = '' } }}
                      className="h-7 w-16 text-xs"
                      aria-label="跳转页码"
                      placeholder="页码"
                    />
                    页
                  </span>
                ) : null}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
