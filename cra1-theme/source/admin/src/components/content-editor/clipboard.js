import { safeLink } from './source'

const tags = new Set(['p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'span', 'a', 'img',
  'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'tbody', 'tr', 'th', 'td', 'cra1-timed', 'cra1-tabs', 'cra1-tab', 'cra1-icon', 'cra1-callout'])
const discarded = new Set(['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'template', 'svg', 'math'])
const preservedAttributes = {
  'cra1-timed': ['start', 'end', 'show-end'], 'cra1-tab': ['label'], 'cra1-icon': ['name'], 'cra1-callout': ['tone', 'title'],
}

function wordHeading(element) {
  if (element.localName !== 'p') return ''
  const level = element.className.match(/\bMsoHeading([1-6])\b/i)?.[1]
    || element.getAttribute('style')?.match(/\bmso-outline-level:\s*([1-6])\b/i)?.[1]
  return level ? 'h' + level : ''
}

function wordLists(parent) {
  let previous = null
  for (const paragraph of Array.from(parent.children)) {
    const listName = paragraph.getAttribute('style')?.match(/(?:^|;)\s*mso-list:\s*([^;]+)/i)?.[1]
    const marker = listName && paragraph.querySelector('[style*="mso-list"][style*="Ignore" i]')
    if (paragraph.localName !== 'p' || !marker || paragraph.closest('li')) {
      previous = null
      continue
    }
    const tag = /^(?:\d+|[a-z]+)[.)、]/i.test(marker.textContent.trim()) ? 'ol' : 'ul'
    const key = tag + listName.trim()
    if (previous?.key !== key) {
      previous = { key, list: paragraph.ownerDocument.createElement(tag) }
      paragraph.before(previous.list)
    }
    const item = paragraph.ownerDocument.createElement('li')
    previous.list.append(item)
    item.append(paragraph)
    marker.remove()
  }
}

function promoteName(element, name) {
  if (element.localName === name) return element
  const replacement = element.ownerDocument.createElement(name)
  for (const attribute of element.attributes) replacement.setAttribute(attribute.name, attribute.value)
  replacement.append(...element.childNodes)
  element.replaceWith(replacement)
  return replacement
}

function keepAttribute(element, source, name, accepts = value => value !== null) {
  const value = source.getAttribute(name)
  if (accepts(value)) element.setAttribute(name, value)
}

function collectAttributes(element, source) {
  const tag = element.localName
  const { style } = source
  if (tag === 'a') {
    keepAttribute(element, source, 'href', value => safeLink(value))
    keepAttribute(element, source, 'title')
    keepAttribute(element, source, 'target', value => value === '_blank')
    if (source.classList.contains('cra1-content-link')) element.className = 'cra1-content-link'
  }
  if (tag === 'img') {
    keepAttribute(element, source, 'src', value => safeLink(value, true))
    for (const name of ['width', 'height']) keepAttribute(element, source, name, value => /^[1-9]\d{0,3}$/.test(value))
    keepAttribute(element, source, 'alt')
    keepAttribute(element, source, 'title')
    if (source.classList.contains('cra1-content-image-center')) element.className = 'cra1-content-image-center'
  }
  if (tag === 'span') {
    element.style.color = style.color
    element.style.backgroundColor = style.backgroundColor
  }
  if (/^(p|h[1-6])$/.test(tag) && /^(left|center|right|justify)$/.test(style.textAlign)) {
    element.style.textAlign = style.textAlign
  }
  if (['td', 'th', 'ol'].includes(tag)) {
    const names = tag === 'ol' ? ['start'] : ['rowspan', 'colspan']
    for (const name of names) keepAttribute(element, source, name, value => /^[1-9]\d{0,2}$/.test(value))
  }
  for (const name of preservedAttributes[tag] || []) keepAttribute(element, source, name)
}

function formatOfficeText(element, style) {
  if (!/^(p|h[1-6]|span|a)$/.test(element.localName) || !element.hasChildNodes()) return
  const marks = []
  if (/^(bold|bolder|[6-9]00)$/.test(style.fontWeight)) marks.push('strong')
  if (/^(italic|oblique)$/.test(style.fontStyle)) marks.push('em')
  if (style.textDecoration.includes('underline')) marks.push('u')
  const owner = element.ownerDocument
  for (const mark of marks) {
    const wrapper = owner.createElement(mark)
    wrapper.append(...element.childNodes)
    element.append(wrapper)
  }
}

export function cleanClipboardHtml(html) {
  const template = document.createElement('template')
  template.innerHTML = html

  function clean(parent) {
    wordLists(parent)
    for (const child of Array.from(parent.children)) {
      const name = child.localName
      if (!child.parentNode || child.parentNode !== parent) continue
      if (discarded.has(name)) {
        child.remove()
        continue
      }
      clean(child)
      // Office wraps ordinary text in namespaced elements. Keep the text, and
      // keep block boundaries for divs while stripping the source presentation.
      const tag = wordHeading(child) || ({ div: 'div', thead: 'tbody', tfoot: 'tbody' })[name] || name
      if (tag === 'div' || tags.has(tag)) {
        const element = promoteName(child, tag)
        const source = element.cloneNode(false)
        for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name)
        collectAttributes(element, source)
        formatOfficeText(element, source.style)
        if (tag === 'img' && !element.hasAttribute('src')) element.remove()
      } else {
        child.replaceWith(...child.childNodes)
      }
    }
  }
  clean(template.content)
  return template.innerHTML
}
