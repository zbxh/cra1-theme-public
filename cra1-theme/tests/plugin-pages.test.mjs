import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'
const source=fs.readFileSync(new URL('../../public/clientarea/template/pc/cra1/js/plugin-pages.js',import.meta.url),'utf8')
function fixture(name,view,respond,{project=false,status=1,registry}={}){
  const mixins=[],calls=[],errors=[],attributes={addons_js:registry===undefined?JSON.stringify([{id:71,name,status},...(project?[{id:72,name:'IdcsmartProject',status:1}]:[])]):registry}
  const root={location:{pathname:'/plugin/71/'+view+'.htm',origin:'https://fixture.invalid',search:''},document:{documentElement:{getAttribute:key=>attributes[key]||null,setAttribute:(key,value)=>attributes[key]=value}},Vue:{mixin:value=>mixins.push(value),component(){}},CRA1Shared:{Errors:{message:()=> '暂时无法读取，请稍后重试'}},Axios:{get:(path,options)=>{calls.push(path);return Promise.resolve().then(()=>respond(path,options)).then(data=>({data:{data}}))}}}
  vm.runInNewContext(source,{window:root,URL,URLSearchParams,Promise})
  const instance={$options:{methods:{getProjectList(){},getPromoterInfo(){},getMsgDetail(){}}},$message:{error:value=>errors.push(value)},ruler:{},urlData:{}}
  mixins[0].beforeCreate.call(instance)
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
