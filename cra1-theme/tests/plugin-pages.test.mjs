import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'
const source=fs.readFileSync(new URL('../../public/clientarea/template/pc/cra1/js/plugin-pages.js',import.meta.url),'utf8')
test('native auto-renew ignores confirmation before host load and serializes double clicks',async()=>{
 const mixins=[];const root={Vue:{mixin:m=>mixins.push(m)},document:{documentElement:{getAttribute:()=> '[]'}},location:{pathname:'/productdetail.htm',origin:'https://fixture.invalid'},CRA1Shared:{}};
 vm.runInNewContext(source,{window:root,URL,URLSearchParams,Promise});
 let sends=0;const instance={id:20,host:{},loading:true,submitLoading:false,showRenewDialog:true,$options:{parent:{},template:'<div class="com-auto-renew"><button @click="handleAutoRenew"></button></div>',methods:{autoRenewChange:async function(){this.host={id:20};this.loading=false},handleAutoRenew:function(){sends++;this.submitLoading=true}}}};
 mixins[0].beforeCreate.call(instance);Object.assign(instance,instance.$options.methods);
 instance.handleAutoRenew();assert.equal(sends,0)
 await instance.autoRenewChange();instance.handleAutoRenew();instance.handleAutoRenew();assert.equal(sends,1)
 instance.submitLoading=false;instance.host={id:19};instance.handleAutoRenew();assert.equal(sends,1)
})
function fixture(name,view,respond,{project=false,status=1,registry}={}){
  const mixins=[],calls=[],errors=[],attributes={addons_js:registry===undefined?JSON.stringify([{id:71,name,status},...(project?[{id:72,name:'IdcsmartProject',status:1}]:[])]):registry}
  const root={location:{pathname:'/plugin/71/'+view+'.htm',origin:'https://fixture.invalid',search:''},document:{documentElement:{getAttribute:key=>attributes[key]||null,setAttribute:(key,value)=>attributes[key]=value}},Vue:{mixin:value=>mixins.push(value),component(){}},CRA1Shared:{Errors:{message:()=> '暂时无法读取，请稍后重试'}},Axios:{get:(path,options)=>{calls.push(path);return Promise.resolve().then(()=>respond(path,options)).then(data=>({data:{data}}))}},setInterval:fn=>{root.timer=fn;return 17},clearInterval:id=>{root.cleared=id;delete root.timer},apiCertificationOrder:body=>{calls.push('POST /certification/plugin/order');return Promise.resolve({data:{data:{order_id:22}}})}}
  vm.runInNewContext(source,{window:root,URL,URLSearchParams,Promise})
  const instance={$options:{data:()=>({certificationInfoObj:{person:{},company:{}},statusArr:['WaitUpload','WaitReview','ReviewFail'],custom_fieldsList:[],configInfo:{}}),methods:{getProjectList(){},getPromoterInfo(){},getMsgDetail(){},getCertificationInfo(){},getDetails(){},filterContent:s=>s,doReplyTicket(){calls.push('native reply')},showClose(){calls.push('native close')}}},$message:{error:value=>errors.push(value),warning:value=>errors.push(value)},ruler:{},urlData:{},baseMsg:{},$refs:{payDialog:{showPayDialog:id=>{root.paid=id}}},$nextTick:fn=>fn(),toBottom(){},lang:{realname_text88:'请先完成个人认证'}}
  mixins[0].beforeCreate.call(instance)
  Object.assign(instance,instance.$options.data.call(instance))
  Object.assign(instance,instance.$options.methods)
  return {root,instance,calls,errors,mixins,attributes}
}
test('native presentation context uses the registered plugin name, not a hardcoded ID',()=>{
  const f=fixture('IdcsmartCertification','authentication_select',()=>({}))
  assert.equal(f.attributes['data-cra1-plugin'],'IdcsmartCertification')
  assert.equal(f.calls.length,0)
  assert.equal(fixture('IdcsmartCertification','authentication_select',()=>({}),{status:0}).attributes['data-cra1-plugin'],undefined)
  assert.equal(fixture('IdcsmartCertification','authentication_select',()=>({}),{registry:'[{"id":71,"name":"IdcsmartCertification"}]'}).attributes['data-cra1-plugin'],'IdcsmartCertification')
})
test('invalid or absent plugin registry leaves the theme page readable without a plugin adapter',()=>{
  for(const registry of ['null','{}','[null]','invalid','[]']){
    const f=fixture('IdcsmartCertification','authentication_select',()=>({}),{registry})
    assert.equal(f.attributes['data-cra1-plugin'],undefined)
    assert.equal(f.calls.length,0)
  }
})
test('unregistered promoter never reads enrollment-only data',async()=>{
  const f=fixture('IdcsmartRecommend','recommend',()=>({promoter:{}}))
  await Promise.all([f.instance.getPromoterInfo(),f.instance.getSystemUrl(),f.instance.getCustomerUrl()])
  assert.deepEqual(f.calls,['/recommend/promoter']);assert.equal(f.instance.isOpen,false);assert.equal(f.instance.recProLoading,false)
})
test('promoter state resolves before product/URL reads; reopening refreshes state',async()=>{
  let resolve
  const f=fixture('IdcsmartRecommend','recommend',path=>path==='/recommend/promoter'?new Promise(r=>resolve=r):({products:[{id:1}],system_url:['/'],list:[]}))
  const requests=Promise.all([f.instance.getPromoterInfo(),f.instance.getSystemUrl(),f.instance.getCustomerUrl()])
  await new Promise(r=>setTimeout(r,0));assert.deepEqual(f.calls,['/recommend/promoter'])
  resolve({promoter:{url:'native',withdrawable_amount:'10.00'}});await requests
  assert.equal(f.instance.isOpen,true);assert.equal(f.calls.length,4);assert.equal(f.instance.recommendProducts[0].id,1)
  const retry=f.instance.getPromoterInfo();await new Promise(r=>setTimeout(r,0));resolve({promoter:{}});await retry
  assert.equal(f.instance.isOpen,false);assert.equal(f.instance.recommendProducts.length,0)
})
test('failed enrollment check does not issue dependent reads or leave loading active',async()=>{
  const f=fixture('IdcsmartRecommend','recommend',()=>{throw Error('internal path')})
  await Promise.all([f.instance.getPromoterInfo(),f.instance.getSystemUrl(),f.instance.getCustomerUrl()])
  assert.deepEqual(f.calls,['/recommend/promoter']);assert.equal(f.instance.recProLoading,false);assert.deepEqual(f.errors,['暂时无法读取，请稍后重试'])
})
test('missing project capability performs no request; available project reads actual endpoint',async()=>{
  const absent=fixture('IdcsmartSubAccount','addChildAccount',()=>{throw Error('must not request')})
  await absent.instance.getProjectList();assert.equal(absent.calls.length,0)
  const present=fixture('IdcsmartSubAccount','addChildAccount',()=>({list:[{id:2}]}),{project:true})
  await present.instance.getProjectList();assert.deepEqual(present.calls,['/project']);assert.equal(present.instance.projectList[0].id,2)
  const native=fixture('IdcsmartSubAccount','addChildAccount',()=>({list:[{id:3}]}),{registry:'[{"id":71,"name":"IdcsmartSubAccount"},{"id":93,"name":"IdcsmartProject"}]'})
  await native.instance.getProjectList();assert.deepEqual(native.calls,['/project']);assert.equal(native.instance.projectList[0].id,3)
})
test('same view on another plugin and child components remain untouched',()=>{
  const f=fixture('OtherPlugin','recommend',()=>({})),original=f.instance.getPromoterInfo
  const child={$options:{parent:{},methods:{getPromoterInfo:original}}}
  f.mixins[0].beforeCreate.call(child);assert.equal(child.$options.methods.getPromoterInfo,original)
  assert.equal(f.calls.length,0)
})
test('message read failures are handled and expose only the shared safe error',async()=>{
  const f=fixture('ClientCare','msgDetail',()=>{throw Error('internal')});f.instance.id='123'
  await f.instance.getMsgDetail();assert.deepEqual(f.calls,['/client_care/mail/123']);assert.deepEqual(f.errors,['暂时无法读取，请稍后重试'])
})
test('guest access has no network probe and no invented authorization',async()=>{
  const context={document:{addEventListener(){}},localStorage:{getItem(){return null}},location:{origin:'https://fixture.invalid'},CRA1Shared:{Request:{getToken:()=>'',request:()=>{throw Error('must not request')}}}}
  vm.runInNewContext(fs.readFileSync(new URL('../../public/cra1-shared/src/runtime.js',import.meta.url),'utf8'),{window:context,URL,Promise})
  await assert.rejects(context.CRA1Shared.Access.read(),/当前未登录/)
  assert.equal(context.__CRA1_ACCESS__,undefined)
})
const certInfo={person:{status:0},company:{status:0},certification_company_open:1}
test('no certification providers and an empty type never request config or create an order',async()=>{
  const f=fixture('IdcsmartCertification','authentication_select',path=>path==='/certification/info'?certInfo:{list:[]})
  await f.instance.getCertificationInfo();assert.equal(f.instance.cra1CertificationState,'empty');assert.equal(f.instance.checkedVlue,'')
  f.instance.clickType('2');await f.instance.goUploadPage();assert.deepEqual(f.calls,['/certification/info','/certification/plugin'])
})
test('certification info failure offers retry without reading providers or guessing availability',async()=>{
  const f=fixture('IdcsmartCertification','authentication_select',()=>{throw Error('private')})
  await f.instance.getCertificationInfo();await f.instance.goUploadPage()
  assert.equal(f.instance.cra1CertificationState,'error');assert.deepEqual(f.calls,['/certification/info'])
})
test('certification config failure stops before payment or navigation',async()=>{
  const f=fixture('IdcsmartCertification','authentication_select',path=>{
    if(path==='/certification/info')return certInfo
    if(path==='/certification/plugin')return{list:[{name:'demo',title:'测试认证',certification_type:['person']}]}
    throw Error('private')
  })
  await f.instance.getCertificationInfo();await f.instance.goUploadPage()
  assert.equal(f.instance.cra1CertificationConfig,'error');assert.equal(f.instance.configLoading,false)
  assert.equal(f.root.paid,undefined);assert.equal(f.root.location.href,undefined);assert.ok(!f.calls.some(p=>p.startsWith('POST')))
})
test('certification payment retains native order creation and blocks repeat clicks',async()=>{
  const f=fixture('IdcsmartCertification','authentication_select',path=>path==='/certification/info'?certInfo:path==='/certification/plugin'?{list:[{name:'demo',certification_type:'person,company'}]}:{order:{},pay:1})
  await f.instance.getCertificationInfo();await Promise.all([f.instance.goUploadPage(),f.instance.goUploadPage()])
  assert.equal(f.calls.filter(p=>p.startsWith('POST')).length,1);assert.equal(f.root.paid,22);assert.equal(f.instance.configLoading,false)
})
test('changing certification type to an empty list invalidates an older config response',async()=>{
  let finish
  const f=fixture('IdcsmartCertification','authentication_select',path=>path==='/certification/info'?certInfo:path==='/certification/plugin'?{list:[{name:'demo',certification_type:['person']}]}:new Promise(r=>finish=r))
  await f.instance.getCertificationInfo();const pending=f.instance.getConfig();await new Promise(r=>setTimeout(r,0))
  f.instance.clickType('2');finish({order:{id:1,status:'Unpaid'},amount:20});await pending
  assert.equal(f.instance.cra1CertificationState,'empty');assert.equal(f.instance.checkedVlue,'');assert.equal(f.instance.configInfo.order,undefined)
})
test('ticket missing identifier performs no read and installs no refresh timer',async()=>{
  const f=fixture('IdcsmartTicket','ticketDetails',()=>{throw Error('must not read')})
  await f.instance.getDetails();f.instance.autoRefresh();assert.equal(f.calls.length,0);assert.equal(f.root.timer,undefined)
})
test('ticket read failure is handled; retry restores content without mutating native reply order',async()=>{
  let fail=true
  const payload={ticket:{id:8,ticket_num:'8',title:'示例工单',replies:[{content:'first'},{content:'last'}],host_ids:null}}
  const f=fixture('IdcsmartTicket','ticketDetails',path=>{if(path==='/ticket/8'){if(fail)throw Error('private');return payload}return{list:[]}})
  f.root.location.search='?id=8';await f.instance.getDetails();assert.equal(f.instance.cra1TicketState,'error')
  fail=false;await f.instance.getDetails();assert.equal(f.instance.cra1TicketState,'ready');assert.equal(f.instance.ticketData.replies[0].content,'last');assert.equal(payload.ticket.replies[0].content,'first');assert.equal(f.instance.ticketData.host_ids.length,0)
  f.instance.autoRefresh();f.mixins[0].beforeDestroy.call(f.instance);assert.equal(f.root.cleared,17);assert.equal(f.root.timer,undefined)
})
