import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, Plus, Trash2, Pencil, ArrowLeft, ArrowDownLeft, ArrowUpRight,
  Layers, Server, Network, SearchX,
} from 'lucide-react'
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Input, Field, Select, Textarea } from '../ui/input'
import { Badge, Alert, EmptyState, Skeleton } from '../ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, ConfirmDialog } from '../ui/dialog'
import { DataTable } from '../ui/data-table'
import { StatCard, StatGrid } from '../ui/stat-card'
import { useToast } from '../ui/toast'
import { get, post, put, del, formatDateTime, formatDate } from '../lib'

/**
 * 安全组（security_group.htm）与安全组规则（group_rules.htm?id=组ID）
 *
 * 契约（读自 addon/idcsmart_cloud 的 clientarea 控制器）：
 *   GET    /security_group                     安全组列表  → { list[], count }
 *   GET    /security_group/:id                 安全组详情  → { security_group }
 *   POST   /security_group                     创建        { name, description, [rule[]] }
 *   PUT    /security_group/:id                 修改        { name, description }
 *   DELETE /security_group/:id                 删除
 *   GET    /security_group/:id/rule            规则列表    → { list[], count }
 *   POST   /security_group/:id/rule            新增规则    { direction, protocol, port, ip, description }
 *   POST   /security_group/:id/rule/batch      批量新增    { rule[] }
 *   PUT    /security_group/rule/:id            修改规则
 *   DELETE /security_group/rule/:id            删除规则
 *   GET    /security_group/:id/host            关联实例    → { list[], count }
 *   POST   /security_group/:id/host            批量关联    { host_id[] }
 *   DELETE /security_group/:id/host/:host_id   解除关联
 *
 * 该模块属于插件 addon/idcsmart_cloud；插件未启用时接口返回错误，
 * 页面需要给出可理解的降级提示，而不是空白。
 */

const PROTOCOLS = [
  { value: 'all', label: '全部 (ALL)' },
  { value: 'all_tcp', label: '全部 TCP' },
  { value: 'all_udp', label: '全部 UDP' },
  { value: 'tcp', label: '自定义 TCP' },
  { value: 'udp', label: '自定义 UDP' },
  { value: 'icmp', label: 'ICMP' },
  { value: 'ssh', label: 'SSH (22)' },
  { value: 'telnet', label: 'Telnet (23)' },
  { value: 'http', label: 'HTTP (80)' },
  { value: 'https', label: 'HTTPS (443)' },
  { value: 'mssql', label: 'MSSQL (1433)' },
  { value: 'oracle', label: 'Oracle (1521)' },
  { value: 'mysql', label: 'MySQL (3306)' },
  { value: 'rdp', label: 'RDP (3389)' },
  { value: 'postgresql', label: 'PostgreSQL (5432)' },
  { value: 'redis', label: 'Redis (6379)' },
  { value: 'gre', label: 'GRE' },
]

const PROTOCOL_LABEL = Object.fromEntries(PROTOCOLS.map((p) => [p.value, p.label]))

const emptyRule = () => ({
  direction: 'in', protocol: 'tcp', port: '', ip: '0.0.0.0/0', description: '',
})

/* -------------------------------------------------------------------------- */
/* 安全组列表                                                                   */
/* -------------------------------------------------------------------------- */

