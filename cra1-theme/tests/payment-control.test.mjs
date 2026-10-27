import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const native=fs.readFileSync(new URL('../../public/clientarea/template/pc/cra1/components/payDialog/payDialog.js',import.meta.url),'utf8')
const bridge=fs.readFileSync(new URL('../../public/cra1-shared/src/payments.js',import.meta.url),'utf8')
const ok=data=>({data:{status:200,data}}), tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
function nativeFixture({status='Unpaid',amount='120.00',balance='40.00',plugins=[],type='new',customfields={},gateways=[{id:1,name:'PluginA',title:'商家自定义网关',url:'data:image/png;base64,fixture'},{id:2,name:'UserCustom',title:'线下转账'}]}={}){
  const calls=[],events=[],html=[],timers=new Map(),errors=[];let timerId=0,paid=false,credit=0,coin=0,voucher=0,payResponse=ok({html:'<form>plugin</form>'}),statusResponse=ok({}),finishStatus
  const order=()=>({id:7,status:paid?'Paid':status,amount:amount==null?amount:Number(amount)-coin-voucher,amount_unpaid:Math.max(0,Number(amount)-coin-voucher-credit),credit,type,items:[]})
  const env={window:{CRA1Shared:{Runtime:{common:()=>({currency_prefix:'¥'}),error:e=>e.message}}},lang:new Proxy({},{get:(_,key)=>String(key)}),url:'/native/',localStorage:{},document:{hidden:false},AbortController,
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),setInterval:()=>++timerId,clearInterval(){},havePlugin:name=>plugins.includes(name),
    orderDetails:async id=>{calls.push(['order',id]);return ok({order:order(),customfields})},gatewayList:async()=>ok({list:gateways}),account:async()=>ok({account:{credit:balance}}),creditDetail:async()=>ok({credit_limit:{status:'Active',remaining_amount:'200.00'}}),
    creditPay:async params=>{calls.push(['credit',params]);credit=params.use?Math.min(Number(amount)-coin-voucher,Number(balance)):0;return ok({id:7})},pay:async params=>{calls.push(['pay',params]);return payResponse},payCreditLimit:async params=>{calls.push(['credit-limit',params]);return ok({})},getPayStatus:async()=>{calls.push(['status']);return finishStatus?new Promise(r=>finishStatus(r)):statusResponse},
    $:()=>({html:value=>html.push(value)}),apiVoucherPayList:async()=>ok({list:[{id:8,code:'DEMO',price:'20.00'}]}),apiCoinClientCoupon:async()=>ok({name:'平台币',available_coin:10,use_coin:1}),
    apiApplyCoin:async params=>{calls.push(['coin',params]);coin=params.use?10:0;return ok({coin_amount:coin,coin_coupons_count:coin?1:0})},
    apiApplyVoucher:async params=>{calls.push(['voucher',params]);voucher=params.use?20:0;return ok({voucher_amount:voucher,voucher_get_id:voucher?8:''})},console}
  vm.runInNewContext(native,env)
  const component=vm.runInNewContext('payDialog',env),page=component.data.call({})
  Object.assign(page,{pageMode:true,allowCredit:true,initialGateway:'',commonData:{currency_prefix:'¥'},$emit:(...event)=>events.push(event),$nextTick:fn=>fn(),$set:(target,key,value)=>target[key]=value,$message:{error:e=>errors.push(e),warning:e=>errors.push(e),success(){},info:e=>errors.push(e)},$refs:{payBox:{},proof:{getOrderDetails:async id=>calls.push(['proof',id])}}})
  for(const [key,fn] of Object.entries(component.methods))page[key]=fn.bind(page)
  for(const [key,fn] of Object.entries(component.computed))Object.defineProperty(page,key,{get:()=>fn.call(page)})
  return {page,calls,events,html,timers,errors,setPay:response=>payResponse=response,setPaid:value=>paid=value,setStatus:response=>statusResponse=response,setStatusWait:fn=>finishStatus=fn}
}
test('native controller preserves actual gateway metadata, partial balance and plugin HTML',async()=>{
  const f=nativeFixture();await f.page.showPayDialog(7)
  assert.equal(f.page.gatewayList[0].title,'商家自定义网关');assert.equal(f.page.gatewayList[0].url,'data:image/png;base64,fixture')
  assert.equal(f.page.calcPayAmount,'80.00');assert.equal(f.html[0],'<form>plugin</form>');assert.equal(f.calls.find(c=>c[0]==='credit')[1].use,1);assert.equal(f.events.some(e=>e[0]==='payok'),false);assert.equal(f.timers.size,1)
})
test('ordinary 200 cannot confirm balance payment; only verified paid order does',async()=>{
  const f=nativeFixture({balance:'200.00'});await f.page.showPayDialog(7);await f.page.handleOk()
  assert.equal(f.events.some(e=>e[0]==='payok'),false);assert.match(f.errors.at(-1),/尚未完成/)
  f.setPaid(true);await f.page.handleOk();assert.equal(f.events.filter(e=>e[0]==='payok').length,1)
})
test('top-level Paid handles immediate settlement without requiring an HTML payload',async()=>{
  const f=nativeFixture();f.setPay({data:{status:200,code:'Paid',data:{}}});await f.page.showPayDialog(7)
  assert.equal(f.events.filter(e=>e[0]==='payok').length,1);assert.equal(f.html.length,0);assert.equal(f.timers.size,0)
})
test('recharge excludes balance, credit limit and voucher payment even when plugins are installed',async()=>{
  const f=nativeFixture({balance:'200.00',plugins:['CreditLimit','Coin','IdcsmartVoucher']});f.page.isCz=true
  // The authoritative order type is checked inside showPayDialog; test the gateway policy directly.
  f.page._cra1PayGeneration=1;f.page.zfData.orderId=7;f.page.zfData.amount=120;await f.page.getGateway();await f.page.handleGatewaySelection()
  assert.deepEqual(Array.from(f.page.gatewayList,g=>g.name),['PluginA','UserCustom']);assert.equal(f.calls.some(c=>c[0]==='credit'),false)
})
test('offline stages reuse the existing proof flow without creating another transfer application',async()=>{
  for(const status of ['WaitUpload','WaitReview','ReviewFail']){const f=nativeFixture({status});await f.page.showPayDialog(7);assert.equal(f.calls.filter(c=>c[0]==='proof').length,1);assert.equal(f.calls.some(c=>c[0]==='pay'),false);assert.equal(f.page.diaInitIng,false)}
})
test('cancelled/refunded and missing orders never create a gateway charge',async()=>{
  for(const status of ['Cancelled','Refunded']){const f=nativeFixture({status});await f.page.showPayDialog(7);assert.equal(f.calls.some(c=>c[0]==='pay'),false)}
  const f=nativeFixture({amount:null});await assert.rejects(f.page.showPayDialog(7));assert.equal(f.calls.some(c=>c[0]==='pay'),false)
})
test('slow status reads are shared, and changing gateways invalidates a late Paid',async()=>{
  const f=nativeFixture();await f.page.showPayDialog(7)
  let finish;f.setStatusWait(resolve=>{finish=resolve})
  const a=f.page.readPaymentStatus(7),b=f.page.readPaymentStatus(7);assert.equal(a,b);await tick();assert.equal(f.calls.filter(c=>c[0]==='status').length,1)
  finish({data:{status:200,code:'Unpaid'}});await a
  const poll=[...f.timers.values()][0];const request=poll();await tick();f.page.clearPolling();finish({data:{status:200,code:'Paid'}});await request
  assert.equal(f.events.some(e=>e[0]==='payok'),false)
})
function bridgeFixture(){
  const store=new Map(),navigation=[],listeners={};let account=4,orderStatus='Unpaid'
  const sessionStorage={get length(){return store.size},key:i=>[...store.keys()][i],getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}
  const document={activeElement:null,addEventListener:(n,f)=>listeners[n]=f,removeEventListener(){}}
  const window={location:{origin:'https://fixture.invalid',href:'https://fixture.invalid/productdetail.htm?id=3',assign:path=>navigation.push(path)},sessionStorage,atob:v=>Buffer.from(v,'base64').toString(),addEventListener(){},removeEventListener(){},CRA1Shared:{Request:{getToken:()=>`h.${Buffer.from(JSON.stringify({info:{id:account}})).toString('base64url')}.s`,request:async()=>({status:200,data:{order:{id:7,status:orderStatus}}})}}}
  vm.runInNewContext(bridge,{window,document,URL,Date,Number,Promise})
  return {p:window.CRA1Shared.Payments,store,navigation,setAccount:v=>account=v,setStatus:v=>orderStatus=v,window}
}
test('return context is account/tab/order scoped, same-origin only, and contains no callback or credentials',async()=>{
  const f=bridgeFixture();f.p.navigate({orderId:7,hostId:3,operation:'upgrade',returnTo:'https://evil.invalid/',context:{password:'secret',action:'upgrade',configuration:{cpu:4,password:'secret'}},onPaid:()=>{}})
  assert.equal(f.p.context(7),null)
  f.p.navigate({orderId:7,hostId:3,operation:'upgrade',returnTo:'/productdetail.htm?id=3&jwt=secret',context:{password:'secret',configuration:{cpu:4,password:'secret'}}})
  assert.equal(f.p.context(7).source,'/productdetail.htm?id=3');assert.equal([...f.store.values()].join('').includes('secret'),false)
  f.setAccount(5);assert.equal(f.p.context(7),null);f.setAccount(4)
  f.p.mark(7,'paid');let done=0;await f.p.resume({hostId:3,onPaid:()=>done++});assert.equal(done,0)
  f.setStatus('Paid');await f.p.resume({hostId:3,onPaid:()=>done++});assert.equal(done,1);assert.equal(f.p.context(7),null)
})
test('invalid order IDs never navigate or create recovery records',()=>{
  const f=bridgeFixture();for(const id of [0,-1,'invalid','9007199254740992'])assert.throws(()=>f.p.navigate({orderId:id}));assert.equal(f.navigation.length,0);assert.equal(f.store.size,0)
})
test('direct provider return verifies a stored source even without a browser result marker',async()=>{
  const f=bridgeFixture();f.p.navigate({orderId:7,hostId:3,operation:'renew'});let paid=0
  await f.p.resume({hostId:8,onPaid:()=>paid++});assert.equal(paid,0)
  await f.p.resume({hostId:3,onPaid:()=>paid++});assert.ok(f.p.context(7));assert.equal(paid,0)
  f.setStatus('Paid');await f.p.resume({hostId:3,onPaid:()=>paid++});assert.equal(paid,1);assert.equal(f.p.context(7),null)
})
test('free orders keep a native confirmation without requiring an online gateway',async()=>{
  const f=nativeFixture({amount:'0.00',balance:'0.00',gateways:[]});await f.page.showPayDialog(7)
  assert.equal(f.page.zfData.gateway,'credit');assert.equal(f.page.calcPayAmount,'0.00');assert.equal(f.calls.some(c=>c[0]==='pay'),false)
  f.setPaid(true);await f.page.handleOk();assert.equal(f.events.filter(e=>e[0]==='payok').length,1)
})
test('credit-limit payment keeps its dedicated endpoint and verifies settlement',async()=>{
  const f=nativeFixture({plugins:['CreditLimit']});await f.page.showPayDialog(7)
  assert.equal(f.page.zfData.gateway,'CreditLimit');assert.equal(f.page.zfData.checked,false)
  await f.page.handleOk();assert.equal(f.calls.filter(c=>c[0]==='credit-limit').length,1);assert.equal(f.events.some(e=>e[0]==='payok'),false)
  f.setPaid(true);await f.page.handleOk();assert.equal(f.events.filter(e=>e[0]==='payok').length,1)
})
test('native voucher and coin discounts re-read the order and preserve the server payable',async()=>{
  const f=nativeFixture({plugins:['Coin','IdcsmartVoucher']});await f.page.showPayDialog(7)
  assert.equal(f.page.showCoupon,true);assert.equal(f.page.showCoin,true);assert.equal(f.page.coin_amount,10);assert.equal(f.page.voucher_amount,20)
  assert.equal(f.page.calcPayAmount,'50.00');assert.equal(f.calls.find(c=>c[0]==='coin')[1].order_id,7)
  assert.equal(f.calls.find(c=>c[0]==='voucher')[1].auto,1);assert.equal(f.events.some(e=>e[0]==='payok'),false)
  await f.page.applyVoucher('',0);await tick();assert.equal(f.page.voucher_amount,0);assert.equal(f.page.calcPayAmount,'70.00')
})
test('first-invoice order never applies an account balance behind the payment plugin',async()=>{
  const f=nativeFixture({balance:'200.00',customfields:{is_pre_invoice:1}});await f.page.showPayDialog(7)
  assert.equal(f.page.zfData.checked,false);assert.equal(f.page.gatewayList.some(g=>g.name==='credit'),false);assert.equal(f.calls.some(c=>c[0]==='credit'),false);assert.equal(f.page.calcPayAmount,'120.00')
})
test('an expired authentication stops the payment status loop',async()=>{
  const f=nativeFixture();await f.page.showPayDialog(7);f.setStatus({data:{status:401}})
  const run=[...f.timers.values()][0];f.timers.clear();await run();assert.equal(f.timers.size,0);assert.match(f.page.gatewayError,/失效/)
})
