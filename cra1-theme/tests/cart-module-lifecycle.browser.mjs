/** Real installed templates/resources with isolated third-party module responses. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{chromium}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright')
const origin=process.env.CRA1_ISOLATED_ORIGIN,out=process.env.CRA1_MODULE_COMPAT_OUT
if(!origin||!['127.0.0.1','localhost'].includes(new URL(origin).hostname)||!out)throw Error('An isolated origin and external output are required')
fs.mkdirSync(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),checks=[],errors=[],blocked=[]
const products=[501,502,503].map((id,i)=>({id,name:'兼容模块 '+['A','B','C'][i],description:'<p>隔离测试模块配置</p>',price:'12.00',cycle:'月',product_group_id:301,product_group_id_first:300,hidden:0,stock_control:0}))
const json=(route,data)=>route.fulfill({json:{status:200,msg:'操作成功',data}})
function check(ok,label){assert.ok(ok,label);checks.push(label);console.log(label)}
let page
try{
 for(const width of (process.env.CRA1_TEST_WIDTHS||'1920,1440,768,390').split(',').map(Number)){
  const mobile=width===390
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:960},...(mobile?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}:{})})
  let failNext=false,delayNext=false
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname
   if(u.origin!==origin)return route.abort()
   if(!['GET','HEAD'].includes(req.method())){blocked.push(p);return route.fulfill({json:{status:400,msg:'隔离测试不提交业务操作'}})}
   if(p==='/console/v1/product/group/first')return json(route,{list:[{id:300,name:'兼容性演示'}]})
   if(p==='/console/v1/product/group/second')return json(route,{list:[{id:301,name:'第三方模块',type:'normal',description:''}]})
   if(p==='/console/v1/product')return json(route,{list:Number(u.searchParams.get('page')||1)>1?[]:products,count:products.length})
   const detail=/^\/console\/v1\/product\/(50[123])$/.exec(p)
   if(detail)return json(route,{product:products.find(x=>x.id===Number(detail[1]))})
   const config=/^\/console\/v1\/product\/(50[123])\/config_option$/.exec(p)
   if(config){
    if(delayNext&&config[1]==='503'){delayNext=false;await new Promise(r=>setTimeout(r,700))}
    return json(route,{content:'<style>.third-party-module{padding:12px;box-sizing:border-box;max-width:100%;font-size:14px}.third-party-module select{max-width:100%;height:40px}.third-party-module .f-order{position:static!important;width:100%!important;box-sizing:border-box}</style><div class="template third-party-module" data-pid="'+config[1]+'"><main><h2>原生模块 '+config[1]+'</h2><label>规格 <select v-model="plan"><option>标准版</option><option>专业版</option></select></label></main><div class="f-order"><p>当前价格 ¥12.00 / 月</p><button type="button" @click="bought++">原生订购 {{bought}}</button></div></div><script src="/fixture/vendor-boot.js"></scr'+'ipt>'})
   }
   if(p==='/fixture/vendor-boot.js'){
    if(failNext){failNext=false;return route.abort()}
    return route.fulfill({contentType:'text/javascript',body:'const thirdPartyVM=new Vue({el:".third-party-module",data:{plan:"标准版",bought:0}});window.vendorMounts=(window.vendorMounts||0)+1;'})
   }
   return route.continue()
  })
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto(origin+'/cart/goodsList.htm?product_id=501',{waitUntil:'domcontentloaded',timeout:60000})
  const ready=async id=>{
   await page.waitForFunction(id=>{const v=document.querySelector('.template')?.__vue__;return v&&v.selectedProductId===id&&v.configState==='ready'},id,{timeout:45000})
   const frame=page.frameLocator('.cl-config-frame')
   await frame.getByRole('heading',{name:'原生模块 '+id,exact:true}).waitFor()
   return frame
  }
  let frame=await ready(501)
  check(await frame.getByRole('button',{name:'原生订购 0',exact:true}).isVisible(),'unknown module retains native purchase controls '+width)
  await frame.getByRole('combobox').selectOption({label:'专业版'})
  await frame.getByRole('button',{name:'原生订购 0',exact:true}).click()
  check(await frame.getByRole('button',{name:'原生订购 1',exact:true}).isVisible(),'unknown module selection and action remain live '+width)
  const choose=async id=>{
   await page.locator('.cl-goods-card').filter({hasText:products.find(p=>p.id===id).name}).click()
   const confirm=page.locator('.el-message-box__btns .el-button--primary')
   if(await confirm.isVisible().catch(()=>false))await confirm.click()
  }
  for(const id of [502,501]){
   await choose(id)
   frame=await ready(id)
   check(await frame.locator('body').evaluate(()=>window.vendorMounts===1),'A-B-A creates a fresh module script context '+width+' '+id)
  }
  check(await page.evaluate(()=>!window.vendorMounts&&!window.thirdPartyVM),'module globals do not leak into the catalog '+width)
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'catalog has no horizontal overflow '+width)
  check(await frame.locator('html').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'module has no horizontal overflow '+width)
  await page.evaluate(()=>scrollTo(0,0))
  await page.screenshot({path:path.join(out,'third-party-cart-'+width+'.png'),fullPage:true})
  if(mobile){
   failNext=true
   await choose(502)
   await page.getByRole('button',{name:'重试',exact:true}).waitFor()
   check(await page.locator('.cl-config-error').isVisible(),'failed native script is reported as a retryable configuration failure')
   await page.getByRole('button',{name:'重试',exact:true}).click();await ready(502)
   check(true,'retry really reruns the native boot script')
   delayNext=true
   await choose(503)
   await page.waitForTimeout(70)
   await choose(501)
   await ready(501);await page.waitForTimeout(900)
   check(await page.evaluate(()=>document.querySelector('.template').__vue__.selectedProductId===501),'late old configuration cannot replace the current selection')
  }
  await context.close()
 }
 check(errors.length===0,'no unhandled errors or duplicate global declarations in actual cart pages')
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'passed',checks,errors,blocked},null,2))
 console.log(JSON.stringify({status:'passed',checks:checks.length}))
}catch(error){if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,errors},null,2));throw error}
finally{await browser.close()}
