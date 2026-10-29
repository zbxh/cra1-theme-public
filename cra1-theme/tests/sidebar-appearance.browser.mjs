/** Real Vue observes delayed appearance settings and preserves local choices. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = path.resolve(new URL('../..', import.meta.url).pathname)
const require = createRequire(path.join(root, 'cra1-theme/scripts/package.json'))
const { chromium } = require(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const native = process.env.CRA1_NATIVE_REFERENCE_ROOT || root
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const checks = []
try {
  const page = await browser.newPage()
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }))
  await page.goto('http://theme.invalid/')
  await page.addScriptTag({ content: fs.readFileSync(path.join(native, 'public/clientarea/template/pc/default/js/common/vue.js'), 'utf8') })
  await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'public/clientarea/template/pc/cra1/components/asideMenu/asideMenu.js'), 'utf8') })
  for (const [configured, local, expected] of [[1, null, false], [0, null, true], [1, '1', true], [0, '0', false]]) {
    const state = await page.evaluate(async ({ configured, local }) => {
      localStorage.removeItem('cra1_aside_collapsed')
      if (local !== null) localStorage.setItem('cra1_aside_collapsed', local)
      const vm = new Vue({ data: { collapsed: true }, methods: { applyAsideDefault: asideMenu.methods.applyAsideDefault } })
      vm.applyAsideDefault(undefined)
      await Promise.resolve()
      vm.applyAsideDefault({ appearance: { sidebar_default_open: configured } })
      await Vue.nextTick()
      const collapsed = vm.collapsed
      vm.$destroy()
      return collapsed
    }, { configured, local })
    assert.equal(state, expected)
    checks.push({ configured, local, collapsed: state })
  }
  const preserved = await page.evaluate(async () => {
    localStorage.removeItem('cra1_aside_collapsed')
    const vm = new Vue({ data: { collapsed: false }, methods: { applyAsideDefault: asideMenu.methods.applyAsideDefault } })
    vm.applyAsideDefault(undefined)
    vm.collapsed = true
    localStorage.setItem('cra1_aside_collapsed', '1')
    vm.applyAsideDefault({ appearance: { sidebar_default_open: 1 } })
    await Vue.nextTick()
    return vm.collapsed
  })
  assert.equal(preserved, true, 'a manual collapse before configuration arrives is preserved')
  checks.push({ manualChoiceDuringLoadPreserved: true })
  console.log(JSON.stringify({ status: 'passed', checks, production_writes: 0 }))
} finally {
  await browser.close()
}
