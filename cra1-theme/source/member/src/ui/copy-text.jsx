import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { copyToClipboard } from '../shared'
import { useToast } from './toast'

/** The complete source is copied even when the visible text is ellipsized. */
export function CopyText({ value, label, className = '' }) {
  const [copied, setCopied] = useState(false), timer = useRef(null), alive = useRef(false)
  const toast = useToast()
  useEffect(() => { alive.current = true; return () => { alive.current = false; window.clearTimeout(timer.current) } }, [])
  if (value == null || value === '') return null
  const copy = async event => {
    event.stopPropagation()
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return
    try {
      if (!await copyToClipboard(String(value))) throw new Error('copy failed')
      if (!alive.current) return
      setCopied(true); toast(`${label}已复制`, 'success'); window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch { if (alive.current) toast('复制失败，请选择文本后手动复制', 'warning') }
  }
  return <button type="button" className={`cra1-copy-text ${className}`} onClick={copy} title={`点击复制${label}：${value}`} aria-label={`复制${label} ${value}`} data-copied={copied || undefined}>
    <span className="cra1-copy-text__value">{value}</span>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
  </button>
}
