import OperatePasswordDialog from '../ui/operate-password-dialog'
import { Guard, useAccess } from '../ui/access'
import { ipWhitelist } from '../compat'
import { copyToClipboard } from '../shared'
import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, KeyRound, Plus, Trash2, Pencil, Fingerprint, Lock,
  FileClock, Network, Copy, Check, Terminal,
} from 'lucide-react'
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Input, Textarea, Field, Select, Checkbox } from '../ui/input'
import { Badge, Alert, EmptyState, Skeleton } from '../ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, ConfirmDialog } from '../ui/dialog'
import { DataTable } from '../ui/data-table'
import { useToast } from '../ui/toast'
import { cn } from '../ui/utils'
import { get, post, put, del, formatDateTime } from '../lib'
import { SecurityGroupPanel } from './securityGroupPanel'
import { usePageTab } from './usePageTab'
import { logPagination } from '../lib/log-pagination'

/**
 * 安全中心
 *
 * 系统里 security.htm / security_ssh.htm / security_log.htm / security_group.htm
 * 是同一个页面的四个 Tab，只是默认打开不同的标签（default 主题的 activeName
 * 分别是 1 / 2 / 3 / 4）。原先我把它们映射成了三个不同实现，导致
 * security_ssh 和 security_log 打开的都是概览。
 *
 * 现在恢复成「一个页面 + 入口指定默认 Tab」，四个 URL 都能正确落地：
 *   1 API 密钥         GET/POST/DELETE /api, PUT /api/:id/white_list
 *   2 SSH 密钥         GET/POST/PUT/DELETE /ssh_key       （插件 idcsmart_ssh_key）
 *   3 操作日志         GET /log?type=api|system
 *   4 安全组           GET /security_group                （插件 idcsmart_cloud）
 *
 * 2 和 4 依赖插件；插件未启用时接口报错，面板给降级提示而不是空白。
 */

export default function SecurityPage({ defaultTab = 'overview' }) {
  return (
    <div className="space-y-4">
      <PageHeader title="安全中心" description="管理 API 密钥、SSH 密钥、操作日志与安全组" />
      <TabbedSecurity defaultTab={defaultTab} />
    </div>
  )
}

const TABS = [
  { value: 'overview', label: '安全概览' },
  { value: 'api', label: 'API 密钥' },
  { value: 'ssh', label: 'SSH 密钥' },
  { value: 'log', label: '操作日志' },
  { value: 'group', label: '安全组' },
]

