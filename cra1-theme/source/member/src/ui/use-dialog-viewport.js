import { useLayoutEffect, useRef, useState } from 'react'

/** Keep portals inside the visible viewport when a mobile keyboard opens.
 * Watch only while open; do not resize or scroll the underlying page. */
export function useDialogViewport(open, contentRef) {
  const [style, setStyle] = useState(undefined)
  const reveal = useRef(null)
  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined' || !window.visualViewport) return
    const viewport = window.visualViewport
    let frame = 0
    let focusFrame = 0
    const revealFocused = () => {
      const content = contentRef.current, active = document.activeElement
      if (!content || !active || !content.contains(active) || !active.matches('input,textarea,select,[contenteditable="true"]')) return
      let parent = active.parentElement
      // Scroll only this portal and its own nested scroll regions. Calling
      // scrollIntoView would also move the document behind the modal.
      while (parent && content.contains(parent)) {
        const scrollable = parent === content || /auto|scroll/.test(getComputedStyle(parent).overflowY)
        if (scrollable && parent.scrollHeight > parent.clientHeight) {
          const box = active.getBoundingClientRect()
          const bounds = parent.getBoundingClientRect()
          const top = Math.max(bounds.top, viewport.offsetTop) + 12
          const bottom = Math.min(bounds.bottom, viewport.offsetTop + viewport.height) - 12
          if (box.bottom > bottom) parent.scrollTop += box.bottom - bottom
          else if (box.top < top) parent.scrollTop -= top - box.top
        }
        if (parent === content) break
        parent = parent.parentElement
      }
    }
    reveal.current = revealFocused
    const update = () => {
      const next = {
        '--cui-visible-height': `${viewport.height}px`,
        '--cui-visible-top': `${viewport.offsetTop}px`,
        '--cui-visible-middle': `${viewport.offsetTop + viewport.height / 2}px`,
      }
      setStyle(previous => previous?.['--cui-visible-height'] === next['--cui-visible-height'] && previous?.['--cui-visible-top'] === next['--cui-visible-top'] ? previous : next)
      cancelAnimationFrame(focusFrame)
      focusFrame = requestAnimationFrame(revealFocused)
    }
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    const focus = () => { cancelAnimationFrame(focusFrame); focusFrame = requestAnimationFrame(revealFocused) }
    update()
    viewport.addEventListener('resize', measure)
    viewport.addEventListener('scroll', measure)
    document.addEventListener('focusin', focus)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(focusFrame)
      viewport.removeEventListener('resize', measure)
      viewport.removeEventListener('scroll', measure)
      document.removeEventListener('focusin', focus)
      reveal.current = null
    }
  }, [open, contentRef])
  // Run after React applies the changed viewport variables. A single rAF from
  // the resize listener can run before that commit in concurrent rendering.
  useLayoutEffect(() => { if (open) reveal.current?.() }, [open, style])
  return style
}
