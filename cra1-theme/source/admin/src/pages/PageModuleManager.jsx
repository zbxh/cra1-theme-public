import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Save, RotateCcw, GripVertical, ChevronDown, ChevronRight, Lock, Search,
  AlertTriangle, Info, Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { Badge, Alert, EmptyState, Skeleton } from '@ui/feedback'
import { ConfirmDialog } from '@ui/dialog'
import { useToast } from '@ui/toast'
import { cn } from '@ui/utils'
import { websiteApi } from '../lib/api'
import Field from './FieldWidget'
import { FloatingActions } from '../ui/FloatingActions'
import schema from '../schema.json'
import SwitchControl from '../ui/Switch'
import { DragHandle, DropBadge, DRAG_LIST_BASE, DRAG_ROW_BASE, useFlatDrag } from '../ui/dragSort'

/**
 * 页面模块布局（官网主题域）
 *
 * 数据来源：服务端唯一 manifest（api.page-layout.get）——不在前端复制页面/模块定义。
 * 保存：api.page-layout.save 按 sortKey 增量提交 + expectedRevision 乐观锁（409 保留草稿）。
 * Hero 固定首位不参与排序；共享家族一次保存影响全部成员页面。
 * 折叠状态只存 sessionStorage（UI 态），不进入配置、不计入 dirty。
 */

const COLLAPSE_KEY = 'cra1Admin.pageModules.collapsed.v1'

/** schema 全量字段定义索引：fieldKey → 定义；cards 展开键（<项键>_<字段键>）同样可查 */
const FIELD_DEF_MAP = (() => {
  const map = {}
  for (const sec of schema.sections || []) {
    for (const item of sec.items || []) {
      for (const f of item.fields || []) {
        map[f.key] = f
        if (f.type === 'cards') {
          for (const it of f.items || []) {
            for (const cf of f.fields || []) map[`${it.key}_${cf.key}`] = cf
          }
        }
      }
    }
  }
  return map
})()

/** 模块所属开关键：fieldKeys 中第一个 show_* 前缀键；无则模块始终显示 */
function switchKeyOf(fieldKeys) {
  return (fieldKeys || []).find((k) => /^show_/.test(k)) || null
}

function loadCollapsed() {
  try { return JSON.parse(sessionStorage.getItem(COLLAPSE_KEY) || '{}') } catch { return {} }
}
function saveCollapsed(map) {
  try { sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify(map)) } catch { /* 忽略写入失败 */ }
}

/* ---------------- 键盘排序（Space 抓取 / 方向键移动 / Space 放置 / Escape 取消） ---------------- */


