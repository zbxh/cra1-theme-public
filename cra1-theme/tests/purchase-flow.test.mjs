import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createHash} from 'node:crypto'
const code=fs.readFileSync(new URL('../source/legacy-assets/cart/20261017-compat-v3/js/settlement.js',import.meta.url),'utf8')
const checkout=fs.readFileSync(new URL('../../public/cra1-shared/src/checkout.js',import.meta.url),'utf8')
const drain=async()=>{for(let i=0;i<30;i++)await Promise.resolve()}
function fixture(){
 let instance,settle=()=>Promise.resolve({data:{status:200,data:{order_id:7}}}),navigate=()=>{}
 const calls=[],messages=[]
 function Vue(options){instance=this;Object.assign(this,options.data(),{$message:{error:v=>messages.push(v),warning:v=>messages.push(v)}});for(const[k,f]of Object.entries(options.methods))this[k]=f.bind(this);for(const[k,f]of Object.entries(options.computed))Object.defineProperty(this,k,{get:()=>f.call(this)});this.$mount=()=>this}
 Vue.prototype={}
 const records=new Map(),token='header.'+Buffer.from(JSON.stringify({info:{id:2}})).toString('base64')+'.sig'
 const window={setTimeout,atob,localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)},navigator:{locks:{request:(_key,run)=>run()}},CRA1Shared:{CheckoutHash:value=>createHash('sha256').update(value).digest('hex'),Request:{getToken:()=>token,request:async()=>({status:200,data:{}})},Payments:{navigate:options=>{calls.push(['navigate',options.orderId]);navigate(options)}}}}
 vm.runInNewContext(checkout,{window});
 const send=params=>{calls.push(['settle',params]);return settle(params)}
 vm.runInNewContext(code,{window,Vue,document:{getElementsByClassName:()=>[{}]},location:{pathname:'/cart/settlement.htm',search:'?cart=1'},localStorage:{},sessionStorage:{setItem(){}},asideMenu:{},topMenu:{},payDialog:{},eventCode:{},lang:{},cart_settle:send,product_settle:send})
 window.onload();Object.assign(instance,{checked:true,showGoodsList:[{quoteReady:true,qty:1}],selectGoodsList:[0]})
 return{page:instance,calls,messages,setSettle:f=>settle=f,setNavigate:f=>navigate=f}
}
test('checkout clicks share one submission, and retry after navigation failure uses the created order',async()=>{
 const f=fixture();let finish;f.setSettle(()=>new Promise(resolve=>finish=resolve));f.setNavigate(()=>{throw Error('asset unavailable')})
 f.page.goPay();f.page.goPay();await drain();assert.equal(f.calls.filter(c=>c[0]==='settle').length,1)
 finish({data:{status:200,data:{order_id:7}}});await drain();assert.equal(f.page.createdOrderId,7);assert.equal(f.page.subBtnLoading,false)
 await f.page.goPay();assert.equal(f.calls.filter(c=>c[0]==='settle').length,1);assert.equal(f.calls.filter(c=>c[0]==='navigate').length,2)
})
test('uncertain creation response cannot silently create a second order',async()=>{
 for(const response of [()=>Promise.reject(new Error('network')),()=>Promise.resolve({data:{status:200,data:{}}}),()=>Promise.reject({status:503})]){
  const f=fixture();f.setSettle(response);await f.page.goPay();await drain();assert.equal(f.page.submissionUncertain,true)
  await f.page.goPay();await drain();assert.equal(f.calls.filter(c=>c[0]==='settle').length,1);assert.equal(f.calls.some(c=>c[0]==='navigate'),false)
 }
})
test('a definite business validation failure remains correctable',async()=>{
 const f=fixture();f.setSettle(()=>Promise.resolve({data:{status:400,msg:'请填写必填资料'}}));await f.page.goPay();await drain()
 assert.equal(f.page.submissionUncertain,false);assert.equal(f.page.createdOrderId,null)
 f.setSettle(()=>Promise.resolve({data:{status:200,data:{order_id:8}}}));await f.page.goPay();await drain();assert.equal(f.page.createdOrderId,8)
})
test('failed quotes and missing agreement never submit an order',async()=>{
 const f=fixture();f.page.quoteError='价格读取失败';await f.page.goPay();assert.equal(f.calls.length,0)
 f.page.quoteError='';f.page.checked=false;await f.page.goPay();assert.equal(f.calls.length,0)
})
