import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Plus, Trash2, Pencil, Server, Network, Layers } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Input, Field } from '../ui/input'
import { Badge, EmptyState } from '../ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, ConfirmDialog } from '../ui/dialog'
import { DataTable } from '../ui/data-table'
import { StatCard, StatGrid } from '../ui/stat-card'
import { useToast } from '../ui/toast'
import { get, post, put, del, formatDateTime } from '../lib'

/**
 * 安全组面板（安全中心的第 4 个标签）
 *
 * 与 group_rules.htm?id= 的关系：
 *   本面板 = 安全组的增删改与列表（security_group.htm 的第 4 标签）
 *   group_rules.htm = 某个安全组内部的规则明细，是独立页面而非标签
 *
 * 契约见 pages/securityGroup.jsx 顶部注释（同为 addon/idcsmart_cloud 提供）。
 * 该插件未启用时接口会报错，此处给出降级说明而非空白。
 */
export function SecurityGroupPanel() {
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keywords, setKeywords] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    get('/security_group', { page: 1, limit: 50, keywords })
      .then((res) => setRows(res.data?.list || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [keywords])

  useEffect(load, [load])

  async function save(e) {
    e.preventDefault()
    if (!editing?.name?.trim()) return toast('请填写安全组名称', 'error')
    setBusy(true)
    try {
      const body = { name: editing.name.trim(), description: editing.description || '' }
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
    <>
      <StatGrid>
        <StatCard label="安全组" value={loading ? '—' : rows.length} hint="当前账户"
                  sub="可分别绑定到不同实例" icon={ShieldCheck} />
        <StatCard label="规则总数" value={loading ? '—' : totalRules} hint="合计"
                  sub="入站与出站规则" icon={Network} />
        <StatCard label="关联实例" value={loading ? '—' : totalHosts} hint="合计"
                  sub="一个实例可绑定多个安全组" icon={Server} />
        <StatCard label="默认放行" value="全部出站" hint="建议保持"
                  sub="入站按最小权限开放" icon={Layers} />
      </StatGrid>

      <Card className="mt-4">
        <CardContent className="p-5">
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            error={error}
            search={keywords}
            onSearchChange={setKeywords}
            searchPlaceholder="安全组名称"
            actions={<Button size="sm" onClick={() => setEditing({ name: '', description: '' })}>
              <Plus className="size-3.5" />新建安全组
            </Button>}
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
    </>
  )
}
