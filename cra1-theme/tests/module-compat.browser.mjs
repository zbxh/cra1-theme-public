/** Exercise the shipped adapters in a browser; all business data is synthetic. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright')
const root=path.resolve(new URL('../..',import.meta.url).pathname)
const out=process.env.CRA1_MODULE_COMPAT_OUT,native=process.env.CRA1_NATIVE_ROOT
if(!out||!native)throw Error('Set CRA1_MODULE_COMPAT_OUT and CRA1_NATIVE_ROOT outside the public root')
fs.mkdirSync(out,{recursive:true})
let retries=0
const server=http.createServer((req,res)=>{
 if(process.env.CRA1_TEST_DEBUG)console.log('request',req.url)
 const u=new URL(req.url,'http://fixture.invalid')
 res.setHeader('cache-control','no-store')
 if(u.pathname==='/fixture.htm'){
  res.setHeader('content-type','text/html; charset=utf-8')
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="host"></div><script>window.__CRA1_SHARED_BASE__="/native/";window.url="/native/";window.lang={};window.CRA1Shared={Request:{getToken:()=>"fixture-token",request:()=>Promise.resolve({data:window.fixtureAccess})}};window.fixtureAccess={all:false,pages:[{url:"/plugin/91/source.htm",allowed:false},{url:"/plugin/91/source.htm?tab=allowed",allowed:true},{url:"/plugin/92/source.htm",allowed:true}],known:[],rules:[]};</script><script src="/native/js/common/vue.js"></script><script src="/runtime.js"></script><script>const asideMenu={theme:true},topMenu={theme:true};</script><script src="/deps.js"></script>')
  return
 }
 if(u.pathname.includes('/template/pc/cra1/components/futureBadge/')){res.writeHead(404);res.end();return}
 if(u.pathname.includes('/components/futureBadge/')){
  res.setHeader('content-type','text/javascript');res.end('const futureBadge={name:"future-native"};window.futureLoads=(window.futureLoads||0)+1');return
 }
 if(u.pathname==='/retry.js'){
  if(!retries++){res.writeHead(503);res.end();return}
  res.setHeader('content-type','text/javascript');res.end('window.retryReady=true');return
 }
 if(u.pathname==='/slow.js'){setTimeout(()=>{res.setHeader('content-type','text/javascript');res.end('window.staleBoot=true')},400);return}
 let file=u.pathname==='/deps.js'?path.join(root,'public/clientarea/template/pc/cra1/js/module-deps.js'):u.pathname==='/runtime.js'?path.join(root,'public/cra1-shared/src/runtime.js'):u.pathname.startsWith('/native/')?path.join(native,'public/clientarea/template/pc/default',u.pathname.slice(8)):null
 if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(file))
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']}),checks=[]
function check(value,label){assert.ok(value,label);checks.push(label);console.log(label)}
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);if(process.env.CRA1_TEST_DEBUG)console.log('pageerror',e.message)})
 await page.goto(origin+'/fixture.htm')
 const nav=await page.evaluate(async()=>{
  const s=CRA1Shared
  const pending=s.Access.canUrl('/plugin/91/source.htm')
  await s.Access.read()
  return {pending,denied:s.Access.canUrl('/plugin/91/source.htm?id=10'),allowed:s.Access.canUrl('/plugin/92/source.htm?id=1'),specific:s.Access.canUrl('/plugin/91/source.htm?tab=allowed&id=2'),other:s.Access.canUrl('/plugin/93/third.htm'),external:s.Navigation.href('https://example.invalid/a'),embedded:s.Navigation.href({type:'embedded',url:'https://example.invalid/a?b=1&c=2'}),invalid:s.Navigation.href('javascript:alert(1)'),root:s.Navigation.href('/plugin/92/source.htm'),contact:s.Navigation.href('mailto:support@example.invalid'),anchor:s.Navigation.href('#help'),legacy:s.Navigation.href('custom_iframe.htm?iframe_url=https://example.invalid/a?b=1&c=2')}
 })
 check(!nav.pending&&!nav.denied&&nav.allowed&&nav.specific&&nav.other,'native page registry governs new plugin grants without denying unregistered pages')
 check(nav.embedded==='/custom_iframe.htm?iframe_url='+encodeURIComponent('https://example.invalid/a?b=1&c=2'),'embedded route encodes the complete target exactly once')
 check(nav.contact==='mailto:support@example.invalid'&&nav.anchor==='#help'&&nav.legacy===nav.embedded,'contact links, anchors and legacy embedded URLs retain native semantics')
 check(nav.external==='https://example.invalid/a'&&nav.invalid===''&&nav.root==='/plugin/92/source.htm','external/root URLs remain usable and unsafe schemes are rejected')
 await page.evaluate(async()=>{
  const host=document.getElementById('host')
  const html='<h2>第三方模块配置</h2><p>保留模块自己的配置与订购控件</p><script>window.boots=(window.boots||0)+1;window.shellIntact=asideMenu.theme&&topMenu.theme;window.futureAvailable=futureBadge.name;</scr'+'ipt><script src="/clientarea/template/pc/default/components/asideMenu/asideMenu.js"></scr'+'ipt><script src="/clientarea/template/pc/cra1/components/futureBadge/futureBadge.js"></scr'+'ipt>'
  host.innerHTML=html;await CRA1ModuleDeps.mountScripts(host)
  host.innerHTML=html;await CRA1ModuleDeps.mountScripts(host)
 })
 check(await page.evaluate(()=>boots===2&&futureLoads===1&&shellIntact&&futureAvailable==='future-native'),'unlisted declared components fall back to native dependencies and load once; per-page boot runs again; theme shell survives')
 const retry=await page.evaluate(async()=>{
  const host=document.getElementById('host'),html='<script src="/retry.js"></scr'+'ipt>'
  host.innerHTML=html;let failed=false
  try{await CRA1ModuleDeps.mountScripts(host)}catch{failed=true}
  host.innerHTML=html;await CRA1ModuleDeps.mountScripts(host)
  return failed&&window.retryReady
 })
 check(retry,'failed script rejects the mount and a subsequent retry succeeds')
 check(await page.evaluate(async()=>{
  const host=document.getElementById('host'),controller=new AbortController()
  host.innerHTML='<script src="/slow.js"></scr'+'ipt>'
  const loading=CRA1ModuleDeps.mountScripts(host,{signal:controller.signal,fetchScripts:true}).catch(e=>e.name)
  setTimeout(()=>controller.abort(),20)
  const result=await loading;await new Promise(r=>setTimeout(r,500))
  return result==='AbortError'&&!window.staleBoot
 }),'cancelled phone resource cannot execute against the next product')
 await page.evaluate(async()=>{await CRA1ModuleDeps.ensure('config');await CRA1ModuleDeps.ensure('config')})
 check(errors.length===0,'actual native component dependencies initialize without duplicate bindings')
 for(const width of [1920,1440,768,390]){
  await page.setViewportSize({width,height:900})
  await page.evaluate(()=>{document.getElementById('host').innerHTML='<h2>模块兼容验证</h2><p>内嵌菜单 · 页面权限 · 脚本重试 · 切换隔离</p>'})
  await page.screenshot({path:path.join(out,'module-adapter-'+width+'.png'),fullPage:true})
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'passed',checks,errors},null,2))
 console.log(JSON.stringify({status:'passed',checks:checks.length}))
}finally{await browser.close();server.close()}
