/** Isolated customer interaction contracts; no external writes or GitHub publication. */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.env.CRA1_ONLINE_BROWSER_OUT
if(!out||!process.env.CRA1_ADMIN_ASSETS)throw Error('Set isolated browser output and staged administrator assets')
fs.mkdirSync(out,{recursive:true})
const require=createRequire(root+'/cra1-theme/scripts/package.json'),{chromium}=require('playwright')
const build=createRequire(root+'/cra1-theme/source/admin/package.json')('esbuild').buildSync
const entry=path.join(out,'fixture.jsx'),bundle=path.join(out,'fixture.js')
fs.writeFileSync(entry,`import React from ${JSON.stringify(root+'/cra1-theme/source/admin/node_modules/react/index.js')};import{createRoot}from ${JSON.stringify(root+'/cra1-theme/source/admin/node_modules/react-dom/client.js')};import ThemeManagement from ${JSON.stringify(root+'/cra1-theme/source/admin/src/pages/ThemeManagement.jsx')};const app=createRoot(document.getElementById('root'));window.fixtureUnmount=()=>app.unmount();app.render(<ThemeManagement/>);`)
build({entryPoints:[entry],outfile:bundle,bundle:true,format:'iife',jsx:'automatic',nodePaths:[root+'/cra1-theme/source/admin/node_modules'],alias:{'@ui':root+'/cra1-theme/source/admin/src/components/ui'},logLevel:'silent'})
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://fixture.invalid')
 if(u.pathname==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(bundle));return}
 if(u.pathname==='/fixture.css'){res.setHeader('Content-Type','text/css');res.end(fs.readFileSync(path.join(process.env.CRA1_ADMIN_ASSETS,'admin.css')));return}
 if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root" class="p-4"></div><script>window.__CRA1_ADMIN__={role:new URLSearchParams(location.search).get('role')||'super_admin',base:'/index.php',csrf:'isolated-online-csrf'};</script><script src="/fixture.js"></script>`);return}
 res.writeHead(404);res.end('Fixture only')
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const report={status:'running',checks:[],errors:[]},check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label)}
const release={version:'v17.6.4',release_channel:'test',bytes:9137691,published_at:'2026-11-07T00:00:00Z',release_url:'https://github.com/zbxh/cra1-theme-public/releases/tag/v17.6.4',notes:'安装、菜单和结算优化\n<img src=x onerror="window.noticeXss=true">'}
async function fixture(width=1440,role='super_admin'){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),state={mode:'ready',current:'v17.6.3',calls:[],apply:0,download:0,confirm:true,releaseDownload:null,prefix:'',settingsFail:false}
 page.on('pageerror',e=>report.errors.push(e.message));page.on('dialog',d=>state.confirm?d.accept():d.dismiss())
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url())
  if(u.origin!==origin)return route.abort()
  if(u.pathname!=='/index.php')return route.continue()
  const action=u.searchParams.get('r'),body=request.postDataJSON()||{}
  assert.equal(request.headers()['x-csrf-token'],'isolated-online-csrf')
  state.calls.push({action,body});let data
  if(action==='api.release.online.settings.get'){assert.equal(role,'super_admin');data={github_prefix:state.prefix}}
  else if(action==='api.release.online.settings.save'){
   assert.equal(role,'super_admin')
   if(state.settingsFail)return route.fulfill({json:{status:400,msg:'加速设置保存失败，请重试'}})
   state.prefix=body.github_prefix.trim();if(state.prefix&&!state.prefix.endsWith('/'))state.prefix+='/'
   data={github_prefix:state.prefix}
  }
  else if(action==='api.release.check')data={version:state.current,release:'fixture-release',release_channel:'test',context:{system_version:'10.7.4'},checks:[],counts:{pass:0}}
  else if(action==='api.release.history')data={current:{version:state.current,release:'fixture-release',release_channel:'test'},history:[]}
  else if(action==='api.release.online.check'){
   if(state.mode==='network')return route.fulfill({json:{status:400,msg:'连接 GitHub 超时，请重试或手动上传安装包'}})
   data={current_version:state.current,include_test:body.include_test,latest:body.include_test?release:null,update_available:body.include_test&&state.current!=='v17.6.4'}
  }else if(action==='api.release.online.download'){
   state.download++
   if(state.mode==='checksum')return route.fulfill({json:{status:400,msg:'安装包下载校验未通过，请重新检查最新版本后重试'}})
   if(state.mode==='hold')await new Promise(resolve=>state.releaseDownload=resolve)
   data={candidate:'fixture-candidate',version:release.version,release_channel:'test',sha256:'fixture-digest',can_apply:state.mode!=='blocked',files:[],blockers:state.mode==='blocked'?['主题目录未允许 PHP 写入']:[]}
  }else if(action==='api.release.apply'){assert.deepEqual(body,{candidate:'fixture-candidate',expectedDigest:'fixture-digest'});state.apply++;state.current='v17.6.4';data={updated:true}}
  else throw Error('Unexpected request '+action)
  return route.fulfill({json:{status:200,data}})
 })
 await page.goto(origin+'/?role='+role,{waitUntil:'networkidle'});await page.getByRole('tab',{name:'安装与更新',exact:true}).click()
 await page.getByRole('button',{name:'检查最新版本',exact:true}).waitFor()
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='检查最新版本').disabled)
 return {context,page,state}
}
try{
 for(const width of[1920,1440,768,390]){
  const {context,page,state}=await fixture(width)
  check(await page.getByRole('checkbox',{name:'包含测试版',exact:true}).isChecked(),'test installations include test releases by default '+width)
  check(await page.getByLabel('GitHub 加速链接前缀',{exact:true}).inputValue()==='','unconfigured installations use direct mode '+width)
  check(state.calls.every(x=>x.action!=='api.release.online.check'),'opening administration does not make an unsolicited remote query '+width)
  await page.getByRole('button',{name:'检查最新版本',exact:true}).click();await page.getByText('发现新版本：v17.6.4（测试版）',{exact:true}).waitFor()
  check(state.calls.filter(x=>x.action==='api.release.online.check').length===1,'manual check issues exactly one query '+width)
  await page.getByText('更新内容',{exact:true}).click()
  check(!await page.locator('img').count()&&!await page.evaluate(()=>window.noticeXss),'release notes are rendered as text '+width)
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'online panel fits '+width)
  await page.screenshot({path:path.join(out,'online-'+width+'.png'),fullPage:true})
  if(width===1440){
   const prefix=page.getByLabel('GitHub 加速链接前缀',{exact:true})
   await prefix.fill('https://proxy.example.test')
   check(!await page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).count(),'editing the connection clears the stale online result')
   await page.getByRole('button',{name:'保存加速设置',exact:true}).click();await page.getByText('GitHub 加速设置已保存。',{exact:true}).waitFor()
   check(await prefix.inputValue()==='https://proxy.example.test/'&&state.prefix==='https://proxy.example.test/','settings save uses the server-normalized prefix')
   await page.reload({waitUntil:'networkidle'});await page.getByRole('tab',{name:'安装与更新',exact:true}).click();await page.getByRole('button',{name:'检查最新版本',exact:true}).waitFor()
   await page.waitForFunction(()=>!document.getElementById('online-github-prefix').disabled)
   check(await prefix.inputValue()==='https://proxy.example.test/','saved connection is restored after a page reload')
   await prefix.fill('https://unavailable.example.test/');state.settingsFail=true;const queryCount=state.calls.filter(x=>x.action==='api.release.online.check').length
   await page.getByRole('button',{name:'检查最新版本',exact:true}).click();await page.getByText('加速设置保存失败，请重试',{exact:true}).waitFor()
   check(state.calls.filter(x=>x.action==='api.release.online.check').length===queryCount&&state.prefix==='https://proxy.example.test/','failed auto-save does not query with an unintended or unsaved prefix')
   check(!await page.locator('input[type=file]').isDisabled(),'a settings save error leaves manual upload available')
   state.settingsFail=false;await prefix.fill('');const start=state.calls.length
   await page.getByRole('button',{name:'检查最新版本',exact:true}).click();await page.getByText('发现新版本：v17.6.4（测试版）',{exact:true}).waitFor()
   check(state.prefix===''&&state.calls.slice(start).map(x=>x.action).join(',')==='api.release.online.settings.save,api.release.online.check','checking after an edit saves the cleared prefix before requesting direct metadata')
   state.confirm=false;await page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).click();check(state.download===0&&state.apply===0,'cancelling confirmation performs no download or update')
   state.confirm=true;state.mode='checksum';await page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).click();await page.getByText(/安装包下载校验未通过/).waitFor();check(state.apply===0,'failed verification never submits apply')
   state.mode='blocked';await page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).click();await page.getByText('主题目录未允许 PHP 写入',{exact:true}).waitFor();check(state.apply===0,'preflight blocker is visible and prevents automatic update')
   check(await page.getByRole('button',{name:'确认覆盖更新',exact:true}).isDisabled(),'blocked package cannot be applied manually')
   state.mode='hold';const before=state.download;await page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).click();await page.getByText('正在从 GitHub 下载安装包，请稍候…',{exact:true}).waitFor()
   await page.waitForFunction(()=>true);for(let i=0;i<50&&!state.releaseDownload;i++)await page.waitForTimeout(10)
   await page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).evaluate(button=>button.click());check(state.download===before+1&&state.apply===0,'download state blocks duplicate clicks')
   state.releaseDownload();await page.getByText('更新完成，请刷新页面加载对应资源。',{exact:true}).waitFor();check(state.apply===1,'one confirmed click downloads and applies through ordinary updater once')
   await page.getByText('当前版本：v17.6.4（测试版）',{exact:true}).waitFor();check(true,'successful update refreshes the displayed installed version')
   await page.getByRole('button',{name:'检查最新版本',exact:true}).click();await page.getByText('当前已是最新版本',{exact:true}).waitFor();check(!await page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).count(),'current version is not offered for reinstallation')
   await page.getByRole('checkbox',{name:'包含测试版',exact:true}).uncheck();await page.getByRole('button',{name:'检查最新版本',exact:true}).click();await page.getByText('暂无可用版本',{exact:true}).waitFor();check(true,'empty stable channel has an explicit result')
   state.mode='network';await page.getByRole('button',{name:'检查最新版本',exact:true}).click();await page.getByText(/连接 GitHub 超时/).waitFor();check(!await page.locator('input[type=file]').isDisabled(),'network failure leaves manual upload available')
   check(state.calls.every(x=>!JSON.stringify(x.body).includes('password')),'online workflow does not request or transmit a repeated password')
  }
  await context.close()
 }
 const readOnly=await fixture(390,'admin');await readOnly.page.getByRole('button',{name:'检查最新版本',exact:true}).click();await readOnly.page.getByText('发现新版本：v17.6.4（测试版）',{exact:true}).waitFor();check(!await readOnly.page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).count(),'ordinary administrator can check but cannot update');check(!await readOnly.page.getByLabel('GitHub 加速链接前缀',{exact:true}).count()&&!readOnly.state.calls.some(x=>x.action==='api.release.online.settings.get'),'ordinary administrators do not read or edit the private connection setting');await readOnly.context.close()
 const leaving=await fixture();leaving.state.mode='hold';await leaving.page.getByRole('button',{name:'检查最新版本',exact:true}).click();await leaving.page.getByRole('button',{name:'一键更新至 v17.6.4',exact:true}).click();for(let i=0;i<50&&!leaving.state.releaseDownload;i++)await leaving.page.waitForTimeout(10);await leaving.page.evaluate(()=>window.fixtureUnmount());leaving.state.releaseDownload();await leaving.page.waitForTimeout(200);check(leaving.state.apply===0,'leaving before download completes does not start a hidden update');await leaving.context.close()
 check(report.errors.length===0,'online controls produce no unhandled browser exceptions')
 report.status='passed'
}catch(error){report.status='failed';report.error=error.stack;process.exitCode=1}
finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error}))}
