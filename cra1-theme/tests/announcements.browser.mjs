/** Actual built shared/admin components with isolated PHP storage. No V10 business writes. */
import fs from 'node:fs'
import { reviewAnnouncementUI } from './announcements-ui.mjs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..')
const req=createRequire(path.join(root,'cra1-theme/source/admin/package.json'))
const {chromium}=process.env.CRA1_PLAYWRIGHT_MODULE?await import(process.env.CRA1_PLAYWRIGHT_MODULE):req('playwright')
const stage=process.env.CRA1_ANNOUNCEMENT_STAGE,out=process.env.CRA1_BROWSER_OUT
if(!stage||!out)throw new Error('Set CRA1_ANNOUNCEMENT_STAGE and CRA1_BROWSER_OUT outside the repository')
fs.mkdirSync(out,{recursive:true})
const release=JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release
const shared=path.join(stage,'public/cra1-shared/releases',release),admin=path.join(stage,'public/cra1admin/assets/releases',release)
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cra1-notices-browser-')),checks=[],errors=[],cspViolations=[]
const php=process.env.CRA1_PHP||'/www/server/php/74/bin/php'
function backend(action,body={}){return JSON.parse(execFileSync(php,[path.join(root,'cra1-theme/tests/announcements-fixture.php'),temp],{input:JSON.stringify({action,body}),encoding:'utf8'}))}
const targets={website:{all:true,pages:[]},member:{all:true,pages:[]},cart:{all:true,pages:[]}}
function item(id,title,extra={}){return {id,title,label:'服务通知',icon:'megaphone',summary:'这是用于验证展示与交互的示例内容。',detail:'<p>通知详情示例，支持<strong>富文本</strong>和安全链接。</p>',action:'detail',action_label:'阅读简报',enabled:true,targets,dismissible:true,dismiss_for:'revision',...extra}}
const initial={enabled:true,interval:3,hide_single_arrows:true,items:[item('fixture-one','服务运行与日常维护通知'),item('fixture-two','云产品功能更新说明',{summary:'',priority:1}),item('fixture-hidden','HIDDEN_CONFIGURATION',{enabled:false})]}
assert.equal(backend('seed',initial).status,200)
let failing=false,delayed=false,publicCalls=0
const server=http.createServer(async(request,response)=>{
 const url=new URL(request.url,'http://fixture.invalid')
 if(request.method==='POST'){
  let bytes='';for await(const data of request)bytes+=data
  const body=JSON.parse(bytes||'{}');response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store')
  if(url.pathname==='/cra1-shared/notifications.php'){response.end(JSON.stringify(failing?{status:503,msg:'private internal details',data:{items:[]}}:backend('all-public')));return}
  if(url.pathname==='/cra1-shared/announcements.php'){
   publicCalls++;if(delayed){const result=backend('public',body);setTimeout(()=>response.end(JSON.stringify(result)),500);return}
   response.end(JSON.stringify(failing?{status:503,msg:'private internal details',data:{items:[]}}:backend('public',body)));return
  }
  response.end(JSON.stringify(backend(url.searchParams.get('r')||'',body)));return
 }
 let file
 if(url.pathname.startsWith('/shared/'))file=path.join(shared,path.basename(url.pathname))
 else if(url.pathname.startsWith('/admin/'))file=path.join(admin,url.pathname.slice(7))
 else if(url.pathname.startsWith('/cra1-shared/icons/'))file=path.join(root,'public',url.pathname)
 if(file){if(!fs.existsSync(file)){response.writeHead(404);response.end();return}response.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/javascript');response.end(fs.readFileSync(file));return}
 response.setHeader('Content-Type','text/html; charset=utf-8')
 if(url.pathname==='/admin.html'){
  const nonce='cra1-announcements-fixture-csp'
  response.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'`)
  response.end(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/admin/admin.css"><div id="cra1-admin-root"></div><script nonce="${nonce}">window.__CRA1_ADMIN__={role:"super_admin",user_id:1,user:"示例管理员",csrf:"fixture",base:"/api"};</script><script type="module" src="/admin/admin.js"></script></html>`);return
 }
 if(url.pathname==='/notifications.html'){response.end(`<!doctype html><html data-cra1-theme="website"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/shared/cra1-shared.css"><style>body{margin:0;background:#f5f6f8;font-family:sans-serif}*{box-sizing:border-box}:where(main) button:not([class*=btn]):not([class*=node-dot]):not([class*=float-]){display:inline-flex;align-items:center}</style><main class="cra1-notification-page"><h1>所有通知</h1><div data-cra1-notification-center></div></main><script src="/shared/cra1-shared.js"></script></html>`);return}
 const theme=url.pathname.startsWith('/cart/')?'cart':url.pathname.endsWith('.html')?'website':'member'
 response.end(`<!doctype html><html data-cra1-theme="${theme}"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/shared/cra1-shared.css"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f5f6f8}.demo{margin:40px auto;width:calc(100% - 64px);font:14px sans-serif;color:#61656b}</style><body><div data-cra1-notices data-notice-theme="${theme}" id="notices" hidden></div><p class="demo">通知组件隔离演示 · 示例数据</p><button id="outside">页面其他操作</button><script src="/shared/cra1-shared.js"></script></body></html>`)
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true,executablePath:process.env.CRA1_CHROME||'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']})
function check(ok,label){assert.ok(ok,label);checks.push(label)}
async function checkLayout(page,label){
 const body=page.locator('.cra1-notices__body'),index=await page.locator('.cra1-notices__index').boundingBox(),close=await page.locator('.cra1-notices__dismiss').boundingBox()
 check(index.x+index.width<=close.x&&Math.abs(index.y+index.height/2-close.y-close.height/2)<1,'index sits immediately left of close: '+label)
 check(await body.evaluate(el=>{const s=getComputedStyle(el);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.backgroundImage==='none'&&s.borderTopWidth==='0px'&&s.boxShadow==='none'&&getComputedStyle(el,'::before').content==='none'}),'announcement content has no background, border or glow: '+label)
 check(await page.locator('.cra1-notices__headline').evaluate(el=>{const title=el.querySelector('.cra1-notices__title').getBoundingClientRect(),summary=el.querySelector('.cra1-notices__summary').getBoundingClientRect();return Math.abs(title.bottom-summary.bottom)<5&&summary.x>=title.right-1&&summary.width>0}),'title and summary remain on one line: '+label)
}
async function checkReader(page,label){
 check(await page.locator('.cra1-notice-reader').evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.x+r.width/2-innerWidth/2)<1&&Math.abs(r.y+r.height/2-innerHeight/2)<1&&r.top>=23&&r.bottom<=innerHeight-23&&r.left>=15&&r.right<=innerWidth-15}),'reader stays centered within viewport under global reset: '+label)
}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>{try{if(!localStorage.getItem('jwt'))localStorage.setItem('jwt','fixture-first-account')}catch(e){}});const page=await context.newPage()
 page.on('pageerror',error=>errors.push(error.message))
 page.on('console',message=>{if(/Content Security Policy|CSP/.test(message.text()))cspViolations.push(message.text())})
 await page.goto(origin+'/home.htm');await page.locator('.cra1-notices__title').waitFor()
 check((await page.locator('.cra1-notices__title').textContent())==='云产品功能更新说明','server priority determines first slide')
 check((await page.locator('.cra1-notices__summary').textContent())==='通知详情示例，支持富文本和安全链接。','empty summary uses sanitized article text')
 check(!(await page.content()).includes('HIDDEN_CONFIGURATION'),'hidden configuration absent from DOM')
 await page.locator('#outside').focus();await page.mouse.move(1300,700);const before=await page.locator('.cra1-notices__title').textContent();await page.waitForTimeout(3250)
 check(await page.locator('.cra1-notices__title').textContent()!==before,'autoplay switches actual component')
 await page.locator('.cra1-notices__body').hover();const hovered=await page.locator('.cra1-notices__title').textContent();await page.waitForTimeout(3300);check(await page.locator('.cra1-notices__title').textContent()===hovered,'mouse hover pauses rotation')
 await page.mouse.move(1300,700);await page.locator('.cra1-notices__next').focus();const focused=await page.locator('.cra1-notices__title').textContent();await page.waitForTimeout(3300);check(await page.locator('.cra1-notices__title').textContent()===focused,'keyboard focus pauses rotation')
 await page.locator('.cra1-notices__count').click();check(await page.locator('.cra1-notice-reader__entry').count()===2&&await page.locator('dialog article').count()===1,'counter opens title list beside a single article');await page.locator('.cra1-notice-reader__entry').last().click();check(await page.locator('.cra1-notice-reader__head h2').first().textContent()===await page.locator('.cra1-notices__title').textContent(),'reader selection and announcement bar stay synchronized');await page.getByRole('button',{name:'下一条通知（详情）',exact:true}).click();check(await page.locator('.cra1-notice-reader__body').evaluate(el=>el.scrollTop===0),'reader switching resets content scroll');await page.keyboard.press('Escape');check(await page.locator('dialog').count()===0,'Escape closes reader');check(await page.locator('.cra1-notices__count').evaluate(element=>element===document.activeElement),'reader restores focus')
 await page.locator('.cra1-notices__dismiss').click();check(await page.locator('.cra1-notices__count').textContent()==='01 / 01','dismiss advances and changes count');for(const selector of ['.cra1-notices__previous','.cra1-notices__next'])check(await page.locator(selector).isVisible()&&await page.locator(selector).isDisabled(),'single notice retains disabled arrow: '+selector)
 await page.reload();await page.locator('.cra1-notices__title').waitFor();check(await page.locator('.cra1-notices__count').textContent()==='01 / 01','revision dismissal persists after refresh')
 await page.evaluate(()=>{localStorage.setItem('jwt','fixture-other-account')});await page.evaluate(()=>document.getElementById('notices').__cra1Notices.refresh());check(await page.locator('.cra1-notices__count').textContent()==='01 / 02','different login separates dismiss memory')
 // Destroy must abort the old request and leave no UI or timer-driven writes.
 delayed=true;await page.evaluate(()=>{const el=document.getElementById('notices');el.__cra1Notices.refresh();el.__cra1Notices.destroy()});await page.waitForTimeout(650);check(await page.locator('#notices').evaluate(element=>element.childElementCount)===0,'destroy ignores delayed responses');delayed=false
 await page.evaluate(()=>CRA1Shared.Notices.mount(document.getElementById('notices'),{theme:'member'}));await page.locator('.cra1-notices__title').waitFor();check(await page.evaluate(()=>{const host=document.getElementById('notices');return CRA1Shared.Notices.mount(host)===host.__cra1Notices}),'duplicate mounts reuse instance')
 failing=true;await page.evaluate(()=>document.getElementById('notices').__cra1Notices.refresh());check(await page.locator('#notices').isHidden(),'public read failure collapses silently');check(!(await page.content()).includes('private internal details'),'public failure details never rendered');failing=false
 // Payload replacement exercises expiry without waiting for a production clock.
 await page.evaluate(()=>{const host=document.getElementById('notices');host.__cra1Notices.destroy();CRA1Shared.Notices.mount(host,{preview:true,payload:{items:[{id:'expires',revision:'one',title:'即将到期',action:'none',dismissible:false,expires_in:.15}],interval:6,day:'2026-10-21'}})});await page.locator('#notices').waitFor({state:'hidden',timeout:1500});check(await page.locator('#notices').isHidden(),'exact expiry removes visible notice');check(!(await page.content()).includes('即将到期'),'expired content is removed from hidden DOM too')
 for(const expires of [.0095,.0299,.0795,.0999]){
  await page.evaluate(expires=>{const host=document.getElementById('notices');host.__cra1Notices.setData({items:[{id:'fractional-expiry',revision:'one',title:'定时清除',action:'none',expires_in:expires}]});},expires)
  await page.locator('#notices').waitFor({state:'hidden',timeout:1500});check(await page.locator('#notices').isHidden(),'fractional expiry removes content '+expires)
 }
 const motionPage=await context.newPage();await motionPage.emulateMedia({reducedMotion:'reduce'});await motionPage.goto(origin+'/home.htm');await motionPage.locator('.cra1-notices__title').waitFor();const staticTitle=await motionPage.locator('.cra1-notices__title').textContent();await motionPage.waitForTimeout(3250);check(await motionPage.locator('.cra1-notices__title').textContent()===staticTitle,'reduced motion uses manual switching');await motionPage.locator('.cra1-notices__next').click();check(await motionPage.locator('.cra1-notices__title').textContent()!==staticTitle,'manual navigation remains available')
 const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),touchPage=await touch.newPage();await touchPage.goto(origin+'/home.htm');await touchPage.locator('.cra1-notices__title').waitFor()
 for(const selector of ['.cra1-notices__previous','.cra1-notices__next','.cra1-notices__count','.cra1-notices__dismiss','.cra1-notices__action']){const box=await touchPage.locator(selector).boundingBox();check(box.width>=44&&box.height>=44,'touch target is at least 44px: '+selector)}
 await checkLayout(touchPage,'touch 390');await touchPage.screenshot({animations:'disabled',path:path.join(out,'member-touch-390.png'),fullPage:true});await touchPage.locator('.cra1-notices__title').click();await checkReader(touchPage,'touch 390');await touchPage.getByRole('button',{name:'查看本页通知',exact:true}).click()
 check(await touchPage.locator('.cra1-notice-reader__list').isVisible()&&await touchPage.locator('.cra1-notice-reader__body').isHidden(),'mobile all-announcements opens a readable list');await touchPage.screenshot({animations:'disabled',path:path.join(out,'reader-list-touch-390.png')})
 await touchPage.locator('.cra1-notice-reader__entry').last().click();check(await touchPage.locator('.cra1-notice-reader__body').isVisible()&&await touchPage.locator('.cra1-notice-reader__list').isHidden(),'mobile selection opens a single article');await touchPage.screenshot({animations:'disabled',path:path.join(out,'reader-detail-touch-390.png')});await touchPage.getByRole('button',{name:'查看本页通知',exact:true}).click();check(await touchPage.locator('.cra1-notice-reader').getAttribute('data-view')==='list','mobile article returns to the title list');await touch.close()
 const callsBeforeIframe=publicCalls;await motionPage.evaluate(()=>{const frame=document.createElement('iframe');frame.id='embedded';frame.src='/home.htm';document.body.append(frame)});await motionPage.frameLocator('#embedded').locator('#notices').waitFor({state:'attached'});await motionPage.waitForTimeout(200)
 check(await motionPage.frameLocator('#embedded').locator('#notices').evaluate(el=>el.hidden&&el.childElementCount===0),'embedded frame does not mount a duplicate notice')
 check(publicCalls===callsBeforeIframe,'embedded frame never requests its own announcements')
 await context.clearCookies();await page.goto(origin+'/admin.html#/notifications');await page.getByRole('heading',{name:'通知管理',exact:true}).waitFor();await page.getByLabel('通知标题',{exact:true}).waitFor()
 check(await page.getByText('只有一条时隐藏切换箭头',{exact:true}).count()===0,'obsolete single-arrow setting is removed')
 await page.getByLabel('通知标题',{exact:true}).fill('未保存的通知草稿');await page.reload();await page.getByLabel('通知标题',{exact:true}).waitFor();check(await page.getByLabel('通知标题',{exact:true}).inputValue()==='未保存的通知草稿','admin drafts survive reload')
 await page.getByRole('button',{name:'预览效果',exact:true}).click();await page.frameLocator('iframe[title="通知草稿预览"]').getByText('未保存的通知草稿',{exact:true}).waitFor();check(backend('api.workspace.get').data.values.items[0].title===initial.items[0].title,'preview leaves storage unchanged')
 check(cspViolations.length===0,'draft preview works under the actual strict admin CSP')
 check(await page.frameLocator('iframe[title="通知草稿预览"]').locator('body').evaluate(()=>{try{return !parent.document}catch(error){return error.name==='SecurityError'}}),'draft preview cannot access the admin document');await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'保存通知',exact:true}).click();await page.getByText('通知已保存',{exact:true}).waitFor();check(backend('api.workspace.get').data.values.items[0].title==='未保存的通知草稿','one save applies entire draft')
 await page.getByLabel('通知标题',{exact:true}).fill('保留本地冲突稿');backend('seed',{interval:9});await page.getByRole('button',{name:'保存通知',exact:true}).click();await page.getByRole('dialog').filter({hasText:'当前配置有更新'}).waitFor();check(backend('api.workspace.get').data.values.items[0].title==='未保存的通知草稿','conflict preserves server document');await page.keyboard.press('Escape');check(await page.getByLabel('通知标题',{exact:true}).inputValue()==='保留本地冲突稿','conflict preserves local draft')
 await page.getByRole('button',{name:'处理配置差异',exact:true}).click();await page.getByRole('button',{name:'使用服务器配置',exact:true}).click();await page.keyboard.press('Escape');
 // An old entry's unsaved browser draft is recovered into the new editor, not published.
 await page.evaluate(()=>{
  const key='cra1-workspace-v3:1',records=JSON.parse(sessionStorage.getItem(key)||'{}')
  const original={notices:{enabled:1,items:[{id:'recovery-test',title:'旧通知原值',content:'<p>原文</p>',enabled:1,global:0}]}},values=structuredClone(original)
  values.notices.items[0].title='旧入口的未保存通知'
  records['member:notices']={domain:'member',scopeId:'member:notices',original,values,revision:'old-revision'}
  sessionStorage.setItem(key,JSON.stringify(records))
 })
 await page.reload();await page.getByRole('button',{name:'恢复旧通知草稿',exact:true}).click();await page.getByText('旧入口的未保存通知',{exact:true}).waitFor()
 check(!backend('api.workspace.get').data.values.items.some(item=>item.title==='旧入口的未保存通知'),'old draft recovery never publishes automatically')
 check(await page.evaluate(()=>!!sessionStorage.getItem('cra1-workspace-v3:1:announcement-recovery')),'old raw drafts have a browser recovery copy')
 await page.getByRole('button',{name:'保存通知',exact:true}).click();await page.getByText('通知已保存',{exact:true}).waitFor()
 check(backend('api.workspace.get').data.values.items.some(item=>item.title==='旧入口的未保存通知'),'recovered draft is included in the one explicit save')
 // Four breakpoints for all three public surfaces, reader, and the actual admin editor.
 for(const width of [1920,1440,768,390]){
  await page.setViewportSize({width,height:1000});await page.goto(origin+'/admin.html#/notifications');await page.getByLabel('通知标题',{exact:true}).waitFor();await page.screenshot({animations:'disabled',path:path.join(out,`admin-${width}.png`),fullPage:true});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'admin has no horizontal overflow '+width)
  for(const [theme,route]of [['website','/index.html'],['member','/home.htm'],['cart','/cart/goods.htm']]){
   const shot=await context.newPage();await shot.setViewportSize({width,height:800});await shot.goto(origin+route);await shot.locator('.cra1-notices__title').waitFor();await shot.locator('.cra1-notices__body').hover();await shot.screenshot({animations:'disabled',path:path.join(out,`${theme}-${width}.png`),fullPage:true});check(await shot.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${theme} no horizontal overflow ${width}`)
   await checkLayout(shot,`${theme} ${width}`)
   await shot.locator('.cra1-notices__count').click();await checkReader(shot,`${theme} ${width}`);await shot.screenshot({animations:'disabled',path:path.join(out,`${theme}-reader-${width}.png`),fullPage:true});await shot.mouse.click(4,4);check(await shot.locator('dialog').count()===0,'backdrop closes reader '+theme+' '+width);await shot.close()
  }
 }
 await page.goto(origin+'/home.htm');await page.locator('.cra1-notices__title').waitFor();await page.evaluate(()=>{const host=document.getElementById('notices');host.__cra1Notices.destroy();CRA1Shared.Notices.mount(host,{preview:true,payload:{items:[{id:'long',revision:'one',title:'长通知',detail:'<p>可滚动的通知正文</p>'.repeat(100),action:'none',dismissible:true}],interval:6}})});await page.locator('.cra1-notices__title').click();await checkReader(page,'long content 390');check(await page.locator('.cra1-notice-reader__body').evaluate(el=>el.scrollHeight>el.clientHeight),'long announcement scrolls inside content area');await page.locator('.cra1-notice-reader__body').evaluate(el=>el.scrollTop=el.scrollHeight);check(await page.getByRole('button',{name:'关闭通知详情',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'long reader retains visible close button');check(await page.locator('.cra1-notice-reader__footer').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'long reader retains visible footer');await page.getByRole('button',{name:'关闭通知详情',exact:true}).click()
 await page.locator('.cra1-notices__title').click();check(await page.getByRole('button',{name:'上一条通知（详情）',exact:true}).isVisible()&&await page.getByRole('button',{name:'下一条通知（详情）',exact:true}).isDisabled(),'single reader retains visible disabled paging');await page.screenshot({animations:'disabled',path:path.join(out,'reader-long-390.png')});await page.keyboard.press('Escape')
 await reviewAnnouncementUI({browser,origin,out,backend,check})
 // The full center includes active notices from other page scopes and ignores bar dismissal.
 backend('seed',{...initial,items:[...initial.items,
  item('website-only','官网服务通知',{targets:{website:{all:false,pages:['home']}}}),
  item('cart-only','购物车服务通知',{targets:{cart:{all:true,pages:[]}}}),
  item('future-notice','NOT_YET_PUBLIC',{starts_at:'2099-01-01T00:00:00'}),
  item('expired-notice','NO_LONGER_PUBLIC',{ends_at:'2020-01-01T00:00:00'})]})
 await page.goto(origin+'/home.htm');await page.locator('.cra1-notices__title').waitFor();
 await page.evaluate(()=>{for(const s of [localStorage,sessionStorage])Object.keys(s).filter(k=>k.startsWith('cra1-notices-v1:')).forEach(k=>s.removeItem(k));document.querySelector('#notices').__cra1Notices.refresh()});
 await page.waitForFunction(()=>document.querySelector('.cra1-notices__count')?.textContent==='01 / 02');
 await page.locator('.cra1-notices__dismiss').click();check(await page.locator('.cra1-notices__count').textContent()==='01 / 01','bar dismissal remains scoped to the bar');
 await page.locator('.cra1-notices__count').click();check(await page.locator('.cra1-notice-reader__entry').count()===1,'this-page reader keeps current placement and dismissal scope');
 check(await page.getByRole('link',{name:'查看所有通知',exact:true}).isVisible(),'mobile list exposes the full-center link without opening an item');
 await page.getByRole('link',{name:'查看所有通知',exact:true}).click();await page.locator('.cra1-notification-center__entry').first().waitFor();
 check(await page.locator('.cra1-notification-center__entry').count()===4,'center includes all active website, member and cart notifications, including dismissed ones');
 check(!/HIDDEN_CONFIGURATION|NOT_YET_PUBLIC|NO_LONGER_PUBLIC/.test(await page.content()),'center excludes disabled, future and expired content');
 for(const width of [1920,1440,768,390]){
  await page.setViewportSize({width,height:900});await page.screenshot({animations:'disabled',path:path.join(out,`notification-center-${width}.png`),fullPage:true});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'notification center has no horizontal overflow '+width);
  check(await page.locator('.cra1-notification-center__entry').first().evaluate(el=>{const tag=el.querySelector('.cra1-notice-reader__entry-label').getBoundingClientRect(),title=el.querySelector('.cra1-notice-reader__entry-title').getBoundingClientRect();return title.top>=tag.bottom;}),'notification title remains below its label under website button rules '+width);
 }
 await page.getByRole('searchbox',{name:'搜索通知'}).fill('购物车');check(await page.locator('.cra1-notification-center__entry').count()===1,'center searches notice title and content');
 await page.getByRole('searchbox',{name:'搜索通知'}).fill('不存在的检索内容');check(await page.getByText('没有找到匹配的通知。',{exact:true}).isVisible(),'center has a useful empty-search state');
 await page.getByRole('searchbox',{name:'搜索通知'}).fill('');
 await page.locator('.cra1-notification-center__entry').filter({hasText:'官网服务通知'}).click();check(new URL(page.url()).searchParams.get('notice')==='website-only','notification selection has a refreshable deep link');
 await page.reload();await page.locator('.cra1-notification-center__entry').first().waitFor();check(await page.locator('.cra1-notification-center__title').textContent()==='官网服务通知','deep link restores the selected notification');
 await page.locator('.cra1-notification-center__entry').filter({hasText:'购物车服务通知'}).click();await page.goBack();check(await page.locator('.cra1-notification-center__title').textContent()==='官网服务通知','browser back restores the previous notification');
 failing=true;await page.reload();await page.getByRole('button',{name:'重新加载',exact:true}).waitFor();check(!(await page.content()).includes('private internal details'),'center never reveals internal response errors');
 failing=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.locator('.cra1-notification-center__entry').first().waitFor();check(await page.locator('.cra1-notification-center__entry').count()===4,'center recovers through retry');
 backend('seed',{enabled:false});await page.reload();await page.getByText('暂无生效中的通知。',{exact:true}).waitFor();check(await page.locator('.cra1-notification-center__entry').count()===0,'global disabled state removes every notification from the center');
 check(errors.length===0,'no new browser exceptions: '+errors.join('; '));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'passed',checks,publicCalls,screenshots:fs.readdirSync(out).filter(name=>name.endsWith('.png')).length,productionWrites:0},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,output:out}))
}catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,errors},null,2));throw error}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true})}
