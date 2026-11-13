/** Exercise actual fallback declarations by simulating unsupported CSS features. */
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const engines=process.env.CRA1_PLAYWRIGHT_MODULE?await import(process.env.CRA1_PLAYWRIGHT_MODULE):createRequire(new URL('../scripts/package.json',import.meta.url))('playwright')
const engine=process.env.CRA1_UI_ENGINE||'chromium'
const browser=await engines[engine].launch(engine==='chromium'?{args:['--no-sandbox','--no-proxy-server']}:engine==='firefox'?{firefoxUserPrefs:{'ui.primaryPointerCapabilities':6,'ui.allPointerCapabilities':6}}:{})
const dir=new URL('../../public/cra1-shared/src/',import.meta.url)
const read=name=>fs.readFileSync(new URL(name,dir),'utf8')
const report={engine,checks:[],errors:[]},check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label)}
try {
 const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>report.errors.push(e.message))
 const styles=['tokens.css','components.css','adapters.css'].map(read).join('\n')
 const effects=read('ui-effects.css')
 const unsupportedMotion=effects.replace('@supports not ((offset-path:rect(0px auto auto 0px round 4px)) and (mask-composite:exclude))','@supports (display:block)')
 assert.notEqual(unsupportedMotion,effects,'feature simulation must replace the actual fallback guard')
 await page.setContent(`<html data-cra1-theme="website"><style>${styles}\n${unsupportedMotion}</style><article id="card" class="cui-card cui-edge-card cui-edge-host cui-edge-active" data-selected="true" style="width:300px;padding:20px">已选卡片<span class="cui-edge-segment" aria-hidden="true"></span></article><button id="button" class="cui-button cui-rainbow">按钮</button></html>`)
 check(await page.locator('#card .cui-edge-segment').evaluate(el=>getComputedStyle(el).display==='none'),'unsupported motion-path/mask fallback wins over the active-card rule')
 check(await page.locator('#card').evaluate(el=>el.dataset.selected==='true'&&getComputedStyle(el).borderTopStyle==='solid'&&parseFloat(getComputedStyle(el).borderTopWidth)===1),'unsupported decoration retains the original selected card and ordinary border')
 check(await page.locator('#button').evaluate(el=>getComputedStyle(el).backgroundImage.includes('linear-gradient')&&getComputedStyle(el).animationName==='cui-button-pan'),'unsupported card decoration does not disable independent button styling')
 const unregistered=effects.replace(/@property --cui-field-edge-angle\s*\{[^}]*\}/,'')
 assert.notEqual(unregistered,effects,'feature simulation must remove the actual registration')
 await page.setContent(`<html data-cra1-theme="website"><style>${styles}\n${unregistered}</style><input id="field" class="cui-input" value="字段内容" style="width:300px"></html>`)
 await page.locator('#field').hover();await page.locator('#field').evaluate(el=>{el.getAnimations().forEach(animation=>{animation.pause();animation.currentTime=0})})
 check(await page.locator('#field').evaluate(el=>{const s=getComputedStyle(el);return s.backgroundImage.includes('conic-gradient')&&s.backgroundImage.includes('linear-gradient')&&s.borderColor==='rgba(0, 0, 0, 0)'&&el.value==='字段内容'}),'missing @property initial value still paints the field face, edge segment and normal border backing')
 await page.locator('#field').focus();check(await page.locator('#field').evaluate(el=>{const s=getComputedStyle(el);return s.backgroundImage==='none'&&s.borderColor!=='rgba(0, 0, 0, 0)'&&s.outlineStyle==='solid'}),'unregistered-angle fallback retains the normal keyboard focus treatment')
 check(report.errors.length===0,'no browser errors')
 console.log(JSON.stringify(report,null,2))
} finally {await browser.close()}
