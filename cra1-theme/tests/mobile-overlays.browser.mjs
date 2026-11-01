/** Exercise shipped CSS and real Radix components without business requests. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const root = path.resolve(process.env.CRA1_MOBILE_SOURCE_ROOT || new URL('../..', import.meta.url).pathname)
const stage = process.env.CRA1_MOBILE_STAGE
if (!stage) throw Error('Set CRA1_MOBILE_STAGE to an isolated unified build.')
const release = JSON.parse(fs.readFileSync(path.join(stage, 'release.json'))).release
const { chromium } = createRequire(import.meta.url)(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const checks = [], errors = []
function check(value, label) { assert.ok(value, label); checks.push(label) }
function bundle(area, contents) {
  const base = path.join(root, 'cra1-theme/source', area)
  return createRequire(path.join(base, 'package.json'))('esbuild').buildSync({
    stdin: { loader: 'jsx', sourcefile: 'mobile-fixture.jsx', resolveDir: path.join(base, 'src'), contents },
    bundle: true, format: 'iife', jsx: 'automatic', write: false,
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  }).outputFiles[0].text
}
const admin = bundle('admin', `
 import React,{useState}from'react';import{createRoot}from'react-dom/client';
 import{Sheet,SheetTrigger,SheetContent,SheetTitle}from'./components/ui/sheet';
 import{Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription}from'./components/ui/dialog';
 function App(){const[open,setOpen]=useState(false),[clicks,setClicks]=useState(0);return <>
 <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><button id="sheet">打开菜单</button></SheetTrigger><SheetContent><SheetTitle>手机菜单</SheetTitle><button onClick={()=>setOpen(false)}>切换页面</button></SheetContent></Sheet>
 <button id="after" onClick={()=>setClicks(v=>v+1)}>继续编辑 {clicks}</button>
 <Dialog><DialogTrigger asChild><button id="dialog">打开弹窗</button></DialogTrigger><DialogContent><DialogTitle>编辑设置</DialogTitle><DialogDescription>只读测试</DialogDescription><input placeholder="设置内容"/></DialogContent></Dialog>
 </>};createRoot(document.getElementById('root')).render(<App/>);
`)
const member = bundle('member', `
 import React,{useState}from'react';import{createRoot}from'react-dom/client';
 import{DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem}from'./ui/dropdown-menu';
 function Menu({id,...props}){return <DropdownMenu {...props}><DropdownMenuTrigger id={id}>{id}</DropdownMenuTrigger><DropdownMenuContent align="end" collisionPadding={12}>{Array.from({length:12},(_,i)=><DropdownMenuItem key={i} onSelect={()=>window.selections++}>操作 {i+1}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}
 function App(){const[open,setOpen]=useState(false);return <div style={{padding:16,paddingTop:400,display:'flex',gap:12}}><Menu id="controlled" open={open} onOpenChange={setOpen}/><Menu id="uncontrolled"/></div>};window.selections=0;createRoot(document.getElementById('root')).render(<App/>);
`)
const adminCss = path.join(stage, 'public/cra1admin/assets/releases', release)
const memberCss = path.join(stage, 'public/clientarea/template/pc/cra1/releases', release, 'assets/css')
const sharedCss = path.join(stage, 'public/cra1-shared/releases', release, 'cra1-shared.css')
const styles = folder => fs.readdirSync(folder).filter(n => n.endsWith('.css')).sort().map(n => fs.readFileSync(path.join(folder, n), 'utf8')).join('\n')
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
try {
  for (const motion of ['no-preference', 'reduce']) for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: motion })
    page.setDefaultTimeout(5000)
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => route.abort())
    await page.setContent('<html><head></head><body><div id="root"></div></body></html>')
    await page.addStyleTag({ content: styles(adminCss) })
    await page.addScriptTag({ content: admin })
    for (const action of ['Escape', 'close', 'outside', 'route']) {
      await page.locator('#sheet').click()
      const dialog = page.getByRole('dialog', { name: '手机菜单' })
      await dialog.waitFor()
      await page.waitForTimeout(220)
      if (action === 'Escape') await page.keyboard.press('Escape')
      else if (action === 'close') await dialog.getByRole('button', { name: '关闭', exact: true }).click()
      else if (action === 'route') await dialog.getByRole('button', { name: '切换页面' }).click()
      else await page.mouse.click(width - 8, 500)
      await dialog.waitFor({ state: 'hidden' }).catch(error => { throw Error(`${width}/${motion}/${action}: ${error.message}`) })
      await page.waitForTimeout(250)
      check(await page.locator('[data-state="closed"]').evaluateAll(es => es.every(e => { const r = e.getBoundingClientRect(); return r.width < innerWidth || r.height < innerHeight || getComputedStyle(e).display === 'none' })), `${width}/${motion}/${action}: closed sheet leaves no full-screen overlay`)
      await page.locator('#after').click()
      check(await page.evaluate(() => getComputedStyle(document.body).pointerEvents !== 'none'), `${width}/${motion}/${action}: editor remains clickable`)
    }
    await page.locator('#dialog').click()
    await page.getByRole('dialog', { name: '编辑设置' }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: '编辑设置' }).waitFor({ state: 'hidden' })
    await page.locator('#after').click()
    check(true, `${width}/${motion}: regular admin dialog releases interaction`)
    await page.close()
  }
  for (const motion of ['no-preference', 'reduce']) for (const id of ['controlled', 'uncontrolled']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: motion })
    page.setDefaultTimeout(5000)
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => route.abort())
    await page.setContent('<html data-cra1-theme="member"><head></head><body><div id="root"></div></body></html>')
    await page.addStyleTag({ content: fs.readFileSync(sharedCss, 'utf8') + '\n' + styles(memberCss) })
    await page.addScriptTag({ content: member })
    await page.locator('#' + id).click()
    await page.getByRole('menu').waitFor()
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    check(await page.getByRole('menu').isVisible(), `${id}/${motion}: unchanged viewport leaves menu open`)
    await page.setViewportSize({ width: 320, height: 640 })
    await page.getByRole('menu').waitFor({ state: 'hidden' })
    check(await page.locator('#' + id).getAttribute('aria-expanded') === 'false', `${id}/${motion}: resizing closes stale menu`)
    await page.locator('#' + id).click()
    await page.getByRole('menu').waitFor()
    await page.waitForTimeout(200)
    const bounds = await page.getByRole('menu').evaluate(e => ({ top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom, height: innerHeight }))
    check(bounds.top >= -1 && bounds.bottom <= bounds.height + 1, `${id}/${motion}: reopened menu fits short viewport: ${JSON.stringify(bounds)}`)
    await page.keyboard.press('End')
    check(await page.getByRole('menuitem', { name: '操作 12', exact: true }).evaluate(e => e === document.activeElement), `${id}/${motion}: last operation remains keyboard accessible`)
    await page.keyboard.press('Enter')
    check(await page.evaluate(() => window.selections === 1), `${id}/${motion}: last operation remains selectable`)
    await page.close()
  }
  assert.deepEqual(errors, [], 'no browser exceptions')
  console.log(JSON.stringify({ status: 'passed', checks: checks.length, errors }))
} finally { await browser.close() }
