import { useCallback, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@ui/utils'
// §3 硬性标准：拖拽只用既有那一套（禁止自建状态机与 onDrag* 四件套）
import { DragHandle, useFlatDrag } from './dragSort'

/**
 * 标签输入控件（chips）
 *
 * 交互（按需求）：
 *   - 输入框内直接输入，**英文逗号 或 回车** 即把当前文字应用为一个标签；
 *   - 已应用的标签**固定在输入框内**（胶囊 chip），随输入框一起换行，不飘到外面；
 *   - **拖拽标签可排序**；
 *   - 退格键在输入为空时删除最后一个标签；点 × 删除单个标签。
 *
 * 存储：字符串 ↔ 数组的转换交给调用方（serialize/parse），控件只处理数组。
 * 拖拽：**复用共享 useFlatDrag**（axis='x' 水平落点），不新建状态机、不手写 onDrag* 四件套
 *   （§3 硬性标准）。
 */

const CHIP_BASE =
  'inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-surface-alt ' +
  'px-2 py-0.5 text-[12px] leading-5 text-body transition-[background-color,border-color,opacity,transform] duration-150'

export function TagInput({
  value = [],
  onChange,
  placeholder = '输入后按回车或英文逗号添加',
  disabled = false,
  className,
  maxTags,
  ariaLabel,
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const emit = useCallback((next) => { onChange?.(next) }, [onChange])

  /** 应用草稿：按英文逗号 / 中文逗号 / 顿号 切分，一次可加多个 */
  const commitDraft = useCallback((raw) => {
    const text = String(raw ?? '')
    if (!text) return
    const parts = text.split(/[,，、]/).map((x) => x.trim()).filter((x) => x !== '')
    if (!parts.length) { setDraft(''); return }
    const next = [...value]
    for (const p of parts) {
      if (next.includes(p)) continue                       // 去重：同名标签不重复添加
      if (maxTags && next.length >= maxTags) break
      next.push(p)
    }
    emit(next)
    setDraft('')
  }, [value, emit, maxTags])

  const removeAt = useCallback((i) => {
    const next = value.filter((_, idx) => idx !== i)
    emit(next)
  }, [value, emit])

  const move = useCallback((from, to) => {
    if (from === to || from < 0 || to < 0 || from >= value.length || to >= value.length) return
    const next = [...value]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    emit(next)
  }, [value, emit])

  /* 共享拖拽（§3）：axis='x' 按水平落点判定前后；onMove 语义与共享实现一致（移动到目标下标） */
  const drag = useFlatDrag({
    count: value.length,
    axis: 'x',
    onMove: move,
  })

  const onKeyDown = (e) => {
    // Enter confirms Chinese/Japanese composition before it adds a tag.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return
    // 回车 / 英文逗号：应用
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitDraft(draft)
      return
    }
    // 退格：输入为空时删除最后一个标签
    if (e.key === 'Backspace' && draft === '' && value.length) {
      e.preventDefault()
      removeAt(value.length - 1)
      return
    }
    // 方向键在输入框内移动光标，不拦截
  }

  const onPaste = (e) => {
    const text = e.clipboardData?.getData('text') ?? ''
    if (/[,，、]/.test(text)) {
      e.preventDefault()
      commitDraft(text)
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5',
        'transition-[border-color,box-shadow] duration-150',
        'focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15',
        disabled && 'cursor-not-allowed bg-surface-alt',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          draggable={!disabled}
          {...(disabled ? {} : drag.itemProps(i))}
          className={cn(
            CHIP_BASE,
            'cursor-grab active:cursor-grabbing',
            drag.isDragging(i) && 'opacity-50',
            drag.isOver(i) && 'border-brand/40 bg-brand/5',
            drag.isOver(i) && (drag.dropPos === 'before' ? 'shadow-[-2px_0_0_var(--brand)]' : 'shadow-[2px_0_0_var(--brand)]'),
            disabled && 'cursor-not-allowed',
          )}
          title={disabled ? tag : `${tag}（可拖拽排序）`}
        >
          {!disabled && (
            /* 共享拖拽手柄（§3 唯一实现）：draggable 在 chip 上，手柄负责键盘抓取与
               作为拖拽发起点（共享 hook 的 onDragStart 以 data-drag-handle 判定） */
            <DragHandle {...drag.handleProps(i, `拖拽排序标签：${tag}`)} />
          )}
          <span className="truncate">{tag}</span>
          {!disabled && (
            <button
              type="button"
              aria-label={`删除标签 ${tag}`}
              className="inline-flex size-6 items-center justify-center rounded text-muted transition-colors duration-150 hover:bg-surface-alt hover:text-danger"
              onClick={(e) => { e.stopPropagation(); removeAt(i) }}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          )}
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={value.length ? '' : placeholder}
        className="h-6 min-w-[6rem] flex-1 border-0 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => { if (draft.trim() !== '') commitDraft(draft) }}
      />
    </div>
  )
}

/** 数组 ↔ 字符串（英文逗号分隔，与前台解析一致） */
export function tagsToString(tags) {
  return (Array.isArray(tags) ? tags : []).filter((t) => String(t).trim() !== '').join(',')
}

export function stringToTags(str) {
  return String(str ?? '').split(/[,，、]/).map((x) => x.trim()).filter((x) => x !== '')
}
