/** Native views keep their own Vue tree while the theme supplies navigation. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const root=path.resolve(new URL('../..',import.meta.url).pathname),native=process.env.CRA1_NATIVE_ROOT,out=process.env.CRA1_BROWSER_OUT
if(!native||!out)throw Error('Explicit read-only native fixtures and isolated output required')
const {chromium}=createRequire(process.env.CRA1_PLAYWRIGHT_PACKAGE||path.join(root,'cra1-theme/scripts/package.json'))('playwright')
const script=fs.readFileSync(path.join(root,'public/clientarea/template/pc/cra1/js/native-page.js'))
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture.invalid')
 if(u.pathname==='/vue.js'){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(native,'public/clientarea/template/pc/default/js/common/vue.js')));return}
 if(u.pathname==='/native-page.js'){res.setHeader('content-type','text/javascript');res.end(script);return}
 res.setHeader('content-type','text/html; charset=utf-8')
 const original=u.searchParams.has('original'),cart=u.pathname.startsWith('/cart/')
 res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>.template{display:none}.cra1-native-page__content>.template{display:block}.cra1-shell{display:flex}.cra1-shell__body{min-width:0;flex:1}.cra1-native-page__navigation{display:contents}</style><script src="/vue.js"></script><body>'+(original?'<div class="cra1-shell"><aside-menu></aside-menu></div>':'')+'<div id="business" class="template"><label>配置<input v-model="value"></label><button @click="clicks++">模块操作</button><span>{{clicks}}</span></div><script>const asideMenu={template:"<aside class=cra1-aside>产品管理</aside>"},topMenu={template:"<header class=cra1-header>控制台</header>"};window.mounts=0;window.vm=new Vue({data:()=>({value:"保留输入",clicks:0}),mounted(){mounts++}}).$mount("#business");window.nativeElement=vm.$el;window.loadCalls=0;window.onload=()=>loadCalls++;</script><script src="/native-page.js"></script>')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']}),checks=[],errors=[]
function check(ok,label){assert.ok(ok,label);checks.push(label)}
fs.mkdirSync(out,{recursive:true})
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/module/future_server/product_detail.htm?id=1')
 check(await page.evaluate(()=>mounts===1&&vm.$el===nativeElement&&document.querySelector('main #business')===nativeElement),'native view is moved without recompiling or replaying its lifecycle')
 check(await page.locator('.cra1-aside').count()===1&&await page.locator('.cra1-header').count()===1,'missing native navigation mounts once around the existing module')
 await page.locator('#business input').fill('已修改的配置');await page.getByRole('button',{name:'模块操作'}).click()
 check(await page.evaluate(()=>vm.value==='已修改的配置'&&vm.clicks===1&&loadCalls===1),'native input binding, events and original load handler survive')
 await page.addScriptTag({url:origin+'/native-page.js'})
 check(await page.locator('.cra1-aside').count()===1&&await page.evaluate(()=>mounts===1),'repeated adapter execution is idempotent')
 for(const width of[1920,1440,768,390]){await page.setViewportSize({width,height:900});check(await page.locator('#business').isVisible(),'native root remains visible at '+width);await page.screenshot({path:path.join(out,'native-shell-'+width+'.png'),fullPage:true})}
 await page.goto(origin+'/module/future_server/product_detail.htm?original=1');check(await page.locator('#cra1-native-page').count()===0,'a module providing its own shell is left intact')
 await page.goto(origin+'/cart/goods_embed.htm?id=1');check(await page.locator('#cra1-native-page').count()===0,'cart iframe never receives member navigation')
 check(errors.length===0,'no browser runtime errors')
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'passed',checks,errors},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length}))
}finally{await browser.close();server.close()}
