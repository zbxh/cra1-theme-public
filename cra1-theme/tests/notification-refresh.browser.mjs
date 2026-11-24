/** Actual notification reader under transient failure, expiry and denied reads. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const root=process.env.CRA1_SOURCE_ROOT||path.resolve(new URL('../..',import.meta.url).pathname)
const stage=process.env.CRA1_REVIEW_STAGE,out=process.env.CRA1_BROWSER_OUT
const shared=stage&&path.join(stage,'public/cra1-shared/releases',JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release)
const read=n=>fs.readFileSync(path.join(root,'public/cra1-shared/src',n),'utf8')
const js=shared?fs.readFileSync(path.join(shared,'cra1-shared.js')):['errors.js','request.js','ui.js','notification-session.js','notification-center.js'].map(read).join('\n')
const css=shared?fs.readFileSync(path.join(shared,'cra1-shared.css')):['tokens.css','components.css','announcements.css'].map(read).join('\n')
const {chromium}=createRequire(path.join(root,'cra1-theme/scripts/package.json'))('playwright')
let mode='fail',calls=0,delay=0,expiry=null
const title='服务安排与使用说明'
const item=()=>({id:'notice-one',revision:1,title,label:'通知',summary:'使用说明',detail:'<p>'+('长说明IPv6：2001:db8:abcd:0123:4567:89ab:cdef:0123。'.repeat(20))+'</p><pre>'+('configuration-key-'.repeat(60))+'</pre><p><a href="#end">阅读相关说明</a></p>',expires_in:expiry})
const second={id:'notice-two',revision:1,title:'维护计划',summary:'升级安排'}
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://fixture.invalid').pathname
 if(p==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(js);return}
 if(p==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);return}
 if(p==='/cra1-shared/notifications.php'){calls++;setTimeout(()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(mode==='fail'?{status:503,msg:'SQLSTATE /www/private.php token=fixture-secret'}:mode==='denied'?{status:401}:{status:200,data:{items:mode==='empty'?[]:mode==='two'?[item(),second]:[item()],refresh_after:1,member_authenticated:false}}))},delay);return}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html data-cra1-theme="website"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{margin:0;font:14px/1.6 system-ui}main{max-width:1100px;margin:auto;padding:16px}.cra1-notification-center__article{max-height:210px;overflow:auto}</style><main><h1>所有通知</h1><div data-cra1-notification-center></div></main><script src="/bundle.js"></script></html>')
})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({args:['--no-sandbox','--no-proxy-server']}),checks=[],errors=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label)}
try{
 const p=await browser.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errors.push(e.message))
 await p.goto(origin);await p.getByRole('button',{name:'重新加载'}).waitFor();
 check(await p.getByText('通知暂时无法加载，请重试。').isVisible(),'initial read failure is distinct from empty')
 check(!(await p.content()).includes('fixture-secret'),'diagnostic payload never reaches DOM')
 await p.getByRole('searchbox').fill('服务');mode='ready';delay=350
 const before=calls;await p.getByRole('button',{name:'重新加载'}).click();
 check(await p.locator('[data-cra1-notification-center]').getAttribute('aria-busy')==='true','retry exposes loading state')
 check(await p.locator('.cra1-notification-center__feedback').evaluate(e=>e.getBoundingClientRect().height>=180),'initial loading reserves readable space')
 await p.locator('.cra1-notification-center__title').waitFor();check(calls===before+1,'one click makes one read request')
 check(await p.getByRole('searchbox').inputValue()==='服务','retry preserves search query')
 delay=0
 await p.evaluate(()=>{window.initialArticle=document.querySelector('.cra1-notification-center__article')})
 await p.locator('.cra1-notification-center__entry').first().click()
 check(await p.locator('.cra1-notification-center__title').evaluate(e=>e===document.activeElement),'selecting the current notice still focuses its article heading')
 check(await p.evaluate(()=>initialArticle===document.querySelector('.cra1-notification-center__article')),'explicit selection also reuses unchanged article content')
 await p.locator('.cra1-notification-center__article a').focus();await p.evaluate(()=>{window.retainedArticle=document.querySelector('.cra1-notification-center__article');retainedArticle.scrollTop=80;window.retainedScroll=retainedArticle.scrollTop})
 const seen=calls;await p.waitForFunction(n=>window.document.querySelector('[data-cra1-notification-center]').getAttribute('aria-busy')==='false'&&window.retainedArticle===document.querySelector('.cra1-notification-center__article'),seen);await p.waitForTimeout(1300)
 check(await p.evaluate(()=>retainedArticle===document.querySelector('.cra1-notification-center__article')&&retainedArticle.scrollTop===retainedScroll),'unchanged polling preserves article node and reading position')
 check(await p.locator('.cra1-notification-center__article a').evaluate(e=>e===document.activeElement),'unchanged polling preserves keyboard focus')
 mode='fail';await p.getByText('通知刷新失败，当前显示上次加载的内容。').waitFor()
 check(await p.locator('.cra1-notification-center__title').isVisible(),'transient refresh failure retains same-session content')
 check(await p.getByRole('searchbox').inputValue()==='服务','transient failure retains query')
 for(const width of [1440,390,320]){await p.setViewportSize({width,height:844});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'long text and pre remain within '+width);if(out){fs.mkdirSync(out,{recursive:true});await p.screenshot({path:path.join(out,'notification-stale-'+width+'.png'),fullPage:true})}}
 mode='denied';await p.getByRole('button',{name:'重新加载'}).click();await p.locator('.cra1-notification-center__title').waitFor({state:'hidden'})
 check(!(await p.locator('.cra1-notification-center__detail').textContent()).includes(title),'denied refresh clears previously displayed content')
 mode='ready';expiry=.45;await p.getByRole('button',{name:'重新加载'}).click();await p.locator('.cra1-notification-center__title').waitFor();mode='fail';await p.locator('.cra1-notification-center__title').waitFor({state:'hidden'});check(true,'retained content still expires during read failures')
 mode='empty';expiry=null;await p.getByRole('searchbox').fill('');await p.waitForFunction(()=>document.querySelector('.cra1-notification-center__message').textContent==='暂无生效中的通知。')
 check(await p.getByRole('button',{name:'重新加载'}).isHidden(),'successful empty response has no failure retry')
 mode='two'
 await p.goto(origin+'/?notice=notice-one')
 const search=p.getByRole('searchbox'),heading=p.locator('.cra1-notification-center__title')
 await heading.getByText(title,{exact:true}).waitFor()
 await search.fill('维护')
 check(await heading.textContent()===second.title,'search can temporarily display a different notice')
 await search.fill('')
 check(await heading.textContent()===title,'clearing search restores the linked notice')
 await search.fill('维护')
 await p.locator('.cra1-notification-center__entry').click()
 check(new URL(p.url()).searchParams.get('notice')===second.id,'selecting a result updates the link')
 await p.goBack()
 check(await heading.textContent()===title,'back restores the linked notice even after filtering')
 await p.goForward()
 check(await heading.textContent()===second.title,'forward restores the selected result')
 await p.reload()
 await heading.getByText(second.title,{exact:true}).waitFor()
 check(await search.inputValue()==='','reloading a shared link opens the selected notice')
 check(errors.length===0,'no browser exceptions');console.log(JSON.stringify({status:'passed',checks:checks.length,errors,businessWrites:0}))
}finally{await browser.close();await new Promise(r=>server.close(r))}
