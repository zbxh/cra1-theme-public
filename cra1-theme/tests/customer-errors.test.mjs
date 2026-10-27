import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const root = new URL('../../', import.meta.url)
const source = file => fs.readFileSync(new URL(file, root), 'utf8')
const errorSource = source('public/cra1-shared/src/errors.js')
const requestSource = source('public/cra1-shared/src/request.js')
function errors() { const env={}; vm.runInNewContext(errorSource, env); return env.CRA1Shared.Errors.message }
const msg = errors()
for (const value of [
  '余额不足，请先充值', '验证码错误，请重新输入', '当前账号无权执行此操作',
  '密码必须包含大写字母、小写字母和数字，长度为 8 至 32 位',
  'IP 地址格式不正确', 'VPC 网络不支持此操作', '商品库存不足',
  '邮箱已被使用', '配置已变化，请重新确认', '操作密码错误',
]) test('preserves actionable business reason: '+value,()=>assert.equal(msg({data:{status:400,msg:value}}),value))

for (const value of [
  '魔方云返回：请求失败', '智简魔方内部错误', 'SQLSTATE[HY000]: failed',
  '数据库请求失败，表 host 不存在', 'PDOException: path /internal/private',
  '错误位于 /www/wwwroot/fixture/private.php', '服务错误 /etc/fixture.key',
  '错误 C:\\private\\fixture.php', '错误：internal.php:42',
  '上游地址 https://provider.invalid/private?token=secret 返回错误',
  '服务 192.0.2.1 暂不可用', '请求错误 password=fixture-secret',
  '<img src=x onerror=alert(1)>操作失败', '{"msg":"私有诊断"}',
  'TypeError: Cannot read properties of undefined', 'Network Error',
  '未知错误\nStack trace: fixture', '异常\u202ephp.private',
  '异常\u0000诊断', '长'.repeat(241), '', null, {}, [],
]) test('hides diagnostic: '+JSON.stringify(value).slice(0,65),()=>assert.equal(msg(value),'操作暂时无法完成，请稍后重试或联系客服'))

test('timeout, cancellation, HTTP failures and nested Axios errors have safe distinct messages',()=>{
 assert.match(msg({code:'TIMEOUT'},{method:'POST'}),/避免重复提交/)
 assert.match(msg({code:'ECONNABORTED'},{method:'GET'}),/超时/)
 assert.match(msg({code:'ERR_NETWORK'}),/检查网络/)
 assert.equal(msg({response:{data:{status:400,msg:'余额不足'}}}),'余额不足')
 assert.equal(msg({status:500,msg:'私有诊断'}),'服务暂时不可用，请稍后重试或联系客服')
 assert.equal(msg({status:401,msg:'私有诊断'}),'登录已失效，请重新登录')
 assert.equal(msg({status:429}),'操作过于频繁，请稍后重试')
 assert.equal(msg({name:'AbortError'}),'请求已取消')
})

function requestFixture(body, status=200) {
 const env={setTimeout,clearTimeout,AbortController,FormData,URLSearchParams,CustomEvent,
   fetch:async()=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(body)}),
   location:{pathname:'/account.htm',href:'/account.htm',search:''},
   localStorage:{getItem:()=>'',removeItem(){}},sessionStorage:{setItem(){}},
   document:{dispatchEvent(){}},
 }
 env.window=env;env.self=env;env.top=env
 vm.runInNewContext(errorSource,env);vm.runInNewContext(requestSource,env)
 return env
}
for (const body of [null,[],42,'incorrect',{}, {data:{}}]) test('malformed API envelope is rejected: '+JSON.stringify(body),async()=>{
 const env=requestFixture(body)
 await assert.rejects(env.CRA1Shared.Request.request('/account'),e=>e.code==='BAD_RESPONSE')
})
test('diagnostics cannot survive in either shared error message or legacy data.msg',async()=>{
 const env=requestFixture({status:400,msg:'魔方云连接失败 /www/private.php',message:'SQLSTATE[HY000]'})
 await assert.rejects(env.CRA1Shared.Request.request('/account'),e=>{
   assert.equal(e.message,msg(null));assert.equal(e.data.msg,e.message);assert.equal(e.data.message,e.message);return true
 })
})
test('even malformed HTTP401 triggers login routing with safe legacy data.msg',async()=>{
 for(const body of [null,[],{msg:'私有诊断'}]){
  const env=requestFixture(body,401)
  await assert.rejects(env.CRA1Shared.Request.request('/account'),e=>e.status===401&&e.data.msg==='登录已失效，请重新登录')
  assert.equal(env.location.href,'/login.htm')
 }
})

