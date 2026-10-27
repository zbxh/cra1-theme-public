/** Isolated notification audience/identity races; native auth is checked separately. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..')
const {chromium}=await import(process.env.CRA1_PLAYWRIGHT_MODULE)
const stage=process.env.CRA1_ANNOUNCEMENT_STAGE,out=process.env.CRA1_BROWSER_OUT
if(!stage||!out)throw new Error('Set external stage and output directories')
fs.mkdirSync(out,{recursive:true})
const release=JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release
const shared=path.join(stage,'public/cra1-shared/releases',release)
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cra1-notification-visibility-')),checks=[],errors=[]
const php=process.env.CRA1_PHP||'/www/server/php/74/bin/php'
function backend(action,body={}){return JSON.parse(execFileSync(php,[path.join(root,'cra1-theme/tests/announcements-fixture.php'),temp],{input:JSON.stringify({action,body}),encoding:'utf8'}))}
function target(theme){return{[theme]:{all:true,pages:[]}}}
function item(id,title,targets){return{id,title,targets,label:'服务通知',summary:'示例内容',detail:'<p>'+title+' 正文</p>',icon:'megaphone',action:'detail',action_label:'查看详情',enabled:true,dismissible:true,dismiss_for:'revision'}}
const seed={enabled:true,interval:300,items:[item('public-website','官网公开通知',target('website')),item('public-cart','购物车公开通知',target('cart')),item('private-member','MEMBER_ONLY_SECRET',target('member')),item('mixed-target','多端公开通知',{...target('member'),...target('cart')})]}
assert.equal(backend('seed',seed).status,200)
let delay=false,held=0
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://fixture.invalid');res.setHeader('Cache-Control','no-store')
 if(req.method==='POST'){
  let raw='';for await(const bytes of req)raw+=bytes
  const body=JSON.parse(raw||'{}'),member=req.headers.authorization==='Bearer fixture-valid-member'
  const data=backend(url.pathname.endsWith('/notifications.php')?'all-public':'public',{...body,viewer_member:member})
  res.setHeader('Content-Type','application/json');if(delay&&member){held++;setTimeout(()=>res.end(JSON.stringify(data)),650)}else res.end(JSON.stringify(data));return
 }
 if(url.pathname.startsWith('/assets/')){const file=path.join(shared,path.basename(url.pathname));res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(file));return}
 if(url.pathname.startsWith('/console/')){res.setHeader('Content-Type','application/json');res.end('{"status":200,"data":{}}');return}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="zh-CN" data-cra1-theme="website"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/cra1-shared.css"><style>body{margin:0;background:#f9fafb;color:#35383c;font-family:system-ui}main{padding:28px;max-width:1200px;margin:auto}main button{display:inline-flex;align-items:center}</style><main><h1>通知示例</h1><div id="bar"></div><div data-cra1-notification-center></div></main><script src="/assets/cra1-shared.js"></script><script>CRA1Shared.Notices.mount(document.getElementById('bar'),{theme:'member',path:'/home.htm'});</script></html>`)
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
function check(value,label){assert.ok(value,label);checks.push(label)}
try{
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',error=>errors.push(error.message))
 await page.goto(origin+'/notifications.html?notice=private-member');await page.locator('.cra1-notification-center__entry').first().waitFor()
 check(await page.locator('.cra1-notification-center__entry').count()===3,'anonymous center includes cart and website notifications')
 check(!(await page.content()).includes('MEMBER_ONLY_SECRET'),'private deep link does not expose title or body')
 check(await page.locator('.cra1-notices__count').textContent()==='01 / 01','anonymous member path cannot bypass audience restriction')
 check(await page.getByRole('link',{name:'登录后查看更多通知',exact:true}).isVisible(),'anonymous center offers login without exposing hidden count')
 const spoof=await context.request.post(origin+'/cra1-shared/notifications.php',{data:{viewer_member:true}})
 check(!JSON.stringify(await spoof.json()).includes('MEMBER_ONLY_SECRET'),'mock identity is server-controlled rather than body-controlled')
 await page.evaluate(()=>localStorage.setItem('jwt','fixture-invalid-member'))
 await page.waitForTimeout(650);check(!(await page.content()).includes('MEMBER_ONLY_SECRET'),'invalid saved token remains anonymous')
 await page.evaluate(()=>localStorage.setItem('jwt','fixture-valid-member'))
 await page.waitForFunction(()=>document.querySelectorAll('.cra1-notification-center__entry').length===4)
 check(await page.locator('.cra1-notices__count').textContent()==='01 / 02','same-tab login refreshes bar and center')
 check(await page.getByRole('link',{name:'登录后查看更多通知',exact:true}).isHidden(),'verified member sees no login prompt')
 for(const width of [1920,1440,768,390]){await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'member layout '+width);await page.screenshot({path:path.join(out,`member-${width}.png`),fullPage:true})}
 await page.locator('.cra1-notices__count').click();check(await page.locator('.cra1-notice-reader__entry').count()===2,'member popup includes member-only notice')
 await page.evaluate(()=>{localStorage.removeItem('jwt');document.dispatchEvent(new CustomEvent('api:unauthorized'))})
 check(await page.locator('dialog').count()===0,'logout immediately closes private reader')
 check(!(await page.content()).includes('MEMBER_ONLY_SECRET'),'logout immediately removes private DOM')
 await page.waitForFunction(()=>document.querySelectorAll('.cra1-notification-center__entry').length===3)
 await page.getByRole('searchbox',{name:'搜索通知'}).fill('MEMBER_ONLY_SECRET');check(await page.locator('.cra1-notification-center__entry').count()===0,'anonymous search cannot find private content')
 await page.getByRole('searchbox',{name:'搜索通知'}).fill('')
 const other=await context.newPage();await other.goto(origin+'/notifications.html');await other.evaluate(()=>localStorage.setItem('jwt','fixture-valid-member'))
 await page.waitForFunction(()=>document.querySelectorAll('.cra1-notification-center__entry').length===4)
 check(true,'another tab login refreshes visibility')
 delay=true;await page.evaluate(()=>{document.getElementById('bar').__cra1Notices.refresh();window.dispatchEvent(new Event('focus'))})
 await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))})
 await page.waitForTimeout(100);await other.evaluate(()=>localStorage.removeItem('jwt'))
 await page.waitForFunction(()=>document.querySelectorAll('.cra1-notification-center__entry').length===3)
 await page.waitForTimeout(850);check(!(await page.content()).includes('MEMBER_ONLY_SECRET')&&held>0,'late authenticated response cannot restore private content after logout');delay=false
 await other.close();await page.bringToFront()
 await page.evaluate(()=>localStorage.setItem('jwt','fixture-valid-member'))
 await page.waitForFunction(()=>document.querySelectorAll('.cra1-notification-center__entry').length===4)
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})))
 check(!(await page.content()).includes('MEMBER_ONLY_SECRET'),'pagehide removes private data before BFCache')
 await page.evaluate(()=>{localStorage.removeItem('jwt');window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))})
 await page.waitForFunction(()=>document.querySelectorAll('.cra1-notification-center__entry').length===3)
 check(!(await page.content()).includes('MEMBER_ONLY_SECRET'),'BFCache restore rechecks current login')
 for(const width of [1920,1440,768,390]){await page.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'anonymous layout '+width);await page.screenshot({path:path.join(out,`anonymous-${width}.png`),fullPage:true})}
 check(errors.length===0,'no browser errors')
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'passed',checks,errors,productionWrites:0},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length}))
}catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,errors},null,2));throw error}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true})}
