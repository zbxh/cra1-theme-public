/** Actual release entry: document titles follow the loaded help document, including public protocols. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = path.resolve(new URL('../..', import.meta.url).pathname)
const stage = process.env.CRA1_RELEASE_STAGE
if (!stage) throw Error('Set CRA1_RELEASE_STAGE to the real candidate build')
const release = JSON.parse(fs.readFileSync(path.join(stage, 'release.json'))).release
const shared = `/cra1-shared/releases/${release}`, member = `/clientarea/template/pc/cra1/releases/${release}/assets`
const require = createRequire(path.join(root, 'cra1-theme/scripts/package.json'))
const { chromium } = require('playwright')
const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'public', member, '.vite/manifest.json')))
const styles = [...new Set(Object.values(manifest).flatMap(v => v.css || []))]
const out = process.env.CRA1_BROWSER_OUT
if (out) fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const checks = [], errors = [], missing = []
const check = (ok, label) => { assert.ok(ok, label); checks.push(label) }
const docs = { 1: '隐私协议', 2: '服务协议', 37: '服务价格与说明', 4: '', 8: '演示云' }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  let calls = 0, delayed, resolveDocument
  await context.route('**/*', async route => {
    const u = new URL(route.request().url()), p = u.pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) })
    if (p.startsWith('/console/v1/help/')) {
      calls++
      if (delayed) await delayed
      const id = p.split('/').pop()
      if (id === '5') return json({ status: 503, msg: '暂时无法读取，请稍后重试' })
      return json({ status: 200, data: { help: id === '6' ? {} : { id: Number(id), title: docs[id], content: '<p>演示文档内容。</p>', attachment: [] } } })
    }
    if (p.endsWith('/announcements.php')) return json({ status: 200, data: { items: [] } })
    if (p.endsWith('/snapshot.php')) return json({ status: 200, data: { sidebar: [], features: {}, items: [] } })
    if (p.startsWith('/console/v1/')) return json({ status: 200, data: {} })
    if (p === '/agreement.htm') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>协议与文档-演示云</title><link rel="stylesheet" href="${shared}/cra1-shared.css">${styles.map(file => `<link rel="stylesheet" href="${member}/${file}">`).join('')}<script>window.__CRA1_PAGE__={website_name:'演示云'};window.__CRA1_RUNTIME__={projection_version:2,page:'agreement',common:{website_name:'演示云'},features:{}};</script><div id="root"></div><script src="${shared}/cra1-shared.js"></script><script type="module" src="${member}/js/agreement.js"></script></html>` })
    const file = path.join(stage, 'public', p)
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file, contentType: p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : undefined })
    if (/\.(js|css)$/.test(p)) missing.push(p)
    return route.fulfill({ status: 404, body: '' })
  })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  for (const [id, expected] of [['1', '隐私协议-演示云'], ['2', '服务协议-演示云'], ['37', '服务价格与说明-演示云'], ['4', '未命名文档-演示云'], ['8', '演示云'], ['5', '文档加载失败-演示云'], ['6', '文档不存在或已下架-演示云'], ['', '缺少文档参数-演示云']]) {
    const before = calls
    await page.goto('http://theme.invalid/agreement.htm' + (id ? '?id=' + id : ''))
    await page.waitForFunction(title => document.title === title, expected)
    check(await page.title() === expected, 'actual title for document ' + (id || 'missing parameter'))
    check(await page.locator('title').count() === 1, 'only one title element for document ' + (id || 'missing parameter'))
    if (!id) check(calls === before, 'missing id never sends a help request')
    if (out && ['1', '2', '37'].includes(id)) await page.screenshot({ path: path.join(out, 'document-' + id + '-1440.png'), fullPage: true })
  }
  delayed = new Promise(resolve => { resolveDocument = resolve })
  await page.goto('http://theme.invalid/agreement.htm?id=1')
  await page.waitForTimeout(150)
  check(await page.title() === '协议与文档-演示云', 'a slow document uses a neutral title while loading')
  resolveDocument()
  delayed = undefined
  await page.waitForFunction(() => document.title === '隐私协议-演示云')
  check(true, 'a delayed response updates the title without another request')
  await page.setViewportSize({ width: 390, height: 844 })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'public document fits a mobile viewport')
  if (out) await page.screenshot({ path: path.join(out, 'document-1-390.png'), fullPage: true })
  check(errors.length === 0 && missing.length === 0, 'release entry and dependent assets load without browser errors')
  const report = { status: 'passed', checks, errors, missing, release, production_writes: 0 }
  if (out) fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
  await context.close()
} finally { await browser.close() }
