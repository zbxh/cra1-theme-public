/** Real member controls, isolated reads and a simulated mobile visual viewport. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const member = path.join(root, 'cra1-theme/source/member')
const requireMember = createRequire(path.join(member, 'package.json'))
const { build } = requireMember('esbuild')
const engines = createRequire(new URL('../scripts/package.json', import.meta.url))('playwright')
const engine = process.env.CRA1_UI_ENGINE || 'chromium'
const checks = []
const check = (pass, label) => { assert.ok(pass, label); checks.push(label) }
const fixture = `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{Card,CardContent,CardHeader,CardTitle,PageHeader}from'./ui/card';
import{DataTable}from'./ui/data-table';import{EmptyState}from'./ui/feedback';import{Button}from'./ui/button';
import{Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter}from'./ui/dialog';
import{Sheet,SheetContent,SheetTitle,SheetDescription}from'./ui/sheet';
import{AccessProvider}from'./ui/access';
const title='IPv6-server-instance-with-a-very-long-name-without-any-spaces-01234567890123456789';
window.events={retry:0,next:0,read:0};const root=createRoot(document.getElementById('app'));
function App({model}){const[d,D]=useState(false),[s,S]=useState(false),[a,A]=useState(false);
return <main><PageHeader title={title} description="2001:db8:1234:5678:90ab:cdef:1234:5678" actions={<><Button onClick={()=>D(true)}>打开详情</Button><Button onClick={()=>S(true)}>打开抽屉</Button><Button onClick={()=>A(!a)}>权限状态</Button></>}/>
<Card><CardHeader><CardTitle>读取记录</CardTitle></CardHeader><CardContent className="p-5"><DataTable columns={[{key:'name',title:'名称',width:240},{key:'ip',title:'IP',width:300},{key:'price',title:'金额',width:140}]} rows={model.rows} loading={model.loading} error={model.error} onRetry={()=>window.events.retry++} search="保留查询条件" onSearchChange={()=>{}} filters={<select aria-label="筛选状态" style={{width:120}}><option>全部状态</option></select>} actions={<><Button>复制记录</Button><Button>刷新</Button></>} page={1} total={1234567} limit={10} onPageChange={()=>window.events.next++} empty={<EmptyState title="暂无记录" description="新增记录后会在这里展示。"/>}/></CardContent></Card>
<Card><CardContent className="p-0" id="zero-padding">独立零内边距保留</CardContent></Card>
{a&&<AccessProvider><p>权限读取成功</p></AccessProvider>}
<Dialog open={d} onOpenChange={D}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>2001:db8:1234:5678:90ab:cdef:1234:5678</DialogDescription></DialogHeader>{Array.from({length:12},(_,i)=><label key={i} style={{display:'block',marginBottom:12}}>字段 {i+1}<input className="cui-input" defaultValue={i===0?'用户已填写内容':''}/></label>)}<DialogFooter><Button onClick={()=>D(false)}>取消</Button><Button onClick={()=>{window.events.saved=true}}>保存</Button></DialogFooter></DialogContent></Dialog>
<Sheet open={s} onOpenChange={S}><SheetContent><SheetTitle>长内容抽屉</SheetTitle><SheetDescription>独立滚动区域</SheetDescription>{Array.from({length:18},(_,i)=><p key={i} style={{padding:12}}>内容 {i+1}</p>)}<Button onClick={()=>S(false)}>完成</Button></SheetContent></Sheet>
</main>};window.renderModel=model=>root.render(<App model={model}/>);
`
const built = await build({stdin:{contents:fixture,resolveDir:path.join(member,'src'),sourcefile:'feedback-fixture.jsx',loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},logLevel:'silent'})
let memberCSS
if (process.env.CRA1_MEMBER_FEEDBACK_CSS) memberCSS=fs.readFileSync(process.env.CRA1_MEMBER_FEEDBACK_CSS,'utf8')
else {
  const {compile}=requireMember('@tailwindcss/node'),{Scanner}=requireMember('@tailwindcss/oxide')
  const compiler=await compile(fs.readFileSync(path.join(member,'src/app.css'),'utf8'),{base:path.join(member,'src'),onDependency(){}})
  const scanner=new Scanner({sources:[{base:path.join(member,'src'),pattern:'**/*.{jsx,js}',negated:false}]})
  memberCSS=compiler.build([...scanner.scan(),...scanner.scanFiles([{content:fixture,extension:'jsx'}])])
}
const sharedCSS=['tokens.css','components.css'].map(name=>fs.readFileSync(path.join(root,'public/cra1-shared/src',name),'utf8')).join('\n')
const browser=await engines[engine].launch(engine==='chromium'?{args:['--no-sandbox','--no-proxy-server']}: {})
try {
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'})
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort())
  await page.setContent(`<html data-cra1-theme="member"><head><style>${sharedCSS}\n${memberCSS}\nbody{margin:16px;background:var(--cui-bg);font-family:var(--cui-font)}main{display:grid;gap:16px;min-width:0}.cui-dialog-overlay{position:fixed;inset:0}.cui-sheet{padding:16px;box-sizing:border-box}</style></head><body><div id="app"></div></body></html>`)
  await page.evaluate(()=>{
   const target=new EventTarget(),active=new Map()
   target.height=844;target.offsetTop=0
   const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target)
   target.addEventListener=(type,fn)=>{if(!active.has(type))active.set(type,new Set());active.get(type).add(fn);add(type,fn)}
   target.removeEventListener=(type,fn)=>{active.get(type)?.delete(fn);remove(type,fn)}
   Object.defineProperty(window,'visualViewport',{value:target,configurable:true})
   window.viewportListeners=()=>[...active.values()].reduce((n,set)=>n+set.size,0)
   window.resizeKeyboard=(height,offsetTop)=>{target.height=height;target.offsetTop=offsetTop;target.dispatchEvent(new Event('resize'))}
   window.CRA1Shared={Access:{read(){window.events.read++;return window.events.read===1?Promise.reject(new Error('private error')):Promise.resolve({})}},Request:{}}
  })
  await page.addScriptTag({content:built.outputFiles[0].text})
  const rows=[{id:1,name:'测试实例-'+ 'long-title-'.repeat(8),ip:'2001:db8:1234:5678:90ab:cdef:1234:5678',price:'¥123,456,789.00'}]
  const render=async model=>{await page.evaluate(model=>window.renderModel(model),{rows:[],loading:false,error:'',...model});await page.waitForTimeout(50)}
  await render({rows})
  if(process.env.CRA1_MEMBER_FEEDBACK_DEBUG)console.log(await page.evaluate(()=>[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,overflow:getComputedStyle(e).overflowX,min:getComputedStyle(e).minWidth}))))
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}: long header, toolbar and pager stay inside page`)
  check(await page.locator('.cui-data-table-toolbar').evaluate(e=>e.querySelector('.cui-data-table-search input').getBoundingClientRect().width>=Math.min(200,e.clientWidth)-1),`${width}: search field keeps a readable width before filters wrap`)
  check(await page.getByRole('combobox',{name:'筛选状态'}).evaluate(e=>{const css=getComputedStyle(e),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=css.font;return e.getBoundingClientRect().width-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-24>=ctx.measureText(e.selectedOptions[0].textContent).width}),`${width}: filter text has enough space alongside its arrow`)
  check(await page.locator('.cui-table-shell').evaluate(e=>e.scrollWidth>e.clientWidth)===(width<1000),`${width}: wide records scroll only inside their table`)
  check(await page.locator('#zero-padding').evaluate(e=>getComputedStyle(e).padding)==='0px',`${width}: zero-padding sections stay unchanged`)
  check(await page.locator('.cui-card__content.p-5').evaluate(e=>getComputedStyle(e).paddingLeft)===(width<768?'16px':'20px'),`${width}: standard card spacing adapts without changing desktop`)
  await render({rows,error:'private database failure'})
  check((await page.getByRole('alert').innerText()).includes('上次加载')&&!await page.getByText('暂无记录',{exact:true}).count(),`${width}: failed refresh retains records and never claims empty`)
  await page.getByRole('button',{name:'重新加载',exact:true}).click()
  check(await page.evaluate(()=>window.events.retry)===1,`${width}: retry fires once and preserves search`)
  check(await page.getByRole('textbox',{name:'搜索…'}).inputValue()==='保留查询条件',`${width}: read failure keeps filters`)
  check(!(await page.locator('body').innerText()).includes('private database'),`${width}: internal failure text is not exposed`)
  await render({loading:true})
  check(await page.locator('.cui-data-table').getAttribute('aria-busy')==='true'&&await page.getByRole('status').innerText()==='正在加载记录…',`${width}: loading is announced separately from empty and error`)
  await render({})
  check(await page.getByText('暂无记录',{exact:true}).isVisible()&&await page.getByRole('alert').count()===0,`${width}: successful empty read has its own state`)
  check(await page.locator('.cui-data-table-empty').evaluate(e=>getComputedStyle(e).paddingTop)==='0px',`${width}: custom empty component has no duplicate outer padding`)
  await page.getByRole('button',{name:'权限状态'}).click();await page.getByRole('alert').waitFor()
  check(await page.getByText('权限读取成功',{exact:true}).count()===0,`${width}: denied permission read never renders protected children`)
  await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.getByText('权限读取成功',{exact:true}).waitFor()
  check(await page.evaluate(()=>window.events.read)===2,`${width}: permission read retries without unlocking content before success`)
  await page.getByRole('button',{name:'打开详情'}).click();const dialog=page.getByRole('dialog')
  await dialog.waitFor();await dialog.locator('input').last().evaluate(e=>e.focus({preventScroll:true}))
  const documentScroll=await page.evaluate(()=>scrollY)
  await page.evaluate(()=>window.resizeKeyboard(340,140));await page.waitForTimeout(100)
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  const bounds=await dialog.evaluate(e=>e.getBoundingClientRect().toJSON())
  if(process.env.CRA1_MEMBER_FEEDBACK_DEBUG)console.log({bounds,css:await dialog.evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),offset:e.offsetHeight,translate:getComputedStyle(e).translate,animation:getComputedStyle(e).animation,transition:getComputedStyle(e).transition,top:getComputedStyle(e).top,maxHeight:getComputedStyle(e).maxHeight,height:getComputedStyle(e).height,transform:getComputedStyle(e).transform,style:e.getAttribute('style')}))})
  check(bounds.y>=151&&bounds.y+bounds.height<=469,`${width}: dialog stays inside visible keyboard viewport`)
  const inputBounds=await dialog.locator('input').last().evaluate(e=>e.getBoundingClientRect().toJSON())
  if(process.env.CRA1_MEMBER_FEEDBACK_DEBUG)console.log({inputBounds,scroll:await dialog.evaluate(e=>e.scrollTop)})
  check(inputBounds.y>=bounds.y&&inputBounds.y+inputBounds.height<=bounds.y+bounds.height,`${width}: focused final field remains visible when keyboard changes only visual viewport`)
  check(await page.evaluate(()=>scrollY)===documentScroll,`${width}: keyboard handling does not scroll underlying document`)
  if(process.env.CRA1_MEMBER_FEEDBACK_SCREENSHOTS){fs.mkdirSync(process.env.CRA1_MEMBER_FEEDBACK_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.CRA1_MEMBER_FEEDBACK_SCREENSHOTS,`member-dialog-keyboard-${engine}-${width}.png`),fullPage:true})}
  await dialog.getByRole('button',{name:'保存',exact:true}).scrollIntoViewIfNeeded();await dialog.getByRole('button',{name:'保存',exact:true}).click()
  check(await page.evaluate(()=>window.events.saved)===true,`${width}: long dialog footer remains reachable`)
  check(await dialog.locator('input').first().inputValue()==='用户已填写内容',`${width}: viewport change preserves entered values`)
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
  check(await page.evaluate(()=>window.viewportListeners())===0,`${width}: closed dialog releases viewport listeners`)
  await page.getByRole('button',{name:'打开抽屉'}).click();await dialog.waitFor();await page.waitForTimeout(40)
  const sheetBounds=await dialog.evaluate(e=>e.getBoundingClientRect().toJSON())
  check(sheetBounds.y>=139&&sheetBounds.y+sheetBounds.height<=481,`${width}: sheet fits the same visible viewport`)
  await dialog.getByRole('button',{name:'完成',exact:true}).scrollIntoViewIfNeeded();await dialog.getByRole('button',{name:'完成',exact:true}).click();await dialog.waitFor({state:'hidden'})
  check(await page.evaluate(()=>window.viewportListeners())===0,`${width}: closed sheet releases viewport listeners`)
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.getByRole('button',{name:'打开详情'}).click();await dialog.waitFor();await page.waitForTimeout(40)
  const animatedBounds=await dialog.evaluate(e=>e.getBoundingClientRect().toJSON())
  check(animatedBounds.x>=0&&animatedBounds.x+animatedBounds.width<=width+1&&animatedBounds.y>=140,`${width}: entrance animation preserves centering instead of translating twice`)
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'})
  await page.emulateMedia({reducedMotion:'reduce'})
  check(errors.length===0,`${width}: no React or browser errors`)
  if(process.env.CRA1_MEMBER_FEEDBACK_SCREENSHOTS){fs.mkdirSync(process.env.CRA1_MEMBER_FEEDBACK_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.CRA1_MEMBER_FEEDBACK_SCREENSHOTS,`member-feedback-${engine}-${width}.png`),fullPage:true})}
  await page.close()
 }
 console.log(JSON.stringify({engine,status:'passed',checks},null,2))
} finally {await browser.close()}
