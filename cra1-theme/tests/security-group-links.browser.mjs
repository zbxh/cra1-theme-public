/** Exercise real theme components with delayed, failed and paginated local responses. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = path.resolve(new URL('../..', import.meta.url).pathname)
const out = process.env.CRA1_BROWSER_OUT && path.resolve(process.env.CRA1_BROWSER_OUT)
if (!out || out === root || out.startsWith(root + path.sep)) throw Error('Set CRA1_BROWSER_OUT outside the source site')
fs.mkdirSync(out, { recursive: true, mode: 0o700 })
const admin = path.join(root, 'cra1-theme/source/admin')
const member = path.join(root, 'cra1-theme/source/member')
const { buildSync } = createRequire(path.join(admin, 'package.json'))('esbuild')
const { chromium } = await import(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cra1-security-links-'))
fs.writeFileSync(path.join(temp, 'entry.jsx'), `
import React,{useState} from ${JSON.stringify(admin + '/node_modules/react/index.js')};
import {createRoot} from ${JSON.stringify(admin + '/node_modules/react-dom/client.js')};
import {SecurityGroupPanel} from ${JSON.stringify(member + '/src/pages/securityGroupPanel.jsx')};
import {GroupRulesPage} from ${JSON.stringify(member + '/src/pages/securityGroup.jsx')};
import LinkPicker from ${JSON.stringify(admin + '/src/pages/LinkPicker.jsx')};
function App(){const[value,setValue]=useState('');return location.pathname==='/links'?<LinkPicker value={value} onChange={setValue}/>:location.pathname==='/groups'?<SecurityGroupPanel/>:<GroupRulesPage/>}
createRoot(document.getElementById('root')).render(<App/>);
`)
buildSync({ entryPoints: [path.join(temp, 'entry.jsx')], outfile: path.join(temp, 'fixture.js'), bundle: true,
  format: 'iife', jsx: 'automatic', nodePaths: [admin + '/node_modules'],
  alias: { '@ui': admin + '/src/components/ui', react: admin + '/node_modules/react', 'react-dom': admin + '/node_modules/react-dom' },
  define: { 'import.meta.env': '{}' }, logLevel: 'silent' })
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://fixture.invalid').pathname
  const files = { '/fixture.js': path.join(temp, 'fixture.js'), '/errors.js': root + '/public/cra1-shared/src/errors.js', '/request.js': root + '/public/cra1-shared/src/request.js', '/theme.css': process.env.CRA1_REVIEW_CSS, '/member.css': process.env.CRA1_MEMBER_CSS, '/shared.css': process.env.CRA1_SHARED_CSS }
  if (files[pathname]) { res.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(fs.readFileSync(files[pathname])); return }
  res.setHeader('Content-Type', 'text/html;charset=utf-8')
  const styles = [['/theme.css', process.env.CRA1_REVIEW_CSS], ['/member.css', process.env.CRA1_MEMBER_CSS], ['/shared.css', process.env.CRA1_SHARED_CSS]].filter(([, file]) => file).map(([url]) => `<link rel="stylesheet" href="${url}">`).join('')
  res.end(`<!doctype html><html data-cra1-theme="member"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<div id="root"></div>
<script>window.__CRA1_ADMIN__={base:'/index.php',csrf:'fixture'};window.CRA1Shared={UI:{toast:()=>{}}};window.completed=[];const originalFetch=window.fetch;window.fetch=(...args)=>originalFetch(...args).finally(()=>completed.push(String(args[0])));</script>
<script src="/errors.js"></script><script src="/request.js"></script><script src="/fixture.js"></script>`)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const report = { status: 'running', checks: [], errors: [], externalRequests: [], real_business_writes: 0 }
const ok = data => ({ status: 200, data, msg: '成功' })
const failure = { status: 503, msg: 'SQLSTATE[fixture] private diagnostic' }
const groups = Array.from({ length: 51 }, (_, i) => ({ id: i + 1, name: '示例安全组 ' + (i + 1), rule_num: 1, host_num: 1 }))
const rule = direction => ({ id: direction === 'in' ? 1001 : 1002, direction, protocol: 'tcp', port: direction === 'in' ? '22' : '443', ip: '192.0.2.0/24', description: direction === 'in' ? '入站示例规则' : '出站示例规则' })
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const passed = label => report.checks.push(label)
async function open(pagePath, handler) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', e => report.errors.push(e.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) { report.externalRequests.push(url.origin); return route.abort() }
    if (url.pathname.startsWith('/console/') || url.pathname === '/index.php') return handler(route, url)
    return route.continue()
  })
  await page.goto(origin + pagePath)
  return page
}
async function settled(page, fragment) {
  await page.waitForFunction(fragment => completed.some(url => url.includes(fragment)), fragment)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}
async function noRetry(page) {
  assert.equal(await page.getByRole('button', { name: /重试|重新加载|刷新页面|重新读取/ }).count(), 0)
  assert.doesNotMatch(await page.locator('body').innerText(), /SQLSTATE|private diagnostic/)
}
async function details(route, url) {
  if (url.pathname.endsWith('/7')) { await route.fulfill({ json: ok({ security_group: { id: 7, name: '示例安全组' } }) }); return true }
  return false
}
try {
  let calls = []
  let page = await open('/groups', (route, url) => {
    const p = Number(url.searchParams.get('page')), q = url.searchParams.get('keywords') || ''
    calls.push({ page: p, keywords: q })
    return route.fulfill({ json: ok({ list: q ? [groups[50]] : groups.slice((p - 1) * 50, p * 50), count: q ? 1 : 51 }) })
  })
  await page.getByText('示例安全组 50', { exact: true }).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 50)
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await page.getByText('示例安全组 51', { exact: true }).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 1)
  assert.equal(await page.getByRole('button', { name: '下一页', exact: true }).isDisabled(), true)
  await page.getByText('本页规则数', { exact: true }).waitFor()
  assert.match(await page.locator('body').innerText(), /共 51 条.*第 2\/2 页/)
  await page.getByRole('textbox', { name: '安全组名称', exact: true }).fill('51')
  await page.getByText('搜索结果', { exact: true }).waitFor()
  await page.getByText('示例安全组 51', { exact: true }).waitFor()
  assert.deepEqual(calls.at(-1), { page: 1, keywords: '51' })
  await page.setViewportSize({ width: 390, height: 900 })
  await page.screenshot({ path: path.join(out, 'groups-mobile.png'), fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
  passed('51 groups paginate, search resets to page 1, summaries name their scope, mobile fits')
  await page.close()

  for (const staleFails of [false, true]) {
    const pending = defer(), started = defer()
    page = await open('/groups', async (route, url) => {
      const q = url.searchParams.get('keywords') || ''
      if (q === '旧') { started.resolve(); await pending.promise }
      return route.fulfill({ json: q === '旧' && staleFails ? failure : ok({ list: [{ ...groups[0], name: q ? q + '结果' : '初始安全组' }], count: 1 }) })
    })
    await page.getByText('初始安全组', { exact: true }).waitFor()
    await page.getByRole('textbox', { name: '安全组名称', exact: true }).fill('旧')
    await started.promise
    await page.getByRole('textbox', { name: '安全组名称', exact: true }).fill('新')
    await page.getByText('新结果', { exact: true }).waitFor()
    pending.resolve(); await settled(page, 'keywords=%E6%97%A7')
    assert.equal(await page.getByText('旧结果', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(await page.getByText('新结果', { exact: true }).count(), 1)
    passed('late security-group search ' + (staleFails ? 'error' : 'success') + ' cannot overwrite current results')
    await page.close()
  }

  let readFails = true
  page = await open('/groups', route => route.fulfill({ status: readFails ? 503 : 200, json: readFails ? failure : ok({ list: [groups[0]], count: 1 }) }))
  await page.getByRole('alert').filter({ hasText: '页面错误，请刷新重试' }).waitFor()
  assert.equal(await page.getByText('还没有安全组', { exact: true }).count(), 0)
  await noRetry(page)
  readFails = false; await page.reload()
  await page.getByText('示例安全组 1', { exact: true }).waitFor()
  passed('group read failure shows only refresh guidance and browser refresh recovers')
  await page.close()

  page = await open('/rules?id=7', (route, url) => route.fulfill({ status: url.pathname.endsWith('/7') ? 503 : 200, json: url.pathname.endsWith('/7') ? failure : ok({ list: [], count: 0 }) }))
  await page.getByRole('alert').filter({ hasText: '页面错误，请刷新重试' }).waitFor()
  assert.equal(await page.getByText('安全组不存在', { exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '添加规则', exact: true }).count(), 0)
  await noRetry(page)
  await page.screenshot({ path: path.join(out, 'detail-error.png'), fullPage: true })
  passed('503 detail is a page error, never a false missing group or an editable rule list')
  await page.close()

  page = await open('/rules?id=7', (route, url) => route.fulfill({ json: ok(url.pathname.endsWith('/7') ? { security_group: {} } : { list: [], count: 0 }) }))
  await page.getByText('安全组不存在', { exact: true }).waitFor()
  assert.equal(await page.getByRole('alert').count(), 0)
  passed('a successful empty detail still identifies a truly missing group')
  await page.close()

  for (const staleFails of [false, true]) {
    const pending = defer(), started = defer()
    page = await open('/rules?id=7', async (route, url) => {
      if (await details(route, url)) return
      const direction = url.searchParams.get('direction')
      if (direction === 'in') { started.resolve(); await pending.promise }
      return route.fulfill({ json: direction === 'in' && staleFails ? failure : ok({ list: [rule(direction)], count: 1 }) })
    })
    await started.promise
    await page.getByRole('button', { name: '出站规则', exact: true }).click()
    await page.getByText('出站示例规则', { exact: true }).waitFor()
    pending.resolve(); await settled(page, 'direction=in')
    assert.equal(await page.getByRole('button', { name: '出站规则', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByText('入站示例规则', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(await page.getByText('出站示例规则', { exact: true }).count(), 1)
    passed('late inbound ' + (staleFails ? 'error' : 'success') + ' cannot overwrite the selected outbound rules')
    await page.close()
  }

  calls = []
  page = await open('/rules?id=7', async (route, url) => {
    if (await details(route, url)) return
    const p = Number(url.searchParams.get('page')), direction = url.searchParams.get('direction')
    calls.push({ page: p, direction })
    return route.fulfill({ json: ok({ list: [{ ...rule(direction), description: direction + '第' + p + '页' }], count: direction === 'in' ? 21 : 1 }) })
  })
  await page.getByText('in第1页', { exact: true }).waitFor()
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await page.getByText('in第2页', { exact: true }).waitFor()
  await page.getByRole('button', { name: '出站规则', exact: true }).click()
  await page.getByText('out第1页', { exact: true }).waitFor()
  assert.deepEqual(calls.filter(call => call.direction === 'out'), [{ page: 1, direction: 'out' }])
  passed('direction change resets pagination atomically without requesting the old page')
  await page.close()

  page = await open('/rules?id=7', async (route, url) => { if (!(await details(route, url))) await route.fulfill({ status: 503, json: failure }) })
  await page.getByRole('alert').filter({ hasText: '页面错误，请刷新重试' }).waitFor()
  await noRetry(page)
  assert.equal(await page.getByRole('button', { name: '添加规则', exact: true }).isDisabled(), true)
  assert.equal(await page.getByText('没有入站规则', { exact: true }).count(), 0)
  passed('failed rule list has no retry button, false empty state or active add action')
  await page.close()

  for (const failedSource of ['product', 'page']) {
    const reads = { page: 0, product: 0 }
    page = await open('/links', (route, url) => {
      const source = url.searchParams.get('r') === 'api.link-options' ? 'page' : 'product'
      reads[source]++
      return source === failedSource ? route.abort() : route.fulfill({ json: ok(source === 'page' ? { pages: [{ label: '示例首页', url: '/' }] } : { groups: [], products: [{ id: 1, name: '示例商品', url: '/cart/goods.htm?id=1' }] }) })
    })
    await page.getByRole('button', { name: '选择链接', exact: true }).click()
    if (failedSource === 'page') await page.getByRole('button', { name: '商品', exact: true }).click()
    await page.getByRole('button', { name: failedSource === 'product' ? '示例首页 /' : /示例商品/ }).waitFor()
    assert.equal(await page.getByRole('alert').count(), 0)
    await page.getByRole('button', { name: failedSource === 'product' ? '商品' : '主题页面', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: '页面错误，请刷新重试' }).waitFor()
    await noRetry(page)
    assert.equal(await page.getByText(failedSource === 'product' ? '没有匹配的商品' : '没有匹配的页面', { exact: true }).count(), 0)
    await page.getByRole('button', { name: '选择链接', exact: true }).click()
    await page.getByRole('button', { name: '选择链接', exact: true }).click()
    assert.deepEqual(reads, { page: 1, product: 1 })
    await page.getByRole('button', { name: '自定义', exact: true }).click()
    assert.equal(await page.getByRole('alert').count(), 0)
    await page.getByRole('textbox', { name: '跳转链接', exact: true }).fill('/about.html')
    assert.equal(await page.getByRole('textbox', { name: '跳转链接', exact: true }).inputValue(), '/about.html')
    await page.setViewportSize({ width: 390, height: 900 })
    await page.getByRole('button', { name: failedSource === 'product' ? '商品' : '主题页面', exact: true }).click()
    await page.screenshot({ path: path.join(out, 'links-' + failedSource + '-error-mobile.png'), fullPage: true })
    passed(failedSource + ' catalog failure leaves the other catalog and manual URLs usable, without retry or diagnostic text')
    await page.close()
  }

  const pending = defer()
  page = await open('/links', async (route, url) => {
    if (url.searchParams.get('r') === 'api.product-options') { await pending.promise; return route.fulfill({ json: ok({ groups: [], products: [] }) }) }
    return route.fulfill({ json: ok({ pages: [{ label: '示例首页', url: '/' }] }) })
  })
  await page.getByRole('button', { name: '选择链接', exact: true }).click()
  await page.getByRole('button', { name: '示例首页 /' }).waitFor()
  await page.getByRole('button', { name: '示例首页 /' }).click()
  assert.equal(await page.getByRole('textbox', { name: '跳转链接', exact: true }).inputValue(), '/')
  pending.resolve()
  passed('a slow product lookup does not delay selecting an already loaded page')
  await page.close()

  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.externalRequests, [])
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.failure = error.stack; throw error }
finally {
  fs.writeFileSync(path.join(out, 'security-group-links.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors }))
  await browser.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(temp, { recursive: true, force: true })
}
