import { websiteApi } from '../lib/api'
import registry from '../workspace.registry.json'
/**
 * 官网主题字段控件（WebsiteTheme 与 PageModuleManager 共用）
 *
 * Field：单个字段控件（switch / rows / cards / textarea / select / checkbox / icon / text）。
 * rows/cards 沿用「行式文本」与「<项键>_<字段键> 扁平键」存储格式，与旧版 admin.js 一致。
 * fieldKeysOf：字段实际占用的配置键 —— cards 不是单个 JSON，而是按项展开的扁平键组
 * （cap2_title / sol1_url / band_item3_desc …），脏值统计、还原本项、按项保存都必须用它。
 */
import { useState, useMemo, useId, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Input, Textarea, Label, Select } from '@ui/input'
import IconPicker from '@/ui/IconPicker'
import { Badge, Alert, EmptyState, Skeleton } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, ConfirmDialog } from '@ui/dialog'
import { cn } from '@ui/utils'
import SwitchControl from '../ui/Switch'
import { Pencil, Trash2, Package, MessageSquareText, ArrowUp, ArrowDown } from 'lucide-react'
import { DragHandle, DropBadge, DRAG_LIST_BASE, RowIconBtn, dragRowClass, useFlatDrag, DragAnnouncer } from '../ui/dragSort'
import { TreeSortEditor } from '../ui/treeSort'
import { ProductImporter } from '../ui/ProductImporter'
import LinkPicker from './LinkPicker'
import MediaPicker from '../components/MediaPicker'
import { TagInput, tagsToString, stringToTags } from '../ui/tag-input'

import { parseRows, serializeRows } from '../lib/row-contract.js'
import { navigationDepth, readMenuSidebar, writeMenuSidebar } from '../lib/menu-sidebar.js'

/* -------------------------------------------------------------------------- */
/* 单个字段渲染                                                                */
/* -------------------------------------------------------------------------- */

