import { useCallback, useState, useRef } from 'react'
import { GripVertical, ChevronDown, ChevronRight, Folder, FolderOpen, FileText, Minus, Plus, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@ui/feedback'
import { Button } from '@ui/button'
import { cn } from '@ui/utils'
import SwitchControl from './Switch'
import { RowIconBtn } from './dragSort'

/**
 * 统一树形拖拽排序（唯一实现）
 *
 * 使用方：会员中心「侧边栏导航」与官网 rows 的 tree 字段（菜单导航 / 底部菜单栏）。
 * 视觉与交互基准即侧边栏导航：
 *   - 缩进表达层级：paddingLeft = 8 + (depth-1)*26，子级 ul 带 border-l 导轨
 *   - 行：group flex h-10 items-center gap-2 border-b border-line/60 px-3
 *   - 拖动中 opacity-50；落点 bg-brand/5 + 位置徽章（插到前面 / 插到后面 / 作为子级）
 *   - 容器才显示折叠箭头（ChevronDown/Right）+ 文件夹图标；叶子用文档图标并占位对齐
 *   - 操作列：添加下级（Plus）/ 编辑（Pencil）/ 删除（Trash2）
 *
 * 数据契约（与侧边栏一致）：节点数组 [{ id, children: [...], hidden, ... }]，
 * 展示文案由 getLabel(node) 提供，行内扩展列（链接等）由 renderMeta(node) 提供。
 */

/** 同级内移动一个节点（键盘可达用） */
function moveSibling(list, id, dir) {
  const idx = list.findIndex((n) => n.id === id)
  if (idx !== -1) {
    const to = idx + dir
    if (to < 0 || to >= list.length) return list
    const next = list.slice()
    const [it] = next.splice(idx, 1)
    next.splice(to, 0, it)
    return next
  }
  return list.map((n) => (n.children?.length ? { ...n, children: moveSibling(n.children, id, dir) } : n))
}

/** 树节点查找/删除/替换/后代与深度工具 */
export function findNode(list, id, parentId = null) {
  for (const n of list) {
    if (n.id === id) return { node: n, parentId }
    if (n.children?.length) {
      const hit = findNode(n.children, id, n.id)
      if (hit) return hit
    }
  }
  return null
}
export function removeNode(list, id) {
  const out = []
  for (const n of list) {
    if (n.id === id) continue
    out.push(n.children?.length ? { ...n, children: removeNode(n.children, id) } : n)
  }
  return out
}
export function replaceNode(list, id, updater) {
  return list.map((n) => {
    if (n.id === id) return updater(n)
    if (n.children?.length) return { ...n, children: replaceNode(n.children, id, updater) }
    return n
  })
}
export function collectDescendants(node, out = []) {
  ;(node.children || []).forEach((c) => { out.push(c.id); collectDescendants(c, out) })
  return out
}
function isDescendant(list, ancestorId, maybeDescendantId) {
  const hit = findNode(list, ancestorId)
  if (!hit) return false
  return collectDescendants(hit.node).includes(maybeDescendantId)
}
function subtreeDepth(n) {
  return 1 + Math.max(0, ...((n.children || []).map(subtreeDepth)))
}
function depthAt(list, id, d = 1) {
  for (const n of list) {
    if (n.id === id) return d
    if (n.children?.length) { const hit = depthAt(n.children, id, d + 1); if (hit) return hit }
  }
  return 0
}
export function countTree(list) {
  return (list || []).reduce((n, x) => n + 1 + countTree(x.children), 0)
}

/* -------------------------------------------------------------------------- */
/* 拖拽落点与放置（树语义：上 1/3 插前、下 1/3 插后、中间作为子级，最多 maxLevel 级） */
/* -------------------------------------------------------------------------- */

function useTreeDrag({ tree, setTree, maxLevel = 3, onReject, isSeparator, dropPositions }) {
  const [dragId, setDragId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  const onDragOver = useCallback((e, nodeId, depth) => {
    const allowed = dropPositions?.(findNode(tree, dragId)?.node, findNode(tree, nodeId)?.node)
    if (allowed && !allowed.length) {
      setDropTarget(null)
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
      return
    }
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const ratio = r.height > 0 ? (e.clientY - r.top) / r.height : 0.5
    const pos = allowed?.length === 1 ? allowed[0] : allowed && !allowed.includes('inside')
      ? (ratio < 0.5 ? 'before' : 'after')
      : depth >= maxLevel || isSeparator(findNode(tree, nodeId)?.node)
      ? (ratio < 0.5 ? 'before' : 'after')
      : (ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside')
    setDropTarget({ id: nodeId, pos })
  }, [maxLevel, tree, isSeparator, dragId, dropPositions])

  const onDrop = useCallback(() => {
    if (!dragId || !dropTarget) { setDragId(null); setDropTarget(null); return }
    const { id: targetId, pos } = dropTarget
    if (dragId === targetId) { setDragId(null); setDropTarget(null); return }
    if (isDescendant(tree, dragId, targetId)) {
      onReject?.('不能把父级移动到自己的子级下')
      setDragId(null); setDropTarget(null); return
    }
    const stripped = removeNode(tree, dragId)
    const src = findNode(stripped, dragId) || findNode(tree, dragId)
    const moved = src?.node
    if (!moved) { setDragId(null); setDropTarget(null); return }
    if (dropPositions && !dropPositions(moved, findNode(tree, targetId)?.node).includes(pos)) {
      onReject?.('不能移动到这个位置')
      setDragId(null); setDropTarget(null); return
    }
    const targetDepth = depthAt(tree, targetId)
    if (isSeparator(moved) && (pos === 'inside' || targetDepth !== 1)) {
      onReject?.('分界线只能放在一级菜单之间')
      setDragId(null); setDropTarget(null); return
    }
    const wouldBe = pos === 'inside' ? subtreeDepth(moved) + targetDepth : subtreeDepth(moved) + targetDepth - 1
    if (wouldBe > maxLevel) {
      onReject?.(`最多 ${maxLevel} 级：该项及其子级放不进这个位置`)
      setDragId(null); setDropTarget(null); return
    }
    let next
    if (pos === 'inside') {
      next = replaceNode(stripped, targetId, (t) => ({ ...t, children: [...(t.children || []), moved] }))
    } else {
      const insertInto = (list) => {
        const out = []
        for (const n of list) {
          if (n.id === targetId) {
            if (pos === 'before') out.push(moved, n)
            else out.push(n, moved)
          } else {
            out.push(n.children?.length ? { ...n, children: insertInto(n.children) } : n)
          }
        }
        return out
      }
      next = insertInto(stripped)
    }
    setTree(next)
    setDragId(null)
    setDropTarget(null)
  }, [dragId, dropTarget, tree, setTree, maxLevel, onReject, isSeparator, dropPositions])

  return { dragId, setDragId, dropTarget, setDropTarget, onDragOver, onDrop }
}

/* -------------------------------------------------------------------------- */
/* 渲染                                                                        */
/* -------------------------------------------------------------------------- */

const LEVEL_LABELS = { 1: '一级', 2: '二级', 3: '三级', 4: '四级' }

/* 行内图标按钮统一用 dragSort 的 RowIconBtn（§3 唯一实现）。
   此处原有一份同样的实现，两处各自维护 —— 修尺寸时容易只改一处；
   且它的 p-1 + 14px 图标只有 22×22，低于 §10.2 的 24px 下限。 */

/**
 * 树形排序编辑器（唯一实现）
 *
 * props:
 *   tree / setTree    节点数组与更新函数（节点需含 id / children / hidden）
 *   getLabel(node)    行标题
 *   renderMeta(node)  链接等扩展列（可空）
 *   onEdit/onAddChild/onDelete/onToggleHidden  行操作
 *   addLabel          顶部新增按钮文案（不传则不显示顶部按钮）
 *   maxLevel          最大层级（默认 3）
 *   onReject(msg)     层级/环路被拒时的提示
 *   isBranch(node)    空分组仍显示为可折叠容器（默认按 children 判断）
 *   levelLabels       可替换一级/二级/三级为业务标签
 *   dropPositions     可限制业务节点的落点；不传时沿用菜单树的层级规则
 *   extraAction       可选的额外行操作 { icon, label(node), when(node), onClick(node) }；
 *                     仅当 when(node) 为真时渲染（如「只给商品行加编辑描述」）
 */
export function TreeSortEditor({
  tree, setTree, getLabel, renderMeta,
  onEdit, onAddChild, onDelete, onToggleHidden,
  addLabel, maxLevel = 3, onReject, headerMeta, extraAction,
  hiddenOf = (node) => !!node.hidden,
  isSeparator = () => false,
  isBranch = () => false,
  levelLabels = LEVEL_LABELS,
  dropPositions, canAddChild = () => true,
}) {
  const [expanded, setExpanded] = useState({})
  const [kbdId, setKbdId] = useState(null)
  const keyboardOrigin = useRef(null)
  const [liveMsg, setLiveMsg] = useState('')
  const drag = useTreeDrag({ tree, setTree, maxLevel, onReject, isSeparator, dropPositions })
  const { dragId, setDragId, dropTarget, setDropTarget, onDragOver, onDrop } = drag

  const total = countTree(tree)

  const renderRow = (node, depth) => {
    const separator = isSeparator(node)
    const kids = node.children || []
    const isOpen = expanded[node.id] !== false
    const isContainer = kids.length > 0 || isBranch(node)
    const isDropTarget = dropTarget?.id === node.id
    return (
      <li key={node.id}>
        <div
          data-tree-row={node.id}
          draggable
          onDragStart={() => setDragId(node.id)}
          onDragEnd={() => { setDragId(null); setDropTarget(null) }}
          onDragOver={(e) => onDragOver(e, node.id, depth)}
          onDrop={(e) => { e.preventDefault(); onDrop() }}
          className={cn(
            'tree-editor-row group flex h-10 items-center gap-2 border-b border-line/60 px-3 transition-colors duration-150',
            isDropTarget && 'bg-brand/5',
            dragId === node.id && 'opacity-50',
          )}
          style={{ paddingLeft: 8 + (depth - 1) * 26 }}
        >
          <span
            data-drag-handle role="button" tabIndex={0}
            aria-label={'拖拽排序：' + (getLabel(node) || '项目')}
            aria-pressed={kbdId === node.id ? 'true' : 'false'}
            title="拖拽排序（或按空格抓取后用方向键移动）"
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                if (kbdId === node.id) { setKbdId(null); setLiveMsg(`已放置：${getLabel(node)}`) ; return }
                keyboardOrigin.current = JSON.parse(JSON.stringify(tree))
                setKbdId(node.id)
                setLiveMsg(`已抓取：${getLabel(node)}，按方向键移动，空格放置，Escape 取消`)
              } else if (kbdId === node.id && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault()
                setTree(moveSibling(tree, node.id, e.key === 'ArrowUp' ? -1 : 1))
                setLiveMsg(e.key === 'ArrowUp' ? '已上移' : '已下移')
              } else if (e.key === 'Escape' && kbdId) { e.preventDefault(); if (keyboardOrigin.current) setTree(keyboardOrigin.current); keyboardOrigin.current = null; setKbdId(null); setLiveMsg('已取消移动，顺序已恢复') }
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          >
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-line group-hover:text-muted-foreground" aria-hidden="true" />
          </span>

          {/* 折叠箭头：容器才显示，叶子占位对齐。
              命中区 size-6（24px，§10.2）；图标仍 size-3.5，靠 flex 居中撑开。
              叶子占位同步用 w-6，保证有/无箭头的行左边缘对齐。 */}
          {isContainer ? (
            <button
              type="button"
              onClick={() => setExpanded((s) => ({ ...s, [node.id]: !isOpen }))}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-surface-alt"
              aria-label={isOpen ? '收起子级' : '展开子级'}
              aria-expanded={isOpen ? 'true' : 'false'}
            >
              {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          ) : <span className="tree-editor-leaf-space w-6 shrink-0" aria-hidden="true" />}

          {/* 层级图标 */}
          {separator ? <Minus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /> : isContainer
            ? (isOpen
                ? <FolderOpen className="size-3.5 shrink-0 text-brand/80" aria-hidden="true" />
                : <Folder className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />)
            : <FileText className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />}

          {/* 名称列 + 层级徽章 + 落点徽章 */}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className={cn(
                'truncate text-[13px]',
                isContainer ? 'font-medium text-brand' : 'text-ink',
                hiddenOf(node) && 'line-through opacity-60',
              )}>
                {getLabel(node) || '(未命名)'}
              </span>
              <span className="shrink-0 rounded bg-surface-alt px-1 py-px text-[10px] leading-4 text-muted-foreground">
                {levelLabels[depth] || ''}
              </span>
              {isDropTarget && (
                <Badge tone="default">
                  {dropTarget.pos === 'inside' ? '作为子级' : dropTarget.pos === 'before' ? '插到前面' : '插到后面'}
                </Badge>
              )}
            </div>
          </div>

          {/* 扩展列（链接等） */}
          {renderMeta && (
            <div className="tree-editor-meta hidden w-56 shrink-0 sm:block">
              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                {renderMeta(node) || '—'}
              </span>
            </div>
          )}

          <div className="tree-editor-controls flex shrink-0 items-center gap-2">
          {/* 显示开关 */}
          <div className="flex w-11 shrink-0 justify-center">
            <SwitchControl
              size="sm"
              label={hiddenOf(node) ? '显示该项' : '隐藏该项'}
              checked={!hiddenOf(node)}
              onCheckedChange={() => onToggleHidden?.(node)}
            />
          </div>

          {/* 操作列：添加下级 / 编辑 / 删除（+ 可选的业务动作，如「编辑描述」）
              宽度按实际按钮数计算，避免加了动作按钮后被截断。 */}
          <div className="flex shrink-0 items-center justify-end gap-0.5">
            {extraAction && extraAction.when?.(node) && (
              <RowIconBtn label={extraAction.label(node)} onClick={() => extraAction.onClick(node)}>
                <extraAction.icon className="size-3.5" />
              </RowIconBtn>
            )}
            <RowIconBtn label={separator ? '分界线没有下级菜单' : !canAddChild(node) ? '下级由数据来源自动同步' : depth >= maxLevel ? '已到最深层级' : '添加下级'} onClick={() => onAddChild?.(node)} disabled={separator || depth >= maxLevel || !canAddChild(node)}>
              <Plus className="size-3.5" />
            </RowIconBtn>
            <RowIconBtn label="编辑" onClick={() => onEdit?.(node)}>
              <Pencil className="size-3.5" />
            </RowIconBtn>
            <RowIconBtn label="删除" danger onClick={() => onDelete?.(node)}>
              <Trash2 className="size-3.5" />
            </RowIconBtn>
          </div>
          </div>
        </div>

        {/* 子级：缩进导轨表达层级 */}
        {isContainer && isOpen && (
          <ul className="border-l border-line/70" style={{ marginLeft: 26 + (depth - 1) * 26 }}>
            {kids.map((c) => renderRow(c, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="tree-editor">
      {(addLabel || headerMeta) && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{headerMeta}</span>
          {/* 用共享 Button size="sm"（h-8 = 32px）而非手写 padding：
              手写 py-1.5 实得 34px，与 FieldWidget 的添加按钮（32px）不一致（§13）。 */}
          {addLabel && (
            <Button size="sm" variant="outline" onClick={() => onAddChild?.(null)}>
              <Plus />{addLabel}
            </Button>
          )}
        </div>
      )}

      {tree.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface-alt/50 px-4 py-6 text-center text-[13px] text-muted-foreground">
          暂无内容，点击上方按钮添加
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="tree-editor-heading flex items-center gap-2 border-b border-line bg-surface-alt/50 px-3 py-2 text-[11px] font-medium text-muted-foreground">
            <span className="w-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">名称</span>
            {renderMeta && <span className="hidden w-56 shrink-0 truncate sm:block">链接 / 来源</span>}
            <span className="w-11 shrink-0 text-center">显示</span>
            <span className={cn('shrink-0 text-right', extraAction ? 'w-32' : 'w-24')}>操作</span>
          </div>
          <ul>{tree.map((n) => renderRow(n, 1))}</ul>
        </div>
      )}
      <span className="sr-only" aria-live="polite">{liveMsg}</span>
    </div>
  )
}
