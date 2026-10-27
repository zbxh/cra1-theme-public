/** Layout regression fixtures use installed V10 Vue/Element without business APIs. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright')
const source=path.resolve(process.env.CRA1_RESPONSIVE_SOURCE_ROOT||new URL('../..',import.meta.url).pathname)
const native=process.env.CRA1_NATIVE_ROOT
if(!native)throw Error('Set CRA1_NATIVE_ROOT to a read-only installed V10 reference.')
const read=file=>fs.readFileSync(path.join(source,file),'utf8')
const reference=file=>fs.readFileSync(path.join(native,'public/clientarea/template/pc/default',file),'utf8')
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const checks=[],errors=[]
function check(value,label){assert.ok(value,label);checks.push(label)}
async function fixture(theme,html,styles){
 const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'reduce'})
 page.setDefaultTimeout(5000)
 page.on('pageerror',error=>errors.push(error.message))
 await page.setContent(`<html data-cra1-theme="${theme}"><head></head><body>${html}</body></html>`)
 await page.addStyleTag({content:reference('css/common/element-comment.css')})
 await page.addStyleTag({content:'html{font-size:16px}body{margin:0}*{box-sizing:border-box}.main-card{padding:24px}'})
 for(const file of styles)await page.addStyleTag({content:read(file)})
 await page.addScriptTag({content:reference('js/common/vue.js')})
 await page.addScriptTag({content:reference('js/common/element.js')})
 return page
}
try{
 const table=await fixture('member','<div id="app" class="template ticket"><div class="tabledata"><el-table :data="rows"><el-table-column prop="title" label="标题" min-width="400" :show-overflow-tooltip="true"></el-table-column><el-table-column prop="status" label="状态"></el-table-column></el-table></div></div>', ['public/cra1-shared/theme-sources/member/cra1-shell.css','public/cra1-shared/src/adapters.css'])
 await table.evaluate(()=>{window.fixture=new Vue({el:'#app',data:{rows:[{title:'服务使用咨询',status:'已回复'}]}});window.fixtureTicks=0;window.setInterval(()=>window.fixtureTicks++,25)})
 await table.waitForFunction(()=>window.fixtureTicks>=3,{},{timeout:2000})
 for(const width of [390,768,1920,390]){
  await table.setViewportSize({width,height:900})
  check(await table.getByText('服务使用咨询',{exact:true}).isVisible(),`ticket content remains visible at ${width}`)
  const tick=await table.evaluate(()=>window.fixtureTicks)
  await table.waitForFunction(t=>window.fixtureTicks>t,tick,{timeout:2000})
  check(true,`native table yields to timers after resize ${width}`)
  check(await table.locator('.el-table__body tr').first().evaluate(el=>{const r=el.getBoundingClientRect();return [...el.querySelectorAll('.cell')].every(cell=>{const c=cell.getBoundingClientRect();return c.bottom<=r.bottom+1&&(innerWidth>=768||(c.left>=r.left-1&&c.right<=r.right+1))})}),`ticket row contains its content at ${width}`)
 }
 await table.close()
 const popup=await fixture('cart','<div id="app" class="cart-page"><div class="f-order"><div class="mid"><el-popover trigger="click" placement="top" popper-class="fixture-fee"><p>配置费用明细</p><button slot="reference">查看明细</button></el-popover></div></div></div>', ['public/cra1-shared/theme-sources/cart/cart-theme.css'])
 await popup.evaluate(()=>new Vue({el:'#app'}))
 for(const width of [390,768,1920]){
  await popup.setViewportSize({width,height:900})
  check(!await popup.locator('.fixture-fee').isVisible(),`closed fee popover stays hidden at ${width}`)
  await popup.getByRole('button',{name:'查看明细',exact:true}).click()
  await popup.locator('.fixture-fee').waitFor({state:'visible'})
  check(true,`fee popover opens at ${width}`)
  await popup.getByRole('button',{name:'查看明细',exact:true}).click()
  await popup.locator('.fixture-fee').waitFor({state:'hidden'})
 }
 await popup.close()
 const filters=await fixture('member','<div id="app"><div class="template help-total"><div class="main-card"><img class="back-img" alt="装饰"><el-input class="search-input" placeholder="搜索帮助"></el-input></div></div><div id="domain" class="template"><div class="content-box"><div class="list-top"><div class="left"></div><div class="right"><el-input class="keywords" placeholder="域名"></el-input><el-date-picker class="date-range" type="daterange"></el-date-picker><el-button class="search">查询</el-button></div></div></div></div></div>', ['public/cra1-shared/src/adapters.css'])
 await filters.addStyleTag({content:fs.readFileSync(path.join(native,'public/plugins/addon/idcsmart_domain/template/clientarea/pc/default/css/domain.css'),'utf8')})
 await filters.evaluate(()=>new Vue({el:'#app'}))
 check(!await filters.locator('.help-total .back-img').isVisible(),'help artwork does not cover mobile search')
 const bounds=await filters.locator('#domain .right').evaluate(el=>{const r=el.getBoundingClientRect();return [...el.children].every(child=>{const b=child.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.width>40})})
 check(bounds,'all domain filters fit within their container')
 await filters.close()
 const contact=await fixture('member','<div id="app" class="template"><div class="main-card"><el-form class="tem-form" label-width="100px"><div class="whios-title">中文信息模板</div><el-form-item label="域名所有者（中文）"><el-input placeholder="请输入域名所有者"></el-input><div class="form-tip">域名所有者代表域名使用权，请核对完整资料。</div></el-form-item><el-form-item label="用户类型"><div class="user-type"><div class="type-item is-active">个人</div><div class="type-item">企业组织</div></div></el-form-item><el-form-item label="同意协议"><el-checkbox>我已阅读并同意<span class="a-blue-text">《信息服务协议》</span>，同时承诺填写的信息真实、有效。</el-checkbox></el-form-item></el-form></div></div>', ['public/cra1-shared/src/adapters.css'])
 await contact.addStyleTag({content:fs.readFileSync(path.join(native,'public/plugins/addon/idcsmart_domain/template/clientarea/pc/default/css/creatTemplate.css'),'utf8')})
 await contact.addStyleTag({content:'html{font-size:50px}'})
 await contact.addStyleTag({content:read('public/cra1-shared/src/tokens.css')})
 await contact.addStyleTag({content:reference('theme/default/element-ui.css')})
 await contact.evaluate(()=>new Vue({el:'#app'}))
 for(const width of [390,768,1440,1920]){
  await contact.setViewportSize({width,height:900})
  check(await contact.locator('.form-tip').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=12),`domain helper text is readable at ${width}`)
  check(await contact.locator('.type-item').first().evaluate(e=>e.getBoundingClientRect().height>=40&&parseFloat(getComputedStyle(e).fontSize)>=14),`domain user type is readable and clickable at ${width}`)
  if(width<768){
   check(await contact.locator('.el-form-item__content').evaluateAll(els=>els.every(e=>e.scrollWidth<=e.clientWidth+1)),`domain fields and agreement are not clipped at ${width}`)
   const layout=await contact.locator('.el-form-item').first().evaluate(e=>({label:e.querySelector('label').getBoundingClientRect().toJSON(),input:e.querySelector('input').getBoundingClientRect().toJSON()}));check(layout.label.bottom<=layout.input.top&&layout.input.width>280,`domain labels sit above full-width mobile inputs at ${width}: ${JSON.stringify(layout)}`)
  }
 }
 await contact.close()
 assert.deepEqual(errors,[],'no browser errors')
 console.log(JSON.stringify({status:'passed',checks:checks.length,errors}))
}finally{await browser.close()}
