/** Real theme pages and Vue modules, with all product data and writes isolated in browser routes. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.CRA1_RAIL_TEST_ORIGIN,out=process.env.CRA1_RAIL_TEST_OUT,stage=process.env.CRA1_RAIL_TEST_STAGE;
if(!origin||!out)throw Error('Set a guest theme origin and external evidence directory. All product responses are mocked; no business writes are allowed.');
fs.mkdirSync(out,{recursive:true});
const release=stage?JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release:'';
const products=[501,502,503,504,505,506,507].map((id,i)=>({id,module:id===503?'vendor_custom':id===507?'mf_dcim':[502,504,505].includes(id)?'idcsmart_common':'mf_cloud',name:['云产品','通用周期产品','第三方产品','免费产品','一次性产品','延迟购买栏模块','DCIM 产品'][i],price:'12.00',cycle:'月',description:'<p>隔离示例配置</p>',product_group_id:301,product_group_id_first:300,hidden:0,stock_control:0}));
const report={status:'running',checks:[],errors:[],blocked:[],console:[]},browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2))};
let page;
const json=(route,data)=>route.fulfill({json:{status:200,msg:'操作成功',data}});
function moduleContent(id,mobile){
 const common=[502,504,505].includes(id),native=id===503;
 const styles='<style>.fixture-main{min-height:1100px;padding:16px;box-sizing:border-box}.fixture-module{font-size:14px}.fixture-module .f-order,.fixture-module .order-right{padding:16px;box-sizing:border-box}.fixture-module button{padding:10px}.fixture-module select{height:36px;max-width:100%}</style>';
 const controls='<p>原生价格与购买控件</p><button type="button" @click="bought++">原生订购 {{bought}}</button>';
 const choice='<el-select class="fixture-module-choice" v-model="fixtureChoice"><el-option label="配置 A" value="a"></el-option><el-option label="配置 B" value="b"></el-option></el-select>';
 const body=common?'<div class="common-config"><div class="common-box"><main class="fixture-main">通用配置'+choice+'</main><div class="order-right">'+controls+'</div></div></div>':'<main class="main-card fixture-main">商品配置'+choice+'</main>'+(id===506?'':'<div class="f-order">'+controls+'</div>');
 const conditional='<div class="el-form-item fixture-conditional" v-show="fixtureVisible">条件字段提示</div><label class="el-form-item__label fixture-conditional" v-show="fixtureVisible">条件标题</label><div class="image-box fixture-conditional" v-show="fixtureVisible">条件镜像</div><div class="image-ul fixture-conditional" v-show="fixtureVisible">条件镜像列表</div><div class="el-radio-group fixture-conditional" v-show="fixtureVisible"><label class="el-radio"><span class="el-radio__label">条件选项</span></label></div><table class="el-table__body"><tbody><tr class="el-table__row fixture-conditional" v-show="fixtureVisible"><td>条件型号</td></tr><tr class="el-table__row"><td class="fixture-conditional" v-show="fixtureVisible">条件列</td></tr></tbody></table>';
 return styles+'<div class="template fixture-module '+(native?'third-party-module':(mobile?(id===507?'m-dcim-m':'m-cloud-m'):''))+'" data-id="'+id+'">'+body+conditional+'</div><script src="/fixture/cart-rail-module.js"></scr'+'ipt>';
}
function moduleScript(){
 return '(()=>{const id=Number(document.getElementsByClassName("template")[0].dataset.id),common=[502,504,505].includes(id),native=id===503;const data=common?{custom_cycles:[],curCycle:0,pay_type:id===504?"free":id===505?"onetime":"recurring_prepayment",orderData:{qty:1},basicInfo:{allow_qty:1},totalPrice:id===504?0:id===505?99:12,original_price:12,dataLoading:false,bought:0}:{cycleList:[],params:{duration_id:""},qty:1,calcTotalPrice:0,totalPrice:0,loadingPrice:false,preview:[],bought:0};data.fixtureChoice="a";data.fixtureVisible=false;const methods=native?{}:common?{addCart(){this.bought++},buyNow(){this.bought++},changeConfig(){},changeCycle(c,i){this.curCycle=i}}:{handlerCart(){this.bought++},submitOrder(){this.bought++},changeCart(){this.bought++},changeDuration(){},changQty(){}};window.fixtureVM=new Vue({el:document.getElementsByClassName("template")[0],data,methods});})();';
}
try{
 for(const width of (process.env.CRA1_RAIL_TEST_WIDTHS||'1440,1025,1024,900,768,390,360,320').split(',').map(Number)){
  const mobile=width<=390;
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000},reducedMotion:'reduce',...(mobile?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}:{})});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;
   if(['data:','blob:'].includes(u.protocol))return route.continue();
   if(u.origin!==origin)return route.abort();
   // These fixtures replace products, not unrelated installed add-on business data.

   if(p==='/cra1-shared/snapshot.php')return json(route,{content:{goodslist:{config_panel:{default_open:true},default_selection:{product_id:0}}}});
   if(p==='/cra1-shared/announcements.php')return json(route,{items:[]});
   if(!['GET','HEAD','OPTIONS'].includes(req.method())){report.blocked.push({path:p,method:req.method()});return route.fulfill({json:{status:400,msg:'隔离测试不提交业务操作'}})}
   // The official fallback header owns these reads as well as the product template.
   if(p==='/console/v1/common')return json(route,{website_name:'隔离演示',currency_prefix:'¥',currency_suffix:'',cart_change_product:0,custom_fields:{before_settle:0},lang_home_open:0});
   if(p==='/console/v1/account')return json(route,{account:{id:999,username:'隔离测试'},custom_fields:[]});
   if(p==='/console/v1/menu')return json(route,{list:[],menu:[]});
   if(p==='/console/v1/presale_consult/config')return json(route,{presale_consult:0,config:{}});
   if(p.includes('/event_promotion/'))return route.fulfill({json:{status:200,msg:'操作成功',list:[],data:{list:[],event_promotion:[],count:0}}});
   if(p==='/console/v1/product/group/first')return json(route,{list:[{id:300,name:'测试产品'}]});
   if(p==='/console/v1/product/group/second')return json(route,{list:[{id:301,name:'商品配置',type:'normal',description:''}]});
   if(p==='/console/v1/product')return json(route,{list:Number(u.searchParams.get('page')||1)>1?[]:products,count:products.length});
   const detail=/^\/console\/v1\/product\/(50[1-7])$/.exec(p);
   if(detail)return json(route,{product:products.find(x=>x.id===Number(detail[1]))});
   if(p==='/console/v1/cart')return json(route,{list:[],count:0});
   const config=/^\/console\/v1\/product\/(50[1-7])\/config_option$/.exec(p);
   if(config){const id=Number(config[1]);return json(route,{module:id===503?'vendor_custom':id===507?'mf_dcim':[502,504,505].includes(id)?'idcsmart_common':'mf_cloud',content:moduleContent(id,mobile)});}
   if(p==='/fixture/cart-rail-module.js'||p==='/plugins/server/mf_cloud/template/clientarea/mobile/cloud/js/mf_cloud.js')return route.fulfill({contentType:'text/javascript',body:moduleScript()});
   if(stage&&/\.(?:js|css|woff2?|svg|png|webp)$/.test(p)){
    const file=path.join(stage,'public',p.replace(/\/releases\/[^/]+\//g,'/releases/'+release+'/'));
    if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
   }
   return route.continue();
  });
  page=await context.newPage();page.setDefaultTimeout(20000);page.on('console',m=>{if(['error','warning'].includes(m.type()))report.console.push(m.text())});page.on('pageerror',e=>report.errors.push({message:e.message,stack:e.stack,url:page.url()}));
  await page.goto(origin+'/cart/goodsList.htm?fpg_id=300&spg_id=301&product_id=501',{waitUntil:'domcontentloaded',timeout:60000});
  const wait=async(id,availability)=>{
   await page.waitForFunction(({id,availability})=>{const v=document.querySelector('.template')?.__vue__;return v&&v.selectedProductId===id&&v.configState==='ready'&&v.railState==='bridged'&&v.railAvailability===availability},{id,availability});
  };
  const frame=()=>page.frames().find(f=>new URL(f.url()).pathname==='/cart/goods_embed.htm')||page.mainFrame();
  await wait(501,'loading');
  const conditions=frame().locator('.fixture-conditional');
  const allConditionsVisible=async expected=>{for(const control of await conditions.all()){if(await control.isVisible()!==expected)return false}return true};
  check(await allConditionsVisible(false),'native conditional fields, images, options and columns remain hidden '+width);
  await frame().evaluate(()=>{fixtureVM.fixtureVisible=true;return fixtureVM.$nextTick()});
  check(await allConditionsVisible(true),'native conditional controls can become visible '+width);
  await frame().evaluate(()=>{fixtureVM.fixtureVisible=false;return fixtureVM.$nextTick()});
  check(await allConditionsVisible(false),'native conditional controls hide again after settings change '+width);
  if(width===1440){
   const links=await page.evaluate(origin=>{
    const html=document.querySelector('.template').__vue__.sanitizeHtml(`<p><a href="${origin}/description">介绍</a><img src="${origin}/description.png"><a href="javascript:alert(1)" onclick="alert(1)">无效链接</a></p>`);
    const template=document.createElement('template');template.innerHTML=html;
    return {href:template.content.querySelector('a').getAttribute('href'),src:template.content.querySelector('img').getAttribute('src'),unsafe:template.content.querySelectorAll('[onclick],a[href^="javascript:"]').length};
   },origin);
   check(links.href===origin+'/description'&&links.src===origin+'/description.png','ordinary HTTP product descriptions retain their image and link URLs');
   check(links.unsafe===0,'description URL compatibility still removes executable links and handlers');
  }
  const rail=width>1024?page.locator('.cl-rail'):page.locator('.cl-rail-dock');
  await rail.waitFor({state:'visible'});
  check(await rail.isVisible(),'one calculator remains visible before periods '+width);
  check(await rail.locator('.cl-rail-buy').isDisabled(),'pending periods disable purchase '+width);
  check((await rail.innerText()).includes('待计算')&&!(await rail.innerText()).includes('0.00'),'unconfirmed initial zero is not displayed '+width);
  check(await frame().evaluate(()=>getComputedStyle(document.querySelector('.f-order,.botton-buy-btn')).display==='none'),'native bottom bar stays hidden while the known module waits '+width);
  if(width>1024){
   check(await page.evaluate(()=>{const r=document.querySelector('.cl-rail').getBoundingClientRect(),s=document.querySelector('.cl-shop').getBoundingClientRect();return r.left>=s.right&&r.top<=Math.max(s.top,70)+2}),'PC calculator stays at the right of the product column '+width);
  }
  if(width===1440){
   await wait(501,'unavailable');check(await rail.isVisible()&&await rail.locator('.cl-rail-buy').isDisabled(),'empty periods timeout retains the same disabled right calculator');
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'empty-periods-'+width+'.png'),fullPage:true});
  }
  await frame().evaluate(()=>{fixtureVM.cycleList=[{id:1,name:'月付'},{id:2,name:'年付'}];fixtureVM.params.duration_id=1;fixtureVM.calcTotalPrice=76;fixtureVM.totalPrice=76;});
  await wait(501,'ready');check(await rail.locator('.cl-rail-buy').isEnabled()&&/76(?:\.00)?/.test(await rail.innerText()),'late periods restore real price and purchase without reload '+width);
  {
   await rail.locator('.el-select').click();await page.getByRole('listitem').filter({hasText:'年付'}).click();
   await page.waitForFunction(()=>document.querySelector('.cl-config-frame').contentWindow.fixtureVM.params.duration_id===2);check(true,'duration selection reaches the native module '+width);
  }
  check(await page.evaluate(()=>!window.fixtureVM&&!window.__cloudMobileVm),'module stays inside its own document '+width);
  if(width<=768){
   await frame().locator('.fixture-module-choice').click();
   const dropdown=frame().locator('.el-select-dropdown:visible');await dropdown.waitFor();
   check(await frame().evaluate(()=>{const input=document.querySelector('.fixture-module-choice').getBoundingClientRect(),popup=[...document.querySelectorAll('.el-select-dropdown')].find(e=>getComputedStyle(e).display!=='none'),r=popup.getBoundingClientRect();return getComputedStyle(popup).position!=='fixed'&&Math.min(Math.abs(r.top-input.bottom),Math.abs(input.top-r.bottom))<24&&r.left>=-1&&r.right<=innerWidth+1}),'embedded configuration dropdown stays next to its control '+width);
   await dropdown.getByText('配置 B',{exact:true}).click();
   check(await frame().evaluate(()=>fixtureVM.fixtureChoice==='b'),'embedded configuration option is selectable '+width);
  }
  if(width<=1024){
   const bounds=async()=>page.evaluate(()=>{
    const dock=document.querySelector('.cl-rail-dock'),d=dock.getBoundingClientRect();
    return {height:d.height,bottom:d.bottom,viewport:innerHeight,padding:parseFloat(getComputedStyle(document.querySelector('.cart-page .el-main')).paddingBottom),fits:[...dock.querySelectorAll('.cl-dock-m-field,.el-select,.el-input-number,.cl-rail-dock-price,.cl-rail-dock-actions,.cl-rail-buy')].every(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1})};
   });
   await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.cart-page .el-main')).paddingBottom)>=document.querySelector('.cl-rail-dock').getBoundingClientRect().height);
   let b=await bounds();check(b.fits&&Math.abs(b.bottom-b.viewport)<2&&b.padding>=b.height,'compact calculator fits and reserves its actual height '+width);
   await frame().evaluate(()=>{fixtureVM.hasDiscount=true;fixtureVM.preview=[{name:'配置',value:'2 核 / 4 GB / 50 GB / 10 Mbps'}]});
   await rail.locator('.cl-dock-m-coupon-toggle').click();await rail.locator('.cl-dock-m-coupon input').fill('EXAMPLE');
   await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.cart-page .el-main')).paddingBottom)>=document.querySelector('.cl-rail-dock').getBoundingClientRect().height);
   b=await bounds();check(b.fits&&b.padding>=b.height,'expanded coupon updates reserved space without covering content '+width);
   await rail.locator('.cl-rail-dock-label').click();check(await rail.locator('.cl-dock-m-detail').isVisible(),'configuration details remain accessible '+width);
   await page.screenshot({path:path.join(out,'calculator-expanded-'+width+'.png'),fullPage:true});
   await rail.locator('.cl-rail-dock-label').click();await rail.locator('.cl-dock-m-coupon-toggle').click();
   await page.screenshot({path:path.join(out,'calculator-'+width+'.png'),fullPage:true});
  }
  await frame().evaluate(()=>{fixtureVM.cycleList=[];fixtureVM.params.duration_id='';});await wait(501,'loading');
  check(await page.evaluate(()=>document.querySelector('.template').__vue__.railDurations.length===0)&&await rail.locator('.cl-rail-buy').isDisabled(),'lost periods clear stale selection and disable purchase '+width);
  check(!/76(?:\.00)?/.test(await rail.innerText()),'lost periods clear the previous price '+width);
  await frame().evaluate(()=>{fixtureVM.cycleList=[{id:1,name:'月付'}];fixtureVM.params.duration_id=1;fixtureVM.calcTotalPrice=0;fixtureVM.totalPrice=0;});await wait(501,'ready');
  check(await rail.locator('.cl-rail-buy').isEnabled()&&await page.evaluate(()=>Number(document.querySelector('.template').__vue__.railPrice.calcText)===0),'confirmed free quote works normally '+width);
  const choose=async id=>{
   await page.locator('.cl-goods-card').filter({hasText:products.find(p=>p.id===id).name}).click();
   const dialog=page.locator('.el-message-box__btns .el-button--primary');if(await dialog.isVisible().catch(()=>false))await dialog.click();
  };
  {
   await choose(502);await wait(502,'loading');check(await rail.isVisible(),'common recurring module also retains its calculator while periods load '+width);
   await frame().evaluate(()=>{fixtureVM.custom_cycles=[{id:91,name:'月付'}];});await wait(502,'ready');check(await rail.locator('.cl-rail-buy').isEnabled(),'common period index zero is selectable '+width);
   for(const id of [504,505]){await choose(id);await wait(id,'ready');check(await rail.locator('.el-select').count()===0&&await rail.locator('.cl-rail-buy').isEnabled(),'native '+(id===504?'free':'one-time')+' pricing does not need recurring periods '+width);}
  }
  await choose(506);await wait(506,'loading');
  check(await rail.isVisible()&&await rail.locator('.cl-rail-buy').isDisabled(),'conditional native order markup does not remove the waiting calculator '+width);
  await frame().evaluate(()=>{fixtureVM.cycleList=[{id:1,name:'月付'}];fixtureVM.params.duration_id=1;fixtureVM.calcTotalPrice=76;fixtureVM.totalPrice=76;});await wait(506,'ready');
  check(await rail.locator('.cl-rail-buy').isEnabled(),'late periods restore a module without native order markup '+width);
  await choose(507);await wait(507,'loading');
  check(await page.locator('.cl-config-frame').count()===1&&await rail.isVisible(),'DCIM retains the integrated configurator '+width);
  await frame().evaluate(()=>{fixtureVM.cycleList=[{id:1,name:'月付'}];fixtureVM.params.duration_id=1;fixtureVM.calcTotalPrice=88;fixtureVM.totalPrice=88;});await wait(507,'ready');
  check(await rail.locator('.cl-rail-buy').isEnabled()&&/88(?:\.00)?/.test(await rail.innerText()),'DCIM quote and purchase controls stay available '+width);
  await rail.locator('.cl-rail-addcart').click();
  await frame().waitForFunction(()=>fixtureVM.bought===1);
  check(true,'DCIM add-to-cart control reaches the original module '+width);
  await choose(503);await page.waitForURL('**/cart/goods.htm?id=503');
  await page.waitForFunction(()=>!!window.fixtureVM);
  check(await page.locator('.cl-rail').count()===0&&await page.locator('.cl-rail-dock').count()===0,'unknown module keeps its own purchase UI without a duplicate calculator '+width);
  const button=frame().getByRole('button',{name:'原生订购 0',exact:true});await button.click();check(await frame().getByRole('button',{name:'原生订购 1',exact:true}).isVisible(),'unknown native purchase control remains live in the fixture '+width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'catalog does not overflow horizontally '+width);
  await context.close();
 }
 check(report.errors.length===0,'no unhandled JavaScript errors');report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;if(page&&!page.isClosed())report.diagnostics=await page.evaluate(()=>({viewport:innerWidth,events:window.__railEvents,classes:document.documentElement.className,htmlTheme:document.documentElement.dataset.cra1Theme,state:Object.fromEntries(['selectedProductId','configState','railState','railAvailability','first_group_list','select_second_obj','isNormal','viewportW','isMobileCart','cartConfigReady','goodSLoading','catalogError','configErrorText'].map(k=>[k,document.querySelector('.template')?.__vue__?.[k]])),elements:[...document.querySelectorAll('.cl-rail,.cl-rail-dock,.cl-shop,.cl-config-frame,.cl-layout')].map(e=>({tag:e.tagName,cls:e.className,style:e.getAttribute('style'),computed:{display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height},parents:[e.parentElement,e.parentElement?.parentElement].filter(Boolean).map(a=>({cls:a.className,display:getComputedStyle(a).display}))})),styles:[...document.styleSheets].map(s=>s.href),resources:performance.getEntriesByType('resource').filter(r=>/\.(?:css|js)$/.test(r.name)).map(r=>({url:r.name,bytes:r.decodedBodySize}))})).catch(()=>({}));if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error}));}
