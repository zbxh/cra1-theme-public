/** Real installed pages; all catalogue, module and business responses are isolated. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.CRA1_MODULE_TEST_ORIGIN,out=process.env.CRA1_MODULE_TEST_OUT;
if(!origin||!out)throw Error('Set CRA1_MODULE_TEST_ORIGIN and an external CRA1_MODULE_TEST_OUT.');
fs.mkdirSync(out,{recursive:true});
const products=[
 {id:501,module:'vendor_custom',name:'第三方模块'},
 {id:502,module:null,module1:'vendor_group',name:'接口分组模块'},
 {id:503,module:'mf_cloud',mode:'only_api',res_module:'cloud_service',name:'第三方代理模块'}
].map(p=>({...p,price:'12.00',cycle:'月',description:'<p>隔离示例</p>',product_group_id:301,product_group_id_first:300,hidden:0,stock_control:0}));
const common={website_name:'模块兼容检查',currency_prefix:'¥',currency_suffix:'元',cart_change_product:0,cart_instruction:0,custom_fields:{before_settle:0},lang_home_open:0};
const moduleHtml=id=>'<style>.third-party-module{font:14px/1.7 sans-serif;max-width:100%;padding:12px;box-sizing:border-box}.third-party-module button,.third-party-module select{padding:10px;max-width:100%}.third-party-module .main-card{padding:7px}.third-party-module .search-box{display:grid;gap:3px}.native-actions{display:flex;width:240px;max-width:100%}.native-actions button{width:100%;min-width:0;padding:6px}</style>'+
 '<div class="template third-party-module" data-pid="'+id+'"><script type="application/json" id="vendor-settings">{"bandwidth":19,"traffic":768}</scr'+'ipt><div class="main-card"><div class="search-box">原生搜索</div></div><div class="native-actions"><button class="el-button el-button--primary">原生加购</button><button class="el-button el-button--primary">原生立即购买</button></div><div class="top-tab"><h2 class="com-tit">原生模块 '+id+'</h2><label>规格 <select v-model="plan"><option>标准版</option><option>专业版</option></select></label></div><p>带宽：<span id="vendor-bandwidth">{{bandwidth}}</span>Mbps</p><p>流量：<span id="vendor-traffic">{{traffic}}</span>GB/月</p><button @click="bought++">原生订购 {{bought}}</button></div><script type="text/ecmascript" src="/fixture/vendor-boot.js"></scr'+'ipt>';
const report={status:'running',checks:[],errors:[],blocked:[]};
const save=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);save();};
const json=(route,data)=>route.fulfill({json:{status:200,msg:'操作成功',data}});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let page;
try{
 for(const width of (process.env.CRA1_MODULE_TEST_WIDTHS||'1920,1440,768,390,320').split(',').map(Number)){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
  await context.addInitScript(common=>{localStorage.setItem('common_set_before',JSON.stringify(common));localStorage.setItem('lang','zh-cn');},common);
  const reads=[];
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;
   if(u.origin!==origin)return route.abort();
   if(p==='/cra1-shared/announcements.php')return json(route,{items:[]});
   if(!['GET','HEAD','OPTIONS'].includes(req.method())){report.blocked.push({path:p,method:req.method()});return route.abort();}
   if(p==='/console/v1/common')return json(route,common);
   if(p==='/console/v1/cart')return json(route,{list:[],count:0});
   if(p==='/console/v1/menu')return json(route,{list:[],menu:[]});
   // The complete installed default header owns these native reads.
   if(p==='/console/v1/account')return json(route,{account:{id:999,username:'隔离测试'},custom_fields:[]});
   if(p==='/console/v1/presale_consult/config')return json(route,{presale_consult:0,config:{}});
   if(p.includes('/event_promotion/'))return json(route,{list:[],event_promotion:[],count:0});
   if(p==='/console/v1/product/group/first')return json(route,{list:[{id:300,name:'测试产品'}]});
   if(p==='/console/v1/product/group/second')return json(route,{list:[{id:301,name:'商品配置',type:'normal'}]});
   if(p==='/console/v1/product')return json(route,{list:Number(u.searchParams.get('page')||1)>1?[]:products,count:products.length});
   const detail=/^\/console\/v1\/product\/(50[1-3])$/.exec(p);
   if(detail)return json(route,{product:products.find(x=>x.id===Number(detail[1]))});
   const config=/^\/console\/v1\/product\/(50[1-3])\/config_option$/.exec(p);
   if(config){reads.push({path:p,flag:u.searchParams.get('flag')});return json(route,{module:Number(config[1])===503?'recloud_service':'vendor_custom',content:moduleHtml(config[1])});}
   if(p==='/fixture/vendor-boot.js')return route.fulfill({contentType:'text/javascript',body:'window.vendorMounts=(window.vendorMounts||0)+1;const settings=JSON.parse(document.querySelector(".third-party-module #vendor-settings").textContent);window.vendorVM=new Vue({el:".third-party-module",data:{...settings,plan:"标准版",bought:0},watch:{async plan(){Object.assign(this,await(await fetch("/fixture/vendor-config")).json())}}});'});
   if(p==='/fixture/vendor-config')return route.fulfill({json:{bandwidth:37,traffic:3072}});
   return route.continue();
  });
  page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  const ready=async id=>{
   await page.waitForURL(url=>url.pathname==='/cart/goods.htm'&&url.searchParams.get('id')===String(id));
   await page.getByRole('heading',{name:'原生模块 '+id,exact:true}).waitFor();
   await page.waitForFunction(()=>!!window.vendorVM);
   check(await page.locator('.cl-config-frame,.cl-rail,.cl-rail-dock').count()===0,'third-party page has no theme iframe or calculator '+id+'/'+width);
   check(await page.evaluate(()=>window.vendorMounts===1),'module boot executes once '+id+'/'+width);
   check(await page.locator('.third-party-module .main-card').evaluate(e=>getComputedStyle(e).padding)==='7px','native card keeps its module spacing '+id+'/'+width);
   check(await page.locator('.third-party-module .search-box').evaluate(e=>getComputedStyle(e).display)==='grid','native module layout is not replaced by cart theme styles '+id+'/'+width);
   check(await page.locator('.native-actions').evaluate(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('button')].every(b=>!b.classList.contains('cui-button')&&getComputedStyle(b).flexShrink==='1'&&b.getBoundingClientRect().right<=r.right+1)}),'native paired purchase buttons keep shrinking and remain inside their row '+id+'/'+width);
   check(await page.locator('cra1-cart-heading-icon,.cl-config-heading').count()===0,'borrowed module classes do not opt into theme transformations '+id+'/'+width);
  };
  await page.goto(origin+'/cart/goodsList.htm?product_id=501',{waitUntil:'load'});await ready(501);
  check(await page.locator('#vendor-bandwidth').textContent()==='19','nested JSON stays inside the module before boot '+width);
  await page.getByRole('combobox').selectOption({label:'专业版'});await page.waitForFunction(()=>document.querySelector('#vendor-bandwidth').textContent==='37');
  check(await page.locator('#vendor-traffic').textContent()==='3072','native selection updates module values '+width);
  await page.getByRole('button',{name:'原生订购 0',exact:true}).click();
  check(await page.getByRole('button',{name:'原生订购 1',exact:true}).isVisible(),'native action stays active '+width);
  await page.screenshot({path:path.join(out,'third-party-cart-'+width+'.png'),fullPage:true});
  await page.goto(origin+'/cart/goodsList.htm?fpg_id=300&spg_id=301',{waitUntil:'load'});
  await page.locator('.cl-goods-card').first().waitFor();await page.waitForTimeout(250);
  check(new URL(page.url()).pathname==='/cart/goodsList.htm','category browsing stays in the list '+width);
  for(const id of [502,503]){
   await page.locator('.cl-goods-card').filter({hasText:products.find(p=>p.id===id).name}).click();await ready(id);
   await page.goBack({waitUntil:'load'});await page.locator('.cl-goods-card').first().waitFor();
   check(new URL(page.url()).pathname==='/cart/goodsList.htm','back returns to the catalogue without a redirect loop '+id+'/'+width);
  }
  await page.evaluate(()=>sessionStorage.setItem('product_information',JSON.stringify({position:3,product_id:501,config_options:{plan:'标准版'}})));
  await page.goto(origin+'/cart/goodsList.htm?product_id=501&change=true&name=A%20B&config=%7B%22a%22%3A1%7D#network',{waitUntil:'load'});await ready(501);
  const address=new URL(page.url());
  check(address.searchParams.get('change')==='true'&&address.searchParams.get('name')==='A B'&&address.searchParams.get('config')==='{"a":1}'&&address.hash==='#network','native route preserves cart editing and deep-link context '+width);
  check(await page.evaluate(()=>JSON.parse(sessionStorage.product_information).position===3),'native navigation retains the existing cart position '+width);
  await page.goto(origin+'/cart/goods_embed.htm?id=501&embed=1&embed_nonce=old',{waitUntil:'load'});await ready(501);
  check(!new URL(page.url()).searchParams.has('embed_nonce'),'old third-party embed entry is promoted to the official host '+width);
  check(reads.every(r=>r.flag!=='true'),'public entry never enables hidden-product mode '+width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'native document fits the viewport '+width);
  await context.close();
 }
 check(report.blocked.length===0,'no unexpected business writes were attempted');
 check(report.errors.length===0,'no unhandled browser errors');report.status='passed';save();
}catch(error){report.status='failed';report.error=error.stack;save();if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});process.exitCode=1;}
finally{await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error}));}
