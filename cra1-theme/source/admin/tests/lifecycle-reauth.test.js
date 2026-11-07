import test from 'node:test'
import assert from 'node:assert/strict'

const boot={base:'/private-demo/index.php',csrf:'fixture-csrf',role:'super_admin',user_id:1}
globalThis.window={__CRA1_ADMIN__:boot,location:{replace(){throw new Error('unexpected redirect')}},dispatchEvent(){}}
const {api}=await import('../src/lib/api.js')

test('lifecycle step-up binds its one-use credential to the mode and current plan',async()=>{
 const sent=[],token='a'.repeat(64)
 window.dispatchEvent=event=>{
  assert.equal(event.type,'theme-reauth');assert.equal(event.detail.action,'release.lifecycle.apply');assert.equal(event.detail.target,'theme:uninstall:'+token)
  event.detail.resolve('one-use-credential')
 }
 globalThis.fetch=async(url,options)=>{
  sent.push({url,options,body:JSON.parse(options.body)})
  return {status:sent.length===1?403:200,json:async()=>sent.length===1?{status:403,code:'REAUTH_REQUIRED',msg:'请验证身份'}:{status:200,data:{completed:true}}}
 }
 const response=await api('api.release.lifecycle.apply',{mode:'uninstall',token,confirmation:'卸载酷锐A1'})
 assert.equal(response.status,200);assert.equal(sent.length,2);assert.equal(sent[1].body._reauth,'one-use-credential');assert.equal(sent[1].body.token,token);assert.equal(sent[1].options.headers['X-CSRF-Token'],boot.csrf)
})

test('cancelling verification never sends an authorized uninstall request',async()=>{
 let count=0;window.dispatchEvent=event=>event.detail.resolve(null)
 globalThis.fetch=async()=>{count++;return {status:403,json:async()=>({status:403,code:'REAUTH_REQUIRED',msg:'请验证身份'})}}
 const response=await api('api.release.lifecycle.apply',{mode:'disable',token:'b'.repeat(64),confirmation:'停用主题'})
 assert.equal(response.status,403);assert.equal(count,1)
})

test('read-only lifecycle preflight errors are identified as failed reads',async()=>{
 globalThis.fetch=async()=>{throw new Error('offline')}
 await assert.rejects(api('api.release.lifecycle.plan',{mode:'uninstall'}),error=>error.uncertain===false&&/读取未完成/.test(error.message))
})
