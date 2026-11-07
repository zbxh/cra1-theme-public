import {test} from 'node:test'
import assert from 'node:assert/strict'
import {api,mediaApi} from '../source/admin/src/lib/api.js'
const original=globalThis.fetch
function response(status,body){return{status,json:async()=>body}}
test('backend saves retain outcome uncertainty after network or invalid response',async()=>{
 try{
  globalThis.fetch=async()=>{throw new TypeError('Failed to fetch /private/backend.php')}
  await assert.rejects(api('api.workspace.editor.save',{patch:{title:'draft'}}),e=>e.uncertain&&e.message.includes('避免重复提交')&&!e.message.includes('private'))
  await assert.rejects(api('api.workspace.editor.get'),e=>!e.uncertain&&e.message.includes('读取未完成'))
  globalThis.fetch=async()=>({status:504,json:async()=>{throw new SyntaxError('private')}})
  await assert.rejects(api('api.save',{}),e=>e.uncertain&&e.message.includes('PHP')&&!e.message.includes('SyntaxError'))
 }finally{globalThis.fetch=original}
})
test('backend preserves detailed partial save, conflict and reauthentication responses',async()=>{
 try{
  for(const body of[
   {status:200,msg:'配置已保存，快照同步失败：runtime/cra1_theme/member_center_public.json',data:{snapshot_ok:false,save_state:'partial'}},
   {status:409,msg:'配置已被其他会话修改',data:{revision:'2'}},
   {status:403,code:'REAUTH_REQUIRED',msg:'请重新验证身份'},
  ]){
   globalThis.fetch=async()=>response(200,body)
   assert.equal(await api('api.workspace.editor.save',{}, {reauth:false}),body)
  }
 }finally{globalThis.fetch=original}
})
test('media upload shares Chinese transport failures',async()=>{
 try{
  globalThis.fetch=async()=>{throw new TypeError('Network Error')}
  await assert.rejects(mediaApi.upload(new Blob(['fixture'])),e=>e.uncertain&&/原因：连接中断/.test(e.message)&&!e.message.includes('Network Error'))
 }finally{globalThis.fetch=original}
})