function TabbedSecurity({ defaultTab }) {
  const {can}=useAccess()
  const rules={api:'Api::list',log:'Log::list'}
  const caps=window.__CRA1_RUNTIME__?.features || {}
  const visibleTabs=TABS.filter(t=>(t.value!=='ssh'||caps.ssh) && (t.value!=='group'||caps.security_group) && (!rules[t.value]||can(rules[t.value])))
  const [tab, setTab] = usePageTab(defaultTab, visibleTabs.map((t) => t.value))

  return (
    <>
      <div role="tablist" aria-label="安全中心分区"
           className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {visibleTabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={
              'rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors duration-150 ' +
              (tab === t.value
                ? 'bg-brand text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted-bg hover:text-ink')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewPanel onNavigateTab={setTab} />}
      {tab === 'api' && <Guard permission="Api::list"><ApiKeyPanel /></Guard>}
      {tab === 'ssh' && caps.ssh && <SshPanel />}
      {tab === 'log' && <Guard permission="Log::list"><LogPanel /></Guard>}
      {tab === 'group' && <SecurityGroupPanel />}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* 安全概览                                                                    */
/* -------------------------------------------------------------------------- */

function OverviewPanel({ onNavigateTab }) {
  const { can } = useAccess()
  const sshAvailable = !!window.__CRA1_RUNTIME__?.features?.ssh
  const accountAvailable = can('Account::index')
  const [state, setState] = useState(null)   // { hasOperate, hasPhone, hasEmail }
  const [readError,setReadError]=useState('')
  const [sshCount, setSshCount] = useState(null)
  const [apiCount, setApiCount] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (can('Account::index')) get('/account')
      .then((res) => {
        const a = res.data?.account || {}
        setState({
          hasOperate: Number(a.set_operate_password) === 1,
          hasPhone: !!a.phone,
          hasEmail: !!a.email,
        })
      })
      .catch(e => setReadError(e.message))
    if (sshAvailable) get('/ssh_key').then((r) => setSshCount((r.data?.list || []).length)).catch(e => { setSshCount(null); setReadError(e.message) })
    if (can('Api::list')) get('/api').then((r) => setApiCount(r.data?.count ?? (r.data?.list || []).length)).catch(e => { setApiCount(null); setReadError(e.message) })
  }, [])

  const checks = state
    ? [state.hasOperate, state.hasPhone, state.hasEmail, (sshCount || 0) > 0 || (apiCount || 0) > 0]
    : []
  const score = checks.filter(Boolean).length
  const scoreKnown = !!state && (!sshAvailable || sshCount !== null) && (!can('Api::list') || apiCount !== null)

  /* 概览改为「横向指标条」（与财务中心同款）：一张卡并排评分+三项状态 */
  return (
    <>
      {readError&&<Alert tone="error">{readError}<Button variant="link" onClick={()=>location.reload()}>重新读取</Button></Alert>}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5 xl:grid-cols-4">
          <div>
            <p className="text-[13px] text-muted-foreground">安全评分</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums leading-7 tracking-tight text-ink">
              {scoreKnown ? `${score}/4` : '—'}
            </p>
            <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-line/70" aria-hidden="true">
              <div
                className={cn('h-full rounded-full', score >= 3 ? 'bg-success' : 'bg-warning')}
                style={{ width: `${scoreKnown ? (score / 4) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {!scoreKnown ? '安全状态暂未确认' : score >= 3 ? '安全状况良好' : '建议完善安全设置'}
            </p>
          </div>
          {accountAvailable&&<MetricBlock label="操作密码" value={state ? (state.hasOperate ? '已设置' : '未设置') : '—'}
                       sub="敏感操作验证"
                       ok={!!state?.hasOperate} />}
          {accountAvailable&&<MetricBlock label="绑定方式" value={state ? `${[state.hasPhone, state.hasEmail].filter(Boolean).length}/2` : '—'}
                       sub="手机号与邮箱"
                       ok={!!(state && state.hasPhone && state.hasEmail)} />}
          <MetricBlock label="密钥与 API"
                       value={`${sshCount ?? '—'} / ${apiCount ?? '—'}`}
                       sub="SSH 密钥 / API 密钥"
                       ok={(sshCount || 0) + (apiCount || 0) > 0} />
        </CardContent>
      </Card>

      {/* 安全检查项清单（华为云安全评估式）：完成态绿色对勾 + 未完成「去设置」高亮按钮 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>安全设置</CardTitle>
          <CardDescription>为敏感操作增加验证，提升账户安全性</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-line border-t border-line">
            <Guard permission="Account::updatePassword"><li className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className={
                'flex size-9 shrink-0 items-center justify-center rounded-lg ' +
                (state?.hasOperate ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')
              } aria-hidden="true">
                {state?.hasOperate ? <Check className="size-4" /> : <Fingerprint className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">操作密码</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {state === null ? '加载中…'
                    : state.hasOperate ? '已设置，验证要求以当前操作的安全策略为准'
                    : '未设置，建议为敏感操作增加一道验证'}
                </p>
              </div>
              {state && (
                <div className="flex items-center gap-2">
                  <Button variant={state.hasOperate ? 'outline' : 'default'} size="sm" onClick={() => setOpen(true)}>
                    {state.hasOperate ? '修改' : '去设置'}
                  </Button>
                </div>
              )}
            </li></Guard>
            <Guard permission="Account::index"><li className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className={
                'flex size-9 shrink-0 items-center justify-center rounded-lg ' +
                (state?.hasPhone && state?.hasEmail ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')
              } aria-hidden="true">
                {state?.hasPhone && state?.hasEmail ? <Check className="size-4" /> : <Lock className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">绑定方式</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  手机号{state?.hasPhone ? '已绑定' : '未绑定'} · 邮箱{state?.hasEmail ? '已绑定' : '未绑定'}
                  ，用于登录与账户找回
                </p>
              </div>
              <Button
                variant={state?.hasPhone && state?.hasEmail ? 'outline' : 'default'}
                size="sm"
                onClick={() => { window.location.href = '/account.htm?tab=security' }}
              >
                {state?.hasPhone && state?.hasEmail ? '管理' : '去绑定'}
              </Button>
            </li></Guard>
            <li className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className={
                'flex size-9 shrink-0 items-center justify-center rounded-lg ' +
                ((sshCount || 0) + (apiCount || 0) > 0 ? 'bg-success/10 text-success' : 'bg-brand/8 text-brand')
              } aria-hidden="true">
                {((sshCount || 0) + (apiCount || 0) > 0 ? <Check className="size-4" /> : <KeyRound className="size-4" />)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">SSH 密钥 / API 密钥</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  已创建 {sshCount ?? 0} 个 SSH 密钥、{apiCount ?? 0} 个 API 密钥
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {sshAvailable&&<Button variant="outline" size="sm" onClick={() => onNavigateTab?.('ssh')}>
                  SSH
                </Button>}
                <Button permission="Api::list" variant="outline" size="sm" onClick={() => onNavigateTab?.('api')}>
                  API
                </Button>
              </div>
            </li>
            <Guard permission="Account::updatePassword"><li className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/8 text-brand" aria-hidden="true">
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">登录密码</p>
                <p className="mt-0.5 text-xs text-muted-foreground">在「账户信息」中修改，修改后需重新登录</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { window.location.href = '/account.htm' }}>前往</Button>
            </li></Guard>
          </ul>
        </CardContent>
      </Card>

      <OperatePasswordDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* API 密钥                                                                    */
/* -------------------------------------------------------------------------- */

function ApiKeyPanel() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [createApi, setCreateApi] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState(null)      // 创建成功后的凭据弹窗
  const [white, setWhite] = useState(null)          // 白名单设置弹窗
  const [confirmDel, setConfirmDel] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    get('/api', { page: 1, limit: 50 })
      .then((res) => {
        setRows(res.data?.list || [])
        setCreateApi(res.data?.create_api ?? 1)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function create(e) {
    e.preventDefault()
    if (!newName.trim()) return toast('请填写密钥名称', 'error')
    setBusy(true)
    try {
      const res = await post('/api', { name: newName.trim() })
      // 私钥只在创建时返回一次，必须立刻展示
      setCreated(res.data || null)
      setCreating(false)
      setNewName('')
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveWhite(e) {
    e.preventDefault()
    if (white.status === 1 && !white.ip.trim()) return toast('开启白名单需填写 IP', 'error')
    setBusy(true)
    try {
      await put(`/api/${white.id}/white_list`, { status: white.status, ip: ipWhitelist(white.ip) })
      toast('白名单已保存', 'success')
      setWhite(null)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      await del(`/api/${id}`)
      toast('密钥已删除', 'success')
      setConfirmDel(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const columns = [
    { key: 'id', title: 'ID', width: 70,
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.id}</span> },
    { key: 'name', title: '名称',
      render: (r) => <span className="font-medium">{r.name || '—'}</span> },
    { key: 'status', title: 'IP 白名单', width: 150,
      render: (r) => (
        r.status
          ? <div className="min-w-0">
              <Badge tone="success">已开启</Badge>
              {r.ip && <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{r.ip}</div>}
            </div>
          : <Badge tone="muted">未开启</Badge>
      ) },
    { key: 'create_time', title: '创建时间', width: 150,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.create_time)}</span> },
    { key: 'actions', title: '操作', width: 140, align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button permission="Api::whiteListSetting" variant="ghost" size="sm"
                  onClick={() => setWhite({ id: r.id, status: r.status ? 1 : 0, ip: r.ip || '' })}>
            白名单
          </Button>
          <Button permission="Api::delete" variant="ghost" size="sm" className="text-danger hover:bg-danger/8"
                  aria-label="删除" onClick={() => setConfirmDel(r)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) },
  ]

  return (
    <>
      {createApi === 0 && (
        <Alert tone="info">
          管理员已关闭用户自助创建 API 密钥。如需使用开放接口，请联系客服开通。
        </Alert>
      )}

      <Card className="mt-4">
        <CardContent className="p-5">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            error={error}
            actions={createApi === 1 && (
              <Button permission="Api::create" size="sm" onClick={() => { setCreating(true); setNewName('') }}>
                <Plus className="size-3.5" />创建密钥
              </Button>
            )}
            empty={
              <EmptyState
                icon={KeyRound}
                title="还没有 API 密钥"
                description="创建后可获得 token 与 RSA 私钥，用于调用系统开放接口"
                action={createApi === 1 && (
                  <Button permission="Api::create" size="sm" onClick={() => setCreating(true)}>
                    <Plus className="size-3.5" />创建密钥
                  </Button>
                )}
              />
            }
          />
        </CardContent>
      </Card>

      {/* 创建 */}
      <Dialog open={creating} onOpenChange={(v) => !v && setCreating(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 API 密钥</DialogTitle>
            <DialogDescription>私钥仅在创建成功时显示一次，请及时保存</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <Field label="名称" required hint="便于识别用途，例如：监控脚本">
              <Input value={newName} autoFocus placeholder="例如：监控脚本"
                     onChange={(e) => setNewName(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreating(false)}>取消</Button>
              <Button type="submit" disabled={busy}>{busy ? '创建中…' : '创建'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 创建成功：展示 token / 私钥 / 接口地址 */}
      <Dialog open={!!created} onOpenChange={(v) => !v && setCreated(null)}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>密钥创建成功</DialogTitle>
            <DialogDescription>以下内容只显示这一次，关闭后无法再次查看</DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3">
              <Alert tone="warning">请立即复制私钥并妥善保管，丢失后只能重新创建密钥。</Alert>
              <CopyField label="接口地址" value={created.api_url} />
              <CopyField label="Token" value={created.token} />
              <CopyField label="RSA 私钥" value={created.private_key} multiline />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 白名单 */}
      <Dialog open={!!white} onOpenChange={(v) => !v && setWhite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>IP 白名单</DialogTitle>
            <DialogDescription>开启后，只有白名单内的 IP 可以调用该密钥</DialogDescription>
          </DialogHeader>
          {white && (
            <form onSubmit={saveWhite} className="space-y-4">
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <Checkbox checked={white.status === 1}
                          onChange={(e) => setWhite((s) => ({ ...s, status: e.target.checked ? 1 : 0 }))} />
                开启白名单限制
              </label>
              {white.status === 1 && (
                <Field label="允许的 IP" required hint="每行填写一个 IP，也可粘贴逗号分隔内容">
                  <Textarea value={white.ip} placeholder={"例如：1.2.3.4\n5.6.7.8"}
                         onChange={(e) => setWhite((s) => ({ ...s, ip: e.target.value }))} />
                </Field>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setWhite(null)}>取消</Button>
                <Button type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        title="删除 API 密钥"
        description={confirmDel ? `确认删除「${confirmDel.name}」？删除后使用该密钥的程序将立即失效。` : ''}
        confirmText="删除"
        tone="danger"
        onConfirm={() => remove(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  )
}

function CopyField({ label, value, multiline }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  async function copy() {
    const ok = await copyToClipboard(value)
    if (!ok) { window.CRA1Shared.UI.toast('复制失败，请手动复制', 'error'); return }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {copied ? <><Check className="size-3.5" />已复制</> : <><Copy className="size-3.5" />复制</>}
        </Button>
      </div>
      <code className={
        'block overflow-x-auto rounded-lg border border-line bg-muted-bg px-3 py-2 font-mono text-[11px] leading-5 text-ink ' +
        (multiline ? 'max-h-40 whitespace-pre-wrap break-all' : 'whitespace-nowrap')
      }>
        {value}
      </code>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* SSH 密钥                                                                    */
/* -------------------------------------------------------------------------- */

function SshPanel() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    get('/ssh_key', { page: 1, limit: 50 })
      .then((res) => setRows(res.data?.list || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function save(e) {
    e.preventDefault()
    // 契约字段是 public_key（不是 key），传错会直接 400
    const { id, name, public_key } = editing
    if (!name?.trim()) return toast('请填写名称', 'error')
    if (!public_key?.trim()) return toast('请填写公钥内容', 'error')
    setBusy(true)
    try {
      const body = { name: name.trim(), public_key: public_key.trim() }
      if (id) await put(`/ssh_key/${id}`, body)
      else await post('/ssh_key', body)
      toast(id ? '密钥已更新' : '密钥已添加', 'success')
      setEditing(null)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id) {
    try {
      await del(`/ssh_key/${id}`)
      toast('密钥已删除', 'success')
      setConfirmDel(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const columns = [
    { key: 'name', title: '名称', width: 180,
      render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'finger_print', title: '指纹', width: 240,
      render: (r) => (
        <span className="truncate font-mono text-[11px] text-muted-foreground" title={r.finger_print}>
          {r.finger_print || '—'}
        </span>
      ) },
    { key: 'public_key', title: '公钥',
      render: (r) => (
        <span className="line-clamp-1 font-mono text-xs text-muted-foreground" title={r.public_key}>
          {r.public_key || '—'}
        </span>
      ) },
    { key: 'actions', title: '操作', width: 96, align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label="编辑"
                  onClick={() => setEditing({ id: r.id, name: r.name, public_key: r.public_key })}>
            <Pencil className="size-3.5" />
          </Button>
          <Button permission="Api::delete" variant="ghost" size="sm" className="text-danger hover:bg-danger/8"
                  aria-label="删除" onClick={() => setConfirmDel(r)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) },
  ]

  return (
    <>
      <Card className="mt-4">
        <CardContent className="p-5">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            error={error}
            actions={<Button size="sm" onClick={() => setEditing({ name: '', public_key: '' })}>
              <Plus className="size-3.5" />添加密钥
            </Button>}
            empty={
              <EmptyState
                icon={Terminal}
                title="还没有 SSH 密钥"
                description="添加公钥后，开通服务器时即可选择使用，避免密码登录"
                action={<Button size="sm" onClick={() => setEditing({ name: '', public_key: '' })}>
                  <Plus className="size-3.5" />添加密钥
                </Button>}
              />
            }
          />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editing?.id ? '编辑 SSH 密钥' : '添加 SSH 密钥'}</DialogTitle>
            <DialogDescription>粘贴以 ssh-rsa / ssh-ed25519 开头的公钥</DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="space-y-4">
              <Field label="名称" required>
                <Input value={editing.name} placeholder="例如：我的笔记本"
                       onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
              </Field>
              <Field label="公钥内容" required>
                <textarea
                  rows={5}
                  value={editing.public_key}
                  onChange={(e) => setEditing((s) => ({ ...s, public_key: e.target.value }))}
                  placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-xs leading-6 text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15"
                />
              </Field>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
                <Button type="submit" disabled={busy}>{busy ? '保存中…' : '保存'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        title="删除 SSH 密钥"
        description={confirmDel ? `确认删除「${confirmDel.name}」？已使用该密钥的服务器不受影响。` : ''}
        confirmText="删除"
        tone="danger"
        onConfirm={() => remove(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* 操作日志                                                                    */
/* -------------------------------------------------------------------------- */

function LogPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [type, setType] = useState('system')
  const [keywords, setKeywords] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 15

  useEffect(() => { setPage(1) }, [type, keywords])

  useEffect(() => {
    setLoading(true)
    setError('')
    get('/log', { page, limit, type, keywords })
      .then((res) => { setRows(res.data?.list || []); setTotal(res.data?.count) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, type, keywords])

  const columns = [
    { key: 'create_time', title: '时间', width: 150,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.create_time)}</span> },
    { key: 'description', title: '操作', render: (r) => r.description },
    { key: 'ip', title: 'IP', width: 140,
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.ip || '—'}</span> },
  ]

  return (
    <Card className="mt-4">
      <CardContent className="p-5">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          error={error}
          search={keywords}
          onSearchChange={setKeywords}
          searchPlaceholder="搜索操作描述"
          filters={
            <Select value={type} onChange={(e) => setType(e.target.value)}
                    className="h-9 w-[130px] text-[13px]" aria-label="日志类型">
              <option value="system">系统日志</option>
              <option value="api">API 日志</option>
            </Select>
          }
          page={page}
          {...logPagination(total, rows.length, limit)}
          limit={limit}
          onPageChange={setPage}
          empty={
            <EmptyState
              icon={FileClock}
              title={type === 'api' ? '暂无 API 调用记录' : '暂无操作记录'}
              description={type === 'api' ? '通过开放接口的调用会记录在这里' : '账户内的关键操作会记录在这里'}
            />
          }
        />
      </CardContent>
    </Card>
  )
}

/* 概览指标块（横向指标条内的一段）：label + 值 + 小注 + 状态点 */
function MetricBlock({ label, value, sub, ok }) {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-semibold leading-7 tracking-tight text-ink">{value}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn('size-1.5 rounded-full', ok ? 'bg-success' : 'bg-warning')} aria-hidden="true" />
        {sub}
      </p>
    </div>
  )
}
