/** Real rendered cart, Vue/Element controls, CRA1 handlers and Axios adapter.
 * An anonymous GET supplies HTML only; all APIs and business writes stay local.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const {chromium}=createRequire(path.join(root,'cra1-theme/scripts/package.json'))('playwright');
const out=process.env.CRA1_PROMOTION_OUT,htmlFile=process.env.CRA1_PROMOTION_HTML,sourceOrigin=process.env.CRA1_PROMOTION_SOURCE_ORIGIN;
if(!out||(!htmlFile&&!sourceOrigin)||path.resolve(out).startsWith(root+'/'))throw Error('Set an external CRA1_PROMOTION_OUT and anonymous HTML or source origin.');
fs.mkdirSync(out,{recursive:true});
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
let html;
if(htmlFile)html=fs.readFileSync(htmlFile,'utf8');
else{
  const response=await fetch(new URL('/cart/shoppingCar.htm',sourceOrigin),{headers:process.env.CRA1_PROMOTION_SOURCE_HOST?{Host:process.env.CRA1_PROMOTION_SOURCE_HOST}:{}});
  assert.equal(response.status,200,'actual anonymous cart document');html=await response.text();
}
const common={website_name:'购物车兼容回归',currency_code:'CNY',currency_prefix:'¥',currency_suffix:'元',custom_fields:{before_settle:0},lang_home_open:0};
const projection={projection_version:2,page:'shoppingCar',common,auth:[],features:{},links:{},locale:{current:'zh-cn'}};
html=html.replace(/<script\b[^>]*>\s*window\.__CRA1_RUNTIME__[\s\S]*?<\/script>/,`<script>window.__CRA1_RUNTIME__=${JSON.stringify(projection)}</script>`)
  .replace(/addons_js=(['"])[\s\S]*?\1/,'addons_js=\'[{"id":48,"name":"EventPromotion"}]\'')
  .replace(/<script\b[^>]*\bsrc=["']\/plugins\/addon\/[^"']+["'][^>]*>[\s\S]*?<\/script>/gi,'');
assert.ok(html.includes('components/cra1EventCode/eventCode.js'),'actual cart uses the CRA1 fork');
let fixture;
const report={status:'running',conditions:'Actual anonymous cart document and installed Vue/Element/CRA1 scripts; every API and business write terminates on loopback.',cases:[]};
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://fixture.invalid'),p=u.pathname;
  const json=(data,status=200)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status,msg:'操作成功',data}))};
  if(p==='/cart/shoppingCar.htm'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(html)}
  if(p.startsWith('/console/v1/')||p.startsWith('/cra1-shared/')&&p.endsWith('.php')){
    let raw='';for await(const chunk of req)raw+=chunk;
    let body;try{body=raw?JSON.parse(raw):{}}catch{body={}}
    fixture.calls.push({path:p,method:req.method,body});
    if(p==='/cra1-shared/snapshot.php')return json({projection_version:3,nav_shape:3,content:{},appearance:{},sidebar:[]});
    if(p==='/cra1-shared/announcements.php'||p==='/cra1-shared/notifications.php')return json({items:[]});
    if(p==='/cra1-shared/compat.php')return json({all:true,pages:[],known:[],permissions:[],features:{},links:{},account:{id:999,username:'演示用户'}});
    if(p==='/console/v1/common')return json(common);
    if(p==='/console/v1/account')return json({account:{id:999,username:'演示用户',email:'',phone:'',credit:0},custom_fields:[]});
    if(p==='/console/v1/menu')return json({list:[],menu:[]});
    if(p==='/console/v1/presale_consult/config')return json({presale_consult:0,config:{}});
    if(p==='/console/v1/cart'&&req.method==='GET')return json({list:[{product_id:4,name:'兼容性测试商品',qty:fixture.qty,config_options:{duration_id:21},customfield:{event_promotion:'',promo_code:''},stock_control:0}],count:1});
    if(p==='/console/v1/cart/0/qty'&&req.method==='PUT'){
      if(fixture.failQty){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({status:400,msg:'数量修改失败，请稍后重试'}))}
      fixture.qty=body.qty;return json({});
    }
    if(p==='/console/v1/cart/0'&&req.method==='PUT'){fixture.activity=body.customfield?.event_promotion;return json({})}
    if(p==='/console/v1/product/4/config_option'&&req.method==='POST'){
      if(fixture.failQuote){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({status:503,msg:'SQLSTATE fixture /private/quote.php'}))}
      const qty=Number(body.qty),discount=Number(body.config_options?.event_promotion)===41?8.4*qty:0;
      return json({price:84*qty,price_total:84*qty-discount,base_price:84*qty,price_event_promotion_discount:discount,billing_cycle:'月付',duration:2592000,preview:[{name:'规格',value:'标准配置',price:84}],sub_host:[]});
    }
    if(p==='/console/v1/event_promotion/product/4/event_promotion'){
      if(fixture.mode==='network')return req.socket.destroy();
      res.writeHead(200,{'content-type':'application/json'});
      if(fixture.mode==='unlicensed')return res.end(JSON.stringify({status:400,msg:'功能未授权 SQLSTATE /private/activity.php'}));
      return res.end(JSON.stringify({list:[{id:41,type:'percent',value:10,full:0,exclude_with_client_level:0}],addon_event_promotion_does_not_participate:'bottom'}));
    }
    return json({all:true,list:[],count:0});
  }
  const override=p.endsWith('/js/shoppingCar.js')?'cra1-theme/source/legacy-assets/cart/20261012-cart-entry-v1/js/shoppingCar.js':
    p.endsWith('/v10-axios.js')?'public/cra1-shared/src/v10-axios.js':null;
  const file=override?path.join(root,override):path.resolve(root,'public','.'+decodeURIComponent(p));
  if(file.startsWith(root+'/')&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    const type=/\.js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':/\.svg$/.test(file)?'image/svg+xml':'application/octet-stream';
    res.writeHead(200,{'content-type':type});return fs.createReadStream(file).pipe(res);
  }
  fixture.missing.push(p);res.writeHead(404);res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({args:['--no-sandbox','--no-proxy-server']});
try{
  for(const width of [1440,390])for(const mode of ['available','unlicensed','network']){
    fixture={mode,qty:1,activity:'',calls:[],missing:[],failQty:false,failQuote:false};
    const item={width,mode,checks:[],errors:[],outside:[]};report.cases.push(item);
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',...(width<768?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{})});
    await context.addInitScript(()=>{localStorage.setItem('jwt','isolated-fixture');localStorage.setItem('lang','zh-cn')});
    await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){item.outside.push(route.request().url());return route.abort()}return route.continue()});
    const page=await context.newPage();page.setDefaultTimeout(10000);
    page.on('pageerror',error=>item.errors.push(error.message));
    const check=(ok,label)=>{assert.ok(ok,`${mode} ${width}: ${label}`);item.checks.push(label)};
    await page.goto(origin+'/cart/shoppingCar.htm',{waitUntil:'networkidle'});
    const total=mode==='available'?75.6:84;
    await page.waitForFunction(expected=>{const row=document.querySelector('.cra1-basket-page')?.__vue__?.showList[0];return row&&!row.priceLoading&&Math.abs(row.calcItemPrice-expected)<0.001},total);
    check(fixture.calls.some(c=>c.path.includes('/event_promotion/')),'actual activity read executed');
    check(await page.locator('.el-message--error').count()===0,'background failure does not create a customer error toast');
    check(!/功能未授权|SQLSTATE|\/private\//.test(await page.locator('body').innerText()),'optional diagnostics stay out of customer content');
    const plus=page.locator('.cl-pc-cart:visible .el-input-number__increase,.cl-mobile-cart:visible .el-input-number__increase').first();
    await plus.click();
    await page.waitForFunction(expected=>{const row=document.querySelector('.cra1-basket-page').__vue__.showList[0];return row.qty===2&&!row.priceLoading&&Math.abs(row.calcItemPrice-expected)<0.001},total*2);
    check(fixture.calls.some(c=>c.path==='/console/v1/cart/0/qty'&&c.body.qty===2),'real quantity handler submits the native quantity contract');
    check(fixture.calls.some(c=>c.path==='/console/v1/product/4/config_option'&&c.body.qty===2),'quantity recalculates through the native quote endpoint');
    await page.screenshot({path:path.join(out,`cart-${mode}-${width}.png`),fullPage:true});
    fixture.failQty=true;await plus.click();
    await page.getByText('数量修改失败，请稍后重试',{exact:true}).waitFor();
    await page.waitForFunction(()=>{const row=document.querySelector('.cra1-basket-page').__vue__.showList[0];return row.qty===2&&!row.priceLoading});
    check(fixture.qty===2,'real user write failure is visible and restores the prior quantity');
    fixture.failQuote=true;
    await page.evaluate(()=>{const page=document.querySelector('.cra1-basket-page').__vue__;page.getConfigOption(page.showList[0])});
    await page.waitForFunction(()=>{const page=document.querySelector('.cra1-basket-page').__vue__;return !!page.showList[0]?.priceError&&page.checkoutBlocked});
    check(true,'required quote failure remains a blocking error');
    check(item.errors.length===0,'no uncaught script errors');
    check(item.outside.length===0,'no external requests');
    check(fixture.missing.length===0,'all actual assets resolved');
    item.calls=fixture.calls;item.missing=fixture.missing;await context.close();
  }
  report.status='passed';
}finally{
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,checks:report.cases.reduce((n,c)=>n+c.checks.length,0),out}));
