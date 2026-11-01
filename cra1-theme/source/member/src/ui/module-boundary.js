// Keep failures inside an injected native module from leaving its page loading.
// The surrounding shell and other Vue applications retain their own handlers.
const documents = new WeakMap()

export function watchModuleFailure(host, onFailure) {
  const root = host.ownerDocument.defaultView, Vue = root.Vue
  let state = documents.get(root)
  if (!state) {
    state = {boundaries: new Set(), Vue, mount: Vue?.prototype.$mount, error: Vue?.config.errorHandler}
    state.mounted = function (element) {
      const node = typeof element === 'string' ? root.document.querySelector(element) : element
      for (const boundary of state.boundaries) if (node && boundary.host.contains(node)) boundary.instances.add(this.$root || this)
      return state.mount.apply(this, arguments)
    }
    state.failed = function (error, vm, info) {
      const boundary = [...state.boundaries].find(b => b.instances.has(vm?.$root || vm) || (vm?.$el && b.host.contains(vm.$el)))
      if (boundary) { boundary.fail(); return }
      if (state.error) return state.error.call(this, error, vm, info)
      throw error
    }
    state.event = event => {
      const reason = event.reason || event.error
      for (const boundary of state.boundaries) {
        const scriptError = boundary.sources.some(src => event.filename === src || reason?.stack?.includes(src))
        const config = reason?.config, method = (config?.method || 'get').toLowerCase()
        let requestPath = ''
        try { requestPath = new URL(config?.url || '', root.location.href).pathname } catch {}
        const rejectedRead = ['get', 'head'].includes(method) && boundary.prefixes.some(prefix => requestPath.startsWith(prefix))
        if (scriptError || rejectedRead) { event.preventDefault(); boundary.fail(); return }
      }
    }
    if (state.mount) Vue.prototype.$mount = state.mounted
    if (Vue) Vue.config.errorHandler = state.failed
    root.addEventListener('error', state.event)
    root.addEventListener('unhandledrejection', state.event)
    documents.set(root, state)
  }
  const sources = Array.from(host.querySelectorAll('script[src]')).map(node => new URL(node.src, root.location.href))
    .filter(url => url.origin === root.location.origin && /\/plugins\/(?:server|reserver)\//.test(url.pathname))
  const prefixes = sources.map(url => /\/plugins\/(?:server|reserver)\/([^/]+)\//.exec(url.pathname)?.[1]).filter(Boolean).map(name => '/'+name+'/')
  const boundary = {host, sources: sources.map(url => url.href), prefixes, instances: new Set(), fail: onFailure}
  state.boundaries.add(boundary)
  return {
    instances: boundary.instances,
    dispose() {
      state.boundaries.delete(boundary)
      if (state.boundaries.size) return
      if (Vue?.prototype.$mount === state.mounted) Vue.prototype.$mount = state.mount
      if (Vue?.config.errorHandler === state.failed) Vue.config.errorHandler = state.error
      root.removeEventListener('error', state.event)
      root.removeEventListener('unhandledrejection', state.event)
      documents.delete(root)
    },
  }
}
