/** Independent, loopback-only search history review. No customer/site data. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = process.env.CRA1_SOURCE_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const out = process.env.CRA1_BROWSER_OUT
if (!out || path.resolve(out) === path.resolve(root) || path.resolve(out).startsWith(path.resolve(root) + path.sep)) throw Error('Set CRA1_BROWSER_OUT outside the source tree')
const stage = process.env.CRA1_REVIEW_STAGE
const nativeCart = stage && process.env.CRA1_REVIEW_NATIVE_CART === '1'
const { chromium } = createRequire(root + '/cra1-theme/scripts/package.json')('playwright')
const checks = [], requests = [], errors = [], contexts = []
const source = name => fs.readFileSync(path.join(root, 'public/cra1-shared/src', name), 'utf8')
const manifest = stage ? JSON.parse(fs.readFileSync(path.join(stage, 'release.json'))) : null
const release = manifest?.release
function file(kind) {
  if (stage) return fs.readFileSync(path.join(stage, 'public/cra1-shared/releases', release, (nativeCart ? 'native-cart-navigation.' : 'cra1-shared.') + kind))
  return kind === 'js'
    ? ['request.js', 'ui.js', 'notification-session.js', 'search-match.js', 'header-search.js'].map(source).join('\n')
    : ['tokens.css', 'components.css', 'header-search.css'].map(source).join('\n')
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://fixture.invalid')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
  if (u.pathname === '/bundle.js' || u.pathname === '/style.css') {
    res.setHeader('Content-Type', u.pathname.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(file(u.pathname.endsWith('.js') ? 'js' : 'css')); return
  }
  if (u.pathname.startsWith('/console/')) {
    requests.push({ path: u.pathname, keywords: u.searchParams.get('keywords') })
    const keyword = u.searchParams.get('keywords') || ''
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ status: 200, data: { list: [{ id: 1, name: keyword, product_name: keyword, status: 'Active', billing_cycle: 'onetime' }], count: 1, overview: { server_time: 1794398400, renewal_enabled: false } } })); return
  }
  res.setHeader('Content-Type', 'text/html;charset=utf-8')
  res.end(`<!doctype html><html data-cra1-theme="website"${nativeCart ? ' data-cra1-native-cart' : ''}><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f9fbfb}header{height:72px;padding:12px;display:flex;justify-content:flex-end;align-items:center}[hidden]{display:none!important}</style><header class="${nativeCart ? 'cra1-header' : ''}"><div id="search" class="cra1-header-search"></div></header><button id="outside">外部区域</button><script src="/bundle.js"></script><script>window.navigations=[];window.searchComponent=CRA1Shared.HeaderSearch.mount(document.getElementById('search'),{context:'member',getSearchOptions:()=>({context:'member',sources:[{key:'products',path:'product',label:'订购商品'},{key:'hosts',path:'cra1-theme/member/search',label:'我的产品'}]}),onNavigate:value=>window.navigations.push(value)});</script></html>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const token = (id, sub = 0) => 'fixture.' + Buffer.from(JSON.stringify({ info: { id, sub_account_id: sub } })).toString('base64url') + '.signature'
const check = (value, label) => { assert.ok(value, label); checks.push(label) }
async function fresh({ width = 1440, jwt = '', init } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); contexts.push(context)
  if (jwt) await context.addInitScript(value => { if (!window.__jwtSeeded) { localStorage.setItem('jwt', value); window.__jwtSeeded = true } }, jwt)
  if (init) await context.addInitScript(init)
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message))
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await page.goto(origin + '/search.html')
  const input = page.getByRole('combobox')
  async function open() { if (width >= 1024) { await input.focus(); await input.click() } else if (!await input.isVisible()) await page.getByRole('button', { name: '搜索产品与文章', exact: true }).click() }
  return { context, page, input, open }
}
async function clearInput(f) { await f.open(); await f.input.fill(''); await f.input.dispatchEvent('input') }
async function completed(f, keyword, { submit = true, close = true } = {}) {
  await f.open(); await f.input.fill(keyword)
  if (submit) await f.input.press('Enter')
  await f.page.locator('.cra1-header-search__item').first().waitFor()
  await f.page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'))
  if (close) await f.input.press('Escape')
}
const history = f => f.page.locator('.cra1-header-search__history-item').allTextContents()
async function storage(f) { return f.page.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'jwt')), session: Object.fromEntries(Object.entries(sessionStorage)) })) }
async function identity(f, jwt) {
  await f.page.evaluate(value => { value ? localStorage.setItem('jwt', value) : localStorage.removeItem('jwt'); window.dispatchEvent(new Event('focus')) }, jwt)
  await f.page.waitForTimeout(550)
}

try {
  let f = await fresh()
  const before = requests.length; await f.open(); await f.page.waitForTimeout(350)
  check(await f.input.inputValue() === '' && await history(f).then(v => v.length) === 0, 'fresh guest has no invented history')
  check(requests.length === before, 'opening blank history does not query APIs')
  await completed(f, 'SSH 密钥', { submit: false, close: false })
  check(!JSON.stringify(await storage(f)).includes('SSH'), 'debounced typing does not write every partial term')
  await f.input.press('Escape'); await clearInput(f)
  check((await history(f))[0]?.includes('SSH 密钥'), 'closing a completed search records its visible query')
  for (let n = 1; n <= 9; n++) await completed(f, 'cloud' + n)
  await clearInput(f); let terms = await history(f)
  check(terms.length === 7, 'history caps visible terms at seven')
  check(terms[0].includes('cloud9') && terms.at(-1).includes('cloud3'), 'history preserves newest-first bounded order')
  check(!terms.some(s => s.includes('cloud1') || s.includes('cloud2')), 'oldest entries retire beyond seven')
  await completed(f, 'cloud5'); await clearInput(f); terms = await history(f)
  check(terms.length === 7 && terms[0].includes('cloud5') && terms.filter(s => s.includes('cloud5')).length === 1, 'reused keyword moves to top without duplicates')
  await completed(f, 'SSH 密钥'); await completed(f, 'ＳＳＨ　密钥'); await clearInput(f)
  terms = await history(f)
  check(terms.filter(s => /密钥/.test(s)).length === 1 && terms[0].includes('ＳＳＨ'), 'width/case/whitespace normalization deduplicates while retaining last original spelling')
  await completed(f, '192.0.2.1'); await completed(f, '192.0.21'); await clearInput(f)
  terms = await history(f)
  check(terms.some(s => s.includes('192.0.2.1')) && terms.some(s => s.includes('192.0.21')), 'history does not discard identifier punctuation')
  const stored = await storage(f)
  check(Object.keys(stored.local).includes('cra1-search-history:guest') && !Object.keys(stored.session).some(k => k.includes('search-history')), 'guest history is browser-local rather than server/account storage')
  const raw = stored.local['cra1-search-history:guest']
  check(Array.isArray(JSON.parse(raw)) && JSON.parse(raw).length === 7 && JSON.parse(raw).every(v => typeof v === 'string'), 'history persists only seven plain query strings')
  check(!raw.includes('product_id') && !raw.includes('/console/') && !raw.includes('signature'), 'history has no result URLs, response payloads or token')
  await f.page.reload(); await clearInput(f)
  check((await history(f)).length === 7, 'guest history survives reload')
  const requestStart = requests.length
  await f.input.press('ArrowDown')
  check((await f.input.getAttribute('aria-activedescendant')) && await f.page.locator('.cra1-header-search__history-item.is-active').count() === 1, 'history keyboard highlight maintains aria active descendant')
  await f.input.press('Enter')
  await f.page.locator('.cra1-header-search__item').first().waitFor()
  check(await f.input.inputValue() === '192.0.21' && requests.slice(requestStart).some(v => v.keywords === '192.0.21'), 'keyboard history activation fills the query and performs fresh search')
  check(await f.page.locator('.cra1-header-search__history-item').count() === 0, 'nonempty search displays results instead of history')
  await clearInput(f)
  await f.page.locator('.cra1-header-search__history-clear').click()
  check((await history(f)).length === 0, 'clear history removes entries immediately')
  check(!JSON.stringify(await storage(f)).includes('192.0.21'), 'clear history removes persisted query strings')
  await completed(f, '<img src=x onerror=alert(1)>'); await clearInput(f)
  check(await f.page.locator('.cra1-header-search__history-item img').count() === 0 && (await history(f))[0].includes('<img'), 'history renders malicious-looking query as inert text')
  await completed(f, 'click-completed', { submit: false, close: false })
  await f.page.locator('.cra1-header-search__item').first().click(); await clearInput(f)
  check((await history(f))[0]?.includes('click-completed') && await f.page.evaluate(() => navigations.length) === 1, 'result activation records the query while retaining navigation behavior')
  const beforeZero = requests.length
  await f.input.fill('0'); await f.input.press('Enter'); await f.page.waitForTimeout(350); await f.input.press('Escape'); await clearInput(f)
  check(!(await history(f)).some(v => v.trim() === '0') && requests.length === beforeZero, 'native empty-equivalent zero query is neither requested nor remembered')
  await f.context.close()

  f = await fresh({ jwt: token(101) })
  await completed(f, 'private-server-101'); await clearInput(f)
  let privateStorage = await storage(f)
  check(privateStorage.session['cra1-search-history:member:101:0']?.includes('private-server-101'), 'signed member history uses session storage scoped by native account ID')
  check(!JSON.stringify(privateStorage.local).includes('private-server-101'), 'signed member query is absent from persistent guest storage')
  check(!JSON.stringify(privateStorage).includes(token(101)), 'no stored history key or value embeds bearer token')
  await f.page.reload(); await clearInput(f)
  check((await history(f))[0]?.includes('private-server-101'), 'member history survives same-tab reload')
  await identity(f, token(202)); await clearInput(f)
  check((await history(f)).length === 0 && !await f.input.inputValue(), 'account switch purges prior visible terms and results')
  await completed(f, 'private-server-202'); await clearInput(f)
  check(!(await history(f)).some(v => v.includes('101')), 'second account cannot see first account history')
  await identity(f, token(101, 3)); await clearInput(f)
  check((await history(f)).length === 0, 'restricted subaccount has a distinct history scope')
  await completed(f, 'sub-account-three'); await identity(f, ''); await clearInput(f)
  check((await history(f)).length === 0 && !JSON.stringify(await history(f)).includes('private'), 'logout does not reveal member or subaccount terms anonymously')
  await completed(f, 'public-docs'); await identity(f, token(101)); await clearInput(f)
  check((await history(f))[0]?.includes('private-server-101') && !(await history(f)).some(v => v.includes('public-docs')), 'member and guest histories remain independent when login returns')
  await completed(f, 'unclosed-account101-private', { submit: false, close: false })
  await identity(f, ''); await clearInput(f)
  check((await history(f))[0]?.includes('public-docs'), 'returning guest sees only public guest query history')
  check(!JSON.stringify(await storage(f)).includes('unclosed-account101-private'), 'logout does not save an unclosed member query into new guest scope')
  await identity(f, token(101)); await completed(f, 'instant-account101-private', { submit: false, close: false })
  const navigationsBeforeSwitch = await f.page.evaluate(() => navigations.length)
  await f.page.evaluate(next => { const stale = document.querySelector('.cra1-header-search__item'); localStorage.setItem('jwt', next); stale.click() }, token(202))
  check(await f.page.evaluate(() => navigations.length) === navigationsBeforeSwitch && !await f.input.inputValue(), 'synchronous token replacement blocks stale result activation before the session watcher tick')
  check(!JSON.stringify(await storage(f)).includes('instant-account101-private'), 'stale result click does not save prior private term into new account history')
  await identity(f, token(101)); await clearInput(f)
  await f.page.evaluate(next => { const stale = document.querySelector('.cra1-header-search__history-item'); localStorage.setItem('jwt', next); stale.click() }, token(303))
  check(!await f.input.inputValue() && (await history(f)).length === 0, 'synchronous token replacement prevents replay of a previous account history button')
  check(!JSON.stringify((await storage(f)).session['cra1-search-history:member:303:0'] || '').includes('private'), 'stale history activation never copies private query to the replacement account')
  await identity(f, token(101)); await completed(f, 'stale-submit-private', { submit: false, close: false })
  const readsBeforeStaleSubmit = requests.length
  await f.page.evaluate(next => { localStorage.setItem('jwt', next); document.querySelector('form').dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true })) }, token(202))
  await f.page.waitForTimeout(350)
  check(requests.length === readsBeforeStaleSubmit && !await f.input.inputValue(), 'immediate token switch plus form submit never issues an old private query using new credentials')
  check(!JSON.stringify(await storage(f)).includes('stale-submit-private'), 'immediate stale form submit cannot persist the old query')
  await f.context.close()

  f = await fresh({ jwt: 'opaque-invalid-member-token' })
  await completed(f, 'opaque-private'); await clearInput(f)
  check((await history(f))[0]?.includes('opaque-private'), 'unparsed signed session still supports memory history')
  check(!JSON.stringify(await storage(f)).includes('opaque-private'), 'unparsed signed-session history is never saved as guest')
  await identity(f, 'other-opaque-member-token'); await clearInput(f)
  check((await history(f)).length === 0, 'opaque token switch separates memory-only histories')
  await identity(f, ''); await clearInput(f)
  check((await history(f)).length === 0, 'opaque member query remains hidden after logout')
  await f.context.close()

  f = await fresh({ init: () => localStorage.setItem('cra1-search-history:guest', '{broken') })
  await f.open(); check((await history(f)).length === 0, 'corrupt stored JSON safely acts as empty history')
  await completed(f, 'recovered'); await clearInput(f)
  check((await history(f))[0]?.includes('recovered'), 'new valid search repairs corrupted optional history')
  await f.context.close()

  f = await fresh({ init: () => { const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem; Storage.prototype.getItem = function(k) { if(k.includes('search-history')) throw new DOMException('blocked','SecurityError'); return get.call(this,k) }; Storage.prototype.setItem = function(k,v) { if(k.includes('search-history')) throw new DOMException('blocked','SecurityError'); return set.call(this,k,v) }; Storage.prototype.removeItem = function(k) { if(k.includes('search-history')) throw new DOMException('blocked','SecurityError'); return remove.call(this,k) } } })
  await completed(f, 'storage-disabled'); await clearInput(f)
  check((await history(f))[0]?.includes('storage-disabled'), 'browser storage denial falls back to working memory history')
  await f.page.locator('.cra1-header-search__history-clear').click(); check((await history(f)).length === 0, 'clear works despite denied storage')
  await f.context.close()

  f = await fresh({ init: () => { localStorage.setItem('cra1-search-history:guest', '["previously-saved"]'); const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem; Storage.prototype.setItem = function(k,v) { if(k.includes('search-history')) throw new DOMException('full','QuotaExceededError'); return set.call(this,k,v) }; Storage.prototype.removeItem = function(k) { if(k.includes('search-history')) throw new DOMException('blocked','SecurityError'); return remove.call(this,k) } } })
  await completed(f, 'quota-memory-new'); await clearInput(f)
  check((await history(f))[0]?.includes('quota-memory-new'), 'write-only storage failure keeps newer memory history instead of resurrecting stale saved rows')
  await f.page.locator('.cra1-header-search__history-clear').click()
  check((await history(f)).length === 0, 'failed persisted removal still clears visible memory history')
  await f.context.close()

  f = await fresh(); await completed(f, 'other-tab-clear'); await clearInput(f)
  await f.input.press('Escape')
  await f.page.evaluate(() => { localStorage.removeItem('cra1-search-history:guest'); dispatchEvent(new StorageEvent('storage', { key: 'cra1-search-history:guest', newValue: null })) })
  await f.open()
  check((await history(f)).length === 0, 'healthy missing storage reflects another tab clear rather than restoring memory cache')
  await f.context.close()

  for (const width of [320, 390, 430, 1023, 1024, 1440, 1920]) {
    f = await fresh({ width }); await completed(f, 'SSH 密钥'); await clearInput(f)
    check((await history(f)).length === 1, width + 'px history is accessible through the existing search entry')
    const box = await f.page.locator('.cra1-header-search__results').boundingBox()
    check(box && box.x >= -1 && box.x + box.width <= width + 1, width + 'px history popup stays in viewport')
    check(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), width + 'px history creates no horizontal page overflow')
    const beforeComposition = requests.length
    await f.input.dispatchEvent('compositionstart'); await f.input.fill('正在组合'); await f.input.press('Enter'); await f.page.waitForTimeout(350)
    check(requests.length === beforeComposition, width + 'px IME composition does not submit or query')
    await f.input.dispatchEvent('compositionend'); await f.page.locator('.cra1-header-search__item').first().waitFor()
    fs.mkdirSync(out, { recursive: true, mode: 0o700 }); await clearInput(f)
    if ([320, 1024, 1440].includes(width)) await f.page.screenshot({ path: path.join(out, 'history-' + width + '.png'), fullPage: true })
    await f.context.close()
  }
  check(errors.length === 0, 'all isolated source/stage scenarios finish without browser exceptions: ' + errors.join('; '))
  fs.mkdirSync(out, { recursive: true, mode: 0o700 })
  const report = { success: true, build: release || 'source', nativeCart: !!nativeCart, checks: checks.length, labels: checks, requests: requests.length, errors, screenshots: out }
  fs.writeFileSync(path.join(out, 'history-review-' + (release || 'source') + (nativeCart ? '-native-cart' : '') + '.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ success: true, build: release || 'source', checks: checks.length, requests: requests.length, screenshots: out }))
} catch (error) {
  fs.mkdirSync(out, { recursive: true, mode: 0o700 })
  fs.writeFileSync(path.join(out, 'history-review-failure.json'), JSON.stringify({ success: false, build: release || 'source', checks, requests: requests.length, errors, error: String(error.stack) }, null, 2))
  throw error
} finally {
  await Promise.all(contexts.map(context => context.close().catch(() => {}))); await browser.close(); await new Promise(resolve => server.close(resolve))
}
