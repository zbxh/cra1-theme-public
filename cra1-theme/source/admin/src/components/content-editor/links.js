import { getMarkRange } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

function linkAt(doc, position, href) {
  const type = doc.type.schema.marks.link
  const range = getMarkRange(doc.resolve(position), type)
  if (!range) return null
  const mark = type.isInSet(doc.nodeAt(range.from)?.marks || [])
  if (!mark || (href && mark.attrs.href !== href)) return null
  return { ...range, mark }
}

export function inlineLinkMarks(doc, from, to = from) {
  const link = linkAt(doc, from)
  // A cursor at either edge can insert content next to the link.
  return link && to <= link.to && (from < to || (from > link.from && from < link.to)) ? [link.mark] : []
}

export function linkTarget(editor, clickedPosition, expectedHref) {
  const { doc, selection } = editor.state
  const position = clickedPosition ?? selection.from
  let link = linkAt(doc, position, expectedHref)
  if (clickedPosition === undefined && link && selection.to > link.to) link = null
  // A click at the right edge can resolve to the following inline node.
  if (expectedHref && !link && position > 0) link = linkAt(doc, position - 1, expectedHref)
  if (expectedHref && !link) return null

  const range = link ? { from: link.from, to: link.to } : { from: selection.from, to: selection.to }
  const attributes = link?.mark.attrs
  const text = doc.textBetween(range.from, range.to, ' ')
  let preserveContents = !doc.resolve(range.from).sameParent(doc.resolve(range.to))
  doc.nodesBetween(range.from, range.to, node => {
    if (node.isInline && !node.isText) preserveContents = true
    return !preserveContents
  })
  return {
    doc, range, text, attributes, preserveContents,
    selectedMedia: clickedPosition === undefined && selection instanceof NodeSelection && selection.node.isInline ? selection.from : null,
    href: attributes?.href || '',
    button: attributes?.class === 'cra1-content-link',
    newTab: attributes?.target === '_blank',
  }
}

export function updateLink(editor, target, attributes) {
  if (!target || target.doc !== editor.state.doc) return false
  const { range, text, attributes: original, preserveContents, selectedMedia } = target
  const chain = editor.chain().focus().setTextSelection(range)
  if (!attributes) {
    chain.unsetLink()
  } else {
    const { label, ...changes } = attributes
    const next = { ...original, ...changes }
    if ((!preserveContents && label && label !== text) || range.from === range.to) {
      const position = editor.state.doc.resolve(range.from)
      const marks = (position.nodeAfter?.marks || position.marks()).filter(mark => mark.type.name !== 'link')
      return chain.insertContent({
        type: 'text', text: label || attributes.href,
        marks: [...marks.map(mark => mark.toJSON()), { type: 'link', attrs: next }],
      }).run()
    }
    chain.setLink(next)
  }
  if (selectedMedia !== null) chain.setNodeSelection(selectedMedia)
  return chain.run()
}
