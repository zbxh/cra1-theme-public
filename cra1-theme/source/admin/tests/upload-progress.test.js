import test from 'node:test'
import assert from 'node:assert/strict'
import {api} from '../src/lib/api.js'

test('multipart progress uses one request and includes the existing CSRF header', async()=>{
 const old=globalThis.XMLHttpRequest
 const requests=[]
 globalThis.XMLHttpRequest=class {
  upload={}
  open(method,url){this.method=method;this.url=url}
  setRequestHeader(name,value){this.headers={...this.headers,[name]:value}}
  send(body){requests.push(this);this.body=body;this.upload.onprogress({lengthComputable:true,loaded:50,total:100});this.upload.onprogress({lengthComputable:true,loaded:100,total:100});this.status=200;this.responseText=JSON.stringify({status:200,data:{candidate:'fixture'}});this.onload()}
 }
 try{
  const file=new FormData();file.set('file',new Blob(['test']),'install.zip');const progress=[]
  const result=await api('api.release.upload',file,{reauth:false,onUploadProgress:value=>progress.push(value)})
  assert.equal(result.status,200);assert.deepEqual(progress,[50,100]);assert.equal(requests.length,1)
  assert.equal(requests[0].body,file);assert.equal(requests[0].method,'POST');assert.equal(requests[0].withCredentials,true)
  assert.ok(Object.hasOwn(requests[0].headers,'X-CSRF-Token'))
 }finally{globalThis.XMLHttpRequest=old}
})

test('an upload size rejection suggests local import instead of retrying the whole file', async()=>{
 const old=globalThis.XMLHttpRequest;let count=0
 globalThis.XMLHttpRequest=class {upload={};open(){}setRequestHeader(){}send(){count++;this.status=413;this.onload()}}
 try{
  await assert.rejects(api('api.release.upload',new FormData(),{reauth:false,onUploadProgress:()=>{}}),/服务器本地导入/)
  assert.equal(count,1)
 }finally{globalThis.XMLHttpRequest=old}
})

test('network failures leave the user able to retry without an automatic second upload', async()=>{
 const old=globalThis.XMLHttpRequest;let count=0
 globalThis.XMLHttpRequest=class {upload={};open(){}setRequestHeader(){}send(){count++;this.onerror()}}
 try{
  await assert.rejects(api('api.release.upload',new FormData(),{reauth:false,onUploadProgress:()=>{}}),/上传连接中断/)
  assert.equal(count,1)
 }finally{globalThis.XMLHttpRequest=old}
})
