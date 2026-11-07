/** Compare module data/boot semantics with the installed official jQuery loader. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{chromium}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright')
const root=path.resolve(new URL('../..',import.meta.url).pathname)
const out=process.env.CRA1_MODULE_DATA_OUT,stage=process.env.CRA1_MODULE_DATA_STAGE,baseline=process.env.CRA1_MODULE_DATA_BASELINE
if(!out)throw Error('Set CRA1_MODULE_DATA_OUT outside the public root')
fs.mkdirSync(out,{recursive:true})
const release=stage?JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release:''
function source(regular,built){return path.join(baseline||stage||root,stage?built:regular)}
const assets={
 '/vue.js':path.join(root,'public/clientarea/template/pc/default/js/common/vue.js'),
 '/jquery.js':path.join(root,'public/clientarea/template/pc/default/js/common/jquery.mini.js'),
 '/policy.js':source('cra1-theme/source/legacy-assets/cart/20261012-cart-entry-v1/js/module-policy.js',`public/cart/template/pc/cra1/releases/${release}/20261012-cart-entry-v1/js/module-policy.js`),
 '/deps.js':source('public/clientarea/template/pc/cra1/js/module-deps.js',`public/clientarea/template/pc/cra1/releases/${release}/js/module-deps.js`),
 '/controls.js':source('cra1-theme/source/legacy-assets/cart/20261012-icon-suite-v1/js/cart-controls.js',`public/cart/template/pc/cra1/releases/${release}/20261012-icon-suite-v1/js/cart-controls.js`),
 '/cart.css':source('public/cra1-shared/theme-sources/cart/cart-theme.css',`public/cart/template/pc/cra1/releases/${release}/20261012-icon-suite-v1/css/cart-theme.css`),
 '/embed.css':source('public/cra1-shared/theme-sources/cart/goods_embed.css',`public/cart/template/pc/cra1/releases/${release}/20261011-titanium-v1/css/goods_embed.css`)
}
const boot='const node=document.querySelector(".vendor-module #vendor-config");const settings=node?JSON.parse(node.textContent):{bandwidth:"未读取",traffic:"未读取"};window.vendorVM=new Vue({el:".vendor-module",data:{bandwidth:settings.bandwidth,traffic:settings.traffic},methods:{async update(){Object.assign(this,await(await fetch("/vendor/quote")).json())}}})'
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://fixture.invalid').pathname
 if(p==='/vendor/quote'){res.setHeader('content-type','application/json');res.end(JSON.stringify({bandwidth:37,traffic:3072}));return}
 if(p==='/vendor.js'){res.setHeader('content-type','text/javascript');res.end(boot);return}
 if(p.includes('/components/vendorBadge/')){res.setHeader('content-type','text/javascript');res.end('var vendorBadge={template:"<span>"+vendorSettings.label+"</span>"};window.vendorDeclaration=vendorSettings.label');return}
 if(assets[p]){res.setHeader('content-type',p.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(assets[p]));return}
 res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><html data-cra1-theme="cart"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="host" class="goods cart-page cart-embed"></div><script src="/vue.js"></script><script src="/jquery.js"></script><script src="/deps.js"></script><script src="/policy.js"></script><script src="/controls.js"></script></html>')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const report={checks:[],failures:[],errors:[]}
async function run(label,fn){try{await fn();report.checks.push(label);console.log('PASS '+label)}catch(e){report.failures.push({label,message:e.message});console.log('FAIL '+label)}}
async function fresh(mode,html,work){const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.goto(origin+'/fixture.htm',{waitUntil:'load'});await page.evaluate(async({mode,html})=>{const host=document.getElementById('host');if(mode==='official'){$.ajaxSetup({cache:true});$(host).html(html)}else{host.innerHTML=CRA1CartControls.transform(html,'vendor_module');await CRA1ModuleDeps.mountScripts(host)}},{mode,html});return await work(page,errors)}finally{await page.close()}}
try{
 for(const mode of ['official','cra1']){
  for(const external of [false,true])await run(mode+' nested JSON remains readable '+(external?'external':'inline'),async()=>{
   const html='<div class="vendor-module"><script type="application/json" id="vendor-config">{"bandwidth":19,"traffic":768}</scr'+'ipt><p>带宽：<span id="bw">{{bandwidth}}</span>Mbps</p><p>流量：<span id="traffic">{{traffic}}</span>GB/月</p><button @click="update">切换配置</button></div>'+(external?'<script src="/vendor.js"></scr'+'ipt>':'<script>'+boot+'</scr'+'ipt>')
   await fresh(mode,html,async(page,errors)=>{
    assert.equal(await page.locator('#bw').textContent(),'19');assert.equal(await page.locator('#traffic').textContent(),'768')
    assert.equal(await page.locator('.vendor-module #vendor-config').count(),1)
    await page.getByRole('button',{name:'切换配置'}).click();await page.waitForFunction(()=>document.getElementById('bw').textContent==='37')
    assert.equal(await page.locator('#traffic').textContent(),'3072');assert.deepEqual(errors,[])
   })
  })
  await run(mode+' text/x-template is present before boot and stays nested',async()=>{
   const html='<div id="templates"><script type="text/x-template" id="vendor-row"><span class="vendor-row">{{value}}</span></scr'+'ipt></div><div id="vendor-view"><vendor-row value="原始模板"></vendor-row></div><script>Vue.component("vendor-row",{template:"#vendor-row",props:["value"]});new Vue({el:"#vendor-view"});</scr'+'ipt>'
   await fresh(mode,html,async(page,errors)=>{assert.equal(await page.locator('.vendor-row').textContent(),'原始模板');assert.equal(await page.locator('#templates #vendor-row').count(),1);assert.deepEqual(errors,[])})
  })
  await run(mode+' JavaScript MIME types execute',async()=>{
   const html='<script type="text/ecmascript">window.ecma=1;</scr'+'ipt><script type="application/ecmascript">window.legacyJS=2;</scr'+'ipt><script type="text/javascript;version=1.0">window.versionedJS=3;</scr'+'ipt>'
   await fresh(mode,html,async(page,errors)=>{assert.deepEqual(await page.evaluate(()=>[window.ecma,window.legacyJS,window.versionedJS]),[1,2,3]);assert.deepEqual(errors,[])})
  })
  await run(mode+' declaration order preserves inline prerequisites',async()=>{
   const html='<script>window.vendorSettings={label:"模块设定"};</scr'+'ipt><script src="/clientarea/template/pc/default/components/vendorBadge/vendorBadge.js"></scr'+'ipt><script>window.vendorBoot=vendorBadge.template;</scr'+'ipt>'
   await fresh(mode,html,async(page,errors)=>{assert.equal(await page.evaluate(()=>window.vendorDeclaration),'模块设定');assert.match(await page.evaluate(()=>window.vendorBoot),/模块设定/);assert.deepEqual(errors,[])})
  })
 }
 await run('unknown module keeps borrowed class names and bindings unchanged',async()=>{
  await fresh('cra1','',async page=>{
   const html='<link href="/plugins/server/mf_cloud/template/cart/pc/default/goods.css"><div class="top-tab"><p class="com-tit">{{vendorHeading}}</p><el-form-item class="image">自定义镜像控件</el-form-item></div>'
   assert.equal(await page.evaluate(html=>CRA1CartControls.transform(html,'vendor_module'),html),html)
   assert.equal(await page.evaluate(html=>CRA1CartControls.transform(html),html),html)
   assert.equal(await page.evaluate(html=>CRA1CartControls.transform(html,'mf_cloud').includes('cra1-cart-images'),html),true)
  })
 })
 for(const width of [1440,768,390,320])await run('unknown module keeps native visibility/layout '+width,async()=>{
  await fresh('cra1','',async page=>{
   await page.setViewportSize({width,height:900});await page.evaluate(()=>{
    document.documentElement.setAttribute('data-cra1-native-module','');const host=document.getElementById('host');host.setAttribute('data-cra1-native-module','')
    host.innerHTML='<style>.vendor-module{font:14px/1.5 sans-serif;padding:12px}.vendor-module .f-order{display:none}.vendor-module .top-tab{border:1px solid #ddd;padding:12px}.vendor-module select{max-width:100%}</style><div class="template vendor-module"><div class="tit">第三方商品标题</div><div class="top-tab"><div class="el-tabs__header">模块自己的选项标题</div><label>套餐 <select><option>基础配置</option><option>扩展配置</option></select></label></div><div class="f-order">模块控制的条件区域</div><button>模块自己的订购按钮</button></div>'
    for(const href of ['/cart.css','/embed.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link)}
   });await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.endsWith('/embed.css')))
   assert.equal(await page.locator('.tit').isVisible(),true);assert.equal(await page.locator('.f-order').isVisible(),false)
   assert.equal(await page.locator('.el-tabs__header').evaluate(e=>getComputedStyle(e,'::before').content),'none')
   await page.screenshot({path:path.join(out,'native-module-'+width+'.png')})
  })
 })
 report.status=report.failures.length?'failed':'passed';fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2))
 assert.equal(report.failures.length,0,JSON.stringify(report.failures));console.log(JSON.stringify({status:report.status,checks:report.checks.length}))
}finally{await browser.close();server.close()}
