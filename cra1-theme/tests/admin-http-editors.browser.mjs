/** Customer editor interactions on an ordinary, non-trustworthy HTTP origin. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const env = JSON.parse(fs.readFileSync(process.env.CRA1_TRANSPORT_ENV))
const account = JSON.parse(fs.readFileSync(process.env.CRA1_TRANSPORT_CREDENTIALS))
const output = process.env.CRA1_HTTP_EDITORS_OUT
assert.ok(output && env.site?.startsWith('/tmp/cra1-'), 'An isolated customer installation is required')
const report = { status: 'running', checks: [], errors: [] }
const browser = await chromium.launch({ args: ['--no-sandbox', '--host-resolver-rules=MAP theme.example.test 127.0.0.1', '--no-proxy-server'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
page.setDefaultTimeout(15000)
page.on('pageerror', error => report.errors.push(error.message))
await context.route('**/*', route => new URL(route.request().url()).origin === env.http_origin ? route.continue() : route.abort())
const check = (ok, label) => { assert.ok(ok, label); report.checks.push(label) }
const editor = async route => {
  await page.goto(`${env.http_origin}/${account.theme_entry}/index.php?r=dashboard#${route}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelector('main') && !/正在读取配置|正在加载配置页/.test(document.querySelector('main').innerText))
}
const revert = async () => {
  const button = page.locator('.workspace-savebar').getByRole('button', { name: /^撤销/ })
  if (await button.isEnabled()) await button.click()
}
try {
  await page.goto(`${env.http_origin}/${account.theme_entry}/index.php?r=login`, { waitUntil: 'networkidle' })
  await page.locator('#authForm [name=username]').fill(account.theme_username)
  await page.locator('#authForm [name=password]').fill(account.theme_password)
  await page.locator('#authSubmit').click()
  await page.waitForFunction(() => !!window.__CRA1_ADMIN__)
  check(await page.evaluate(() => !isSecureContext && typeof crypto.randomUUID !== 'function'), 'real HTTP domain does not provide the secure-context UUID API')
  for (const kind of ['login', 'regist']) {
    await editor('/member/edit/' + kind)
    const before = await page.locator('.cra1-row-content').count()
    await page.getByRole('button', { name: '添加条目', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('条目标题', { exact: true }).fill('HTTP 示例条目')
    await dialog.getByRole('button', { name: '应用到草稿', exact: true }).click()
    check(await page.locator('.cra1-row-content').count() === before + 1, kind + ' introduction can add a draft record on HTTP')
    await revert()
  }
  await editor('/notifications')
  const enabled = page.getByRole('switch', { name: '启用通知', exact: true })
  if (await enabled.getAttribute('aria-checked') !== 'true') await enabled.click()
  const before = await page.locator('.announcement-list > li').count()
  await page.getByRole('button', { name: '添加通知', exact: true }).click()
  await page.getByLabel('通知标题', { exact: true }).fill('HTTP 通知示例')
  await page.getByLabel('简短说明', { exact: true }).fill('验证通知编辑和预览，不保存到正式配置。')
  check(await page.locator('.announcement-list > li').count() === before + 1, 'notification can be created on HTTP')
  await page.locator('.announcement-list > li').last().getByRole('button', { name: '复制通知', exact: true }).click()
  check(await page.locator('.announcement-list > li').count() === before + 2, 'notification can be copied on HTTP')
  await page.getByRole('button', { name: '预览效果', exact: true }).click()
  const frame = page.frameLocator('iframe[title="通知草稿预览"]')
  await frame.getByText('HTTP 通知示例', { exact: true }).first().waitFor()
  check(!(await page.getByRole('dialog').innerText()).includes('页面错误'), 'notification sandbox preview renders on HTTP')
  await page.keyboard.press('Escape')
  await revert()
  check(report.errors.length === 0, 'no browser exceptions while adding, copying or previewing')
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.error = error.message; process.exitCode = 1
  report.previewText = await page.frameLocator('iframe[title="通知草稿预览"]').locator('body').innerText().catch(() => '')
} finally {
  fs.writeFileSync(output, JSON.stringify(report, null, 2)); await browser.close()
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, error: report.error, errors: report.errors }))
}
