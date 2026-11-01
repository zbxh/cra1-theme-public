import fs from 'node:fs'
import assert from 'node:assert/strict'
const {chromium} = await import(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const source = fs.readFileSync(new URL('../source/member/src/ui/captcha.jsx', import.meta.url), 'utf8')
  .split('export function useCaptcha()')[0].replace(/^import .*$/gm, '')
const browser = await chromium.launch({args: ['--no-sandbox']})
const context = await browser.newContext()
await context.route('**/*', route => {
  const path = new URL(route.request().url()).pathname
  return path === '/provider.js' ? route.fulfill({contentType: 'application/javascript', body: 'window.execution.push(JSON.parse(document.querySelector("[data-role=bootstrap]").textContent).value)'})
    : route.fulfill({contentType: 'text/html', body: '<div id="challenge"></div>'})
})
try {
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('https://fixture.invalid/login.htm')
  await page.addScriptTag({content: source})
  const result = await page.evaluate(async () => {
    window.execution = []
    const host = document.querySelector('#challenge')
    await injectHtml(host, '<script type="application/json" data-role="bootstrap">{"value":"bootstrap"}</script><script src="/provider.js" data-provider="fixture"></script><script>execution.push("after provider")</script>', () => true)
    return {execution, data: host.querySelector('[data-role=bootstrap]').type, attribute: host.querySelector('[src="/provider.js"]').getAttribute('data-provider')}
  })
  assert.deepEqual(result, {execution: ['bootstrap', 'after provider'], data: 'application/json', attribute: 'fixture'})
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({status: 'passed', checks: 4}))
} finally {await browser.close()}
