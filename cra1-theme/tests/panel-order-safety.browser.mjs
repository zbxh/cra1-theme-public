/** Real panel dialogs, deferred API responses and durable browser receipts. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const repo = path.resolve(new URL('../..', import.meta.url).pathname)
const source = path.resolve(process.env.CRA1_PANEL_SOURCE_ROOT || repo)
const member = path.join(repo, 'cra1-theme/source/member')
const require = createRequire(path.join(member, 'package.json'))
const { buildSync } = require('esbuild')
const { chromium } = await import(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const out = process.env.CRA1_BROWSER_OUT
if (!out || path.resolve(out).startsWith(repo + '/')) throw Error('Set CRA1_BROWSER_OUT outside the repository')
fs.mkdirSync(out, { recursive: true })
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cra1-order-safety-'))
const entry = path.join(temp, 'fixture.jsx')
fs.writeFileSync(entry, `
import React,{useState} from ${JSON.stringify(path.join(member, 'node_modules/react/index.js'))};
import {createRoot} from ${JSON.stringify(path.join(member, 'node_modules/react-dom/client.js'))};
import {ServerPanelDialogs} from ${JSON.stringify(path.join(source, 'cra1-theme/source/member/src/pages/serverPanel/dialogs.jsx'))};
const f=window.fixture={orders:[],prices:[],configs:[],paid:[],toasts:[],mode:'lost',account:1,child:0,closed:0,refreshes:0,orderStatus:'Unpaid'};
const token=()=> 'fixture.'+btoa(JSON.stringify({info:{id:f.account,sub_account_id:f.child}}))+'.fixture';
const config=ip=>({status:200,data:{current_defence:ip==='192.0.2.2'?0:50,defence:[{value:0},{value:10},{value:20},{value:100},{value:200}]}});
const api={
 defenceConfig:params=>f.deferConfig?new Promise((resolve,reject)=>f.configs.push({params,resolve,reject})):Promise.resolve(config(params.ip)),
 defencePrice:params=>new Promise((resolve,reject)=>f.prices.push({params,resolve,reject})),
 defenceOrder:async body=>{f.orders.push({kind:'defence',body});return{status:200,data:{id:99}}},
 orderPage:async()=>({status:200,data:{data_disk:[{type:'step',min_value:10,max_value:100,other_config:{disk_type:'SSD'}}],config:{disk_limit_num:8}}}),
 diskList:async()=>({status:200,data:{list:[]}}),
 diskPrice:async()=>({status:200,data:{price:10}}),
 diskOrder:async body=>{f.orders.push({kind:'disk',body});
  if(f.mode==='slow')return new Promise((resolve,reject)=>{f.diskFinish=resolve;f.diskFail=reject});
  if(f.mode==='lost')throw Object.assign(Error('private diagnostic'),{code:'TIMEOUT',method:'POST'});
  if(f.mode==='rejected')throw Object.assign(Error('容量超出限制'),{code:'API_ERROR',status:400,data:{status:400}});
  if(f.mode==='empty')return{status:200,data:{}};
  return{status:200,...(f.mode==='paid'?{code:'Paid'}:{}),data:{id:99}};
 },
 orderDetail:async id=>{if(f.failOrderRead)throw Error('private diagnostic');return{status:200,data:{order:{id,status:f.orderStatus}}}},
 autoRelease:async body=>{f.orders.push({kind:'autoRelease',body});if(f.deferRelease)return new Promise(resolve=>f.releaseFinish=resolve);return{status:200}}
};
Object.assign(window.CRA1Shared,{Request:{getToken:token,request:async()=>({status:200,data:{}})},Runtime:{common:()=>({currency_prefix:'¥',currency_suffix:'元'})},UI:{toast:(text,tone)=>f.toasts.push({text,tone})}});
function App(){const[opts,setOpts]=useState(null);window.openFixture=options=>{setOpts(options)};
 return opts?<ServerPanelDialogs key={opts.key} dlg={{type:opts.type}} setDlg={()=>{f.closed++;setOpts(null)}} api={api}
 host={{id:24,product_id:1,name:'CRA1-DEMO-24',billing_cycle:'on_demand',auto_release_time:opts.cur||0}} cloud={{id:24}} caps={{autoDelete:true}}
 ips={{list:[{ip:'192.0.2.1'},{ip:'192.0.2.2'}]}} module="mf_cloud"
 onOpenPay={id=>{f.paid.push(id);if(f.failNavigate)throw Error('fixture navigation failure')}} onOperation={()=>f.refreshes++}/>:<p>隔离交互演示</p>;
};createRoot(document.getElementById('root')).render(<App/>);
`)
buildSync({ entryPoints: [entry], outfile: path.join(temp, 'fixture.js'), bundle: true, format: 'iife', jsx: 'automatic', nodePaths: [path.join(member, 'node_modules')], define: { 'import.meta.env': '{}' }, logLevel: 'silent' })
const server = http.createServer((req, res) => {
  const files = { '/fixture.js': path.join(temp, 'fixture.js'), '/member.css': process.env.CRA1_MEMBER_CSS, '/shared.css': process.env.CRA1_SHARED_CSS,
    '/request.js': path.join(source, 'public/cra1-shared/src/request.js'), '/security.js': path.join(source, 'public/cra1-shared/src/security.js') }
  if (files[req.url]) { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(fs.readFileSync(files[req.url])); return }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end('<!doctype html><html data-cra1-theme="member"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + (process.env.CRA1_MEMBER_CSS ? '<link rel="stylesheet" href="/member.css">' : '') + (process.env.CRA1_SHARED_CSS ? '<link rel="stylesheet" href="/shared.css">' : '') + '<body><div id="root"></div><script>window.CRA1Shared={Request:{},UI:{}}</script><script src="/fixture.js"></script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Asia/Shanghai' })
const report = { status: 'running', checks: [], screenshots: [], errors: [], externalRequests: [], real_business_writes: 0 }
let key = 0
const passed = label => report.checks.push(label)
try {
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin !== origin) { report.externalRequests.push(route.request().url()); return route.abort() }
    await route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  async function ready(target = page) { await target.goto(origin); await target.waitForFunction(() => typeof openFixture === 'function') }
  async function open(type, options = {}, target = page) {
    await target.evaluate(options => openFixture(options), { key: ++key, type, ...options })
    await target.getByRole('dialog').waitFor()
  }
  async function choose(selector, name) { await page.locator(selector).click(); await page.getByRole('option', { name, exact: true }).click() }
  async function enabled(target = page) { await target.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '提交订单' && !b.disabled)) }
  async function quote(index, data = { price: 200, price_difference: 200, description: '当前200G报价' }) {
    await page.evaluate(({ index, data }) => fixture.prices[index].resolve({ status: 200, data }), { index, data })
  }
  async function shot(name) {
    await page.waitForTimeout(100)
    const dialog = page.getByRole('dialog')
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, name + ' has no horizontal overflow')
    const bounds = await dialog.boundingBox(), closeBounds = await dialog.locator('.cui-dialog-close').boundingBox()
    assert.ok(closeBounds.y < bounds.y + 30 && closeBounds.x > bounds.x + bounds.width - 70, name + ' close button stays at the top right')
    assert.doesNotMatch(await dialog.innerText(), /private diagnostic|SQLSTATE|魔方云|\/www\//)
    const file = name + '.png'; await page.screenshot({ path: path.join(out, file), fullPage: true, animations: 'disabled' }); report.screenshots.push(file)
  }
  await page.setViewportSize({ width: 1440, height: 960 }); await ready()
  await open('defence')
  await choose('#df-val', '100G（升级）'); await page.waitForFunction(() => fixture.prices.length === 1)
  assert.equal(await page.getByRole('button', { name: '提交调整', exact: true }).isDisabled(), true)
  await page.evaluate(() => fixture.prices[0].reject(Error('private diagnostic')))
  await page.getByRole('button', { name: '重新询价', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '提交调整', exact: true }).isDisabled(), true)
  assert.equal(await page.evaluate(() => fixture.orders.length), 0)
  await page.getByRole('button', { name: '重新询价', exact: true }).click(); await page.waitForFunction(() => fixture.prices.length === 2)
  await quote(1, { price: 100, description: '100G重试报价' }); await page.getByText(/100G重试报价/).waitFor()
  passed('failed and pending defence prices cannot submit; explicit retry recovers')

  await choose('#df-val', '200G（升级）'); await page.waitForFunction(() => fixture.prices.length === 3)
  await choose('#df-val', '100G（升级）'); await page.waitForFunction(() => fixture.prices.length === 4)
  await quote(3, { price: 100, description: '有效100G报价' }); await quote(2)
  await page.getByText(/有效100G报价/).waitFor()
  assert.equal(await page.getByText(/当前200G报价/).count(), 0)
  await page.getByRole('button', { name: '提交调整', exact: true }).evaluate(button => { button.click(); button.click() })
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.deepEqual(await page.evaluate(() => fixture.orders.filter(o => o.kind === 'defence').map(o => o.body)), [{ ip: '192.0.2.1', peak_defence: '100' }])
  passed('late quotes cannot replace current selection and double click submits once')

  await page.evaluate(() => { fixture.deferConfig = true; fixture.configs = [] }); await open('defence')
  await page.waitForFunction(() => fixture.configs.length === 1)
  await choose('#df-ip', '192.0.2.2'); await page.waitForFunction(() => fixture.configs.length === 2)
  await page.evaluate(() => fixture.configs[1].reject(Error('private diagnostic')))
  await page.getByRole('button', { name: '重新加载', exact: true }).waitFor()
  await page.evaluate(() => fixture.configs[0].resolve({ status: 200, data: { current_defence: 50, defence: [{ value: 100 }] } }))
  assert.equal(await page.locator('#df-val').count(), 0)
  await page.evaluate(() => { fixture.deferConfig = false }); await page.getByRole('button', { name: '重新加载', exact: true }).click()
  await choose('#df-val', '100G（升级）')
  await page.waitForFunction(() => fixture.prices.at(-1).params.ip === '192.0.2.2')
  const last = await page.evaluate(() => fixture.prices.length - 1)
  await quote(last, { price: null }); await page.getByRole('button', { name: '重新询价', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '提交调整', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: '重新询价', exact: true }).click(); await page.waitForFunction(last => fixture.prices.length === last + 2, last)
  await quote(last + 1, { price: 0, description: '免费调整' }); await page.getByText(/免费调整/).waitFor()
  assert.equal(await page.getByRole('button', { name: '提交调整', exact: true }).isEnabled(), true)
  assert.match(await page.getByRole('dialog').innerText(), /当前防御 0G/)
  passed('IP config races and errors never reuse old options; missing price fails, zero remains valid')
  await page.keyboard.press('Escape')

  await open('defence'); await choose('#df-val', '10G（降级不退款）')
  let index = await page.evaluate(() => fixture.prices.length - 1)
  await quote(index, { price: 0, price_difference: 0 })
  await page.getByRole('button', { name: /请阅读/ }).waitFor()
  await page.waitForTimeout(5150)
  assert.equal(await page.getByRole('button', { name: '提交调整', exact: true }).isEnabled(), true)
  await choose('#df-val', '20G（降级不退款）')
  index = await page.evaluate(() => fixture.prices.length - 1); await quote(index, { price: 0, price_difference: -1 })
  assert.equal(await page.getByRole('button', { name: /请阅读/ }).isDisabled(), true)
  passed('downgrade reading timer resets per target and zero difference does not hide resource downgrade')
  await page.keyboard.press('Escape')

  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.evaluate(() => { localStorage.clear(); fixture.mode = 'lost' }); await open('diskOrder'); await enabled()
    const start = await page.evaluate(() => fixture.orders.length)
    await page.getByRole('button', { name: '提交订单', exact: true }).click()
    await page.getByText(/本次提交结果尚未确认/).waitFor(); await shot(`disk-unknown-${width}`)
    assert.equal(await page.getByRole('button', { name: '提交订单', exact: true }).count(), 0)
    await page.keyboard.press('Escape'); await open('diskOrder')
    await page.getByText(/本次提交结果尚未确认/).waitFor()
    assert.equal(await page.evaluate(() => fixture.orders.length), start + 1)
    await ready(); await open('diskOrder'); await page.getByText(/本次提交结果尚未确认/).waitFor()
    assert.equal(await page.getByRole('button', { name: '提交订单', exact: true }).count(), 0)
    await page.keyboard.press('Escape')
    passed(`${width}px uncertain disk order survives close/reopen and reload`)

    const cur = Math.ceil(Date.now() / 60000) * 60 + 86446
    await open('autoRelease', { cur }); await shot(`auto-release-current-${width}`)
    assert.match(await page.getByRole('dialog').innerText(), /余额充足/)
    assert.match(await page.getByRole('dialog').innerText(), /:46（Asia\/Shanghai，UTC\+08:00）/)
    const releaseStart = await page.evaluate(() => fixture.orders.filter(o => o.kind === 'autoRelease').length)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.getByRole('dialog', { name: '确认自动释放', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => fixture.orders.filter(o => o.kind === 'autoRelease').length), releaseStart)
    await shot(`auto-release-confirm-${width}`)
    await page.getByRole('button', { name: '返回修改', exact: true }).click()
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.getByRole('button', { name: '确认设置自动释放', exact: true }).click()
    assert.equal(await page.evaluate(() => fixture.orders.filter(o => o.kind === 'autoRelease').at(-1).body.auto_release_time), cur)
    passed(`${width}px auto-release requires confirmation of instance, irreversible deletion and exact zoned time`)

    await open('defence'); await choose('#df-val', '100G（升级）')
    index = await page.evaluate(() => fixture.prices.length - 1)
    await page.evaluate(index => fixture.prices[index].reject(Error('private diagnostic')), index)
    await page.getByRole('button', { name: '重新询价', exact: true }).waitFor(); await shot(`defence-price-error-${width}`)
    await page.getByRole('button', { name: '重新询价', exact: true }).click()
    await page.waitForFunction(index => fixture.prices.length === index + 2, index)
    await quote(index + 1, { price: 100, description: '当前100G报价' }); await page.getByText(/当前100G报价/).waitFor()
    await shot(`defence-price-ready-${width}`); await page.keyboard.press('Escape')
  }

  await page.evaluate(() => { localStorage.clear(); fixture.mode = 'slow' }); await open('diskOrder'); await enabled()
  await page.getByRole('button', { name: '提交订单', exact: true }).click()
  await page.waitForFunction(() => typeof fixture.diskFinish === 'function')
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').isVisible(), true)
  await page.getByRole('button', { name: '关闭', exact: true }).last().click()
  assert.equal(await page.getByRole('dialog').isVisible(), true)
  assert.equal(await page.getByRole('button', { name: '查看订单记录', exact: true }).isDisabled(), true)
  // A second tab sees the pending receipt before the first response arrives.
  const second = await context.newPage(); await ready(second); await open('diskOrder', {}, second)
  await second.getByText(/本次提交结果尚未确认/).waitFor()
  assert.equal(await second.getByRole('button', { name: '提交订单', exact: true }).count(), 0)
  await page.evaluate(() => { fixture.failNavigate = true; fixture.diskFinish({ status: 200, data: { id: 99 } }) })
  await page.getByRole('button', { name: '继续处理订单', exact: true }).waitFor()
  await second.getByText('订单 #99', { exact: true }).waitFor()
  passed('pending disk submission blocks Esc, close, duplicate click and a second tab')
  const count = await page.evaluate(() => fixture.orders.filter(o => o.kind === 'disk').length)
  await page.evaluate(() => { fixture.failNavigate = false }); await page.getByRole('button', { name: '继续处理订单', exact: true }).click()
  assert.equal(await page.evaluate(() => fixture.orders.filter(o => o.kind === 'disk').length), count)
  passed('payment navigation failure retains order ID and resumes payment without creating another order')
  await second.close()
  await open('diskOrder'); await page.getByRole('button', { name: '继续处理订单', exact: true }).waitFor()
  await page.evaluate(() => { fixture.failOrderRead = true }); await page.getByRole('button', { name: '查询订单状态', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '提交订单', exact: true }).count(), 0)
  await page.evaluate(() => { fixture.failOrderRead = false; fixture.orderStatus = 'Paid' })
  await page.getByRole('button', { name: '查询订单状态', exact: true }).click(); await enabled()
  passed('only authoritative terminal order status releases a known order; read failure preserves it')

  await page.evaluate(() => { localStorage.clear(); fixture.mode = 'rejected' }); await open('diskOrder'); await enabled()
  await page.getByRole('button', { name: '提交订单', exact: true }).click(); await enabled()
  await page.evaluate(() => { fixture.mode = 'empty' }); await page.getByRole('button', { name: '提交订单', exact: true }).click()
  await page.getByText(/本次提交结果尚未确认/).waitFor()
  passed('explicit business refusal can be corrected, while a success without an order ID stays uncertain')

  await page.evaluate(() => { fixture.account = 2 }); await open('diskOrder'); await enabled()
  await page.keyboard.press('Escape'); await page.evaluate(() => { fixture.account = 1 }); await open('diskOrder')
  await page.getByText(/本次提交结果尚未确认/).waitFor()
  passed('account switching cannot reuse or erase another account disk receipt')
  await page.keyboard.press('Escape')
  await open('autoRelease', { cur: Math.floor(Date.now() / 1000) + 3600 })
  await page.getByRole('button', { name: '取消自动释放', exact: true }).click()
  assert.equal(await page.evaluate(() => fixture.orders.filter(o => o.kind === 'autoRelease').at(-1).body.auto_release_time), 0)
  passed('cancelling scheduled release remains a direct safe operation')

  // Exercise the actual shared verification form as well as the outer React guard.
  // Both requests below are fulfilled/aborted in the browser; none reaches V10.
  let verifiedOrderRequests = 0
  await context.route(origin + '/console/v1/**', async route => {
    const name = new URL(route.request().url()).pathname
    if (name.endsWith('/disk/order')) {
      verifiedOrderRequests++
      if (verifiedOrderRequests === 1) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 400, data: { operate_password: 1 } }) })
      return route.abort('failed')
    }
    if (name.endsWith('/operation/verify')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 200, data: { expires_at: Math.floor(Date.now() / 1000) + 900 } }) })
    throw Error('Unexpected fixture API: ' + name)
  })
  await page.evaluate(() => { localStorage.setItem('jwt', fixture.account + '-isolated-session') })
  await page.addScriptTag({ url: origin + '/request.js' }); await page.addScriptTag({ url: origin + '/security.js' })
  await page.evaluate(() => {
    CRA1Shared.Request.request('/mf_cloud/24/disk/order', { method: 'POST', body: {}, orderCreation: true })
      .then(() => { fixture.securityResult = { status: 'unexpected-success' } })
      .catch(error => { fixture.securityResult = { status: 'rejected', uncertain: error.uncertain } })
  })
  const security = page.locator('dialog.cra1-security-dialog[open]')
  await security.locator('input[type="password"]').fill('isolated-password')
  await security.getByRole('button', { name: '验证并继续', exact: true }).click()
  await page.waitForFunction(() => fixture.securityResult?.status === 'rejected')
  assert.equal(await page.evaluate(() => fixture.securityResult.uncertain), true)
  assert.equal(await security.count(), 0); assert.equal(verifiedOrderRequests, 2)
  passed('real security dialog closes after an uncertain verified order response, preventing an internal resubmit')
  assert.deepEqual(report.errors, []); assert.deepEqual(report.externalRequests, [])
  report.status = 'passed'
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, screenshots: report.screenshots.length, real_business_writes: 0 }))
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2))
  await browser.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true })
}
