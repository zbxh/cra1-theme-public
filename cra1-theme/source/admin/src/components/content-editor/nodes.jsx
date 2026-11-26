import { createContext, useContext, useEffect, useState } from 'react'
import { Extension, Node } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { Button } from '@ui/button'
import { Checkbox, Input } from '@ui/input'
import { resolveIcon } from '../../lib/icon-client'

export const EditingClock = createContext({ time: '', zone: '' })
export const calloutLabels = { info: '信息', notice: '提醒', warning: '警告' }

function TimedView({ node, updateAttributes }) {
  const { time, zone } = useContext(EditingClock)
  const { start, end, showEnd } = node.attrs
  const status = !start && !end || (start && end && start >= end) ? '请设置有效时间'
    : start && start > time ? '待生效' : end && end <= time ? '已结束' : '生效中'
  function changeEnd(event) {
    const end = timestamp(event.target.value)
    updateAttributes({ end, showEnd: !!end && showEnd })
  }
  return <NodeViewWrapper className="cra1-editor-component">
    <div className="cra1-editor-component__head" contentEditable={false}>
      <strong>限时内容</strong><span className="cra1-editor-component__state">{status}</span>
      <span className="cra1-editor-component__zone">{zone}</span>
      <label>开始<Input aria-label="限时内容开始时间" type="datetime-local" step="1" value={start || ''} onChange={event => updateAttributes({ start: timestamp(event.target.value) })} /></label>
      <label>到期<Input aria-label="限时内容到期时间" type="datetime-local" step="1" value={end || ''} onChange={changeEnd} /></label>
      <label className="cra1-editor-component__toggle"><Checkbox checked={showEnd && !!end} disabled={!end}
        onChange={event => updateAttributes({ showEnd: event.target.checked })} />在前台显示结束时间</label>
    </div>
    <NodeViewContent className="cra1-editor-component__body" />
  </NodeViewWrapper>
}

function timestamp(value) {
  return value.length === 16 ? value + ':00' : value
}

function TabsView({ editor, getPos, node }) {
  function add() {
    editor.commands.insertContentAt(getPos() + node.nodeSize - 1, tab('标签 ' + (node.childCount + 1)))
  }
  return <NodeViewWrapper className="cra1-editor-component">
    <div className="cra1-editor-component__head" contentEditable={false}>
      <strong>标签页</strong><Button type="button" size="sm" variant="outline" onClick={add}>新增标签</Button>
    </div>
    <NodeViewContent className="cra1-editor-component__body" />
  </NodeViewWrapper>
}

function TabView({ editor, getPos, node, updateAttributes }) {
  function siblings() {
    const position = editor.state.doc.resolve(getPos())
    return [position, Array.from({ length: position.parent.childCount }, (_, index) => position.parent.child(index))]
  }
  function move(direction) {
    const [position, rows] = siblings()
    const from = position.index(), to = from + direction
    if (to < 0 || to >= rows.length) return
    ;[rows[from], rows[to]] = [rows[to], rows[from]]
    editor.view.dispatch(editor.state.tr.replaceWith(position.start(), position.end(), rows))
  }
  function remove() {
    const [position, rows] = siblings()
    if (rows.length > 1) editor.commands.deleteRange({ from: position.pos, to: position.pos + node.nodeSize })
  }
  return <NodeViewWrapper className="cra1-editor-tab">
    <div className="cra1-editor-component__head" contentEditable={false}>
      <Input aria-label="标签标题" value={node.attrs.label} maxLength={80} onChange={event => updateAttributes({ label: event.target.value })} />
      <Button type="button" size="sm" variant="ghost" onClick={() => move(-1)} aria-label="向前移动标签">上移</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => move(1)} aria-label="向后移动标签">下移</Button>
      <Button type="button" size="sm" variant="ghost" onClick={remove} aria-label="删除标签">删除</Button>
    </div>
    <NodeViewContent className="cra1-editor-component__body" />
  </NodeViewWrapper>
}

function IconView({ editor, getPos, node }) {
  const [icon, setIcon] = useState(null)
  const id = node.attrs.name
  useEffect(() => {
    const controller = new AbortController()
    setIcon(null)
    resolveIcon(id, 'website', '', controller.signal)
      .then(value => { if (!controller.signal.aborted) setIcon(value) })
      .catch(() => { if (!controller.signal.aborted) setIcon({ available: false }) })
    return () => controller.abort()
  }, [id])
  const available = icon?.available && !icon.external
  return <NodeViewWrapper as="span" className="cra1-editor-icon" contentEditable={false}
    title={available ? icon.label : '图标不可用，可选中后重新插入图标'}
    onMouseDown={event => { event.preventDefault(); editor.commands.setNodeSelection(getPos()) }}>
    {available && icon.svg ? <span dangerouslySetInnerHTML={{ __html: icon.svg }} />
      : available && icon.url ? <img src={icon.url} alt={icon.label || ''} />
      : <span className="cra1-editor-icon__missing">{icon ? '图标不可用' : '图标'}</span>}
  </NodeViewWrapper>
}

