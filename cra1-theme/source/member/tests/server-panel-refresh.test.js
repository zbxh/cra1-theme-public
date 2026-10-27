import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourceRefreshController } from '../src/pages/serverPanel/resource-refresh.js'
function fixture() {
  let time = 0, visible = true, seq = 0
  const timers = new Map()
  const controller = createResourceRefreshController({ now: () => time, isVisible: () => visible,
    setTimer: (fn, delay) => { const id = ++seq; timers.set(id, { fn, at: time + delay }); return id }, clearTimer: id => timers.delete(id) })
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
  const advance = async delta => {
    const end = time + delta
    for (;;) {
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      const [id, t] = next; time = t.at; timers.delete(id); t.fn(); await flush()
    }
    time = end; await flush()
  }
  return { controller, flush, advance, timers, visible: value => { visible = value } }
}
test('resources have independent intervals and routine polls never read untouched resources', async () => {
  const f = fixture(), calls = { power: 0, disks: 0, host: 0 }
  for (const [id, interval] of [['power',15000], ['disks',30000], ['host',300000]]) f.controller.register(id, { scope: 1, interval, read: async () => ++calls[id] })
  f.controller.start(); await f.flush(); assert.deepEqual(calls,{power:1,disks:1,host:1})
  await f.advance(30000); assert.deepEqual(calls,{power:3,disks:2,host:1})
  f.controller.refresh(['disks']); await f.flush(); assert.deepEqual(calls,{power:3,disks:3,host:1})
  f.controller.destroy(); assert.equal(f.timers.size,0)
})
test('slow resource reads complete without overlapping or being invalidated by routine timers', async () => {
  const f=fixture(), pending=[], accepted=[]; let count=0
  f.controller.register('disk',{scope:1, interval:1000,read:()=>{count++; return new Promise(r=>pending.push(r))}, apply:v=>accepted.push(v)})
  f.controller.start(); await f.advance(3500); assert.equal(count,1)
  pending.shift()('slow'); await f.flush(); assert.deepEqual(accepted,['slow'])
  await f.advance(1000); assert.equal(count,2); f.controller.destroy()
})
test('mutation invalidates only affected response, coalesces notifications and preserves unrelated slow reads', async () => {
  const f=fixture(), waits={a:[],b:[]}, accepted={a:[],b:[]}; let signal
  for (const id of ['a','b']) f.controller.register(id,{scope:1,interval:30000,read:({signal:s})=>{if(id==='a')signal=s;return new Promise(r=>waits[id].push(r))},apply:v=>accepted[id].push(v)})
  f.controller.start(); const oldSignal=signal
  f.controller.refresh(['a']); f.controller.refresh(['a']); assert.equal(oldSignal.aborted,true)
  waits.a.shift()('old'); waits.b.shift()('unrelated'); await f.flush()
  assert.deepEqual(accepted,{a:[],b:['unrelated']}); assert.equal(waits.a.length,1)
  waits.a.shift()('fresh'); await f.flush(); assert.deepEqual(accepted.a,['fresh']); f.controller.destroy()
})
test('tracking stops after expected state settles and returns to normal interval',async()=>{
  const f=fixture(); let value=0,calls=0,settled=0
  f.controller.register('disk',{scope:1,interval:30000,activeInterval:2000,pending:v=>v.status===2,read:async()=>{calls++;return {status:value}},apply:()=>{}})
  f.controller.start();await f.flush(); value=2
  f.controller.refresh(['disk'],{track:true,onSettled:{disk:()=>settled++}});await f.flush();assert.equal(calls,2)
  value=1;await f.advance(2000);assert.equal(settled,1)
  await f.advance(29999);assert.equal(calls,3);await f.advance(1);assert.equal(calls,4);f.controller.destroy()
})
test('unchanged expected result backs off after 90s and remains confirmable',async()=>{
  const f=fixture();let value=0,calls=0
  f.controller.register('remote',{scope:1,interval:0,read:async()=>{calls++;return value}})
  f.controller.start();await f.flush();f.controller.refresh(['remote'],{track:true});await f.flush()
  await f.advance(90000);assert.equal(f.controller.summary()[0].delayed,true)
  const before=calls;await f.advance(29999);assert.equal(calls,before)
  value=1;await f.advance(1);assert.equal(calls,before+1);assert.deepEqual(f.controller.summary(),[])
  await f.advance(60000);assert.equal(calls,before+1);f.controller.destroy()
})
test('hidden tabs pause reads; resuming reads only dirty and expired resources',async()=>{
  const f=fixture(), calls={a:0,b:0,c:0}
  for(const [id,interval]of[['a',10000],['b',300000],['c',300000]])f.controller.register(id,{scope:1,interval,read:async()=>++calls[id]})
  f.controller.start();await f.flush();f.visible(false);f.controller.pause();await f.advance(60000)
  f.controller.refresh(['c']);await f.flush();assert.deepEqual(calls,{a:1,b:1,c:1})
  f.visible(true);f.controller.resume();await f.flush();assert.deepEqual(calls,{a:2,b:1,c:2});f.controller.resume();await f.flush();assert.deepEqual(calls,{a:2,b:1,c:2});f.controller.destroy()
})
test('updates to unmounted cards stay dirty and are read when opened',async()=>{
  const f=fixture();let reads=0
  f.controller.start();f.controller.refresh(['disk'],{track:true});await f.flush();assert.equal(reads,0)
  const off=f.controller.register('disk',{scope:1,interval:30000,read:async()=>++reads});await f.flush();assert.equal(reads,1)
  off();f.controller.refresh(['disk']);await f.advance(60000);assert.equal(reads,1)
  f.controller.register('disk',{scope:1,interval:30000,read:async()=>++reads});await f.flush();assert.equal(reads,2);f.controller.destroy()
})
test('unregister and host/scope switch reject old responses and serially read the new scope',async()=>{
  const f=fixture(), waits=[],accepted=[]
  const off=f.controller.register('disk',{scope:1,read:()=>new Promise(r=>waits.push(r)),apply:v=>accepted.push(v)})
  f.controller.start();off();f.controller.register('disk',{scope:2,read:async()=>2,apply:v=>accepted.push(v)})
  waits.shift()(1);await f.flush();assert.deepEqual(accepted,[2]);f.controller.destroy()
})
test('read failure preserves data and retries; destroy rejects pending commits',async()=>{
  const f=fixture(),accepted=[];let count=0,release
  f.controller.register('disk',{scope:1,interval:30000,read:async()=>{count++;if(count===1)return ['kept'];if(count===2)throw Error('network');return new Promise(r=>release=r)},apply:v=>accepted.push(v)})
  f.controller.start();await f.flush();await f.advance(30000);assert.deepEqual(accepted,[['kept']]);assert.equal(f.controller.summary()[0].error,true)
  await f.advance(30000);f.controller.destroy();release(['late']);await f.flush();assert.deepEqual(accepted,[['kept']]);assert.equal(f.timers.size,0)
})
test('cache seeds avoid rereading initial host/detail and errors in on-demand resources retry',async()=>{
  const f=fixture();let calls=0
  f.controller.register('host',{scope:1,interval:300000,initialData:{id:1},readOnMount:false,read:async()=>{calls++;return {id:1}}})
  f.controller.register('remote',{scope:1,interval:0,read:async()=>{calls++;throw Error('network')}})
  f.controller.start();await f.flush();assert.equal(calls,1);await f.advance(15000);assert.equal(calls,2);f.controller.destroy()
})
test('repeated focus events neither flood fast tracking nor postpone the next scheduled read',async()=>{
  const f=fixture();let calls=0
  f.controller.register('power',{scope:1,interval:15000,activeInterval:2000,read:async()=>{calls++;return 'on'}})
  f.controller.start();await f.flush();f.controller.refresh(['power'],{track:true});await f.flush()
  for(let i=0;i<8;i++){await f.advance(250);f.controller.resume();await f.flush()}
  assert.equal(calls,3);f.controller.destroy()
})
test('returning from a brief hidden interval keeps the resource original due time',async()=>{
  const f=fixture();let calls=0
  f.controller.register('power',{scope:1,interval:15000,read:async()=>++calls});f.controller.start();await f.flush()
  await f.advance(5000);f.visible(false);f.controller.pause();await f.advance(5000);f.visible(true);f.controller.resume();await f.flush();assert.equal(calls,1)
  await f.advance(4999);assert.equal(calls,1);await f.advance(1);assert.equal(calls,2);f.controller.destroy()
})
