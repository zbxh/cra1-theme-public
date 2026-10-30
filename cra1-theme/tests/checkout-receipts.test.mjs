import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createHash} from 'node:crypto'
const code=fs.readFileSync(new URL('../../public/cra1-shared/src/checkout.js',import.meta.url),'utf8')
const payload={product_id:3,config_options:{cycle:7},qty:1}
const reply=id=>({data:{status:200,data:{order_id:id}}})
function fixture(records=new Map(),id=2,locks=true){
 const token='h.'+Buffer.from(JSON.stringify({info:{id}})).toString('base64')+'.s'
 const window={setTimeout,atob,navigator:locks?{locks:{request:(_key,run)=>run()}}:{},localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)},CRA1Shared:{CheckoutHash:v=>createHash('sha256').update(v).digest('hex'),Request:{getToken:()=>token,request:async()=>({data:{order:{id:7,status:'Unpaid'}}})}}}
 vm.runInNewContext(code,{window})
 return {submit:window.CRA1Shared.Checkout.submit,records,window}
}
test('a lost reply stays blocked after a fresh document and does not store payload or credentials',async()=>{
 const a=fixture();let calls=0
 await assert.rejects(a.submit('product',payload,async()=>{calls++;throw Error('lost')},{intent:'visit1'}))
 const b=fixture(a.records)
 await assert.rejects(b.submit('product',payload,async()=>{calls++;return reply(8)},{intent:'visit1'}),{code:'CHECKOUT_UNCERTAIN'})
 assert.equal(calls,1)
 assert.equal([...a.records.values()].join('').includes('config_options'),false)
})
test('created order survives navigation failure and refresh; an unpaid order is reused across new selections',async()=>{
 const a=fixture();let calls=0;const send=async()=>{calls++;return reply(7)}
 await a.submit('product',payload,send,{intent:'visit1'})
 const b=fixture(a.records)
 assert.equal((await b.submit('product',payload,send,{intent:'visit1'})).data.data.order_id,7)
 assert.equal((await b.submit('product',payload,send,{intent:'visit2'})).data.data.order_id,7)
 assert.equal(calls,1)
 b.window.CRA1Shared.Request.request=async()=>({data:{order:{id:7,status:'Paid'}}})
 await b.submit('product',payload,send,{intent:'visit2'});assert.equal(calls,2)
})
test('definite rejection can be corrected, malformed and server responses remain uncertain',async()=>{
 for(const rejected of [{data:{status:400}}, {response:{data:{status:422},status:200}}, {status:401}]){
  const a=fixture();await assert.rejects(a.submit('product',payload,async()=>{throw rejected},{intent:'a'}))
  assert.equal((await a.submit('product',payload,async()=>reply(9),{intent:'a'})).data.data.order_id,9)
 }
 for(const rejected of [{code:'BAD_RESPONSE',status:400},{data:{status:503}}, {code:'NETWORK'}]){
  const a=fixture();await assert.rejects(a.submit('product',payload,async()=>{throw rejected},{intent:'a'}))
  await assert.rejects(a.submit('product',payload,async()=>reply(9),{intent:'a'}),{code:'CHECKOUT_UNCERTAIN'})
 }
})
test('accounts and changed cart contents use separate receipts even when position zero is reused',async()=>{
 const a=fixture();await a.submit('cart',{positions:[0]},async()=>reply(7),{intent:'a',identity:[payload]})
 const changed={...payload,product_id:4}
 assert.equal((await a.submit('cart',{positions:[0]},async()=>reply(8),{intent:'b',identity:[changed]})).data.data.order_id,8)
 const b=fixture(a.records,3)
 assert.equal((await b.submit('cart',{positions:[0]},async()=>reply(9),{intent:'a',identity:[payload]})).data.data.order_id,9)
})
test('without Web Locks, two tabs cannot submit the same checkout concurrently',async()=>{
 const records=new Map(),a=fixture(records,2,false),b=fixture(records,2,false);let calls=0
 const send=async()=>{calls++;return reply(7)}
 const results=await Promise.allSettled([a.submit('product',payload,send,{intent:'a'}),b.submit('product',payload,send,{intent:'b'})])
 assert.equal(calls,1);assert.equal(results.filter(x=>x.status==='fulfilled').length,1)
})
test('blocked browser storage stops the business request before it leaves the page',async()=>{
 const a=fixture();let calls=0;a.window.localStorage.setItem=()=>{throw Error('storage blocked')}
 await assert.rejects(a.submit('product',payload,async()=>{calls++;return reply(8)}))
  assert.equal(calls,0)
})
test('an interrupted document remains blocked, while a later deliberate selection can start after the request window',async()=>{
 const records=new Map(),a=fixture(records);let release
 const pending=a.submit('product',payload,()=>new Promise(r=>release=r),{intent:'old'})
 const b=fixture(records)
 await assert.rejects(b.submit('product',payload,async()=>reply(8),{intent:'new'}),{code:'CHECKOUT_UNCERTAIN'})
 for(const[key,value]of records){const r=JSON.parse(value);r.startedAt-=121000;records.set(key,JSON.stringify(r))}
 await assert.rejects(b.submit('product',payload,async()=>reply(8),{intent:'old'}),{code:'CHECKOUT_UNCERTAIN'})
 assert.equal((await b.submit('product',payload,async()=>reply(8),{intent:'new'})).data.data.order_id,8)
 release(reply(7));await pending
})
