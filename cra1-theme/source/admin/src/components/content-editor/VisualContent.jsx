import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { BackgroundColor, Color, TextStyle } from '@tiptap/extension-text-style'
import { EditingClock, editorComponents, htmlAppearance, rawHtmlNode, tab } from './nodes'
import { cleanClipboardHtml } from './clipboard'
import { inlineLinkMarks, linkTarget, updateLink } from './links'
import { editableHtml, savedHtml } from './source'
import { transferredImages, uploadAnchors, uploadAt } from './uploads'

const simpleTable = Table.extend({
  renderHTML: ({ HTMLAttributes }) => ['table', HTMLAttributes, ['tbody', 0]],
})
const extensions = [
  StarterKit.configure({ link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: null, class: null } } }),
  Image.configure({ inline: true }), TextStyle, Color, BackgroundColor, htmlAppearance,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  simpleTable.configure({ View: null }), TableCell, TableHeader, TableRow, uploadAnchors,
  ...editorComponents, rawHtmlNode(false), rawHtmlNode(true),
]

const toggleFormats = {
  bold: 'toggleBold', italic: 'toggleItalic', underline: 'toggleUnderline',
  bulletList: 'toggleBulletList', orderedList: 'toggleOrderedList', blockquote: 'toggleBlockquote',
  undo: 'undo', redo: 'redo', rule: 'setHorizontalRule',
}

const tableCommands = {
  row: 'addRowAfter', column: 'addColumnAfter',
  removeRow: 'deleteRow', removeColumn: 'deleteColumn', removeTable: 'deleteTable',
}

function formatVisual(editor, type, value) {
  if (!editor) return false
  const chain = editor.chain().focus()
  if (type in toggleFormats) return chain[toggleFormats[type]]().run()
  switch (type) {
    case 'heading': return value ? chain.setHeading({ level: value }).run() : chain.setParagraph().run()
    case 'align': return value ? chain.setTextAlign(value).run() : chain.unsetTextAlign().run()
    case 'color': return value ? chain.setColor(value).run() : chain.unsetColor().run()
    case 'highlight': return value ? chain.setBackgroundColor(value).run() : chain.unsetBackgroundColor().run()
    case 'clear': return chain.unsetTextAlign().unsetAllMarks().clearNodes().run()
    default: return false
  }
}

function insertComponent(editor, type, attrs) {
  const { $from, $to } = editor.state.selection
  const chain = editor.chain().focus()
  if (type === 'table') return chain.insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run()
  if (type === 'more') {
    let exists = false
    editor.state.doc.forEach(node => { if (node.type.name === 'cra1More') exists = true })
    if (exists) return false
    if ($from.depth <= 1 && $to.depth <= 1) return chain.insertContent({ type: 'cra1More' }).run()
    return chain.insertContentAt($from.after(1), { type: 'cra1More' }).run()
  }
  if (type === 'timed' || type === 'callout') {
    const name = type === 'timed' ? 'cra1Timed' : 'cra1Callout'
    if (type === 'callout' && editor.isActive(name)) return chain.updateAttributes(name, attrs).run()
    if (!editor.state.selection.empty && editor.can().wrapIn(name, attrs)) return chain.wrapIn(name, attrs).run()
    return chain.insertContent({ type: name, attrs, content: [{ type: 'paragraph' }] }).run()
  }
  if (type === 'tabs' && !editor.isActive('cra1Tabs')) return chain.insertContent({ type: 'cra1Tabs', content: [tab('标签 1'), tab('标签 2')] }).run()
  return false
}

function insertMedia(editor, type, attrs) {
  const { doc, selection } = editor.state
  const marks = inlineLinkMarks(doc, selection.from, selection.to)
  return editor.chain().focus().insertContent({ type, attrs, marks: marks.map(mark => mark.toJSON()) }).run()
}

function focusEmptyComponentBody(view, event) {
  const paragraph = event.target.closest?.('[data-node-view-content] p')
  if (!paragraph || event.shiftKey) return false
  const { state } = view
  const point = state.doc.resolve(view.posAtDOM(paragraph, 0))
  if (!point.parent.isTextblock || point.parent.content.size) return false
  // Clicking a blank line after a component field can leave the native caret at the document start.
  const selection = TextSelection.create(state.doc, point.pos)
  if (!selection.eq(state.selection)) view.dispatch(state.tr.setSelection(selection))
  view.focus()
  return true
}

