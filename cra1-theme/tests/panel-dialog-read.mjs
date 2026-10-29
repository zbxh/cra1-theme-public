/** Real React/Radix dialogs with isolated responses. No V10 or business writes. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const member = path.join(root, 'cra1-theme/source/member')
const require = createRequire(path.join(member, 'package.json'))
const { buildSync } = require('esbuild')
const { chromium } = process.env.CRA1_PLAYWRIGHT_MODULE ? await import(process.env.CRA1_PLAYWRIGHT_MODULE) : require('playwright')
const out = process.env.CRA1_BROWSER_OUT
if (!out || path.resolve(out).startsWith(root + path.sep)) throw Error('Set CRA1_BROWSER_OUT outside the repository')
fs.mkdirSync(out, { recursive: true })
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cra1-dialog-read-'))
const entry = path.join(temp, 'entry.jsx')
fs.writeFileSync(entry, `
import React, {useState} from ${JSON.stringify(path.join(member, 'node_modules/react/index.js'))};
import {createRoot} from ${JSON.stringify(path.join(member, 'node_modules/react-dom/client.js'))};
import {ServerPanelDialogs} from ${JSON.stringify(path.join(member, 'src/pages/serverPanel/dialogs.jsx'))};
import {useDialogRead} from ${JSON.stringify(path.join(member, 'src/pages/serverPanel/use-dialog-read.js'))};
const fixture=window.fixture={fail:true,empty:false,reads:[],writes:0,late:[],resolvers:{}};
const disks=[{id:1,name:'示例数据盘',size:30,type2:'data',status:0}];
const rules=[{id:3,name:'示例安全组'}];
async function read(name){
 fixture.reads.push(name);
 if(fixture.fail)throw Error('SQLSTATE[HY000] /www/private/trace.php 魔方云 token=fixture-secret');
 if(name==='orderPage')return {status:200,data:{data_disk:fixture.empty?[]:[{min_value:10,max_value:100,other_config:{disk_type:'SSD'}}],config:{disk_limit_num:8},backup_config:fixture.empty?[]:[{num:2,price:1}],snap_config:fixture.empty?[]:[{num:2,price:1}]}};
 if(['diskPrice','diskResizePrice','backupConfig'].includes(name))return {status:200,data:{price:1,renew_price:2}};
 return {status:200,data:{list:fixture.empty?[]:name==='diskList'?disks:name==='securityGroupList'?rules:name==='space'?[{id:4,name:'示例备份空间',size:100,used_size:0}]:[{id:2,name:'示例网络',ips:'10.0.0.0/24'}]}};
}
const names=['orderPage','diskList','diskPrice','diskResizePrice','backupConfig','securityGroupList','vpcNetworkList','usableVpcNetwork','natAcl','natWeb'];
const api=new Proxy(Object.fromEntries(names.map(n=>[n,()=>read(n)])),{get:(target,key)=>key in target?target[key]:()=>{fixture.writes++;throw Error('Unexpected business write')}});
Object.assign(window.CRA1Shared,{Request:{request:()=>read('space'),getToken:()=> 'fixture.'+btoa(JSON.stringify({info:{id:1}}))+'.fixture'},Runtime:{common:()=>({currency_prefix:'¥',currency_suffix:'元'})},UI:{toast:(text,tone)=>{fixture.late.push({text,tone})}}});
function Race({resource,enabled}){
 const value=useDialogRead(()=>new Promise(resolve=>fixture.resolvers[resource]=resolve),[resource],enabled);
 return <><output>{JSON.stringify(value)}</output><button onClick={value.retry}>重试读取</button></>;
}
function App(){const [options,setOptions]=useState(null);window.renderFixture=setOptions;
 if(!options)return <p>请选择测试</p>;
 if(options.race)return <Race resource={options.resource} enabled={options.enabled!==false}/>;
 return <ServerPanelDialogs key={options.key} dlg={{type:options.type,isBackup:true}} setDlg={()=>setOptions(null)} api={api} host={{id:1,product_id:1,billing_cycle:'monthly'}} cloud={{id:1,backup_mode:options.space?'space':'local',backup_num:1,snap_num:1}} caps={{natAcl:true,natWeb:true}} module="mf_cloud"/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`)
buildSync({ entryPoints: [entry], outfile: path.join(temp, 'fixture.js'), bundle: true, format: 'iife', jsx: 'automatic', nodePaths: [path.join(member, 'node_modules')], define: { 'import.meta.env': '{}' }, logLevel: 'silent' })
const css = process.env.CRA1_MEMBER_CSS, sharedCss = process.env.CRA1_SHARED_CSS
const server = http.createServer((req, res) => {
  const file = req.url === '/fixture.js' ? path.join(temp, 'fixture.js') : req.url === '/member.css' ? css : req.url === '/shared.css' ? sharedCss : null
  if (file) { res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript'); return res.end(fs.readFileSync(file)) }
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end('<!doctype html><html data-cra1-theme="member"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + (css ? '<link rel="stylesheet" href="/member.css">' : '') + (sharedCss ? '<link rel="stylesheet" href="/shared.css">' : '') + '<body><div id="root"></div><script>window.CRA1Shared={UI:{},Request:{}};</script><script src="/errors.js"></script><script src="/fixture.js"></script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const report = { status: 'running', checks: [], errors: [], real_business_writes: 0 }
let key = 0
const unsafe = /SQLSTATE|fixture-secret|\/www\/|魔方云|插件未安装|后台点击|检查兼容性|同步暂时失败|正在重试/
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) throw Error('Unexpected external request')
    if (url.pathname === '/errors.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'public/cra1-shared/src/errors.js'), 'utf8') })
    return route.continue()
  })
  page.on('pageerror', error => report.errors.push(error.message))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.goto(origin)
    await page.waitForFunction(() => typeof window.renderFixture === 'function')
    for (const [type, options, submit] of [
      ['securityGroup', {}, '绑定'], ['diskOrder', {}, '提交订单'], ['diskResize', {}, '提交扩容'],
      ['bsConfig', {}, '提交调整'], ['bsCreate', {}, '创建'], ['bsCreate', { space: true }, '创建'],
      ['vpc', {}, '创建 VPC 网络'], ['nat', {}, '添加转发规则'],
    ]) {
      const id = `${type}${options.space ? '-space' : ''}-${width}`
      await page.evaluate(options => { fixture.fail = true; fixture.empty = false; renderFixture(options) }, { type, ...options, key: ++key })
      const dialog = page.getByRole('dialog')
      await dialog.getByText('页面错误，请刷新重试', { exact: true }).waitFor();assert.equal(await dialog.getByRole('button', { name: '重新加载', exact: true }).count(), 0, id + ' has no retry control')
      assert.equal(unsafe.test(await dialog.innerText()), false, id + ' hides diagnostic details')
      assert.equal(await dialog.getByText(/暂无|未加入任何|未开放|未配置可调整/).count(), 0, id + ' is not a false empty state')
      const button = dialog.getByRole('button', { name: submit, exact: true })
      assert.equal(await button.count() === 0 || await button.isDisabled(), true, id + ' cannot submit before read')
      await page.screenshot({ path: path.join(out, id + '-failure.png'), fullPage: true })
      await page.reload();await page.waitForFunction(() => typeof window.renderFixture === 'function');await page.evaluate(options => {fixture.fail = false;renderFixture(options)}, {type,...options,key:++key})
      await page.waitForTimeout(650)
      assert.equal(await dialog.getByRole('button', { name: '重新加载', exact: true }).count(), 0, id + ' refresh allows a clean read')
      assert.equal(unsafe.test(await dialog.innerText()), false, id + ' recovered copy is safe')
      await page.screenshot({ path: path.join(out, id + '-recovered.png'), fullPage: true })
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog').count(), 0, id + ' can cancel')
      await page.evaluate(options => { fixture.empty = true; renderFixture(options) }, { type, ...options, key: ++key })
      await page.waitForTimeout(250)
      assert.equal(await page.getByRole('dialog').getByRole('button', { name: '重新加载', exact: true }).count(), 0, id + ' genuine empty is not failure')
      await page.keyboard.press('Escape')
      report.checks.push(id + ': failure without retry, refresh, empty, cancel')
    }
  }
  await page.evaluate(() => { fixture.resolvers = {}; renderFixture({ race: true, resource: 'old' }) })
  await page.waitForFunction(() => Boolean(fixture.resolvers.old))
  await page.evaluate(() => renderFixture({ race: true, resource: 'new' }))
  await page.waitForFunction(() => Boolean(fixture.resolvers.new))
  await page.evaluate(() => fixture.resolvers.new('current-result'))
  await page.waitForFunction(() => document.querySelector('output').textContent.includes('current-result'))
  await page.evaluate(() => fixture.resolvers.old('stale-result'))
  assert.match(await page.locator('output').innerText(), /current-result/)
  assert.doesNotMatch(await page.locator('output').innerText(), /stale-result/)
  report.checks.push('late response never replaces a newer resource')
  await page.evaluate(() => renderFixture({ race: true, resource: 'disabled', enabled: false }))
  await page.waitForTimeout(50)
  assert.equal(await page.evaluate(() => Boolean(fixture.resolvers.disabled)), false)
  report.checks.push('disabled capability never loads its data')
  assert.equal(await page.evaluate(() => fixture.writes), 0)
  assert.deepEqual(report.errors, [])
  report.status = 'passed'
  fs.writeFileSync(path.join(out, 'panel-dialog-read.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, real_business_writes: 0 }))
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
  fs.rmSync(temp, { recursive: true, force: true })
}
