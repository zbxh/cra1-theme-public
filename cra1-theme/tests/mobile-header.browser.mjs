/** Real Vue header and shared interactions, with isolated read-only API fixtures. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright')
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..')
const out=process.env.CRA1_BROWSER_OUT
if(!out||path.resolve(out).startsWith(root+path.sep))throw new Error('Set CRA1_BROWSER_OUT outside the site')
fs.mkdirSync(out,{recursive:true})
const shared=path.join(root,'public/cra1-shared/src'),checks=[],errors=[]
const assets={
 '/vue.js':path.join(root,'public/clientarea/template/pc/default/js/common/vue.js'),
 '/shell.css':path.join(root,'public/cra1-shared/theme-sources/member/cra1-shell.css'),
 '/header.js':path.join(root,'public/cra1-shared/theme-sources/member/topMenu.js'),
}
const scripts=['ui.js','header-search.js','announcements.js','header-actions.js']
const styles=['tokens.css','header-search.css','announcements.css','user-panel.css','header-support.css','header-actions.css']
const fixture=`
window.__CRA1_RUNTIME__={features:{client_care:true,ssh:true},links:{client_care:'/plugin/91/message.htm'}};
window.__CRA1_MEMBER_SNAPSHOT__={appearance:{show_cart:1,show_message:1,show_language:1}};
window.reads=0;window.messageDelay=0;window.messageCount=3;window.navigations=[];
window.fixtureSupport={enabled:true,groups:[{title:'联系我们',items:[{action:'copy',label:'复制客服账号',copy:'fixture-support',showText:true,showIcon:true},{action:'link',label:'在线客服',href:'/support.html',showText:true},{action:'link',label:'不安全链接',href:'javascript:alert(1)',showText:true}]}]};
window.CRA1Shared={
 Runtime:{context:()=>__CRA1_RUNTIME__,link:n=>__CRA1_RUNTIME__.links[n]||'',money:v=>'¥'+v},
 Avatar:{register(){},style:()=>({}),letter:u=>String(u.username||'会员').slice(0,1)},
 Request:{request:async()=>({data:{list:[]}})},
};
function getCommon(){return Promise.resolve({data:{data:{website_name:'用于验证窄屏的较长商家名称',system_logo:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="112" height="18"%3E%3Crect width="112" height="18" rx="4" fill="%23212327"/%3E%3Ctext x="7" y="13" fill="white" font-size="12"%3EExample%3C/text%3E%3C/svg%3E',lang_list:[{display_lang:'zh-cn',display_name:'简体中文'},{display_lang:'en-us',display_name:'English'}],theme_header_support:fixtureSupport}}})}
function getMenu(){return Promise.resolve({data:{status:200}})}
function accountDetail(){return Promise.resolve({data:{status:location.search.includes('guest')?401:200,data:{account:{id:1,username:'演示用户',credit:10}}}})}
function cartList(){return Promise.resolve({data:{status:200,data:{list:[{},{},{}]}}})}
function messageInfo(){reads++;const count=messageCount;return new Promise(resolve=>setTimeout(()=>resolve({data:{status:200,data:{list:[],count}}}),messageDelay))}
function logout(){return Promise.resolve()}
function changeLanguage(v){window.lastLanguage=v.lang;return new Promise(()=>{})}
`;
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture.invalid');let file=assets[u.pathname]
 if(u.pathname.startsWith('/shared/'))file=path.join(shared,path.basename(u.pathname))
 if(file){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(file));return}
 res.setHeader('Content-Type','text/html; charset=utf-8')
 res.end(`<!doctype html><html data-cra1-theme="member"><meta name="viewport" content="width=device-width,initial-scale=1">${['/shell.css',...styles.map(s=>'/shared/'+s)].map(s=>`<link rel="stylesheet" href="${s}">`).join('')}<style>body{margin:0;background:#f2f3f5;font:14px sans-serif}button,a{font:inherit}.fixture-content{padding:20px}button{cursor:pointer}</style><div id="app"></div><button id="outside" class="fixture-content">页面其他操作</button><script src="/vue.js"></script><script>${fixture}</script>${scripts.map(s=>`<script src="/shared/${s}"></script>`).join('')}<script>
CRA1Shared.UI.copy=async value=>{window.copied=value;return true};
const noticeMount=CRA1Shared.Notices.mount;
const items=[1,2].map(id=>({id:'fixture-'+id,revision:'1',title:'服务通知：这是一条用于验证窄屏单行布局与省略效果的较长标题 '+id,detail:'<p>完整通知正文。</p>',action:'detail',dismissible:true}));
CRA1Shared.Notices.mount=(host,options)=>noticeMount(host,{...options,preview:true,payload:{items,interval:6}});
Vue.directive('plugin',{});
</script><script src="/header.js"></script><script>
window.vm=new Vue({render:h=>h(topMenu)}).$mount('#app').$children[0];
vm.go=url=>navigations.push(url);vm.goLogin=()=>navigations.push('/login.htm');
</script></html>`)
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']})
function check(ok,label){assert.ok(ok,label);checks.push(label)}
async function open(context,query=''){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/home.htm'+query);await p.locator('.cra1-account__trigger').waitFor({state:'attached'});await p.waitForFunction(()=>vm.isGetData);return p}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await open(context)
 await p.waitForFunction(()=>vm.msgCount===3)
 check(await p.evaluate(()=>reads===1),'unread count is fetched once after account and capabilities are ready')
 for(const width of [200,240,280,320,359,360,390,430,767,768,1440]){
  await p.setViewportSize({width,height:844});await p.waitForTimeout(60)
  const m=await p.locator('.cra1-header').evaluate(h=>{
   const r=h.getBoundingClientRect(),visible=e=>!!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
   const buttons=[...h.querySelectorAll('.cra1-header__menu-btn,.cra1-header-search>.cra1-header__icon-btn,.cra1-account__trigger')].map(e=>e.getBoundingClientRect());
   return {height:r.height,nowrap:getComputedStyle(h).flexWrap==='nowrap',inside:buttons.every(b=>b.left>=0&&b.right<=innerWidth&&b.top>=r.top&&b.bottom<=r.bottom),old:[...h.querySelectorAll('.cra1-header__right>.cra1-header-support,.cra1-header__cart,.cra1-header__msg,.cra1-header__right>.cra1-lang')].filter(visible).length};
  })
  check(m.height===48&&m.inside,'header stays on one 48px row at '+width)
  if(width<768)check(m.nowrap&&m.old===0,'mobile header contains only navigation, brand, search and avatar at '+width)
  else check(m.old>=3,'desktop header keeps its independent shortcuts at '+width)
  if(width<=767){
   check(await p.locator('.cra1-notices').evaluate(e=>e.getBoundingClientRect().height===44),'notice stays one 44px row at '+width)
   check(await p.locator('.cra1-notices__index').isVisible()===(width>=360),'counter uses the screen width boundary at '+width)
   const gap=await p.locator('.cra1-notices').evaluate(e=>{const b=e.querySelector('.cra1-notices__body'),title=e.querySelector('.cra1-notices__title').getBoundingClientRect(),mark=e.querySelector('.cra1-notices__mark').getBoundingClientRect(),count=e.querySelector('.cra1-notices__index'),close=e.querySelector('.cra1-notices__dismiss').getBoundingClientRect();return Number.parseFloat(getComputedStyle(e).columnGap)>=8&&title.x-mark.right>=8&&(count.offsetWidth?count.getBoundingClientRect().x-title.right>=8&&close.x-count.getBoundingClientRect().right>=8:close.x-title.right>=8)})
   check(gap,'notice content and controls retain at least 8px separation at '+width)
  }
 }
 await p.setViewportSize({width:320,height:640});const trigger=p.locator('.cra1-account__trigger'),mobile=p.locator('.cra1-account-mobile')
 await trigger.tap();check(await mobile.isVisible(),'avatar opens the mobile menu')
 check(await mobile.locator('.cra1-account__avatar').evaluate(e=>getComputedStyle(e).backgroundSize==='cover'&&getComputedStyle(e).backgroundPosition==='50% 50%'),'custom avatar uses the same image sizing as the header avatar')
 check(await mobile.getByRole('link',{name:'站内信',exact:false}).getAttribute('href')==='/plugin/91/message.htm','message link uses the installed plugin route')
 check(await mobile.locator('.cra1-account-mobile__count').allTextContents().then(v=>v.join(',')==='3,3'),'message and cart counts appear in the mobile menu')
 await mobile.getByRole('link',{name:'站内信',exact:false}).click();check(await p.evaluate(()=>navigations.at(-1)==='/plugin/91/message.htm'),'click follows the current plugin URL')
 await p.evaluate(()=>{vm.msgCount=0;vm.shoppingCarNum=7});await p.waitForTimeout(50)
 check(await p.locator('.cra1-account__unread').isHidden()&&await mobile.locator('.cra1-account-mobile__count').last().textContent()==='7','read state and cart changes update the existing menu')
 await mobile.getByRole('button',{name:'客户服务',exact:true}).click();check(await mobile.getByText('联系我们',{exact:true}).isVisible(),'support expands inside the avatar menu')
 await mobile.getByRole('button',{name:'复制复制客服账号',exact:true}).click();check(await p.evaluate(()=>copied==='fixture-support'),'embedded support retains its copy action')
 check(await mobile.getByText('账号已复制',{exact:true}).isVisible(),'copy completion is announced')
 check(await mobile.locator('a[href^="javascript:"]').count()===0,'embedded support rejects unsafe links')
 await mobile.getByRole('button',{name:'返回账户菜单',exact:true}).click();check(await mobile.getByRole('button',{name:'客户服务',exact:true}).evaluate(e=>e===document.activeElement),'back returns focus to the support entry')
 await mobile.getByRole('button',{name:'切换语言',exact:true}).click();await mobile.getByRole('button',{name:'English',exact:true}).click();check(await p.evaluate(()=>lastLanguage==='en-us'),'mobile language selection uses the original language callback')
 await p.keyboard.press('Escape');check(await p.locator('.cra1-account__menu').isHidden()&&await trigger.evaluate(e=>e===document.activeElement),'Escape closes the avatar menu and restores focus')
 await trigger.tap();await p.locator('.cra1-header-search>.cra1-header__icon-btn').click();check(await p.locator('.cra1-account__menu').isHidden(),'opening search closes the account menu')
 check(await p.getByRole('combobox').isVisible(),'search icon expands the search input')
 await p.keyboard.press('Escape');await trigger.tap();await p.touchscreen.tap(4,600);check(await p.locator('.cra1-account__menu').isHidden(),'outside click closes the menu')
 await trigger.tap();await p.evaluate(()=>{vm.onMemberContent({detail:{appearance:{show_cart:0,show_message:0,show_language:0}}});vm.commonData.theme_header_support={enabled:false}});await p.waitForTimeout(60)
 for(const name of ['站内信','购物车','客户服务','切换语言'])check(await mobile.getByRole(name==='客户服务'||name==='切换语言'?'button':'link',{name,exact:false}).count()===0,'disabled entry is absent from the mobile menu: '+name)
 const readsOff=await p.evaluate(()=>reads);await p.evaluate(()=>vm.getMessageList());check(await p.evaluate(()=>reads)===readsOff,'disabled messages never request business data')
 await p.evaluate(()=>{messageDelay=180;messageCount=9;vm.onMemberContent({detail:{appearance:{show_cart:1,show_message:1,show_language:1}}});vm.getMessageList();vm.getMessageList();__CRA1_RUNTIME__.features.client_care=false;dispatchEvent(new Event('cra1:feature-flags'))});await p.waitForTimeout(230)
 check(await p.evaluate(()=>vm.msgCount===0),'late message response cannot restore a disabled plugin badge')
 check(await p.evaluate(()=>reads)===readsOff+1,'simultaneous message refreshes share one request')
 await p.evaluate(()=>{__CRA1_RUNTIME__.features.client_care=true;dispatchEvent(new Event('cra1:feature-flags'))});await p.waitForFunction(()=>vm.msgCount===9);check(await p.locator('.cra1-account__unread').isVisible(),'re-enabled capability refreshes the badge')
 await p.keyboard.press('Escape');await p.locator('.cra1-notices__title').click();await p.getByRole('button',{name:'查看本页通知',exact:true}).click();check(await p.locator('.cra1-notice-reader__entry').count()===2,'hidden counter still permits opening this-page notifications from the title')
 await p.keyboard.press('Escape');await p.evaluate(()=>{document.querySelector('.cra1-notices-host').__cra1Notices.setData({items:[{id:'fixed',title:'不可关闭的通知',dismissible:false,detail:'<p>正文</p>'}]})})
 check(await p.locator('.cra1-notices').evaluate(e=>e.querySelector('.cra1-notices__body').getBoundingClientRect().right===e.getBoundingClientRect().right),'non-dismissible narrow notice leaves no empty control column')
 const guest=await open(context,'?guest');await guest.setViewportSize({width:200,height:640});await guest.locator('.cra1-account__trigger').tap();const gm=guest.locator('.cra1-account-mobile')
 check(await gm.getByRole('link',{name:'登录 / 注册',exact:true}).isVisible(),'anonymous cart keeps login reachable from the avatar')
 check(await gm.getByRole('link',{name:'购物车',exact:false}).isVisible()&&await gm.getByRole('button',{name:'客户服务',exact:true}).isVisible(),'anonymous cart keeps cart and configured support reachable')
 check(await gm.getByRole('link',{name:'财务中心',exact:true}).count()===0&&await guest.evaluate(()=>reads===0),'guest menu exposes no account data or message requests')
 await guest.setViewportSize({width:1440,height:900});check(await guest.locator('.cra1-header__login').isVisible()&&await guest.locator('.cra1-account--guest').isHidden(),'anonymous desktop retains the combined login button')
 await p.keyboard.press('Escape');await p.evaluate(()=>{vm.unLogin=true});await p.waitForTimeout(50);await trigger.tap()
 check(await mobile.getByText('尚未登录',{exact:true}).isVisible()&&await mobile.getByRole('link',{name:'账户资料',exact:true}).count()===0,'expired login does not reuse a previously loaded account in the guest menu')
 check(await p.locator('.cra1-upanel__username').textContent()===''&&await p.locator('.cra1-upanel__sub').textContent()==='','expired login clears cached desktop identity as well')
 check(errors.length===0,'no browser exceptions: '+errors.join('; '))
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'passed',checks,errors},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length}))
}catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack,checks,errors},null,2));throw e}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
