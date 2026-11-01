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
 const details=await fixture('member','<div class="cra1-native-page__content"><div class="template" id="product_detail_cloud"><div class="main-card"><div class="card-top"><div class="top-operation"><div class="operation-row1"><span class="top-product-name">云服务器</span><div class="host-status Active">正常</div></div><div class="operation-row2"><div class="row2-left"><span class="name">server-example</span></div></div></div><div class="top-msg"><div class="msg-l"><div class="l-t"><span class="l-t-l-text">配置信息</span><span class="copy-btn">复制登录信息</span></div><div class="l-b"><div class="info-item"><div class="label">CPU:</div><div class="value">4核</div></div><div class="info-item"><div class="label">操作系统:</div><div class="value"><span>Debian-12.0_x64</span></div></div></div></div><div class="msg-r"><div class="r-b"><div class="row"><div class="row-l"><div class="label">到期时间:</div><div class="value">2026-12-12 16:50:00</div></div><div class="row-r"><div class="label">价格:</div><div class="value">￥123.45</div></div></div></div></div></div></div></div></div></div>', ['public/cra1-shared/src/tokens.css','public/cra1-shared/theme-sources/member/cra1-shell.css','public/cra1-shared/src/adapters.css'])
 await details.addStyleTag({content:fs.readFileSync(path.join(native,'public/plugins/server/mf_cloud/template/clientarea/pc/default/css/cloudTop.css'),'utf8')})
 for(const width of [320,390,767]){
  await details.setViewportSize({width,height:900});await details.addStyleTag({content:`html{font-size:${width/7.5}px}`})
  check(await details.locator('.host-status').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=12),`native server status remains readable at ${width}`)
  check(await details.locator('.top-msg .label,.top-msg .value,.copy-btn').evaluateAll(es=>es.every(e=>parseFloat(getComputedStyle(e).fontSize)>=12)),`native configuration and copy action are readable at ${width}`)
  check(await details.locator('.info-item .label').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height<=23)),`native configuration labels stay on one line at ${width}`)
  check(await details.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`native server summary stays within ${width}`)
  check(await details.locator('.info-item').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),`native long configuration values wrap at ${width}`)
 }
 await details.close()
 const phones=await fixture('member','<div id="app" class="chinac-cloud-phone-list"><div class="l-nav" :class="{isFlod:folded}"><div class="opt"><div class="icon">＋</div><div class="icon">✓</div><div class="icon">▦</div><div class="icon">↻</div><el-input class="group-search" placeholder="ID/名称"></el-input></div><div class="l-group">默认分组</div></div><div class="r-content"><div class="com-top-opt"><div class="btns"><el-button>升降级</el-button><el-button>续费</el-button><el-button>同步操作</el-button></div><el-dropdown><el-button>更多</el-button><el-dropdown-menu slot="dropdown"><el-dropdown-item>查看详情</el-dropdown-item></el-dropdown-menu></el-dropdown></div><el-table :data="rows"><el-table-column prop="name" label="名称" min-width="500"></el-table-column><el-table-column prop="status" label="状态" min-width="400"></el-table-column></el-table><div class="flod" :class="{isFlod:folded}" @click="folded=!folded" role="button" aria-label="折叠分组">⇆</div></div></div>', ['public/cra1-shared/src/tokens.css','public/cra1-shared/src/adapters.css'])
 await phones.addStyleTag({content:fs.readFileSync(path.join(native,'public/plugins/server/chinac_cloud_phone/template/clientarea/pc/default/css/chinac_cloud_phone_list.css'),'utf8')})
 await phones.addStyleTag({content:reference('theme/default/element-ui.css')})
 await phones.evaluate(()=>new Vue({el:'#app',data:{folded:false,rows:[{name:'测试云手机',status:'已关机'}]}}))
 for(const width of [390,320,768,1440,390]){
  await phones.setViewportSize({width,height:900});await phones.waitForTimeout(80)
  const phoneBounds=await phones.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&!e.closest('.el-table__body-wrapper,.el-table__header-wrapper')}).slice(0,8).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))}))
  check(phoneBounds.scroll<=width+1,`cloud phone list does not widen page at ${width}: ${JSON.stringify(phoneBounds)}`)
  const layout=await phones.locator('#app').evaluate(e=>({nav:e.querySelector('.l-nav').getBoundingClientRect().toJSON(),content:e.querySelector('.r-content').getBoundingClientRect().toJSON()}))
  check(width<768?layout.nav.bottom<=layout.content.top+1:layout.nav.right<=layout.content.left+1,`cloud phone tree uses the appropriate layout at ${width}`)
  if(width<768){
   await phones.getByRole('button',{name:'折叠分组'}).click();check(!await phones.locator('.l-nav').isVisible(),`phone tree folds at ${width}`)
   await phones.getByRole('button',{name:'折叠分组'}).click();check(await phones.locator('.l-nav').isVisible(),`phone tree reopens at ${width}`)
   check(await phones.locator('.el-table__body-wrapper').evaluate(e=>e.scrollWidth>e.clientWidth),`wide cloud phone columns scroll inside table at ${width}`)
  }
 }
 await phones.close()
 // Installed list plugins can prepend an entry to the flex-based native card.
 // Keep the additional entry on a separate row at both desktop and mobile sizes.
 const entryPhones=await fixture('member','<div id="app" class="chinac-cloud-phone-list"><div class="ue-list-entry"><span>选择服务器后统一续费日期，可先查看差价。</span><button>统一到期日期</button></div><div class="l-nav" :class="{isFlod:folded}">分组</div><div class="r-content"><el-table :data="rows"><el-table-column prop="name" label="名称" min-width="500"></el-table-column></el-table><button @click="folded=!folded" aria-label="折叠分组">折叠分组</button></div></div>', ['public/cra1-shared/src/tokens.css','public/cra1-shared/src/adapters.css'])
 await entryPhones.addStyleTag({content:fs.readFileSync(path.join(native,'public/plugins/server/chinac_cloud_phone/template/clientarea/pc/default/css/chinac_cloud_phone_list.css'),'utf8')})
 await entryPhones.addStyleTag({content:reference('theme/default/element-ui.css')+'\n.ue-list-entry{display:flex;justify-content:space-between;align-items:center;padding:16px;background:#f9fafb;gap:16px;flex-wrap:wrap}'})
 await entryPhones.evaluate(()=>new Vue({el:'#app',data:{folded:false,rows:[{name:'测试云手机'}]}}))
 for(const width of[320,390,768,1440]){
  await entryPhones.setViewportSize({width,height:900});await entryPhones.waitForTimeout(80)
  check(await entryPhones.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`plugin list entry does not widen cloud phone page at ${width}`)
  check(await entryPhones.locator('.chinac-cloud-phone-list').evaluate(e=>{const entry=e.querySelector('.ue-list-entry').getBoundingClientRect(),nav=e.querySelector('.l-nav').getBoundingClientRect(),content=e.querySelector('.r-content').getBoundingClientRect();return entry.bottom<=nav.top+1&&entry.bottom<=content.top+1&&content.width>=innerWidth/3}),`plugin entry stays above usable cloud phone tree and table at ${width}`)
  await entryPhones.getByRole('button',{name:'折叠分组'}).click();await entryPhones.waitForFunction(()=>{const e=document.querySelector('.l-nav');return getComputedStyle(e).display==='none'||e.getBoundingClientRect().width<=1});check(true,`cloud phone tree folds with plugin entry at ${width}`)
  await entryPhones.getByRole('button',{name:'折叠分组'}).click();await entryPhones.waitForFunction(()=>document.querySelector('.l-nav').getBoundingClientRect().width>1)
 }
 await entryPhones.close()
 assert.deepEqual(errors,[],'no browser errors')
 console.log(JSON.stringify({status:'passed',checks:checks.length,errors}))
}finally{await browser.close()}
