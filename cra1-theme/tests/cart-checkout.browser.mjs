/** Real shopping-cart template and Vue handlers; API fixtures never reach business endpoints. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const {chromium}=createRequire(path.join(root,'cra1-theme/scripts/package.json'))(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.CRA1_CHECKOUT_ORIGIN,out=process.env.CRA1_CHECKOUT_OUT,stage=process.env.CRA1_CHECKOUT_STAGE;
if(!origin||!out)throw Error('Set CRA1_CHECKOUT_ORIGIN and an external CRA1_CHECKOUT_OUT directory.');
fs.mkdirSync(out,{recursive:true});
const release=stage?JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release:null;
const common={website_name:'购物车演示',currency_prefix:'¥',currency_suffix:'元',custom_fields:{before_settle:0},lang_home_open:0};
const report={status:'running',checks:[],cases:[],errors:[],blocked:[],mockedQuantityUpdates:[]};
const save=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);save();};
const browser=await chromium.launch({args:['--no-sandbox']});
let page;
try{
 for(const width of (process.env.CRA1_CHECKOUT_WIDTHS||'390,320,375,480,481,767,768,820,1440').split(',').map(Number)){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:width<768?844:1000},reducedMotion:'reduce',...(width<=480?{isMobile:true,hasTouch:true}: {})});
  const fixture={price:'156.00',items:1};
  await context.addInitScript(common=>{
   localStorage.setItem('jwt','layout-fixture-not-a-real-token');
   localStorage.setItem('lang','zh-cn');
   localStorage.setItem('common_set_before',JSON.stringify(common));
  },common);
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;
   if(u.origin!==origin)return route.abort();
   const json=data=>route.fulfill({json:{status:200,msg:'操作成功',data}});
   if(p==='/cra1-shared/announcements.php')return json({items:[]});
   if(p==='/cra1-shared/snapshot.php')return json({content:{},appearance:{}});
   if(p==='/cra1-shared/compat.php')return json(u.searchParams.get('target')==='access'?{all:true}:{list:[]});
   if(p==='/console/v1/cart')return json({list:fixture.items?[{product_id:3,name:'通用商品示例',qty:1,config_options:{},customfield:{event_promotion:'',promo_code:''},stock_control:0}]:[],count:fixture.items});
   if(p==='/console/v1/cart/0/qty'&&req.method()==='PUT'){
    report.mockedQuantityUpdates.push({width,qty:req.postDataJSON().qty});
    return json({});
   }
   if(p==='/console/v1/product/3/config_option'){
    const qty=req.postDataJSON()?.qty||1;
    return json({price:String(Number(fixture.price)*qty),price_total:String(Number(fixture.price)*qty),base_price:fixture.price,billing_cycle:'月',duration:30*86400,preview:[{name:'配置',value:'标准版',price:fixture.price}]});
   }
   if(p==='/console/v1/common')return json(common);
   if(p==='/console/v1/account')return json({account:{id:999,username:'演示用户'},custom_fields:[]});
   if(p==='/console/v1/theme/access'||p==='/console/v1/cra1-theme/access')return json({all:true});
   if(p==='/console/v1/menu')return json({list:[],menu:[]});
   if(p==='/console/v1/presale_consult/config')return json({presale_consult:0,config:{}});
   if(p.includes('/event_promotion/'))return route.fulfill({json:{status:200,msg:'操作成功',list:[],data:{list:[]}}});
   if(p.startsWith('/console/v1/')){
    if(req.method()!=='GET')report.blocked.push({path:p,method:req.method()});
    return json({list:[],count:0});
   }
   // Optional installed add-ons are outside this layout regression.
   if(p.startsWith('/plugins/addon/')&&req.resourceType()==='script')return route.fulfill({contentType:'text/javascript',body:''});
   if(!['GET','HEAD','OPTIONS'].includes(req.method())){report.blocked.push({path:p,method:req.method()});return route.abort();}
   if(stage&&/\.(?:js|css|woff2?|svg|png|webp)$/.test(p)){
    const file=path.join(stage,'public',p.replace(/\/releases\/[^/]+\//g,'/releases/'+release+'/'));
    if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
   }
   return route.continue();
  });
  page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror',error=>report.errors.push({width,message:error.stack}));
  page.on('response',response=>{if(response.status()===401)report.errors.push({width,unauthorized:new URL(response.url()).pathname});});
  const open=async()=>{
   await page.goto(origin+'/cart/shoppingCar.htm',{waitUntil:'load'});
   await page.waitForFunction(items=>{const v=document.querySelector('.cra1-basket-page')?.__vue__;return v&&!v.listLoding&&!v.listError&&(items?v.showList[0]?.info&&!v.showList[0].priceLoading:v.showList.length===0);},fixture.items);
  };
  const measure=async state=>{
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const result=await page.evaluate(()=>{
    const rect=n=>{const {top,right,bottom,left,width,height}=n.getBoundingClientRect();return {top,right,bottom,left,width,height};};
    const footer=document.querySelector('.cra1-basket-page .el-footer'),card=footer.querySelector('.footer-box');
    const button=footer.querySelector('.buy-btn'),total=footer.querySelector('.footer-right p'),r=rect(button);
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    const quantity=[...document.querySelectorAll('.cra1-basket-page .el-input-number')].filter(n=>n.getClientRects().length).map(n=>{
     const input=n.querySelector('.el-input__inner');
     return {input:rect(input),steps:[...n.querySelectorAll('.el-input-number__decrease,.el-input-number__increase')].map(step=>({rect:rect(step),icon:rect(step.querySelector('i')),disabled:step.classList.contains('is-disabled')}))};
    });
    return {viewport:{width:innerWidth,height:innerHeight},footer:rect(footer),card:rect(card),button:{...r,disabled:button.disabled,hit:hit===button||button.contains(hit)},total:rect(total),quantity,overflow:document.documentElement.scrollWidth>innerWidth+1,padding:parseFloat(getComputedStyle(document.querySelector('.goods-box')).paddingBottom)};
   });
   report.cases.push({width,state,...result});save();
   await page.screenshot({path:path.join(out,`${width}-${state}.png`),fullPage:false});
   const label=width+'/'+state;
   check(result.button.top>=0&&result.button.bottom<=result.viewport.height-1,'checkout button fits the viewport '+label);
   check(result.total.top>=result.card.top&&result.total.bottom<=result.card.bottom+1,'total fits inside the footer card '+label);
   check(result.button.bottom<=result.card.bottom+1&&result.card.bottom<=result.footer.bottom+1,'footer contains both rows '+label);
   check(!result.overflow,'cart has no horizontal overflow '+label);
   check(result.button.disabled||result.button.hit,'enabled checkout button is not covered '+label);
   for(const q of result.quantity){
    check(q.input.width>=100,'quantity value has room between the step buttons '+label);
    check(q.steps.every(s=>Math.abs(s.rect.top-q.input.top-1)<=1&&Math.abs(q.input.bottom-s.rect.bottom-1)<=1),'quantity button backgrounds follow the input height '+label);
    check(q.steps.every(s=>Math.abs((s.icon.top+s.icon.bottom-s.rect.top-s.rect.bottom)/2)<=1),'quantity plus and minus icons are vertically centered '+label);
   }
   return result;
  };
  await open();await page.locator('.footer-left .all-check').click();
  await page.waitForFunction(()=>!document.querySelector('.buy-btn').disabled);
  await measure('selected');
  const quantity=page.locator('.cra1-basket-page .el-input-number:visible').first();
  check(await quantity.locator('.el-input-number__decrease').evaluate(n=>n.classList.contains('is-disabled')),'minimum quantity keeps decrease disabled '+width);
  await quantity.locator('.el-input-number__increase').click();
  await page.waitForFunction(()=>{const v=document.querySelector('.cra1-basket-page').__vue__;return v.showList[0].qty===2&&!v.showList[0].priceLoading&&v.totalPrice===312;});
  check(await quantity.locator('input').inputValue()==='2','plus uses the native quantity and quote flow '+width);
  await quantity.locator('.el-input-number__decrease').click();
  await page.waitForFunction(()=>{const v=document.querySelector('.cra1-basket-page').__vue__;return v.showList[0].qty===1&&!v.showList[0].priceLoading&&v.totalPrice===156;});
  check(await quantity.locator('input').inputValue()==='1','minus uses the native quantity and quote flow '+width);
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  await measure('scrolled');
  const last=await page.locator('.cra1-basket-page .cl-m-cart-card:visible,.cra1-basket-page .shopping-goods:visible').last().boundingBox();
  const footer=await page.locator('.cra1-basket-page .el-footer').boundingBox();
  check(last.y+last.height<=footer.y-1,'last item can scroll fully above the footer '+width);
  await page.locator('.footer-left .all-check').click();
  check(await page.locator('.buy-btn').isDisabled(),'deselecting keeps the native checkout guard '+width);
  await measure('unselected');
  fixture.price='123456789.12';await open();await page.locator('.footer-left .all-check').click();
  await measure('large-total');
  fixture.items=0;await open();
  check(await page.locator('.buy-btn').isDisabled(),'empty cart keeps checkout disabled '+width);
  await measure('empty');
  // Reflow without reloading must reserve the newly measured footer height.
  await page.setViewportSize({width:width<=480?820:320,height:700});
  await measure('resized');
  await context.close();
 }
 check(report.errors.length===0,'cart has no uncaught browser errors');
 check(report.blocked.length===0,'no business writes were attempted');
 report.status='passed';
}catch(error){
 report.status='failed';report.error=error.stack;process.exitCode=1;
 if(page&&!page.isClosed()){
  report.failure=await page.evaluate(()=>({path:location.pathname,footer:document.querySelector('.el-footer')?.outerHTML,vue:!!document.querySelector('.cra1-basket-page')?.__vue__}));
  await page.screenshot({path:path.join(out,'failure.png'),fullPage:false});
 }
}
finally{save();await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error}));}
