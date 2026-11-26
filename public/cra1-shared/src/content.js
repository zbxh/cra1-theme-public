;(function (root) {
  'use strict'
  const shared = root.CRA1Shared = root.CRA1Shared || {}
  if (shared.Content) return
  const doc = root.document
  const tabGroup = '[data-cra1-content-tabs]'
  const timed = '[data-cra1-content-ttl]'
  const article = '[data-cra1-article-content]'
  const expirations = new WeakMap()
  const groups = new WeakMap()
  const articleWatches = new WeakMap()
  const visualContent = 'img,svg,hr'
  const maxDelay = 2147483647
  let groupId = 0

  function mountTabs(group) {
    if (groups.has(group)) return
    const bar = group.firstElementChild
    if (!bar) return
    const tabs = Array.from(bar.children)
    const panels = Array.from(group.children).slice(1)
    if (!tabs.length || tabs.length !== panels.length) return
    const id = 'cra1-content-tab-' + (++groupId)
    const entries = tabs.map((tab, index) => ({ tab, panel: panels[index] }))

    function select(active, focus) {
      entries.forEach(entry => {
        const selected = entry === active
        entry.tab.setAttribute('aria-selected', String(selected))
        entry.tab.tabIndex = selected ? 0 : -1
        entry.panel.hidden = !selected
      })
      if (focus) active.tab.focus()
    }

    entries.forEach((entry, index) => {
      const { tab, panel } = entry
      tab.id = id + '-' + index
      tab.setAttribute('aria-controls', tab.id + '-panel')
      panel.id = tab.id + '-panel'
      panel.setAttribute('role', 'tabpanel')
      panel.setAttribute('aria-labelledby', tab.id)
      panel.tabIndex = 0
      const label = panel.querySelector('[data-cra1-content-tab-label]')
      if (label) label.hidden = true
      tab.addEventListener('click', () => select(entry, false))
      tab.addEventListener('keydown', event => {
        const index = entries.indexOf(entry)
        let next
        if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = entries.length - 1
        else if (event.key === 'ArrowLeft') next = (index + entries.length - 1) % entries.length
        else if (event.key === 'ArrowRight') next = (index + 1) % entries.length
        else return
        event.preventDefault()
        select(entries[next], true)
      })
    })
    groups.set(group, () => {
      const selected = entries.findIndex(entry => entry.tab.getAttribute('aria-selected') === 'true')
      const restoreFocus = group.contains(doc.activeElement)
      for (let index = entries.length - 1; index >= 0; index--) {
        const { tab, panel } = entries[index]
        if (hasContent(panel, '[data-cra1-content-tab-label]')) continue
        tab.remove()
        panel.remove()
        entries.splice(index, 1)
      }
      if (!entries.length) group.remove()
      else if (!entries.some(entry => entry.tab.getAttribute('aria-selected') === 'true')) {
        select(entries[Math.max(0, Math.min(selected, entries.length - 1))], restoreFocus)
      }
    })
    select(entries[0], false)
    bar.hidden = false
  }

  function hasContent(container, excluded) {
    return Array.from(container.childNodes).some(node => {
      if (excluded && node.matches?.(excluded)) return false
      return /[^\s\u200b]/u.test(node.textContent)
        || node.matches?.(visualContent) || node.querySelector?.(visualContent)
    })
  }

  function removeExpired(element) {
    const documentHost = element.closest('.cra1-content-document')
    let parent = element.parentElement
    element.remove()
    while (parent && parent !== documentHost) {
      const next = parent.parentElement
      groups.get(parent)?.()
      if (parent.classList.contains('cra1-content-more') && !hasContent(parent.lastElementChild)) parent.remove()
      if (parent.matches('.cra1-content-callout,.cra1-content-timed')
        && !hasContent(parent, '.cra1-content-callout__label,.cra1-content-timed__end')) parent.remove()
      parent = next
    }
    if (documentHost?.matches('[data-cra1-article-content],.cra1-cart-top-description') && !hasContent(documentHost)) documentHost.hidden = true
  }

  function expire(element, elapsed) {
    if (expirations.has(element)) return
    const seconds = Number(element.getAttribute('data-cra1-content-ttl'))
    if (!Number.isFinite(seconds) || seconds <= 0) return
    const expires = Date.now() + seconds * 1000 - elapsed
    function check() {
      if (!element.isConnected) return
      const remaining = expires - Date.now()
      if (remaining <= 0) {
        removeExpired(element)
        return
      }
      expirations.set(element, root.setTimeout(check, Math.min(maxDelay, remaining)))
    }
    check()
  }

  function articleRefresh(element) {
    if (root.__THEME_PREVIEW__ || articleWatches.has(element)) return
    const seconds = Number(element.getAttribute('data-cra1-content-refresh'))
    if (!Number.isFinite(seconds) || seconds <= 0) return
    const due = Date.now() + seconds * 1000
    const schedule = delay => articleWatches.set(element, root.setTimeout(refresh, Math.min(maxDelay, delay)))
    function refresh() {
      if (!element.isConnected) return
      if (Date.now() < due) {
        schedule(due - Date.now())
        return
      }
      root.fetch(root.location.href, { cache: 'no-store', credentials: 'same-origin' }).then(response => {
        if (!response.ok) throw new Error('Article refresh failed')
        return response.text()
      }).then(html => {
        if (!element.isConnected) return
        const updated = new DOMParser().parseFromString(html, 'text/html').querySelector(article)
        if (!updated) {
          // The module was disabled or its last component has expired.
          element.remove()
          return
        }
        // Copy the fragment from the same rendered article, without importing
        // script elements or changing the reading position.
        element.replaceWith(doc.importNode(updated, true))
      }).catch(() => {
        if (!hasContent(element)) element.hidden = true
        if (element.isConnected) schedule(30000)
      })
    }
    schedule(seconds * 1000)
  }

  function each(scope, selector, callback) {
    if (scope.matches?.(selector)) callback(scope)
    scope.querySelectorAll(selector).forEach(callback)
  }

  function enhance(scope, elapsed = 0) {
    each(scope, tabGroup, mountTabs)
    each(scope, timed, element => expire(element, elapsed))
    each(scope, article, articleRefresh)
  }

  shared.Content = { enhance }
  function start() {
    enhance(doc)
    new MutationObserver(changes => {
      for (const change of changes) {
        for (const node of change.addedNodes) if (node.nodeType === 1) enhance(node)
        for (const node of change.removedNodes) {
          if (node.nodeType !== 1 || node.isConnected) continue
          each(node, timed, element => {
            root.clearTimeout(expirations.get(element))
            expirations.delete(element)
          })
          each(node, article, element => {
            root.clearTimeout(articleWatches.get(element))
            articleWatches.delete(element)
          })
        }
      }
    }).observe(doc.body, { childList: true, subtree: true })
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true })
  else start()
})(window);
