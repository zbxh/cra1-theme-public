;(function (window) {
  var started = false
  async function mount() {
    if (started) return
    started = true
    var host = document.getElementById('cra1-content-slot')
    if (!host) return
    host.style.fontSize = '14px'
    host.style.lineHeight = '1.6'
    try {
      await window.CRA1Shared.Access.read()
      var raw = new URLSearchParams(location.search).get('iframe_url') || ''
      var url = new URL(raw, location.origin)
      if (!raw || !['http:', 'https:'].includes(url.protocol) || url.username || url.password
          || (url.origin === location.origin && url.pathname === '/custom_iframe.htm')) throw Error('invalid')
      if (!window.CRA1Shared.Access.canUrl(url.href)) throw Error('denied')
      var frame = document.createElement('iframe'), link = document.createElement('a')
      frame.title = '内嵌页面'
      frame.referrerPolicy = 'no-referrer'
      frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-downloads allow-popups')
      frame.style.cssText = 'display:block;width:100%;height:calc(100dvh - 160px);min-height:480px;border:0;border-radius:8px;background:transparent'
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'
      link.style.cssText = 'font:13px/20px system-ui;color:var(--muted-foreground,#61656b);text-decoration:underline;text-underline-offset:3px'
      link.className = 'cui-link'; link.textContent = '在新窗口打开'
      var bar = document.createElement('p'); bar.style.cssText = 'text-align:right;margin:0 0 12px;font-size:13px;line-height:20px'; bar.appendChild(link)
      host.replaceChildren(bar, frame)
      frame.src = url.href
    } catch (error) {
      host.textContent = '页面暂时无法打开，请检查地址或联系管理员。'
      host.setAttribute('role', 'alert')
    }
  }
  if (window.__CRA1_SHELL_READY__) mount()
  else window.addEventListener('cra1:shell-ready', mount, { once: true })
})(window)
