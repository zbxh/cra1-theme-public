/** Optional native extensions obey the effective server projection before mount. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const root=path.resolve(new URL('../..',import.meta.url).pathname),native=process.env.CRA1_NATIVE_ROOT,out=process.env.CRA1_BROWSER_OUT
if(!native||!out)throw Error('Explicit native fixture and output directory required')
const {chromium}=createRequire(process.env.CRA1_PLAYWRIGHT_PACKAGE||path.join(root,'cra1-theme/scripts/package.json'))('playwright')
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture.invalid')
 if(u.pathname==='/vue.js'){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync(path.join(native,'public/clientarea/template/pc/default/js/common/vue.js')))}
 if(u.pathname==='/guard.js'){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync(path.join(root,'public/clientarea/template/pc/cra1/js/native-capabilities.js')))}
 res.setHeader('content-type','text/html; charset=utf-8')
 const enabled=u.searchParams.get('enabled'),projection=enabled==='missing'?'':`window.__CRA1_RUNTIME__={app_presets:${enabled==='1'}};`
 res.end(`<!doctype html><script src="/vue.js"></script><script>${projection}window.reads=0;</script><script src="/guard.js"></script><script src="/guard.js"></script><div id="product_detail_cloud"><input v-model="value"><button @click="getReinstallAppPresets">选择镜像</button><el-tab-pane name="app_preset">应用预设</el-tab-pane><div class="app-preset-reinstall">重装预设</div><el-dialog><div class="app-preset-client-dialog">凭据</div></el-dialog></div><script>window.nativeView=new Vue({data:()=>({value:'原始输入',appPresetTasks:[],appPresetTaskTimer:null,appPresetTaskParams:{total:0},appPresetList:[],appPresetLoading:false,reinstallData:{app_preset_id:0}}),methods:{getAppPresetTasks(){reads++;return Promise.resolve()},getReinstallAppPresets(){reads++;return Promise.resolve()}},created(){this.getAppPresetTasks()}}).$mount('#product_detail_cloud')</script>`)
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({args:['--no-sandbox']}),checks=[],errors=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label)}
fs.mkdirSync(out,{recursive:true})
try{
 for(const [pathname,enabled,allowed]of [['/module/mf_cloud/product_detail.htm','0',false],['/module/mf_cloud/product_detail.htm','missing',false],['/module/mf_cloud/product_detail.htm','1',true],['/productdetail.htm','0',true],['/module/future_server/product_detail.htm','0',true]]){
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+pathname+'?enabled='+enabled)
  check(await page.evaluate(()=>reads)===(allowed?1:0),'initial task query obeys capabilities '+pathname+' '+enabled)
  check(await page.locator('el-tab-pane[name=app_preset]').count()===(allowed?1:0)&&await page.locator('.app-preset-reinstall').count()===(allowed?1:0),'unavailable tab and reinstall selector removed before Vue compiles '+pathname+' '+enabled)
  check(await page.locator('.app-preset-client-dialog').count()===(allowed?1:0),'unavailable credential dialog omitted '+pathname+' '+enabled)
  await page.locator('input').fill('仍可编辑');await page.getByRole('button',{name:'选择镜像'}).click()
  check(await page.evaluate(()=>reads)===(allowed?2:0),'reinstall query obeys capabilities '+pathname+' '+enabled)
  check(await page.evaluate(()=>nativeView.value)==='仍可编辑','native bindings preserved '+pathname+' '+enabled)
  await page.close()
 }
 check(errors.length===0,'no runtime errors')
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'passed',checks,errors},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length}))
}finally{await browser.close();server.close()}