export function SecurityGroupListPage() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keywords, setKeywords] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const limit = 10

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    get('/security_group', { page, limit, keywords })
      .then((res) => { setRows(res.data?.list || []); setTotal(res.data?.count || 0) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, limit, keywords])

  useEffect(load, [load])
  useEffect(() => { setPage(1) }, [keywords])

  async function save(e) {
    e.preventDefault()
    if (!editing?.name?.trim()) return toast('请填写安全组名称', 'error')
    setBusy(true)
    try {
      const body = { name: editing.name, description: editing.description || '' }
      if (editing.id) await put(`/security_group/${editing.id}`, body)
      else await post('/security_group', body)
      toast(editing.id ? '安全组已更新' : '安全组已创建', 'success')
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
      await del(`/security_group/${id}`)
      toast('安全组已删除', 'success')
      setConfirmDel(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const totalHosts = rows.reduce((n, r) => n + (Number(r.host_num) || 0), 0)
  const totalRules = rows.reduce((n, r) => n + (Number(r.rule_num) || 0), 0)

  const columns = [
    { key: 'name', title: '名称',
      render: (r) => (
        <a href={`/group_rules.htm?id=${r.id}`} className="font-medium text-brand hover:underline">
          {r.name}
        </a>
      ) },
    { key: 'description', title: '描述',
      render: (r) => <span className="text-muted-foreground">{r.description || '—'}</span> },
    { key: 'rule_num', title: '规则数', width: 90, align: 'right',
      render: (r) => <span className="tabular-nums">{r.rule_num ?? 0}</span> },
    { key: 'host_num', title: '关联实例', width: 90, align: 'right',
      render: (r) => <span className="tabular-nums">{r.host_num ?? 0}</span> },
    { key: 'create_time', title: '创建时间', width: 150,
      render: (r) => <span className="text-muted-foreground">{formatDateTime(r.create_time)}</span> },
    { key: 'actions', title: '操作', width: 150, align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => { window.location.href = `/group_rules.htm?id=${r.id}` }}>
            规则
          </Button>
          <Button variant="ghost" size="sm" aria-label="编辑"
                  onClick={() => setEditing({ id: r.id, name: r.name, description: r.description })}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/8"
                  aria-label="删除" onClick={() => setConfirmDel(r)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="安全组"
        description="集中管理实例的入站与出站访问规则"
        actions={<Button size="sm" onClick={() => setEditing({ name: '', description: '' })}>
          <Plus className="size-3.5" />新建安全组
        </Button>}
      />

      <StatGrid>
        <StatCard label="安全组" value={loading ? '—' : (total || rows.length)} hint="当前账户"
                  sub="可分别绑定到不同实例" icon={ShieldCheck} />
        <StatCard label="规则总数" value={loading ? '—' : totalRules} hint="本页合计"
                  sub="入站与出站规则" icon={Network} />
        <StatCard label="关联实例" value={loading ? '—' : totalHosts} hint="本页合计"
                  sub="一个实例可绑定多个安全组" icon={Server} />
        <StatCard label="默认放行" value="全部出站" hint="建议保持"
                  sub="入站按需最小化开放" icon={Layers} />
      </StatGrid>

      <Card>
        <CardContent className="p-5">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            error={error}
            search={keywords}
            onSearchChange={setKeywords}
            searchPlaceholder="安全组名称"
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            empty={
              <EmptyState
                icon={ShieldCheck}
                title="还没有安全组"
                description="新建安全组后，可为其配置入站/出站规则并绑定到实例"
                action={<Button size="sm" onClick={() => setEditing({ name: '', description: '' })}>
                  <Plus className="size-3.5" />新建安全组
                </Button>}
              />
            }
          />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? '编辑安全组' : '新建安全组'}</DialogTitle>
            <DialogDescription>创建时会自动生成一组常用放行规则</DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="space-y-4">
              <Field label="名称" required>
                <Input value={editing.name} placeholder="例如：Web 服务器"
                       onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
              </Field>
              <Field label="描述">
                <Input value={editing.description || ''} placeholder="选填，便于识别用途"
                       onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} />
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
        title="删除安全组"
        description={confirmDel ? `确认删除「${confirmDel.name}」？其下所有规则会一并删除，已绑定的实例将解除关联。` : ''}
        confirmText="删除"
        tone="danger"
        onConfirm={() => remove(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 安全组规则（group_rules.htm?id=）                                             */
/* -------------------------------------------------------------------------- */

export function GroupRulesPage() {
  const toast = useToast()
  const groupId = new URLSearchParams(location.search).get('id') || ''
  const [group, setGroup] = useState(null)
  const [groupChecked, setGroupChecked] = useState(false)  // 详情是否已确认（区分「加载中」与「不存在」）
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [direction, setDirection] = useState('in')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const limit = 20

  useEffect(() => {
    if (!groupId) { setLoading(false); setGroupChecked(true); return }
    get(`/security_group/${groupId}`)
      // 组不存在时后端返回 status:200 + security_group:{}，用 id 判定
      .then((res) => {
        const g = res.data?.security_group
        setGroup(g && g.id ? g : null)
      })
      .catch(() => setGroup(null))
      .finally(() => setGroupChecked(true))
  }, [groupId])

  const load = useCallback(() => {
    if (!groupId) return
    setLoading(true)
    setError('')
    get(`/security_group/${groupId}/rule`, { page, limit, direction })
      .then((res) => { setRows(res.data?.list || []); setTotal(res.data?.count || 0) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [groupId, page, limit, direction])

  useEffect(load, [load])
  useEffect(() => { setPage(1) }, [direction])

  async function save(e) {
    e.preventDefault()
    const f = editing
    if (!f.port?.trim()) return toast('请填写端口范围', 'error')
    if (!f.ip?.trim()) return toast('请填写授权 IP', 'error')
    setBusy(true)
    try {
      // 自定义 TCP/UDP 才需要端口，协议类（ssh/http…）端口由后端按协议补全，
      // 但接口要求 port 必填，这里保持用户输入原样提交
      const body = {
        direction: f.direction,
        protocol: f.protocol,
        port: f.port,
        ip: f.ip,
        description: f.description || '',
      }
      if (f.id) await put(`/security_group/rule/${f.id}`, body)
      else await post(`/security_group/${groupId}/rule`, body)
      toast(f.id ? '规则已更新' : '规则已添加', 'success')
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
      await del(`/security_group/rule/${id}`)
      toast('规则已删除', 'success')
      setConfirmDel(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  if (!groupId) {
    return (
      <>
        <PageHeader title="安全组规则" description="配置入站与出站访问策略" />
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={ShieldCheck}
              title="缺少安全组 ID"
              description="请从「安全组」列表中选择一个安全组进入。"
              action={<Button size="sm" onClick={() => { window.location.href = '/security_group.htm' }}>
                前往安全组
              </Button>}
            />
          </CardContent>
        </Card>
      </>
    )
  }

  // 详情确认后仍没有该组：说明 ID 无效或不属于当前账户。
  // 这时不应继续渲染规则表格（会显示成「该组没有规则」，误导用户）。
  if (groupChecked && !group) {
    return (
      <>
        <PageHeader title="安全组规则" description="配置入站与出站访问策略" />
        <Card>
          <CardContent className="p-5">
            <EmptyState
              icon={ShieldCheck}
              title="安全组不存在"
              description="该安全组可能已被删除，或不属于当前账户。"
              action={<Button size="sm" onClick={() => { window.location.href = '/security_group.htm' }}>
                返回安全组
              </Button>}
            />
          </CardContent>
        </Card>
      </>
    )
  }

  const columns = [
    { key: 'direction', title: '方向', width: 110,
      render: (r) => (
        r.direction === 'in'
          ? <Badge tone="info"><ArrowDownLeft className="size-3" aria-hidden="true" />入站</Badge>
          : <Badge tone="warning"><ArrowUpRight className="size-3" aria-hidden="true" />出站</Badge>
      ) },
    { key: 'protocol', title: '协议', width: 130,
      render: (r) => <span className="font-mono text-xs">{PROTOCOL_LABEL[r.protocol] || r.protocol}</span> },
    { key: 'port', title: '端口范围', width: 120,
      render: (r) => <span className="font-mono text-xs">{r.port || '—'}</span> },
    { key: 'ip', title: '授权对象', width: 170,
      render: (r) => <span className="font-mono text-xs">{r.ip || '—'}</span> },
    { key: 'description', title: '描述',
      render: (r) => <span className="text-muted-foreground">{r.description || '—'}</span> },
    { key: 'actions', title: '操作', width: 96, align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label="编辑"
                  onClick={() => setEditing({
                    id: r.id, direction: r.direction, protocol: r.protocol,
                    port: r.port, ip: r.ip, description: r.description,
                  })}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/8"
                  aria-label="删除" onClick={() => setConfirmDel(r)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={group?.name ? `规则 · ${group.name}` : '安全组规则'}
        description={group?.description || '配置入站与出站访问策略'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { window.location.href = '/security_group.htm' }}>
              <ArrowLeft className="size-3.5" />返回安全组
            </Button>
            <Button size="sm" onClick={() => setEditing(emptyRule())}>
              <Plus className="size-3.5" />添加规则
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {[{ v: 'in', label: '入站规则' }, { v: 'out', label: '出站规则' }].map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setDirection(t.v)}
            aria-pressed={direction === t.v}
            className={
              'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ' +
              (direction === t.v
                ? 'bg-brand text-white'
                : 'bg-muted-bg text-muted-foreground hover:bg-line/60 hover:text-ink')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            error={error}
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            empty={
              <EmptyState
                icon={SearchX}
                title={direction === 'in' ? '没有入站规则' : '没有出站规则'}
                description="未匹配任何规则的流量会被拒绝，请按最小权限原则添加"
                action={<Button size="sm" onClick={() => setEditing(emptyRule())}>
                  <Plus className="size-3.5" />添加规则
                </Button>}
              />
            }
          />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? '编辑规则' : '添加规则'}</DialogTitle>
            <DialogDescription>
              入站规则控制外部访问实例，出站规则控制实例访问外部
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="方向" required>
                  <Select value={editing.direction}
                          onChange={(e) => setEditing((s) => ({ ...s, direction: e.target.value }))}>
                    <option value="in">入站</option>
                    <option value="out">出站</option>
                  </Select>
                </Field>
                <Field label="协议" required>
                  <Select value={editing.protocol}
                          onChange={(e) => setEditing((s) => ({ ...s, protocol: e.target.value }))}>
                    {PROTOCOLS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="端口范围" required hint="如 80、8000-9000、1-65535">
                  <Input value={editing.port} placeholder="80"
                         onChange={(e) => setEditing((s) => ({ ...s, port: e.target.value }))} />
                </Field>
                <Field label="授权对象" required hint="CIDR 或 IP">
                  <Input value={editing.ip} placeholder="0.0.0.0/0"
                         onChange={(e) => setEditing((s) => ({ ...s, ip: e.target.value }))} />
                </Field>
              </div>
              <Field label="描述">
                <Input value={editing.description || ''} placeholder="选填，例如：允许办公网访问"
                       onChange={(e) => setEditing((s) => ({ ...s, description: e.target.value }))} />
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
        title="删除规则"
        description={confirmDel
          ? `确认删除该条${confirmDel.direction === 'in' ? '入站' : '出站'}规则（${PROTOCOL_LABEL[confirmDel.protocol] || confirmDel.protocol} ${confirmDel.port}）？`
          : ''}
        confirmText="删除"
        tone="danger"
        onConfirm={() => remove(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  )
}
