/** Real cart template and native handlers; all account/cart responses are isolated. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const {chromium}=createRequire(path.join(root,'cra1-theme/scripts/package.json'))('playwright');
const origin=process.env.CRA1_CHECKOUT_ORIGIN,out=process.env.CRA1_CHECKOUT_OUT,stage=process.env.CRA1_CHECKOUT_STAGE;
if(!origin||!out||path.resolve(out).startsWith(root+path.sep))throw Error('Set an origin and an external output directory.');
fs.mkdirSync(out,{recursive:true});
const release=stage?JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release:null;
const common={website_name:'购物车演示',currency_prefix:'¥',currency_suffix:'元',custom_fields:{before_settle:0},lang_home_open:0};
const report={status:'running',checks:[],errors:[],writes:[],screenshots:[]};
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);};
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const width of [1440,768,390,320]){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:900},reducedMotion:'reduce'});
  const fixture={listFail:true,quoteFail:false,quoteReads:0};
  await context.addInitScript(common=>{localStorage.setItem('jwt','feedback-fixture-not-a-real-token');localStorage.setItem('lang','zh-cn');localStorage.setItem('common_set_before',JSON.stringify(common));},common);
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),p=u.pathname;
   if(u.origin!==origin)return route.abort();
   const json=data=>route.fulfill({json:{status:200,data}});
   const unavailable=()=>route.fulfill({json:{status:503,msg:'SQLSTATE fixture /private/fixture.php token=fixture-private'}});
   if(p==='/cra1-shared/announcements.php')return json({items:[]});
   if(p==='/cra1-shared/snapshot.php')return json({content:{},appearance:{}});
   if(p==='/cra1-shared/compat.php')return json(u.searchParams.get('target')==='access'?{all:true}:{list:[]});
   if(p==='/console/v1/cart')return fixture.listFail?unavailable():json({list:[{product_id:3,name:'超长产品名称与配置说明ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',qty:1,config_options:{},customfield:{event_promotion:'',promo_code:''},stock_control:0}],count:1});
   if(p==='/console/v1/product/3/config_option'){
    fixture.quoteReads++;
    return fixture.quoteFail?unavailable():json({price:'123456789.12',price_total:'123456789.12',base_price:'123456789.12',billing_cycle:'完整周期说明ABCDEFG0123456789',duration:2592000,preview:[{name:'IPv6',value:'2001:0db8:85a3:0000:0000:8a2e:0370:7334',price:'123456789.12'}]});
   }
   if(p==='/console/v1/common')return json(common);
   if(p==='/console/v1/account')return json({account:{id:999,username:'演示用户'},custom_fields:[]});
   if(p==='/console/v1/theme/access'||p==='/console/v1/cra1-theme/access')return json({all:true});
   if(p==='/console/v1/presale_consult/config')return json({presale_consult:0,config:{}});
   if(p.includes('/event_promotion/'))return route.fulfill({json:{status:200,msg:'操作成功',list:[],data:{list:[]}}});
   if(p.startsWith('/console/v1/')){if(req.method()!=='GET')report.writes.push(p);return json({list:[],count:0});}
   if(p.startsWith('/plugins/addon/')&&req.resourceType()==='script')return route.fulfill({contentType:'text/javascript',body:''});
   if(!['GET','HEAD','OPTIONS'].includes(req.method())){report.writes.push(p);return route.abort();}
   if(stage&&/\.(?:js|css|woff2?|svg|png|webp)$/.test(p)){
    const file=path.join(stage,'public',p.replace(/\/releases\/[^/]+\//g,'/releases/'+release+'/'));
    if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
   }
   if(!stage&&p.endsWith('/js/shoppingCar.js'))return route.fulfill({path:path.join(root,'cra1-theme/source/legacy-assets/cart/20261012-cart-entry-v1/js/shoppingCar.js')});
   if(!stage&&p.endsWith('/css/purchase-theme.css'))return route.fulfill({contentType:'text/css',body:fs.readFileSync(path.join(root,'cra1-theme/source/legacy-assets/cart/20261011-titanium-v1/css/cart-theme.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'cra1-theme/source/legacy-assets/cart/20261017-compat-v3/css/purchase-pages.css'),'utf8')});
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push({width,error:error.stack}));
  page.setDefaultTimeout(12000);
  await page.goto(origin+'/cart/shoppingCar.htm',{waitUntil:'load'});
  await page.getByText('暂时无法读取购物车，请稍后重试',{exact:true}).waitFor();
  check(await page.locator('.buy-btn').isDisabled(),'list failure disables checkout '+width);
  check(!(await page.locator('.cra1-basket-page').textContent()).includes('fixture-private'),'list diagnostics stay private '+width);
  fixture.listFail=false;fixture.quoteFail=true;
  await page.getByRole('button',{name:'重新加载',exact:true}).click();
  const retry=page.locator('.cl-pc-cart:visible,.cl-mobile-cart:visible').getByRole('button',{name:'重试',exact:true});
  await retry.waitFor();
  check(await page.locator('.buy-btn').isDisabled(),'quote failure disables checkout '+width);
  check(!(await page.locator('.cra1-basket-page').textContent()).includes('fixture-private'),'quote diagnostics stay private '+width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'quote failure fits the viewport '+width);
  check(await page.locator('.cl-pc-cart:visible .no-goods-tips,.cl-mobile-cart:visible .no-goods-tips').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'quote failure text stays fully readable '+width);
  await page.screenshot({path:path.join(out,'cart-quote-failure-'+width+'.png'),fullPage:true});report.screenshots.push('cart-quote-failure-'+width+'.png');
  const reads=fixture.quoteReads;fixture.quoteFail=false;await retry.click();
  await page.waitForFunction(()=>document.querySelector('.cra1-basket-page').__vue__.showList[0]?.info);
  check(fixture.quoteReads===reads+1,'one local retry makes one native quote request '+width);
  await page.locator('.footer-left .all-check').click();
  check(await page.locator('.buy-btn').isEnabled(),'successful quote restores checkout eligibility '+width);
  const input=page.locator('.main-card>.search-box input');await input.fill('没有匹配的示例');await input.press('Tab');
  await page.getByText('没有找到匹配的商品',{exact:true}).waitFor();
  check(await page.getByRole('button',{name:'清空搜索',exact:true}).isVisible(),'filtered empty state has a clear action '+width);
  check(await page.locator('.buy-btn').isDisabled(),'changing filter clears the old selection '+width);
  await page.screenshot({path:path.join(out,'cart-filter-empty-'+width+'.png'),fullPage:true});report.screenshots.push('cart-filter-empty-'+width+'.png');
  await page.getByRole('button',{name:'清空搜索',exact:true}).click();
  check(await input.inputValue()==='','clear restores the query '+width);
  check(await page.locator('.cl-pc-cart:visible .shopping-goods,.cl-mobile-cart:visible .cl-m-cart-card').count()===1,'clear restores existing cart data '+width);
  const overflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().right>innerWidth+1).slice(-20).map(n=>({tag:n.tagName,classes:n.className,width:n.getBoundingClientRect().width,right:n.getBoundingClientRect().right}))}));
  if(overflow.scrollWidth>width+1)report.overflow=overflow;
  check(overflow.scrollWidth<=width+1,'long names, IPv6 and prices fit '+width);
  await page.screenshot({path:path.join(out,'cart-recovered-'+width+'.png'),fullPage:true});report.screenshots.push('cart-recovered-'+width+'.png');
  await context.close();
 }
 check(report.errors.length===0,'no browser exceptions');check(report.writes.length===0,'no business writes');report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,errors:report.errors}));}
