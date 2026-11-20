import { useCallback, useLayoutEffect, useState } from 'react'

/** Keep an open portal inside the visible viewport, including mobile keyboards.
 * Listeners exist only while its actual content node is mounted. */
export function useViewportFrame() {
  const [node, setNode] = useState(null)
  const [frame, setFrame] = useState({})
  const ref = useCallback(element => setNode(element), [])
  useLayoutEffect(() => {
    if (!node) return
    const viewport = window.visualViewport
    const update = () => setFrame({
      '--cra1-admin-visible-height': `${viewport?.height || window.innerHeight}px`,
      '--cra1-admin-visible-width': `${viewport?.width || window.innerWidth}px`,
      '--cra1-admin-visible-top': `${viewport?.offsetTop || 0}px`,
      '--cra1-admin-visible-left': `${viewport?.offsetLeft || 0}px`,
    })
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [node])
  useLayoutEffect(() => {
    const active = document.activeElement
    if (!node || !node.contains(active) || !active?.matches('input,textarea,[contenteditable=true],[role=combobox]')) return
    // Keyboard resizing does not necessarily trigger a second native focus
    // scroll. Reveal the field inside this portal's own scroll containers,
    // without moving the document or unrelated fixed content behind it.
    for (let parent = active.parentElement; parent; parent = parent.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) {
        const field = active.getBoundingClientRect(), bounds = parent.getBoundingClientRect()
        if (field.bottom > bounds.bottom - 12) parent.scrollTop += field.bottom - bounds.bottom + 12
        else if (field.top < bounds.top + 12) parent.scrollTop -= bounds.top + 12 - field.top
      }
      if (parent === node) break
    }
  }, [node, frame])
  return { ref, frame }
}