function axiosFixture() {
 const interceptors={request:{use(f,r){this.fulfilled=f;this.rejected=r}},response:{use(f,r){this.fulfilled=f;this.rejected=r}}}
 const instance={defaults:{},interceptors};const redirects=[],stored=new Map()
 const env={URLSearchParams,axios:{create:()=>instance},localStorage:{setItem:(k,v)=>stored.set(k,v)}}
 env.window={location:{search:'',pathname:'/home.htm',href:'/home.htm'},CRA1Shared:{Request:{headers:()=>({}),getToken:()=>'fixture',unauthorized:o=>redirects.push(o)}}}
 vm.runInNewContext(errorSource,env.window)
 vm.runInNewContext(source('public/cra1-shared/src/v10-axios.js'),env)
 return{env,instance,redirects,stored,ok:interceptors.response.fulfilled,fail:interceptors.response.rejected}
}
function ticketFixture() {
 const f=axiosFixture(),created=[],card={children:[],replaceChildren(...nodes){this.children=nodes}}
 f.env.window.location.pathname='/plugin/27/ticketDetails.htm';f.env.window.location.search='?id=42'
 f.env.window.document={querySelector:()=>card,createElement(tag){const n={tag,style:{},children:[],setAttribute(){},append(...nodes){this.children.push(...nodes)}};created.push(n);return n}}
 return {...f,created,card}
}
test('native certification navigation outcomes reach their existing consumer only on its own read page',async()=>{
 const f=axiosFixture()
 f.env.window.location.pathname='/plugin/71/authentication_thrid.htm'
 f.env.window.document={documentElement:{getAttribute:()=>JSON.stringify([{id:71,name:'IdcsmartCertification'}])}}
 for(const [url,data] of [['/certification/auth',{code:10000}],['/console/v1/certification/auth',{code:10001}],['certification/status',{}]]){
  const response={status:200,config:{method:'get',url},data:{status:400,data}}
  assert.equal(await f.ok(response),response)
 }
 for(const [method,url,data] of [['post','/certification/auth',{code:10000}],['get','/certification/auth',{code:99999}],['get','/account',{code:10000}]]){
  await assert.rejects(f.ok({status:200,config:{method,url},data:{status:400,data}}))
 }
 f.env.window.location.pathname='/plugin/72/authentication_thrid.htm'
 await assert.rejects(f.ok({status:200,config:{method:'get',url:'/certification/auth'},data:{status:400,data:{code:10000}}}))
})
test('native missing ticket has a local retry state and no active reply form',async()=>{
 const f=ticketFixture(),response={status:200,config:{method:'get',url:'/ticket/42'},data:{status:400,msg:'SQLSTATE[HY000] /private/secret'}}
 assert.equal(await f.ok(response),response)
 assert.equal(f.card.children.length,1)
 assert.equal(f.created.find(n=>n.tag==='h2').textContent,'暂时无法读取工单')
 assert.equal(f.created.some(n=>n.textContent?.includes('SQLSTATE')),false)
 assert.equal(f.created.find(n=>n.tag==='a').href,'ticket.htm')
})
test('native ticket refresh failures keep valid content and writes still reject',async()=>{
 const f=ticketFixture(),config={method:'get',url:'/console/v1/ticket/42'}
 await f.ok({status:200,config,data:{status:200,data:{ticket:{id:42}}}})
 await f.ok({status:200,config,data:{status:400,msg:'暂不可用'}})
 assert.equal(f.card.children.length,0)
 await assert.rejects(f.ok({status:200,config:{method:'post',url:'/ticket/42'},data:{status:400,msg:'提交失败'}}))
 await assert.rejects(f.ok({status:200,config:{method:'get',url:'/ticket/43'},data:{status:400,msg:'读取失败'}}))
})
test('legacy network and business errors remain local with stable error.data.msg',async()=>{
 const f=axiosFixture()
 for(const status of [400,403,409,500,503]){
  await assert.rejects(f.ok({status:200,config:{},data:{status,msg:'SQLSTATE[HY000]'}}),e=>e.data.status===status&&e.message===e.data.msg&&!e.message.includes('SQLSTATE'))
 }
 await assert.rejects(f.fail({code:'ERR_NETWORK',message:'Network Error',config:{}}),e=>e.data.msg.includes('检查网络'))
 assert.equal(f.redirects.length,0);assert.equal(f.env.window.location.href,'/home.htm')
})
test('legacy401 retains unauthorized token; success and rule cache keep the original shape',async()=>{
 const f=axiosFixture(),res={status:200,config:{__cra1Token:'expired-fixture'},data:{status:401,msg:'private'}}
 await assert.rejects(f.ok(res));assert.equal(f.redirects[0].token,'expired-fixture')
 const ok={status:200,config:{},data:{status:200,rule:['fixture']}}
 assert.equal(await f.ok(ok),ok);assert.equal(f.stored.get('menuList'),'["fixture"]')
})
test('legacy security challenges are delegated before error normalization',async()=>{
 const f=axiosFixture(),challenge={status:400,data:{operate_password:1}},marker={status:'verified'}
 f.env.window.CRA1Shared.Security={setup:()=>false,challenge:r=>r.data?.operate_password===1,perform:async value=>{assert.equal(value,challenge);return marker}}
 assert.equal(await f.ok({status:200,data:challenge,config:{}}),marker)
})
test('native flat activity responses keep their contract only on the known product GET endpoint',async()=>{
 const f=axiosFixture(),data={list:[],addon_event_promotion_does_not_participate:'bottom'}
 const good={status:200,config:{url:'/event_promotion/product/4/event_promotion',method:'get'},data}
 assert.equal(await f.ok(good),good);assert.equal(good.data.status,undefined)
 for(const config of [{url:'/account',method:'get'},{url:'/event_promotion/product/4/event_promotion',method:'post'}]){
  await assert.rejects(f.ok({status:200,config,data:{...data}}))
 }
 await assert.rejects(f.ok({...good,data:{status:400,msg:'SQLSTATE[HY000]',...data}}))
 await assert.rejects(f.ok({...good,data:{list:null,addon_event_promotion_does_not_participate:'bottom'}}))
})

