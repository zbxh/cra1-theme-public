import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@ui/button'
import { Checkbox, Input, Textarea } from '@ui/input'
import { api } from '../../lib/api'
import IconPicker from '../../ui/IconPicker'
import MediaPicker from '../MediaPicker'
import Toolbar from './Toolbar'
import VisualContent from './VisualContent'
import { safeLink } from './source'
import '../../../../../../public/cra1-shared/src/content.css'
import '../../../../../../public/cra1-shared/src/content.js'
import './editor.css'

const centeredImage = 'cra1-content-image-center'

function escapeMarkup(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function useContentPreview(value, cart) {
  const [state, setState] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const request = JSON.stringify(cart ?? null)
  useEffect(() => {
    let active = true
    let timer
    const controller = new AbortController()
    async function run() {
      try {
        const response = await api('api.content.preview', { html: value, cart: JSON.parse(request) }, { signal: controller.signal })
        if (!active) return
        if (response.status !== 200) throw new Error(response.msg || '预览读取失败')
        setState({ value, request, data: response.data })
        if (response.data.next_change) {
          const delay = (response.data.next_change - response.data.server_time) * 1000
          timer = setTimeout(run, Math.min(2147483647, Math.max(500, delay)))
        }
      } catch (error) {
        if (active) setState({ value, request, error: error.message || '预览读取失败' })
      }
    }
    timer = setTimeout(run, value ? 300 : 0)
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [value, request, attempt])
  return { state: state?.value === value && state.request === request ? state : null, retry: () => setAttempt(previous => previous + 1) }
}

function ContentPreview({ state }) {
  if (state?.error) return <p className="text-sm text-danger" role="alert">{state.error}</p>
  if (!state) return <p className="text-sm text-muted" role="status">正在更新预览…</p>
  if (!state.data.html) return <p className="text-sm text-muted">当前没有生效的内容</p>
  const blockNavigation = event => {
    if (event.target.closest('a')) event.preventDefault()
  }
  return <div className="cra1-content-document" onClick={blockNavigation} onAuxClick={blockNavigation}
    dangerouslySetInnerHTML={{ __html: state.data.html }} />
}

function ImageSettings({ image, onApply, onReplace }) {
  const [width, setWidth] = useState(String(image.width || ''))
  const [alt, setAlt] = useState(image.alt || '')
  const [center, setCenter] = useState(image.class === centeredImage)

  function apply() {
    onApply({ width: width.trim(), alt, center })
  }

  return <div className="cra1-editor__properties" role="group" aria-label="图片设置">
    <Input className="cra1-editor__image-width" aria-label="图片宽度（像素）" type="number" min="1" max="9999" placeholder="宽度（像素）"
      value={width} onChange={event => setWidth(event.target.value)} />
    <Input aria-label="图片替代文字" placeholder="图片替代文字" maxLength={400} value={alt} onChange={event => setAlt(event.target.value)} />
    <label><Checkbox checked={center} onChange={event => setCenter(event.target.checked)} />居中</label>
    <Button type="button" size="sm" variant="outline" onClick={event => onReplace(event.currentTarget)}>替换图片</Button>
    <Button type="button" size="sm" onClick={apply}>应用图片设置</Button>
  </div>
}

export default function Editor({ value = '', onChange, label = '内容', hint, preview = true,
  previewLayout = 'beside', previewControls, editEnabled = true, cartPreview, describeSource }) {
  const raw = useRef(null), visual = useRef(null), cursor = useRef(null)
  const insertTrigger = useRef(null), mediaPicker = useRef(null), iconPicker = useRef(null)
  const mediaTarget = useRef(null), mediaReturnFocus = useRef(null)
  const seen = useRef(value)
  const [view, setView] = useState('visual')
  const [seed, setSeed] = useState(null)
  const [clock, setClock] = useState({ time: '', zone: '' })
  const [context, setContext] = useState(null)
  const [link, setLink] = useState(null)
  const [message, setMessage] = useState('')
  const { state, retry } = useContentPreview(value, cartPreview)
  const sourceMode = view === 'source'
  const canEdit = sourceMode || seed !== null
  const stacked = previewLayout === 'below'

  useEffect(() => {
    if (seen.current === value) return
    seen.current = value
    setMessage('')
    setLink(null)
    if (!sourceMode) {
      setSeed(null)
      setContext(null)
    }
  }, [value, sourceMode])
  useEffect(() => {
    if (state?.data) setClock({ time: state.data.site_time, zone: state.data.timezone })
    if (!sourceMode && seed === null && state?.data) setSeed({ html: state.data.source })
  }, [state, sourceMode, seed])
  useEffect(() => {
    if (!sourceMode || !cursor.current?.pending || !raw.current) return
    const { start, end } = cursor.current
    cursor.current = { start, end }
    raw.current.focus()
    raw.current.setSelectionRange(start, end)
  }, [value, sourceMode])

  function change(html) {
    seen.current = html
    onChange(html)
  }

  function remember() {
    if (raw.current) cursor.current = { start: raw.current.selectionStart, end: raw.current.selectionEnd }
  }

  function sourceRange() {
    const start = Math.min(value.length, cursor.current?.start ?? value.length)
    const end = Math.min(value.length, cursor.current?.end ?? start)
    return { start, end }
  }

  function insertSource(create) {
    const { start, end } = sourceRange()
    const snippet = create(value.slice(start, end))
    if (!snippet) return
    const next = value.slice(0, start) + snippet + value.slice(end)
    cursor.current = { start: start + snippet.length, end: start + snippet.length, pending: true }
    change(next)
  }

  function switchView(next) {
    if (next === view) return
    if (next === 'visual') {
      if (!state?.data) {
        setMessage('请等预览完成，或修正源码中的提示后再切换')
        return
      }
      setSeed({ html: state.data.source })
    } else {
      cursor.current = null
      setSeed(null)
    }
    setContext(null)
    setLink(null)
    setMessage('')
    setView(next)
  }

  function openImagePicker(replace = false, opener = insertTrigger.current) {
    mediaTarget.current = replace ? visual.current?.selectedImage() : null
    mediaReturnFocus.current = opener
    if (replace && !mediaTarget.current) return
    mediaPicker.current?.()
  }

  function addComponent(type, option) {
    setMessage('')
    if (type === 'image') { openImagePicker(); return }
    if (type === 'icon') { iconPicker.current?.(); return }
    if (!sourceMode) {
      if (type === 'rule') { visual.current?.format(type); return }
      const attrs = type === 'timed' ? { start: clock.time } : type === 'callout' ? { tone: option } : undefined
      if (!visual.current?.component(type, attrs)) {
        setMessage(type === 'more' ? '每份内容可放置一个“查看更多”' : '请选择可以插入组件的位置')
      }
      return
    }
    if (type === 'more' && /<\s*cra1-more\b/i.test(value)) {
      setMessage('每份内容可放置一个“查看更多”')
      return
    }
    insertSource(selection => {
      if (type === 'rule') return '\n<hr>\n'
      if (type === 'blockquote') return '\n<blockquote>' + (selection || '<p>引用文字</p>') + '</blockquote>\n'
      if (type === 'table') return '\n<table>\n  <tbody>\n    <tr><th>标题 1</th><th>标题 2</th><th>标题 3</th></tr>\n    <tr><td></td><td></td><td></td></tr>\n  </tbody>\n</table>\n'
      if (type === 'more') return '\n<cra1-more></cra1-more>\n'
      if (type === 'callout') return '\n<cra1-callout tone="' + option + '">' + (selection || '<p>填写提示内容</p>') + '</cra1-callout>\n'
      if (type === 'timed') return '\n<cra1-timed start="' + clock.time + '">' + (selection || '<p>在这里填写限时内容</p>') + '</cra1-timed>\n'
      return '\n<cra1-tabs>\n  <cra1-tab label="标签 1">' + (selection || '<p>第一项内容</p>')
        + '</cra1-tab>\n  <cra1-tab label="标签 2"><p>第二项内容</p></cra1-tab>\n</cra1-tabs>\n'
    })
  }

  function addImage(src) {
    if (!safeLink(src, true)) return false
    setMessage('')
    const target = mediaTarget.current
    if (sourceMode) insertSource(() => '<img src="' + escapeMarkup(src) + '" alt="" loading="lazy">')
    else if (target) {
      if (!visual.current?.changeImage(target, { src, height: null })) setMessage('图片已变化，请重新选中后替换')
    } else if (!visual.current?.image({ src, alt: '', loading: 'lazy' })) setMessage('请选择可以插入图片的位置')
    mediaTarget.current = null
    return true
  }

  function applyImage({ width, alt, center }) {
    if (width && !/^[1-9]\d{0,3}$/.test(width)) {
      setMessage('图片宽度请输入 1 至 9999 的整数，留空使用原始宽度')
      return
    }
    const target = visual.current?.selectedImage()
    const size = width || null
    const attrs = { width: size, alt: alt.trim(), class: center ? centeredImage : null }
    if (target && String(target.attrs.width || '') !== width) attrs.height = null
    const applied = visual.current?.changeImage(target, attrs)
    setMessage(applied ? '' : '请重新选中要编辑的图片')
  }

  function addIcon(name) {
    if (!/^[a-z0-9][a-z0-9:_-]{0,159}$/i.test(name)) return
    if (sourceMode) insertSource(() => '<cra1-icon name="' + escapeMarkup(name) + '"></cra1-icon>')
    else if (!visual.current?.component('icon', { name })) setMessage('请选择可以插入图标的位置')
  }

  function openLink(target) {
    const { start, end } = sourceRange()
    const preserveContents = sourceMode ? /<\s*[a-z!]/i.test(value.slice(start, end)) : !!target?.preserveContents
    setLink({ target, preserveContents, href: target?.href || '', text: target?.text || '', button: !!target?.button, newTab: !!target?.newTab })
    setMessage('')
  }

  function applyLink() {
    const href = link.href.trim()
    if (!safeLink(href)) { setMessage('请填写有效的链接地址'); return }
    const label = link.preserveContents ? '' : link.target?.text === link.text ? link.text : link.text.trim()
    const attrs = { href, label, class: link.button ? 'cra1-content-link' : null,
      target: link.newTab ? '_blank' : null, rel: 'noopener noreferrer' }
    if (sourceMode) {
      insertSource(selection => {
        const styling = attrs.class ? ' class="' + attrs.class + '"' : ''
        const target = attrs.target ? ' target="_blank" rel="noopener noreferrer"' : ''
        return '<a href="' + escapeMarkup(href) + '"' + styling + target + '>'
          + (attrs.label ? escapeMarkup(attrs.label) : selection || escapeMarkup(href)) + '</a>'
      })
    } else if (!visual.current?.link(link.target, attrs)) {
      setMessage('所选内容已变化，请重新选中要编辑的链接')
      return
    }
    setMessage('')
    setLink(null)
  }

  function removeLink() {
    if (!visual.current?.link(link.target, null)) {
      setMessage('所选内容已变化，请重新选中要编辑的链接')
      return
    }
    setMessage('')
    setLink(null)
  }

  const previewPanel = preview && <div className="cra1-editor__preview">
    {(!stacked || state?.error) && <div className="cra1-editor__preview-title">
      {!stacked && <h4>前台预览</h4>}
      {state?.error && <Button type="button" size="sm" variant="ghost" onClick={retry}>重试</Button>}
    </div>}
    {previewControls}
    {state?.data?.effective && describeSource && <p className="cra1-editor__hint" role="status">{describeSource(state.data.effective)}</p>}
    <ContentPreview state={state} />
    {clock.zone && <small className="cra1-editor__clock">站点时区 {clock.zone}</small>}
  </div>
  return <section className="cra1-editor" aria-label={label + '编辑器'}>
    {editEnabled && <><div className="cra1-editor__heading">
      <h3>{label}</h3>
      <div className="cra1-editor__views" role="group" aria-label="编辑模式">
        <Button type="button" size="sm" variant={sourceMode ? 'ghost' : 'outline'} aria-pressed={!sourceMode} onClick={() => switchView('visual')}>可视编辑</Button>
        <Button type="button" size="sm" variant={sourceMode ? 'outline' : 'ghost'} aria-pressed={sourceMode} onClick={() => switchView('source')}>HTML 源码</Button>
      </div>
    </div>
    {hint && <p className="cra1-editor__hint">{hint}</p>}</>}
    <div className={'cra1-editor__layout' + (preview && !stacked ? ' has-preview' : '')}>
      {editEnabled ? <div className="cra1-editor__entry">
        {canEdit && <>
          <Toolbar label={label} sourceMode={sourceMode} context={context} format={(type, option) => visual.current?.format(type, option)}
            onInsert={addComponent} onLink={() => openLink(visual.current?.editLink())}
            onTable={type => visual.current?.table(type)} remember={remember} clock={clock.time} insertTrigger={insertTrigger} />
          <MediaPicker compact label="图片" openDialogRef={mediaPicker} returnFocus={mediaReturnFocus} onChange={addImage} />
          <IconPicker libraryOnly styledSelect label="插入图标" tile={false} openDialogRef={iconPicker} returnFocus={insertTrigger} onChange={addIcon} />
        </>}
        {link && <div className="cra1-editor__properties" role="group" aria-label="链接设置">
          <Input aria-label="链接地址" placeholder="链接地址" value={link.href} onChange={event => setLink({ ...link, href: event.target.value })} />
          {!link.preserveContents && <Input aria-label="链接文字" placeholder="链接文字（可选）" value={link.text}
            onChange={event => setLink({ ...link, text: event.target.value })} />}
          <label><Checkbox checked={link.button} onChange={event => setLink({ ...link, button: event.target.checked })} />按钮样式</label>
          <label><Checkbox checked={link.newTab} onChange={event => setLink({ ...link, newTab: event.target.checked })} />新标签页</label>
          <Button type="button" size="sm" onClick={applyLink}>应用链接</Button>
          {link.target?.href && <Button type="button" size="sm" variant="ghost" onClick={removeLink}>移除链接</Button>}
          <Button type="button" size="sm" variant="ghost" onClick={() => { setLink(null); setMessage('') }}>取消</Button>
          {link.preserveContents && <p className="cra1-editor__link-hint">保留链接内的内容，可直接在正文里修改。</p>}
        </div>}
        {!sourceMode && !link && context?.image && <ImageSettings key={JSON.stringify(context.image)} image={context.image}
          onApply={applyImage} onReplace={opener => openImagePicker(true, opener)} />}
        {sourceMode
          ? <Textarea ref={raw} className="cra1-editor__source" aria-label={label + ' HTML 源码'} rows={10} value={value}
              onSelect={remember} onBlur={remember} onChange={event => change(event.target.value)} spellCheck={false} />
          : seed
            ? <VisualContent ref={visual} source={seed.html} label={label} clock={clock} onChange={change}
                onLink={openLink} onContext={setContext} onMessage={setMessage} />
            : <p className="cra1-editor__status" role="status">{state?.error ? '请在 HTML 源码中调整内容' : '正在读取内容…'}</p>}
        {message && <p className="cra1-editor__status" role="status">{message}</p>}
        {!preview && state?.error && <ContentPreview state={state} />}
      </div> : <p className="cra1-editor__hint">命中此规则时隐藏说明。切换为自定义可继续编辑已填写的内容。</p>}
      {preview && (stacked ? <details className="cra1-editor__foldout" open>
        <summary><ChevronRight size={16} aria-hidden="true" />前台预览</summary>
        {previewPanel}
      </details> : previewPanel)}
    </div>
  </section>
}
