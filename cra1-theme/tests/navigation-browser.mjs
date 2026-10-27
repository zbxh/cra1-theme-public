import fs from 'node:fs'
import path from 'node:path'

const { chromium } = await import(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const origin = process.env.CRA1_BROWSER_ORIGIN
const state = process.env.CRA1_BROWSER_STATE
const output = process.env.CRA1_BROWSER_OUT
if (!origin || !state || !output) throw new Error('Set CRA1_BROWSER_ORIGIN, CRA1_BROWSER_STATE and CRA1_BROWSER_OUT.')
const componentRoot = process.env.CRA1_NATIVE_COMPONENT_ROOT
const result = { checks: [], errors: [], failedAssets: [], blockedWrites: [] }
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 1000 } })
const check = (value, label) => {
  if (!value) throw new Error(label)
  result.checks.push(label)
}
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url())
  if (url.origin === origin && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
    result.blockedWrites.push({ path: url.pathname, method: request.method() })
    return route.fulfill({ json: { status: 403, msg: '只读验收拦截' } })
  }
  const component = url.pathname.match(/\/components\/(asideMenu|topMenu)\/\1\.js$/)
  if (url.origin === origin && componentRoot && component) {
    return route.fulfill({ path: path.join(componentRoot, component[1], component[1] + '.js'), contentType: 'application/javascript' })
  }
  return route.continue()
})
const page = await context.newPage()
page.on('pageerror', error => result.errors.push(error.message))
page.on('response', response => {
  const url = new URL(response.url())
  if (url.origin === origin && response.status() >= 400 && /\.(?:js|css)$/.test(url.pathname)) {
    result.failedAssets.push({ path: url.pathname, status: response.status() })
  }
})
async function expectOpen(open, label) {
  await page.waitForFunction(expected => {
    const button = document.querySelector('.cra1-header__menu-btn')
    const aside = document.querySelector('.cra1-aside')
    return button && aside && button.getAttribute('aria-expanded') === String(expected) && aside.classList.contains('is-open') === expected
  }, open, { timeout: 5000 })
  check(true, label)
}
try {
  for (const [url, width] of [
    ['/home.htm', 1920], ['/home.htm', 1440], ['/home.htm', 768], ['/home.htm', 390],
    ['/productList.htm', 1440], ['/productList.htm', 390],
    ['/cart/goodsList.htm', 1440], ['/cart/goodsList.htm', 390],
  ]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(origin + url, { waitUntil: 'networkidle' })
    check(new URL(page.url()).pathname === url, `member session preserved ${url} ${width}`)
    const button = page.getByRole('button', { name: '切换主导航', exact: true })
    await button.click()
    await expectOpen(true, `navigation opens ${url} ${width}`)
    check(await page.locator('.cra1-aside a[href]').count() > 0, `navigation contains links ${url} ${width}`)
    await page.keyboard.press('Escape')
    await expectOpen(false, `Escape closes navigation and updates button ${url} ${width}`)
    check(await button.evaluate(element => document.activeElement === element), `Escape restores focus ${url} ${width}`)
    check(await page.evaluate(() => document.documentElement.style.overflow !== 'hidden'), `Escape releases scrolling ${url} ${width}`)
    await button.click()
    await expectOpen(true, `navigation reopens after Escape ${url} ${width}`)
    await page.locator('.cra1-aside__overlay').click({ position: { x: width - 8, y: 950 } })
    await expectOpen(false, `overlay closes navigation and updates button ${url} ${width}`)
    await button.click()
    await expectOpen(true, `navigation reopens after overlay ${url} ${width}`)
    await page.setViewportSize({ width: width > 1024 ? 390 : 1440, height: 1000 })
    await expectOpen(false, `resize closes navigation and updates button ${url} ${width}`)
    check(await page.evaluate(() => document.documentElement.style.overflow !== 'hidden'), `resize releases scrolling ${url} ${width}`)
  }
  check(result.errors.length === 0, 'no browser exceptions')
  check(result.failedAssets.length === 0, 'no failed assets')
  check(result.blockedWrites.length === 0, 'no business write requests')
  result.status = 'passed'
} catch (error) {
  result.status = 'failed'
  result.error = error.message
  process.exitCode = 1
} finally {
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 })
  await browser.close()
  console.log(JSON.stringify({ status: result.status, checks: result.checks.length, error: result.error }))
}
