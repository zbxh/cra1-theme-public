import fs from 'node:fs'
import assert from 'node:assert/strict'
const {chromium} = await import(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const source = fs.readFileSync(new URL('../source/member/src/ui/module-boundary.js', import.meta.url), 'utf8').replace('export function', 'function')
const vue = fs.readFileSync(new URL('../../public/clientarea/template/pc/default/js/common/vue.js', import.meta.url), 'utf8')
const browser = await chromium.launch({args: ['--no-sandbox']})
const context = await browser.newContext()
await context.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<div id="host"><div id="native"></div><script type="application/json" src="/plugins/server/fixture/detail.js"></script></div><div id="other"></div>'}))
let checks = 0
try {
  for (const kind of ['valid', 'render-error', 'script-error', 'read-error', 'later-read', 'later-write', 'later-script', 'later-event', 'later-render', 'unrelated', 'cleanup']) {
    const page = await context.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('https://fixture.invalid/module.htm')
    await page.addScriptTag({content: vue})
    await page.addScriptTag({content: source + `
      window.failures=0; window.externalErrors=0; window.recoverable=[];
      Vue.config.errorHandler=()=>window.externalErrors++;
      window.beforeMount=Vue.prototype.$mount;window.beforeError=Vue.config.errorHandler;
      window.boundary=watchModuleFailure(document.querySelector('#host'),()=>window.failures++,kind=>window.recoverable.push(kind));
    `})
    const result = await page.evaluate(async kind => {
      if (kind === 'valid') new Vue({render: h => h('p', 'working')}).$mount('#native')
      if (kind === 'render-error') new Vue({render() {throw Error('missing module data')}}).$mount('#native')
      let vm
      if (kind.startsWith('later-')) {
        vm = new Vue({
          data: {broken: false},
          render(h) {
            if (this.broken) throw Error('local render failed')
            return h('button', {on: {click() {throw Error('local event failed')}}}, 'working')
          },
        }).$mount('#native')
        boundary.ready()
      }
      if (kind === 'read-error' || kind === 'unrelated' || kind === 'later-read' || kind === 'later-write') {
        const reason = {config: {method: kind === 'later-write' ? 'post' : 'get', url: kind === 'unrelated' ? '/unrelated/host/1' : '/console/v1/fixture/host/1'}}
        const event = new PromiseRejectionEvent('unhandledrejection', {reason, promise: Promise.resolve(), cancelable: true})
        dispatchEvent(event)
        return {failures, prevented: event.defaultPrevented, recoverable, destroyed: vm?._isDestroyed, text: document.querySelector('#host').textContent}
      }
      if (kind === 'script-error' || kind === 'later-script') {
        const error = new Error('native script failure')
        const event = new ErrorEvent('error', {error, filename: 'https://fixture.invalid/plugins/server/fixture/detail.js', cancelable: true})
        dispatchEvent(event)
      }
      if (kind === 'later-event') vm.$el.click()
      if (kind === 'later-render') {vm.broken = true; await Vue.nextTick()}
      if (kind === 'cleanup') {
        boundary.dispose()
        new Vue({render() {throw Error('outside module')}}).$mount('#other')
        return {failures, externalErrors, restored: Vue.prototype.$mount === beforeMount && Vue.config.errorHandler === beforeError}
      }
      return {failures, externalErrors, recoverable, destroyed: vm?._isDestroyed, text: document.querySelector('#host').textContent}
    }, kind)
    if (kind === 'valid') {assert.match(result.text, /working/); assert.equal(result.failures, 0)}
    if (kind === 'render-error' || kind === 'script-error') {assert.equal(result.failures, 1); assert.equal(result.externalErrors, 0)}
    if (kind === 'read-error') {assert.equal(result.failures, 1); assert.equal(result.prevented, true)}
    if (kind.startsWith('later-')) {
      assert.equal(result.failures, 0)
      assert.equal(result.destroyed, false)
      assert.match(result.text, /working/)
      assert.deepEqual(result.recoverable, [kind === 'later-read' ? 'read' : kind === 'later-write' ? 'operation' : 'script'])
    }
    if (kind === 'unrelated') {assert.equal(result.failures, 0); assert.equal(result.prevented, false)}
    if (kind === 'cleanup') {assert.equal(result.failures, 0); assert.equal(result.externalErrors, 1); assert.equal(result.restored, true)}
    assert.deepEqual(errors, [])
    checks++; await page.close()
  }
  console.log(JSON.stringify({status: 'passed', checks}))
} finally {await browser.close()}
