/** Actual theme + installed native plugin templates, isolated API/gateway fixtures only. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {gzipSync} from 'node:zlib'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
const require=createRequire(import.meta.url),{chromium,request}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright')
const root=path.resolve(new URL('../..',import.meta.url).pathname),native=process.env.CRA1_NATIVE_ROOT,stage=process.env.CRA1_FIRST_WAVE_STAGE,out=process.env.CRA1_FIRST_WAVE_OUT
if(!native||!stage||!out)throw Error('Set CRA1_NATIVE_ROOT, CRA1_FIRST_WAVE_STAGE and CRA1_FIRST_WAVE_OUT (outside the site).')
const manifest=JSON.parse(fs.readFileSync(path.join(stage,'release.json'))),release=manifest.release
const baseline=process.env.CRA1_FIRST_WAVE_BASELINE || JSON.parse(fs.readFileSync(path.join(native,'cra1-theme/release.json'))).release
let useBaseline=false
fs.mkdirSync(out,{recursive:true});const htmlDir=path.join(out,'html');fs.mkdirSync(htmlDir,{recursive:true})
if(process.env.CRA1_BROWSER_STATE){
 if(!process.env.CRA1_BROWSER_ORIGIN)throw Error('Set CRA1_BROWSER_ORIGIN for an explicitly authorized read-only capture.')
 const capture=await request.newContext({storageState:process.env.CRA1_BROWSER_STATE,ignoreHTTPSErrors:true})
 try{for(const [name,url]of [['member','/recharge.htm'],['shoppingCar','/cart/shoppingCar.htm'],['settlement','/cart/settlement.htm']]){
  const response=await capture.get(process.env.CRA1_BROWSER_ORIGIN+url)
  const text=await response.text();assert.ok(text.includes('CRA1Shared')||text.includes('cra1-shared.js'));fs.writeFileSync(path.join(htmlDir,name+'.html'),text,{mode:0o600})
 }}finally{await capture.dispose()}
}
const baseHtml=fs.readFileSync(path.join(htmlDir,'member.html'),'utf8'),head=baseHtml.slice(0,baseHtml.indexOf('</head>')),footer=baseHtml.slice(baseHtml.indexOf('<!-- =======公共======= -->'))
const token='h.'+Buffer.from(JSON.stringify({info:{id:991001}})).toString('base64url')+'.fixture'
const common={website_name:'演示云 · 隔离测试',currency_prefix:'¥',currency_suffix:'',lang_home:'zh-cn',recharge_open:1,recharge_min:'1',recharge_max:'10000'}
const product={id:31,product_id:4,product_name:'应用托管服务',name:'application-service-31',status:'Active',module:'idcsmart_common',billing_cycle:'onetime',billing_cycle_name:'一次性',first_payment_amount:'120.00',active_time:1792533600,customfields:[],...(process.env.CRA1_FIRST_WAVE_NATIVE_MODULE==='west_domain'?{product_name:'域名服务',name:'example.test',module:'west_domain',billing_cycle:'annually',billing_cycle_name:'每年',due_time:1824069600}:{})}
const account={id:991001,username:'示例用户',email:'demo@example.invalid',credit:'40.00',theme_avatar:{type:'preset',value:'graphite'}}
const gateways=[{id:1,name:'FixtureQr',title:'扫码支付',url:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" rx="6" fill="#16865c"/><path d="M8 8h12v12H8z" fill="white"/></svg>').toString('base64')},{id:2,name:'FixtureForm',title:'银行卡 · 跳转支付',url:'/fixture/broken-logo.png'},{id:3,name:'FixtureSdk',title:'SDK 支付'},{id:4,name:'UserCustom',title:'线下转账'}]
let state='Unpaid',balance=40,credit=0,payMode='html',failedGateway=false,payCount=0,statusInflight=0,maxStatusInflight=0,statusDelay=0,moduleFail=false
const requests=[],checks=[],errors=[],assetErrors=[],perf=[],staticRequests=[]
function check(value,label){assert.ok(value,label);checks.push(label);console.log(JSON.stringify({check:label}))}
function order(){return{id:7,order_sn:'202610230007',type:'new',status:state,amount:'120.00',amount_unpaid:Math.max(0,120-credit).toFixed(2),credit:String(credit),create_time:1792736400,unpaid_timeout:1800,remain_pay_time:1250,review_fail_reason:state==='ReviewFail'?'凭证不够清晰，请重新上传完整的转账回单。':'',voucher:state==='WaitReview'?[{save_name:'fixture.pdf',name:'转账回单.pdf',url:'/fixture/proof.pdf'}]:[],items:[{id:1,product_name:'应用托管服务 · 自定义运行环境与数据备份',amount:'120.00',host_id:31,billing_cycle:'一次性'}]}}
const json=(res,data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({status:200,msg:'操作成功',data}))}
function replaceAssets(html){return html.replace(/\/(clientarea\/template\/pc\/cra1|cra1-shared|cart\/template\/pc\/cra1)\/releases\/[^/"']+/g,(_,prefix)=>'/'+prefix+'/releases/'+(useBaseline?baseline:release))}
function templateHtml(name){
 const file=name==='shoppingCar'||name==='settlement'?path.join(useBaseline?(process.env.CRA1_FIRST_WAVE_BASELINE_ROOT||native):root,'public/cart/template/pc/cra1',name+'.php'):path.join(native,'public/plugins/addon/idcsmart_ticket/template/clientarea/pc/default',name+'.html')
 let template=fs.readFileSync(file,'utf8').replace(/\{php\}[\s\S]*?\{\/php\}/g,'')
 template=template.replace(/\{:cra1_theme_asset_url\('(\w+)', '([^']*)', '[^']*'\)\}/g,(_,kind,file)=>({cart:'/cart/template/pc/cra1',native:'/clientarea/template/pc/cra1',member:'/clientarea/template/pc/cra1'}[kind])+'/releases/'+release+'/'+file)
 for(const [key,val]of Object.entries({template_catalog_cart:'cart',themes_cart:'pc/cra1',template_catalog:'clientarea',themes:'pc/cra1'}))template=template.replaceAll('{$'+key+'}',val)
 return head+template+footer
}
const bootstrap=`<script>localStorage.setItem('jwt',${JSON.stringify(token)});sessionStorage.shoppingCartList='[0]';window.__CRA1_SHELL_READY__=false;</script>`
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://127.0.0.1');let p=url.pathname;if(p==='/cra1-shared/compat.php')p='/console/v1/theme/'+String(url.searchParams.get('target')).replace(/^\//,'');let raw='';for await(const part of req)raw+=part;let body={};try{body=JSON.parse(raw||'{}')}catch{}
 staticRequests.push(p)
 if(p.startsWith('/console/v1/')){
  const route=p.slice(11);requests.push({path:route,method:req.method,body:route==='/pay'?{id:body.id,gateway:body.gateway}:undefined})
  if(route==='/theme/access')return json(res,{all:true,actions:{billing:true,control:true,power:true},known:[],rules:[],security:[]})
  if(route==='/account'||route==='/index')return json(res,{account:{...account,credit:String(balance)}})
  if(route==='/gateway')return json(res,{list:gateways})
  if(route==='/order/7')return json(res,{order:order(),customfields:{}})
  if(route==='/order/7/transaction_record')return json(res,{list:[]})
  if(route==='/credit'){credit=body.use?Math.min(balance,120):0;return json(res,{id:7})}
  if(route==='/pay'){
   payCount++;if(failedGateway){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:400,msg:'支付方式已停用，请选择其他方式'}));return}
   if(body.gateway==='credit'){if(balance>=120){balance-=120;state='Paid'}res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:200,code:state==='Paid'?'Paid':'Unpaid',data:{}}));return}
   if(payMode==='immediate'){state='Paid';res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:200,code:'Paid',data:{}}));return}
   const html=body.gateway==='UserCustom'?'<div><b>测试银行 · 演示账户</b><p>户名：隔离测试商户</p><p>账号：0000 0000 0000（不可用于真实转账）</p></div>':body.gateway==='FixtureForm'?'<form id="fixture-payment-form" action="/fixture/form-return" method="post"><input name="order" type="hidden" value="7"><button type="submit">前往银行付款</button></form><script>window.__fixtureFormReady=true;<\/script>':body.gateway==='FixtureSdk'?'<div id="fixture-sdk-target">SDK 正在准备…</div><script src="/fixture/sdk.js"><\/script><script>window.__fixtureSdk.start("fixture-sdk-target");<\/script>':'<div style="text-align:center"><img src="/fixture/qr.svg" width="172" height="172" alt="测试付款二维码"><p style="margin-top:12px;font-size:12px;color:#8a8f96">隔离网关 · 请勿实际付款</p></div><script>window.__fixtureQr=true;<\/script>'
   return json(res,{html})
  }
  if(route==='/pay/7/status'){statusInflight++;maxStatusInflight=Math.max(maxStatusInflight,statusInflight);setTimeout(()=>{statusInflight--;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:200,code:state==='Paid'?'Paid':'Unpaid',data:{}}))},statusDelay);return}
  if(route==='/order/7/submit_application'){state='WaitUpload';return json(res,{})}
  if(route==='/order/7/voucher'){state='WaitReview';return json(res,{})}
  if(route==='/order/7/gateway'){state='Unpaid';return json(res,{})}
  if(route==='/upload')return json(res,{save_name:'fixture.pdf',image_url:'/fixture/proof.pdf'})
  if(route==='/recharge')return json(res,{id:7})
  if(route==='/credit_limit')return json(res,{credit_limit:{status:'Active',remaining_amount:'500.00'}})
  if(route==='/menu')return json(res,{menu:[{id:1,name:'会员中心',url:'home.htm'},{id:3,name:'财务中心',url:'finance.htm'},{id:4,name:'工单支持',url:'plugin/99/ticket.htm'}]})
  if(route==='/ticket')return json(res,{list:Array.from({length:5},(_,i)=>({id:i+1,ticket_num:'20261023'+i,title:['应用服务部署咨询与产品使用问题','付款成功后服务尚未开通','关于自定义产品参数的使用方法'][i%3],name:'售后服务部',last_reply_time:1792736400-i*500,status:['等待客服回复','处理中','已回复'][i%3],status_id:i+1,color:['#a68859','#737c87','#40856e'][i%3]})),count:42})
  if(route==='/ticket/type')return json(res,{list:[{id:1,name:'技术支持'},{id:2,name:'财务咨询'}]})
  if(route==='/ticket/status')return json(res,{list:[{id:1,name:'等待客服回复'},{id:2,name:'处理中'},{id:3,name:'已回复'}]})
  if(route==='/ticket/department')return json(res,{list:[{id:1,name:'售后服务部'}]})
  if(route==='/ticket/config')return json(res,{ticket_notice_open:1,ticket_notice_description:'提交工单时，请简要说明问题与相关产品，便于我们为您处理。'})
  if(route==='/ticket/7')return json(res,{ticket:{id:7,title:'应用服务部署与使用咨询',ticket_num:'20261023007',status:'等待客服回复',color:'#a68859',name:'售后服务部',type_name:'技术支持',ticket_type_id:1,create_time:1792736400,host_ids:[31],can_operate:1,replies:[{id:2,type:'Admin',admin_name:'技术支持',create_time:1792736450,content:'<p>您好，已经收到您的问题。您可以在产品管理页查看部署说明，如需协助，请继续回复。</p>',attachment:[]},{id:1,type:'Client',client_name:'示例用户',create_time:1792736400,content:'<p>您好，我希望了解这个产品如何上传应用，以及在哪里查看部署结果。</p>',attachment:[{name:'部署说明示例.pdf',url:'/fixture/proof.pdf'}]}]}})
  if(route==='/host'||route==='/home/host')return json(res,{list:[product],count:1})
  if(route==='/theme/host/31'||route==='/host/31')return json(res,{host:product,self_defined_field:[]})
  if(route==='/idcsmart_common/host/31/configoption')return json(res,{host:product,configoptions:[{option_name:'应用环境',suboption_name:'自定义部署'}],chart:[],client_area:[{name:'扩展功能',content:'<p>模块扩展区域示例</p>'}],client_button:{control:[],console:[]},security_group_supported:false,os:{}})
  if(route==='/host/31/renew'||route==='/host/31/renew/auto')return json(res,{host:[],status:0})
  if(route==='/idcsmart_domain/domain/31')return json(res,{domain:{id:31,domain:'example.test',zh_owner:'隔离测试用户',en_owner:'Fixture User',status:'ok',module_name:'WestDomain',lock_status:0,create_time:1792533600,expiredate:1824069600,expireday:365,certification:1,recertification_status:0,transfer:0,dns_host1:'ns1.example.invalid',dns_host2:'ns2.example.invalid',dns_host_ext:''}})
  if(route==='/idcsmart_domain/config'||route==='/common')return json(res,{cron_due_renewal_first_swhitch:0})
  if(route==='/refund/host/31/refund')return json(res,{refund:null})
  if(route==='/host/31/view'&&process.env.CRA1_FIRST_WAVE_NATIVE_MODULE)return json(res,{content:fs.readFileSync(path.join(native,'public/plugins/server',process.env.CRA1_FIRST_WAVE_NATIVE_MODULE==='west_domain'?'west_domain':'idcsmart_common','template/clientarea/pc/default/product_detail.html'),'utf8').replace(/\{if[^}]+\}|\{\/if\}/g,'')})
  if(route==='/host/31/view')return json(res,{content:'<div class="fixture-module"><h2>产品管理</h2><p>第三方模块提供的管理区</p><button id="module-operation" onclick="this.textContent=\'操作已触发\'">模块自定义操作</button><script src="/fixture/module-api.js"><\/script><script src="http://sdk.fixture.invalid/module-sdk.js"><\/script><script>window.__fixtureModuleOrder.push(3);<\/script></div>'})
  if(route==='/cart/settle'||route==='/product/settle')return json(res,{order_id:7})
  if(route==='/product/4/config_option')return json(res,{preview:[{name:'运行环境',value:'自定义应用环境'},{name:'数据备份',value:'每日自动备份'}],price:'120.00',price_total:'120.00',base_price:'120.00',billing_cycle:'一次性'})
  if(route.includes('config_option')||route.includes('configoption'))return json(res,{preview:[],price:'120.00',price_total:'120.00',base_price:'120.00',billing_cycle:'一次性'})
  if(route==='/cart')return json(res,{list:[{position:0,product_id:4,name:product.product_name,qty:1,config_options:{},customfield:{},stock_control:1,stock_qty:20}]})
  return json(res,{list:[],count:0,total:0,host:{},menu:[],status:[],account:{...account,credit:String(balance)}})
 }
 if(p.endsWith('/snapshot.php'))return json(res,{sidebar:[],content:{ticket_assist:{enabled:0},product_list:{}},features:{renew:1,recharge_open:1},heading_icons:{},heading_icon_styles:{}})
 if(p.endsWith('/announcements.php'))return json(res,{items:[]})
 if(p.startsWith('/fixture/')){
  if(p.endsWith('broken-logo.png')){res.writeHead(404);res.end();return}
  if(p.endsWith('sdk.js')){res.setHeader('content-type','text/javascript');res.end('window.__fixtureSdk={start:function(id){document.getElementById(id).textContent="SDK 支付组件已加载";window.__fixtureSdkReady=true}}');return}
  if(p.endsWith('module-api.js')){res.setHeader('content-type','text/javascript');res.end('window.__fixtureModuleOrder=[1]');return}
  if(p.endsWith('qr.svg')){res.setHeader('content-type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="172" height="172"><rect width="172" height="172" fill="white"/><path fill="#30343c" d="M8 8h52v52H8zM112 8h52v52h-52zM8 112h52v52H8zM70 8h12v74H70zM8 70h52v12H8zM92 70h20v20H92zM70 95h12v69H70zM93 112h22v52H93zM128 76h36v12h-36zM128 100h12v38h-12zM150 110h14v54h-14zM124 152h15v12h-15z"/><path fill="white" d="M18 18h32v32H18zM122 18h32v32h-32zM18 122h32v32H18z"/><path fill="#30343c" d="M26 26h16v16H26zM130 26h16v16h-16zM26 130h16v16H26z"/></svg>');return}
  res.end('fixture');return
 }
 if(p.endsWith('.htm')||p==='/'){
  const name=path.basename(p,'.htm');let html
  if(['shoppingCar','settlement','ticket','ticketDetails','addTicket'].includes(name))html=templateHtml(name)
  else {const entry=name==='productdetail'?'productdetail':name==='orderDetail'?'orderDetail':name==='productList'?'productList':name==='recharge'?'recharge':'cashier';html=baseHtml.replace(/assets\/js\/recharge\.js/g,`assets/js/${entry}.js`);if(entry==='cashier')html=html.replace('</head>',`<link rel="stylesheet" href="/clientarea/template/pc/cra1/releases/${release}/assets/css/cashier.css"></head>`)}
  html=replaceAssets(html).replace('<head>','<head>'+bootstrap).replace('window.__CRA1_RUNTIME__ = ', 'window.__CRA1_RUNTIME__ = ')
  html=html.replace(/window\.__CRA1_RUNTIME__\s*=\s*.*?;<\/script>/s,`window.__CRA1_RUNTIME__=${JSON.stringify({page:name,common,features:{ready:true,recharge_open:1,renew:1},links:{ticket:'/plugin/99/ticket.htm'}})};</script>`)
  res.setHeader('content-type','text/html; charset=utf-8');res.end(html);return
 }
 let file=path.join(useBaseline?native:stage,'public',p)
 if(process.env.CRA1_FIRST_WAVE_DEV==='1'){
  const editable=p.match(/^\/clientarea\/template\/pc\/cra1\/releases\/[^/]+\/((?:api|components|js)\/.*)$/)
  if(editable&&fs.existsSync(path.join(root,'public/clientarea/template/pc/cra1',editable[1])))file=path.join(root,'public/clientarea/template/pc/cra1',editable[1])
  if(p.endsWith('/assets/css/cashier.css'))file=path.join(root,'cra1-theme/source/member/src/pages/cashier.css')
  if(p.endsWith('/css/cra1-shell.css'))file=path.join(root,'public/cra1-shared/theme-sources/member/cra1-shell.css')
 }
 if(!fs.existsSync(file)){
  const member=p.match(/^\/clientarea\/template\/pc\/cra1\/releases\/[^/]+\/(.*)$/)
  const cart=p.match(/^\/cart\/template\/pc\/cra1\/releases\/[^/]+\/(.*)$/)
  if(member)file=path.join(root,'public/clientarea/template/pc/cra1',member[1]);
  if(cart)file=path.join(root,'cra1-theme/source/legacy-assets/cart',cart[1]);
 }
 if(!fs.existsSync(file))file=path.join(root,'public',p)
 if(!fs.existsSync(file)&&manifest.references['public'+p])file=path.join(native,manifest.references['public'+p])
 if(!fs.existsSync(file))file=path.join(native,'public',p)
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return}
 res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.setHeader('cache-control','public,max-age=31536000,immutable');let bytes=fs.readFileSync(file);if(/\.(js|css|svg)$/.test(file)){res.setHeader('content-encoding','gzip');bytes=gzipSync(bytes)}res.end(bytes)
 }catch(e){res.writeHead(500);res.end(String(e))}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']})
const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
await ctx.route('**/*',route=>{
 const u=new URL(route.request().url());if(u.origin===origin)return route.continue()
 if(u.hostname==='sdk.fixture.invalid')return moduleFail?route.abort():route.fulfill({body:'window.__fixtureModuleOrder.push(2)',contentType:'text/javascript'})
 return route.abort()
})
const page=await ctx.newPage();page.on('pageerror',e=>errors.push({page:page.url(),message:e.message}));page.on('response',r=>{if(r.status()>=400&&/\.(js|css)$/.test(new URL(r.url()).pathname))assetErrors.push({url:r.url(),status:r.status()})})
async function shot(name,width){await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} no document overflow at ${width}`);await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true})}
try{
 if(process.env.CRA1_FIRST_WAVE_PERF==='1'){
  // Playwright request routing disables the HTTP cache. No routing during timing;
  // DNS is limited to loopback by the browser launch above.
  await ctx.unroute('**/*')
  const cdp=await ctx.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:10*1024*1024/8,uploadThroughput:5*1024*1024/8})
  const count=Number(process.env.CRA1_FIRST_WAVE_PERF_SAMPLES)||5
  const samples=[]
  for(const phase of ['baseline','candidate']){
   useBaseline=phase==='baseline'
   for(const [name,url,selector]of [['tickets','/plugin/99/ticket.htm','.tabledata .el-table__body tr'],['cart','/cart/shoppingCar.htm','.shopping-goods .item-total'],['confirmation','/cart/settlement.htm?cart=1','.shopping-goods'],['products','/productList.htm','text="应用托管服务"']]){
    for(const cache of ['cold','warm']){
     await cdp.send('Network.setCacheDisabled',{cacheDisabled:cache==='cold'})
     for(let i=0;i<count+(cache==='warm'?1:0);i++){
      if(cache==='cold')await cdp.send('Network.clearBrowserCache')
      await page.goto(origin+url);await page.locator(selector).first().waitFor();await page.waitForTimeout(100)
      const measured=await page.evaluate(()=>{const r=performance.getEntriesByType('resource');return {readyMs:performance.now(),fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,requests:r.length,networkRequests:r.filter(e=>e.transferSize>0).length,transferBytes:r.reduce((n,e)=>n+e.transferSize,0),gzipResourceBytes:r.reduce((n,e)=>n+e.encodedBodySize,0),apiRequests:r.filter(e=>/\/console\/v1\/|\/compat\.php/.test(e.name)).length,paymentSdkRequests:r.filter(e=>/\/pay\/|\/payDialog\/|\/api\/finance\.js|\/gateway/.test(e.name)).length,resourcePaths:r.map(e=>new URL(e.name).pathname)}})
      if(cache==='cold'||i>0){samples.push({phase,page:name,cache,...measured});fs.writeFileSync(path.join(out,'performance-partial.json'),JSON.stringify({baseline,release,samples},null,2))}
     }
     console.log(JSON.stringify({performance:phase,page:name,cache,samples:count}))
    }
   }
  }
  const p95=a=>a.sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1],rows=[]
  for(const phase of ['baseline','candidate'])for(const name of ['tickets','cart','confirmation','products'])for(const cache of ['cold','warm']){const set=samples.filter(s=>s.phase===phase&&s.page===name&&s.cache===cache);rows.push({phase,page:name,cache,readyP95:p95(set.map(s=>s.readyMs)),fcpP95:p95(set.map(s=>s.fcp||0)),requests:set[0].requests,apiRequests:set[0].apiRequests,networkRequests:set[0].networkRequests,transferBytes:set[0].transferBytes,gzipResourceBytes:set[0].gzipResourceBytes,paymentSdkRequests:set[0].paymentSdkRequests})}
  check(errors.length===0,'performance run no browser errors');check(assetErrors.length===0,'performance run no resource errors')
  fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify({baseline,release,conditions:{latencyMs:100,bandwidthMbps:10,cpuSlowdown:4,samplesPerCacheAndPage:count,backend:'isolated fixed API fixtures; no production timing claim'},rows,samples,errors,assetErrors},null,2))
 }else{
 if(!process.env.CRA1_FIRST_WAVE_FOCUS){
 await page.goto(origin+'/cashier.htm?id=7');await page.locator('.cra1-cashier-surface .pay-method-item').first().waitFor();await page.waitForFunction(()=>window.__fixtureQr)
 check(await page.locator('.cra1-cashier-amount strong').innerText()==='¥80.00','partial balance amount')
 for(const width of [1920,1440,768,390,320]){await shot('cashier',width);if(width<769)check(!await page.locator('details').getAttribute('open'),'mobile details collapsed')}
 await page.setViewportSize({width:390,height:1000});check(await page.locator('.pay-method-item:visible').count()===2,'mobile shows first two gateways');await page.getByRole('button',{name:'更多支付方式'}).click();await page.getByRole('button',{name:'SDK 支付',exact:true}).click();await page.waitForFunction(()=>window.__fixtureSdkReady);check(true,'gateway external SDK and inline scripts execute')
 await page.getByRole('button',{name:'银行卡 · 跳转支付',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__fixtureFormReady);check(await page.locator('#fixture-payment-form').count()===1,'gateway form preserved with keyboard selection');check(await page.locator('.pay-method-fallback').count()>0,'failed gateway logo falls back')
 await page.getByRole('button',{name:'线下转账',exact:true}).click();await page.getByText('测试银行 · 演示账户').waitFor();await shot('cashier-offline',1440)
 await page.getByRole('button',{name:'提交转账凭证',exact:true}).click();await page.getByText('等待上传凭证',{exact:true}).waitFor();check(state==='WaitUpload','offline starts application once')
 await page.locator('input[type=file]').setInputFiles({name:'测试凭证.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.0 fixture')});await page.waitForTimeout(100);await page.locator('.submit-btn').click();await page.getByText('凭证正在审核',{exact:true}).waitFor();check(state==='WaitReview','proof uses native voucher submission and pending state')
 state='ReviewFail';await page.reload();await page.getByText('凭证未通过审核',{exact:true}).waitFor();await shot('cashier-review-failed',390)
 for(const value of ['Paid','Cancelled','Refunded']){state=value;await page.reload();await page.locator('.cra1-cashier-state').waitFor();check(await page.locator('.pay-method-item:visible').count()===0,'terminal state cannot pay '+value);await shot('cashier-'+value.toLowerCase(),390)}
 state='Unpaid';balance=200;credit=0;await page.reload();await page.locator('.pay-method-item').first().waitFor();await page.getByRole('button',{name:/确认支付/}).click();await page.getByText('付款已完成',{exact:true}).waitFor();check(state==='Paid','full balance verifies paid state')
 state='Unpaid';balance=0;credit=0;await page.goto(origin+'/cashier.htm?id=7');await page.locator('.pay-method-item').first().waitFor();statusDelay=900;await page.waitForTimeout(2200);await page.getByRole('button',{name:'我已付款，查询结果'}).click();await page.waitForTimeout(1100);check(maxStatusInflight<=1,'status queries never overlap');statusDelay=0
 failedGateway=true;await page.reload();await page.getByRole('alert').first().waitFor();check(!await page.getByText('付款已完成',{exact:true}).isVisible(),'gateway failure never paid');failedGateway=false
 await page.goto(origin+'/orderDetail.htm?id=7');await page.getByText('商品明细',{exact:true}).waitFor();for(const width of [1440,390,320])await shot('order-detail',width)
 await page.getByRole('button',{name:'前往收银台',exact:true}).focus();await page.evaluate(()=>{window.__legacyPaid=0;window.__legacyCancelled=0;window.CRA1Shared.Payments.open({orderId:7,onPaid:()=>window.__legacyPaid++,onCancel:()=>window.__legacyCancelled++})});await page.locator('.new-pay-dialog .pay-method-item').first().waitFor();check(!page.url().includes('cashier.htm'),'legacy call keeps modal and origin');await page.locator('.new-pay-dialog .close-btn').click();check(await page.evaluate(()=>window.__legacyCancelled===1&&window.__legacyPaid===0),'legacy cancel callback fires once');check(await page.getByRole('button',{name:'前往收银台',exact:true}).evaluate(el=>el===document.activeElement),'legacy modal restores the original keyboard focus')
 }
 await page.setViewportSize({width:1440,height:1000})
 if(process.env.CRA1_FIRST_WAVE_FOCUS!=='module'){
 for(const name of ['ticket','ticketDetails','addTicket']){await page.goto(origin+'/plugin/99/'+name+'.htm?id=7');await page.waitForTimeout(900);for(const width of [1920,1440,768,390,320])await shot(name,width);if(name==='ticket'){check(await page.locator('.cra1-ticket-mobile-card').count()===5,'mobile cards use all native ticket rows');await page.getByRole('button',{name:'查看完整表格'}).click();check(await page.locator('.tabledata>.el-table').isVisible(),'native table and plugin controls remain accessible');await page.evaluate(()=>{const th=document.createElement('th');th.textContent='插件新增操作';document.querySelector('.tabledata .el-table__header-wrapper tr').append(th)});await page.waitForFunction(()=>!document.querySelector('.cra1-ticket-mobile-enabled'));check(await page.locator('.tabledata>.el-table').isVisible()&&await page.locator('.cra1-ticket-mobile').count()===0,'late plugin columns restore full native table')}}
 await page.goto(origin+'/cart/shoppingCar.htm');await page.waitForTimeout(900);check(await page.locator('.shopping-goods').count()>0,'cart products rendered');for(const width of [1920,1440,768,390,320])await shot('cart',width)
 await page.goto(origin+'/cart/settlement.htm?cart=1');await page.waitForTimeout(900);check(await page.locator('.shopping-goods').count()>0,'confirmation real quote rendered');for(const width of [1920,1440,768,390,320])await shot('confirmation',width)
 }
 await page.goto(origin+'/productList.htm');await page.locator('.cra1-product-card').waitFor();for(const width of [1920,1440,768,390,320])await shot('products',width)
 if(process.env.CRA1_FIRST_WAVE_NATIVE_MODULE==='west_domain'){
 await page.goto(origin+'/productdetail.htm?id=31');await page.waitForFunction(()=>document.querySelector('.domain_details')?.__vue__?.initLoading===false);check(await page.locator('.domain_details').isVisible(),'installed WestDomain template mounts without modifying its original scripts');for(const width of [1920,1440,768,390,320])await shot('native-domain',width)
 }else if(process.env.CRA1_FIRST_WAVE_NATIVE_MODULE==='1'){
 await page.goto(origin+'/productdetail.htm?id=31');await page.waitForFunction(()=>window.clientOperateVue?.initLoading===false);check(await page.locator('.common_product_detail').isVisible(),'installed common module mounts through its original template');for(const width of [1920,1440,768,390,320])await shot('native-common',width)
 }else{
 await page.goto(origin+'/productdetail.htm?id=31');await page.getByRole('button',{name:'模块自定义操作'}).waitFor();await page.waitForFunction(()=>window.__fixtureModuleOrder?.length>=3);check(await page.evaluate(()=>JSON.stringify(window.__fixtureModuleOrder))==='[1,2,3]','module scripts preserve dependency and external SDK order');await page.getByRole('button',{name:'模块自定义操作'}).click();await page.getByText('操作已触发',{exact:true}).waitFor();for(const width of [1920,1440,768,390,320])await shot('product',width)
 moduleFail=true;await page.reload();await page.getByText('此页面暂时无法加载',{exact:true}).waitFor();check(!await page.getByText('暂无可显示的内容。',{exact:true}).isVisible(),'module failure has retry, not false empty');moduleFail=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.getByRole('button',{name:'模块自定义操作'}).waitFor()
 }
 check(errors.length===0,'no browser runtime errors');check(assetErrors.length===0,'no missing scripts or styles')
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'passed',checks,errors,assetErrors,requests,maxStatusInflight,productionWrites:0,fixture:'real templates and native cashier; isolated mocked business and gateways'},null,2))
 console.log(JSON.stringify({status:'passed',checks:checks.length,errors:errors.length,assetErrors:assetErrors.length,screenshots:fs.readdirSync(out).filter(n=>n.endsWith('.png')).length}))
 }
}catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack,checks,errors,assetErrors,requests:requests.slice(-30),staticRequests:staticRequests.slice(-45)},null,2));await page.screenshot({path:path.join(out,'failure.png'),fullPage:true,timeout:5000}).catch(()=>{});throw e}
finally{await ctx.close();await browser.close();await new Promise(r=>server.close(r))}
