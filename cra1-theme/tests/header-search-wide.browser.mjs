/** Loopback-only desktop overlay and responsive search regression. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(process.env.CRA1_SOURCE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'))
const out = process.env.CRA1_BROWSER_OUT && path.resolve(process.env.CRA1_BROWSER_OUT)
if (!out || out === root || out.startsWith(root + path.sep)) throw Error('Set CRA1_BROWSER_OUT outside the source tree')
const stage = process.env.CRA1_REVIEW_STAGE && path.resolve(process.env.CRA1_REVIEW_STAGE)
const nativeBundle = process.env.CRA1_REVIEW_NATIVE_CART === '1'
const { chromium } = createRequire(path.join(root, 'cra1-theme/scripts/package.json'))('playwright')
const read = name => fs.readFileSync(path.join(root, 'public/cra1-shared/src', name), 'utf8')
const release = JSON.parse(fs.readFileSync(stage ? path.join(stage, 'release.json') : path.join(root, 'cra1-theme/release.json'), 'utf8')).release
const compiled = kind => fs.readFileSync(path.join(stage, 'public/cra1-shared/releases', release, (nativeBundle ? 'native-cart-navigation.' : 'cra1-shared.') + kind), 'utf8')
const js = stage ? compiled('js') : ['request.js', 'ui.js', 'notification-session.js', 'search-match.js', 'header-search.js'].map(read).join('\n')
const css = stage ? compiled('css') : ['tokens.css', 'components.css', 'header-search.css', 'header-actions.css'].map(read).join('\n')
const shell = fs.readFileSync(stage ? path.join(stage, 'public/clientarea/template/pc/cra1/releases', release, '20261012-nav-auth-v1/css/cra1-shell.css') : path.join(root, 'public/cra1-shared/theme-sources/member/cra1-shell.css'), 'utf8')
const current = JSON.parse(fs.readFileSync(path.join(root, 'cra1-theme/release.json'), 'utf8'))
const websiteCss = fs.readFileSync(path.join(stage || root, 'public/web/cra1/releases', stage ? release : current.release, 'app.css'), 'utf8')
const checks = [], errors = [], requests = [], screenshots = []
const check = (ok, label) => { assert.ok(ok, label); checks.push(label) }
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const longText = '云服务器配置说明：支持 Linux 和 Windows，多地域、弹性带宽、自动备份及独立安全策略。'.repeat(6)
const fixtures = {
  product: { list: [{ id: 11, name: '云服务器 ' + '超长标题'.repeat(30), description: '<p>云服务 <strong>弹性带宽</strong> &amp; 自动备份</p><script>window.__injected = true</script><img src=x onerror="window.__injected=true">', product_group_name_first: '基础设施', product_group_name_second: '云主机', price: '39.00', cycle: '月付' }], count: 1 },
  news: { list: [{ id: 21, title: '云服务更新计划', excerpt: longText + ' &lt;img src=x onerror=alert(1)&gt;' }], count: 1 },
  announcement: { list: [{ id: 31, title: '云平台维护通知', create_time: 1794398400 }], count: 1 },
  help: { list: [{ id: 41, name: '云主机帮助', helps: [{ id: 42, title: '云服务器快速开始', search: true }] }] },
}
function markup(kind) {
  const actions = '<div id="search" class="cra1-header-search"></div><button id="support" class="cra1-header__icon-btn" type="button" aria-label="客服">?</button><a id="docs" class="cra1-header-docs" href="#docs">文档</a><button id="avatar" class="cra1-header__icon-btn" type="button" aria-label="账户">人</button>'
  if (kind === 'website') return '<header class="cra1-site-header fixed inset-x-0 top-0 z-50 bg-white"><div id="header-area" class="cra1-site-header__row flex h-16 w-full items-center gap-2 px-4 md:px-6 lg:px-8"><div class="cra1-site-header__brand flex min-w-0 items-center gap-1.5 md:gap-3"><a id="brand" class="flex min-h-11 min-w-0 items-center gap-2" href="#home"><span class="flex h-5 w-5 shrink-0 items-center justify-center">云</span><span class="truncate">示例网站</span></a></div><nav id="navigation" class="cra1-primary-nav hidden items-center gap-0.5 lg:flex" aria-label="主导航"><a class="nav-link" href="#products">产品服务</a><a class="nav-link" href="#pricing">价格方案</a><a class="nav-link" href="#help">文档中心</a></nav><div class="cra1-site-header__actions ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">' + actions + '</div></div></header>'
  return '<header id="header-area" class="cra1-header"><div id="navigation" class="cra1-header__left"><button id="menu" class="cra1-header__icon-btn" type="button" aria-label="切换主导航">☰</button><a id="brand" class="cra1-header__brand cra1-header__brand--text" href="#home">云</a><span class="cra1-header__sep"></span><nav class="cra1-breadcrumb" aria-label="面包屑"><a class="cra1-breadcrumb__root" href="#home">控制台</a><span class="cra1-breadcrumb__sep">/</span><span class="cra1-breadcrumb__current">云服务器管理页面</span></nav></div><div class="cra1-header__right">' + actions + '</div></header>'
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://fixture.invalid')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
  const assets = { '/bundle.js': ['text/javascript', js], '/shared.css': ['text/css', css], '/shell.css': ['text/css', shell], '/website.css': ['text/css', websiteCss] }
  if (assets[u.pathname]) { const [type, body] = assets[u.pathname]; res.setHeader('Content-Type', type); res.end(body); return }
  if (u.pathname.startsWith('/console/')) {
    const key = u.pathname.split('/').at(-1); requests.push({ key, keywords: u.searchParams.get('keywords') })
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ status: 200, data: fixtures[key] || { list: [], count: 0 } })); return
  }
  const kind = u.searchParams.get('kind') || 'member'
  res.setHeader('Content-Type', 'text/html;charset=utf-8')
  res.end(`<!doctype html><html data-cra1-theme="${kind === 'website' ? 'website' : 'member'}"${kind === 'native' ? ' data-cra1-native-cart' : ''}><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${kind === 'website' ? 'website' : 'shell'}.css"><link rel="stylesheet" href="/shared.css"><style>*{box-sizing:border-box}body{margin:0;background:#f9fbfb;font:14px system-ui}[hidden]{display:none!important}main{padding:100px 24px}#outside{padding:12px}.cra1-header-docs{white-space:nowrap}.cra1-header__brand{background:transparent}.nav-link{white-space:nowrap}#avatar{margin-left:4px}</style>${markup(kind)}<main><button id="outside" type="button">页面其他区域</button><div id="native-controls"><input value="2" aria-label="原生模块数量"><button id="native-action">原生模块按钮</button></div></main><script src="/bundle.js"></script><script>window.fixtureClicks={};document.querySelectorAll('#support,#avatar,#docs,#navigation a,#native-action').forEach(node=>node.addEventListener('click',()=>fixtureClicks[node.id||node.textContent]=(fixtureClicks[node.id||node.textContent]||0)+1));localStorage.setItem('cra1-search-history:guest',JSON.stringify(['云主机','SSH 密钥','API key','带宽','备份','帮助','通知']));window.searchComponent=CRA1Shared.HeaderSearch.mount(document.getElementById('search'),{context:${JSON.stringify(kind === 'website' ? 'website' : 'member')},getSearchOptions:()=>({context:'website',sources:[{key:'products',path:'product',label:'订购商品'},{key:'news',path:'news',label:'新闻文章'},{key:'announcement',path:'announcement',label:'公告'},{key:'help',path:'help',label:'帮助文档'}]})});</script></html>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({ args: ['--no-sandbox'] })
let context
const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom } }
async function bounds(page) {
  return page.evaluate(`(() => {const box=${box.toString()};return Object.fromEntries(['search','header-area','navigation','support','avatar','brand'].map(id=>[id,box(document.getElementById(id))]));})()`)
}
function stationary(before, after, label) {
  for (const key of ['search', 'header-area', 'navigation', 'support', 'avatar', 'brand']) {
    check(['x', 'y', 'width', 'height'].every(k => Math.abs(before[key][k] - after[key][k]) < 1.1), label + ' preserves ' + key + ' geometry')
  }
}
async function aligned(page, label) {
  const state = await page.evaluate(() => {
    const f = document.querySelector('form.cra1-header-search__form').getBoundingClientRect(), r = document.querySelector('.cra1-header-search__results')?.getBoundingClientRect()
    return { left: f.left, right: f.right, width: f.width, same: !!r && Math.abs(r.left - f.left) < 1.1 && Math.abs(r.right - f.right) < 1.1, fits: f.left >= 10 && f.right <= innerWidth - 10 && (!r || r.bottom <= innerHeight + 1), horizontal: document.documentElement.scrollWidth <= innerWidth + 1 }
  })
  check(state.same, label + ' aligns result and form edges')
  check(state.fits && state.horizontal, label + ' fits viewport without horizontal scrolling')
  return state
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); screenshots.push(name + '.png')
}
async function fresh(kind, width) {
  context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message))
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await page.goto(origin + '/fixture?kind=' + kind)
  return { page, input: page.getByRole('combobox') }
}
async function nativeControls(page) {
  return page.locator('#native-controls').evaluate(node => {
    const r = node.getBoundingClientRect(), input = node.querySelector('input'), button = node.querySelector('button')
    return { width: r.width, height: r.height, input: input.value, background: getComputedStyle(button).backgroundColor, font: getComputedStyle(button).fontSize, border: getComputedStyle(input).border }
  })
}
const kinds = nativeBundle ? ['native'] : ['website', 'member', 'native']
try {
  for (const kind of kinds) for (const width of [1920, 1440, 1024]) {
    const { page, input } = await fresh(kind, width), label = kind + ' ' + width
    const before = await bounds(page), controlsBefore = await nativeControls(page), readsBefore = requests.length
    await input.focus()
    await page.locator('.cra1-header-search__history-item').nth(6).waitFor()
    const frames = await page.evaluate(async () => {
      const rows = []
      for (let i = 0; i < 18; i++) { await new Promise(requestAnimationFrame); const f = document.querySelector('form').getBoundingClientRect(), r = document.querySelector('.cra1-header-search__results').getBoundingClientRect(); rows.push(Math.abs(f.left - r.left) < 1.1 && Math.abs(f.right - r.right) < 1.1) }
      return rows
    })
    check(frames.every(Boolean), label + ' keeps history aligned throughout expansion animation')
    const state = await aligned(page, label + ' history')
    check(state.width > before['header-area'].width * .5, label + ' focused input covers more than half its header')
    stationary(before, await bounds(page), label + ' expansion')
    check(await page.locator('.cra1-header-search__history-item').count() === 7 && requests.length === readsBefore, label + ' displays seven history items without extra requests')
    const hit = await page.evaluate(() => { const f = document.querySelector('form').getBoundingClientRect(); const node = document.elementFromPoint(f.left + 8, f.top + f.height / 2); return !!node?.closest('.cra1-header-search__panel') })
    check(hit, label + ' overlay receives pointer input above covered navigation')
    await page.locator('#support').click()
    check(await page.evaluate(() => fixtureClicks.support === 1), label + ' leaves the adjacent support action clickable')
    check(await input.getAttribute('aria-expanded') === 'false', label + ' action click dismisses history')
    await page.waitForTimeout(240)
    stationary(before, await bounds(page), label + ' dismissal')
    await input.focus(); await input.fill('云')
    await page.locator('.cra1-header-search__item').nth(3).waitFor()
    await page.waitForFunction(() => document.querySelector('[aria-busy="false"]'))
    await aligned(page, label + ' details')
    check(await page.locator('.cra1-header-search__item').count() === 4, label + ' preserves all four source results')
    check(await page.locator('.cra1-header-search__item-summary').count() >= 2, label + ' displays existing product and article summaries')
    check(await page.locator('.cra1-header-search__results img,.cra1-header-search__results script').count() === 0 && !await page.evaluate(() => window.__injected), label + ' renders markup and encoded entities without executing HTML')
    const colors = await page.evaluate(() => {
      const summary = document.querySelector('.cra1-header-search__item-summary mark'), title = document.querySelector('.cra1-header-search__item-title mark')
      return summary && title && getComputedStyle(summary).backgroundColor === getComputedStyle(title).backgroundColor && getComputedStyle(summary).backgroundColor !== 'rgb(255, 255, 0)'
    })
    check(colors, label + ' summary highlighting shares the theme title palette')
    const summary = await page.locator('.cra1-header-search__item-summary').first().textContent()
    check(summary.includes('云服务 弹性带宽 & 自动备份') && !summary.includes('<') && !summary.includes('__injected'), label + ' extracts readable text and entities from the public HTML description')
    const queryCount = requests.length
    await input.press('Escape'); await page.waitForTimeout(240)
    check(await input.isVisible() && await input.inputValue() === '云' && await input.getAttribute('aria-expanded') === 'false', label + ' Escape closes results while retaining the query')
    await page.locator('#outside').focus(); await page.waitForTimeout(240)
    check(Math.abs((await page.locator('form').boundingBox()).width - before.search.width) < 1.1, label + ' blur restores compact input width')
    await input.focus(); await page.locator('.cra1-header-search__item').first().waitFor()
    await page.waitForTimeout(240)
    const normalBg = await page.locator('.cra1-header-search__search-btn').evaluate(n => getComputedStyle(n).backgroundColor)
    await page.locator('.cra1-header-search__search-btn').hover()
    check(await page.locator('.cra1-header-search__search-btn').evaluate(n => getComputedStyle(n).backgroundColor) === normalBg, label + ' search icon hover leaves background unchanged')
    // A sibling may change width when delayed authentication or locale content arrives.
    await page.locator('#avatar').evaluate(n => { n.style.width = '96px'; n.textContent = '账户操作' })
    await page.waitForTimeout(260); await aligned(page, label + ' delayed sibling resize')
    const postResize = await bounds(page)
    check((await page.locator('form').boundingBox()).width > postResize['header-area'].width * .5, label + ' recomputes wide overlay after delayed sibling resize')
    const afterReopen = requests.length
    check(afterReopen === queryCount + 4, label + ' reopening only reissues the four existing public queries')
    check(JSON.stringify(await nativeControls(page)) === JSON.stringify(controlsBefore), label + ' overlay and detailed results leave native module controls unchanged')
    await input.press('Escape'); await page.locator('#outside').focus(); await page.waitForTimeout(240)
    await page.locator('#native-action').click()
    check(await page.evaluate(() => fixtureClicks['native-action'] === 1), label + ' native module event handlers remain intact')
    await input.focus(); await page.locator('.cra1-header-search__item').first().waitFor(); await page.waitForTimeout(240)
    await screenshot(page, kind + '-details-' + width)
    await page.setViewportSize({ width: 1023, height: 900 }); await page.waitForTimeout(120)
    check(await page.locator('#search > button').isVisible() && await input.isHidden(), label + ' focused desktop resize restores narrow trigger')
    await page.setViewportSize({ width: 1024, height: 900 }); await page.waitForTimeout(120)
    await input.focus(); await page.locator('.cra1-header-search__item').first().waitFor(); await page.waitForTimeout(240)
    await aligned(page, label + ' 1023/1024 transition')
    await context.close(); context = null
  }
  for (const kind of kinds) for (const width of [320, 390, 430]) {
    const { page, input } = await fresh(kind, width), label = kind + ' mobile ' + width
    check(await input.isHidden(), label + ' starts with existing icon entry')
    await page.getByRole('button', { name: '搜索产品与文章', exact: true }).click()
    await page.locator('.cra1-header-search__history-item').nth(6).waitFor()
    const panel = await page.locator('.cra1-header-search__panel').boundingBox(), form = await page.locator('form').boundingBox()
    check(Math.abs(panel.x - 12) < 1.1 && Math.abs(panel.width - (width - 24)) < 1.1 && Math.abs(form.height - 44) < 1.1, label + ' retains 12px insets and 44px form height')
    await aligned(page, label + ' history')
    await input.fill('云'); await page.locator('.cra1-header-search__item').nth(3).waitFor(); await aligned(page, label + ' details')
    await screenshot(page, kind + '-mobile-' + width)
    await input.press('Escape')
    check(await input.isHidden() && await page.getByRole('button', { name: '搜索产品与文章', exact: true }).evaluate(n => n === document.activeElement), label + ' Escape retains original close and focus return')
    await context.close(); context = null
  }
  check(errors.length === 0, 'no uncaught browser exceptions')
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ status: 'passed', checks, screenshots, requests: requests.length, errors }, null, 2))
  console.log(JSON.stringify({ status: 'passed', checks: checks.length, screenshots: screenshots.length, requests: requests.length }))
} catch (error) {
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ status: 'failed', error: error.message, checks, screenshots, errors }, null, 2))
  throw error
} finally { if (context) await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)) }
