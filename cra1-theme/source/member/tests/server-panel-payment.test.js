import test from 'node:test'
import assert from 'node:assert/strict'
import { isPaymentPaid, createPaymentPoller } from '../src/pages/serverPanel/payment-status.js'
test('actual top-level Paid contract and compatible data contracts confirm exactly; plain 200 never means paid',()=>{
  assert.equal(isPaymentPaid({status:200,code:'Paid'}),true)
  assert.equal(isPaymentPaid({status:200,data:{status:'Paid'}}),true)
  assert.equal(isPaymentPaid({status:400,code:'Paid'}),false)
  assert.equal(isPaymentPaid({status:200,code:'Unpaid'}),false)
  assert.equal(isPaymentPaid({status:200,data:{}}),false)
})
test('payment polling is serial and completes once even with slow response',async()=>{
  const waits=[],timers=new Map();let id=0,paid=0
  const p=createPaymentPoller({read:()=>new Promise(r=>waits.push(r)),onPaid:()=>paid++,setTimer:fn=>{timers.set(++id,fn);return id},clearTimer:id=>timers.delete(id)})
  const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve()}
  p.start();[...timers.values()][0]();p.resume();p.resume();assert.equal(waits.length,1)
  waits.shift()({status:200,code:'Unpaid'});await flush();assert.equal(paid,0)
  p.resume();waits.shift()({status:200,code:'Paid'});await flush();p.resume();assert.equal(paid,1);assert.equal(waits.length,0);p.destroy();assert.equal(timers.size,0)
})
test('closing payment stops late Paid response and aborts its read',async()=>{
  let finish,signal,paid=0
  const p=createPaymentPoller({read:s=>{signal=s;return new Promise(r=>finish=r)},onPaid:()=>paid++})
  p.resume();p.destroy();assert.equal(signal.aborted,true);finish({status:200,code:'Paid'})
  for(let i=0;i<10;i++)await Promise.resolve();assert.equal(paid,0)
})
test('hidden cashier pauses, network failure retries and business 400 waits for explicit retry',async()=>{
  let visible=true,reads=0,errors=[],paid=0,seq=0
  const timers=new Map(),flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
  const p=createPaymentPoller({isVisible:()=>visible,read:async()=>{reads++;if(reads===1)throw Error('network');if(reads===2){const e=Error('业务错误');e.data={status:400};throw e}return{status:200,code:'Paid'}},onError:e=>errors.push(e),onPaid:()=>paid++,setTimer:fn=>{timers.set(++seq,fn);return seq},clearTimer:id=>timers.delete(id)})
  p.start();visible=false;p.pause();p.resume();assert.equal(reads,0)
  visible=true;p.resume();await flush();assert.equal(reads,1);assert.equal(timers.size,1)
  p.resume();await flush();assert.equal(reads,2);assert.equal(timers.size,0);assert.equal(paid,0)
  p.retry();await flush();assert.equal(reads,3);assert.equal(paid,1);assert.equal(errors.length,2);p.destroy()
})