function Field({ field, value, onChange, config, setField }) {
  const controlId=useId()
  const { type = 'text', label, hint, placeholder, options, rows: textRows } = field

  if (type === 'switch') {
    const on = String(value) === '1' || value === 1 || value === true
    return (
      <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink">{label}</p>
          {hint && <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}
        </div>
        <SwitchControl label={label} checked={on} onCheckedChange={(next) => onChange(next ? '1' : '0')} />
      </div>
    )
  }

  if (type === 'rows') {
    return <RowsField field={field} value={value} onChange={onChange} config={config} />
  }

  if (type === 'tags') {
    /* 独立标签字段：逗号/回车应用、框内固定 chips、可拖拽排序；存储为英文逗号分隔字符串 */
    return (
      <div>
        <Label htmlFor={controlId} className="mb-1.5 block">{label}</Label>
        <TagInput value={stringToTags(value)} placeholder={placeholder} ariaLabel={label}
                  onChange={(tags) => onChange(tagsToString(tags))} />
        {hint && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
      </div>
    )
  }

  if (type === 'cards') {
    // cards 占用的是一组扁平键（cap2_title…），由字段区统一传入 config/setField，
    // 这样它与其他字段共用同一份「未保存修改」统计与保存逻辑。
    return <CardsField field={field} config={config} setField={setField} />
  }

  if (type === 'textarea') {
    return (
      <div>
        <Label htmlFor={controlId} className="mb-1.5 block">{label}</Label>
        <Textarea id={controlId} rows={textRows || 4} value={value ?? ''} placeholder={placeholder}
                  onChange={(e) => onChange(e.target.value)} />
        {hint && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div>
        <Label htmlFor={controlId} className="mb-1.5 block">{label}</Label>
        <Select id={controlId} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {(options || []).map((o) => (
            <option key={o[0]} value={o[0]}>{o[1]}</option>
          ))}
        </Select>
        {hint && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
      </div>
    )
  }

  if (type === 'checkbox') {
    const on = String(value) === '1' || value === 1 || value === true
    return (
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? '1' : '')}
               className="size-4 rounded border-line accent-[var(--primary)]" />
        {label}
      </label>
    )
  }

  if (type === 'icon') {
    return (
      <div>
        <Label htmlFor={controlId} className="mb-1.5 block">{label}</Label>
        <IconPicker value={value ?? ''} onChange={onChange} placeholder={placeholder} />
        {hint && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
      </div>
    )
  }

  return (
    <div>
      <Label htmlFor={controlId} className="mb-1.5 block">{label}</Label>
      <Input id={controlId} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** rows：列表 + 编辑弹窗（同一项的所有参数在一个表单里改完） */
function RowsField({ field, value, onChange, config }) {
  const cols = field.cols || []
  const maxLevel = field.maxLevel || 3
  const isNavigation = field.key === 'cloud_menu_text'
  const [navCatalog, setNavCatalog] = useState({ loading: true, tree: [], error: '' })
  const loadNavCatalog = () => {
    setNavCatalog(s => ({ ...s, loading: true }))
    websiteApi.navigationCatalog().then(r => setNavCatalog({ loading: false, tree: r.data?.catalog || [], error: r.status === 200 ? (r.data?.error || '') : (r.msg || '读取失败') }))
      .catch(() => setNavCatalog({ loading: false, tree: [], error: '目录读取失败，请刷新重试' }))
  }
  useEffect(() => { if (isNavigation) loadNavCatalog() }, [field.key])
  const visibleCol = c => c.type !== 'menu-sidebar' && (!field.visual?.visibleColumns || field.visual.visibleColumns.includes(c.key))
  const [products,setProducts]=useState([]),rowId=useId()
  useEffect(()=>{if(cols.some(c=>c.key==='id'||c.type==='product-match'))websiteApi.productOptions().then(r=>{if(r.status===200)setProducts(r.data?.products||[])}).catch(()=>{})},[field.key])
  const list = useMemo(() => parseRows(value, cols), [value, cols])
  const [editing, setEditing] = useState(null)   // { index, row, hidden, child }
  const [importerOpen, setImporterOpen] = useState(false)   // 「导入商品」弹窗
  // 「编辑描述」：只改本模块展示的描述（rows 的 desc 列），不动 v10 商品资料
  const [descEditing, setDescEditing] = useState(null)   // { index, name, desc }
  const [liveMsg, setLiveMsg] = useState('')
  // 统一扁平拖拽（与侧边栏同一套视觉与键盘交互：Space 抓取 → ↑/↓ → Space 放置 → Esc 取消）
  const drag = useFlatDrag({
    count: list.length,
    onMove: (from, to) => move(from, to),
    onAnnounce: setLiveMsg,
  })

  function commit(next) {
    if(field.boundPage)next=next.map(it=>({...it,row:{...it.row,page:field.boundPage}}))
    onChange(serializeRows(next, cols))
  }

  function titleOf(it) {
    const first=['name','title','label','text','question'].find(k=>it.row[k])||cols.find(c=>!['page','id','image','img','url'].includes(c.key))?.key
    return it.row.name==='__desc__'?'表格补充说明':String(it.row[first]||'未命名条目')
  }

  /**
   * 行副标题：用第一个以外的列拼一行摘要。
   * 旧格式固定带第 4 位标志（多为 0/1），它落在 select 列上时并不等于任何选项，
   * 直接展示会冒出一个没有含义的「0」；因此：
   *   - select 列只展示能匹配到选项的值（显示选项中文，如 1 → 一级）；
   *   - checkbox 列不展示（打勾与否在编辑弹窗里看）；
   *   - 其余列原样展示。
   */
  function subtitleOf(it) {
    if (field.visual?.summaryColumns) return field.visual.summaryColumns.map(key => String(it.row[key] || '')).filter(Boolean).join(' · ')
    return cols.filter(c=>visibleCol(c)&&!['page','id','image','img','url'].includes(c.key)&&it.row[c.key]!=='__desc__').map((c) => {
      const v = it.row[c.key]
      if (!v) return ''
      if (c.type === 'checkbox') return ''
      if (c.type === 'select') {
        const hit = (c.options || []).find((o) => String(o[0]) === String(v))
        return hit ? hit[1] : ''
      }
      return String(v)
    }).filter(Boolean).join(' · ')
  }

  function move(from, to) {
    if (from === to || from < 0 || to < 0) return
    const next = list.slice()
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    commit(next)
  }

  /** 树形字段（菜单导航 / 底部菜单栏）：完全复用侧边栏导航的树组件（缩进 + 折叠 + 添加下级） */
  const isTree = !!(field.tree || field.menuLike)
  const tree = useMemo(() => {
    if (!isTree) return []
    // 层级按行前缀 '>' 的个数推导：0 个=一级、1 个=二级、2 个=三级、3 个=四级（与前台解析一致）
    const roots = []
    const stack = []   // stack[level-1] = 该层级最后压入的节点
    list.forEach((it, i) => {
      const level = Math.min((it.level || (it.child ? 2 : 1)), maxLevel)
      const node = { id: 'row-' + i, __index: i, row: it.row, hidden: it.hidden, children: [] }
      if (level === 1 || !stack[level - 2]) {
        roots.push(node)
        stack.length = 0
        stack[0] = node
      } else {
        stack[level - 2].children.push(node)
        stack[level - 1] = node
        stack.length = level
      }
    })
    return roots
  }, [isTree, list, maxLevel])

  /** 树 → 行列表（深度优先，二级加 > 前缀，保持与前台解析一致的存储格式） */
  const writeTree = (nextTree) => {
    const flat = []
    const walk = (nodes, depth) => {
      nodes.forEach((n) => {
        flat.push({ row: n.row, hidden: !!n.hidden, level: depth, child: depth > 1 })
        if (n.children?.length) walk(n.children, depth + 1)
      })
    }
    walk(nextTree, 1)
    commit(flat)
  }

  const treeNodeLabel = (n) => String(n.row[cols[0]?.key] || '').trim() || '未命名'
  /* 「描述」列：有 textarea 类型的列即视为模块内描述列（当前是商品模块的 desc）。
     只有存在该列时才提供「编辑描述」按钮，避免给其他 rows 字段凭空加动作。 */
  const descCol = cols.find((c) => c.type === 'textarea' && c.key === 'desc') || null
  /** 只改 desc 列，其余列原样保留（不影响名称/ID/标签与层级） */
  const writeDesc = (index, desc) => {
    const data = JSON.parse(JSON.stringify(tree))
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.__index === index) { n.row = { ...n.row, [descCol.key]: desc }; return true }
        if (n.children?.length && walk(n.children)) return true
      }
      return false
    }
    walk(data)
    writeTree(data)
  }
  const treeNodeMeta = (n) => {
    const url = cols.find((c) => c.url)?.key
    return [url ? String(n.row[url] || '') : '', n.row.source === 'cart' ? '购物车目录 · 自动同步' : ''].filter(Boolean).join(' · ')
  }
  const makeNode = () => {
    const row = {}
    cols.forEach((c) => { row[c.key] = c.default || '' })
    return { id: 'new-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), row, hidden: false, children: [] }
  }


  /** 行编辑弹窗：树字段与非树字段共用（提交逻辑分别处理） */
  const editingDialog = (
    <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{(editing?.index ?? -1) >= 0 ? '编辑' : '添加'}{field.label}</DialogTitle>
          <DialogDescription>该项的全部参数在此一次改完</DialogDescription>
        </DialogHeader>
        {editing && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (isTree) {
                // 树字段：按索引更新，或按记录的父级插入（层级由缩进与 > 前缀表达）
                const data = JSON.parse(JSON.stringify(tree))
                if (editing.index >= 0) {
                  const walk = (nodes) => {
                    for (const n of nodes) {
                      if (n.__index === editing.index) { n.row = editing.row; n.hidden = !!editing.hidden; if (n.row.source === 'cart') n.children = []; return true }
                      if (n.children?.length && walk(n.children)) return true
                    }
                    return false
                  }
                  walk(data)
                } else {
                  const inserted = { id: 'n-' + Date.now(), __index: -1, row: editing.row, hidden: !!editing.hidden, children: [] }
                  const insert = (nodes, parentId) => {
                    if (!parentId) { nodes.push(inserted); return true }
                    for (const n of nodes) {
                      if (n.id === parentId) { n.children = n.children || []; n.children.push(inserted); return true }
                      if (n.children?.length && insert(n.children, parentId)) return true
                    }
                    return false
                  }
                  insert(data, editing.__treeParentId || null)
                }
                writeTree(data)
                setEditing(null)
                return
              }
              const next = list.slice()
              const payload = { row: editing.row, hidden: editing.hidden, child: editing.child, level:editing.level }
              if (editing.index >= 0) next[editing.index] = payload
              else next.push(payload)
              commit(next)
              setEditing(null)
            }}
          >
            {cols.filter(c=>visibleCol(c)&&!(c.key==='source'&&editing.child)&&!(field.boundPage&&c.key==='page')&&!(editing.row.name==='__desc__'&&['name','tag'].includes(c.key))).map((c) => (
              <div key={c.key}>
                <Label htmlFor={rowId+c.key} className="mb-1.5 block">{c.label}{c.required ? ' *' : ''}</Label>
                {c.key==='id'?<Select id={rowId+c.key} aria-label="关联商品" value={editing.row.id||''} onChange={e=>setEditing(s=>({...s,row:{...s.row,id:e.target.value}}))}><option value="">不关联商品（作为分组）</option>{editing.row.id&&!products.some(p=>String(p.id)===editing.row.id)&&<option value={editing.row.id}>原有关联商品</option>}{products.map(p=><option key={p.id} value={p.id}>{[p.group,p.sub,p.name].filter(Boolean).join(' / ')}</option>)}</Select>:c.type === 'textarea' ? (
                  <Textarea id={rowId+c.key} rows={c.rows || 3} value={editing.row[c.key] ?? ''} placeholder={c.placeholder}
                            onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: e.target.value } }))} />
                ) : c.type === 'product-match' ? <Select id={rowId+c.key} value={editing.row[c.key]||''} onChange={e=>setEditing(s=>({...s,row:{...s.row,[c.key]:e.target.value}}))}><option value="">选择商品</option>{editing.row[c.key]&&!products.some(p=>p.name===editing.row[c.key])&&<option value={editing.row[c.key]}>原有匹配商品</option>}{products.map(p=><option key={p.id} value={p.name}>{[p.group,p.sub,p.name].filter(Boolean).join(' / ')}</option>)}</Select> : c.type === 'pages' ? (
                  <div className="space-y-2 rounded-md border border-line p-3">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!editing.row[c.key] || editing.row[c.key] === '*'} onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: e.target.checked ? '*' : 'home,about' } }))} />全部引用页面（公共回退）</label>
                    <div className="grid max-h-52 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">{Object.entries(registry.pages).map(([pk,p]) => {
                      const selected = String(editing.row[c.key] || '').split(',').filter((v) => v && v !== '*')
                      return <label className="flex items-center gap-2 text-xs" key={pk}><input type="checkbox" checked={selected.includes(pk)} onChange={(e) => {
                        const next = e.target.checked ? [...selected,pk] : selected.filter((x) => x !== pk)
                        setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: next.length ? next.join(',') : '*' } }))
                      }} />{p.label}</label>
                    })}</div>
                    {String(editing.row[c.key] || '').split(',').filter((x) => x && x !== '*').length === 1 && <p className="text-xs text-warning">单页专属条目请到该页面的内容标签编辑；公共条目至少引用两个页面。</p>}
                  </div>
                ) : c.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-[13px]">
                    <input type="checkbox"
                           checked={!!editing.row[c.key]}
                           onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: e.target.checked ? '1' : '' } }))} />
                    {c.label}
                  </label>
                ) : c.type === 'select' ? (
                  <Select id={rowId+c.key} value={editing.row[c.key] ?? ''}
                          onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: e.target.value } }))}>
                    {(c.options || []).map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
                  </Select>
                ) : c.type === 'tags' ? (
                  /* 标签列：逗号/回车应用、框内固定 chips、可拖拽排序（存储为英文逗号分隔字符串） */
                  <TagInput value={stringToTags(editing.row[c.key])} placeholder={c.placeholder}
                            ariaLabel={c.label}
                            onChange={(tags) => setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: tagsToString(tags) } }))} />
                ) : c.type === 'icon' ? (
                  /* 图标列：预览 + 主题自带图标点选 + 图标库搜索 + 手动填写 */
                  <IconPicker value={editing.row[c.key] ?? ''} label={c.label || '图标'} placeholder={c.placeholder}
                              defaultKey={isNavigation ? 'default:website:menu' : field.key==='cap_cards_text' ? 'clock' : field.key==='footer_promise_items_text' ? 'shield-check' : field.key==='float_items_text' ? 'link' : ''}
                              iconStyle={editing.row.__iconStyles?.[c.key] || null}
                              onChange={(v, style) => setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: v, __iconStyles: { ...s.row.__iconStyles, [c.key]: style } } }))} />
                ) : c.type === 'image' ? <MediaPicker value={editing.row[c.key] || ''} label={c.label} onChange={(v) => setEditing({...editing,row:{...editing.row,[c.key]:v}})}/> : c.url || c.type === 'link' ? (
                  /* 链接列：提供「主题页面 / v10 商品 / 自定义」三来源选择器 */
                  <LinkPicker value={editing.row[c.key] ?? ''} placeholder={c.placeholder}
                              onChange={(v) => setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: v } }))} />
                ) : (
                  <Input id={rowId+c.key} value={editing.row[c.key] ?? ''} placeholder={c.placeholder}
                         onChange={(e) => setEditing((s) => ({ ...s, row: { ...s.row, [c.key]: e.target.value } }))} />
                )}
              </div>
            ))}
            {isNavigation && !editing.child && editing.row.source !== 'cart' && navigationDepth(tree.find(n => n.__index === editing.index)) < 4 && (
              <NavigationSidebarEditor value={editing.row.sidebar || ''} row={editing.row}
                depth={navigationDepth(tree.find(n => n.__index === editing.index))}
                commonLinks={config?.cloud_menu_aside_text || ''}
                onChange={value => setEditing(s => ({ ...s, row: { ...s.row, sidebar: value } }))} />
            )}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={!!editing.hidden}
                       onChange={(e) => setEditing((s) => ({ ...s, hidden: e.target.checked }))} />
                隐藏（前台不显示，仍保留可恢复）
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button type="submit">应用到草稿</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )

  if (isTree) {
    /* 「导入商品」：勾选商品后写入为分组下的商品行。
       分组从商品自身的二级分组带出（同一分组只插一次，后续商品追加到该组），
       避免运营再手工建分组、填 ID。 */
    const doImport = (chosen) => {
      const next = JSON.parse(JSON.stringify(tree))
      const findGroup = (name) =>
        next.find((n) => String(n.row?.[cols[0]?.key] || '').trim() === name && String(n.row?.id || '').trim() === '')
      for (const p of chosen) {
        const gname = p.g2 || p.g1 || '未分组'
        let g = findGroup(gname)
        if (!g) {
          g = { id: 'row-new-' + Math.random().toString(36).slice(2, 8), __index: -1,
                row: { [cols[0].key]: gname, id: '', tag: '' }, hidden: false, children: [] }
          next.push(g)
        }
        g.children = g.children || []
        // 已存在的商品不重复导入
        if (g.children.some((c) => String(c.row?.id || '') === String(p.id))) continue
        g.children.push({
          id: 'row-new-' + Math.random().toString(36).slice(2, 8), __index: -1,
          row: { [cols[0].key]: p.name, id: String(p.id), tag: '' }, hidden: false, children: [],
        })
      }
      writeTree(next)
    }
    const importedIds = (() => {
      const uniq = []
      const walk = (ns) => ns.forEach((n) => { const v = String(n.row?.id || '').trim(); if (v) uniq.push(v); if (n.children) walk(n.children) })
      walk(tree)
      return uniq
    })()
    return (
      <div>
        {hintOf(field) && <p className="mb-2 text-xs leading-5 text-muted-foreground">{hintOf(field)}</p>}
        {field.importLabel && (
          <div className="mb-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setImporterOpen(true)}>
              <Package className="size-3.5" />{field.importLabel}
            </Button>
          </div>
        )}
        <ProductImporter
          open={importerOpen}
          onOpenChange={setImporterOpen}
          importedIds={importedIds}
          onImport={doImport}
        />
        <TreeSortEditor
          tree={tree}
          setTree={writeTree}
          maxLevel={maxLevel}
          canAddChild={n => n.row.source !== 'cart'}
          dropPositions={isNavigation ? (moved, target) => {
            if (target?.row.source === 'cart') return ['before', 'after']
            if (moved?.row.source === 'cart') return tree.some(n => n.id === target?.id) ? ['before', 'after'] : []
            return ['before', 'inside', 'after']
          } : undefined}
          getLabel={treeNodeLabel}
          renderMeta={treeNodeMeta}
          addLabel={field.addLabel || '添加一项'}
          headerMeta={`${list.length} 项`}
          extraAction={descCol ? {
            icon: MessageSquareText,
            label: (n) => (String(n.row?.[descCol.key] || '').trim() ? '编辑描述（已自定义）' : '编辑描述'),
            // 只给商品行（有商品 ID 的行）显示：分组行没有可编辑的描述
            when: (n) => String(n.row?.id || '').trim() !== '',
            onClick: (n) => setDescEditing({
              index: n.__index,
              name: treeNodeLabel(n),
              desc: String(n.row?.[descCol.key] || ''),
            }),
          } : undefined}
          onEdit={(node) => {
            // 树节点复用同一个编辑弹窗（按 __index 定位原始行）
            const idx = node.__index >= 0 ? node.__index : list.findIndex((x) => x.row === node.row)
            setEditing({ index: idx, row: { ...node.row }, hidden: !!node.hidden, child: !tree.some(n => n.id === node.id) })
          }}
          onAddChild={(node) => {
            // 先打开弹窗填写内容；保存时再插入树（插入目标记在 __treeParentId）
            const blank = makeNode()
            setEditing({ index: -1, row: blank.row, hidden: false, child: !!node, __treeParentId: node?.id || null })
          }}
          onDelete={(node) => {
            const next = JSON.parse(JSON.stringify(tree))
            const drop = (nodes) => {
              for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === node.id) {
                  // 删除父级时其子级上移为同级（与旧版行为一致）
                  const kids = nodes[i].children || []
                  nodes.splice(i, 1, ...kids.map((k) => ({ ...k, child: false })))
                  return true
                }
                if (nodes[i].children?.length && drop(nodes[i].children)) return true
              }
              return false
            }
            drop(next)
            writeTree(next)
          }}
          onToggleHidden={(node) => {
            const next = JSON.parse(JSON.stringify(tree))
            const flip = (nodes) => {
              for (const n of nodes) {
                if (n.id === node.id) { n.hidden = !n.hidden; return true }
                if (n.children?.length && flip(n.children)) return true
              }
              return false
            }
            flip(next)
            writeTree(next)
          }}
          onReject={setLiveMsg}
          
        />
        {isNavigation && tree.some(n => n.row.source === 'cart') && (
          <section className="mt-5 rounded-lg border border-line bg-surface/50 p-4" aria-label="自动同步产品目录">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-sm font-medium">前台产品目录 · 自动同步</h3><p className="mt-1 text-xs text-muted-foreground">一级分类 → 二级分类 → 商品。内容、顺序及显隐在商品管理中维护。</p></div>
              <Button type="button" size="sm" variant="outline" onClick={loadNavCatalog}>刷新目录</Button>
            </div>
            {navCatalog.loading ? <p className="text-sm text-muted-foreground">正在读取目录…</p> : navCatalog.error ? <p role="alert" className="text-sm text-danger">{navCatalog.error}</p> : navCatalog.tree.length === 0 ? <p className="text-sm text-muted-foreground">暂无可见分类，前台显示产品服务入口。</p> : (
              <ul className="space-y-3">{navCatalog.tree.map((first, i) => <li key={first.file_address}>
                <details open={i === 0}><summary className="cursor-pointer py-1 text-sm font-medium">{first.name}</summary>
                  <ul className="ml-3 border-l border-line pl-4">{first.children.map(second => <li key={second.file_address} className="py-2">
                    <a className="text-sm font-medium underline-offset-4 hover:underline" href={second.file_address} target="_blank" rel="noopener">{second.name}</a>
                    <ul className="mt-1 ml-3 space-y-1 border-l border-line pl-3">{second.children.map(product => <li key={product.file_address}><a className="text-xs text-muted-foreground underline-offset-4 hover:underline" href={product.file_address} target="_blank" rel="noopener">{product.name}</a></li>)}</ul>
                  </li>)}</ul>
                </details>
              </li>)}</ul>
            )}
          </section>
        )}
        <DragAnnouncer message={liveMsg} />
        {editingDialog}

        {/* 「编辑描述」：只写本模块的 desc 列，不触碰 v10 商品资料。
            与「编辑」共用行定位方式（__index），保存后立即反映到前台本模块。 */}
        <Dialog open={!!descEditing} onOpenChange={(v) => !v && setDescEditing(null)}>
          <DialogContent className="max-w-[560px]">
            <DialogHeader>
              <DialogTitle>编辑描述</DialogTitle>
              <DialogDescription>{descEditing?.name}</DialogDescription>
            </DialogHeader>
            {descEditing && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  writeDesc(descEditing.index, descEditing.desc)
                  setDescEditing(null)
                }}
              >
                <div>
                  <Label className="mb-1.5 block">展示描述</Label>
                  <Textarea
                    rows={4}
                    value={descEditing.desc}
                    placeholder={descCol?.placeholder || '留空则用 v10 商品描述'}
                    onChange={(e) => setDescEditing((s) => ({ ...s, desc: e.target.value }))}
                  />
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    仅本模块展示使用，<strong className="font-medium text-ink">不会修改 v10 系统商品描述</strong>；留空时回退显示系统商品描述。
                  </p>
                </div>
                <DialogFooter>
                  {descEditing.desc !== '' && (
                    <Button type="button" variant="outline"
                            onClick={() => setDescEditing((s) => ({ ...s, desc: '' }))}>
                      清空描述
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => setDescEditing(null)}>取消</Button>
                  <Button type="submit">应用到草稿</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Label>{field.label}</Label>
        <Button size="sm" variant="outline"
                onClick={() => setEditing({ index: -1, row: field.boundPage?{page:field.boundPage}:{}, hidden: false, child: false })}>
          {field.addLabel || '添加一项'}
        </Button>
      </div>

      {hintOf(field) && <p className="mb-2 text-xs leading-5 text-muted-foreground">{hintOf(field)}</p>}

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-alt/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
          暂无内容，点击上方按钮添加
        </div>
      ) : (
        <ul className={DRAG_LIST_BASE}>
          {list.map((it, i) => (
            <li
              key={i}
              draggable
              {...drag.itemProps(i)}
              className={dragRowClass({ isDragging: drag.isDragging(i), isOver: drag.isOver(i) })}
            >
              <DragHandle {...drag.handleProps(i, '拖拽排序：' + titleOf(it))} />
              <div className="flex min-w-0 flex-1 items-center gap-1.5">{(it.row.image||it.row.img)&&<img src={it.row.image||it.row.img} alt="" className="h-10 w-14 shrink-0 rounded object-cover"/>}
                <span className={cn('truncate text-[13px]', it.hidden ? 'text-muted-foreground line-through opacity-60' : 'text-ink')}>
                  {it.child ? '└ ' : ''}{titleOf(it)}
                </span>
                {subtitleOf(it) && (
                  <span className="hidden shrink-0 truncate text-[11px] text-muted-foreground sm:block">
                    {subtitleOf(it)}
                  </span>
                )}
              </div>
              {drag.isOver(i) && <DropBadge pos={drag.dropPos} />}
              {it.hidden && <Badge tone="muted">隐藏</Badge>}
              <div className="flex shrink-0 items-center gap-0.5">
                {!field.visual?.dragOnly && <><RowIconBtn label="条目上移" disabled={i===0} onClick={()=>move(i,i-1)}><ArrowUp className="size-3.5"/></RowIconBtn><RowIconBtn label="条目下移" disabled={i===list.length-1} onClick={()=>move(i,i+1)}><ArrowDown className="size-3.5"/></RowIconBtn></>}<RowIconBtn label="编辑" onClick={() => setEditing({ index: i, ...it })}>
                  <Pencil className="size-3.5" />
                </RowIconBtn>
                <RowIconBtn label="删除" danger onClick={() => commit(list.filter((_, k) => k !== i))}>
                  <Trash2 className="size-3.5" />
                </RowIconBtn>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DragAnnouncer message={liveMsg} />

      {editingDialog}
    </div>
  )
}

function NavigationSidebarEditor({ value, row, depth, commonLinks, onChange }) {
  const id = useId(), content = readMenuSidebar(value, row, depth, commonLinks)
  const update = patch => onChange(writeMenuSidebar({ ...content, ...patch }))
  const overview = patch => update({ overview: { ...content.overview, ...patch } })
  const linksField = {
    key: '__menu_sidebar_links', label: '左侧快捷入口', addLabel: '添加快捷入口',
    cols: [{ key: 'name', label: '名称', required: true }, { key: 'url', label: '链接', url: true }, { key: 'desc', label: '简介' }, { key: 'blank', label: '新窗口打开', type: 'checkbox' }],
    visual: { visibleColumns: ['name', 'url', 'blank'], summaryColumns: ['url'], dragOnly: true },
    hint: '拖拽调整顺序，可逐条隐藏；最后一个可见入口显示为按钮。',
  }
  return (
    <section className="space-y-4 border-t border-line pt-4" aria-label="下拉菜单左侧内容">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">下拉菜单左侧内容</h3>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange('')}>恢复菜单默认内容</Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">仅设置当前菜单。分类名称在对应下级菜单中编辑；标题、说明留空则不显示。</p>
      <div><Label htmlFor={id+'title'} className="mb-1.5 block">左侧标题</Label><Input id={id+'title'} value={content.title} maxLength={160} onChange={e => update({ title: e.target.value })} /></div>
      <div><Label htmlFor={id+'description'} className="mb-1.5 block">左侧说明</Label><Textarea id={id+'description'} rows={3} value={content.description} maxLength={1024} onChange={e => update({ description: e.target.value })} /></div>
      <div className="space-y-3 rounded-lg border border-line p-3">
        <div className="flex items-center justify-between gap-3"><span className="text-[13px]">显示左侧总览入口</span><SwitchControl label="显示左侧总览入口" checked={content.overview.enabled} onCheckedChange={enabled => overview({ enabled })} /></div>
        {content.overview.enabled && <>
          <div><Label htmlFor={id+'overview'} className="mb-1.5 block">总览入口文字</Label><Input id={id+'overview'} value={content.overview.name} onChange={e => overview({ name: e.target.value })} /></div>
          <div><Label className="mb-1.5 block">总览入口链接</Label><LinkPicker label="总览入口链接" value={content.overview.url} onChange={url => overview({ url })} /></div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={content.overview.blank} onChange={e => overview({ blank: e.target.checked })} />总览入口新窗口打开</label>
        </>}
      </div>
      <RowsField field={linksField} value={content.links} onChange={links => update({ links })} />
    </section>
  )
}

function hintOf(f) { return f.hint || '' }

/**
 * cards 字段在存储层不是「一个 JSON」，而是按「项键_字段键」展开成多个独立配置键
 * （旧版 admin.js 即如此，如 cap2_title / sol1_url / band_item3_desc，前台与
 *  CRA1::defaults() 都读这些扁平键）。因此这里统一给出它占用的全部配置键，
 *  供脏值统计、撤销与保存复用 —— 不能只写 field.key，那个键根本不存在。
 */
function fieldKeysOf(f) {
  if (f.type !== 'cards') return [f.key]
  const out = []
  ;(f.items || []).forEach((it) => {
    ;(f.fields || []).forEach((cf) => out.push(`${it.key}_${cf.key}`))
  })
  return out
}

/** cards：固定卡片（如能力卡/方案卡），每张卡一个弹窗一次性改完全部子字段 */
function CardsField({ field, config, setField }) {
  const items = field.items || []
  const subFields = field.fields || []
  const [editing, setEditing] = useState(null)   // { itemKey, values }

  const valOf = (it, cf) => String(config?.[`${it.key}_${cf.key}`] ?? '')

  /** 第 which 个「非图标」子字段的值（0=标题，1=描述），与旧版摘要规则一致 */
  function textOf(it, which) {
    let seen = -1
    for (const cf of subFields) {
      if (cf.type === 'icon') continue
      seen += 1
      if (seen === which) return valOf(it, cf)
    }
    return ''
  }

  return (
    <div>
      <Label className="mb-2 block">{field.label}</Label>
      {field.hint && <p className="mb-2 text-xs leading-5 text-muted-foreground">{field.hint}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((it) => {
          const values = {}
          subFields.forEach((cf) => { values[cf.key] = valOf(it, cf) })
          const title = textOf(it, 0) || `${it.label}（未命名）`
          const desc = textOf(it, 1) || '点击编辑'
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => setEditing({ itemKey: it.key, values })}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition-colors duration-150 hover:border-brand/40 hover:bg-brand/4"
            >
              <span className="block truncate text-[13px] font-medium text-ink">{title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{desc}</span>
            </button>
          )
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent><DialogHeader><DialogTitle>{field.label} · 编辑条目</DialogTitle><DialogDescription>取消不改变页面草稿；应用后由工作区保存。</DialogDescription></DialogHeader>
          {editing && <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); subFields.forEach((cf) => setField(`${editing.itemKey}_${cf.key}`, editing.values[cf.key])); setEditing(null) }}>
            {subFields.map((cf) => <Field key={cf.key} field={cf} value={editing.values[cf.key]} onChange={(value) => setEditing((old) => ({ ...old, values:{ ...old.values, [cf.key]:value } }))} />)}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>取消</Button><Button type="submit">应用到草稿</Button></DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>

    </div>
  )
}


export default Field
export { fieldKeysOf }
