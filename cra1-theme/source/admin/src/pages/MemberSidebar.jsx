import { useScopedState } from '../lib/workspace'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Save, RotateCcw, Download, Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  AlertTriangle, GripVertical, Folder, FolderOpen, FileText, History, Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Input, Label, Select, Textarea } from '@ui/input'
import { Badge, Alert, EmptyState, Skeleton } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, ConfirmDialog } from '@ui/dialog'
import { useToast } from '@ui/toast'
import { cn } from '@ui/utils'
import { memberApi, workspaceApi,bootInfo } from '../lib/api'
import SwitchControl from '../ui/Switch'
import { MultiChoice, MenuIcon, LanguageNames, FILTERS } from '../components/MenuChoices'
import { memberDisplayFields } from '../lib/member-fields'
import LinkPicker from './LinkPicker'
import { TreeSortEditor, countTree, findNode, replaceNode, removeNode, collectDescendants } from '../ui/treeSort'
import { FloatingActions } from '../ui/FloatingActions'

/**
 * 会员中心侧边栏导航（独立副本）
 *
 * 需求对应：
 *   2. 默认先读取一遍系统自带导航，可新增菜单，新增类型与系统前台导航一致；
 *   3. 拖拽排序；同一条菜单的所有参数在同一个弹窗里编辑。
 *
 * 重要设计：
 *   - 独立副本：保存只写 member_center.json.sidebar，绝不调用系统
 *     PUT /menu/home（那会删除重建全局菜单、影响所有会员中心主题）；
 *   - 稳定身份：节点用 UUID，不用 idcsmart_menu.id（后者每次保存都会变）；
 *   - 系统来源：system/plugin 项保存 source_nav_id，前台据此解析真实地址；
 *   - 版本乐观锁：保存携带 version，冲突返回 409，避免两个浏览器互相覆盖。
 */

/** 层级徽标：让上下级关系在紧凑行里一眼可辨 */
const LEVEL_LABELS = { 1: '一级分组', 2: '二级分组', 3: '三级页面' }

const TYPES = [
  { value: 'system', label: '系统页面', desc: '来自系统导航（如账户、财务、安全中心）' },
  { value: 'plugin', label: '插件页面', desc: '来自已启用插件（如工单、新闻、子账户）' },
  { value: 'custom', label: '自定义链接', desc: '任意站内/站外地址' },
  { value: 'module', label: '产品列表', desc: '选择需要展示的产品类别和商品' },
  { value: 'embedded', label: '内嵌页面', desc: '在会员中心内展示外部页面' },
  { value: 'separator', label: '分界线', desc: '放在一级菜单之间，分隔上下两部分' },
]

function isMenuSeparator(node) {
  return !!node && (node.source_type === 'separator' || (node.label === '分隔符' && !node.url && !(node.children || []).length))
}

/* -------------------------------------------------------------------------- */
/* 树操作工具（纯函数，便于推理与复用）                                          */
/* -------------------------------------------------------------------------- */

/** 新菜单的完整初始值；UUID 在弹窗打开时生成，取消不会改变父草稿。 */
function emptyNode(overrides = {}) {
  return {
    id: genId(),
    label: '',
    language: {},
    source_type: 'custom',
    source_nav_id: 0,
    url: '',
    icon: '',
    second_reminder: 0,
    module: [],
    res_module: [],
    product_id: [],
    show_quick_order: 0,
    quick_order_url: '',
    is_cross_module: 0,
    select_field: [],
    hidden: 0,
    order: 0,
    children: [],
    ...overrides,
  }
}

/** 统计子树节点数（含自身）；用于删除确认的「及其 N 个子项」提示 */
function countAll(list) {
  return (list || []).reduce((n, x) => n + 1 + countAll(x.children || []), 0)
}

/** 收集整棵树全部节点 id（父级选择框要排除自身与后代） */
function collectIds(list, out = []) {
  ;(list || []).forEach((x) => {
    out.push(x.id)
    collectIds(x.children || [], out)
  })
  return out
}

