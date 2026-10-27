import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createOAuthFlow} from '../src/lib/oauth-session.js'
const flush=()=>new Promise(resolve=>setImmediate(resolve))
function fixture({result={data:{jwt:'example-jwt'}},blocked=false,request}={}){
  let time=0,id=0
  const timers=new Map(),calls=[],windows=[],results=[],errors=[]
  const start=createOAuthFlow({origin:'https://example.com',now:()=>time,
    schedule:fn=>{timers.set(++id,fn);return id},unschedule:id=>timers.delete(id),
    open:()=>{if(blocked)return null;const popup={closed:false,location:{},close(){this.closed=true}};windows.push(popup);return popup},
    request:async path=>{calls.push(path);return request?request(path):path==='/oauth/token'?result:{data:{url:'https://provider.example/authorize'}}},
  })
  return {start,calls,windows,results,errors,timers,options:{onResult:r=>results.push(r),onError:e=>errors.push(e)},async tick(ms=300){time+=ms;const pending=[...timers.values()];timers.clear();for(const fn of pending)await fn();await flush()}}
}
test('OAuth never consumes native pending state; reads once after callback closes',async()=>{
  const f=fixture();f.start('FutureSocial',f.options);await flush()
  for(let i=0;i<10;i++)await f.tick()
  assert.deepEqual(f.calls,['/oauth/FutureSocial']);assert.equal(f.results.length,0)
  f.windows[0].closed=true;await f.tick();await f.tick()
  assert.deepEqual(f.calls,['/oauth/FutureSocial','/oauth/token']);assert.equal(f.results.length,1);assert.equal(f.timers.size,0)
})
test('first authorization routes to native association, without treating it as login',async()=>{
  const f=fixture({result:{data:{url:'https://example.com/oauth.htm'}}});f.start('Next',f.options);await flush();f.windows[0].closed=true;await f.tick()
  assert.equal(f.results[0].data.url,'https://example.com/oauth.htm');assert.equal(f.errors.length,0)
})
test('popup cancellation and expiry are recoverable and do not report success',async()=>{
  const f=fixture({result:{data:{}}});f.start('Next',f.options);await flush();f.windows[0].closed=true;await f.tick();assert.equal(f.results.length,0);assert.match(f.errors[0].message,/未完成/)
  const g=fixture();g.start('Next',g.options);await flush();await g.tick(600000);assert.match(g.errors[0].message,/过期/);assert.equal(g.calls.length,1);assert.equal(g.windows[0].closed,true)
})
test('blocked popup does not create an orphan native OAuth session',async()=>{
  const f=fixture({blocked:true});f.start('Next',f.options);await flush();assert.equal(f.calls.length,0);assert.match(f.errors[0].message,/窗口/)
})
test('account binding refreshes actual account state after native session is cleared',async()=>{
  const f=fixture({result:{data:{}}});let refreshed=0;f.start('Next',{...f.options,onBound:()=>refreshed++});await flush();f.windows[0].closed=true;await f.tick()
  assert.equal(refreshed,1);assert.equal(f.results.length,0);assert.equal(f.errors.length,0)
})
test('unmount cancellation and replacement ignore late initialization failures',async()=>{
  let fail;const f=fixture({request:()=>new Promise((_,reject)=>{fail=reject})});const stop=f.start('Old',f.options);await flush();stop();fail(new Error('late'));await flush();assert.equal(f.errors.length,0);assert.equal(f.timers.size,0)
  const g=fixture();g.start('Old',g.options);await flush();g.start('New',g.options);await flush();assert.equal(g.windows[0].closed,true);await g.tick();assert.equal(g.calls.includes('/oauth/token'),false)
})
test('unmount ignores in-flight token results and unsafe return addresses are rejected',async()=>{
  let deliver;const f=fixture({request:path=>path==='/oauth/token'?new Promise(resolve=>{deliver=resolve}):{data:{url:'https://provider.example/'}}});const stop=f.start('Next',f.options);await flush();f.windows[0].closed=true;const wait=f.tick();await flush();stop();deliver({data:{jwt:'late'}});await wait;assert.equal(f.results.length,0)
  for(const url of ['https://untrusted.example/oauth.htm','javascript:alert(1)','/admin.htm']){const g=fixture({result:{data:{url}}});g.start('Next',g.options);await flush();g.windows[0].closed=true;await g.tick();assert.equal(g.results.length,0);assert.equal(g.errors.length,1)}
})
test('failed login completion is handled without an unhandled rejection',async()=>{
  const f=fixture();f.start('Next',{...f.options,onResult:async()=>{throw new Error('completion failed')}});await flush();f.windows[0].closed=true;await f.tick();assert.equal(f.errors[0].message,'completion failed')
})
