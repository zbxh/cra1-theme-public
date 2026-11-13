/** Verify real presentation consumers without accounts or business requests. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const member = path.join(root, 'cra1-theme/source/member')
const requireMember = createRequire(path.join(member, 'package.json'))
const { build } = requireMember('esbuild')
const engines = process.env.CRA1_PLAYWRIGHT_MODULE
  ? await import(process.env.CRA1_PLAYWRIGHT_MODULE)
  : createRequire(new URL('../scripts/package.json', import.meta.url))('playwright')
const engine = process.env.CRA1_UI_ENGINE || 'chromium'
const checks = []
const check = (passed, label) => { assert.ok(passed, label); checks.push(label) }
const fixture = `
import React from 'react'
import {createRoot} from 'react-dom/client'
import {RegisterAuthLayout} from '${member}/src/pages/authLayout.jsx'
import {Button} from '${member}/src/ui/button.jsx'
const root=createRoot(document.getElementById('app'))
window.buttonClicks=0
let revision=0
window.renderAuth=(runtime)=>{
 window.__CRA1_RUNTIME__=runtime
 root.render(<RegisterAuthLayout key={++revision} kind="login"><Button id="vnc" data-cui-effects="none" onClick={()=>window.buttonClicks++}>VNC 控制台</Button><Button id="ordinary">普通操作</Button></RegisterAuthLayout>)
}
`
const built = await build({
  stdin: { contents: fixture, resolveDir: member, sourcefile: 'ui-brand-fixture.jsx', loader: 'jsx' },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, logLevel: 'silent',
})
const browser = await engines[engine].launch(engine === 'chromium' ? {args:['--no-sandbox','--no-proxy-server']} : {})
try {
  const page = await browser.newPage({viewport:{width:1280,height:960}})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent('<div id="app"></div>')
  await page.addScriptTag({content:built.outputFiles[0].text})
  const brandCases = [
    [{logo:'/merchant.svg'}, {official_website_logo:'/website.svg',system_logo:'/system.png'}, '/merchant.svg', 'explicit merchant auth logo has first priority'],
    [{logo:''}, {official_website_logo:'/website.svg',system_logo:'/system.png'}, '/website.svg', 'empty auth logo falls back to the website brand asset'],
    [{logo:''}, {official_website_logo:'',system_logo:'/system.png'}, '/system.png', 'system logo remains the final fallback'],
  ]
  for (const [auth,common,expected,label] of brandCases) {
    await page.evaluate(({auth,common}) => window.renderAuth({page:'login',auth_appearance:auth,common}), {auth,common})
    await page.waitForFunction(expected => document.querySelector('.cra1-auth-logo img')?.getAttribute('src') === expected, expected)
    check(await page.locator('.cra1-auth-logo img').getAttribute('src') === expected, label)
  }
  check(await page.locator('#vnc').getAttribute('data-cui-effects') === 'none' && await page.locator('#vnc .cui-button-glow').count() === 0, 'VNC remains an ordinary button without new decoration')
  await page.locator('#vnc').click()
  check(await page.evaluate(() => window.buttonClicks) === 1, 'VNC opt-out preserves its single business click')
  check(await page.locator('#ordinary .cui-button-glow').count() === 1, 'normal primary buttons retain the shared decorative consumer')

  const css = fs.readFileSync(path.join(root,'public/cra1-shared/src/user-panel.css'),'utf8')
  await page.setContent(`<style>${css}</style><div id="account"></div>`)
  await page.evaluate(() => {
    window.CRA1Shared = {UI:{createPopover:()=>({destroy(){}})},Avatar:{register(){},style:()=>({}),letter:()=> 'T'},Runtime:{context:()=>({features:{}}),money:String}}
  })
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'public/cra1-shared/src/header-actions.js'),'utf8')})
  await page.evaluate(() => {
    window.account=CRA1Shared.HeaderActions.mountAccount(document.querySelector('#account'),{user:{id:1}})
    document.querySelector('.cra1-account__menu').hidden=false
  })
  const consoleLink=page.locator('.cra1-upanel__tag--console')
  check(await consoleLink.getAttribute('href') === '/home.htm' && await consoleLink.getAttribute('data-cui-effects') === 'none', 'account console preserves its original route and excludes shared effects')
  check(await consoleLink.locator(':scope > .cra1-upanel__tag-fog[aria-hidden=true]').count() === 1 && await consoleLink.innerText() === '控制台', 'account console restores one noninteractive fog layer and its original label')
  check(await consoleLink.locator('.cra1-upanel__tag-fog').evaluate(el => getComputedStyle(el).animationName === 'cra1-upanel-fog' && getComputedStyle(el).backgroundImage.includes('radial-gradient')), 'account console uses its original colored fog instead of the new spectrum')
  await page.emulateMedia({reducedMotion:'reduce'})
  check(await consoleLink.locator('.cra1-upanel__tag-fog').evaluate(el => getComputedStyle(el).animationName === 'none'), 'original fog respects reduced motion')
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.evaluate(() => {document.querySelector('.cra1-account__menu').hidden=true})
  check(await consoleLink.locator('.cra1-upanel__tag-fog').evaluate(el => getComputedStyle(el).animationPlayState === 'paused'), 'hidden account menu pauses the original fog')
  await page.evaluate(() => {document.querySelector('.cra1-account__menu').hidden=false;document.documentElement.setAttribute('data-cui-effects-paused','')})
  check(await consoleLink.locator('.cra1-upanel__tag-fog').evaluate(el => getComputedStyle(el).animationPlayState === 'paused'), 'background visibility pause covers the original fog')
  check(errors.length === 0, 'real auth and account consumers produce no browser errors')
  console.log(JSON.stringify({engine,status:'passed',checks},null,2))
} finally { await browser.close() }
