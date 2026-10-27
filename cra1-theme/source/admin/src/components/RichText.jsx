import { useEffect, useId, useRef, useState } from 'react'
import { Bold, Italic, Underline, List, ListOrdered, Link2, Unlink, Undo2, Redo2, RemoveFormatting, Palette } from 'lucide-react'
import { Button } from '@ui/button'
import { Input, Textarea } from '@ui/input'
import './RichText.css'

const COLORS = ['#35383c', '#61656b', '#87672f', '#2563eb', '#15803d', '#a16207', '#dc2626']
export default function RichText({ value = '', onChange, label = '内容', enhanced = false }) {
  const ref = useRef(), range = useRef(), id = useId()
  const [link, setLink] = useState(''), [linkOpen, setLinkOpen] = useState(false), [linkError, setLinkError] = useState(''), [colorsOpen, setColorsOpen] = useState(false)
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value && document.activeElement !== ref.current) ref.current.innerHTML = value }, [value])
  const remember = () => { const selection = window.getSelection(); if (selection?.rangeCount && ref.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) range.current = selection.getRangeAt(0).cloneRange() }
  const restore = () => {
    ref.current.focus()
    if (range.current && ref.current.contains(range.current.commonAncestorContainer)) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range.current) }
  }
  const changed = () => { onChange(ref.current.innerHTML); remember() }
  const command = (name, argument) => { restore(); document.execCommand(name, false, argument); changed() }
  const hold = event => { remember(); event.preventDefault() }
  const applyLink = event => {
    event.preventDefault()
    const url = link.trim()
    if (!/^(?:https?:\/\/[^\s<>"']+|\/(?!\/)[^\s<>"']*|#[^\s<>"']*|mailto:[^\s<>"']+|tel:\+?[\d() -]+)$/i.test(url)) { setLinkError('请填写有效的网址、站内路径、电话或邮箱链接'); return }
    restore()
    if (window.getSelection().isCollapsed) { const anchor = document.createElement('a'); anchor.href = url; anchor.textContent = url; document.execCommand('insertHTML', false, anchor.outerHTML) }
    else document.execCommand('createLink', false, url)
    changed(); setLinkOpen(false); setLinkError('')
  }
  const openLink = () => { setLinkOpen(open => !open); setColorsOpen(false); setLinkError('') }
  const tool = (name, title, Icon) => <button key={name} type="button" className="rich-tool" aria-label={title} title={title} onMouseDown={hold} onClick={() => command(name)}><Icon size={16} /></button>
  return <div className={`rich-editor${enhanced ? ' rich-editor--enhanced' : ''}`}>
    {enhanced && <div className="rich-editor__heading"><label htmlFor={id}>通知内容</label><span>可使用格式、列表和链接</span></div>}
    <div className="rich-toolbar" role="toolbar" aria-label={`${label}格式工具`}>
      {enhanced ? <>
        <div className="rich-tools">{tool('undo', '撤销编辑', Undo2)}{tool('redo', '重做编辑', Redo2)}</div>
        <div className="rich-tools">{tool('bold', '加粗', Bold)}{tool('italic', '斜体', Italic)}{tool('underline', '下划线', Underline)}</div>
        <div className="rich-tools">{tool('insertUnorderedList', '项目列表', List)}{tool('insertOrderedList', '数字列表', ListOrdered)}</div>
        <div className="rich-tools"><button type="button" className="rich-tool" aria-label="文字颜色" aria-expanded={colorsOpen} onMouseDown={hold} onClick={() => { setColorsOpen(!colorsOpen); setLinkOpen(false) }}><Palette size={16} /></button><button type="button" className="rich-tool" aria-label="添加链接" aria-expanded={linkOpen} onMouseDown={hold} onClick={openLink}><Link2 size={16} /></button>{tool('unlink', '移除链接', Unlink)}{tool('removeFormat', '清除格式', RemoveFormatting)}</div>
      </> : <>
        {[['bold', '加粗'], ['insertUnorderedList', '项目列表'], ['insertOrderedList', '数字列表']].map(([name, text]) => <Button key={name} size="sm" variant="ghost" onMouseDown={hold} onClick={() => command(name)}>{text}</Button>)}
        <label className="rich-color">文字颜色<input type="color" aria-label="文字颜色" onMouseDown={remember} onChange={event => command('foreColor', event.target.value)} /></label>
        <Button size="sm" variant="ghost" onMouseDown={hold} onClick={openLink}>添加链接</Button>
      </>}
    </div>
    {colorsOpen && <div className="rich-palette" role="group" aria-label="选择文字颜色">{COLORS.map(color => <button key={color} type="button" aria-label={`使用颜色 ${color}`} style={{ '--rich-color': color }} onMouseDown={hold} onClick={() => { command('foreColor', color); setColorsOpen(false) }} />)}<label>自定义<input type="color" aria-label="自定义文字颜色" onMouseDown={remember} onChange={event => command('foreColor', event.target.value)} /></label></div>}
    {linkOpen && <form className="rich-link" onSubmit={applyLink}><div className="rich-link__input"><Input aria-label="富文本链接地址" value={link} onChange={event => { setLink(event.target.value); setLinkError('') }} placeholder="网址、站内路径、电话或邮箱" autoFocus />{linkError && <p role="alert">{linkError}</p>}</div><Button type="submit" size="sm">应用链接</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setLinkOpen(false); restore() }}>取消</Button></form>}
    <div ref={ref} id={id} className="rich-content" contentEditable role="textbox" aria-label={label} aria-multiline="true" data-placeholder="在这里填写通知正文…" suppressContentEditableWarning onInput={changed} onMouseUp={remember} onKeyUp={remember} onBlur={remember} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); changed() }} />
    <details className="advanced-details"><summary>高级：编辑原始 HTML</summary><Textarea aria-label={`${label}原始 HTML`} rows={7} value={value} onChange={event => onChange(event.target.value)} /></details>
  </div>
}
