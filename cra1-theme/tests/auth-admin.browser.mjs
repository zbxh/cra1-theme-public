/** Real packaged editor and opaque draft previews; disposable storage only. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import {randomBytes,createHash} from 'node:crypto'
import {spawn,execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.CRA1_PLAYWRIGHT||'playwright')
const install=process.env.CRA1_INSTALL_PACKAGE,out=process.env.CRA1_BROWSER_OUT,native=process.env.CRA1_AUTH_NATIVE,php=process.env.CRA1_PHP||'/www/server/php/74/bin/php'
if(!install||!out||!native)throw new Error('Explicit candidate, output and native read-only fixtures required')
fs.mkdirSync(out,{recursive:true});const root=fs.mkdtempSync(path.join(os.tmpdir(),'cra1-auth-admin-'))
execFileSync('python3',['-c','import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',install,root])
fs.writeFileSync(path.join(root,'config.php'),'<?php // Disposable fixture, no database credentials.\n')
fs.symlinkSync(path.join(native,'vendor'),path.join(root,'vendor'),'dir')
const iconfont=path.join(native,'public/upload/common/iconfont')
if(fs.existsSync(iconfont))fs.cpSync(iconfont,path.join(root,'public/upload/common/iconfont'),{recursive:true})
const manifest=JSON.parse(fs.readFileSync(path.join(root,'cra1-theme/release.json')))
for(const row of manifest.native_dependencies){
 if(!row.path.startsWith('public/')||!row.path.includes('/default/'))continue
 const source=path.join(native,row.path),target=path.join(root,row.path),actual=createHash('sha256').update(fs.readFileSync(source)).digest('hex')
 assert.ok([row.observed_sha256,...(row.verified_sha256||[])].includes(actual),'native fixture hash '+row.path)
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target)
}
execFileSync(php,['-r',`require $argv[1].'/cra1-theme/backend/bootstrap.php';$m=CRA1\\Theme\\Files::json($argv[1].'/cra1-theme/release.json');CRA1\\Theme\\Release\\References::apply($argv[1],$m['references']);`,root])
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r))
const origin=`http://127.0.0.1:${port}`,base=origin+'/cra1admin/index.php',password=randomBytes(24).toString('hex')
execFileSync(php,['-r',`require $argv[1].'/lib/cra1_theme_security.php';CRA1ThemeSecurity::install($argv[1],'fixture-admin',CRA1ThemeSecurity::password($argv[3]),['canonical_url'=>$argv[2],'http_test'=>true,'force_https'=>false]);$s=new CRA1ThemeSecurity($argv[1]);$s->db->exec('UPDATE accounts SET must_change=0');`,root,origin,password])
execFileSync(php,['-r',`require $argv[1].'/lib/cra1_theme_media.php';new CRA1ThemeMediaStore($argv[1],true);`,root])
const log=fs.openSync(path.join(out,'php.log'),'w'),proc=spawn(php,['-S',`127.0.0.1:${port}`,'-t',path.join(root,'public')],{stdio:['ignore',log,log]}),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),checks=[],errors=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label)}
const hash=file=>fs.existsSync(file)?createHash('sha256').update(fs.readFileSync(file)).digest('hex'):'missing'
const main=path.join(root,'runtime/cra1_theme/member_center.json'),snapshot=path.join(root,'runtime/cra1_theme/member_center_public.json')
try{
 for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'?r=login');const auth=await page.evaluate(()=>window.__THEME_AUTH__)
 const login=await ctx.request.post(base+'?r=api.auth.login',{headers:{'X-CSRF-Token':auth.csrf,Origin:origin},data:{username:'fixture-admin',password}});check((await login.json()).status===200,'isolated real admin login')
 await page.goto(base+'?r=dashboard#/member/edit/login');await page.getByLabel('表单标题',{exact:true}).waitFor()
 check(await page.locator('.workspace-savebar').getByRole('button',{name:/^保存/}).count()===1,'one save action for the whole page')
 await page.getByLabel('表单标题',{exact:true}).fill('草稿登录标题');await page.getByLabel('表单说明',{exact:true}).fill('草稿表单说明')
 await page.getByRole('button',{name:'添加条目',exact:true}).click();await page.getByLabel('条目标题',{exact:true}).fill('应被取消');await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();check(await page.getByText('应被取消',{exact:true}).count()===0,'cancelling list edits leaves the draft untouched')
 await page.getByRole('button',{name:'添加条目',exact:true}).click();await page.getByLabel('条目标题',{exact:true}).fill('测试亮点');await page.getByLabel('条目说明',{exact:true}).fill('可以拖拽调整顺序');await page.getByRole('button',{name:'应用到草稿',exact:true}).click()
 const handle=page.getByRole('button',{name:'拖拽排序：测试亮点',exact:true});await handle.focus();await handle.press('Space');await handle.press('ArrowUp');await handle.press('Space')
 check((await page.locator('.embedded-editor ul>li').allTextContents())[2].includes('测试亮点'),'keyboard sorting uses the shared list control')
 await page.getByRole('switch',{name:'显示支持链接',exact:true}).click();await page.getByLabel('支持链接文字',{exact:true}).fill('客户支持');await page.getByLabel('支持链接',{exact:true}).fill('mailto:help@example.com')
 await page.getByRole('button',{name:'注册页',exact:true}).click();await page.getByLabel('表单标题',{exact:true}).waitFor();await page.getByLabel('表单标题',{exact:true}).fill('草稿注册标题')
 await page.getByRole('button',{name:'登录页',exact:true}).click();await page.getByLabel('表单标题',{exact:true}).waitFor();check(await page.getByLabel('表单标题',{exact:true}).inputValue()==='草稿登录标题','switching pages preserves independent drafts')
 await page.reload();await page.getByLabel('表单标题',{exact:true}).waitFor();check(await page.getByLabel('表单标题',{exact:true}).inputValue()==='草稿登录标题','refresh restores the current draft')
 const before={main:hash(main),snapshot:hash(snapshot)},business=[]
 page.on('request',req=>{if(req.url().includes('/console/v1/'))business.push(req.method()+' '+new URL(req.url()).pathname)})
 await page.getByRole('button',{name:'预览效果',exact:true}).click();const frame=page.frameLocator('iframe[title="当前配置效果预览"]')
 await frame.getByRole('heading',{name:'草稿登录标题',exact:true}).waitFor();check(await frame.getByRole('link',{name:'客户支持'}).getAttribute('href')==='mailto:help@example.com','preview receives current unsaved copy and links')
 await frame.locator('.cra1-auth-panel').screenshot({path:path.join(out,'login-draft-preview.png')})
 check(hash(main)===before.main&&hash(snapshot)===before.snapshot,'preview leaves main configuration and official snapshot byte-for-byte unchanged')
 check(business.length===0,'opaque preview sends no native business requests')
 await page.getByRole('dialog').getByRole('button',{name:'手机',exact:true}).click();await frame.locator('.cra1-auth-panel').screenshot({path:path.join(out,'login-draft-preview-mobile.png')})
 await page.keyboard.press('Escape');await page.locator('iframe').waitFor({state:'detached'})
 const save=page.waitForResponse(r=>r.url().includes('r=api.workspace.editor.save'));await page.locator('.workspace-savebar').getByRole('button',{name:/^保存/}).click();check((await(await save).json()).status===200,'actual atomic login page save')
 let saved=JSON.parse(fs.readFileSync(main));check(saved.content.auth_login.title==='草稿登录标题'&&saved.content.auth_login.brand.items[2].title==='测试亮点','copy, support link and list order persist together')
 check(saved.content.auth_regist.title==='创建您的账户','saving login never publishes registration draft')
 for(const kind of ['login','regist']){
  await page.goto(base+'?r=dashboard#/member/edit/'+kind);await page.getByLabel('表单标题',{exact:true}).waitFor()
  if(kind==='regist'){
   check(await page.getByLabel('表单标题',{exact:true}).inputValue()==='草稿注册标题','registration draft survives login save')
   const response=page.waitForResponse(r=>r.url().includes('r=api.workspace.editor.save'));await page.locator('.workspace-savebar').getByRole('button',{name:/^保存/}).click();check((await(await response).json()).status===200,'actual atomic registration page save')
   await page.getByRole('button',{name:'预览效果',exact:true}).click();await frame.getByRole('heading',{name:'草稿注册标题',exact:true}).waitFor();check(await frame.getByRole('button',{name:'注册',exact:true}).isVisible(),'registration preview renders the actual registration form');await page.keyboard.press('Escape')
  }
  for(const width of [1920,1440,768,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),kind+' editor fits '+width);await page.screenshot({path:path.join(out,`${kind}-admin-${width}.png`),fullPage:true})}
 }
 saved=JSON.parse(fs.readFileSync(main));check(saved.content.auth_login.title==='草稿登录标题'&&saved.content.auth_regist.title==='草稿注册标题','both saved page settings coexist')
 check(errors.length===0,'no browser exceptions: '+errors.join('; '));await ctx.close()
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'passed',checks,screenshots:fs.readdirSync(out).filter(x=>x.endsWith('.png')).length,productionWrites:0},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,output:out}))
}catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:e.stack,checks,errors},null,2));throw e}
finally{await browser.close();proc.kill();fs.closeSync(log);fs.rmSync(root,{recursive:true,force:true})}
