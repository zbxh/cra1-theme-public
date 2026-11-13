// Isolated component contracts. No site requests, credentials, or business writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const admin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(admin, '../../..')
const output = process.env.CRA1_ADMIN_UI_TEST_OUT
if (!output) throw new Error('Set CRA1_ADMIN_UI_TEST_OUT to a disposable output directory.')
fs.mkdirSync(output, { recursive: true })
const require = createRequire(path.join(admin, 'package.json'))
const { compile } = require('@tailwindcss/node')
const { Scanner } = require('@tailwindcss/oxide')
const { chromium, firefox, webkit } = process.env.CRA1_BROWSER_RUNTIME ? require(path.resolve(process.env.CRA1_BROWSER_RUNTIME)) : createRequire(path.join(root, 'cra1-theme/scripts/package.json'))('playwright')
const ui = path.join(admin, 'src/components/ui')
const entry = path.join(output, 'components-entry.jsx')
fs.writeFileSync(entry, `import React,{useState,useRef} from 'react';import{createRoot}from'react-dom/client';
import{Button}from${JSON.stringify(path.join(ui, 'button.jsx'))};import{Input,Select}from${JSON.stringify(path.join(ui, 'input.jsx'))};
import{Dialog,DialogContent,DialogHeader,DialogTitle}from${JSON.stringify(path.join(ui, 'dialog.jsx'))};
import{DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem}from${JSON.stringify(path.join(ui, 'dropdown-menu.jsx'))};
import{Tabs,TabsList,TabsTrigger,TabsContent}from${JSON.stringify(path.join(ui, 'tabs.jsx'))};
import${JSON.stringify(path.join(root, 'public/cra1-shared/src/ui-effects.js'))};
function App(){const[v,set]=useState(''),[changes,count]=useState(0),[clicks,click]=useState(0),[open,toggle]=useState(false),native=useRef();return <main style={{padding:20,maxWidth:900,margin:'auto'}}>
<h1>组件交互</h1><div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'20px 0'}}><Button id="primary" onClick={()=>click(x=>x+1)}>保存内容</Button><Button variant="outline" id="outline">查看帮助</Button><Button variant="outline" asChild><a id="link-button" href="#help">访问前台</a></Button><Button variant="danger" id="danger">删除</Button><Button disabled id="disabled">正在保存</Button></div><output id="clicks">{clicks}</output>
<form id="fixture-form" onSubmit={e=>e.preventDefault()}><label htmlFor="fixture-select">文章分类</label><Select id="fixture-select" aria-label="文章分类" name="category" required value={v} onChange={e=>{set(e.target.value);count(n=>n+1)}}><option value="">请选择</option><optgroup label="文章"><option value="news">新闻</option><option value="disabled" disabled>停用分类</option><option value="help">帮助</option></optgroup></Select><output id="changes">{changes}</output><Input aria-label="文章标题" placeholder="输入标题"/><Button type="submit" id="submit">提交</Button></form>
<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" id="menu-trigger">更多操作</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem id="menu-item">查看内容</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
<Button variant="outline" id="open-dialog" onClick={()=>toggle(true)}>打开弹窗</Button><Dialog open={open} onOpenChange={toggle}><DialogContent><DialogHeader><DialogTitle>编辑内容</DialogTitle></DialogHeader><Select aria-label="弹窗分类" defaultValue="news"><option value="news">新闻</option><option value="help">帮助</option></Select></DialogContent></Dialog>
<Button variant="outline" id="open-native" onClick={()=>native.current.showModal()}>打开图标面板</Button><dialog ref={native} id="native-dialog" style={{padding:24,width:'min(90vw,400px)',borderRadius:8}}><h2>图标选择</h2><Select aria-label="图标分类"><option value="a">常用图标</option><option value="b">服务图标</option></Select><Button id="close-native" onClick={()=>native.current.close()}>完成</Button></dialog>
<Tabs defaultValue="a"><TabsList><TabsTrigger value="a">官网</TabsTrigger><TabsTrigger value="b">会员中心</TabsTrigger></TabsList><TabsContent value="a">官网设置</TabsContent><TabsContent value="b">会员设置</TabsContent></Tabs>
<Select aria-label="多选原生" name="multiple" multiple defaultValue={['a']}><option value="a">分类一</option><option value="b">分类二</option></Select>
<Select aria-label="选择公共设置" className="mobile-block-picker" defaultValue="menu"><optgroup label="公共设置"><option value="menu">菜单</option><option value="notice">通知</option></optgroup></Select>
</main>};createRoot(document.getElementById('root')).render(<App/>);window.CRA1Shared.UIEffects.start();`)
require('esbuild').buildSync({ entryPoints: [entry], outfile: path.join(output, 'components.js'), bundle: true, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' }, nodePaths: [path.join(admin, 'node_modules')], alias: { '@ui': ui }, logLevel: 'silent' })
const css = fs.readFileSync(path.join(admin, 'src/app.css'), 'utf8') + '\n' + fs.readFileSync(path.join(ui, 'select.css'), 'utf8')
const compiler = await compile(css, { base: path.join(admin, 'src'), from: path.join(admin, 'src/app.css'), onDependency() {} })
const scanner = new Scanner({ sources: [...compiler.sources, { base: output, pattern: 'components-entry.jsx', negated: false }] })
fs.writeFileSync(path.join(output, 'components.css'), compiler.build(scanner.scan()))
const server = http.createServer((request, response) => {
  const file = request.url === '/components.js' ? 'components.js' : request.url === '/components.css' ? 'components.css' : null
  response.setHeader('Content-Type', file?.endsWith('.js') ? 'text/javascript' : file ? 'text/css' : 'text/html; charset=utf-8')
  response.end(file ? fs.readFileSync(path.join(output, file)) : '<!doctype html><html lang="zh-CN" data-cra1-ui="admin"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/components.css"><div id="root"></div><script src="/components.js"></script></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const checks = [], errors = []
function check(condition, name) { assert.ok(condition, name); checks.push(name) }
try {
  for (const [engine, type] of Object.entries({ chromium, firefox, webkit }).filter(([name]) => !process.env.CRA1_BROWSER_ENGINES || process.env.CRA1_BROWSER_ENGINES.split(',').includes(name))) {
    const browser = await type.launch({ headless: true, ...(engine === 'chromium' && process.env.CRA1_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CRA1_CHROMIUM_EXECUTABLE } : {}) })
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
      page.on('pageerror', error => errors.push(`${engine}: ${error.message}`))
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.locator('#primary.cui-rainbow').waitFor()
      const radius = selector => page.locator(selector).evaluate(node => getComputedStyle(node).borderRadius)
      check(await radius('#primary') === '4px', `${engine}: button radius 4px`)
      check(await page.locator('#link-button').evaluate(node => node.tagName === 'A' && !node.closest('button')), `${engine}: asChild keeps semantic link`)
      check(await radius('#fixture-select') === '4px', `${engine}: input radius 4px`)
      check(await page.locator('#danger').evaluate(node => !node.classList.contains('cui-rainbow')), `${engine}: danger has no decorative effect`)
      check(await page.locator('#disabled').evaluate(node => !node.classList.contains('cui-rainbow')), `${engine}: disabled has no decorative effect`)
      await page.locator('#primary').click()
      check(await page.locator('#clicks').textContent() === '1', `${engine}: business click once`)
      await page.locator('.cui-ripple-clip').waitFor({ state: 'detached', timeout: 3000 })
      check(await page.locator('.cui-ripple-clip').count() === 0, `${engine}: ripple cleaned up`)
      check(await page.locator('#fixture-form').evaluate(form => !form.checkValidity()), `${engine}: required select blocks empty form`)
      await page.locator('#fixture-select').click()
      await page.getByRole('option', { name: '新闻', exact: true }).waitFor()
      check(await radius('.admin-menu-select__popup') === '6px', `${engine}: portal radius 6px`)
      check(await radius('.admin-menu-select__option[data-highlighted]') === '4px', `${engine}: option radius 4px`)
      check(await page.locator('.admin-menu-select__group').textContent() === '文章', `${engine}: group labels retained`)
      await page.getByRole('option', { name: '新闻', exact: true }).click()
      check(await page.locator('#changes').textContent() === '1', `${engine}: selection calls onChange once`)
      check(await page.locator('#fixture-form').evaluate(form => new FormData(form).get('category')) === 'news', `${engine}: form value is original unencoded value`)
      check(await page.locator('#fixture-form').evaluate(form => form.checkValidity()), `${engine}: selected required value validates`)
      await page.locator('#fixture-select').click()
      await page.locator('.admin-menu-select__option[data-state=checked][data-highlighted]').waitFor()
      await page.keyboard.press('ArrowDown')
      await page.locator('.admin-menu-select__option[data-highlighted]').filter({ hasText: '帮助' }).waitFor()
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.getElementById('changes').textContent === '2')
      check(await page.locator('#changes').textContent() === '2', `${engine}: keyboard skips disabled option and changes once`)
      check(await page.locator('#fixture-form').evaluate(form => new FormData(form).get('category')) === 'help', `${engine}: keyboard preserves correct value`)
      await page.locator('#menu-trigger').click()
      await page.locator('#menu-item').waitFor()
      check(await radius('[role=menu]') === '6px', `${engine}: dropdown matches select popup`)
      await page.keyboard.press('Escape')
      await page.locator('#open-dialog').click()
      check(await radius('[role=dialog]') === '8px', `${engine}: dialog radius 8px`)
      await page.getByRole('combobox', { name: '弹窗分类' }).click()
      await page.getByRole('option', { name: '帮助', exact: true }).click()
      await page.locator('.admin-menu-select__popup').waitFor({ state: 'hidden' })
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '弹窗分类')
      await page.keyboard.press('Escape')
      await page.locator('[role=dialog]').waitFor({ state: 'hidden' })
      await page.waitForFunction(() => document.activeElement === document.getElementById('open-dialog'))
      check(await page.locator('#open-dialog').evaluate(node => document.activeElement === node), `${engine}: closing dialog restores trigger focus`)
      await page.locator('#open-native').click()
      await page.getByRole('combobox', { name: '图标分类' }).click()
      check(await page.locator('#native-dialog .admin-menu-select__popup').count() === 1, `${engine}: select popup stays in native top layer`)
      await page.getByRole('option', { name: '服务图标', exact: true }).click()
      await page.locator('#close-native').click()
      check(await page.locator('select[multiple]').count() === 1, `${engine}: explicit multiple listbox remains native`)
      check(await page.getByRole('combobox', { name: '选择公共设置', includeHidden: true }).evaluate(node => getComputedStyle(node).display === 'none'), `${engine}: mobile picker stays hidden on desktop`)
      await page.screenshot({ path: path.join(output, `admin-components-${engine}-1440.png`), fullPage: true })
      await page.setViewportSize({ width: 320, height: 900 })
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${engine}: no mobile overflow`)
      check(await page.getByRole('combobox', { name: '选择公共设置' }).evaluate(node => {
        const text = node.querySelector('.admin-menu-select__value').getBoundingClientRect()
        const icon = node.querySelector('.admin-menu-select__chevron').getBoundingClientRect()
        return getComputedStyle(node).display === 'flex' && node.getBoundingClientRect().height === 44 && Math.abs(text.y + text.height / 2 - icon.y - icon.height / 2) < 2
      }), `${engine}: mobile picker has a single row and 44px touch height`)
      await page.getByRole('combobox', { name: '选择公共设置' }).click()
      await page.getByRole('option', { name: '通知', exact: true }).click()
      check(await page.getByRole('combobox', { name: '选择公共设置' }).textContent() === '通知', `${engine}: mobile picker keeps grouped choices usable`)
      await page.screenshot({ path: path.join(output, `admin-components-${engine}-320.png`), fullPage: true })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      check(await page.locator('#primary').evaluate(node => getComputedStyle(node).animationName === 'none'), `${engine}: reduced motion disables button animation`)
      await page.close()
      fs.writeFileSync(path.join(output, `report-${engine}.json`), JSON.stringify({ checks: checks.filter(name => name.startsWith(`${engine}:`)), errors: errors.filter(message => message.startsWith(`${engine}:`)) }, null, 2))
    } finally { await browser.close() }
  }
  check(errors.length === 0, 'all engines: no browser errors')
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ checks, errors }, null, 2))
  console.log(`${checks.length} component checks passed (${process.env.CRA1_BROWSER_ENGINES || 'chromium,firefox,webkit'}).`)
} finally { await new Promise(resolve => server.close(resolve)) }
