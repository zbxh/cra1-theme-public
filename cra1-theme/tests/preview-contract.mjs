/** The preview sandbox must never send a business request or expose real storage. */
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const source = fs.readFileSync(new URL('../../public/cra1-shared/preview-runtime.js', import.meta.url), 'utf8')
let checks = 0
for (const domain of ['website', 'member', 'cart']) {
  const network = [], messages = [], listeners = {}, styles = []
  const document = {
    documentElement: {}, cookie: 'real-session=must-not-be-readable',
    head: { appendChild(node) { styles.push(node) } },
    createElement() { return {} },
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn) },
    querySelector() { return null },
  }
  const window = {
    __THEME_PREVIEW__: { domain, editorId: 'home', snapshot: { custom_code: { css_enabled: true, css: 'body{color:#35383c}', js_enabled: false, js: 'throw Error("disabled script executed")' } }, common: { website_name: '示例站点' }, nonce: 'fixture-message-nonce', parent_origin: 'https://fixture.invalid', resource_origin: 'https://fixture.invalid' },
    location: { href: 'https://fixture.invalid/admin/index.php?r=preview' },
    localStorage: { jwt: 'real-member-token' }, sessionStorage: { secret: 'real-private-value' },
    fetch(input) { network.push(input); return Promise.resolve(new Response('')) },
    parent: { postMessage(message, origin) { messages.push({ message, origin }) } },
  }
  const context = vm.createContext({ window, document, location: window.location, navigator: {}, URL, Response, Proxy, Promise, Object, String, setTimeout, clearTimeout, console, MutationObserver: class { observe() {} disconnect() {} } })
  vm.runInContext(source, context)
  assert.equal(window.localStorage.getItem('jwt'), 'preview-demo-token'); checks++
  assert.equal(window.sessionStorage.getItem('secret'), null); checks++
  assert.equal(document.cookie, ''); checks++
  assert.equal(window.__CRA1_RUNTIME__.error, undefined); checks++
  const access = await (await window.fetch('/cra1-shared/compat.php?target=access')).json()
  assert.equal(access.data.all, true); checks++
  for (const [url, method] of [['/console/v1/order', 'POST'], ['/console/v1/host/1', 'DELETE'], ['/console/v1/mf_cloud/1/reboot', 'POST'], ['/console/v1/ticket', 'POST'], ['/console/v1/pay', 'POST']]) {
    const result = await (await window.fetch(url, { method })).json()
    assert.notEqual(result.status, 200); checks++
  }
  const quote = await (await window.fetch('/console/v1/product/1/config_option', { method: 'POST' })).json()
  assert.equal(quote.data.price_total, 39); checks++
  const xhr = new window.XMLHttpRequest()
  xhr.open('POST', '/console/v1/order')
  const loaded = new Promise(resolve => xhr.addEventListener('loadend', resolve))
  xhr.send('must-not-leave-the-frame'); await loaded
  assert.notEqual(JSON.parse(xhr.responseText).status, 200); checks++
  for (const callback of listeners.DOMContentLoaded || []) callback()
  assert.equal(styles.length, 1); checks++
  assert.equal(messages[0].message.nonce, 'fixture-message-nonce'); checks++
  assert.equal(network.length, 0); checks++
}
console.log(JSON.stringify({ status: 'passed', checks, production_requests: 0 }))
