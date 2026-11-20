import fs from 'node:fs'
import assert from 'node:assert/strict'
import path from 'node:path'
import {createRequire} from 'node:module'
const root=path.resolve(import.meta.dirname,'../..'),member=path.join(root,'cra1-theme/source/member')
const {build}=createRequire(path.join(member,'package.json'))('esbuild')
const {chromium}=createRequire(path.join(root,'cra1-theme/scripts/package.json'))('playwright')
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import Gate from './pages/host-access-gate';window.mountGate=id=>createRoot(document.getElementById('app')).render(<Gate hostId={id}><section id="protected-panel">产品面板</section></Gate>);`
const built=await build({stdin:{contents:fixture,resolveDir:path.join(member,'src'),sourcefile:'host-access-fixture.jsx',loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},logLevel:'silent'})
const browser=await chromium.launch({args:['--no-sandbox']});const checks=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label)}
try{
 for(const mode of ['no-plugin','unlicensed','allowed','blocked','transient','session','permission','malformed','detail-unlicensed']){
  const p=await browser.newPage();const requests=[],errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.abort())
  await p.setContent(`<html addons_js='${mode==='no-plugin'?'[]':'[{"name":"EContract","id":42}]'}'><body><div id="app"></div></body></html>`)
  await p.evaluate(mode=>{window.gateReads=[];window.gateAttempt=0;window.CRA1Shared={UI:{},Runtime:{error:e=>e.message},Request:{request:async path=>{window.gateReads.push(path);const reject=(status,msg,code='API_ERROR')=>{throw Object.assign(new Error(msg),{status,code,data:{status,msg}})};
   if(path.endsWith('/timeout')){window.gateAttempt++;if(mode==='unlicensed')reject(400,'功能未授权');if(mode==='transient'&&window.gateAttempt===1)reject(503,'内容暂时无法加载');if(mode==='session')reject(401,'登录已失效','UNAUTHORIZED');if(mode==='permission')reject(403,'无权访问');if(mode==='malformed')return{data:{}};return{data:mode==='blocked'||mode==='detail-unlicensed'?{timeout:true,act:['unable_access']}:{timeout:false}}}
   if(path==='/theme/host/24'){if(mode==='detail-unlicensed')reject(400,'功能未授权');return{data:{host:{id:24,order_id:100}}}};throw Error('Unexpected request '+path)}}}},mode)
  await p.addScriptTag({content:built.outputFiles[0].text});await p.evaluate(()=>window.mountGate(24));await p.waitForTimeout(100)
  if(['no-plugin','unlicensed','allowed'].includes(mode))check(await p.locator('#protected-panel').count()===1,mode+': product panel is available')
  else check(await p.locator('#protected-panel').count()===0,mode+': product panel stays gated')
  if(mode==='blocked')check(await p.getByRole('button',{name:'前往签署合同'}).count()===1,'real unsigned contract keeps signing action')
  if(mode==='detail-unlicensed')check(await p.getByRole('button',{name:'重新加载'}).count()===1,'host lookup failure cannot bypass a confirmed contract restriction')
  if(mode==='transient'){await p.getByRole('button',{name:'重新加载'}).click();await p.locator('#protected-panel').waitFor();check(await p.evaluate(()=>window.gateAttempt)===2,'failed contract read can recover without refreshing page')}
  if(mode==='no-plugin')check(await p.evaluate(()=>window.gateReads.length)===0,'absent contract plugin makes no contract query')
  check(errors.length===0,mode+': no browser exception');await p.close()
 }
 console.log(JSON.stringify({status:'passed',checks:checks.length,labels:checks}))
}finally{await browser.close()}
