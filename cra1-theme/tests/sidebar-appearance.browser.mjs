/** Actual Vue lifecycle: a first menu opening is full, and explicit width choices persist. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = path.resolve(new URL('../..', import.meta.url).pathname)
const native = process.env.CRA1_NATIVE_REFERENCE_ROOT || root
const stage = process.env.CRA1_RELEASE_STAGE
const release = stage ? JSON.parse(fs.readFileSync(path.join(stage, 'release.json'))).release : null
const component = path.join(stage || root, 'public/clientarea/template/pc/cra1', ...(stage ? ['releases', release] : []), 'components/asideMenu/asideMenu.js')
const shell = stage
  ? path.join(stage, 'public/clientarea/template/pc/cra1/releases', release, '20261012-nav-auth-v1/css/cra1-shell.css')
  : path.join(root, 'public/cra1-shared/theme-sources/member/cra1-shell.css')
const require = createRequire(path.join(root, 'cra1-theme/scripts/package.json'))
const { chromium } = require(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const out = process.env.CRA1_BROWSER_OUT
if (out) fs.mkdirSync(out, { recursive: true })
const checks = [], errors = []
const check = (ok, label) => { assert.ok(ok, label); checks.push(label) }
const snap = (configured) => ({
  appearance: { sidebar_default_open: configured }, nav_shape: 3,
  features: { recharge_open: 1, withdraw_open: 0 }, recent: { enabled: 0 },
  sidebar: [{ id: 'products', name: '产品管理', children: [{ id: 'instances', name: '云服务器', children: [
    { id: 'all', name: '全部实例', url: 'productList.htm' },
    { id: 'pending', name: '待开通', url: 'productList.htm?status=Pending' },
  ] }] }],
})
async function fixture({ configured = 0, preference, delayed = false, denied = false, failed = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  if (denied) await context.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError') } }))
  else if (preference !== undefined) await context.addInitScript(value => localStorage.setItem('cra1_aside_collapsed', value), preference)
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  let releaseSnapshot
  const wait = delayed ? new Promise(resolve => { releaseSnapshot = resolve }) : Promise.resolve()
  await page.route('**/*', async route => {
    const u = new URL(route.request().url())
    if (u.pathname === '/cra1-shared/snapshot.php') {
      await wait
      return route.fulfill({ status: failed ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ status: 200, data: snap(configured) }) })
    }
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><meta charset="UTF-8"><title>菜单演示</title><button id="toggle" onclick="window.dispatchEvent(new Event(\'cra1:toggle-aside\'))">打开主导航</button><div id="root"><aside-menu ref="nav" /></div></html>' })
  })
  async function mount(entry = '/productList.htm') {
    await page.goto('http://theme.invalid' + entry)
    await page.addStyleTag({ content: fs.readFileSync(shell, 'utf8') })
    await page.addStyleTag({ content: 'body{margin:0;background:#f5f6f8;font-family:system-ui}#toggle{margin:8px 20px;height:32px}html{--header-h:48px}' })
    await page.addScriptTag({ content: fs.readFileSync(path.join(native, 'public/clientarea/template/pc/default/js/common/vue.js'), 'utf8') })
    await page.evaluate(() => {
      window.getCommon = () => Promise.resolve({ data: { data: { website_name: '演示控制台' } } })
      window.accountDetail = () => Promise.resolve({ data: { status: 200, data: { account: { id: 1 } } } })
      window.getMenu = () => Promise.resolve({ data: { status: 200, data: { menu: [{ id: 'fallback', name: '系统菜单', url: 'productList.htm' }] } } })
      window.CRA1Shared = { Access: { read: () => Promise.resolve(), canUrl: () => true }, Navigation: { href: n => n.url || '' } }
    })
    await page.addScriptTag({ content: fs.readFileSync(component, 'utf8') })
    await page.evaluate(() => { window.fixture = new Vue({ el: '#root', components: { 'aside-menu': asideMenu } }); window.nav = fixture.$refs.nav })
  }
  await mount()
  return { context, page, mount, releaseSnapshot, width: () => page.locator('.cra1-aside').evaluate(n => n.getBoundingClientRect().width) }
}
try {
  for (const configured of [0, 1, undefined]) {
    const f = await fixture({ configured })
    await f.page.waitForFunction(() => nav.loading === false)
    await f.page.getByRole('button', { name: '打开主导航' }).click()
    check(await f.width() === 860, 'first opening shows full navigation for legacy setting ' + configured)
    check(await f.page.getByText('全部实例', { exact: true }).isVisible(), 'second and third levels are visible immediately ' + configured)
    check(await f.page.evaluate(() => localStorage.getItem('cra1_aside_collapsed')) === null, 'initial opening does not invent a saved preference ' + configured)
    if (out && configured === 0) await f.page.screenshot({ path: path.join(out, 'first-open-1440.png'), fullPage: true })
    await f.mount('/home.htm')
    await f.page.waitForFunction(() => nav.loading === false)
    await f.page.getByRole('button', { name: '打开主导航' }).click()
    check(await f.width() === 860, 'later page also opens full without a manual width choice ' + configured)
    await f.context.close()
  }
  for (const [preference, expected] of [['1', 48], ['0', 860], ['invalid', 860]]) {
    const f = await fixture({ preference })
    await f.page.waitForFunction(() => nav.loading === false)
    await f.page.getByRole('button', { name: '打开主导航' }).click()
    check(await f.width() === expected, 'saved preference is respected or ignored if invalid: ' + preference)
    await f.context.close()
  }
  const f = await fixture({ delayed: true })
  await f.page.getByRole('button', { name: '打开主导航' }).click()
  check(await f.width() === 860, 'opening before snapshot finishes is full')
  await f.page.getByRole('button', { name: '折叠侧边栏', exact: true }).click()
  f.releaseSnapshot()
  await f.page.waitForFunction(() => nav.loading === false)
  check(await f.width() === 48, 'late snapshot preserves a manual collapse made during loading')
  await f.mount('/finance.htm')
  await f.page.waitForFunction(() => nav.loading === false)
  await f.page.getByRole('button', { name: '打开主导航' }).click()
  check(await f.width() === 48, 'manual collapse survives a page reload')
  await f.page.getByRole('button', { name: '展开侧边栏', exact: true }).click()
  check(await f.width() === 860, 'width handle restores the complete panel')
  await f.mount('/plugin/1/index.htm')
  await f.page.waitForFunction(() => nav.loading === false)
  await f.page.getByRole('button', { name: '打开主导航' }).click()
  check(await f.width() === 860, 'manual expansion persists on another shell entry')
  for (const width of [1920, 1440, 1025, 768, 390, 320]) {
    await f.page.setViewportSize({ width, height: 1000 })
    await f.page.waitForFunction(w => nav.viewportW === w, width)
    if (!await f.page.evaluate(() => nav.navOpen)) await f.page.getByRole('button', { name: '打开主导航' }).click()
    check(await f.page.locator('.cra1-primary-item__label').isVisible(), 'primary labels visible at ' + width)
    check(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at ' + width)
    if (width <= 1024) {
      await f.page.getByRole('button', { name: '产品管理', exact: true }).click()
      check(await f.page.getByRole('button', { name: '返回上一级', exact: true }).isVisible(), 'mobile secondary panel remains usable at ' + width)
    }
    if (out && [1920, 768, 390, 320].includes(width)) await f.page.screenshot({ path: path.join(out, 'menu-' + width + '.png'), fullPage: true })
    await f.page.keyboard.press('Escape')
    check(await f.page.evaluate(() => !nav.navOpen && document.documentElement.style.overflow === ''), 'Escape closes and unlocks scrolling at ' + width)
  }
  await f.context.close()
  for (const options of [{ denied: true }, { failed: true }]) {
    const f = await fixture(options)
    await f.page.waitForFunction(() => nav.loading === false)
    await f.page.getByRole('button', { name: '打开主导航' }).click()
    check(await f.width() === 860, 'storage or snapshot unavailable does not collapse the menu: ' + JSON.stringify(options))
    if (options.denied) check(await f.page.getByText('全部实例', { exact: true }).isVisible(), 'disabled storage preserves the configured menu')
    else {
      await f.page.getByRole('button', { name: '产品与服务', exact: true }).click()
      check(await f.page.getByText('系统菜单', { exact: true }).isVisible(), 'failed snapshot retains native menu fallback')
    }
    await f.context.close()
  }
  check(errors.length === 0, 'no unhandled browser errors')
  const report = { status: 'passed', checks, production_writes: 0, release }
  if (out) fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally { await browser.close() }
