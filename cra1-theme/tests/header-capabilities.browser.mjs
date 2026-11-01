import fs from 'node:fs'
import assert from 'node:assert/strict'
const {chromium} = await import(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const source = fs.readFileSync(new URL('../../public/cra1-shared/src/header-actions.js', import.meta.url), 'utf8')
const browser = await chromium.launch({args: ['--no-sandbox']})
try {
  const page = await browser.newPage()
  await page.setContent('<div id="account"></div>')
  await page.evaluate(() => {
    window.features = {ssh: false}
    window.CRA1Shared = {UI: {createPopover: () => ({destroy() {}})}, Avatar: {register() {}, style: () => ({}), letter: () => 'T'}, Runtime: {context: () => ({features}), money: String}}
  })
  await page.addScriptTag({content: source})
  await page.evaluate(() => {window.account = CRA1Shared.HeaderActions.mountAccount(document.querySelector('#account'), {user: {id: 1}})})
  const ssh = page.locator('a[href="/security.htm?tab=ssh"]')
  assert.equal(await ssh.count(), 0)
  await page.evaluate(() => {features.ssh = true; dispatchEvent(new Event('cra1:feature-flags'))})
  assert.equal(await ssh.count(), 1)
  await page.evaluate(() => {features.ssh = false; account.update()})
  assert.equal(await ssh.count(), 0)
  assert.equal(await page.locator('a[href="/security.htm?tab=api"]').count(), 1)
  await page.evaluate(() => {account.destroy(); features.ssh = true; dispatchEvent(new Event('cra1:feature-flags'))})
  assert.equal(await page.locator('#account *').count(), 0)
  console.log(JSON.stringify({status: 'passed', checks: 5}))
} finally {await browser.close()}
