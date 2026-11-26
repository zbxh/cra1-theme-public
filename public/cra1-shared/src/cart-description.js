;(function (root) {
  'use strict'
  const shared = root.CRA1Shared = root.CRA1Shared || {}
  if (shared.CartDescription) return
  const doc = root.document
  const maxDelay = 2147483647

  function mount(host, onMode) {
    let target, controller, timer
    let lastHtml = ''
    host.hidden = true

    function display(mode, html, elapsed) {
      if (lastHtml !== html) {
        host.innerHTML = html
        shared.Content?.enhance(host, elapsed)
        lastHtml = html
      }
      host.hidden = !html
      onMode?.(mode)
    }

    const preview = root.__THEME_PREVIEW__
    if (preview) {
      const value = preview.cartDescription
      if (value) display(value.mode, value.html, 0)
      return
    }

    function load(url) {
      if (!host.isConnected) return
      const started = Date.now()
      const request = controller = new AbortController()
      root.fetch(url, { credentials: 'omit', cache: 'no-store', signal: request.signal })
        .then(response => {
          if (!response.ok) throw new Error('Description unavailable')
          return response.json()
        }).then(result => {
          if (request.signal.aborted || !host.isConnected) return
          const value = result.data
          if (result.status !== 200 || !value || !['custom', 'hide', 'none'].includes(value.mode)
            || typeof value.html !== 'string') throw new Error('Invalid description')
          const elapsed = Date.now() - started
          display(value.mode, value.html, elapsed)
          if (Number.isFinite(value.refresh_after) && value.refresh_after > 0) {
            timer = root.setTimeout(() => load(url), Math.min(maxDelay, Math.max(500, value.refresh_after * 1000 - elapsed)))
          }
        }).catch(() => {
          if (request.signal.aborted || !host.isConnected) return
          timer = root.setTimeout(() => load(url), 30000)
        })
    }

    function stop() {
      controller?.abort()
      root.clearTimeout(timer)
    }

    function select(first, second, product) {
      const query = new URLSearchParams()
      for (const [key, id] of [['fpg_id', first], ['spg_id', second], ['product_id', product]]) {
        if (/^[1-9]\d{0,9}$/.test(String(id))) query.set(key, id)
      }
      const url = '/cra1-shared/cart-description.php?' + query
      if (target === url) return
      target = url
      stop()
      // Clear the previous selection immediately. Keep the catalogue interactive
      // even if a description request fails or the selection changes again.
      display('none', '', 0)
      timer = root.setTimeout(() => load(url), 90)
    }
    return { select, stop }
  }

  function start() {
    if (!doc.documentElement.hasAttribute('data-cra1-native-cart') || root.__THEME_PREVIEW__) return
    const selector = '[data-cra1-cart-description]'
    const instances = new WeakMap()
    function connect(host) {
      if (!host.isConnected || instances.has(host)) return
      const instance = mount(host)
      instances.set(host, instance)
      instance.select(0, 0, host.getAttribute('data-cra1-cart-description'))
    }
    function disconnect(host) {
      if (host.isConnected) return
      instances.get(host)?.stop()
      instances.delete(host)
    }
    function visit(node, action) {
      if (node.nodeType !== 1) return
      if (node.matches(selector)) action(node)
      node.querySelectorAll(selector).forEach(action)
    }
    // The native Vue document can replace the placeholder as it mounts.
    new MutationObserver(changes => {
      for (const change of changes) {
        change.removedNodes.forEach(node => visit(node, disconnect))
        change.addedNodes.forEach(node => visit(node, connect))
      }
    }).observe(doc.body, { childList: true, subtree: true })
    doc.querySelectorAll(selector).forEach(connect)
  }
  shared.CartDescription = { mount }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => root.setTimeout(start, 0), { once: true })
  else root.setTimeout(start, 0)
})(window);
