import IconPicker from '../ui/IconPicker'
import { useScopedState } from '../lib/workspace'
import RichText from '../components/RichText'
import MediaPicker from '../components/MediaPicker'
import LinkPicker from './LinkPicker'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Save, RotateCcw, Plus, Trash2, Pencil, Power, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Input, Label, Select, Textarea } from '@ui/input'
import { Badge, Alert, Skeleton } from '@ui/feedback'
import { useToast } from '@ui/toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/dialog'
import SwitchControl from '../ui/Switch'
import { FloatingActions } from '../ui/FloatingActions'
import { DragHandle, DropBadge, DRAG_LIST_BASE, RowIconBtn, dragRowClass, useFlatDrag, DragAnnouncer } from '../ui/dragSort'
import { TreeSortEditor, findNode, replaceNode, removeNode } from '../ui/treeSort'
import { cn } from '@ui/utils'
import { memberApi } from '../lib/api'
import { homeArticleCatalog, productListTree } from '../lib/member-content'
import ProductListEntries from './ProductListEntries'

/** 会员中心页面内容：产品说明、首页区块及工单助手。 */

/** 生成侧栏节点同形状的 UUID（保存时服务端校验/补发） */
function genId() {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function Toggle({ label, desc, on, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {desc && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{desc}</p>}
      </div>
      <SwitchControl label={label} checked={on} onCheckedChange={onChange} />
    </div>
  )
}

/** 产品列表顶部文案编辑弹窗（全局默认 / 覆盖项共用） */
function ProductForm({ title, value, onSubmit, onCancel }) {
  const [form, setForm] = useState(value)
  const set = (patch) => setForm({ ...form, ...patch })
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}><DialogContent className="max-w-[640px]"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>修改后应用到当前草稿</DialogDescription></DialogHeader>
      <form
        className="w-full space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(form)
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <button type="button" aria-label="取消" className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-accent" onClick={onCancel}><X className="size-3.5" aria-hidden="true" /></button>
        </div>

        <Toggle
          label="启用本配置"
          desc="关闭时该入口回到主题内置的默认标题"
          on={Number(form.enabled) === 1}
          onChange={(v) => set({ enabled: v ? 1 : 0 })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">标题</Label>
            <Input aria-label="标题" value={form.title} placeholder="例如：产品与服务"
                   onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block">副标题 / 描述</Label>
            <Input aria-label="副标题 / 描述" value={form.description} placeholder="例如：查看与管理您的云资源"
                   onChange={(e) => set({ description: e.target.value })} />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block">顶部介绍内容</Label>
          <RichText label="顶部介绍内容" value={form.html} onChange={v=>set({html:v})}/>

        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button type="submit" size="sm">应用到草稿</Button>
        </div>
      </form>
    </DialogContent></Dialog>
  )
}

