/** Disposable native-contract search interactions; never connects to a business site. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'

const root = process.env.CRA1_SOURCE_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const out = process.env.CRA1_BROWSER_OUT
if (!out || path.resolve(out).startsWith(root + path.sep)) throw Error('Set CRA1_BROWSER_OUT outside the source tree')
const { chromium } = await import(process.env.CRA1_PLAYWRIGHT_MODULE)
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const source = name => fs.readFileSync(path.join(root, 'public/cra1-shared/src', name), 'utf8')
const stage = process.env.CRA1_REVIEW_STAGE
const release = stage ? JSON.parse(fs.readFileSync(path.join(stage, 'release.json'))).release : null
const bundle = stage ? fs.readFileSync(path.join(stage, 'public/cra1-shared/releases', release, 'cra1-shared.js')) : ['request.js', 'ui.js', 'notification-session.js', 'search-match.js', 'header-search.js'].map(source).join('\n')
const css = stage ? fs.readFileSync(path.join(stage, 'public/cra1-shared/releases', release, 'cra1-shared.css')) : ['tokens.css', 'components.css', 'header-search.css'].map(source).join('\n')
const reads = [], errors = [], checks = [], screenshots = []
let scenario = {}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture.invalid')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
  if (url.pathname === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return }
  if (url.pathname === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); return }
  if (url.pathname.startsWith('/console/')) {
    reads.push(url.pathname)
    const kind = url.pathname.endsWith('/member/search') ? 'hosts' : url.pathname.split('/').at(-1)
    const delay = scenario.delay?.[kind] || 0
    const fail = scenario.fail?.includes(kind)
    setTimeout(() => {
      if (res.destroyed) return
      res.setHeader('Content-Type', 'application/json')
      const data = kind === 'hosts'
        ? { list: [{ id: 5, product_name: '云主机示例', name: '实例示例', status: 'Active', billing_cycle: 'onetime' }], count: 1, overview: { server_time: 1794398400, renewal_enabled: false } }
        : { list: [{ id: 8, name: '云商品示例', title: kind === 'news' ? '云文章示例' : undefined }], count: 1 }
      res.end(JSON.stringify(kind === 'hosts' && scenario.unauthorized ? {status:401} : fail ? { status: 503, msg: 'private-diagnostics' } : { status: 200, data }))
    }, delay)
    return
  }
  res.setHeader('Content-Type', 'text/html;charset=utf-8')
  if(url.pathname==='/login.htm'){res.end('<!doctype html><title>重新登录</title>登录页');return}
  res.end(`<!doctype html><html data-cra1-theme="${scenario.protected ? 'member' : 'website'}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:#f9fbfb;color:#22292b}header{height:72px;padding:12px;box-sizing:border-box;display:flex;justify-content:flex-end}[hidden]{display:none!important}</style><header><div id="search" class="cra1-header-search"></div></header><script src="/bundle.js"></script><script>localStorage.${scenario.anonymous ? "removeItem('jwt')" : "setItem('jwt','fixture-session')"};window.searchComponent=CRA1Shared.HeaderSearch.mount(document.getElementById('search'),{getSearchOptions:()=>({context:'website',sources:[{key:'hosts',path:'host',label:'我的产品'},{key:'products',path:'product',label:'订购商品'},{key:'news',path:'news',label:'新闻文章'}]})});</script></html>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const check = (value, label) => { assert.ok(value, label); checks.push(label) }
async function fresh({ width = 1440, activate = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await page.goto(origin + (scenario.protected ? '/home.htm' : '/search.html'))
  const input = page.getByRole('combobox')
  if (activate) {
    if (width >= 1024) await input.focus()
    else await page.getByRole('button', { name: '搜索产品与文章', exact: true }).click()
  }
  return { page, context, input }
}
try {
  scenario = { delay: { hosts: 900, news: 1200 } }
  let { page, context, input } = await fresh({ activate: false })
  check(await input.isVisible() && await page.locator('#search > button').isHidden(), '1440px exposes a persistent editable input with the old search trigger hidden')
  check(await page.getByRole('option').count() === 0 && await input.getAttribute('aria-expanded') === 'false', 'the persistent blank input starts without an empty results popup')
  await input.focus()
  check(await input.evaluate(node => node === document.activeElement), 'the persistent desktop field accepts focus directly')
  await input.fill('云')
  await page.getByRole('option').filter({ hasText: '云商品示例' }).waitFor()
  check(await page.getByRole('option').count() === 1, 'fast catalog results render before the slower member and article sources')
  await input.press('ArrowDown')
  check(await page.locator('.is-active[role=option]').textContent() === '云商品示例', 'keyboard can select an early result while other sources are pending')
  await page.getByRole('option').filter({ hasText: '云文章示例' }).waitFor()
  check(await page.locator('.is-active[role=option]').textContent() === '云商品示例', 'a new group inserted before the selection keeps the same selected result')
  check(await page.getByRole('option').evaluateAll(nodes => new Set(nodes.map(node => node.id)).size === nodes.length), 'progressive results keep unique option IDs')
  check(await input.evaluate(node => document.getElementById(node.getAttribute('aria-activedescendant'))?.classList.contains('is-active')), 'aria active descendant follows the selected result after insertion')
  await input.press('Escape')
  check(await input.evaluate(node => node === document.activeElement), 'desktop Escape leaves focus on the persistent search input')
  check(await input.isVisible() && await input.inputValue() === '云' && await page.getByRole('option').count() === 0, 'desktop Escape dismisses results while preserving the field and query')
  check(await input.getAttribute('aria-expanded') === 'false' && await input.getAttribute('aria-activedescendant') === null, 'desktop dismissal clears the expanded and active-option aria state')
  await input.press('ArrowDown')
  await page.getByRole('option').filter({ hasText: '云文章示例' }).waitFor()
  check(await input.evaluate(node => node === document.activeElement) && await input.getAttribute('aria-expanded') === 'true', 'ArrowDown reopens desktop results without moving input focus')
  await context.close()

  scenario = {}
  ;({ page, context, input } = await fresh({ width: 1023, activate: false }))
  const searchTrigger = page.getByRole('button', { name: '搜索产品与文章', exact: true })
  check(await searchTrigger.isVisible() && !(await page.locator('#search').evaluate(node => node.classList.contains('is-persistent'))), '1023px retains the existing search trigger and expandable panel')
  await searchTrigger.click()
  for (const activation of ['ArrowDown', 'Enter', 'Space', 'click']) {
    await input.press('Escape')
    check(await searchTrigger.evaluate(node => node === document.activeElement), '1023px Escape restores focus to the search trigger before ' + activation + ' activation')
    await searchTrigger.focus()
    if (activation === 'click') await searchTrigger.click()
    else await searchTrigger.press(activation)
    await page.waitForFunction(() => document.activeElement === document.querySelector('.cra1-header-search__input'))
    // The next frame observes the popover's intentional async initial focus.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    check(await input.evaluate(node => node === document.activeElement), activation + ' activation leaves focus on the editable search field')
    await input.press('ControlOrMeta+A')
    await input.press('Backspace')
    await page.keyboard.type('cloud')
    check(await input.inputValue() === 'cloud', activation + ' activation accepts typing without an extra click')
  }
  await page.evaluate(() => {
    searchComponent.close(false)
    const host = document.createElement('div'), trigger = document.createElement('button'), panel = document.createElement('div')
    trigger.textContent = '普通菜单'
    panel.innerHTML = '<button id="default-first">第一项</button><input id="default-second">'
    host.id = 'default-focus-menu'; host.append(trigger, panel); document.body.append(host)
    window.defaultFocusPopover = CRA1Shared.UI.createPopover({ root: host, trigger, panel })
  })
  await page.getByRole('button', { name: '普通菜单', exact: true }).focus()
  await page.getByRole('button', { name: '普通菜单', exact: true }).press('ArrowDown')
  await page.waitForFunction(() => document.activeElement === document.getElementById('default-first'))
  check(await page.locator('#default-first').evaluate(node => node === document.activeElement), 'a normal popover without initialFocus retains first-item keyboard focus')
  await context.close()

  scenario = { fail: ['news'] }
  ;({ page, context, input } = await fresh())
  await input.fill('云')
  await page.getByText('部分内容暂时无法搜索', { exact: true }).waitFor()
  check(await page.getByRole('option').count() === 2, 'a failed article provider leaves valid member and catalog results visible')
  check(!(await page.content()).includes('private-diagnostics'), 'source errors do not reveal internal response details')
  await page.screenshot({path:path.join(out,'partial-failure-1440.png'),fullPage:true});screenshots.push('partial-failure-1440.png')
  scenario = {}
  await page.getByRole('button', { name: '重试搜索', exact: true }).click()
  await page.getByRole('option').filter({ hasText: '云文章示例' }).waitFor()
  check(await page.getByRole('button', { name: '重试搜索', exact: true }).count() === 0, 'direct retry recovers failed content without a page refresh')
  await context.close()

  scenario = { fail: ['hosts', 'product', 'news'] }
  ;({ page, context, input } = await fresh())
  await input.fill('云')
  await page.getByText('搜索暂时不可用，请重试', { exact: true }).waitFor()
  check(await page.getByRole('option').count() === 0, 'all-source failure stays distinct from a successful no-match result')
  check(await page.getByRole('button', { name: '重试搜索', exact: true }).isVisible(), 'complete failure offers an actionable retry')
  await page.screenshot({path:path.join(out,'complete-failure-1440.png'),fullPage:true});screenshots.push('complete-failure-1440.png')
  scenario = {}
  await page.getByRole('button', { name: '重试搜索', exact: true }).click()
  await page.getByRole('option').filter({ hasText: '云文章示例' }).waitFor()
  check(await page.getByRole('option').count() === 3, 'the same retry recovers an all-source outage')
  await context.close()

  scenario = {}
  ;({ page, context, input } = await fresh())
  const before = reads.length
  await input.dispatchEvent('compositionstart')
  await input.fill('云')
  await page.waitForTimeout(400)
  check(reads.length === before, 'IME composition does not submit partial Chinese input')
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 })
  check(reads.length === before, 'IME Enter does not trigger a search prematurely')
  await input.dispatchEvent('compositionend')
  await page.getByRole('option').filter({ hasText: '云文章示例' }).waitFor()
  check(reads.length === before + 3, 'a finished IME composition issues one query per available source')
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(80)
    await page.evaluate(() => searchComponent.open())
    await input.fill('云')
    await page.getByRole('option').filter({ hasText: '云文章示例' }).waitFor()
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && Array.from(document.querySelectorAll('.cra1-header-search__form,.cra1-header-search__results')).every(node => {const rect=node.getBoundingClientRect();return rect.left>=-1&&rect.right<=innerWidth+1})), 'search controls and results fit ' + width + 'px')
    const file = 'search-results-' + width + '.png'
    await page.screenshot({ path: path.join(out, file), fullPage: true })
    screenshots.push(file)
  }
  await page.getByRole('button', { name: '清空搜索', exact: true }).click()
  check(await input.inputValue() === '' && await page.locator('.cra1-header-search__item').count() === 0, 'clear removes the query and every search result')
  check(await page.locator('.cra1-header-search__history-item').count() === 1, 'clearing a query offers its deduplicated history after responsive breakpoint changes')
  await context.close()
  scenario = {}
  ;({ page, context, input } = await fresh())
  await input.fill('云');await page.getByRole('option').filter({hasText:'云文章示例'}).waitFor()
  await page.evaluate(() => {
    window.fixturePopovers={}
    window.mountFixturePopover=(name,group='header')=>{
      const host=document.createElement('div'),trigger=document.createElement('button'),panel=document.createElement('div'),editable=document.createElement('input')
      host.id=name;host.style.cssText='position:fixed;left:20px;top:150px;z-index:200;background:white'
      trigger.type='button';trigger.textContent=name;panel.append(editable);host.append(trigger,panel);document.body.append(host)
      const api=CRA1Shared.UI.createPopover({root:host,trigger,panel,hover:true,group})
      fixturePopovers[name]={host,trigger,panel,editable,api};return fixturePopovers[name]
    }
    mountFixturePopover('hover-peer')
  })
  await page.locator('#hover-peer > button').hover()
  check(await page.evaluate(()=>searchComponent.isOpen&&!fixturePopovers['hover-peer'].api.isOpen&&document.activeElement===document.querySelector('.cra1-header-search__input')), 'hover cannot steal focus from an editable field in another open panel in the same group')
  await page.locator('#hover-peer > button').click()
  check(await page.evaluate(()=>!searchComponent.isOpen&&fixturePopovers['hover-peer'].api.isOpen), 'explicit click still switches from an editing search to the other panel')
  await page.evaluate(()=>searchComponent.open())
  await page.locator('#hover-peer > button').focus();await page.locator('#hover-peer > button').press('ArrowDown')
  await page.waitForFunction(()=>!searchComponent.isOpen&&fixturePopovers['hover-peer'].api.isOpen&&document.activeElement===fixturePopovers['hover-peer'].editable)
  check(await page.evaluate(()=>!searchComponent.isOpen&&fixturePopovers['hover-peer'].api.isOpen&&document.activeElement===fixturePopovers['hover-peer'].editable), 'explicit keyboard activation still switches panels and focuses the next editable field')
  await page.evaluate(()=>{fixturePopovers['hover-peer'].api.close(false);document.activeElement.blur()})
  await page.mouse.move(500,500);await page.locator('#hover-peer > button').hover()
  check(await page.evaluate(()=>fixturePopovers['hover-peer'].api.isOpen), 'ordinary hover remains available when no peer panel is being edited')
  await page.evaluate(()=>{fixturePopovers['hover-peer'].api.close(false);searchComponent.open();mountFixturePopover('other-group','independent').host.style.top='220px'})
  await page.locator('#other-group > button').hover()
  check(await page.evaluate(()=>searchComponent.isOpen&&fixturePopovers['other-group'].api.isOpen), 'an editable panel in a different group does not suppress ordinary hover')
  await page.evaluate(()=>{fixturePopovers['other-group'].api.destroy();fixturePopovers['other-group'].host.remove();fixturePopovers['hover-peer'].api.destroy();fixturePopovers['hover-peer'].host.remove();searchComponent.destroy();mountFixturePopover('after-destroy')})
  await page.mouse.move(500,500);await page.locator('#after-destroy > button').hover()
  check(await page.evaluate(()=>fixturePopovers['after-destroy'].api.isOpen), 'destroying an open editable panel leaves no stale group lock')
  await context.close()

  for (const protectedPage of [false, true]) {
    scenario = { unauthorized: true, protected: protectedPage }
    ;({ page, context, input } = await fresh())
    await input.fill('云')
    if(protectedPage) {
      await page.waitForURL(origin + '/login.htm')
      check(await page.title() === '重新登录', 'expired member search redirects a protected member page to login')
    } else {
      await page.waitForFunction(() => !localStorage.getItem('jwt'))
      check(page.url() === origin + '/search.html', 'an expired optional member search preserves the public website page')
      check(await page.getByRole('option').count() === 0, 'public-session expiry purges all previous private results')
    }
    await context.close()
  }

  scenario = { delay: { hosts: 700, product: 900, news: 1000 } }
  ;({ page, context, input } = await fresh())
  const privateRead = page.waitForRequest(request => new URL(request.url()).pathname.endsWith('/member/search'))
  await input.fill('云'); await privateRead
  await page.evaluate(() => localStorage.setItem('jwt', 'different-session'))
  await page.waitForTimeout(1200)
  check(await page.getByRole('option').count() === 0, 'late responses after an account change cannot repopulate the previous search')
  check(await page.locator('.cra1-header-search__results').count() === 0, 'an account change closes and removes the previous results panel')
  await context.close()

  scenario = { anonymous: true, unauthorized: true }
  ;({ page, context, input } = await fresh())
  const guestReads = reads.length
  await input.fill('云')
  await page.getByRole('option').filter({ hasText: '云文章示例' }).waitFor()
  check(!reads.slice(guestReads).some(path => path.endsWith('/member/search')), 'anonymous explicit member sources cause no protected search request')
  check(await page.getByRole('option').count() === 2 && await page.evaluate(() => searchComponent.isOpen), 'guest search preserves public results without a member 401 closing the input')
  check(await page.locator('.cra1-header-search__error').count() === 0, 'excluded private sources do not display a guest error')
  const directReads = reads.length
  const direct = await page.evaluate(() => CRA1Shared.HeaderSearch.search({ keywords: '云', includeHosts: true, capabilities: {} }))
  check(!reads.slice(directReads).some(path => path.endsWith('/member/search')) && direct.groups.every(group => group.key !== 'hosts'), 'anonymous direct includeHosts does not request or return private results')
  const onlyPrivateReads = reads.length
  const onlyPrivate = await page.evaluate(() => CRA1Shared.HeaderSearch.search({ keywords: '云', sources: [{ key: 'hosts', path: 'host', label: '我的产品' }] }))
  check(reads.length === onlyPrivateReads && onlyPrivate.groups.length === 0 && onlyPrivate.errors.length === 0, 'an anonymous search with only a private source settles empty without requests or errors')
  await page.evaluate(() => localStorage.setItem('jwt', 'new-member-session'))
  await page.waitForFunction(() => !searchComponent.isOpen)
  await input.click()
  scenario = {}
  await input.fill('云')
  await page.getByRole('option').filter({ hasText: '云主机示例' }).waitFor()
  check(await page.getByRole('option').count() === 3, 'logging in enables member products without retaining the guest source filter')
  await context.close()
  check(errors.length === 0, 'no browser script errors')
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ status: 'passed', checks, errors, screenshots }, null, 2))
  process.stdout.write(JSON.stringify({ status: 'passed', checks: checks.length, errors }) + '\n')
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
