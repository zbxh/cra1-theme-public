/** Installed third-party cart templates against the installed official document.
 * All API calls and business writes terminate at a loopback fixture server.
 * The optional source origin supplies anonymous HTML only, never business data.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const {chromium}=createRequire(path.join(root,'cra1-theme/scripts/package.json'))('playwright');
const out=process.env.CRA1_NATIVE_AUDIT_OUT,sourceOrigin=process.env.CRA1_NATIVE_AUDIT_ORIGIN;
if(!out||!sourceOrigin)throw Error('Set an external CRA1_NATIVE_AUDIT_OUT and the anonymous CRA1_NATIVE_AUDIT_ORIGIN.');
fs.mkdirSync(out,{recursive:true});
const selected=(process.env.CRA1_NATIVE_AUDIT_MODULES||'bt_virtual_host,chinac_cloud_phone,chinac_network,direct_admin,mf_cloud_backup,mf_cloud_disk,mf_cloud_ip,mf_cloud_mysql,mf_dcim_cabinet,whmcs_cloud,whmcs_dcim').split(',');
const widths=(process.env.CRA1_NATIVE_AUDIT_WIDTHS||'1440,390').split(',').map(Number);
const modes=(process.env.CRA1_NATIVE_AUDIT_MODES||'official,cra1').split(',');
assert.ok(modes.length>0&&modes.every(m=>['official','cra1'].includes(m)),'known comparison modes');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const installedRelease=JSON.parse(read('cra1-theme/release.json')).release;
const stage=process.env.CRA1_NATIVE_AUDIT_STAGE;
const release=stage?JSON.parse(fs.readFileSync(path.join(stage,'release.json'),'utf8')).release:installedRelease;
const candidateCss=process.env.CRA1_NATIVE_AUDIT_CSS?fs.readFileSync(process.env.CRA1_NATIVE_AUDIT_CSS,'utf8'):null;
const common={website_name:'模块兼容演示',website_url:'',currency_code:'CNY',currency_prefix:'¥',currency_suffix:'元',cart_change_product:0,cart_instruction:0,custom_fields:{before_settle:0},lang_home_open:0,vendor_native_contract:{enabled:true}};
const projection={projection_version:2,page:'goods',common,auth:[],features:{},links:{},locale:{current:'zh-cn'}};
const docs={};
for(const [name,address] of Object.entries({catalog:'/cart/goodsList.htm?product_id=501',native:'/cart/goods.htm?id=501'})){
 const response=await fetch(new URL(address,sourceOrigin));
 assert.equal(response.status,200,'anonymous real template '+name);
 docs[name]=(await response.text())
  .replace(/<script\b[^>]*>\s*window\.__CRA1_RUNTIME__[\s\S]*?<\/script>/,`<script>window.__CRA1_RUNTIME__=${JSON.stringify(projection)}</script>`)
  .replace(/addons_js=(['"])[\s\S]*?\1/,'addons_js="[]"')
  .replace(/<script\b[^>]*\bsrc=["']\/plugins\/addon\/[^"']+["'][^>]*>[\s\S]*?<\/script>/gi,'')
  .replaceAll('/releases/'+installedRelease+'/', '/releases/'+release+'/');
}
let official=['public/clientarea/template/pc/default/header.php','public/cart/template/pc/default/goods.php','public/clientarea/template/pc/default/footer.php'].map(read).join('');
for(const [key,value] of Object.entries({title:'模块兼容演示',template_catalog:'clientarea',themes:'pc/default',public_themes:'pc/default',template_catalog_cart:'cart',themes_cart:'pc/default',clientarea_theme_color:'default',system_version:'10.7.4',lang_home:'zh-cn',lang_home_follow_browser:'0',lang_home_open:'0'}))official=official.replaceAll('{$'+key+'}',value);
official=official.replace('{:json_encode($addons)}','[]');
const radio=(value,extra={})=>({id:value,type:'radio',value,min_value:value,max_value:value,customfield:{multi_language:{}},...extra});
const disk=radio(50,{other_config:{disk_type:'SSD'},customfield:{multi_language:{other_config:{disk_type:'SSD'}}}});
const meal={id:11,name:'标准套餐',description:'测试套餐',disk:100,disk_unit:'GB',email_num:5,flow:1000,flow_unit:'GB',independent_ip:1,php_version_low:'7.4',php_version_high:'8.2',domain_num:2,sub_domain_num:2,gift_domain:0,os:'Linux',os_detail:'Debian',multi_language:{os:'Linux'}};
const recommended={id:11,name:'标准套餐',description:'测试套餐',data_center_id:3,line_id:4,bill_type:'bw',cpu:2,memory:4,bw:10,flow:1000,ip_num:1,ipv6_num:0,system_disk_size:50,system_disk_type:'SSD',backup_space:0};
const area={id:3,name:'测试可用区',line:[{id:4,name:'测试线路',bill_type:'bw'}],package:[{...meal,cannot_add_value:1}],recommend_config:[recommended]};
const centers=[{id:1,name:'测试区域',city:[{id:2,name:'测试城市',area:[area]}],data_center:[{id:3,name:'测试机房',model:[{id:11,name:'标准型号',description:'测试配置',cpu:2,memory:4}]}]}];
const durations=[{id:21,name:'月付',price:'10.00',amount:'10.00',duration:2592000},{id:22,name:'年付',price:'100.00',amount:'100.00',duration:31536000}];
const line={id:4,bill_type:'bw',bw:[radio(10),radio(20)],flow:[radio(1000)],ip:[radio(1)],ipv6:[radio(0)],defence:[],ip_segment:[],order_default_defence:0};
const baseConfig={memory_unit:'GB',support_normal_network:1,support_vpc_network:0,only_sale_recommend_config:1,default_nat_acl:0,rand_ssh_port:0};
const whmcs={common_product:{name:'标准商品',pay_type:'recurring_prepayment',allow_qty:1,order_page_description:''},configoptions:[{id:1,option_name:'规格',option_type:'select',description:'',subs:[{id:101,option_name:'标准'},{id:102,option_name:'专业'}]},{id:2,option_name:'配额',option_type:'quantity',qty_min:1,qty_max:5,subs:[]}],custom_cycles:durations.map(p=>({...p,cycle_amount:p.amount})),cycles:{onetime:'-1.00'}};
const field={id:9,field_name:'用途',description:'请填写用途',field_type:'text',is_required:1,regexpr:'',field_option:''};
let moduleName,calls=[],misses=[];
const report={status:'running',release,candidateCssSha256:candidateCss?createHash('sha256').update(candidateCss).digest('hex'):null,conditions:'Anonymous current HTML and installed module HTML/JS/CSS; official document uses installed default templates. Every API and write is local. No configuration or production data is changed.',generatedFieldComparison:'Module-generated database_user/database_password values are compared by type and length; all other request fields are compared exactly.',cases:[],comparisons:[]};
const save=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
function orderPage(){
 if(moduleName==='direct_admin')return {countries:[{country_id:1,name_zh:'测试区域',cites:[{city:'测试城市',areas:[{area:'测试可用区',meals:[meal]}]}]}],config:{}};
 if(moduleName==='bt_virtual_host')return {countries:[{id:1,name:'测试区域',areas:[{name:'测试城市',regions:[{id:3,name:'测试可用区',packages:[meal]}]}]}],config:{}};
 if(moduleName==='mf_cloud_backup')return {list:centers};
 return {data_center:centers,config:baseConfig,cpu:[radio(2)],memory:[radio(4)],backup_space:[radio(0)],system_disk:[disk],data_disk:[disk],limit_rule:[],resource_package:[],order_check_u:0};
}
const product=()=>({id:501,module:moduleName,name:'第三方商品示例',description:'<p>真实模板，模拟业务数据</p>',price:'10.00',cycle:'月',pay_type:'recurring_prepayment',mode:'',customfield:{},product_group_id:301,product_group_id_first:300,hidden:0,stock_control:0});
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://fixture.invalid'),p=u.pathname;
 const html=s=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(s)};
 const json=data=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:200,msg:'操作成功',data}))};
 if(p==='/cart/goodsList.htm')return html(docs.catalog);
 if(p==='/cart/goods.htm')return html(docs.native);
 if(p==='/official/goods.htm')return html(official);
 if(['/cart/settlement.htm','/cart/shoppingCar.htm','/account.htm','/login.htm'].includes(p))return html('<!doctype html><h1>隔离导航终点</h1>');
 if(p.startsWith('/console/v1/')||p.startsWith('/cra1-shared/')&&p.endsWith('.php')){
  let raw='';for await(const chunk of req)raw+=chunk;
  let body;try{body=raw?JSON.parse(raw):null}catch{body=raw}
  calls.push({path:p,method:req.method,query:Object.fromEntries(u.searchParams),body});
  if(p==='/cra1-shared/snapshot.php')return json({projection_version:3,nav_shape:3,content:{},style:{},settings:{},features:{},appearance:{show_cart:1},sidebar:[]});
  if(p==='/cra1-shared/announcements.php'||p==='/cra1-shared/notifications.php')return json({items:[]});
  if(p==='/cra1-shared/compat.php')return json({all:true,pages:[],known:[],permissions:[],features:{},links:{},account:{id:999,username:'演示用户'}});
  if(p==='/console/v1/common')return json(common);
  if(p==='/console/v1/account')return json({account:{id:999,username:'演示用户',email:'',phone:'',credit:0},custom_fields:[]});
  if(p==='/console/v1/menu')return json({list:[],menu:[]});
  if(p==='/console/v1/presale_consult/config')return json({presale_consult:0,config:{}});
  if(p.includes('/event_promotion/')){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({status:200,msg:'操作成功',list:[]}))}
  if(p==='/console/v1/product/group/first')return json({list:[{id:300,name:'测试产品'}]});
  if(p==='/console/v1/product/group/second')return json({list:[{id:301,name:'第三方商品',type:'normal'}]});
  if(p==='/console/v1/product')return json({list:Number(u.searchParams.get('page')||1)>1?[]:[product()],count:1});
  if(p==='/console/v1/product/501')return json({product:product()});
  if(p==='/console/v1/product/501/config_option'&&req.method==='GET')return json({module:moduleName,product_name:product().name,content:read('public/plugins/server/'+moduleName+'/template/cart/pc/default/goods.html')});
  if(p.endsWith('/'+moduleName+'/order_page')||p.endsWith('/'+moduleName+'/data_center'))return json(orderPage());
  if(p.endsWith('/'+moduleName+'/active_host'))return json({active_host:[]});
  if(p.endsWith('/'+moduleName+'/storage'))return json({list:[radio(100)]});
  if(p.endsWith('/'+moduleName+'/data_center_disk'))return json({list:[disk]});
  if(p.endsWith('/'+moduleName+'/data_center_bw'))return json({list:[radio(10),radio(20)]});
  if(p.endsWith('/'+moduleName+'/duration_price'))return json({list:durations});
  if(p.endsWith('/'+moduleName+'/duration'))return json(durations);
  if(p.endsWith('/'+moduleName+'/image')){
   const list=[{id:41,name:'Linux',image:[{id:41,name:'Debian',type:'Linux'}]}];
   return json(moduleName==='chinac_cloud_phone'?{image:list}:{list});
  }
  if(p.includes('/'+moduleName+'/line'))return json(line);
  if(p==='/console/v1/'+moduleName+'/product/501/configoption')return json(whmcs);
  if(p==='/console/v1/'+moduleName+'/product/501/configoption/calculate')return json({custom_cycles:whmcs.custom_cycles,cycles:whmcs.cycles});
  if(p.endsWith('/self_defined_field/order_page'))return json({data:[field]});
  if(p==='/console/v1/product/501/config_option'&&req.method==='POST'){
   const annual=Number(body?.config_options?.duration_id??body?.config_options?.cycle)===22,unit=annual?100:10;
   return json({price:unit,price_total:unit*(body?.qty||1),price_event_promotion_discount:0,price_promo_code_discount:0,price_client_level_discount:0,preview:[{name:'测试配置',value:'标准',price:unit}],duration:annual?31536000:2592000,sub_host:[]});
  }
  if(p==='/console/v1/cart')return json({list:[],count:0});
  if(p.startsWith('/console/v1/cart/')&&req.method==='PUT')return json({});
  if(['/console/v1/country','/console/v1/security_group','/console/v1/ssh_key'].includes(p)||p.includes('/theme/')||p.includes('/cra1-theme/'))return json({all:true,list:[],count:0});
  if(p.includes('/'+moduleName+'/data_center/')||p.includes('vpc_network'))return json({list:[]});
  misses.push({path:p,method:req.method});return json({list:[],count:0});
 }
 const roots=stage?[path.resolve(stage,'public'),path.join(root,'public')]:[path.join(root,'public')];
 const file=roots.map(base=>path.resolve(base,'.'+decodeURIComponent(p))).find(file=>roots.some(base=>file.startsWith(base+'/'))&&fs.existsSync(file)&&fs.statSync(file).isFile());
 if(file&&/\.(js|css|png|svg|jpe?g|webp|gif|ico|woff2?|ttf|map)$/i.test(file)){
  res.writeHead(200,{'content-type':/\.js$/i.test(file)?'text/javascript':/\.css$/i.test(file)?'text/css':/\.svg$/i.test(file)?'image/svg+xml':/\.woff2?$/i.test(file)?'font/woff2':'application/octet-stream'});fs.createReadStream(file).pipe(res);return;
 }
 misses.push({path:p,method:req.method});res.writeHead(404);res.end('not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(moduleName of selected)for(const mode of modes)for(const width of widths){
  const item={module:moduleName,mode,width,checks:[],errors:[],consoleErrors:[],outsideRequests:[]};report.cases.push(item);calls=[];misses=[];
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',...(width<768?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}:{})});
  context.setDefaultTimeout(6000);
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.origin!==origin){item.outsideRequests.push(u.origin+u.pathname);return route.abort()}
   return route.continue();
  });
  await context.addInitScript(common=>{
   localStorage.setItem('common_set_before',JSON.stringify(common));localStorage.setItem('lang','zh-cn');localStorage.setItem('jwt','isolated-fixture-not-a-token');
   let seed=12345;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  },common);
  const page=await context.newPage();page.on('pageerror',e=>item.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'||/@@@|[Ee]rror/.test(m.text()))item.consoleErrors.push(m.text())});
  const check=(ok,label)=>{assert.ok(ok,label);item.checks.push(label)};
  try{
   await page.goto(origin+(mode==='official'?'/official/goods.htm?id=501':'/cart/goodsList.htm?product_id=501'),{waitUntil:'load',timeout:45000});
   if(mode==='cra1')await page.waitForURL('**/cart/goods.htm?id=501');
   if(mode==='cra1'&&candidateCss)await page.addStyleTag({content:candidateCss});
   await page.waitForFunction(()=>[...document.querySelectorAll('.config-box .content > div')].some(n=>{const v=n.__vue__;return v&&(v.cycleList?.length>0||v.custom_cycles?.length>0)}),{},{timeout:12000});
   await page.waitForTimeout(400);
   const measure=()=>page.evaluate(()=>{
    const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';
    const rect=n=>{const {top,right,bottom,left,width,height}=n.getBoundingClientRect();return {top,right,bottom,left,width,height}};
    const host=[...document.querySelectorAll('.config-box .content > div')].find(n=>n.__vue__),v=host.__vue__;
    const quantities=[...host.querySelectorAll('.el-input-number,.del-add')].filter(visible).map(n=>({class:n.className,rect:rect(n),input:n.querySelector('input')?{rect:rect(n.querySelector('input')),value:n.querySelector('input').value}:null,buttons:[...n.querySelectorAll('.del,.add,.el-input-number__decrease,.el-input-number__increase')].map(b=>({class:b.className,rect:rect(b),display:getComputedStyle(b).display}))}));
    const columns=host.querySelector('.common-box:has(> .l-config + .order-right)');
    const footer=host.querySelector('.f-order'),footerRect=footer?rect(footer):null;
    const footerControls=footer?[...footer.querySelectorAll('.duration-select,.el-input-number,.bot-price,.right .add-cart,.right .buy')].filter(visible).map(n=>({class:n.className,rect:rect(n)})):[];
    return {quantity:v.qty??v.orderData?.qty,cycle:v.params?.duration_id??v.orderData?.cycle??v.cycle,cycles:v.cycleList?.map(c=>c.id)??v.custom_cycles?.map(c=>c.id),price:v.calcTotalPrice??v.totalPrice,overflow:document.documentElement.scrollWidth>innerWidth+1,host:rect(host),header:document.querySelector('.cra1-header')?rect(document.querySelector('.cra1-header')):null,twoColumns:!!columns,l:host.querySelector('.l-config')?rect(host.querySelector('.l-config')):null,sidebar:host.querySelector('.order-right')?{...rect(host.querySelector('.order-right')),position:getComputedStyle(host.querySelector('.order-right')).position}:null,footer:footerRect,recognizedFooter:!!host.querySelector('.f-order > .el-main > .main-card > .left .duration-select'),footerControls,themeQuantityMatches:host.querySelectorAll('.cra1-basket-page .el-input-number,.cra1-confirm-page .el-input-number').length,themeCalculators:document.querySelectorAll('.cl-rail,.cl-rail-dock,.cl-config-frame').length,styles:[...document.querySelectorAll('link[rel=stylesheet]')].map(n=>new URL(n.href).pathname),quantities};
   });
   item.initial=await measure();
   check(item.initial.cycles.length===2,'native periods loaded');
   check(item.initial.themeQuantityMatches===0,'unified cart quantity selectors never match module controls');
   check(item.initial.themeCalculators===0,'no extra theme calculator or iframe');
   if(mode==='cra1'){
    check(await page.locator('.cra1-header').count()===1&&await page.locator('.cra1-aside').count()===1,'one theme navigation');
    check(!item.initial.overflow,'no horizontal page overflow');
    if(item.initial.twoColumns){
     const {l,sidebar,header}=item.initial;
     check(sidebar.top>=header.bottom,'native price panel does not cover the theme header');
     check(width>1024?sidebar.left>=l.right+15:sidebar.top>=l.bottom+15,'native price panel leaves a gap from configuration');
     check(sidebar.left>=0&&sidebar.right<=width+1,'native price panel stays inside the viewport');
     check(width>1024?sidebar.position==='sticky':sidebar.position==='static','native price panel follows the screen layout');
     check(await page.locator('.config-box .content .common-box > .order-right > .flod:visible').count()===0,'reflowed price panel has no redundant flyout handle');
    }
    if(item.initial.recognizedFooter){
     const {footer,footerControls,quantities}=item.initial;
     check(footerControls.every(c=>c.rect.left>=footer.left-1&&c.rect.right<=footer.right+1&&c.rect.top>=footer.top-1&&c.rect.bottom<=footer.bottom+1),'native bottom-order controls fit their panel');
     for(const q of quantities)if(q.buttons.length===2)check(q.buttons[0].rect.right<=q.buttons[1].rect.left,'native bottom-order quantity buttons do not overlap');
    }
   }
   await page.screenshot({path:path.join(out,`${moduleName}-${mode}-${width}-initial.png`),fullPage:true});
   if(mode==='official'&&item.initial.recognizedFooter&&(item.initial.footerControls.some(c=>c.rect.right>width+1)||item.initial.quantities.some(q=>q.buttons.length===2&&q.buttons[0].rect.right>q.buttons[1].rect.left))){
    item.nativeLayoutLimitation='Installed official footer controls are clipped or overlapping at the requested width. Initial geometry and screenshot are retained; only its business-contract comparison uses the operable desktop viewport. CRA1 must retain the requested width and pass real clicks.';
    item.comparisonViewportWidth=1440;
    await page.setViewportSize({width:1440,height:900});
    await page.waitForTimeout(150);
   }
   const flyout=page.locator('.config-box .content .order-right:not(.isFlod) > .flod:visible');
   if(await flyout.count()){
    const box=await flyout.first().boundingBox();
    if(box&&box.x<width&&box.x+box.width>0){await flyout.first().click();await page.waitForTimeout(350);item.openedNativeFlyout=true}
   }
   const annual=page.locator('.config-box .content .cycle .item:visible').filter({hasText:'年付'});
   if(await annual.count())await annual.last().click();
   else{
    await page.locator('.config-box .content .duration-select:visible input').last().click();
    await page.locator('.el-select-dropdown__item:visible').filter({hasText:'年付'}).last().click();
   }
   await page.waitForFunction(()=>[...document.querySelectorAll('.config-box .content > div')].some(n=>{const v=n.__vue__;return v&&(v.params?.duration_id===22||v.orderData?.cycle===22||v.cycle===22)}));
   await page.waitForTimeout(150);
   item.afterCycle=await measure();
   check(calls.some(c=>c.method==='POST'&&c.path.endsWith('/config_option')&&(c.body?.config_options?.duration_id===22||c.body?.config_options?.cycle===22)),'native cycle selection reaches the quote request');
   check(Number(item.afterCycle.price)===100,'native cycle change displays the returned annual quote');
   const add=page.locator('.config-box .content .del-add .add:visible').last();
   const nativeIncrease=page.locator('.config-box .content .f-order .el-input-number__increase:visible').last();
   const genericIncrease=page.locator('.config-box .content .order-right .el-input-number__increase:visible').last();
   const plus=await add.count()?add:await nativeIncrease.count()?nativeIncrease:genericIncrease;
   await plus.click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.config-box .content > div')].some(n=>{const v=n.__vue__;return v&&(v.qty??v.orderData?.qty)===2}));
   await page.waitForTimeout(250);item.afterPlus=await measure();check(item.afterPlus.quantity===2,'native quantity plus works');
   check(Number(item.afterPlus.price)===200,'native quantity change displays the returned total');
   const minus=await add.count()?page.locator('.config-box .content .del-add .del:visible').last():await nativeIncrease.count()?page.locator('.config-box .content .f-order .el-input-number__decrease:visible').last():page.locator('.config-box .content .order-right .el-input-number__decrease:visible').last();
   const overlap=item.afterPlus.quantities.some(q=>q.buttons.length===2&&q.buttons[0].rect.right>q.buttons[1].rect.left);
   if(mode==='official'&&overlap){
    item.nativeLayoutLimitation='Installed official quantity buttons overlap at this width. Keyboard decrement is used only for the official request comparison; CRA1 must pass real button clicks.';
    await page.locator('.config-box .content .f-order .el-input-number input:visible').last().focus();
    await page.keyboard.press('ArrowDown');
   }else await minus.click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.config-box .content > div')].some(n=>{const v=n.__vue__;return v&&(v.qty??v.orderData?.qty)===1}));
   check((await measure()).quantity===1,'native quantity minus works');
   await page.waitForTimeout(150);
   check(Number((await measure()).price)===100,'native quantity decrease restores the returned total');
   check(calls.some(c=>c.method==='POST'&&c.path.endsWith('/config_option')&&c.body?.qty===2),'native quantity change reaches the quote request');
   for(const input of await page.locator('.custom-goods-box input:visible').all())await input.fill('测试用途');
   for(const input of await page.locator('.email input:visible').all())await input.fill('fixture@example.test');
   const addButton=page.getByRole('button',{name:'加入购物车',exact:true});
   const addCart=await addButton.count()?addButton:page.locator('.config-box .content .f-order .add-cart');
   await addCart.click();
   await page.waitForTimeout(700);
   item.addCart=calls.filter(c=>c.path==='/console/v1/cart'&&c.method==='POST');
   item.quotes=calls.filter(c=>c.path.endsWith('/config_option')&&c.method==='POST');
   item.validation=await page.locator('.el-form-item__error:visible,.el-message--error').allTextContents();
   check(item.addCart.length===1,'one native add-to-cart request');
   item.dialog=await page.locator('.cartDialog:visible').evaluate(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,viewportWidth:innerWidth,viewportHeight:innerHeight}});
   check(item.dialog.top>=0&&item.dialog.bottom<=900&&item.dialog.left>=-1&&item.dialog.right<=item.dialog.viewportWidth+1,'native add dialog fits the current viewport');
   await page.getByRole('button',{name:'继续购物',exact:true}).click();
   await page.locator('.cartDialog:visible').waitFor({state:'hidden'});
   check(true,'native dialog closes');
   const buyButton=page.getByRole('button',{name:'立即购买',exact:true});
   await (await buyButton.count()?buyButton:page.locator('.config-box .content .f-order .buy')).click();
   await page.waitForURL('**/cart/settlement.htm?id=501');
   item.checkout=await page.evaluate(()=>JSON.parse(sessionStorage.product_information));
   check(item.checkout.product_id==501&&item.checkout.qty===1,'native purchase preserves product and quantity');
   check(item.errors.length===0,'no uncaught module exceptions');
   check(item.outsideRequests.length===0,'all browser requests remain on the isolated origin');
   item.status='passed';
  }catch(error){item.status='failed';item.failure=error.message;await page.screenshot({path:path.join(out,`${moduleName}-${mode}-${width}-failure.png`),fullPage:true}).catch(()=>{});item.diagnostics=await page.evaluate(()=>({text:document.querySelector('.config-box')?.innerText.slice(0,1600),vms:[...document.querySelectorAll('.config-box .content > div')].filter(n=>n.__vue__).map(n=>({class:n.className,qty:n.__vue__.qty,cycle:n.__vue__.cycleList?.length,params:n.__vue__.params,activeName:n.__vue__.activeName}))})).catch(()=>null)}
  item.calls=calls;item.misses=misses;save();console.log(JSON.stringify({module:moduleName,mode,width,status:item.status,failure:item.failure,checks:item.checks.length,misses:item.misses,errors:item.errors.length}));await context.close();
 }
 const canonical=value=>JSON.stringify(value,(key,v)=>['database_user','database_password'].includes(key)&&typeof v==='string'?`<native-generated:${v.length}>`:v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 for(const name of selected)for(const width of widths){
  const a=report.cases.find(c=>c.module===name&&c.width===width&&c.mode==='official'),b=report.cases.find(c=>c.module===name&&c.width===width&&c.mode==='cra1');
  if(!a||!b)continue;
  const nativeQuantityStylesEqual=canonical(a.initial?.quantities.map(q=>({height:q.rect.height,inputHeight:q.input?.rect.height,buttons:q.buttons.map(s=>({height:s.rect.height,display:s.display}))})))===canonical(b.initial?.quantities.map(q=>({height:q.rect.height,inputHeight:q.input?.rect.height,buttons:q.buttons.map(s=>({height:s.rect.height,display:s.display}))})));
  report.comparisons.push({module:name,width,official:a.status,cra1:b.status,sameCartRequest:canonical(a.addCart)===canonical(b.addCart),sameQuotes:canonical(a.quotes)===canonical(b.quotes),sameCheckout:canonical(a.checkout)===canonical(b.checkout),nativeQuantityStylesEqual,quantityStyleValidated:nativeQuantityStylesEqual||width<=1024&&b.initial?.recognizedFooter&&b.status==='passed',narrowFooterLayoutAdjusted:width<=1024&&b.initial?.recognizedFooter,officialLayoutLimitation:a.nativeLayoutLimitation||null,officialOverflow:a.initial?.overflow,cra1Overflow:b.initial?.overflow});
 }
 report.status=report.cases.every(c=>c.status==='passed')&&report.comparisons.every(c=>c.sameCartRequest&&c.sameQuotes&&c.sameCheckout&&c.quantityStyleValidated)?'passed':'failed';save();if(report.status==='failed')process.exitCode=1;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,checks:report.cases.reduce((n,c)=>n+c.checks.length,0)}));
