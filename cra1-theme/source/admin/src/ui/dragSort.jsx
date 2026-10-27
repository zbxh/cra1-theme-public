import { useCallback, useState, useRef } from 'react'
import { GripVertical } from 'lucide-react'
import { Badge } from '@ui/feedback'
import { cn } from '@ui/utils'

/**
 * 统一拖拽排序样式与键盘操作
 *
 * 视觉基准 = 会员中心「侧边栏导航」树行：
 *   - 手柄：GripVertical，size-3.5，常态 text-line，行 hover 变 muted
 *   - 拖动中：opacity-50
 *   - 落点：bg-brand/5 浅底 + 位置徽章（插到前面 / 插到后面 / 作为子级）
 *   - 行容器：group flex items-center gap-2 border-b border-line/60 px-3 transition-colors duration-150
 *
 * 键盘可达（不依赖上下移按钮）：手柄聚焦后 Space 抓取 → ↑/↓ 移动 → Space 放置 → Esc 取消，
 * 状态通过 aria-pressed 与 aria-live 播报。所有列表共用同一套实现，避免多份拷贝分叉。
 */

/** 手柄图标 class（与侧边栏树行一致） */
const DRAG_HANDLE_ICON = 'size-3.5 shrink-0 cursor-grab text-line group-hover:text-muted-foreground'

/** 行容器基础 class（与侧边栏树行一致；min-h 兼容「标题+副标题」两行内容） */
export const DRAG_ROW_BASE =
  'group flex h-10 items-center gap-2 border-b border-line/60 px-3 transition-colors duration-150 last:border-b-0'

/** 拖拽列表容器（与侧边栏所在卡片同构：一个描边圆角容器包住全部行） */
export const DRAG_LIST_BASE = 'overflow-hidden rounded-lg border border-line bg-surface'

/** 行内操作图标按钮（与侧边栏操作列同一套视觉）
 *
 * 尺寸：桌面 size-8（32×32），移动端由工作区样式扩展到 44px。
 * 原先用 p-1 包 14px 图标，实际只有 22×22，行内一排图标按钮
 * （拖拽/上移/下移/复制/删除）全部差 2px 不达标；改为固定 size-8
 * 后既达到 24px，也让「各种框高度统一」（§13）在图标按钮上成立。
 * 图标本身保持 size-3.5 视觉不变，靠 flex 居中撑出命中区。 */
