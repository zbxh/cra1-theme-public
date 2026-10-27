/** Exercise real Radix portals, focus scopes and menu transitions without APIs. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const root=path.resolve(process.env.CRA1_DIALOG_SOURCE_ROOT||new URL('../..',import.meta.url).pathname)
const require=createRequire(path.join(root,'cra1-theme/source/member/package.json'))
const {buildSync}=require('esbuild')
const {chromium}=createRequire(import.meta.url)(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright')
const code=buildSync({stdin:{loader:'jsx',sourcefile:'dialog-fixture.jsx',resolveDir:path.join(root,'cra1-theme/source/member/src'),contents:`
 import React,{useState} from 'react';import{createRoot}from'react-dom/client';
 import{Dialog,DialogContent,DialogTrigger,DialogTitle,DialogDescription}from'./ui/dialog';
 import{DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem}from'./ui/dropdown-menu';
 import{Select}from'./ui/select';
 function Modal({id,open,close,children,...props}){return <Dialog open={open} onOpenChange={v=>!v&&close()}><DialogContent {...props}><DialogTitle>{id}</DialogTitle><DialogDescription>隔离交互夹具</DialogDescription>{id==='普通弹窗'&&<input autoFocus placeholder="自动聚焦字段"/>}{children}<button onClick={close}>取消</button></DialogContent></Dialog>}
 function App(){const[a,A]=useState(false),[b,B]=useState(false),[menu,M]=useState(false),[nested,N]=useState(false),[custom,C]=useState(false),[disabled,D]=useState(false);
 return <><button id="direct" onClick={()=>A(true)}>普通打开</button><button id="custom" onClick={()=>C(true)}>自定义打开</button><button id="override">自定义焦点</button><button id="disabled" disabled={disabled} onClick={()=>{D(true);A(true)}}>失效按钮</button>
 <DropdownMenu open={menu} onOpenChange={M}><DropdownMenuTrigger id="menu">操作菜单</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={()=>B(true)}>菜单打开弹窗</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
 <Modal id="普通弹窗" open={a} close={()=>A(false)}><Select aria-label="测试选择"><option value="a">选项甲</option><option value="b">选项乙</option></Select><button id="nested" onClick={()=>N(true)}>嵌套打开</button></Modal>
 {b&&<Modal id="菜单弹窗" open close={()=>B(false)}/>}
 <Modal id="内层弹窗" open={nested} close={()=>N(false)}/>
 <Modal id="自定义弹窗" open={custom} close={()=>C(false)} onCloseAutoFocus={e=>{e.preventDefault();document.getElementById('override').focus()}}/>
 <Dialog><DialogTrigger id="native">原生触发</DialogTrigger><DialogContent><DialogTitle>原生弹窗</DialogTitle><DialogDescription>保留原有触发契约</DialogDescription></DialogContent></Dialog>
 </>};createRoot(document.getElementById('root')).render(<App/>);
 `},bundle:true,format:'iife',jsx:'automatic',write:false,define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'}}).outputFiles[0].text
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const checks=[],errors=[]
function check(value,label){assert.ok(value,label);checks.push(label)}
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'})
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort())
  await page.setContent('<html data-cra1-theme="member"><head></head><body><div id="root"></div></body></html>')
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'cra1-theme/source/member/src/ui/controls.css'),'utf8')+`.cui-dialog-overlay{position:fixed;inset:0;z-index:100;background:#7777}.cui-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:320px;max-height:88vh;overflow:auto;z-index:101;background:white;padding:20px;box-sizing:border-box}.cui-popover{z-index:150;background:white}button{min-height:40px}.cui-dialog button{display:block;margin:8px 0}[data-state=closed].cui-dialog-overlay{display:none}`})
  await page.evaluate(()=>{window.CRA1Shared={UI:{},Request:{}}})
  await page.addScriptTag({content:code})
  async function returned(id,label){await page.waitForTimeout(60);const active=await page.evaluate(()=>({id:document.activeElement.id,tag:document.activeElement.tagName,role:document.activeElement.getAttribute('role')}));check(await page.locator(id).evaluate(e=>e===document.activeElement),`${width} ${label} ${JSON.stringify(active)}`);check(await page.evaluate(()=>getComputedStyle(document.body).pointerEvents!=='none'),`${width} overlay releases interaction`)}
  for(const action of ['Escape','cancel','close','outside']){
   await page.locator('#direct').click();const d=page.getByRole('dialog',{name:'普通弹窗',exact:true});await d.waitFor();check(await d.evaluate(e=>e.contains(document.activeElement)),`${width} focus enters controlled dialog`)
   if(action==='Escape')await page.keyboard.press('Escape')
   else if(action==='cancel')await d.getByRole('button',{name:'取消',exact:true}).click()
   else if(action==='close')await d.getByRole('button',{name:'关闭',exact:true}).click()
   else await page.locator('.cui-dialog-overlay:visible').click({position:{x:3,y:3}})
   await d.waitFor({state:'hidden'});await returned('#direct',action+' restores original trigger')
  }
  await page.locator('#menu').focus();await page.keyboard.press('ArrowDown');await page.getByRole('menuitem',{name:'菜单打开弹窗',exact:true}).waitFor();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'菜单弹窗',exact:true}).waitFor();await page.keyboard.press('Escape');await returned('#menu','menu dialog returns to persistent menu button')
  await page.locator('#direct').click();await page.getByRole('combobox').click();await page.getByRole('listbox').waitFor();await page.keyboard.press('Escape');check(await page.getByRole('dialog',{name:'普通弹窗',exact:true}).isVisible(),`${width} select Escape leaves parent dialog open`);check(await page.getByRole('combobox').evaluate(e=>e===document.activeElement),`${width} select restores focus inside parent`)
  await page.locator('#nested').click();await page.getByRole('dialog',{name:'内层弹窗',exact:true}).waitFor();await page.waitForTimeout(80);await page.keyboard.press('Escape');await page.waitForTimeout(60);check(await page.locator('#nested').evaluate(e=>e===document.activeElement),`${width} nested dialog returns to parent button`);await page.keyboard.press('Escape');await returned('#direct','parent dialog returns to page button')
  await page.locator('#custom').click();await page.getByRole('dialog',{name:'自定义弹窗',exact:true}).waitFor();await page.keyboard.press('Escape');await returned('#override','explicit focus callback takes precedence')
  await page.locator('#native').click();await page.getByRole('dialog',{name:'原生弹窗',exact:true}).waitFor();await page.keyboard.press('Escape');await returned('#native','native trigger contract stays intact')
  await page.locator('#disabled').click();await page.getByRole('dialog',{name:'普通弹窗',exact:true}).waitFor();await page.keyboard.press('Escape');await page.waitForTimeout(60);check(!await page.locator('#disabled').evaluate(e=>e===document.activeElement),`${width} disabled opener is not focused`)
  await page.close()
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',checks:checks.length,errors}))
}finally{await browser.close()}