function websiteFixture(get) {
 const components={},listeners={}
 const document={title:'详情',addEventListener:(name,fn)=>{listeners[name]=fn}}
 const window={location:{search:'?id=9',pathname:'/news-details.html'},matchMedia:()=>({matches:true}),addEventListener(){}}
 const env={document,window,API:{get},Alpine:{data:(name,factory)=>{components[name]=factory},store(){}},setTimeout,clearTimeout,setInterval,clearInterval,URLSearchParams}
 vm.runInNewContext(source('public/cra1-shared/theme-sources/website/app.js'),env);listeners['alpine:init']()
 window.cra1AnimateListIn=()=>{}
 return components
}
const settle=()=>new Promise(resolve=>setTimeout(resolve,0))
test('news list distinguishes unavailable from empty, retries and ignores stale replies',async()=>{
 const pending=[],components=websiteFixture(()=>new Promise((resolve,reject)=>pending.push({resolve,reject})))
 const page=components.contentList();page.$nextTick=fn=>fn();page.$refs={}
 page.initEndpoint('/news');pending[0].reject(new Error('private'));await settle()
 assert.equal(page.loadFailed,true);assert.equal(page.loading,false)
 page.load();pending[1].resolve({list:[]});await settle();assert.equal(page.loadFailed,false)
 page.load();page.load();pending[3].resolve({list:[{id:2}],count:1});await settle();pending[2].reject(new Error('late'));await settle()
 assert.equal(page.items[0].id,2);assert.equal(page.loadFailed,false)
})
test('detail outages do not claim deletion; retry recovers and404 remains missing',async()=>{
 let action=()=>Promise.reject(new Error('private'))
 const page=websiteFixture(()=>action()).contentDetail()
 page.initEndpoint('/news','新闻详情');await settle();assert.equal(page.loadFailed,true);assert.equal(page.notFound,false)
 action=()=>Promise.resolve({news:{id:9,title:'fixture'}});page.retry();await settle();assert.equal(page.loadFailed,false);assert.equal(page.item.id,9)
 action=()=>Promise.reject({status:404});page.retry();await settle();assert.equal(page.notFound,true);assert.equal(page.loadFailed,false)
})