function genId() {
  // 与服务端 uuid() 同形状；服务端还会再校验一次格式
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** 最近访问设置的默认值（与服务端 defaults 对齐） */
const RECENT_DEFAULTS = { enabled: 1, title: '最近访问', days: 7, max_items: 8, new_tab: 0, open_first: 0 }

/** 数字输入钳制：空/非法回落默认，越界钳到区间 */
function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10)
  if (isNaN(n)) return dflt
  return Math.min(max, Math.max(min, n))
}

/* -------------------------------------------------------------------------- */

export default function MemberSidebar({ member, loading, error, reload, workspace }) {
  const toast = useToast()
  /* 页头操作区引用：悬浮操作条观察它是否滚出视野（Hook 顺序需稳定，故在所有提前 return 之前声明） */
  const actionsRef = useRef(null)
  const [nodes, setNodes] = useScopedState(workspace, 'sidebar.nodes', [])
  const [shape, setShape] = useScopedState(workspace, 'sidebar.shape', 3)
  const [original, setOriginal] = useScopedState(workspace, 'sidebar.nodes', [], true)
  const [recent, setRecent] = useScopedState(workspace, 'sidebar.recent', RECENT_DEFAULTS)
  const [recentOriginal, setRecentOriginal] = useScopedState(workspace, 'sidebar.recent', RECENT_DEFAULTS, true)
  const [version, setVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [catLoading, setCatLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [confirmImport, setConfirmImport] = useState(null)

  useEffect(() => {
    if (!workspace && member?.sidebar) {
      setNodes(member.sidebar.nodes || [])
      setShape(member.sidebar.shape || 3)
      setOriginal(JSON.parse(JSON.stringify(member.sidebar.nodes || [])))
      // 最近访问设置：服务端保证白名单字段存在；缺省回落默认值
      const r = { ...RECENT_DEFAULTS, ...(member.sidebar.recent || {}) }
      setRecent(r)
      setRecentOriginal(JSON.parse(JSON.stringify(r)))
      setVersion(member.version)
    }
  }, [member])

  const loadCatalog = useCallback(() => {
    setCatLoading(true)
    return memberApi.catalog()
      .then((r) => { if (r.status !== 200) throw new Error(r.msg || '系统导航读取失败'); setCatalog(r.data) })
      .catch((e) => setCatalog({ catalog:{ error:e.message } }))
      .finally(() => setCatLoading(false))
  }, [])

  useEffect(() => { loadCatalog() }, [loadCatalog])

  const dirty = useMemo(() =>
    JSON.stringify(nodes) !== JSON.stringify(original)
    || JSON.stringify(recent) !== JSON.stringify(recentOriginal),
  [nodes, original, recent, recentOriginal])
  const recentDirty = useMemo(() => JSON.stringify(recent) !== JSON.stringify(recentOriginal), [recent, recentOriginal])
  const total = useMemo(() => countTree(nodes), [nodes])

  /* ---------------- 保存 ---------------- */

  async function save() {
    if (workspace) return workspace.save()
    setSaving(true)
    try {
      // 菜单结构与最近访问设置一起提交（同一份 sidebar 段、同一个乐观锁版本）；
      // 服务端只更新提供的子段，未变更的 nodes 原样回传不产生误伤
      const r = await memberApi.saveSidebar({ nodes, recent, shape, version })
      if (r.status === 200) {
        toast(r.msg || '已保存，会员中心前台已生效')
        reload()
      } else if (r.status === 409) {
        toast(r.msg || '配置已被其他会话修改，请刷新后重试', 'error')
      } else {
        toast(r.msg || '保存失败', 'error')
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function doImport(mode) {
    if (saving || workspace?.saving) return
    workspace?.setBusy(true)
    setSaving(true)
    try {
      const r = workspace ? await workspaceApi.editorImport(mode, nodes, shape) : await memberApi.import({ mode, version })
      if (r.status === 200) {
        toast(r.msg || '已导入系统导航')
        setConfirmImport(null)
        if (workspace) {
          // Release the import lock before the queued draft update. setValues
          // deliberately rejects ordinary edits while a save/import is pending.
          workspace.setBusy(false)
          workspace.setValues((current) => ({ ...current, sidebar: {
            ...current.sidebar, nodes: r.data.nodes, shape: r.data.shape,
          } }))
        }
        else reload()
        loadCatalog()
      } else {
        toast(r.msg || '导入失败', 'error')
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      workspace?.setBusy(false)
      setSaving(false)
    }
  }

  /* ---------------- 编辑 ---------------- */

  function addSeparator() {
    setNodes((list) => [...list, emptyNode({ label: '分界线', source_type: 'separator' })])
    toast('已添加分界线，可拖到需要的位置，保存后生效')
  }

  /**
   * 提交一条菜单项。
   *
   * 关键：所有判断都在 setNodes 的函数式更新内完成，不能在外层读 nodes ——
   * 外层读到的是该次渲染的闭包快照，若同一轮里有多次更新（或编辑期间
   * 其他状态变化），会把修改写给过期数组，表现为「保存了但列表没变」。
   */
  function saveNode(payload) {
    payload = { ...payload }
    delete payload.__parentId
    const editingId = editing?.id
    const parentId = editing?.__parentId
    const isNew = !editingId || !findNode(nodes, editingId)

    setNodes((list) => {
      // 用最新的 list 重新判断，而不是依赖外层快照
      if (editingId && findNode(list, editingId)) {
        return replaceNode(list, editingId, (n) => ({ ...n, ...payload }))
      }
      if (parentId && findNode(list, parentId)) {
        return replaceNode(list, parentId, (n) => ({
          ...n,
          children: [...(n.children || []), { ...emptyNode(), ...payload }],
        }))
      }
      return [...list, { ...emptyNode(), ...payload }]
    })
    setEditing(null)
    // isNew 仅用于诊断语义，这里不改变行为（新增与编辑都会落到上面分支）
    void isNew
  }

  /* ---------------- 渲染 ---------------- */

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error) return <Alert tone="error">加载失败：{error}</Alert>

  const cat = catalog?.catalog
  const diff = catalog?.diff

  return (
    <div className="space-y-4">
      <PageHeader
        title="侧边栏导航"
        description="首次从系统导航导入一份独立副本；之后在这里增删改与排序，不影响系统导航"
        actions={
          <div ref={actionsRef} data-page-actions className="flex flex-wrap items-center gap-2">
            {dirty && <Badge tone="warning">有未保存修改</Badge>}
            <Button variant="outline" size="sm" onClick={() => {
              setNodes(JSON.parse(JSON.stringify(original)))
              setRecent(JSON.parse(JSON.stringify(recentOriginal)))
            }} disabled={!dirty}>
              <RotateCcw className="size-3.5" />撤销
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing({ ...emptyNode() })}>
              <Plus className="size-3.5" />新增菜单
            </Button>
            <Button variant="outline" size="sm" onClick={addSeparator} disabled={saving}>
              <Minus className="size-3.5" />新增分界线
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              <Save className="size-3.5" />{saving ? '保存中…' : '保存'}
            </Button>
          </div>
        }
      />

      {workspace && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditing({ ...emptyNode() })}><Plus className="size-4" />新增菜单</Button><Button variant="outline" onClick={addSeparator} disabled={workspace.saving}><Minus className="size-4" />新增分界线</Button></div>}
      {/* 系统导航导入区 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4 text-brand" aria-hidden="true" />系统导航导入
          </CardTitle>
          <CardDescription>
            从系统导航读取菜单，先应用到当前草稿，保存后生效。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {catLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : !cat || cat.error ? (
            <Alert tone="warning">
              无法读取系统导航：{cat?.error || '接口不可用'}
              。这通常是数据库连接问题；你仍可手动新增菜单。
              <Button variant="outline" className="ml-3" onClick={loadCatalog}>重试系统导航</Button>
            </Alert>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                <Badge tone="muted">系统菜单 {cat.menu?.length || 0} 项</Badge>
                <Badge tone="muted">可选导航 {cat.navs?.length || 0} 项</Badge>
                <Badge tone="muted">已启用插件 {Object.keys(cat.plugins || {}).length} 个</Badge>
                <Badge tone="muted">当前独立副本 {total} 节点</Badge>
              </div>

              {diff && (diff.added?.length || diff.changed?.length || diff.removed?.length) ? (
                <div className="rounded-lg border border-line bg-surface-alt/60 p-3 text-[13px]">
                  <p className="mb-1.5 font-medium text-ink">与系统导航存在差异</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {diff.added?.length > 0 && <li>新增 {diff.added.length} 项：{diff.added.slice(0, 5).map((d) => d.label).join('、')}</li>}
                    {diff.changed?.length > 0 && <li>变更 {diff.changed.length} 项：{diff.changed.slice(0, 5).map((d) => d.label).join('、')}</li>}
                    {diff.removed?.length > 0 && <li className="text-danger">来源失效 {diff.removed.length} 项：{diff.removed.slice(0, 5).map((d) => d.label).join('、')}</li>}
                  </ul>
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">当前独立副本与系统导航一致。</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button hidden={bootInfo.role==='operator'} size="sm" onClick={() => setConfirmImport('first')} disabled={saving}>
                  {total === 0 ? '导入系统导航' : '重新导入（覆盖当前副本）'}
                </Button>
                {(total > 0||bootInfo.role==='operator') && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmImport('merge')} disabled={saving}>
                    仅追加系统新增项（保留我已改的）
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 首页最近访问设置；访问记录存用户浏览器本地，这里只设展示策略 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-brand" aria-hidden="true" />最近访问
            {recentDirty && <Badge tone="warning">未保存</Badge>}
          </CardTitle>
          <CardDescription>
            控制会员首页顶部的最近访问栏。记录按会员分别保存在当前浏览器；没有记录时自动隐藏。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <SwitchControl
              label="启用最近访问"
              checked={!!recent.enabled}
              onCheckedChange={(v) => setRecent((r) => ({ ...r, enabled: v ? 1 : 0 }))}
            />
            <span className="text-[13px] text-muted-foreground">
              {recent.enabled ? '会员首页显示「' + (recent.title || '最近访问') + '」' : '会员首页不显示最近访问'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-1.5 block">区块标题</Label>
              <Input
                value={recent.title}
                maxLength={12}
                disabled={!recent.enabled}
                placeholder="最近访问"
                onChange={(e) => setRecent((r) => ({ ...r, title: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">保留天数</Label>
              <Input
                type="number" min={1} max={90}
                value={recent.days}
                disabled={!recent.enabled}
                onChange={(e) => setRecent((r) => ({ ...r, days: e.target.value }))}
                onBlur={(e) => setRecent((r) => ({ ...r, days: clampInt(e.target.value, 1, 90, RECENT_DEFAULTS.days) }))}
              />
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">只显示最近 1–90 天内访问过的页面</p>
            </div>
            <div>
              <Label className="mb-1.5 block">最多显示条数</Label>
              <Input
                type="number" min={1} max={20}
                value={recent.max_items}
                disabled={!recent.enabled}
                onChange={(e) => setRecent((r) => ({ ...r, max_items: e.target.value }))}
                onBlur={(e) => setRecent((r) => ({ ...r, max_items: clampInt(e.target.value, 1, 20, RECENT_DEFAULTS.max_items) }))}
              />
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">1–20 条，超出只显示最近访问的</p>
            </div>
            <div>
              <Label className="mb-1.5 block">打开方式</Label>
              <Select
                value={String(recent.new_tab || 0)}
                disabled={!recent.enabled}
                onChange={(e) => setRecent((r) => ({ ...r, new_tab: Number(e.target.value) }))}
              >
                <option value="0">当前页跳转</option>
                <option value="1">新标签页打开</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 树：紧凑表格式（表头 + 分级行 + 缩进导轨），参考系统商品分组编辑器 */}
      <Card>
        <CardHeader>
          <CardTitle>菜单结构</CardTitle>
          <CardDescription>
            一级分组显示在左侧入口，二级分组显示在展开面板中，三级页面显示为分组内的链接。每级都支持新增/编辑/删除与拖拽排序
            （拖到某一项上可将其变为子级，最多三级）；「显示」开关控制前台是否渲染该项。
            分界线只能放在一级菜单之间，可排序、隐藏或删除。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TreeSortEditor
            tree={nodes}
            setTree={setNodes}
            getLabel={(n) => n.label}
            renderMeta={(n) => TYPES.find(t=>t.value===n.source_type)?.label || '菜单'}
            isSeparator={isMenuSeparator}
            levelLabels={LEVEL_LABELS}
            isBranch={(node) => !isMenuSeparator(node) && nodeLevel(nodes, node.id) < 3 && !node.url}
            onEdit={(node) => setEditing({ ...node, __parentId: findNode(nodes, node.id)?.parentId })}
            onAddChild={(node) => setEditing({ ...emptyNode(), __parentId: node?.id || null, source_type: 'custom' })}
            onDelete={(node) => setConfirmDel(node)}
            onToggleHidden={(node) => setNodes((list) => replaceNode(list, node.id, (x) => ({ ...x, hidden: x.hidden ? 0 : 1 })))}
            addLabel={nodes.length === 0 ? '添加一级分组' : '新增菜单'}
            onReject={(msg) => toast(msg, 'error')}
          />
        </CardContent>
      </Card>

      {/* 菜单项编辑：所有参数在一个表单 */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[86vh] max-w-[640px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id && findNode(nodes, editing.id) ? '编辑菜单项' : '新增菜单项'}</DialogTitle>
            <DialogDescription>
              该菜单项的全部参数都在此设置；类型决定需要填写哪些内容
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <NodeForm
              value={editing}
              catalog={cat}
              nodes={nodes}
              onChange={setEditing}
              onSubmit={saveNode}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 导入确认 */}
      <ConfirmDialog
        open={!!confirmImport}
        title={confirmImport === 'merge' ? '追加系统新增项' : '导入系统导航'}
        description={confirmImport === 'merge'
          ? '保留你已编辑的菜单，只把系统导航中新增的项追加到副本末尾。'
          : '将用系统导航覆盖当前独立副本（自定义菜单与排序会丢失）。此操作不影响系统导航本身。'}
        confirmText={confirmImport === 'merge' ? '追加' : '覆盖导入'}
        tone={confirmImport === 'merge' ? 'default' : 'danger'}
        busy={saving}
        onConfirm={() => doImport(confirmImport)}
        onCancel={() => setConfirmImport(null)}
      />

      {/* 悬浮操作条：页头按钮滚出视野后出现，承载同一组操作 */}
      {!workspace && (<FloatingActions
        anchorRef={actionsRef}
        saving={saving}
        dirtyCount={dirty ? 1 : 0}
        dirtyLabel="有未保存修改"
        onSave={save}
        onRevert={() => {
          setNodes(JSON.parse(JSON.stringify(original)))
          setRecent(JSON.parse(JSON.stringify(recentOriginal)))
        }}
        revertLabel="撤销"
        revertDisabled={!dirty}
      />)}

      <ConfirmDialog
        open={!!confirmDel}
        title="删除菜单项"
        description={confirmDel ? `确认删除「${confirmDel.label}」${confirmDel.children?.length ? `及其 ${countAll(confirmDel.children)} 个子项` : ''}？` : ''}
        confirmText="删除"
        tone="danger"
        onConfirm={() => { setNodes((list) => removeNode(list, confirmDel.id)); setConfirmDel(null) }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function typeLabel(t) {
  return (TYPES.find((x) => x.value === t) || { label: t }).label
}

/* -------------------------------------------------------------------------- */
/* 菜单项表单：一次编辑全部参数                                                  */
/* -------------------------------------------------------------------------- */

function NodeForm({ value, catalog, nodes, onChange, onSubmit, onCancel }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  const type = value.source_type
  const isSystemLike = type === 'system' || type === 'plugin'
  const allIds = collectIds(nodes)
  const depth = value.__parentId ? nodeLevel(nodes, value.__parentId) + 1 : 1
  const isGroup = depth < 3 && type === 'custom'

  const navOptions = useMemo(() => {
    const navs = catalog?.navs || []
    if (type === 'plugin') return navs.filter((n) => n.is_plugin)
    if (type === 'system') return navs.filter((n) => !n.is_plugin)
    return navs
  }, [catalog, type])

  const pickedNav = (catalog?.navs || []).find((n) => Number(n.id) === Number(value.source_nav_id))

  if (isMenuSeparator(value)) return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...value, label: value.label.trim() || '分界线', source_type: 'separator', url: '', icon: '', children: [] }) }}>
      <p className="text-sm text-muted-foreground">前台只显示横线；下方名称用于后台识别。可在菜单列表里调整位置。</p>
      <div><Label className="mb-1.5 block" htmlFor="separator-name">分界线名称</Label><Input id="separator-name" value={value.label} onChange={(e) => set('label', e.target.value)} /></div>
      <div role="separator" className="border-t border-line" />
      <SwitchControl label="显示分界线" checked={!value.hidden} onCheckedChange={(shown) => set('hidden', shown ? 0 : 1)} />
      <DialogFooter><Button type="button" variant="outline" onClick={onCancel}>取消</Button><Button type="submit">应用到草稿</Button></DialogFooter>
    </form>
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        const err = validate(value, depth)
        if (err) { alert(err); return }
        const next = { ...value }
        for (const key of ['module', 'res_module', 'select_field']) {
          if (typeof next[key] === 'string') next[key] = next[key].split(',').map((x) => x.trim()).filter(Boolean)
        }
        if (typeof next.product_id === 'string') {
          const parts = next.product_id.split(',').map((x) => x.trim()).filter(Boolean)
          if (parts.some((x) => !/^\d+$/.test(x) || Number(x) < 1)) { alert('商品 ID 必须是正整数，多个以逗号分隔'); return }
          next.product_id = parts.map(Number)
        }
        onSubmit(next)
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">菜单类型 *</Label>
          <Select aria-label="菜单类型" value={type} onChange={(e) => e.target.value === 'separator' ? onChange(emptyNode({ id: value.id, label: '分界线', source_type: 'separator', hidden: value.hidden })) : set('source_type', e.target.value)}>
            {TYPES.filter((t) => t.value !== 'separator' || (!value.__parentId && !(value.children || []).length)).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {(TYPES.find((t) => t.value === type) || {}).desc}
          </p>
        </div>
        <div>
          <Label className="mb-1.5 block">显示名称 *</Label>
          <Input aria-label="显示名称" value={value.label} placeholder="例如：账户信息" onChange={(e) => set('label', e.target.value)} />
        </div>
      </div>

      {isSystemLike ? (
        <div>
          <Label className="mb-1.5 block">来源导航 *</Label>
          <Select aria-label="来源导航" value={String(value.source_nav_id || '')} onChange={(e) => {
            const nav = (catalog?.navs || []).find((n) => String(n.id) === e.target.value)
            onChange({
              ...value,
              source_nav_id: Number(e.target.value) || 0,
              // 选中系统导航后自动带出名称/链接/图标，避免手填错
              url: nav?.url || value.url,
              icon: nav?.icon || value.icon,
              label: value.label || nav?.name || '',
            })
          }}>
            <option value="">请选择来源</option>
            {navOptions.map((n) => (
              <option key={n.id} value={n.id}>{n.name || '系统页面'}</option>
            ))}
          </Select>
          {pickedNav && (
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              将跳转：<code className="rounded bg-muted-bg px-1 font-mono">{pickedNav.url || '（该导航无链接）'}</code>
            </p>
          )}
        </div>
      ) : null}

      {type === 'custom' || type === 'embedded' || type === 'module' ? (
        <div>
          <Label className="mb-1.5 block">
            链接地址 {isGroup ? '（分组可留空）' : type === 'module' ? '（可留空，自动进入本分类的产品列表）' : '*'}
          </Label>
          <LinkPicker label="菜单跳转链接" value={value.url} onChange={v=>set('url',v)}/>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            可选择站内页面、商品和联系方式，也可以填写外部网址。
          </p>
        </div>
      ) : null}

      {type === 'module' ? <div className="space-y-5 rounded-lg border border-line p-4">
        <MultiChoice label="此分类关联的商品" options={(catalog?.products||[]).map(p=>({value:p.id,label:[p.group,p.sub,p.name].filter(Boolean).join(' / ')}))} value={value.product_id} onChange={v=>set('product_id',v)}/>
        <p className="text-xs text-muted-foreground">首页和产品列表只展示此处关联的商品，不同服务器模块的商品可以放在同一分类。未关联商品时，此分类显示为空；所有商品仍可在“全部分类”查看。</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!(value.select_field_set||value.select_field?.length)} onChange={e=>onChange({...value,select_field:e.target.checked?[]:[...memberDisplayFields(value)],select_field_set:!e.target.checked,select_field_version:2})}/>使用默认显示信息</label>
        <MultiChoice label="列表显示信息" options={FILTERS} value={[...memberDisplayFields(value)]} onChange={v=>onChange({...value,select_field:v,select_field_set:true,select_field_version:2})}/>
        <p className="text-xs text-muted-foreground">勾选项与前台实际显示一致。商品名称和实例名称可分别控制；两者都关闭时，卡片用产品编号作为访问入口。</p>
        <details className="advanced-details"><summary>高级：旧版模块页面与兼容设置</summary>
          <p className="text-xs text-muted-foreground">以下模块设置供旧版模块产品页面使用，不决定新版首页和产品列表的商品归属。</p>
          <MultiChoice label="旧版页面的本地模块" options={(catalog?.modules||[]).map(m=>({value:m.name,label:m.label}))} value={value.module} onChange={v=>set('module',v)}/>
          <MultiChoice label="旧版页面的上游模块" options={(catalog?.res_modules||[]).map(m=>({value:m.name,label:m.label}))} value={value.res_module} onChange={v=>set('res_module',v)}/>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!value.is_cross_module} onChange={e=>set('is_cross_module',e.target.checked?1:0)}/>旧版页面合并不同模块的产品</label>
          {[['module','本地模块标识'],['res_module','上游模块标识'],['product_id','关联商品编号'],['select_field','特殊显示字段']].map(([key,label])=><div key={key}><Label>{label}</Label><Input value={Array.isArray(value[key])?value[key].join(','):value[key]||''} onChange={e=>set(key,e.target.value)}/></div>)}
        </details>
      </div> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <MenuIcon value={value.icon} iconStyle={value.icon_style} label={value.label} onChange={(icon,icon_style)=>onChange({...value,icon,icon_style})}/>
        </div>
        <div>
          <Label className="mb-1.5 block">父级</Label>
          <Select
            value={value.__parentId || ''}
            onChange={(e) => set('__parentId', e.target.value || null)}
            disabled={!!findNode(nodes, value.id)}
          >
            <option value="">（作为一级菜单）</option>
            {allIds.filter((id) => id !== value.id).map((id) => {
              const hit = findNode(nodes, id)
              if (!hit) return null
              if (isMenuSeparator(hit.node)) return null
              if (nodeLevel(nodes, id) >= 3) return null
              // 禁止挂到自己的后代下（会造成环）
              if (findNode(nodes, value.id) && collectDescendants(findNode(nodes, value.id).node).includes(id)) return null
              return <option key={id} value={id}>{hit.node.label}</option>
            })}
          </Select>
        </div>
      </div>

      {type === 'custom' ? (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={!!value.second_reminder} onChange={(e) => set('second_reminder', e.target.checked ? 1 : 0)} />
          外链二次提醒（站外链接先跳转确认页再打开）
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={!!value.hidden} onChange={(e) => set('hidden', e.target.checked ? 1 : 0)} />
        隐藏（前台不显示，仍保留可恢复）
      </label>

      <LanguageNames value={value.language} onChange={v=>set('language',v)}/>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button type="submit">应用到草稿</Button>
      </DialogFooter>
    </form>
  )
}

function nodeLevel(nodes, id, depth = 1) {
  for (const node of nodes || []) {
    if (node.id === id) return depth
    const found = nodeLevel(node.children, id, depth + 1)
    if (found) return found
  }
  return 0
}

function validate(v, depth = 3) {
  if (!String(v.label || '').trim() && !(v.children || []).length) return '请填写显示名称'
  if ((v.source_type === 'system' || v.source_type === 'plugin') && !v.source_nav_id) {
    return '系统页面/插件页面必须选择来源导航'
  }
  const isSeparator = String(v.label || '').trim() === '分隔符'
  if ((v.source_type === 'custom' || v.source_type === 'embedded')
      && !String(v.url || '').trim() && !isSeparator && !(v.children || []).length
      && !(v.source_type === 'custom' && depth < 3)) {
    return '请填写链接地址'
  }
  if (v.url && /^\/\//.test(v.url)) return '链接不能以 // 开头'
  return ''
}
