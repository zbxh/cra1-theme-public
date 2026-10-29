/** Real shared UI and native Vue consumer with disposable HTTP responses. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'

const root = process.env.CRA1_SOURCE_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const native = process.env.CRA1_NATIVE_ROOT
const out = process.env.CRA1_BROWSER_OUT
const stage = process.env.CRA1_REVIEW_STAGE
if (!native || !out || path.resolve(out).startsWith(root + path.sep)) throw Error('Set external output and native dependency root')
const { chromium } = await import(process.env.CRA1_PLAYWRIGHT_MODULE)
fs.mkdirSync(out, {recursive: true, mode: 0o700})
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const shared = stage ? path.join(stage, 'public/cra1-shared/releases', JSON.parse(fs.readFileSync(path.join(stage, 'release.json'))).release) : null
const bundle = shared ? fs.readFileSync(path.join(shared, 'cra1-shared.js')) : ['errors', 'request', 'ui', 'notification-session', 'announcements', 'notification-center', 'header-search'].map(name => read('public/cra1-shared/src/' + name + '.js')).join('\n')
const css = shared ? fs.readFileSync(path.join(shared, 'cra1-shared.css')) : ['tokens', 'components', 'announcements', 'header-search', 'adapters'].map(name => read('public/cra1-shared/src/' + name + '.css')).join('\n')
const plugin = shared ? fs.readFileSync(path.join(stage, 'public/clientarea/template/pc/cra1/releases', path.basename(shared), 'js/plugin-pages.js')) : read('public/clientarea/template/pc/cra1/js/plugin-pages.js')
const notice = {id:'one',revision:1,title:'服务安排示例',label:'服务通知',summary:'通知内容示例',detail:'<p>示例通知正文。</p>',action:'detail',action_label:'查看详情',dismissible:true,dismiss_for:'revision',expires_in:null}
let fixture = {}
const report = {status:'running',checks:[],failures:[],errors:[],views:[],businessWrites:0}
const later = (res, body, ms=0) => setTimeout(() => { if (!res.destroyed) { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)) } }, ms)
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture.invalid')
  res.setHeader('Cache-Control','no-store')
  if (req.method === 'POST' && !['/cra1-shared/announcements.php','/cra1-shared/notifications.php'].includes(url.pathname)) {report.businessWrites++;res.writeHead(403);res.end();return}
  if (url.pathname === '/bundle.js') {res.setHeader('Content-Type','text/javascript');res.end(bundle);return}
  if (url.pathname === '/shared.css') {res.setHeader('Content-Type','text/css');res.end(css);return}
  if (url.pathname === '/plugin-pages.js') {res.setHeader('Content-Type','text/javascript');res.end(plugin);return}
  if (url.pathname === '/vue.js') {res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(path.join(native,'public/clientarea/template/pc/default/js/common/vue.js')));return}
  if (url.pathname.endsWith('/notifications.php')) {
    const response = fixture.noticeFail ? {status:503,msg:'SQLSTATE[HY000] /www/private.php token=fixture-secret'} : {status:200,data:{items:fixture.noticeEmpty?[]:[{...notice,expires_in:fixture.longExpiry?60*86400:fixture.shortExpiry||null}],member_authenticated:false,refresh_after:30}}
    later(res,response,fixture.noticeDelay);return
  }
  if (url.pathname.endsWith('/announcements.php')) {later(res,{status:200,data:{items:fixture.bar?[{...notice,expires_in:fixture.longExpiry?60*86400:fixture.shortExpiry||null}]:[],interval:300,refresh_after:30}});return}
  if (url.pathname === '/console/v1/host') {later(res,{status:200,data:{list:[{id:1,name:'主机标识示例',product_name:'会员产品示例'}]}},fixture.searchDelay);return}
  if (url.pathname === '/console/v1/product') {later(res,{status:200,data:{list:[{id:4,name:url.searchParams.get('keywords')+' 公开商品示例'}]}});return}
  if (url.pathname === '/console/v1/announcement/type') {fixture.categoryReads++;later(res,fixture.categoryFail?{status:503,msg:'SQLSTATE /www/private.php token=fixture-secret'}:{status:200,data:{list:[{id:2,name:'服务维护'}]}},fixture.categoryDelay);return}
  if (url.pathname === '/console/v1/announcement') {
    const keyword=url.searchParams.get('keywords')||''
    later(res,fixture.listFail?{status:503,msg:'SQLSTATE /www/private.php'}:{status:200,data:{list:[{id:1,title:keyword||'公告内容示例',create_time:1792771200}],count:1}},keyword==='旧查询'?500:fixture.listDelay);return
  }
  if (url.pathname.startsWith('/console/')) {later(res,{status:200,data:{list:[]}});return}
  res.setHeader('Content-Type','text/html;charset=utf-8')
  const isPlugin=url.pathname.includes('/plugin/')
  const content=isPlugin?'<div id="root"><cra1-announcement-page :plugin-id="30"></cra1-announcement-page></div>':url.pathname==='/search.html'?'<header><div id="search" class="cra1-header-search"></div></header>':'<div data-cra1-notices data-notice-theme="website"></div><div data-cra1-notification-center></div>'
  res.end(`<!doctype html><html lang="zh-CN" data-cra1-theme="${isPlugin?'member':'website'}" addons_js='[{"id":30,"name":"IdcsmartAnnouncement","status":1}]'><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/shared.css"><style>body{margin:0;background:#f9fafb;color:#35383c;font:14px/1.6 system-ui}main{max-width:1120px;margin:auto;padding:24px 16px}header{height:60px;display:flex;justify-content:flex-end}#search{position:relative} [hidden]{display:none!important}</style><script>window.__longTimers=[];const nativeTimeout=window.setTimeout;window.setTimeout=function(fn,ms,...args){if(Number(ms)>2147483647){__longTimers.push(ms);return nativeTimeout(fn,60000,...args)}return nativeTimeout(fn,ms,...args)};</script><main>${content}</main><script src="/bundle.js"></script>${isPlugin?`<script src="/vue.js"></script><script>CRA1Shared.Runtime={common:()=>({website_name:'示例站点'})};window.Axios={get:(p,o={})=>fetch('/console/v1'+p+'?'+new URLSearchParams(o.params||{})).then(r=>r.json()).then(data=>{if(data.status!==200)throw data;return{data}})};</script><script src="/plugin-pages.js"></script><script>window.app=new Vue({el:'#root'})</script>`:url.pathname==='/search.html'?'<script>window.searchComponent=CRA1Shared.HeaderSearch.mount(document.getElementById("search"),{getSearchOptions:()=>({sources:CRA1Shared.Request.getToken()?[{key:"hosts",path:"host",label:"我的产品"},{key:"products",path:"product",label:"订购商品"}]:[{key:"products",path:"product",label:"订购商品"}]})});</script>':''}</html>`)
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin='http://127.0.0.1:'+server.address().port
const browser=await chromium.launch({args:['--no-sandbox']})
const check=(ok,label)=>{report.checks.push({passed:!!ok,label});if(!ok)report.failures.push(label)}
async function shot(page,name) {const file=name+'-'+page.viewportSize().width+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});report.views.push(file);check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' fits '+page.viewportSize().width)}
async function fresh(url,seedToken=false) {
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'})
  if(seedToken)await context.addInitScript(()=>localStorage.setItem('jwt','fixture-member'))
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message))
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort())
  await page.goto(origin+url);return {page,context}
}
try {
  fixture={noticeFail:true}
  let {page,context}=await fresh('/notifications.html')
  const search=page.getByRole('searchbox',{name:'搜索通知'})
  await page.getByText('页面错误，请刷新重试',{exact:true}).waitFor();check(await page.getByRole('button',{name:/重试|重新加载/}).count()===0,'notification failure has no retry control')
  await search.fill('服务')
  check((await page.locator('.cra1-notification-center__message').first().textContent()).includes('页面错误，请刷新重试'),'typing after notification failure preserves unavailable state')
  check(!(await page.content()).includes('fixture-secret'),'notification failure hides private diagnostics')
  fixture.noticeFail=false;fixture.noticeDelay=350
  await page.reload();await search.fill('维护')
  check((await page.locator('.cra1-notification-center__message').first().textContent()).includes('正在加载'),'typing during notification refresh preserves loading state')
  await search.fill('');await page.locator('.cra1-notification-center__entry').first().waitFor()
  check(await page.locator('.cra1-notification-center__entry').count()===1,'notification refresh recovers content')
  for(const width of [1920,1440,768,390]){await page.setViewportSize({width,height:900});await shot(page,'notification-recovered')}
  await search.fill('没有匹配内容');check((await page.locator('.cra1-notification-center__message').first().textContent()).includes('没有找到'),'successful search with no match stays distinct from failure')
  fixture.noticeEmpty=true;await search.fill('');await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})))
  await page.waitForFunction(()=>document.querySelector('.cra1-notification-center__message').textContent==='暂无生效中的通知。')
  check(await page.getByRole('button',{name:'重新加载',exact:true}).isHidden(),'successful empty notification response is not an error')
  await context.close()

  fixture={longExpiry:true,bar:true}
  ;({page,context}=await fresh('/notifications.html'))
  await page.locator('.cra1-notices__title').waitFor();await page.locator('.cra1-notification-center__entry').first().waitFor()
  check((await page.evaluate(()=>__longTimers)).length===0,'sixty-day notifications schedule no overflowing browser timers')
  await context.close()

  fixture={shortExpiry:0.5,bar:true}
  ;({page,context}=await fresh('/notifications.html'))
  await page.locator('.cra1-notices__title').waitFor();await page.locator('.cra1-notification-center__entry').first().waitFor()
  await page.waitForFunction(()=>document.querySelector('[data-cra1-notices]').hidden && !document.querySelectorAll('.cra1-notification-center__entry').length)
  check(!(await page.locator('.cra1-notification-center__detail').textContent()).includes('服务安排示例'),'expiry removes notification bar and archive detail')
  await context.close()

  fixture={}
  ;({page,context}=await fresh('/search.html',true))
  await page.getByRole('button',{name:'搜索产品与文章',exact:true}).click()
  let input=page.getByRole('combobox')
  await input.fill('示例');await page.getByRole('option').filter({hasText:'会员产品示例'}).waitFor()
  await page.evaluate(()=>{localStorage.removeItem('jwt');document.dispatchEvent(new CustomEvent('api:unauthorized'))})
  check(!(await page.content()).includes('会员产品示例'),'session invalidation immediately removes member search results')
  check(await page.locator('.cra1-header-search__results').count()===0,'session invalidation removes stale results panel')
  check(await page.locator('#search > button').evaluate(el=>el===document.activeElement),'session invalidation returns keyboard focus to search trigger')
  await page.evaluate(()=>searchComponent.close(false))
  await page.evaluate(()=>localStorage.setItem('jwt','second-fixture-member'))
  await page.waitForTimeout(650)
  await page.evaluate(()=>searchComponent.open());await input.fill('再次搜索')
  await page.getByRole('option').filter({hasText:'会员产品示例'}).waitFor()
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})))
  check(!(await page.content()).includes('会员产品示例'),'pagehide clears member results before browser back cache')
  await context.close()

  fixture={searchDelay:180}
  ;({page,context}=await fresh('/search.html',true))
  await page.evaluate(()=>searchComponent.open());input=page.getByRole('combobox')
  const reading=page.waitForRequest(request=>new URL(request.url()).pathname==='/console/v1/host')
  await input.fill('待返回');await reading
  await page.evaluate(()=>localStorage.setItem('jwt','changed-fixture-member'))
  await page.waitForTimeout(240)
  check(await page.locator('.cra1-header-search__results').count()===0,'late search response is discarded immediately when token changed')
  await page.waitForTimeout(350);await page.evaluate(()=>searchComponent.open());await input.fill('公开搜索')
  await page.getByRole('option').filter({hasText:'公开搜索 公开商品示例'}).waitFor()
  await page.keyboard.press('ArrowDown');check(!!await input.getAttribute('aria-activedescendant'),'search keyboard selection remains available')
  for(const width of [1920,1440,768,390]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(80);await page.evaluate(()=>searchComponent.open());await input.fill('公开搜索')
    await page.getByRole('option').filter({hasText:'公开搜索 公开商品示例'}).waitFor();await shot(page,'search-recovered')
  }
  await page.keyboard.press('Escape');check(await page.locator('#search > button').evaluate(el=>el===document.activeElement),'search Escape restores keyboard focus')
  await page.evaluate(()=>{searchComponent.destroy();document.dispatchEvent(new CustomEvent('api:unauthorized'))})
  check(await page.locator('#search').textContent()==='','destroyed search removes listeners and content without exceptions')
  await context.close()

  fixture={categoryFail:true,categoryReads:0,listDelay:250}
  ;({page,context}=await fresh('/plugin/30/source.htm'))
  await page.waitForTimeout(600)
  check(await page.locator('.cra1-articles__list').isVisible(),'failed categories do not hide a successful article list')
  const retry=page.getByRole('button',{name:'重试分类',exact:true})
  check(await retry.count()===0,'category failure asks for browser refresh without retry');await page.getByText('页面错误，请刷新重试',{exact:true}).waitFor()
  check(!(await page.content()).includes('fixture-secret'),'category failure hides private diagnostics')
  {
    for(const width of [1920,1440,768,390]){await page.setViewportSize({width,height:900});await shot(page,'article-category-failure')}
    fixture.categoryFail=false;await page.reload();await page.getByRole('button',{name:'服务维护',exact:true}).waitFor()
    check(fixture.categoryReads===2,'browser refresh requests the category endpoint')
    check(await retry.count()===0,'browser refresh clears only the category error')
  }
  const keywords=page.getByRole('searchbox',{name:'搜索公告'})
  await keywords.fill('旧查询');await page.getByRole('button',{name:'搜索',exact:true}).click()
  await keywords.fill('新查询');await page.getByRole('button',{name:'搜索',exact:true}).click()
  await page.getByRole('link',{name:/新查询/}).waitFor();await page.waitForTimeout(650)
  check(await page.getByRole('link',{name:/旧查询/}).count()===0,'late article response never replaces a newer query')
  for(const width of [1920,1440,768,390]){await page.setViewportSize({width,height:900});await shot(page,'article-recovered')}
  await context.close()
  check(report.errors.length===0,'no browser exceptions');check(report.businessWrites===0,'no business writes')
  report.status=report.failures.length?'failed':'passed'
} catch(error) {report.failures.push(error.stack);report.status='failed'}
finally {
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2),{mode:0o600})
  await browser.close();await new Promise(resolve=>server.close(resolve))
}
console.log(JSON.stringify({status:report.status,checks:report.checks.length,failures:report.failures,errors:report.errors}))
if(report.status!=='passed')process.exitCode=1
