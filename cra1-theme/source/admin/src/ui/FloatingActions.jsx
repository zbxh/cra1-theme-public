import { useEffect, useRef, useState } from 'react'
import { Save, RotateCcw, Undo2 } from 'lucide-react'
import { Button } from '@ui/button'
import { Badge } from '@ui/feedback'
import { cn } from '@ui/utils'

/**
 * 悬浮操作条（后台各配置页共用）
 *
 * 问题：配置页较长，保存/还原/恢复默认三个按钮在页头；往下滚动后按钮看不见，
 * 用户改完字段要滚回顶部才能保存。
 *
 * 做法：在视口底部放一条 fixed 操作条，承载同样的三个操作；
 * 仅当页头那组按钮**滚出视野**时出现——顶部可见时不重复显示，避免两个入口并存。
 *
 * 两个实现要点（都踩过）：
 *
 * 1. 显示时机用 IntersectionObserver 观察页头操作区，而不是监听 scroll：
 *    内容滚动容器可能是 window 也可能是某个 overflow 容器，IO 对两者都成立，
 *    且无需节流计算，不引起滚动掉帧。
 *
 * 2. 必须用 fixed 而不是 sticky：sticky 只在**包含块内**粘住，
 *    本组件挂在页面内容中间，滚动时会被后续内容推走
 *    （实测滚动中距视口底 600 → 1208 → 1817 → 2425px 递增，完全没贴底）。
 *    改 fixed 后需要知道侧栏宽度才能与内容列左对齐，故量取 <aside> 实际宽度。
 *
 * 3. 浮条是 fixed，会盖住页面主体内容的最底部模块；滚动到底时用户看不到最后一段。
 *    做法：浮条把自身**高度**发布为 CSS 变量 `--floating-actions-h`（挂在 documentElement），
 *    由外壳的 <main> 据此预留底部空间（padding-bottom），内容最底部的模块被向上顶出，
 *    不会被挡住；浮条隐藏时高度归零，不留多余空白。
 *    沿用外壳既有的 `--content-offset` 同一套「发布变量—消费变量」范式。
 */
export function FloatingActions({
  anchorRef,
  saving = false,
  dirtyCount = 0,
  dirtyLabel,
  onSave,
  onRevert,
  revertLabel = '还原',
  revertDisabled,
  onReset,
  resetLabel = '恢复默认',
  saveLabel = '保存',
  className,
}) {
  const [visible, setVisible] = useState(false)
  const [asideW, setAsideW] = useState(0)
  const barRef = useRef(null)

  /* 显示时机：页头操作区滚出视野时显示悬浮条 */
  useEffect(() => {
    const el = anchorRef?.current || document.querySelector('[data-page-actions]')
    if (!el || typeof IntersectionObserver === 'undefined') {
      // 无法观察时退化为始终显示（宁可多一个入口，也不要没入口）
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => setVisible(!e.isIntersecting))
      },
      { rootMargin: '0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [anchorRef])

  /* 把浮条高度发布给外壳：<main> 据此预留底部空间，避免遮住内容最底部的模块。
     浮条不可见（未滚到位置）时发布 0，主体不留多余空白。
     用 ResizeObserver 跟随浮条自身高度变化（按钮换行 / 文字变长时自动更新）。 */
  useEffect(() => {
    const root = document.documentElement
    const el = barRef.current
    if (!el) return
    const publish = () => {
      const h = visible ? Math.round(el.getBoundingClientRect().height) : 0
      root.style.setProperty('--floating-actions-h', h + 'px')
    }
    publish()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null
    ro?.observe(el)
    window.addEventListener('resize', publish)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', publish)
      root.style.removeProperty('--floating-actions-h')
    }
  }, [visible])

  /* 侧栏宽度：桌面端侧栏固定占位，量它的实际宽度使悬浮条与内容列左对齐；
     窄屏侧栏是抽屉（不占位），固定用 16px。 */
  useEffect(() => {
    const aside = document.querySelector('aside[aria-label="后台导航"]')
    if (!aside) return
    const read = () => {
      setAsideW(window.innerWidth >= 1024 ? Math.round(aside.getBoundingClientRect().width) : 0)
    }
    read()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null
    ro?.observe(aside)
    window.addEventListener('resize', read)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', read)
    }
  }, [])

  return (
    <div
      ref={barRef}
      data-floating-actions
      className={cn(
        'fixed bottom-4 right-4 z-30 transition-opacity duration-200 lg:right-6',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
      /* 左侧与内容列对齐：移动端 16px；桌面端 = 侧栏宽度 + 24px（与 main 的 p-6 一致） */
      style={{ left: asideW > 0 ? asideW + 24 : 16 }}
      aria-hidden={!visible}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/95 px-3 py-2 shadow-card backdrop-blur">
        {dirtyCount > 0 && <Badge tone="warning">{dirtyLabel || `有 ${dirtyCount} 处未保存`}</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {onRevert && (
            <Button variant="outline" size="sm" disabled={saving || !!revertDisabled} onClick={onRevert}>
              <Undo2 className="size-3.5" />{revertLabel}
            </Button>
          )}
          {onReset && (
            <Button variant="outline" size="sm" disabled={saving} onClick={onReset}>
              <RotateCcw className="size-3.5" />{resetLabel}
            </Button>
          )}
          <Button size="sm" disabled={saving} onClick={onSave}>
            <Save className="size-3.5" />{saving ? '保存中…' : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
