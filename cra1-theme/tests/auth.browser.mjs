// All requests are intercepted; no registrations, OTPs or external authorizations.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.CRA1_PLAYWRIGHT || 'playwright')
const stage=process.env.CRA1_AUTH_STAGE, input=process.env.CRA1_AUTH_INPUT, native=process.env.CRA1_AUTH_NATIVE, out=process.env.CRA1_AUTH_OUT
if(!stage||!input||!native||!out)throw new Error('Explicit isolated stage, source, native fixtures and output required')
fs.mkdirSync(out,{recursive:true})
const release=JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release
const base=`/clientarea/template/pc/cra1/releases/${release}`, shared=`/cra1-shared/releases/${release}`
const origin='https://example.com', results=[]
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const defaults={projection_version:2,page:'login',common:{website_name:'示例站点',terms_service_url:'/terms.htm',terms_privacy_url:'/privacy.htm',lang_home:'zh-cn'},locale:{current:'zh-cn'},links:{},features:{},auth:{login:['email-password','phone-password','phone-code'],register:[{type:'email',code:true},{type:'phone',code:true}],reset:['email','phone'],associate:['email','phone'],preferred:'email-password',captcha:{}}}
const provider={name:'FutureSocial',title:'新增社交平台',img:'/mock-social.svg'}
const notice={id:'fixture-notice',revision:'1',title:'服务通知',summary:'账户页面通知放在品牌导航下方。',detail:'<p>隔离环境示例内容。</p>',label:'通知',icon_html:'',action:'detail',action_label:'查看详情',dismissible:true,dismiss_for:'visit'}
const image='<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="16" fill="#35383c"/><path d="M20 40h40M40 20v40" stroke="#e6c994" stroke-width="8"/></svg>'
const captchaHtml='<div id="mock-captcha"><button type="button" onclick="window.captchaCheckSuccsss(true,\'example-proof\',\'example-captcha\')">通过图形验证</button><button type="button" onclick="window.captchaCheckCancel()">取消图形验证</button></div>'
const ok=data=>({status:200,data}), reject={status:400,msg:'示例请求未提交，请重试',data:{}}
function fixture(overrides={}){return {...structuredClone(defaults),...overrides,auth:{...structuredClone(defaults.auth),...overrides.auth}}}
async function run(name,runtime,exercise,{width=1440,api,setup,search='',notices=[]}={}){
 if(process.env.CRA1_AUTH_CASE && process.env.CRA1_AUTH_CASE!==name)return
 const ctx=await browser.newContext({viewport:{width,height:960},locale:'zh-CN',reducedMotion:'reduce'}), calls=[], errors=[], unexpected=[]
 ctx.setDefaultTimeout(7000)
 await setup?.(ctx)
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),p=u.pathname
  if(u.origin!==origin){unexpected.push(u.origin);return route.abort()}
  if(p.endsWith('.htm')){
   const entry=p.slice(1,-4)
   if(!['login','regist','oauth','forget'].includes(entry))return route.fulfill({contentType:'text/html',body:'<!doctype html><title>示例跳转</title>示例跳转目标'})
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-cn" data-cra1-theme="member"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录注册示例</title><script>window.__CRA1_RUNTIME__=${JSON.stringify(runtime)};window.__CRA1_PAGE__={website_name:'示例站点'}</script><link rel="stylesheet" href="/clientarea/template/pc/default/css/common/reset.css"><link rel="stylesheet" href="/clientarea/template/pc/default/css/common/common.css"><link rel="stylesheet" href="${shared}/cra1-shared.css"><link rel="stylesheet" href="${base}/assets/css/app.css"><script src="${shared}/cra1-shared.js"></script></head><body><div id="root"></div><script type="module" src="${base}/assets/js/${entry}.js"></script></body></html>`})
  }
  if(p==='/mock-social.svg'||p==='/mock-qr.svg')return route.fulfill({contentType:'image/svg+xml',body:image})
  if(p==='/mock-light-logo.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="36"><path fill="white" d="M2 2h32v32H2zM48 10h120v16H48z"/></svg>'})
  if(p==='/mock-authorize')return route.fulfill({contentType:'text/html',body:'<!doctype html><p>第三方授权示例，尚未完成授权。</p>'})
  if(p.startsWith('/console/')||p.startsWith('/cra1-shared/')&&p.endsWith('.php')){
   let body;try{body=req.postDataJSON()}catch{}
   calls.push({path:p,method:req.method(),body})
   const custom=await api?.({p,req,body,calls});if(custom)return route.fulfill({json:custom})
   if(p==='/console/v1/country')return route.fulfill({json:ok({list:[{phone_code:'86',name:'中国'},{phone_code:'1',name:'美国'}]})})
   if(p==='/console/v1/register/custom_field')return route.fulfill({json:ok({list:[]})})
   if(p==='/console/v1/menu')return route.fulfill({json:ok({menu:[]})})
   if(p==='/console/v1/mp_weixin_notice/qrcode')return route.fulfill({json:ok({ticket:'example-ticket',token:'example-qr-token',img_url:'/mock-qr.svg'})})
   if(p==='/console/v1/mp_weixin_notice/qrcode/status')return route.fulfill({json:ok({status:'Wait'})})
   if(/^\/console\/v1\/oauth\/(FutureSocial|SecondSocial)$/.test(p))return route.fulfill({json:ok({url:origin+'/mock-authorize'})})
   if(p==='/console/v1/oauth/token')return route.fulfill({json:ok({})})
   if(p==='/console/v1/captcha')return route.fulfill({json:ok({html:captchaHtml})})
   if(['/console/v1/login','/console/v1/register','/console/v1/account/password_reset','/console/v1/language','/console/v1/oauth/client/bind'].includes(p))return route.fulfill({json:reject})
   if(['/console/v1/phone/code','/console/v1/email/code'].includes(p))return route.fulfill({json:ok({})})
   if(p==='/cra1-shared/announcements.php')return route.fulfill({json:ok({items:notices,interval:6,refresh_after:30,day:'2026-10-26'})})
   if(p==='/cra1-shared/snapshot.php')return route.fulfill({json:ok({appearance:{},content:{}})})
   unexpected.push(p);return route.fulfill({json:reject})
  }
  const file=[stage,input,...(p.startsWith('/clientarea/template/pc/default/')?[native]:[])].map(root=>path.join(root,'public',p)).find(file=>fs.existsSync(file)&&fs.statSync(file).isFile())
  if(!file){unexpected.push(p);return route.fulfill({status:404,body:''})}
  return route.fulfill({contentType:({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)})
 })
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message))
 try{
  await page.goto(origin+`/${runtime.page}.htm`+search,{waitUntil:'networkidle'})
  await page.waitForFunction(()=>document.querySelector('#root')?.innerText.length>0)
  await exercise({page,ctx,calls})
  assert.deepEqual(errors,[],'no browser exceptions');assert.deepEqual(unexpected,[],'no unregistered network activity')
  results.push({name,status:'passed',requests:calls.map(r=>({path:r.path,method:r.method}))})
 }catch(e){results.push({name,status:'failed',error:e.message,errors,unexpected})}
 finally{await ctx.close();fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:results.every(r=>r.status==='passed')?'passed':'failed',scenarios:results},null,2))}
}
const choose=async(page,trigger,name)=>{await trigger.click();await page.getByRole('option',{name,exact:true}).click()}
const agree=async page=>page.locator('#auth-agreement').check()
const fillLogin=async(page,{agreement=true,password='Az!7mx2Q'}={})=>{await page.locator('#auth-account').fill('member@example.com');await page.locator('#auth-password').fill(password);if(agreement)await agree(page);await page.getByRole('button',{name:'登录',exact:true}).click()}
const sent=(calls,path)=>calls.filter(c=>c.path==='/console/v1'+path)
const waitCall=async(page,pathname,action)=>{const wait=page.waitForResponse(r=>new URL(r.url()).pathname==='/console/v1'+pathname);await action();await wait}
const fillNew=async(page,password='Az!7mx2Q')=>{await page.locator('#auth-account').fill('member@example.com');await page.locator('#auth-password').fill(password);await page.locator('#auth-confirm').fill(password)}
try{
 for(let mask=1;mask<8;mask++)await run('native-login-channel-combination-'+mask,fixture({auth:{login:['email-password','phone-password','phone-code'].filter((_,i)=>mask&(1<<i))}}),async({page,calls})=>{
  assert.equal(await page.locator('.auth-methods button').count(),(mask&3)&&(mask&4)?2:0)
  if(mask&3) {
   assert.equal(await page.locator('#auth-account').getAttribute('placeholder'),'请输入手机号或邮箱')
   await page.locator('#auth-password').fill('Az!7mx2Q');await agree(page)
   for(const [value,enabled] of [['member@example.com',mask&1],['13812345678',mask&2]]) {
    const before=sent(calls,'/login').length;await page.locator('#auth-account').fill(value)
    if(enabled){await waitCall(page,'/login',()=>page.getByRole('button',{name:'登录',exact:true}).click());assert.equal(sent(calls,'/login').at(-1).body.account,value)}
    else {await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(sent(calls,'/login').length,before)}
   }
  }
 })
 await run('unified-account-format-and-mode-switch',fixture(),async({page,calls})=>{
  await page.locator('#auth-password').fill('Az!7mx2Q');await agree(page)
  for(const value of ['12345','138123456782','bad@address','name@@example.com','name@example..com']) {
   await page.locator('#auth-account').fill(value);await page.getByRole('button',{name:'登录',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(sent(calls,'/login').length,0)
  }
  await page.locator('#auth-account').fill('123456789012345@example.com');await waitCall(page,'/login',()=>page.getByRole('button',{name:'登录',exact:true}).click());assert.equal(sent(calls,'/login').at(-1).body.account,'123456789012345@example.com')
  await page.locator('#auth-account').fill('13812345678');await page.getByRole('button',{name:'验证码登录',exact:true}).click();assert.equal(await page.locator('#auth-account').inputValue(),'13812345678');assert.equal(await page.locator('#auth-password').count(),0)
  await page.locator('#auth-code').fill('654321');await waitCall(page,'/login',()=>page.getByRole('button',{name:'登录',exact:true}).click());assert.equal(sent(calls,'/login').at(-1).body.type,'code');assert.equal(sent(calls,'/login').at(-1).body.password,undefined)
  await page.getByRole('button',{name:'账密登录',exact:true}).click();assert.equal(await page.locator('#auth-account').inputValue(),'13812345678');assert.equal(await page.locator('#auth-code').count(),0)
  await waitCall(page,'/login',()=>page.getByRole('button',{name:'登录',exact:true}).click());const last=sent(calls,'/login').at(-1).body;assert.equal(last.type,'password');assert.equal(last.code,undefined)
 })
 await run('invalid-phone-cannot-send-code',fixture({auth:{preferred:'phone-code'}}),async({page,calls})=>{
  await page.locator('#auth-account').fill('1390000');await page.getByRole('button',{name:'获取验证码',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(sent(calls,'/phone/code').length,0)
 })
 await run('shared-country-dropdown-keyboard-and-cancel',fixture({auth:{preferred:'phone-code'}}),async({page})=>{
  const trigger=page.getByRole('combobox',{name:'国际区号'});await trigger.focus();await page.keyboard.press('ArrowDown');await page.getByRole('option',{name:'+86',exact:true}).press('End');await page.waitForFunction(()=>document.activeElement?.textContent==='美国 +1');await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.auth-country').textContent.trim()==='+1')
  await trigger.click();await page.screenshot({path:path.join(out,'country-dropdown-1440.png'),fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.getByRole('listbox').count(),0);assert.equal(await trigger.evaluate(el=>el===document.activeElement),true)
 })
 await run('calling-codes-are-unique-and-readable',fixture({auth:{preferred:'phone-code'}}),async({page})=>{
  await page.locator('.auth-country').click();assert.equal(await page.getByRole('option',{name:/ \+1$/}).count(),2);await page.getByRole('option',{name:'美国 +1',exact:true}).click();assert.equal(await page.locator('.auth-country').innerText(),'+1')
 },{api:({p})=>p==='/console/v1/country'?ok({list:[{phone_code:'86',name:'中国'},{phone_code:'1',name:'加拿大'},{phone_code:'1',name:'美国'}]}):null})
 await run('registration-custom-select-fields',fixture({page:'regist',client_custom_fields:true,auth:{register:[{type:'email',code:false}]}}),async({page,calls})=>{
  await fillNew(page);await agree(page);await choose(page,page.locator('#custom-1'),'个人使用');await page.locator('#custom-2').click();await page.screenshot({path:path.join(out,'registration-dropdown-390.png'),fullPage:false});await page.getByRole('option',{name:'其他',exact:true}).click();await page.getByRole('textbox',{name:'使用地区内容'}).fill('示例地区')
  await waitCall(page,'/register',()=>page.getByRole('button',{name:'注册',exact:true}).click());assert.deepEqual(sent(calls,'/register').at(-1).body.customfield.addon_client_custom_field,{1:'个人使用',2:'其他|示例地区'})
 },{width:390,api:({p})=>p.endsWith('/register/custom_field')?ok({list:[{id:1,name:'用途',type:'dropdown',options:['个人使用','企业使用'],required:1},{id:2,name:'使用地区',type:'dropdown_text',options:['国内','其他']}]}):null})
 await run('login-agreement-and-native-password-contract',fixture(),async({page,calls})=>{
  await fillLogin(page,{agreement:false,password:'old'});await page.getByRole('alert').waitFor();assert.equal(sent(calls,'/login').length,0)
  await agree(page);await waitCall(page,'/login',()=>page.getByRole('button',{name:'登录',exact:true}).click())
  const body=sent(calls,'/login')[0].body;assert.equal(body.remember_password,'0');assert.notEqual(body.password,'old');assert.ok(body.password)
 })
 await run('remember-login-without-persisting-password',fixture(),async({page,calls})=>{
  await page.getByRole('checkbox',{name:'保持登录',exact:true}).check();await waitCall(page,'/login',()=>fillLogin(page))
  assert.equal(sent(calls,'/login')[0].body.remember_password,'1')
  assert.equal(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage})+document.cookie).then(s=>s.includes('Az!7mx2Q')),false)
 })
 await run('password-visibility-and-keyboard',fixture(),async({page})=>{
  await page.locator('#auth-password').fill('example-only');await page.getByRole('button',{name:'显示密码',exact:true}).press('Enter');assert.equal(await page.locator('#auth-password').getAttribute('type'),'text')
  await page.getByRole('button',{name:'隐藏密码',exact:true}).press('Space');assert.equal(await page.locator('#auth-password').getAttribute('type'),'password')
 })
 await run('appearance-copy-logo-links-and-independent-page',fixture({auth_appearance:{title:'自定义登录标题',description:'自定义表单说明',logo:'/mock-social.svg',brand:{enabled:1,label:'品牌眉题',title:'左侧介绍标题',description:'品牌说明',items:[{id:'visible-example',enabled:1,title:'自定义亮点',description:'亮点说明'}]},support:{enabled:1,label:'联系支持',url:'mailto:help@example.com'},footer:'示例版权文字'}}),async({page})=>{
  assert.equal(await page.getByRole('heading',{level:1}).innerText(),'自定义登录标题');assert.equal(await page.getByRole('heading',{level:2}).innerText(),'左侧介绍标题')
  assert.equal(await page.locator('.cra1-auth-logo img').getAttribute('src'),'/mock-social.svg');assert.equal(await page.getByRole('link',{name:'联系支持'}).getAttribute('href'),'mailto:help@example.com')
  assert.equal(await page.getByText('自定义亮点',{exact:true}).isVisible(),true);assert.equal(await page.locator('.cra1-auth-footer').innerText(),'示例版权文字')
 })
 await run('appearance-hidden-brand-centers-form',fixture({auth_appearance:{title:'仅显示表单',description:'',brand:{enabled:0},support:{enabled:0}}}),async({page})=>{
  assert.equal(await page.locator('.cra1-auth-brand').count(),0);assert.equal(await page.getByRole('link',{name:'联系支持'}).count(),0)
  const b=await page.locator('.cra1-auth-panel').boundingBox();assert.ok(Math.abs(b.x+b.width/2-1440/2)<2);assert.ok(b.width<=500)
  await page.screenshot({path:path.join(out,'centered-login-1440.png'),fullPage:true})
 })
 await run('white-logo-remains-readable-on-light-page',fixture({auth_appearance:{logo:'/mock-light-logo.svg'}}),async({page})=>{
  await page.locator('.cra1-auth-logo-image--light').waitFor();await page.screenshot({path:path.join(out,'white-logo-1440.png'),fullPage:true})
 })
 await run('mobile-long-copy-and-many-providers',fixture({auth_appearance:{title:'用于检查长标题换行的自定义账户登录页面',description:'帮助用户在不同尺寸设备上访问云产品与账户管理。'.repeat(3),brand:{enabled:1},support:{enabled:1,label:'客户服务与帮助',url:'/help.htm'}},auth:{providers:Array.from({length:7},(_,i)=>({...provider,name:i===0?provider.name:'Provider'+i,title:'第三方社交登录平台 '+(i+1)}))}}),async({page})=>{
  assert.equal(await page.locator('.auth-provider-grid button').count(),7);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  assert.equal(await page.locator('.cra1-auth-brand').isVisible(),false);await page.screenshot({path:path.join(out,'long-login-390.png'),fullPage:true})
 },{width:390})
 await run('international-phone-password',fixture({auth:{preferred:'phone-password'}}),async({page,calls})=>{
  await page.locator('#auth-account').fill('2025550100');await choose(page,page.getByRole('combobox',{name:'国际区号',exact:true}),'美国 +1');await page.locator('#auth-password').fill('Az!7mx2Q');await agree(page)
  assert.equal(await page.locator('.auth-country').innerText(),'+1');const country=await page.locator('.auth-country').boundingBox(),account=await page.locator('#auth-account').boundingBox();assert.ok(country.width<=110&&account.width>=180);assert.ok(account.x>=country.x+country.width)
  await waitCall(page,'/login',()=>page.getByRole('button',{name:'登录',exact:true}).click());assert.equal(sent(calls,'/login')[0].body.phone_code,'1')
 })
 await run('phone-code-login',fixture({auth:{preferred:'phone-code'}}),async({page,calls})=>{
  await page.locator('#auth-account').fill('2025550100');await choose(page,page.getByRole('combobox',{name:'国际区号'}),'美国 +1')
  await waitCall(page,'/phone/code',()=>page.getByRole('button',{name:'获取验证码',exact:true}).click());assert.equal(sent(calls,'/phone/code')[0].body.action,'login')
  await page.locator('#auth-code').fill('654321');await agree(page);await waitCall(page,'/login',()=>page.getByRole('button',{name:'登录',exact:true}).click());const body=sent(calls,'/login')[0].body;assert.equal(body.type,'code');assert.equal(body.password,undefined)
 })
 await run('provider-waits-for-callback-and-finishes-login',fixture({auth:{providers:[provider]}}),async({page,ctx,calls})=>{
  assert.equal(await page.locator('img[src="https://example.com/mock-social.svg"]').count(),1)
  const popupWait=page.waitForEvent('popup');await page.getByRole('button',{name:'新增社交平台登录'}).click();const popup=await popupWait;await popup.waitForURL(origin+'/mock-authorize');await page.waitForTimeout(1600)
  assert.equal(sent(calls,'/oauth/token').length,0);await popup.close();await page.waitForURL(origin+'/home.htm');assert.equal(sent(calls,'/oauth/token').length,1)
 },{api:({p})=>p==='/console/v1/oauth/token'?ok({jwt:'example-login-token'}):null})
 await run('provider-cancel-and-retry',fixture({auth:{providers:[provider]}}),async({page,calls})=>{
  const opened=page.waitForEvent('popup');await page.getByRole('button',{name:'新增社交平台登录'}).click();const popup=await opened;await popup.waitForURL(origin+'/mock-authorize');await popup.close();await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'新增社交平台登录'}).isEnabled(),true);assert.equal(sent(calls,'/oauth/token').length,1)
 })
 await run('provider-popup-blocked',fixture({auth:{providers:[provider]}}),async({page,calls})=>{
  await page.getByRole('button',{name:'新增社交平台登录'}).click();await page.getByRole('alert').waitFor();assert.equal(sent(calls,'/oauth/FutureSocial').length,0)
 },{setup:ctx=>ctx.addInitScript(()=>{window.open=()=>null})})
 await run('provider-only-login',fixture({auth:{providers:[provider],login:[],register:[]}}),async({page})=>{
  assert.equal(await page.getByRole('button',{name:'新增社交平台登录'}).isVisible(),true);assert.equal(await page.locator('a[href="/regist.htm"]').count(),0);assert.equal(await page.getByText('当前页面暂不可用',{exact:true}).count(),0)
 })
 await run('preferred-qr-retains-other-entries',fixture({auth:{qr:{preferred:true},providers:[provider],external:{url:'/external.htm',text:'其他入口'}}}),async({page})=>{
  assert.equal(await page.getByAltText('微信登录二维码').isVisible(),true);assert.equal(await page.getByRole('button',{name:'新增社交平台登录'}).isVisible(),true);assert.equal(await page.locator('a[href="/regist.htm"]').isVisible(),true);assert.equal(await page.getByText('其他入口',{exact:true}).isVisible(),true)
  await page.screenshot({path:path.join(out,'qr-with-provider.png'),fullPage:true})
  await page.getByRole('button',{name:'使用账户登录'}).click();assert.equal(await page.locator('#auth-account').isVisible(),true)
 })
 await run('qr-only-login',fixture({auth:{login:[],register:[],qr:{preferred:false}}}),async({page})=>assert.equal(await page.getByAltText('微信登录二维码').isVisible(),true))
 await run('qr-first-association',fixture({auth:{qr:{preferred:true}}}),async({page,calls})=>{
  await page.waitForURL(url=>url.pathname==='/oauth.htm');await page.getByRole('button',{name:'关联账户',exact:true}).waitFor();assert.equal(sent(calls,'/oauth/token').length,0)
  await page.locator('#auth-account').fill('member@example.com');await page.locator('#auth-code').fill('654321');await agree(page)
  await waitCall(page,'/mp_weixin_notice/qrcode/bind_client',()=>page.getByRole('button',{name:'关联账户',exact:true}).click());const body=sent(calls,'/mp_weixin_notice/qrcode/bind_client')[0].body;assert.equal(body.ticket,'example-ticket');assert.equal(body.token,'example-qr-token')
 },{api:({p})=>p.endsWith('/qrcode/status')?ok({status:'WaitBind'}):p.endsWith('/qrcode/bind_client')?reject:null})
 await run('qr-expired-can-retry',fixture({auth:{qr:{preferred:true}}}),async({page,calls})=>{
  await page.getByRole('alert').waitFor();await waitCall(page,'/mp_weixin_notice/qrcode',()=>page.getByRole('button',{name:'重新获取二维码'}).click());assert.equal(sent(calls,'/mp_weixin_notice/qrcode').length,2)
 },{api:({p})=>p.endsWith('/qrcode/status')?ok({status:'Expired'}):null})
 await run('qr-selects-only-active-account',fixture({auth:{qr:{preferred:true}}}),async({page,calls})=>{
  await page.locator('#qr-client').waitFor();assert.equal(await page.locator('#qr-client').innerText(),'示例账户');await page.locator('#qr-client').click();assert.equal(await page.getByRole('option',{name:'已停用账户',exact:true}).isDisabled(),true);await page.screenshot({path:path.join(out,'qr-account-dropdown.png'),fullPage:false});await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'登录账户',exact:true}).click();await page.waitForURL(origin+'/home.htm');assert.equal(sent(calls,'/mp_weixin_notice/qrcode/select_client_login')[0].body.client_id,1)
 },{api:({p})=>p.endsWith('/qrcode/status')?ok({status:'SelectClient',client:[{id:1,status:1,username:'示例账户'},{id:2,status:0,username:'已停用账户'}]}):p.endsWith('/select_client_login')?ok({jwt:'example-qr-login'}):null})
 await run('oauth-association',fixture({page:'oauth'}),async({page,calls})=>{
  await page.screenshot({path:path.join(out,'oauth-association.png'),fullPage:true})
  await page.locator('#auth-account').fill('member@example.com');await waitCall(page,'/email/code',()=>page.getByRole('button',{name:'获取验证码',exact:true}).click());assert.equal(sent(calls,'/email/code')[0].body.action,'oauth')
  await page.locator('#auth-code').fill('654321');await agree(page);await waitCall(page,'/oauth/client/bind',()=>page.getByRole('button',{name:'关联账户',exact:true}).click());assert.equal(sent(calls,'/oauth/client/bind')[0].body.account,'member@example.com')
 },{api:({p})=>p==='/console/v1/oauth/token'?ok({url:origin+'/oauth.htm'}):null})
 await run('expired-oauth-session',fixture({page:'oauth'}),async({page})=>{await page.getByRole('alert').waitFor();assert.equal(await page.locator('#auth-account').count(),0)})
 for(const required of [true,false])await run('native-security-captcha-'+required,fixture({auth:{captcha:{security_verify:required}}}),async({page,calls})=>{
  await fillLogin(page);const dialog=page.locator('.cra1-security-dialog[open]');await dialog.waitFor();await dialog.getByRole('button',{name:'发送验证码',exact:true}).click()
  if(required){await page.getByRole('button',{name:'通过图形验证',exact:true}).click()}
  await page.waitForFunction(()=>document.querySelector('.cra1-security-code button')?.textContent.includes('秒'))
  const body=sent(calls,'/email/code')[0].body;assert.equal(body.action,'exception_login');assert.equal(!!body.captcha,required);assert.equal(body.security_verify_token,'example-security-token')
  await dialog.locator('input').fill('654321');await dialog.getByRole('button',{name:'验证并继续',exact:true}).click();await page.waitForURL(origin+'/home.htm');assert.equal(sent(calls,'/login').length,2)
 },{api:({p,body})=>p==='/console/v1/login'?(body.security_verify_value?ok({jwt:'example-verified-login'}):{status:400,msg:'请完成安全验证',data:{need_security_verify:true,available_methods:[{value:'email_code',label:'邮箱验证码',account:'member@example.com',security_verify_token:'example-security-token'}]}}):null})
 await run('native-security-cancel',fixture(),async({page,calls})=>{await fillLogin(page);const dialog=page.locator('.cra1-security-dialog[open]');await dialog.waitFor();await dialog.getByRole('button',{name:'取消',exact:true}).click();assert.equal(sent(calls,'/login').length,1);assert.equal(await dialog.count(),0)}, {api:({p})=>p==='/console/v1/login'?{status:400,data:{need_security_verify:true,available_methods:[{value:'email_code'}]}}:null})
 await run('native-security-mobile-escape',fixture(),async({page,calls})=>{
  await fillLogin(page);await page.locator('.cra1-security-dialog[open]').waitFor();await page.screenshot({path:path.join(out,'security-390.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await page.keyboard.press('Escape');assert.equal(await page.locator('.cra1-security-dialog[open]').count(),0);assert.equal(sent(calls,'/login').length,1)
 },{width:390,api:({p})=>p==='/console/v1/login'?{status:400,data:{need_security_verify:true,available_methods:[{value:'email_code',label:'邮箱验证码',tip:'向绑定邮箱发送验证码',account:'member@example.com'}]}}:null})
 await run('register-captcha-cancel-and-retry',fixture({page:'regist',auth:{captcha:{register:true}}}),async({page,calls})=>{
  await page.locator('#auth-account').fill('member@example.com');await page.getByRole('button',{name:'获取验证码',exact:true}).click();await page.getByRole('button',{name:'取消图形验证'}).click();assert.equal(sent(calls,'/email/code').length,0)
  await page.getByRole('button',{name:'获取验证码',exact:true}).click();await waitCall(page,'/email/code',()=>page.getByRole('button',{name:'通过图形验证'}).click());const body=sent(calls,'/email/code')[0].body;assert.equal(body.action,'register');assert.equal(body.captcha,'example-proof')
 })
 await run('login-captcha-on-failure',fixture({auth:{captcha:{login:true},captcha_on_failure:true}}),async({page,calls})=>{
  await fillLogin(page);await page.getByRole('button',{name:'通过图形验证'}).click();await page.getByRole('alert').filter({hasText:'验证完成'}).waitFor();await waitCall(page,'/login',()=>page.getByRole('button',{name:'登录',exact:true}).click());assert.equal(sent(calls,'/login').length,2);assert.equal(sent(calls,'/login')[1].body.captcha,'example-proof')
 },{api:({p,body})=>p==='/console/v1/login'&&!body.captcha?{status:400,msg:'请先完成图形验证',data:{captcha:1}}:null})
 for(const kind of ['regist','forget'])await run('strong-password-'+kind,fixture({page:kind,auth:{register:[{type:'email',code:false}],password_rule:'strong'}}),async({page,calls})=>{
  await fillNew(page,'abcdef');if(kind==='regist')await agree(page);else await page.locator('#auth-code').fill('654321')
  await page.getByRole('button',{name:kind==='regist'?'注册':'重置密码',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(sent(calls,kind==='regist'?'/register':'/account/password_reset').length,0)
  await page.locator('#auth-password').fill('Az!7mx2Q');await page.locator('#auth-confirm').fill('Az!7mx2Q');await waitCall(page,kind==='regist'?'/register':'/account/password_reset',()=>page.getByRole('button',{name:kind==='regist'?'注册':'重置密码',exact:true}).click());assert.equal(sent(calls,kind==='regist'?'/register':'/account/password_reset')[0].body.password,'Az!7mx2Q')
 })
 await run('closed-registration-still-allows-phone-recovery',fixture({page:'forget',auth:{register:[]}}),async({page,calls})=>{
  await page.getByRole('button',{name:'手机号',exact:true}).click();await page.locator('#auth-account').fill('2025550100');await page.locator('#auth-password').fill('Az!7mx2Q');await page.locator('#auth-confirm').fill('Az!7mx2Q');await page.locator('#auth-code').fill('654321')
  await waitCall(page,'/account/password_reset',()=>page.getByRole('button',{name:'重置密码',exact:true}).click());assert.equal(sent(calls,'/account/password_reset')[0].body.type,'phone')
 })
 await run('registration-custom-fields-and-sales',fixture({page:'regist',client_custom_fields:true,auth:{register:[{type:'email',code:false}],sales:{select:true,required:true,list:[{sale_number:'sale-demo',name:'示例顾问'}]}}}),async({page,calls})=>{
  await fillNew(page);await agree(page);await choose(page,page.locator('#register-sale'),'示例顾问');await page.getByRole('button',{name:'注册',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(sent(calls,'/register').length,0)
  await page.locator('#custom-1').fill('示例用途');await waitCall(page,'/register',()=>page.getByRole('button',{name:'注册',exact:true}).click());assert.deepEqual(sent(calls,'/register')[0].body.customfield,{addon_client_custom_field:{1:'示例用途'},sale_number:'sale-demo'})
 },{api:({p})=>p.endsWith('/register/custom_field')?ok({list:[{id:1,name:'使用用途',type:'text',required:1}]}):null})
 await run('register-sales-referral-and-username',fixture({page:'regist',auth:{register:[{type:'email',code:false}],sales:{select:true,list:[{sale_number:'sale-demo',name:'示例顾问'}]}}}),async({page,calls})=>{
  assert.equal(await page.locator('#register-sale').innerText(),'示例顾问');await page.locator('#auth-username').fill('示例用户');await fillNew(page);await agree(page)
  await waitCall(page,'/register',()=>page.getByRole('button',{name:'注册',exact:true}).click());const body=sent(calls,'/register')[0].body;assert.equal(body.username,'示例用户');assert.equal(body.customfield.sale_number,'sale-demo')
 },{search:'?sale_number=sale-demo'})
 for(const code of [true,false])await run('international-phone-register-'+code,fixture({page:'regist',auth:{register:[{type:'phone',code}]}}),async({page,calls})=>{
  await page.locator('#auth-account').fill('2025550100');await choose(page,page.getByRole('combobox',{name:'国际区号',exact:true}),'美国 +1');await page.locator('#auth-password').fill('Az!7mx2Q');await page.locator('#auth-confirm').fill('Az!7mx2Q');await agree(page)
  if(code){await waitCall(page,'/phone/code',()=>page.getByRole('button',{name:'获取验证码',exact:true}).click());assert.equal(sent(calls,'/phone/code')[0].body.action,'register');await page.locator('#auth-code').fill('654321')}
  else assert.equal(await page.locator('#auth-code').count(),0)
  await waitCall(page,'/register',()=>page.getByRole('button',{name:'注册',exact:true}).click());const body=sent(calls,'/register')[0].body;assert.equal(body.type,'phone');assert.equal(body.account,'2025550100');assert.equal(body.phone_code,'1');assert.equal(body.password,'Az!7mx2Q')
 })
 for(const success of [true,false])await run('language-change-'+success,fixture({locale:{current:'zh-cn',choices:[{display_lang:'zh-cn',display_name:'简体中文'},{display_lang:'en-us',display_name:'English'}]}}),async({page,calls})=>{
  const navigation=success?page.waitForEvent('load'):null;await waitCall(page,'/language',()=>choose(page,page.locator('#auth-language'),'English'));assert.deepEqual(sent(calls,'/language')[0].body,{language:'en-us'})
  if(navigation)await navigation;else await page.getByRole('alert').waitFor()
  assert.equal(await page.evaluate(()=>localStorage.getItem('lang')),success?'en-us':null)
 },{api:({p})=>p==='/console/v1/language'?(success?ok({}):reject):null})
 for(const width of [1920,1440,768,390])for(const kind of ['login','regist','forget'])await run(`visual-${kind}-${width}`,fixture({page:kind,auth:{providers:[provider,{...provider,name:'SecondSocial',title:'其他社交平台'}]}}),async({page})=>{
  await page.locator('.cra1-notices__title').waitFor();assert.equal(await page.locator('.cra1-notices-host').count(),1)
  const header=await page.locator('.cra1-auth-header').boundingBox(),notices=await page.locator('.cra1-auth-notices').boundingBox(),main=await page.locator('.cra1-auth-main').boundingBox();assert.equal(header.y,0);assert.ok(notices.y>=header.y+header.height-1);assert.ok(main.y>=notices.y+notices.height-1)
  assert.equal(await page.locator('.cra1-auth-page-label').innerText(),{login:'登录',regist:'注册',forget:'找回密码'}[kind])
  await page.screenshot({path:path.join(out,`${kind}-${width}.png`),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 },{width,notices:[notice]})
 for(const width of [1440,390])await run(`visual-phone-code-${width}`,fixture({auth:{preferred:'phone-code'}}),async({page})=>{
  const country=await page.locator('.auth-country').boundingBox(),account=await page.locator('#auth-account').boundingBox(),panel=await page.locator('.cra1-auth-panel').boundingBox()
  assert.ok(country.width<=110&&account.width>=180);assert.ok(account.x+account.width<=panel.x+panel.width);await page.screenshot({path:path.join(out,`phone-code-${width}.png`),fullPage:true})
 },{width})
}finally{await browser.close()}
const failed=results.filter(r=>r.status!=='passed')
console.log(JSON.stringify({scenarios:results.length,passed:results.length-failed.length,failed},null,2))
if(failed.length)process.exitCode=1