const timed = Node.create({
  name: 'cra1Timed', group: 'block', content: 'block+', defining: true,
  addAttributes: () => ({
    start: { default: '' },
    end: { default: '' },
    showEnd: { default: false, parseHTML: element => element.getAttribute('show-end') === '1' },
  }),
  parseHTML: () => [{ tag: 'cra1-timed' }],
  renderHTML: ({ node }) => {
    const attributes = {}
    if (node.attrs.start) attributes.start = node.attrs.start
    if (node.attrs.end) attributes.end = node.attrs.end
    if (node.attrs.end && node.attrs.showEnd) attributes['show-end'] = '1'
    return ['cra1-timed', attributes, 0]
  },
  addNodeView: () => ReactNodeViewRenderer(TimedView),
})

const more = Node.create({
  name: 'cra1More', group: 'block', atom: true,
  parseHTML: () => [{ tag: 'cra1-more' }],
  renderHTML: () => ['cra1-more'],
  addNodeView: () => ReactNodeViewRenderer(() => <NodeViewWrapper className="cra1-editor-more" contentEditable={false}>查看更多 · 以下内容默认收起</NodeViewWrapper>),
})

const tabs = Node.create({
  name: 'cra1Tabs', group: 'block', content: 'cra1Tab+', defining: true,
  parseHTML: () => [{ tag: 'cra1-tabs' }],
  renderHTML: () => ['cra1-tabs', 0],
  addNodeView: () => ReactNodeViewRenderer(TabsView),
})

const tabNode = Node.create({
  name: 'cra1Tab', content: 'block+', defining: true,
  addAttributes: () => ({ label: { default: '标签' } }),
  parseHTML: () => [{ tag: 'cra1-tab' }],
  renderHTML: ({ HTMLAttributes }) => ['cra1-tab', HTMLAttributes, 0],
  addNodeView: () => ReactNodeViewRenderer(TabView),
})

const icon = Node.create({
  name: 'cra1Icon', inline: true, group: 'inline', atom: true,
  addAttributes: () => ({ name: { default: '' } }),
  parseHTML: () => [{ tag: 'cra1-icon' }],
  renderHTML: ({ HTMLAttributes }) => ['cra1-icon', HTMLAttributes],
  addNodeView: () => ReactNodeViewRenderer(IconView),
})

const callout = Node.create({
  name: 'cra1Callout', group: 'block', content: 'block+', defining: true,
  addAttributes: () => ({
    tone: { default: 'info' },
    title: { default: null, parseHTML: element => element.getAttribute('title') },
  }),
  parseHTML: () => [{ tag: 'cra1-callout' }],
  renderHTML: ({ HTMLAttributes }) => ['cra1-callout', HTMLAttributes, 0],
  addNodeView: () => ReactNodeViewRenderer(({ node, updateAttributes }) =>
    <NodeViewWrapper className="cra1-content-callout" data-tone={node.attrs.tone}>
      <div contentEditable={false}>
        <Input className="cra1-editor-callout-title" aria-label="提示框标题" maxLength={80}
          placeholder={calloutLabels[node.attrs.tone] || calloutLabels.info} value={node.attrs.title || ''}
          onChange={event => updateAttributes({ title: event.target.value || null })} />
      </div>
      <NodeViewContent />
    </NodeViewWrapper>),
})

export function tab(label) {
  return { type: 'cra1Tab', attrs: { label }, content: [{ type: 'paragraph' }] }
}

export const editorComponents = [timed, more, tabs, tabNode, icon, callout]

const paragraphTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

function existingStyle(element) {
  const style = element.getAttribute('style')
  if (!style || !paragraphTags.has(element.localName)) return style
  // Alignment has its own editable attribute. Retain the other legacy declarations.
  return style.split(';').filter(declaration => !/^\s*text-align:\s*(left|center|right|justify)\s*$/i.test(declaration)).join(';').trim() || null
}

export const htmlAppearance = Extension.create({
  name: 'cra1HtmlAppearance',
  addGlobalAttributes() {
    return [
      { types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'horizontalRule',
        'table', 'tableRow', 'tableCell', 'tableHeader'],
        attributes: { style: { default: null, parseHTML: existingStyle } } },
      { types: ['link'], attributes: { class: { default: null }, title: { default: null } } },
      { types: ['image'], attributes: { loading: { default: null }, class: { default: null } } },
    ]
  },
})

export function rawHtmlNode(inline) {
  const tag = inline ? 'cra1-editor-raw-inline' : 'cra1-editor-raw-block'
  return Node.create({
    name: inline ? 'cra1RawInline' : 'cra1RawBlock',
    group: inline ? 'inline' : 'block',
    inline,
    atom: true,
    addAttributes: () => ({ 'data-html': { default: '' } }),
    parseHTML: () => [{ tag }],
    renderHTML: ({ HTMLAttributes }) => [tag, HTMLAttributes],
    addNodeView: () => ReactNodeViewRenderer(() => <NodeViewWrapper as={inline ? 'span' : 'div'}
      className="cra1-editor-raw" contentEditable={false}>已保留 HTML，可在源码中编辑</NodeViewWrapper>),
  })
}