export default function PageModuleManager({ registerDirty, onSaved, config, original, setConfig, setOriginal }) {
  const toast = useToast()
  /* 页头操作区引用：悬浮操作条观察它是否滚出视野（Hook 顺序需稳定，故在所有提前 return 之前声明） */
  const actionsRef = useRef(null)
  const [manifest, setManifest] = useState(null)
  const [pages, setPages] = useState({})       // 服务端已保存的 pages 文档
  const [revision, setRevision] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeKey, setActiveKey] = useState('home')
  const [drafts, setDrafts] = useState({})     // sortKey → 顺序数组（未保存）
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState(() => loadCollapsed())
  // 键盘播报：与共享拖拽 hook 共用同一 aria-live 文案通道
  const [liveMsg, setLiveMsg] = useState('')
  const announce = useCallback((msg) => setLiveMsg(msg), [])

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    return websiteApi.pageLayoutGet()
      .then((r) => {
        if (r.status !== 200) throw new Error(r.msg || '读取失败')
        setManifest(r.data.manifest)
        setPages(r.data.pages || {})
        setRevision(r.data.revision)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  /* 服务端已保存顺序（按页面 family） */
  const savedOrderOf = useCallback((pageKey) => {
    const p = manifest?.[pageKey]
    if (!p) return []
    const doc = pages[p.sortKey]
    return normalizeOrder(p, Array.isArray(doc) ? doc : [])
  }, [manifest, pages])

  function normalizeOrder(p, saved) {
    const ids = p.modules.map((m) => m.id)
    const seen = new Set()
    const out = []
    for (const id of saved) {
      if (ids.includes(id) && !seen.has(id)) { seen.add(id); out.push(id) }
    }
    for (const id of ids) {
      if (!seen.has(id)) out.push(id)
    }
    return out
  }

  const current = manifest?.[activeKey]

  /* 当前 family 的草稿顺序 */
  const draft = useMemo(() => {
    if (!current) return []
    const key = current.sortKey
    if (drafts[key]) return drafts[key]
    return savedOrderOf(activeKey)
  }, [current, drafts, savedOrderOf, activeKey])

  const savedOrder = useMemo(() => (current ? savedOrderOf(activeKey) : []), [current, savedOrderOf, activeKey])

  /* dirty：按 sortKey 比较 */
  const fieldDirtyCount = useMemo(() => {
    if (!config || !original) return 0
    return Object.keys(config).filter((k) => config[k] !== original[k]).length
  }, [config, original])

  const setField = useCallback((key, value) => {
    setConfig((c) => ({ ...c, [key]: value }))
  }, [setConfig])

  const dirtySortKeys = useMemo(() => {
    if (!manifest) return new Set()
    const out = new Set()
    for (const [pk, p] of Object.entries(manifest)) {
      if (p.aliasOf || !drafts[p.sortKey]) continue
      if (JSON.stringify(drafts[p.sortKey]) !== JSON.stringify(savedOrderOf(pk))) out.add(p.sortKey)
    }
    return out
  }, [manifest, drafts, savedOrderOf])

  /* dirty 上报 App（离开保护 / beforeunload） */
  useEffect(() => {
    registerDirty?.('page-layout', dirtySortKeys.size)
    return () => registerDirty?.('page-layout', 0)
  }, [dirtySortKeys, registerDirty])

  /* 受影响页面（共享家族提示） */
  const affectedPages = useMemo(() => {
    if (!manifest || !current) return []
    return Object.entries(manifest)
      .filter(([, p]) => !p.aliasOf && p.sortKey === current.sortKey)
      .map(([pk, p]) => ({ key: pk, label: p.label, route: p.route }))
  }, [manifest, current])

  const groupedPages = useMemo(() => {
    if (!manifest) return {}
    const groups = {}
    for (const [pk, p] of Object.entries(manifest)) {
      if (p.aliasOf) continue
      const g = p.sortKey.split('.')[0]
      ;(groups[g] = groups[g] || []).push({ key: pk, ...p })
    }
    return groups
  }, [manifest])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groupedPages
    const out = {}
    for (const [g, list] of Object.entries(groupedPages)) {
      const hit = list.filter((p) =>
        p.label.toLowerCase().includes(q)
        || p.route.toLowerCase().includes(q)
        || p.modules.some((m) => m.label.toLowerCase().includes(q) || m.id.includes(q)))
      if (hit.length) out[g] = hit
    }
    return out
  }, [groupedPages, query])

  function setOrder(next) {
    setDrafts((d) => ({ ...d, [current.sortKey]: next }))
  }

  function move(from, to) {
    if (from === to || from < 0 || to < 0 || from >= draft.length || to >= draft.length) return
    const next = draft.slice()
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    setOrder(next)
  }

  /* ---------------- 保存 / 撤销 / 恢复默认 ---------------- */
  async function save() {
    const hasLayout = dirtySortKeys.has(current.sortKey)
    const hasFields = fieldDirtyCount > 0
    if (!hasLayout && !hasFields) {
      toast('当前家族没有需要保存的修改')
      return
    }
    setSaving(true)
    try {
      // 先提交字段改动（含模块开关 / rows / cards 展开键），布局保存需要最新 revision
      if (hasFields) {
        const payload = {}
        Object.keys(config).forEach((k) => { if (config[k] !== original[k]) payload[k] = config[k] })
        const fr = await websiteApi.save(payload)
        if (fr.status !== 200) {
          toast(fr.msg || '字段保存失败', 'error')
          return
        }
        const resolved = fr.data?.config || fr.config
        if (resolved && typeof resolved === 'object') {
          setConfig({ ...resolved })
          setOriginal(JSON.parse(JSON.stringify(resolved)))
        }
      }
      if (!hasLayout) {
        toast('字段已保存，前台已生效')
        await load()
        onSaved?.()
        return
      }
      const r = await websiteApi.pageLayoutSave({
        sortKey: current.sortKey,
        order: drafts[current.sortKey],
        expectedRevision: revision,
      })
      if (r.status === 200) {
        setDrafts((d) => { const n = { ...d }; delete n[current.sortKey]; return n })
        toast(r.msg || '布局已保存，前台已生效')
        await load()
        onSaved?.()
      } else if (r.status === 409) {
        toast(r.msg || '布局已被其他会话修改，请刷新后重试', 'error')
        await load()
      } else {
        toast(r.msg || '保存失败', 'error')
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function revert() {
    setDrafts((d) => { const n = { ...d }; delete n[current.sortKey]; return n })
    if (original && typeof original === 'object') {
      setConfig(JSON.parse(JSON.stringify(original)))
    }
  }

  async function doReset() {
    setSaving(true)
    try {
      const r = await websiteApi.pageLayoutReset({ sortKey: current.sortKey })
      setConfirmReset(false)
      if (r.status === 200) {
        setDrafts((d) => { const n = { ...d }; delete n[current.sortKey]; return n })
        toast(r.msg || '已恢复默认顺序')
        await load()
        onSaved?.()
      } else {
        toast(r.msg || '操作失败', 'error')
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  /* ---------------- 折叠（仅 UI 态） ---------------- */
  function toggleCollapse(moduleId) {
    setCollapsed((c) => {
      const key = activeKey + ':' + moduleId
      const next = { ...c, [key]: !c[key] }
      saveCollapsed(next)
      return next
    })
  }
  const isCollapsed = (moduleId) => !!collapsed[activeKey + ':' + moduleId]

  /* 统一扁平拖拽（模块顺序）：索引↔模块 ID 映射由本页负责，交互复用共享实现 */
  const drag = useFlatDrag({
    count: draft.length,
    keyOf: (item) => item,
    onMove: (from, to) => move(from, to),
    onAnnounce: announce,
  })

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error) return <Alert tone="error">页面模块布局加载失败：{error}</Alert>
  if (!manifest) return <EmptyState title="没有可显示的内容" description="请刷新页面重试" />

  const moduleById = Object.fromEntries(current.modules.map((m) => [m.id, m]))

  return (
    <div className="space-y-4">
      <PageHeader
        title="页面模块布局"
        description="拖拽调整各页面的模块顺序，保存后官网真实 HTML 顺序同步变化；主视觉（Hero）固定首位"
        actions={
          /* data-page-actions：悬浮操作条据此判断"页头按钮是否滚出视野" */
          <div ref={actionsRef} data-page-actions className="flex flex-wrap items-center gap-2">
            {dirtySortKeys.size > 0 && <Badge tone="warning">{dirtySortKeys.size} 个家族未保存</Badge>}
            {fieldDirtyCount > 0 && <Badge tone="warning">{fieldDirtyCount} 处字段未保存</Badge>}
            {(dirtySortKeys.has(current.sortKey) || fieldDirtyCount > 0) && (
              <Button variant="outline" size="sm" onClick={revert} disabled={saving}>
                <RotateCcw className="size-3.5" />撤销
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)} disabled={saving}>
              恢复默认
            </Button>
            <Button size="sm" onClick={save} disabled={saving || (!dirtySortKeys.has(current.sortKey) && fieldDirtyCount === 0)}>
              <Save className="size-3.5" />{saving ? '保存中…' : '保存'}
            </Button>
          </div>
        }
      />

      {dirtySortKeys.size > 0 && (
        <Alert tone="info">
          <Layers className="size-4" />
          未保存的家族：{[...dirtySortKeys].join('、')}。切换页面或离开前请保存或撤销。
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* 左侧：页面 / 家族列表 */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="p-3">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索页面或模块…"
                     className="pl-8" aria-label="搜索页面或模块" />
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {Object.entries(filteredGroups).map(([g, list]) => (
                <div key={g}>
                  <div className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
                    {{ home: '首页', product: '产品详情', solution: '解决方案', content: '内容', news: '新闻', partner: '渠道', about: '关于', contact: '联系', document: '文档', recruit: '招聘', feedback: '反馈', activities: '活动', service: '服务', error: '错误页' }[g] || g}
                  </div>
                  {list.map((p) => (
                    <button key={p.key} type="button"
                            onClick={() => setActiveKey(p.key)}
                            aria-current={activeKey === p.key ? 'page' : undefined}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-150',
                              activeKey === p.key ? 'bg-brand/10 font-medium text-brand' : 'text-body hover:bg-surface-alt',
                            )}>
                      <span className="min-w-0 truncate">{p.label}</span>
                      {dirtySortKeys.has(p.sortKey) && <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-warning)]" title="有未保存修改" />}
                    </button>
                  ))}
                </div>
              ))}
              {Object.keys(filteredGroups).length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">没有匹配的页面</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右侧：模块卡片 */}
        <div className="space-y-4">
          {affectedPages.length > 1 && (
            <Alert tone="info">
              <Info className="size-4" />
              共享布局家族：一次保存将同时影响 {affectedPages.length} 个页面 —— {affectedPages.map((p) => p.label).join('、')}。各页面的内容字段仍相互独立。
            </Alert>
          )}

          {/* 模块顺序：与侧边栏导航同构的行列表（Hero 固定行 + 可排序行同容器） */}
          <div role="list" aria-label={current.label + '模块顺序'} className={DRAG_LIST_BASE}>
            {/* Hero 固定行：无手柄、不参与排序 */}
            <div className={cn(DRAG_ROW_BASE, 'bg-surface-alt/40')}>
              <span className="w-5 shrink-0" aria-hidden="true" />
              <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{current.heroLabel || '页面主视觉'}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">固定首位，不参与排序</span>
              <Badge tone="muted">固定</Badge>
            </div>
            {draft.map((id, index) => {
              const m = moduleById[id] || { id, label: id, fieldKeys: [] }
              const col = isCollapsed(id)
              const isKbd = drag.draggingIndex === index
              const sKey = switchKeyOf(m.fieldKeys)
              const switchOn = sKey ? String(config?.[sKey]) === '1' : null
              // 模块卡头部唯一呈现 show_* 开关，展开区排除同一开关，避免重复控制
              const editableKeys = (m.fieldKeys || []).filter((k) => FIELD_DEF_MAP[k] && !/^show_/.test(k))
              const toggledLabel = m.label
              const toggleSwitch = () => {
                if (!sKey || !setConfig) return
                setField(sKey, switchOn ? '0' : '1')
              }
              return (
                /* 模块卡 = 头部行 + 展开区，是**纵向**堆叠，不能直接用 DRAG_ROW_BASE
                   （它是 flex 横向行样式：展开区会被当作头部的横向兄弟排到右侧，
                   再叠上 h-10 固定高度 → 内容向上下溢出、压住相邻卡片）。
                   故外层只保留拖拽视觉，行内布局下放到头部那层。 */
                <div key={id} role="listitem"
                     data-module-card={id}
                     draggable={!col}
                     {...drag.itemProps(draft.indexOf(id))}
                     className={cn(
                       'group border-b border-line/60 transition-colors duration-150 last:border-b-0',
                       drag.isOver(draft.indexOf(id)) && 'bg-brand/5',
                       drag.isDragging(draft.indexOf(id)) && 'opacity-50',
                       isKbd ? 'bg-brand/5' : '',
                     )}>
                  <div className="flex h-10 w-full items-center gap-2 px-3">
                    <DragHandle {...drag.handleProps(index, '拖拽排序：' + m.label)} />
                    <button type="button"
                            className="flex h-full min-w-0 flex-1 items-center gap-2 text-left"
                            aria-expanded={col ? 'false' : 'true'}
                            aria-controls={'module-detail-' + activeKey.replace('/', '-') + '-' + id}
                            onClick={() => toggleCollapse(id)}>
                      {col ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                      <span className={cn('min-w-0 truncate text-[13px] font-medium', switchOn === false ? 'text-muted-foreground line-through' : 'text-ink')}>{m.label}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{m.fieldKeys.length > 0 ? m.fieldKeys.length + ' 个配置项' : '系统内容'}</span>
                    </button>
                    {drag.isOver(draft.indexOf(id)) && <DropBadge pos={drag.dropPos} />}
                    {sKey ? (
                      <SwitchControl
                        data-module-switch
                        size="sm"
                        label={(switchOn ? '关闭' : '开启') + '模块：' + toggledLabel}
                        checked={!!switchOn}
                        onCheckedChange={toggleSwitch}
                      />
                    ) : (
                      <Badge tone="muted">系统</Badge>
                    )}
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">#{index + 1}</span>
                  </div>
                  {/* 展开区：行内展开，不改变行本身的分隔线节奏（close 时整块不占位） */}
                  <div id={'module-detail-' + activeKey.replace('/', '-') + '-' + id}
                       data-module-detail
                       hidden={col}
                       className="space-y-4 border-t border-line/60 bg-surface px-3 py-3 pl-11">
                    {editableKeys.length > 0 ? editableKeys.map((k) => {
                      const def = FIELD_DEF_MAP[k]
                      return (
                        <Field key={k} field={def} value={config?.[k] ?? ''}
                               onChange={(v) => setField(k, v)}
                               config={config} setField={setField} />
                      )
                    }) : (
                      <p className="text-xs leading-5 text-muted-foreground">系统内容模块：内容由前台数据（系统配置 / 动态接口）提供，此处只调整展示顺序。</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div aria-live="polite" className="sr-only">{liveMsg}</div>
        </div>
      </div>

      {/* 悬浮操作条：页头按钮滚出视野后出现，承载同一组操作 */}
      <FloatingActions
        anchorRef={actionsRef}
        saving={saving}
        dirtyCount={dirtySortKeys.size + fieldDirtyCount}
        dirtyLabel={`${dirtySortKeys.size} 个家族 / ${fieldDirtyCount} 处字段未保存`}
        onSave={save}
        onRevert={revert}
        revertLabel="撤销"
        revertDisabled={!(dirtySortKeys.has(current.sortKey) || fieldDirtyCount > 0)}
        onReset={() => setConfirmReset(true)}
      />

      <ConfirmDialog
        open={confirmReset}
        title="恢复该家族默认模块顺序"
        description={'将清除「' + current.sortKey + '」的自定义顺序，前台回到默认排列。此操作不影响页面内容配置，也不影响其他家族。'}
        confirmText="确认恢复"
        tone="danger"
        busy={saving}
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