export function RowIconBtn({ children, label, onClick, danger, disabled }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded transition-colors duration-150 disabled:opacity-40',
        danger ? 'text-danger hover:bg-danger/8' : 'text-muted-foreground hover:bg-surface-alt hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/** 行状态 class：落点浅底 + 拖动中半透明 */
export function dragRowClass({ isDragging, isOver, className } = {}) {
  return cn(DRAG_ROW_BASE, isOver && 'bg-brand/5', isDragging && 'opacity-50', className)
}

/** 落点位置徽章（插到前面 / 插到后面 / 作为子级） */
export function DropBadge({ pos }) {
  if (!pos) return null
  const text = pos === 'inside' ? '作为子级' : pos === 'before' ? '插到前面' : '插到后面'
  return <Badge tone="default">{text}</Badge>
}

/**
 * 扁平/树列表的落点计算：前半插到前面、后半插到后面（树行再叠加 inside 区间）。
 * axis='x' 时按**水平**位置判定（用于标签 chips 等横向排列的元素），
 * 否则按垂直位置（rows 行、模块卡等纵向列表）。
 */
function dropPosFromEvent(e, allowed = ['before', 'after'], axis = 'y') {
  const r = e.currentTarget.getBoundingClientRect()
  const ratio = axis === 'x'
    ? (r.width > 0 ? (e.clientX - r.left) / r.width : 0.5)
    : (r.height > 0 ? (e.clientY - r.top) / r.height : 0.5)
  if (allowed.includes('inside')) {
    return ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside'
  }
  return ratio < 0.5 ? 'before' : 'after'
}

/**
 * 键盘抓取/移动/放置。onMove(fromIndex, toIndex) 由调用方实现实际重排。
 * 返回 { dragging, handleKeyDown, message }，message 用于页面级 aria-live 播报。
 */

/**
 * 扁平列表拖拽排序（唯一实现）
 *
 * 用于所有「一维顺序」列表：rows 行编辑器、页面模块卡、会员公告条等。
 * 与 TreeSortEditor 共享同一行样式、同一落点规则（上 1/2 插前、下 1/2 插后）、
 * 同一拖动/悬停视觉（opacity-50 / bg-brand/5 + 位置徽章）。
 *
 * 用法：
 *   const drag = useFlatDrag({ count, onMove })
 *   <li {...drag.itemProps(i)} className={dragRowClass({ isDragging: drag.isDragging(i), isOver: drag.isOver(i) })}>
 *     <DragHandle {...drag.handleProps(i, '拖拽排序：xxx')} />
 *     {drag.isOver(i) && <DropBadge pos={drag.dropPos} />}
 *   </li>
 *
 * keyOf 可选：自定义稳定标识（默认用下标）。索引型列表直接用下标即可。
 */
export function useFlatDrag({ count, onMove, keyOf, onAnnounce, onPickup, onCancel, axis = 'y' }) {
  const [dragIndex, setDragIndex] = useState(-1)
  const [overIndex, setOverIndex] = useState(-1)
  const [dropPos, setDropPos] = useState('after')
  const [kbdIndex, setKbdIndex] = useState(-1)
  const keyboard = useRef(null)
  const say = (message) => onAnnounce?.(message)

  const isDragging = useCallback((i) => dragIndex === i, [dragIndex])
  const isOver = useCallback((i) => overIndex === i && dragIndex !== i, [overIndex, dragIndex])

  const indexOf = useCallback((item, fallback) => (keyOf ? keyOf(item) : fallback), [keyOf])

  /** 需要挂到列表项上的拖拽事件（draggable 由调用方按需决定是否启用） */
  const itemProps = useCallback((i) => ({
    onDragStart: (e) => {
      if (e.target.closest?.('[data-drag-handle]') || e.target === e.currentTarget) {
        setDragIndex(i)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
      }
    },
    onDragEnd: () => { setDragIndex(-1); setOverIndex(-1) },
    onDragOver: (e) => {
      if (dragIndex < 0 || dragIndex === i) return
      e.preventDefault()
      setOverIndex(i)
      setDropPos(dropPosFromEvent(e, ['before', 'after'], axis))
    },
    onDrop: (e) => {
      e.preventDefault()
      if (dragIndex >= 0 && dragIndex !== i) {
        const pos = dropPosFromEvent(e, ['before', 'after'], axis)
        const target = i + (pos === 'after' ? 1 : 0) - (dragIndex < i ? 1 : 0)
        if (target !== dragIndex) onMove(dragIndex, target)
      }
      setDragIndex(-1)
      setOverIndex(-1)
    },
  }), [dragIndex, onMove, axis])

  /**
   * 手柄：键盘抓取 → 方向键移动 → 空格放置 → Esc 取消
   * 注意：移动后被抓取项的下标会变，必须同步 kbdIndex，
   * 否则连续按方向键时后续移动会基于过期下标（只生效一次）。
   */
  const handleProps = (i, label) => ({
    label,
    dragging: kbdIndex === i,
    onKeyDown: (e) => {
      const active = keyboard.current
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (active) {
          keyboard.current = null
          setKbdIndex(-1)
          say(`已放置：${active.label}，第 ${active.index + 1} 项`)
        } else {
          keyboard.current = { origin: i, index: i, label, snapshot: onPickup?.() }
          setKbdIndex(i)
          say(`已抓取：${label}，按方向键移动，空格放置，Escape 取消`)
        }
      } else if (active && e.key === 'Escape') {
        e.preventDefault()
        if (onCancel) onCancel(active.snapshot)
        else if (active.index !== active.origin) onMove(active.index, active.origin)
        keyboard.current = null
        setKbdIndex(-1)
        say('已取消移动，顺序已恢复')
      } else if (active && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const size = typeof count === 'function' ? count() : count
        const next = Math.max(0, Math.min(size - 1, active.index + (['ArrowUp','ArrowLeft'].includes(e.key) ? -1 : 1)))
        if (next !== active.index) {
          onMove(active.index, next)
          active.index = next
          setKbdIndex(next)
          say(`已移动：${active.label}，第 ${next + 1} 项`)
        }
      }
    },
  })

  return {
    dragIndex, overIndex, dropPos, isDragging, isOver, itemProps, handleProps,
    draggingIndex: dragIndex, setDragIndex, setOverIndex,
  }
}

/** 抓取手柄：图标 + 键盘抓取（拖拽由所在行发起，与侧边栏一致） */
export function DragHandle({ label, dragging, onKeyDown, title }) {
  return (
    <span
      role="button"
      tabIndex={0}
      data-drag-handle
      aria-label={label}
      aria-pressed={dragging ? 'true' : 'false'}
      onKeyDown={onKeyDown}
      title={title || '拖拽排序（或按空格抓取后用方向键移动）'}
      className="flex size-8 shrink-0 items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
    >
      <GripVertical className={DRAG_HANDLE_ICON} aria-hidden="true" />
    </span>
  )
}

/** 页面级键盘播报（每页渲染一次即可） */
export function DragAnnouncer({ message }) {
  return (
    <span className="sr-only" aria-live="polite">{message}</span>
  )
}