function selectedImage(editor) {
  const { selection, doc } = editor.state
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') return null
  return { position: selection.from, doc, attrs: selection.node.attrs }
}

function editorContext({ editor }) {
  if (!editor) return null
  const image = selectedImage(editor)
  return {
    active: Object.fromEntries(['bold', 'italic', 'underline', 'bulletList', 'orderedList', 'blockquote', 'link', 'table']
      .map(name => [name, editor.isActive(name)])),
    heading: editor.getAttributes('heading').level || 0,
    align: editor.getAttributes('heading').textAlign || editor.getAttributes('paragraph').textAlign || '',
    color: editor.getAttributes('textStyle').color || '',
    highlight: editor.getAttributes('textStyle').backgroundColor || '',
    undo: editor.can().undo(),
    redo: editor.can().redo(),
    image: image ? { position: image.position, ...image.attrs } : null,
  }
}

const VisualContent = forwardRef(function VisualContent({ source, label, clock, onChange, onContext, onLink, onMessage }, ref) {
  const uploadController = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    uploadController.current = controller
    return () => controller.abort()
  }, [])

  function upload(view, images, position) {
    const signal = uploadController.current?.signal
    if (!signal || signal.aborted) return
    onMessage('')
    uploadAt(view, position, images, signal).then(errors => {
      if (!signal.aborted && errors.length) onMessage(errors.join('；'))
    }).catch(() => {
      if (!signal.aborted) onMessage('图片未能插入，请从图片库重新选择或重试')
    })
  }

  const editor = useEditor({
    extensions,
    content: editableHtml(source),
    editorProps: {
      attributes: { class: 'cra1-editor-surface cra1-content-document', role: 'textbox', 'aria-label': label, 'aria-multiline': 'true' },
      transformPastedHTML: cleanClipboardHtml,
      handleDOMEvents: {
        paste(view, event) {
          const images = transferredImages(event.clipboardData)
          if (!images.length) return false
          event.preventDefault()
          upload(view, images, view.state.selection.to)
          return true
        },
        drop(view, event) {
          const images = transferredImages(event.dataTransfer)
          if (!images.length) return false
          event.preventDefault()
          const point = view.posAtCoords({ left: event.clientX, top: event.clientY })
          upload(view, images, point?.pos ?? view.state.selection.to)
          return true
        },
      },
      handlePaste(view, event, slice) {
        const data = event.clipboardData
        const text = data?.getData('text/plain')
        if (slice.size || !text || !data.getData('text/html')) return false
        return view.pasteText(text)
      },
      handleClick(view, position, event) {
        const anchor = event.target.closest?.('a[href]')
        if (!anchor) return focusEmptyComponentBody(view, event)
        event.preventDefault()
        if (event.target.closest?.('img, .cra1-editor-icon')) return false
        const target = linkTarget(editor, position, anchor.getAttribute('href'))
        if (target) onLink(target)
        return true
      },
      handleDrop: (_view, _event, _slice, moved) => !moved,
    },
    onUpdate: ({ editor: current }) => onChange(savedHtml(current.getHTML())),
  }, [])

  const context = useEditorState({ editor, selector: editorContext })
  useEffect(() => {
    if (context) onContext(context)
  }, [context, onContext])

  useImperativeHandle(ref, () => ({
    format: (type, value) => formatVisual(editor, type, value),
    component: (type, attrs) => editor && (type === 'icon' ? insertMedia(editor, 'cra1Icon', attrs) : insertComponent(editor, type, attrs)),
    editLink: () => editor && linkTarget(editor),
    link: (target, attrs) => editor && updateLink(editor, target, attrs),
    image: attrs => editor && insertMedia(editor, 'image', attrs),
    selectedImage: () => editor && selectedImage(editor),
    changeImage: (target, attrs) => {
      if (!target || !editor || target.doc !== editor.state.doc) return false
      return editor.chain().focus().setNodeSelection(target.position).updateAttributes('image', attrs)
        .setNodeSelection(target.position).run()
    },
    table: command => editor?.chain().focus()[tableCommands[command]]().run(),
  }), [editor])

  return <EditingClock.Provider value={clock}><EditorContent editor={editor} /></EditingClock.Provider>
})

export default VisualContent
