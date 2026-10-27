import { useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Pencil, Power } from 'lucide-react'
import { Badge } from '@ui/feedback'
import { RowIconBtn } from '../ui/dragSort'

export function productEntryValue(config, node) {
  return config.overrides?.[node.id] || { enabled: 0, title: node.label, description: '该分类下的产品列表', html: '' }
}

/** Reflect the menu hierarchy without pretending that reordering copy changes menus. */
export default function ProductListEntries({ tree, config, onEdit, onToggle }) {
  const [collapsed, setCollapsed] = useState({})
  const render = node => {
    const branch = node.children.length > 0, open = !collapsed[node.id]
    const value = node.product ? productEntryValue(config, node) : null
    return <li key={node.id}>
      <div data-product-row={node.id} className="flex min-h-12 items-center gap-2 border-b border-line/60 px-3 py-2">
        {branch ? <button type="button" className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" aria-label={`${open ? '收起' : '展开'}：${node.label}`} aria-expanded={open} onClick={() => setCollapsed(current => ({ ...current, [node.id]: open }))}>
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button> : <span className="w-6 shrink-0" aria-hidden="true" />}
        {branch ? (open ? <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" /> : <Folder className="size-3.5 shrink-0 text-muted-foreground" />) : <FileText className="size-3.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1" title={node.path.join(' → ')}>
          <p className="break-words text-[13px] font-medium text-ink">{node.label}</p>
          <p className="text-[11px] leading-5 text-muted-foreground">{node.product ? Number(value.enabled) === 1 ? '独立设置' : '使用全局默认' : '菜单分组'}{node.hidden ? ' · 菜单已隐藏' : ''}</p>
        </div>
        {node.product && <div className="flex shrink-0 items-center gap-0.5">
          <RowIconBtn label={`编辑：${node.label}`} onClick={() => onEdit(node, value)}><Pencil className="size-3.5" /></RowIconBtn>
          <RowIconBtn label={`${Number(value.enabled) === 1 ? '停用' : '启用'}覆盖：${node.label}`} onClick={() => onToggle(node, value)}><Power className="size-3.5" /></RowIconBtn>
        </div>}
      </div>
      {branch && open && <ul className="ml-4 border-l border-line/70" aria-label={`${node.label}的下级菜单`}>{node.children.map(render)}</ul>}
    </li>
  }
  return <div className="space-y-4">
    <div data-product-default className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <Badge>全局默认</Badge><div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-ink">所有未启用独立设置的入口</p><p className="text-xs leading-5 text-muted-foreground">{Number(config.default?.enabled) === 1 ? '已启用' : '使用主题内置内容'}</p></div>
      <RowIconBtn label="编辑：全局默认" onClick={() => onEdit(null, config.default)}><Pencil className="size-3.5" /></RowIconBtn>
    </div>
    {tree.length ? <div className="overflow-hidden rounded-lg border border-line bg-surface"><ul aria-label="产品列表菜单层级">{tree.map(render)}</ul></div> : <p className="rounded-lg border border-dashed border-line bg-surface-alt/40 px-4 py-3 text-[13px] text-muted-foreground">侧边栏导航中还没有产品列表类菜单。可先到「公共设置 → 菜单」添加。</p>}
  </div>
}
