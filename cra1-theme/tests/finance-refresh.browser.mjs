/** Exercise the published finance entry and shared runtime against disposable API data. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = path.resolve(new URL('../..', import.meta.url).pathname)
const stage = process.env.CRA1_REVIEW_STAGE
const out = process.env.CRA1_BROWSER_OUT
if (!stage || !out || path.resolve(out).startsWith(root + path.sep)) throw Error('Set release stage and external browser output')
const { chromium } = createRequire(new URL('../scripts/package.json', import.meta.url))('playwright')
const release = JSON.parse(fs.readFileSync(path.join(stage, 'release.json'))).release
const memberBase = '/clientarea/template/pc/cra1/releases/' + release + '/assets'
const sharedBase = '/cra1-shared/releases/' + release
const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'public', memberBase, '.vite/manifest.json')))
const styles = [...new Set(Object.values(manifest).flatMap(entry => entry.css || []))]
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const report = { status: 'running', checks: [], errors: [], screenshots: [], requests: [] }
const check = (ok, label) => { assert.ok(ok, label); report.checks.push(label) }
let fixture
const order = id => ({ id, type: 'new', product_names: ['测试商品'], amount: '10.00', status: 'Unpaid', create_time: 1793952000 })
function reset(extra = {}) {
  fixture = {
    rows: [order(17)], account: { credit: '100.00', consume: '20.00', this_month_consume: '10.00', unpaid_order: 1 },
    credit: [{ id: 1, type: 'Refund', notes: '旧余额记录', amount: '10.00', credit: '100.00' }],
    freeze: [{ id: 1, amount: '10.00', client_notes: '旧冻结记录' }],
    transactions: [{ id: 1, transaction_number: '旧交易记录', order_id: 17, amount: '10.00', gateway: '余额' }],
    summaryQueue: [], ordersQueue: [], deleteCalls: 0, ...extra,
  }
}
const reply = (res, body, delay = 0) => setTimeout(() => {
  if (!res.destroyed) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
}, delay)
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture.invalid')
  res.setHeader('Cache-Control', 'no-store')
  if (url.pathname.startsWith('/console/') || url.pathname === '/cra1-shared/compat.php') {
    report.requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams) })
    if (url.pathname === '/cra1-shared/compat.php') return reply(res, { status: 200, data: { all: true, security: [] } })
    if (url.pathname === '/console/v1/index') {
      const queued = fixture.summaryQueue.shift()
      return reply(res, queued?.body || (fixture.summaryFail ? { status: 503, msg: '服务暂时不可用' } : { status: 200, data: { account: structuredClone(fixture.account) } }), queued?.delay)
    }
    if (url.pathname === '/console/v1/order' && req.method === 'GET') {
      const queued = fixture.ordersQueue.shift()
      const status = url.searchParams.get('status'), type = url.searchParams.get('type'), keywords = url.searchParams.get('keywords') || ''
      const rows = fixture.rows.filter(r => (!status || r.status === status) && (!type || r.type === type) && (!keywords || String(r.id).includes(keywords)))
      const page = Number(url.searchParams.get('page') || 1), limit = Number(url.searchParams.get('limit') || 10)
      return reply(res, queued?.body || { status: 200, data: { list: rows.slice((page - 1) * limit, page * limit), count: rows.length } }, queued?.delay)
    }
    if (/^\/console\/v1\/order\/\d+$/.test(url.pathname) && req.method === 'DELETE') {
      fixture.deleteCalls++
      if (fixture.deleteFail) return reply(res, { status: 400, msg: '订单暂时不能删除' })
      const id = Number(url.pathname.split('/').pop()), row = fixture.rows.find(r => r.id === id)
      if (row?.status === 'Unpaid') fixture.account.unpaid_order--
      fixture.rows = fixture.rows.filter(r => r.id !== id)
      return reply(res, { status: 200, msg: '删除成功' }, fixture.deleteDelay)
    }
    if (url.pathname === '/console/v1/credit') return reply(res, { status: 200, data: { list: fixture.credit, count: fixture.credit.length } })
    if (url.pathname === '/console/v1/account/credit/freeze') return reply(res, { status: 200, data: { list: fixture.freeze } })
    if (url.pathname === '/console/v1/transaction') return reply(res, { status: 200, data: { list: fixture.transactions, count: fixture.transactions.length } })
    res.writeHead(404); res.end(); return
  }
  if (url.pathname === '/finance.htm') {
    res.setHeader('Content-Type', 'text/html;charset=utf-8')
    res.end(`<!doctype html><html lang="zh-CN" data-cra1-theme="member"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <link rel="stylesheet" href="${sharedBase}/cra1-shared.css">${styles.map(file => `<link rel="stylesheet" href="${memberBase}/${file}">`).join('')}
      <style>body{margin:0;background:#f8fafc;font:14px/1.5 system-ui}main{padding:24px;max-width:1440px;margin:auto}@media(max-width:600px){main{padding:16px}}</style>
      <script>localStorage.setItem('jwt','fixture-member');window.__CRA1_RUNTIME__={common:{currency_prefix:'￥',currency_suffix:'元'},features:{recharge_open:0,withdraw_open:0}};window.__CRA1_SHELL_READY__=true;</script>
      <main><div id="cra1-content-slot"></div></main><script src="${sharedBase}/cra1-shared.js"></script><script type="module" src="${memberBase}/js/finance.js"></script></html>`)
    return
  }
  const file = path.resolve(stage, 'public', '.' + url.pathname)
  if (!file.startsWith(path.resolve(stage, 'public') + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream')
  res.end(fs.readFileSync(file))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
const page = await context.newPage()
page.on('pageerror', e => report.errors.push(e.message))
const metric = name => page.getByText(name, { exact: true }).locator('..').locator('p').last()
const indexReads = () => report.requests.filter(r => r.path === '/console/v1/index').length
async function value(name, expected) { await metric(name).filter({ hasText: new RegExp('^' + expected + '$') }).waitFor() }
async function loaded() { await page.getByRole('button', { name: '删除订单', exact: true }).first().waitFor(); await value('待支付', String(fixture.account.unpaid_order)) }
async function fresh(query = '') { await page.goto(origin + '/finance.htm' + query); await loaded() }
async function openDelete(index = 0) { await page.getByRole('button', { name: '删除订单', exact: true }).nth(index).click(); const d = page.getByRole('dialog', { name: '删除订单', exact: true }); await d.waitFor(); return d }
async function updateEvent() { await page.evaluate(() => window.dispatchEvent(new Event('cra1:finance-updated'))) }
async function shot(name) {
  const file = name + '-' + page.viewportSize().width + '.png'
  await page.screenshot({ path: path.join(out, file), fullPage: true }); report.screenshots.push(file)
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), file + ' has no page overflow')
}
try {
  for (const width of [1920, 1440, 768, 390]) {
    reset(); await page.setViewportSize({ width, height: 1000 }); await fresh()
    await shot('before-delete')
    let dialog = await openDelete(), before = indexReads()
    await dialog.getByRole('button', { name: '取消', exact: true }).click(); await dialog.waitFor({ state: 'hidden' })
    check(fixture.deleteCalls === 0 && indexReads() === before, width + ' cancellation does not delete or alter totals')
    dialog = await openDelete(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
    check(fixture.deleteCalls === 0, width + ' Escape cancels deletion')
    dialog = await openDelete(); fixture.deleteDelay = 200
    await dialog.getByRole('button', { name: '删除', exact: true }).evaluate(b => { b.click(); b.click() })
    await dialog.getByRole('button', { name: '处理中…', exact: true }).waitFor()
    check(await dialog.getByRole('button', { name: '处理中…', exact: true }).isDisabled(), width + ' pending delete disables duplicate submission')
    await page.getByText('暂无订单', { exact: true }).waitFor(); await value('待支付', '0')
    check(fixture.deleteCalls === 1, width + ' successful delete refreshes count without reloading')
    check(page.url() === origin + '/finance.htm', width + ' document remains on finance page')
    await shot('after-delete')
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  reset({ deleteFail: true }); await fresh(); let dialog = await openDelete()
  await dialog.getByRole('button', { name: '删除', exact: true }).click(); await page.getByText('订单暂时不能删除', { exact: true }).waitFor()
  await value('待支付', '1'); check(fixture.rows.length === 1 && await dialog.isVisible(), 'failed deletion preserves row and count, allowing retry')
  await dialog.getByRole('button', { name: '取消', exact: true }).click()

  reset(); await fresh(); fixture.summaryFail = true; dialog = await openDelete()
  await dialog.getByRole('button', { name: '删除', exact: true }).click(); await page.getByText('暂无订单', { exact: true }).waitFor(); await value('待支付', '—')
  check(true, 'failed summary refresh shows unknown instead of a stale count or invented zero')
  fixture.summaryFail = false; fixture.account.unpaid_order = 3; fixture.account.credit = '125.00'
  await page.getByRole('button', { name: '刷新', exact: true }).click(); await value('待支付', '3'); await value('账户余额', '￥125.00元')
  check(true, 'manual refresh reloads authoritative totals, independently of empty or filtered rows')

  reset(); await fresh()
  fixture.summaryQueue.push({ delay: 900, body: { status: 200, data: { account: structuredClone(fixture.account) } } })
  fixture.ordersQueue.push({ delay: 900, body: { status: 200, data: { list: structuredClone(fixture.rows), count: 1 } } })
  dialog = await openDelete()
  const pendingSummary = page.waitForResponse(response => new URL(response.url()).pathname === '/console/v1/index')
  const pendingOrders = page.waitForResponse(response => new URL(response.url()).pathname === '/console/v1/order')
  const oldReadStarted = page.waitForRequest(request => new URL(request.url()).pathname === '/console/v1/index')
  await updateEvent(); await oldReadStarted
  await dialog.getByRole('button', { name: '删除', exact: true }).click(); await value('待支付', '0'); await page.getByText('暂无订单', { exact: true }).waitFor()
  await Promise.all([pendingSummary, pendingOrders]); await page.waitForTimeout(50); await value('待支付', '0')
  check(await page.getByRole('button', { name: '删除订单', exact: true }).count() === 0, 'late pre-delete list and summary responses cannot restore deleted data')

  reset({ rows: Array.from({ length: 11 }, (_, i) => order(100 + i)) }); fixture.account.unpaid_order = 13
  await fresh('?order_status=Unpaid'); await page.getByRole('button', { name: '下一页', exact: true }).click()
  await page.getByText('共 11 条 · 第 2/2 页', { exact: true }).waitFor(); dialog = await openDelete()
  await dialog.getByRole('button', { name: '删除', exact: true }).click(); await value('待支付', '12')
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label="删除订单"]').length === 10)
  check(!await page.getByText('暂无订单', { exact: true }).isVisible(), 'deleting the sole last-page item returns to a valid page')
  check(report.requests.filter(r => r.path === '/console/v1/order').slice(-2).every(r => r.query.status === 'Unpaid'), 'pagination recovery retains status filter')
  check(report.requests.filter(r => r.path === '/console/v1/order').at(-1).query.page === '1', 'last page is chosen from the server total')

  reset(); await fresh(); fixture.rows[0].status = 'Paid'; fixture.account = { credit: '90.00', consume: '30.00', this_month_consume: '20.00', unpaid_order: 0 }
  await updateEvent(); await value('待支付', '0'); await value('账户余额', '￥90.00元'); await value('本月消费', '￥20.00元')
  await page.getByRole('table').getByText('已付款', { exact: true }).waitFor(); check(true, 'payment event refreshes account summary and order status together')
  for (const [tab, field, text] of [['余额记录', 'credit', '余额'], ['冻结记录', 'freeze', '冻结'], ['交易记录', 'transactions', '交易']]) {
    await page.getByRole('tab', { name: tab, exact: true }).click(); await page.getByText('旧' + text + '记录', { exact: true }).waitFor()
    if (field === 'credit') fixture.credit[0].notes = '新余额记录'
    if (field === 'freeze') { fixture.freeze[0].client_notes = '新冻结记录'; fixture.freeze[0].amount = '5.00' }
    if (field === 'transactions') fixture.transactions[0].transaction_number = '新交易记录'
    await updateEvent(); await page.getByText('新' + text + '记录', { exact: true }).waitFor()
    if (field === 'freeze') await value('冻结中', '￥5.00元')
    check(true, 'payment event refreshes the mounted ' + field + ' ledger')
  }
  fixture.freeze = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, amount: '10.00', client_notes: '临时冻结记录 ' + (i + 1) }))
  await page.getByRole('tab', { name: '冻结记录', exact: true }).click()
  await page.getByText('共 21 条 · 第 1/2 页', { exact: true }).waitFor()
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await page.getByText('共 21 条 · 第 2/2 页', { exact: true }).waitFor()
  fixture.freeze.pop(); await updateEvent()
  await value('冻结中', '￥200.00元')
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 20)
  check(!await page.getByText('暂无冻结记录', { exact: true }).isVisible(), 'released freezes return an out-of-range page to existing records')
  await page.getByRole('tab', { name: '我的订单', exact: true }).click(); fixture.account.unpaid_order = 2
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await value('待支付', '2')
  check(true, 'browser history restoration refreshes finance data')
  check(report.errors.length === 0, 'published entry has no unhandled browser errors')
  check(report.requests.filter(r => r.method !== 'GET').every(r => r.method === 'DELETE' && /^\/console\/v1\/order\/\d+$/.test(r.path)), 'business writes are confined to fixture order deletion')
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1 }
finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 })
  await browser.close(); await new Promise(resolve => server.close(resolve))
}
console.log(JSON.stringify({ status: report.status, checks: report.checks.length, error: report.error, errors: report.errors, screenshots: report.screenshots.length }))