export default function MemberContent({ workspace, scope = 'home', block }) {
  /* 页头操作区引用：悬浮操作条观察它是否滚出视野。
     必须声明在**本组件的第一个 Hook 位置**且早于任何提前 return，
     否则会触发 React #300（Rendered more hooks than during the previous render）。
     注意：不能插到同文件里的子组件（如 ProductForm）内——那是另一个组件的作用域。 */
  const actionsRef = useRef(null)
  const toast = useToast()
  const [content, setContent] = useScopedState(workspace, 'content', null)
  const [original, setOriginal] = useScopedState(workspace, 'content', null, true)
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(!workspace)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [productNodes, setProductNodes] = useState([])
  const [plistEditing, setPlistEditing] = useState(null) // 被编辑的产品列表入口（含 key/kind）


  useEffect(() => {
    if (workspace) { memberApi.get().then((r) => { if (r.status === 200) setProductNodes(productListTree(r.data?.config?.sidebar?.nodes || [])) }).catch(() => {}); return }
    setLoading(true)
    setError('')
    Promise.all([memberApi.contentGet(), memberApi.get()])
      .then(([c, m]) => {
        const raw = c.data.content
        setContent(raw)
        setOriginal(JSON.parse(JSON.stringify(raw)))
        setVersion(c.data.version)
        setProductNodes(productListTree(m.data?.config?.sidebar?.nodes || []))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const dirtyCount = useMemo(() => {
    if (!content || !original) return 0
    return Object.keys(content).filter((k) => JSON.stringify(content[k]) !== JSON.stringify(original[k])).length
  }, [content, original])

  if (loading || (!content && !error)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error) return <Alert tone="error">会员中心内容配置加载失败：{error}</Alert>

  function setContentSection(key, next) {
    setContent((c) => ({ ...c, [key]: next }))
  }

  async function save() {
    if (workspace) return workspace.save()
    setSaving(true)
    try {
      const r = await memberApi.saveContent({ content, version })
      if (r.status === 200) {
        toast(r.msg || '已保存，会员中心前台已生效')
        const next = r.data?.config?.content || content
        setContent(next)
        setOriginal(JSON.parse(JSON.stringify(next)))
        setVersion(r.data?.config?.version || version + 1)
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="内容设置"
        description="会员中心页面文案与公告；与官网主题配置完全独立"
        actions={
          <div ref={actionsRef} data-page-actions className="flex items-center gap-2">
            {dirtyCount > 0 && <Badge tone="warning">{dirtyCount} 项未保存</Badge>}
            <Button variant="outline" size="sm" disabled={!dirtyCount}
                    onClick={() => setContent(JSON.parse(JSON.stringify(original)))}>
              <RotateCcw className="size-3.5" />撤销
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !dirtyCount}>
              <Save className="size-3.5" />{saving ? '保存中…' : '保存'}
            </Button>
          </div>
        }
      />

      {/* ─────────────── 1. 产品列表顶部 ─────────────── */}
      {scope === 'products' && (
      <Card>
        <CardHeader>
          <CardTitle>产品列表顶部</CardTitle>
          <CardDescription>
            「我的产品 / 各分类产品列表」页面的标题、说明与顶部介绍。
            全局默认作用于所有产品列表入口；每个菜单可单独设置。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg border border-dashed border-line bg-surface-alt/40 px-4 py-3 text-[13px] leading-5 text-muted-foreground">
            下方按会员菜单的分组、层级和顺序展示。点击“编辑”修改对应入口的标题、说明和介绍。
            菜单层级与顺序请在「公共设置 → 菜单」中调整。
          </p>
          <ProductListEntries tree={productNodes} config={content.product_list}
            onEdit={(node, value) => setPlistEditing({ key: node?.id, kind: node ? 'override' : 'default', label: node?.label, value })}
            onToggle={(node, value) => setContentSection('product_list', { ...content.product_list, overrides: { ...content.product_list.overrides, [node.id]: { ...value, enabled: Number(value.enabled) === 1 ? 0 : 1 } } })}
          />

          {plistEditing && (
            <ProductForm
              title={plistEditing.kind === 'default' ? '编辑：全局默认' : '编辑：' + plistEditing.label}
              value={plistEditing.value}
              onCancel={() => setPlistEditing(null)}
              onSubmit={(block) => {
                const { key, kind } = plistEditing
                if (kind === 'default') {
                  setContentSection('product_list', { ...content.product_list, default: block })
                } else {
                  setContentSection('product_list', {
                    ...content.product_list,
                    overrides: { ...content.product_list.overrides, [key]: block },
                  })
                }
                setPlistEditing(null)
              }}
            />
          )}
        </CardContent>
      </Card>
      )}

      {/* ─────────────── 3. 首页快捷入口（按条编辑 + 拖拽排序） ─────────────── */}
      {scope === 'home' && (!block||block==='quick') && (<QuickLinksCard
        content={content}
        setContentSection={setContentSection}
      />)}

      {/* ─────────────── 4. 首页到期续费待办 ─────────────── */}
      {scope === 'home' && (!block||block==='todo') && (<HomeTodoCard
        content={content}
        setContentSection={setContentSection}
      />)}

      {/* ─────────────── 4b. 服务器面板「订单记录」 ─────────────── */}
      {scope === 'server' && (<HostOrdersCard
        content={content}
        setContentSection={setContentSection}
      />)}

      {/* ─────────────── 5. 首页推荐位 ─────────────── */}
      {scope === 'home' && (!block||block==='banner') && (<HomeBannerCard
        content={content}
        setContentSection={setContentSection}
      />)}

      {/* ─────────────── 6. 首页公告时间轴 ─────────────── */}
      {scope === 'home' && (!block||block==='news') && (<HomeNewsCard
        content={content}
        setContentSection={setContentSection}
      />)}

      {/* ─────────────── 7. 首页账户安全概览 ─────────────── */}
      {scope === 'home' && (!block||block==='security') && (<HomeSecurityCard
        content={content}
        setContentSection={setContentSection}
      />)}

      {/* ─────────────── 8. 工单提交助手（主题层增强，不改插件） ─────────────── */}
      {scope === 'ticket' && (<TicketAssistCard
        content={content}
        setContentSection={setContentSection}
      />)}



      {/* 悬浮操作条：页头按钮滚出视野后出现，承载同一组操作 */}
      {!workspace && (<FloatingActions
        anchorRef={actionsRef}
        saving={saving}
        dirtyCount={dirtyCount}
        dirtyLabel={`${dirtyCount} 项未保存`}
        onSave={save}
        onRevert={() => setContent(JSON.parse(JSON.stringify(original)))}
        revertLabel="撤销"
        revertDisabled={!dirtyCount}
      />)}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 首页快捷入口（按条编辑 + 拖拽排序，同公告一套交互）                            */
/* -------------------------------------------------------------------------- */

/** 图标预设（与前台 home.jsx QUICK_ICONS、服务端 allowedIcons 三方一致） */
const QUICK_ICON_OPTIONS = [
  { value: 'wallet', label: '钱包（财务）' },
  { value: 'package', label: '包裹（产品）' },
  { value: 'arrow-up-right', label: '外向箭头（提现/跳转）' },
  { value: 'life-buoy', label: '救生圈（工单/支持）' },
  { value: 'users', label: '用户组（子账户）' },
  { value: 'shield', label: '盾牌（安全）' },
  { value: 'newspaper', label: '报纸（公告）' },
  { value: 'shopping-cart', label: '购物车' },
  { value: 'file-text', label: '文档（文件下载）' },
  { value: 'server', label: '服务器' },
  { value: 'credit-card', label: '银行卡（支付）' },
  { value: 'lock', label: '锁（密码/密钥）' },
  { value: 'clock', label: '时钟（记录）' },
  { value: 'gift', label: '礼物（活动）' },
  { value: 'headphones', label: '耳机（客服）' },
]

function QuickLinksCard({ content, setContentSection }) {
  const live = content.home_quick_links || { enabled: 0, items: [] }
  const items = live.items || []
  const setItems = (next) => setContentSection('home_quick_links', { ...live, items: next })
  const [editing, setEditing] = useState(null)
  const [liveMsg, setLiveMsg] = useState('')

  const drag = useFlatDrag({
    count: () => items.length,
    onMove: (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return
      const next = items.slice()
      const [it] = next.splice(from, 1)
      next.splice(to, 0, it)
      setItems(next)
    },
    keyOf: (it) => it?.id,
    onAnnounce: (msg) => setLiveMsg(msg),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>首页快捷入口</CardTitle>
        <CardDescription>
          控制台首页「常用功能」宫格，按条编辑、拖拽排序（手柄拖动，或键盘空格抓取后用方向键）。
          服务端会校验链接与图标，非法条目不入库；最多 12 个。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Toggle
          label="启用首页快捷入口"
          desc="总开关：关闭时前台首页不显示宫格"
          on={Number(live.enabled) === 1}
          onChange={(v) => setContentSection('home_quick_links', { ...live, enabled: v ? 1 : 0 })}
        />

        <div>
          <Button variant="outline" size="sm" disabled={items.length >= 12}
                  onClick={() => setEditing({ id: genId(), label: '', url: '', icon: 'package', enabled: 1 })}>
            <Plus className="size-3.5" />添加入口
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface-alt/40 px-4 py-3 text-[13px] text-muted-foreground">
            还没有入口。点击「添加入口」创建，或关闭开关隐藏宫格。
          </p>
        ) : (
          <ul className={DRAG_LIST_BASE}>
            {items.map((it, i) => (
              <li
                key={it.id || i}
                draggable
                {...drag.itemProps(i)}
                className={dragRowClass({ isDragging: drag.isDragging(i), isOver: drag.isOver(i) })}
              >
                <DragHandle {...drag.handleProps(i, '拖拽排序：' + it.label)} />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 truncate text-[13px] text-ink">{it.label || '（未命名）'}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{it.url}</span>
                  {Number(it.enabled) !== 1 && <Badge tone="muted">停用</Badge>}
                </div>
                {drag.isOver(i) && <DropBadge pos={drag.dropPos} />}
                <div className="flex shrink-0 items-center gap-0.5">
                  <RowIconBtn label="编辑" onClick={() => setEditing({ ...it, __index: i })}>
                    <Pencil className="size-3.5" />
                  </RowIconBtn>
                  <RowIconBtn
                    label={Number(it.enabled) === 1 ? '停用' : '启用'}
                    onClick={() => setItems(items.map((x, k) => (k === i ? { ...x, enabled: Number(x.enabled) === 1 ? 0 : 1 } : x)))}
                  >
                    <Power className="size-3.5" />
                  </RowIconBtn>
                  <RowIconBtn label="删除" danger onClick={() => setItems(items.filter((_, k) => k !== i))}>
                    <Trash2 className="size-3.5" />
                  </RowIconBtn>
                </div>
              </li>
            ))}
          </ul>
        )}
        <DragAnnouncer message={liveMsg} />

        {editing && (
          <QuickLinkForm
            value={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(v) => {
              // 编辑既有行：按 __index 原位替换（不依赖 id 是否变化）；
              // 新增行：先查 id 冲突再追加。
              // 此前用 `k !== editing.__index` 判重，而 __index 从未被赋值（恒 undefined）
              // → 编辑任何行都会换新 id 并追加一份副本，原行保留（“编辑变新增”的真实事故）。
              const ei = editing.__index
              if (typeof ei === 'number' && ei >= 0 && ei < items.length) {
                setItems(items.map((x, k) => (k === ei ? v : x)))
              } else {
                if (items.some((x) => x.id === v.id)) {
                  v = { ...v, id: genId() }
                }
                setItems([...items, v])
              }
              setEditing(null)
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}

function QuickLinkForm({ value, onSubmit, onCancel }) {
  const [local, setLocal] = useState(value)
  const setL = (k, v) => setLocal((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}><DialogContent><DialogHeader><DialogTitle>编辑快捷入口</DialogTitle><DialogDescription>修改后应用到当前草稿</DialogDescription></DialogHeader>
    <form
      className="space-y-4 rounded-lg border border-line bg-surface-alt/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!String(local.label || '').trim()) return alert('请填写名称')
        if (!String(local.url || '').trim()) return alert('请填写链接地址')
        // 剔除仅用于定位行的 __index（避免写入配置数据）
        const { __index: _omit, ...payload } = local
        onSubmit({ ...payload, label: String(local.label).trim(), url: String(local.url).trim() })
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">名称 *（≤12 字）</Label>
          <Input value={local.label} maxLength={12} placeholder="例如：财务中心"
                 onChange={(e) => setL('label', e.target.value)} />
        </div>
        <div>
          <Label className="mb-1.5 block">链接地址 *</Label>
          <Input value={local.url} placeholder="finance.htm"
                 onChange={(e) => setL('url', e.target.value)} />
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">可以选择站内页面、商品或填写外部链接。</p>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block">图标</Label>
        <IconPicker label="快捷入口图标" value={local.icon || ''} iconStyle={local.icon_style} context="member-quick" defaultKey="legacy:quick:package" onChange={(icon,icon_style)=>setLocal(old=>({...old,icon,icon_style}))}/>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={Number(local.enabled) === 1}
               onChange={(e) => setL('enabled', e.target.checked ? 1 : 0)} />
        启用（前台显示）
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button type="submit">应用到草稿</Button>
      </div>
    </form></DialogContent></Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* 首页「到期续费待办」卡（展示策略：标题/天数窗口/条数；数据来自 /index/host）  */
/* -------------------------------------------------------------------------- */
function HomeTodoCard({ content, setContentSection }) {
  const live = content.home_todo || { enabled: 1, title: '待办事项', days: 30, limit: 5 }
  const setF = (k, v) => setContentSection('home_todo', { ...live, [k]: v })

  return (
    <Card>
      <CardHeader>
        <CardTitle>首页 · 待办事项</CardTitle>
        <CardDescription>
          控制台首页的待办卡：分类展示「待续费产品」（几天内到期，带去续费）与
          「待回复工单」（客服已回复等待处理）。天数窗口只作用于待续费；
          工单数量固定取最近数据。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Toggle
          label="启用待办事项"
          desc="总开关：关闭时前台首页不显示该卡"
          on={Number(live.enabled) === 1}
          onChange={(v) => setF('enabled', v ? 1 : 0)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label className="mb-1.5 block">卡片标题（≤20 字）</Label>
            <Input value={live.title} maxLength={20}
                   onChange={(e) => setF('title', e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block">到期窗口（天，7-90）</Label>
            <Input type="number" min={7} max={90} value={live.days}
                   onChange={(e) => setF('days', Number(e.target.value) || 30)} />
            <p className="mt-1.5 text-xs text-muted-foreground">几天内到期的产品会出现在待办里</p>
          </div>
          <div>
            <Label className="mb-1.5 block">最多显示（条，3-10）</Label>
            <Input type="number" min={3} max={10} value={live.limit}
                   onChange={(e) => setF('limit', Number(e.target.value) || 5)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* 服务器面板「订单记录」标签页（productdetail 云实例控制面板）                    */
/* 默认值与前台原硬编码一致（开 / 单次 100 条 / 上限 1000 条），未配置行为不变。     */
/* -------------------------------------------------------------------------- */
function HostOrdersCard({ content, setContentSection }) {
  const live = content.host_orders || { enabled: 1, fetch_page: 100, fetch_max: 1000 }
  const setF = (k, v) => setContentSection('host_orders', { ...live, [k]: v })
  const page = Number(live.fetch_page) || 100
  const max = Number(live.fetch_max) || 1000

  return (
    <Card>
      <CardHeader>
        <CardTitle>服务器面板 · 订单记录</CardTitle>
        <CardDescription>
          云服务器管理面板中的「订单记录」标签页：展示该实例关联的订单（含后台人工订单），
          支持未支付订单快捷支付与跳转订单详情。关闭后前台不显示该标签、也不发起订单查询请求。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Toggle
          label="启用订单记录标签页"
          desc="总开关：关闭时服务器面板不显示「订单记录」标签"
          on={Number(live.enabled) === 1}
          onChange={(v) => setF('enabled', v ? 1 : 0)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">单次拉取条数（10-200）</Label>
            <Input type="number" min={10} max={200} value={page}
                   onChange={(e) => setF('fetch_page', Number(e.target.value) || 100)} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              每次接口请求的订单条数，订单多时自动翻页取全；数值越大首次加载越慢
            </p>
          </div>
          <div>
            <Label className="mb-1.5 block">拉取上限（100-5000）</Label>
            <Input type="number" min={100} max={5000} value={max}
                   onChange={(e) => setF('fetch_max', Number(e.target.value) || 1000)} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              单台服务器最多拉取的订单总数，超出后在面板内提示前往财务页查看
            </p>
          </div>
        </div>
        {max < page ? (
          <Alert tone="warning">
            拉取上限（{max}）小于单次拉取条数（{page}），保存时上限会自动提升为 {page}。
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* 首页「推荐位」（图文卡 ≤3 条：促销/机房维护公告式营销位）                      */
/* -------------------------------------------------------------------------- */
function HomeBannerCard({ content, setContentSection }) {
  const live = content.home_banner || { enabled: 0, items: [] }
  const items = live.items || []
  const setItems = (next) => setContentSection('home_banner', { ...live, items: next })
  const [editing, setEditing] = useState(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>首页 · 推荐位</CardTitle>
        <CardDescription>
          控制台首页的横向图文卡（促销活动、机房维护公告等）。最多 3 条；
          不传图片时前台用品牌色渐变底 + 标题。服务端校验链接，非法条目不入库。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Toggle
          label="启用推荐位"
          desc="总开关：关闭时前台首页不显示推荐位"
          on={Number(live.enabled) === 1}
          onChange={(v) => setContentSection('home_banner', { ...live, enabled: v ? 1 : 0 })}
        />

        <div>
          <Button variant="outline" size="sm" disabled={items.length >= 3}
                  onClick={() => setEditing({ id: genId(), title: '', description: '', link: '', image: '', enabled: 1 })}>
            <Plus className="size-3.5" />添加推荐
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface-alt/40 px-4 py-3 text-[13px] text-muted-foreground">
            还没有推荐内容。点击「添加推荐」创建，或保持关闭隐藏该区块。
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={it.id || i} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 truncate text-[13px] text-ink">{it.title || '（未命名）'}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{it.link}</span>
                  {Number(it.enabled) !== 1 && <Badge tone="muted">停用</Badge>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <RowIconBtn label="编辑" onClick={() => setEditing({ ...it, __index: i })}>
                    <Pencil className="size-3.5" />
                  </RowIconBtn>
                  <RowIconBtn
                    label={Number(it.enabled) === 1 ? '停用' : '启用'}
                    onClick={() => setItems(items.map((x, k) => (k === i ? { ...x, enabled: Number(x.enabled) === 1 ? 0 : 1 } : x)))}
                  >
                    <Power className="size-3.5" />
                  </RowIconBtn>
                  <RowIconBtn label="删除" danger onClick={() => setItems(items.filter((_, k) => k !== i))}>
                    <Trash2 className="size-3.5" />
                  </RowIconBtn>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editing && (
          <BannerForm
            value={editing}
            onCancel={() => setEditing(null)}
              onSubmit={(v) => {
                const { __index, ...payload } = v
              setItems(items.some((x, k) => x.id === v.id)
                  ? items.map((x) => (x.id === v.id ? payload : x))
                  : [...items, payload])
              setEditing(null)
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}

function BannerForm({ value, onSubmit, onCancel }) {
  const [local, setLocal] = useState(value)
  const setL = (k, v) => setLocal((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}><DialogContent><DialogHeader><DialogTitle>编辑推荐位</DialogTitle><DialogDescription>修改后应用到当前草稿</DialogDescription></DialogHeader>
    <form
      className="space-y-4 rounded-lg border border-line bg-surface-alt/40 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!String(local.title || '').trim()) return alert('请填写标题')
        if (!String(local.link || '').trim()) return alert('请填写跳转链接')
        onSubmit({
          ...local,
          title: String(local.title).trim(),
          description: String(local.description || '').trim(),
          link: String(local.link).trim(),
          image: String(local.image || '').trim(),
        })
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">标题 *（≤30 字）</Label>
          <Input value={local.title} maxLength={30} placeholder="例如：新用户云服务器 2.5 折"
                 onChange={(e) => setL('title', e.target.value)} />
        </div>
        <div>
          <Label className="mb-1.5 block">跳转链接 *</Label>
          <LinkPicker label="横幅跳转链接" value={local.link} onChange={v=>setL('link',v)}/>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">可以选择站内页面、商品或填写外部链接。</p>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block">描述（≤60 字，可选）</Label>
        <Input value={local.description} maxLength={60} placeholder="一句话说明活动内容"
               onChange={(e) => setL('description', e.target.value)} />
      </div>
      <div>
        <Label className="mb-1.5 block">横幅图片（可选，留空显示渐变背景）</Label>
        <MediaPicker label="横幅图片" value={local.image} onChange={v=>setL('image',v)}/>
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={Number(local.enabled) === 1}
               onChange={(e) => setL('enabled', e.target.checked ? 1 : 0)} />
        启用（前台显示）
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button type="submit">应用到草稿</Button>
      </div>
    </form></DialogContent></Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* 首页「公告时间轴」（enabled/type_id 分类/limit 条数）                          */
/* -------------------------------------------------------------------------- */
function HomeNewsCard({ content, setContentSection }) {
  const live = content.home_news || { enabled: 1, title: '公告', description: '产品动态与重要通知', source: 'news', type_id: 0, limit: 6 }
  const setF = (k, v) => setContentSection('home_news', { ...live, [k]: v })
  const sources = { news: '新闻', announcement: '公告', help: '帮助文档' }
  const source = Object.hasOwn(sources, live.source) ? live.source : 'news'
  const [catalog, setCatalog] = useState(null)
  const types = catalog?.[source]?.types || []
  const [catalogError,setCatalogError] = useState('')
  const [attempt,setAttempt] = useState(0)
  const [catalogLoading, setCatalogLoading] = useState(true)

  useEffect(() => {
    let active = true
    setCatalogError('')
    setCatalogLoading(true)
    memberApi.contentCatalog()
      .then(homeArticleCatalog)
      .then((catalog) => { if (active) setCatalog(catalog) })
      .catch((e) => { if (active) setCatalogError(e.message) })
      .finally(() => { if (active) setCatalogLoading(false) })
    return () => { active = false }
  }, [attempt])

  return (
    <Card>
      <CardHeader>
        <CardTitle>首页 · 文章时间轴</CardTitle>
        <CardDescription>
          自定义前台标题，选择新闻、公告或帮助文档及其分类。
          内容由 V10 对应插件管理，选择「全部分类」时展示该来源的内容。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {catalogError && <Alert tone="warning">{catalogError}<Button className="ml-3" variant="outline" onClick={() => setAttempt((n) => n+1)}>重试分类</Button></Alert>}
        {!catalogError && catalog && !catalog[source]?.enabled && <Alert>{sources[source]}插件当前不可用，设置将保留，插件恢复后生效。</Alert>}
        <Toggle
          label="启用文章时间轴"
          desc="总开关：关闭时前台首页不显示该卡"
          on={Number(live.enabled) === 1}
          onChange={(v) => setF('enabled', v ? 1 : 0)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>前台标题</Label>
            <Input aria-label="文章时间轴前台标题" maxLength={40} value={live.title ?? '公告'} placeholder="例如：新闻动态、帮助指南" onChange={e => setF('title', e.target.value)} />
          </div>
          <div>
            <Label>补充说明（可选）</Label>
            <Input aria-label="文章时间轴补充说明" maxLength={120} value={live.description ?? '产品动态与重要通知'} placeholder="显示在标题下方，留空不显示" onChange={e => setF('description', e.target.value)} />
          </div>
          <div>
            <Label>内容来源</Label>
            <Select aria-label="文章时间轴内容来源" value={source} onChange={e => setContentSection('home_news', { ...live, source: e.target.value, type_id: 0 })}>
              {Object.entries(sources).map(([key, label]) => <option key={key} value={key}>{label}{catalog && !catalog[key]?.enabled ? '（当前不可用）' : ''}</option>)}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">显示的分类</Label>
            <Select aria-label="显示的分类" disabled={catalogLoading || !!catalogError} value={String(live.type_id ?? 0)}
                    onChange={(e) => setF('type_id', Number(e.target.value))}>
              <option value={0}>{catalogLoading ? '正在读取分类…' : '全部分类'}</option>
              {Number(live.type_id) > 0 && !types.some(t => t.id === Number(live.type_id)) && <option value={live.type_id}>已保存的分类（当前不可用）</option>}
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block">最多显示（条，3-10）</Label>
            <Input type="number" min={3} max={10} value={live.limit}
                   onChange={(e) => setF('limit', Number(e.target.value) || 6)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* 首页「账户安全概览」（环形仪表评分；四项参与评分开关）                          */
/* -------------------------------------------------------------------------- */
const SECURITY_ITEMS = [
  { key: 'certification', label: '实名认证', desc: '完成实名认证计为已完成' },
  { key: 'phone', label: '绑定手机号', desc: '账号已绑定手机号计为已完成' },
  { key: 'email', label: '绑定邮箱', desc: '账号已绑定邮箱计为已完成' },
  { key: 'profile', label: '完善账号资料', desc: '用户名等基础资料已填写计为已完成' },
]

function HomeSecurityCard({ content, setContentSection }) {
  const live = content.home_security || {
    enabled: 1,
    items: { certification: 1, phone: 1, email: 1, profile: 1 },
  }
  const items = live.items || {}
  const setItem = (k, v) => setContentSection('home_security', {
    ...live,
    items: { ...items, [k]: v ? 1 : 0 },
  })

  const enabledN = SECURITY_ITEMS.filter((s) => Number(items[s.key]) === 1).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>首页 · 账户安全概览</CardTitle>
        <CardDescription>
          控制台首页右下角的环形仪表评分卡。分数 = 已完成项 / 参与评分项 × 100；
          用下方开关控制哪些项参与评分（至少保留一项）。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Toggle
          label="启用账户安全概览"
          desc="总开关：关闭时前台首页不显示该卡"
          on={Number(live.enabled) === 1}
          onChange={(v) => setContentSection('home_security', { ...live, enabled: v ? 1 : 0 })}
        />
        <div className="space-y-2">
          {SECURITY_ITEMS.map((s) => (
            <div key={s.key}
                 className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">
                  {s.label}
                  {Number(items[s.key]) !== 1 && enabledN <= 1 && (
                    <span className="ml-2 text-xs text-danger">（至少保留一项参与评分）</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <Toggle
                label=""
                desc=""
                on={Number(items[s.key]) === 1}
                onChange={(v) => { if (v || enabledN > 1) setItem(s.key, v) }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* 工单提交助手（树形问题分类 1-3 级 + 按部门占位 + 必选产品规则）                */
/* -------------------------------------------------------------------------- */

function TicketAssistCard({ content, setContentSection }) {
  const toast = useToast()
  const live = content.ticket_assist || { enabled: 0, placeholder: '', require_host_types: [], type_placeholders: [], categories: [] }
  const cats = live.categories || []
  const setCats = (next) => setContentSection('ticket_assist', { ...live, categories: next })
  const setField = (k, v) => setContentSection('ticket_assist', { ...live, [k]: v })
  const [editing, setEditing] = useState(null)
  const [phEditing, setPhEditing] = useState(null)   // {index?, type_id, placeholder}
  const [types, setTypes] = useState([])
  const [catalogError,setCatalogError] = useState('')
  const [attempt,setAttempt] = useState(0)

  useEffect(() => {
    setCatalogError('')
    memberApi.ticketCatalog()
      .then((r) => { if (r.status !== 200) throw new Error(r.msg || '分类读取失败'); setTypes(r.data?.types || []) })
      .catch((e) => setCatalogError(e.message))
  }, [attempt])

  const typeName = (id) => (types.find((t) => Number(t.id) === Number(id)) || {}).name || (id ? `类型 #${id}` : '（进入表单后选择）')

  function onSubmitNode(v) {
    v = { ...v }
    delete v.__parentId
    if (editing && editing.__parentId) {
      // 新增子级：挂到父节点
      setCats(replaceNode(cats, editing.__parentId, (n) => ({
        ...n,
        children: [...(n.children || []), { ...v, children: v.children || [] }],
      })))
    } else if (editing && findNode(cats, editing.id)) {
      setCats(replaceNode(cats, editing.id, (n) => ({ ...v, children: n.children || [] })))
    } else {
      setCats([...cats, { ...v, children: v.children || [] }])
    }
    setEditing(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>工单提交助手</CardTitle>
        <CardDescription>
          主题层增强（不改工单插件）：提交工单页先选问题分类（最多 3 级细化），
          选到具体分类后才显示正式表单；选择后自动匹配部门、预填描述模板与教程链接；
          指定部门提交时强制选择关联产品。分类树用拖拽排序（与侧边栏导航同款）。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {catalogError && <Alert tone="warning">{catalogError}<Button className="ml-3" variant="outline" onClick={() => setAttempt((n) => n+1)}>重试分类</Button></Alert>}
        <Toggle
          label="启用工单提交助手"
          desc="总开关：关闭时提交工单页保持插件原样"
          on={Number(live.enabled) === 1}
          onChange={(v) => setField('enabled', v ? 1 : 0)}
        />

        <div>
          <Label className="mb-1.5 block">详情输入框占位提示（通用兜底，≤200 字）</Label>
          <Textarea
            rows={2}
            maxLength={200}
            value={live.placeholder || ''}
            placeholder="例如：请描述问题现象、发生时间与报错截图说明"
            onChange={(e) => setField('placeholder', e.target.value)}
          />
        </div>

        {/* 按部门占位（覆盖通用） */}
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label className="mb-0">按部门占位（选中该部门时覆盖通用占位）</Label>
            <Button variant="outline" size="sm" disabled={types.length === 0 || (live.type_placeholders || []).length >= types.length}
                    onClick={() => setPhEditing({ type_id: '', placeholder: '' })}>
              <Plus className="size-3.5" />添加
            </Button>
          </div>
          {(live.type_placeholders || []).length === 0 ? (
            <p className="text-[13px] text-muted-foreground">未设置。所有部门使用上方通用占位。</p>
          ) : (
            <ul className="space-y-2">
              {(live.type_placeholders || []).map((ph, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-line/70 px-3 py-2 text-[13px]">
                  <Badge tone="muted">{typeName(ph.type_id)}</Badge>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{ph.placeholder}</span>
                  <RowIconBtn label="编辑" onClick={() => setPhEditing({ index: i, ...ph })}>
                    <Pencil className="size-3.5" />
                  </RowIconBtn>
                  <RowIconBtn label="删除" danger onClick={() => {
                    setField('type_placeholders', (live.type_placeholders || []).filter((_, k) => k !== i))
                  }}>
                    <Trash2 className="size-3.5" />
                  </RowIconBtn>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 必选产品的部门：多选 */}
        <div>
          <Label className="mb-1.5 block">必须选择关联产品才能提交的工单部门</Label>
          {types.length === 0 ? (
            <Alert tone="info">工单插件类型表为空（插件未安装或未启用）。启用插件后此处会自动列出部门。</Alert>
          ) : (
            <div className="flex flex-wrap gap-2">
              {types.map((t) => {
                const on = (live.require_host_types || []).map(Number).includes(Number(t.id))
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const cur = (live.require_host_types || []).map(Number)
                      setField('require_host_types', on ? cur.filter((x) => x !== Number(t.id)) : [...cur, Number(t.id)])
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-[12px] transition-colors duration-150',
                      on ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-surface text-muted-foreground hover:border-brand/40'
                    )}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 树形问题分类（TreeSortEditor：缩进层级 + 拖拽 + 折叠 + 添加下级） */}
        <div>
          <Label className="mb-1.5 block">问题分类（最多 3 级细化；叶子节点生效部门/模板/教程链接）</Label>
          <TreeSortEditor
            tree={cats}
            setTree={setCats}
            hiddenOf={(node) => Number(node.enabled) !== 1}
            maxLevel={3}
            getLabel={(n) => n.name || '（未命名）'}
            renderMeta={(n) => (n.type_id ? typeName(n.type_id) : '未指定部门') + (n.link ? ' · 含教程链接' : '')}
            onEdit={(node) => setEditing({ ...node })}
            onAddChild={(node) => setEditing({ id: genId(), name: '', type_id: node?.type_id || 0, template: '', link: '', link_label: '', enabled: 1, __parentId: node?.id || null })}
            onDelete={(node) => setCats(removeNode(cats, node.id))}
            onToggleHidden={(node) => setCats(replaceNode(cats, node.id, (x) => ({ ...x, enabled: Number(x.enabled) === 1 ? 0 : 1 })))}
            addLabel={cats.length === 0 ? '添加一级分类' : '添加一级分类'}
            onReject={(msg) => toast(msg, 'error')}
          />
        </div>
      </CardContent>

      {editing && (
        <TicketAssistForm
          value={editing}
          types={types}
          onCancel={() => setEditing(null)}
          onSubmit={onSubmitNode}
        />
      )}

      {/* 按部门占位编辑弹窗 */}
      {phEditing && (
        <Dialog open onOpenChange={(v) => !v && setPhEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{phEditing.index !== undefined ? '编辑按部门占位' : '添加按部门占位'}</DialogTitle>
              <DialogDescription>用户选择该部门的分类后，详情输入框优先使用此占位提示</DialogDescription>
            </DialogHeader>
            <PhForm
              value={phEditing}
              types={types}
              used={(live.type_placeholders || []).map(Number)}
              onCancel={() => setPhEditing(null)}
              onSubmit={(v) => {
                const { index, ...payload } = v
                const list = [...(live.type_placeholders || [])]
                if (phEditing.index !== undefined) list[phEditing.index] = payload
                else list.push(payload)
                setField('type_placeholders', list)
                setPhEditing(null)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}

function PhForm({ value, types, used, onSubmit, onCancel }) {
  const [local, setLocal] = useState(value)
  const taken = used.filter((x) => x !== Number(value.type_id))
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault()
      if (!Number(local.type_id)) return alert('请选择部门')
      if (!String(local.placeholder || '').trim()) return alert('请填写占位提示')
      onSubmit({ type_id: Number(local.type_id), placeholder: String(local.placeholder).trim() })
    }}>
      <div>
        <Label className="mb-1.5 block">工单部门 *</Label>
        <Select value={String(local.type_id || '')}
                onChange={(e) => setLocal((f) => ({ ...f, type_id: Number(e.target.value) || 0 }))}>
          <option value="">请选择</option>
          {types.filter((t) => !taken.includes(Number(t.id))).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block">占位提示 *（≤200 字）</Label>
        <Textarea rows={3} maxLength={200} value={local.placeholder || ''}
                  placeholder="例如：请按模板填写：服务器 IP、故障时间、报错信息"
                  onChange={(e) => setLocal((f) => ({ ...f, placeholder: e.target.value }))} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button type="submit">应用到草稿</Button>
      </DialogFooter>
    </form>
  )
}

function TicketAssistForm({ value, types, onSubmit, onCancel }) {
  const [local, setLocal] = useState(value)
  const set = (k, v) => setLocal((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-h-[86vh] max-w-[620px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑分类</DialogTitle>
          <DialogDescription>
            叶子分类（无下级）会作为选择终点：用户选到它才显示正式表单，并应用此处的部门/模板/教程链接
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault()
          if (!String(local.name || '').trim()) return alert('请填写分类名称')
          onSubmit({ ...local, name: String(local.name).trim() })
        }}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">分类名称 *（≤20 字）</Label>
              <Input value={local.name} maxLength={20} placeholder="例如：服务器无法连接"
                     onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">匹配的工单部门（叶子节点生效）</Label>
              <Select value={String(local.type_id || '')} onChange={(e) => set('type_id', Number(e.target.value) || 0)}>
                <option value="">（继承上级或进入表单后选择）</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">描述模板（选中后预填，用户可编辑）</Label>
            <Textarea rows={5} maxLength={2000} value={local.template || ''}
                      placeholder={'例如：\n1. 服务器 IP：\n2. 无法连接的开始时间：\n3. 报错信息/截图：'}
                      onChange={(e) => set('template', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">教程链接（可选）</Label>
              <LinkPicker label="教程链接" value={local.link || ''} onChange={v=>set('link',v)}/>
            </div>
            <div>
              <Label className="mb-1.5 block">链接文字（可选，≤20 字）</Label>
              <Input value={local.link_label || ''} maxLength={20} placeholder="查看排查教程"
                     onChange={(e) => set('link_label', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={Number(local.enabled) === 1}
                   onChange={(e) => set('enabled', e.target.checked ? 1 : 0)} />
            启用（前台显示）
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
            <Button type="submit">应用到草稿</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function findNodeLocalFlag() { return true }
