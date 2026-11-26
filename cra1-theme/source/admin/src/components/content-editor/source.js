// Keep safe legacy markup outside the editor schema as an editable source fragment.
// These elements are only used by the editor and are expanded before saving.
const supported = new Set(['p','br','b','strong','em','i','u','s','strike','span','a','img','ul','ol','li','blockquote','pre','code','h1','h2','h3','h4','h5','h6','hr',
  'table','tbody','tr','th','td','cra1-timed','cra1-more','cra1-tabs','cra1-tab','cra1-icon','cra1-callout'])
const inline = new Set(['br','strong','b','em','i','u','s','strike','span','a','img','code','small','sup','sub','cra1-icon'])
const acceptsStyle = new Set(['p','ul','ol','li','blockquote','pre','h1','h2','h3','h4','h5','h6','hr','table','tr','th','td'])
const acceptsInline = new Set(['p','h1','h2','h3','h4','h5','h6','b','strong','span','a','em','i','s','u'])

export function safeLink(value, image = false) {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048
    && !/[\x00-\x20\x7f<>"'\\]/.test(value) && !value.startsWith('//')
    && (!/^[a-z][a-z0-9+.-]*:/i.test(value) || (image ? /^https?:\/\//i : /^(https?:\/\/|mailto:|tel:)/i).test(value))
}

function fragment(html) {
  const template = document.createElement('template')
  template.innerHTML = html
  return template
}

function needsSourceTable(table) {
  // The table editor has one row group. Retain older tables with meaningful section markup in HTML mode.
  return table.tBodies.length !== 1 || table.tHead || table.tFoot || table.tBodies[0].attributes.length
    || table.querySelector('table,[rowspan="0"],[colspan="0"]')
}

export function editableHtml(html) {
  const template = fragment(html)
  function walk(parent) {
    for (const element of Array.from(parent.children)) {
      const name = element.localName
      const style = element.getAttribute('style')
      const visibleMark = name === 'span' && style?.split(';').filter(part => part.trim())
        .every(part => /^\s*(color|background-color)\s*:/i.test(part))
      const styled = style && !acceptsStyle.has(name) && !visibleMark
      const titledSpan = name === 'span' && element.hasAttribute('title')
      if (!supported.has(name) || styled || titledSpan || (name === 'table' && needsSourceTable(element))) {
        const tag = inline.has(name) && acceptsInline.has(parent.localName) ? 'cra1-editor-raw-inline' : 'cra1-editor-raw-block'
        const placeholder = element.ownerDocument.createElement(tag)
        placeholder.setAttribute('data-html', element.outerHTML)
        element.replaceWith(placeholder)
      } else {
        walk(element)
      }
    }
  }
  walk(template.content)
  return template.innerHTML
}

export function savedHtml(editorHtml) {
  const template = fragment(editorHtml)
  for (const placeholder of template.content.querySelectorAll('cra1-editor-raw-block,cra1-editor-raw-inline')) {
    placeholder.replaceWith(fragment(placeholder.getAttribute('data-html') || '').content)
  }
  return template.innerHTML
}
