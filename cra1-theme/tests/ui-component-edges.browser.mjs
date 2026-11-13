/** Render the real React controls without a site, account or business request. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const member = path.join(root, 'cra1-theme/source/member')
const admin = path.join(root, 'cra1-theme/source/admin')
const requireMember = createRequire(path.join(member, 'package.json'))
const { build } = requireMember('esbuild')
const engines = process.env.CRA1_PLAYWRIGHT_MODULE
  ? await import(process.env.CRA1_PLAYWRIGHT_MODULE)
  : createRequire(new URL('../scripts/package.json', import.meta.url))('playwright')
const engine = process.env.CRA1_UI_ENGINE || 'chromium'
const checks = []
const check = (passed, label) => { assert.ok(passed, label); checks.push(label) }

const fixture = `
import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Card as MemberCard} from '${member}/src/ui/card.jsx'
import {ChoiceButton} from '${member}/src/ui/choice.jsx'
import {Tabs as MemberTabs, TabsList as MemberTabsList, TabsTrigger as MemberTabsTrigger} from '${member}/src/ui/tabs.jsx'
import {Select as MemberSelect} from '${member}/src/ui/select.jsx'
import {Card as AdminCard} from '${admin}/src/components/ui/card.jsx'
import {Tabs as AdminTabs, TabsList as AdminTabsList, TabsTrigger as AdminTabsTrigger} from '${admin}/src/components/ui/tabs.jsx'
import {MenuSelect as AdminSelect} from '${admin}/src/components/ui/select.jsx'
import {MultiChoice} from '${admin}/src/components/MenuChoices.jsx'
function App(){
 const [choice,setChoice]=useState(false),[multi,setMulti]=useState(['a'])
 const [memberValue,setMemberValue]=useState('a'),[adminValue,setAdminValue]=useState('a')
 const change=(kind,setValue)=>(event)=>{window.changes[kind]++;setValue(event.target.value)}
 return <main>
  <MemberCard id="member-plain">普通会员卡</MemberCard>
  <MemberCard id="member-featured" variant="featured">重点会员卡</MemberCard>
  <AdminCard id="admin-plain">普通后台卡</AdminCard>
  <AdminCard id="admin-featured" glow>重点后台卡</AdminCard>
  <ChoiceButton id="choice" selected={choice} onClick={()=>{window.changes.choice++;setChoice(!choice)}}>选项</ChoiceButton>
  <MemberTabs defaultValue="one"><MemberTabsList aria-label="会员标签"><MemberTabsTrigger value="one">会员标签一</MemberTabsTrigger><MemberTabsTrigger value="two">会员标签二</MemberTabsTrigger></MemberTabsList></MemberTabs>
  <AdminTabs defaultValue="one"><AdminTabsList aria-label="后台标签"><AdminTabsTrigger value="one">后台标签一</AdminTabsTrigger><AdminTabsTrigger value="two">后台标签二</AdminTabsTrigger></AdminTabsList></AdminTabs>
  <form id="member-form"><MemberSelect aria-label="会员下拉" name="plan" value={memberValue} onChange={change('member',setMemberValue)}><option value="a">方案甲</option><option value="b">方案乙</option></MemberSelect></form>
  <form id="admin-form"><AdminSelect aria-label="后台下拉" name="plan" value={adminValue} onChange={change('admin',setAdminValue)}><option value="a">后台甲</option><option value="b">后台乙</option></AdminSelect></form>
  <MultiChoice label="菜单范围" options={[{label:'范围甲',value:'a'},{label:'范围乙',value:'b'}]} value={multi} onChange={next=>{window.changes.multi++;setMulti(next)}}/>
 </main>
}
window.changes={member:0,admin:0,choice:0,multi:0}
createRoot(document.getElementById('app')).render(<App/>)
`
const built = await build({
  stdin: { contents: fixture, resolveDir: member, sourcefile: 'ui-component-fixture.jsx', loader: 'jsx' },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  alias: { '@': path.join(admin, 'src'), '@ui': path.join(admin, 'src/components/ui'), react: path.join(member, 'node_modules/react'), 'react-dom': path.join(member, 'node_modules/react-dom') },
  loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, logLevel: 'silent',
})
const browser = await engines[engine].launch(engine === 'chromium' ? {args:['--no-sandbox','--no-proxy-server']} : {})
try {
  const page = await browser.newPage({viewport:{width:1280,height:960}})
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const css = ['public/cra1-shared/src/tokens.css', 'public/cra1-shared/src/components.css', 'cra1-theme/source/admin/src/components/ui/select.css'].map(file => fs.readFileSync(path.join(root,file),'utf8')).join('\n')
  await page.setContent(`<style>${css}\nbody{margin:24px}main{display:grid;gap:18px}.cui-card,.admin-card{padding:16px}.choice-grid{display:flex;gap:12px}</style><div id="app"></div>`)
  await page.addScriptTag({content:built.outputFiles[0].text})
  await page.locator('#choice').waitFor().catch(error => { throw new Error(errors.join('\n') || error.message) })
  check(await page.locator('#member-plain,#admin-plain').evaluateAll(items => items.every(el => !el.hasAttribute('data-cui-edge') && !el.querySelector('.cui-edge-segment'))), 'ordinary cards have no perimeter opt-in or decoration')
  check(await page.locator('#member-featured,#admin-featured').evaluateAll(items => items.every(el => el.dataset.cuiEdge === 'hover' && el.querySelectorAll(':scope > .cui-edge-segment').length === 1 && !el.classList.contains('cui-edge-active'))), 'featured cards opt into hover without default activation')
  await page.locator('#choice').click()
  check(await page.locator('#choice').getAttribute('aria-pressed') === 'true' && await page.locator('#choice').getAttribute('data-selected') === 'true' && await page.evaluate(() => window.changes.choice) === 1, 'choice preserves real selected state and a single click event')
  for (const label of ['会员标签二','后台标签二']) {
    await page.getByRole('tab',{name:label}).click()
    check(await page.getByRole('tab',{name:label}).getAttribute('aria-selected') === 'true', `${label} keeps its Radix selected state`)
  }
  await page.locator('.choice-chip').filter({hasText:'范围乙'}).locator('input').check()
  check(await page.locator('.choice-chip').filter({hasText:'范围甲'}).locator('input').isChecked() && await page.locator('.choice-chip').filter({hasText:'范围乙'}).locator('input').isChecked() && await page.evaluate(() => window.changes.multi) === 1, 'menu checkbox choices preserve existing selections and a single change')
  for (const [kind,label,option,value] of [['member','会员下拉','方案乙','b'],['admin','后台下拉','后台乙','b']]) {
    await page.getByRole('combobox',{name:label}).click()
    check(await page.getByRole('option').evaluateAll(items => items.length === 2 && items.every(el => !el.hasAttribute('data-cui-edge') && !el.querySelector('.cui-edge-segment'))), `${kind} portal options have no obsolete perimeter markup`)
    await page.getByRole('option',{name:option,exact:true}).click()
    check(await page.locator(`#${kind}-form select[name="plan"]`).inputValue() === value && await page.evaluate(kind => window.changes[kind],kind) === 1, `${kind} select preserves its raw form value and one change`)
    await page.keyboard.press('Escape')
  }
  check(await page.locator('button,[role=tab],[role=option],.choice-chip').evaluateAll(items => items.every(el => !el.hasAttribute('data-cui-edge') && !el.querySelector('.cui-edge-segment'))), 'buttons, tabs and small choices contain no perimeter-only markup')
  check(errors.length === 0, 'real React components produce no browser errors')
  console.log(JSON.stringify({engine,status:'passed',checks},null,2))
} finally { await browser.close() }
