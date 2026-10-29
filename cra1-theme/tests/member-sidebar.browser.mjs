/** Packaged admin + real workspace/storage + native Vue sidebar; disposable catalogue only. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { randomBytes, createHash } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const install=process.env.CRA1_INSTALL_PACKAGE, out=process.env.CRA1_BROWSER_OUT
const native=process.env.CRA1_NATIVE_REFERENCE_ROOT, php=process.env.CRA1_PHP || '/www/server/php/74/bin/php'
const baseline=process.env.CRA1_BASELINE==='1'
if(!install||!out||!native)throw Error('Set CRA1_INSTALL_PACKAGE, CRA1_BROWSER_OUT and CRA1_NATIVE_REFERENCE_ROOT')
fs.mkdirSync(out,{recursive:true})
const root=fs.mkdtempSync(path.join(os.tmpdir(),'cra1-sidebar-browser-'))
execFileSync('python3',['-c','import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',install,root])
fs.writeFileSync(path.join(root,'config.php'),'<?php // Isolated fixture; no system database.\n')
const manifest=JSON.parse(fs.readFileSync(path.join(root,'cra1-theme/release.json')))
const backend=path.join(root,manifest.backend_root), shared=`/cra1-shared/releases/${manifest.release}`
const adminEntry=path.join(root,'public/cra1admin/index.php')
fs.writeFileSync(adminEntry,fs.readFileSync(adminEntry,'utf8').replace(".' exception '.get_class($e)",".' exception '.get_class($e).' '.$e->getMessage()"))
const member=`/clientarea/template/pc/cra1/releases/${manifest.release}`
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r))
const origin=`http://127.0.0.1:${port}`,base=origin+'/cra1admin/index.php',password=randomBytes(24).toString('hex')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const node=(n,label,url='',children=[])=>({id:id(n),label,url,source_type:'custom',children})
const tree=[node(1,'示例业务','',[node(2,'实例管理','',[node(3,'我的服务器','productList.htm')])])]
execFileSync(php,['-r',`require $argv[1].'/cra1-theme/backend/bootstrap.php';require CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php';CRA1ThemeSecurity::install($argv[1],'fixture-admin',CRA1ThemeSecurity::password($argv[3]),['canonical_url'=>$argv[2],'http_test'=>true,'force_https'=>false]);$s=new CRA1ThemeSecurity($argv[1]);$s->db->exec('UPDATE accounts SET must_change=0');`,root,origin,password])
execFileSync(php,['-r',"require $argv[1].'/cra1-theme/backend/bootstrap.php';require CRA1_THEME_BACKEND.'/Support/cra1_theme_media.php';new CRA1ThemeMediaStore($argv[1],true);",root])
const config=path.join(root,'runtime/cra1_theme/member_center.json')
fs.writeFileSync(config,JSON.stringify({version:1,sidebar:{shape:2,nodes:tree}}))
const row=(n,parent,name,url,type='custom',nav=0)=>({id:n,parent_id:parent,name,url,type,nav_id:nav,language:'{}',icon:'',second_reminder:0,module:'[]',res_module:'[]',product_id:'[]',show_quick_order:0,quick_order_url:'',is_cross_module:0,select_field:'[]',order:n})
const catalogue=path.join(root,'fixture-catalogue.json')
let rows=[row(1,0,'系统服务',''),row(2,1,'系统服务器','productList.htm','module'),row(3,0,'系统账户','account.htm','system',12)]
fs.writeFileSync(catalogue,JSON.stringify(rows))
// Only the catalogue DB connection is simulated. Routes, sessions, CSRF, drafts,
// validation, locks, save conflicts and snapshot generation are the packaged code.
fs.writeFileSync(path.join(root,'fixture-pdo.php'),`<?php
class CRA1SidebarFixtureRows {private $rows;function __construct($r){$this->rows=$r;}function fetchAll(...$args){return $this->rows;}}
class CRA1SidebarFixturePDO extends PDO {function __construct(){}function query($sql,...$args){$rows=[];if(strpos($sql,'FROM idcsmart_menu m')!==false)$rows=json_decode(file_get_contents(__DIR__.'/fixture-catalogue.json'),true);return new CRA1SidebarFixtureRows($rows);}}
`)
const storage=path.join(backend,'Storage/member_store.php')
fs.writeFileSync(storage,fs.readFileSync(storage,'utf8').replace('private function pdo(): ?PDO\n    {',`private function pdo(): ?PDO\n    {\n        require_once CRA1_THEME_ROOT.'/fixture-pdo.php'; return new \\CRA1SidebarFixturePDO();`))
fs.copyFileSync(path.join(native,'public/clientarea/template/pc/default/js/common/vue.js'),path.join(root,'public/fixture-vue.js'))
fs.writeFileSync(path.join(root,'public/fixture-runtime.js'),fs.readFileSync(path.resolve(new URL('../../public/cra1-shared/src/runtime.js',import.meta.url).pathname),'utf8').split('(function(root){')[0])
fs.writeFileSync(path.join(root,'public/sidebar-fixture.html'),`<!doctype html><html data-cra1-theme="member"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${shared}/cra1-shared.css"><link rel="stylesheet" href="${member}/20261012-nav-auth-v1/css/cra1-shell.css"><style>body{margin:0;background:#f5f6f8;font-family:system-ui}header{height:48px;display:flex;align-items:center;padding:0 20px;background:white;border-bottom:1px solid #ddd}main{padding:32px;color:#555}button{cursor:pointer}</style><header><button id="toggle" aria-label="切换主导航" onclick="window.dispatchEvent(new CustomEvent('cra1:toggle-aside'))">☰</button><span style="margin-left:16px">会员中心 · 导航示例</span></header><div id="app"><aside-menu></aside-menu></div><main>此页面只使用示例菜单进行验证。</main><script src="/fixture-vue.js"></script><script>window.CRA1Shared={Access:{read:()=>Promise.resolve(),canUrl:()=>true}};window.__CRA1_FEAT__={ready:true,recharge_open:1,withdraw_open:1};window.getCommon=()=>Promise.resolve({data:{status:200,data:{}}});window.accountDetail=()=>Promise.resolve({data:{status:200,data:{account:{id:1}}}});window.getMenu=()=>Promise.resolve({data:{status:200,data:{menu:[]}}});window.lang={};</script><script src="/fixture-runtime.js"></script><script src="${member}/components/asideMenu/asideMenu.js"></script><script>window.vm=new Vue({el:'#app',components:{asideMenu}});</script></html>`)
const log=fs.openSync(path.join(out,'php.log'),'w'),proc=spawn(php,['-S',`127.0.0.1:${port}`,'-t',path.join(root,'public')],{stdio:['ignore',log,log]})
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),checks=[],errors=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label)}
const hash=()=>createHash('sha256').update(fs.readFileSync(config)).digest('hex')
try {
  for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base+'?r=login');const auth=await page.evaluate(()=>window.__THEME_AUTH__)
  const login=await context.request.post(base+'?r=api.auth.login',{headers:{'X-CSRF-Token':auth.csrf,Origin:origin},data:{username:'fixture-admin',password}})
  check((await login.json()).status===200,'real admin authentication')
  await page.goto(base+'?r=dashboard#/member/edit/sidebar');await page.locator(`[data-tree-row="${id(3)}"]`).waitFor()
  const before=hash()
  const capture=async(prefix)=>{
    for(const button of await page.getByRole('button',{name:'关闭提示',exact:true}).all())await button.click().catch(()=>{})
    for(const width of [1920,1440,768,390]){
      await page.setViewportSize({width,height:1000})
      await page.evaluate(()=>scrollTo(0,0))
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
      await page.screenshot({path:path.join(out,`${prefix}-${width}.png`),fullPage:true})
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${prefix} fits ${width}`)
    }
  }
  await capture('admin-hierarchy')
  await page.setViewportSize({width:1440,height:1000})
  const front=await context.newPage();front.on('pageerror',e=>errors.push(e.message))
  await front.goto(origin+'/sidebar-fixture.html');await front.waitForFunction(()=>window.vm?.$children[0]?.loading===false)
  await front.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  await front.getByRole('button',{name:'切换主导航',exact:true}).click()
  fs.writeFileSync(path.join(out,'front-open.json'),JSON.stringify(await front.evaluate(()=>({open:vm.$children[0].navOpen,html:document.getElementById('toggle').outerHTML,components:vm.$children.length}))))
  await front.waitForFunction(()=>window.vm?.$children[0]?.navOpen===true)
  const frontNames=await front.locator('.cra1-primary-item__label').allTextContents()
  if(!baseline)check(JSON.stringify(frontNames)===JSON.stringify(['示例业务']),'frontend primary entries use configured first-level groups')
  if(!baseline){await front.locator('.cra1-primary-item').filter({hasText:'示例业务'}).click();check(await front.locator('.cra1-nav-l2__name').innerText()==='实例管理','second-level group stays a heading');check(await front.locator('.cra1-nav-l3__name').innerText()==='我的服务器','third-level page stays inside its group')}
  for(const width of [1920,1440,768,390]) {
    await front.setViewportSize({width,height:1000})
    await front.waitForFunction(w=>window.vm.$children[0].viewportW===w,width)
    await front.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
    if(!await front.locator('.cra1-aside').evaluate(e=>e.classList.contains('is-open')))await front.locator('#toggle').click()
    await front.waitForFunction(()=>window.vm.$children[0].navOpen===true)
    if(width<1024&&!baseline&&!await front.locator('.cra1-aside').evaluate(e=>e.classList.contains('is-mobile-detail')))await front.getByRole('button',{name:'示例业务',exact:true}).click()
    await front.screenshot({path:path.join(out,`front-hierarchy-${width}.png`),fullPage:true})
    check(await front.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'front hierarchy fits '+width)
  }
  await front.close()
  await page.getByRole('button',{name:'仅追加系统新增项（保留我已改的）',exact:true}).click()
  const [response]=await Promise.all([page.waitForResponse(r=>r.url().includes('r=api.workspace.editor.import')),page.getByRole('dialog').getByRole('button',{name:'追加',exact:true}).click()])
  const imported=await response.json();fs.writeFileSync(path.join(out,'import-response.json'),JSON.stringify(imported,null,2));check(imported.status===200,'real import endpoint returns a proposal: '+(imported.msg||''))
  await page.getByRole('dialog').waitFor({state:'hidden'})
  const applied=await page.locator('[data-tree-row]').filter({hasText:'系统服务'}).count()>0
  if(baseline){fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'reproduced',frontNames,importStatus:imported.status,proposalReachedDraft:applied,productionWrites:0},null,2));await page.screenshot({path:path.join(out,'import-not-applied.png'),fullPage:true});console.log(JSON.stringify({status:'reproduced',frontNames,importStatus:imported.status,proposalReachedDraft:applied}));}
  else {
    check(applied,'async import result reaches the real locked workspace draft')
    check(await page.locator(`[data-tree-row="${id(1)}"]`).count()===1,'append preserves the custom group')
    check(hash()===before,'import is a proposal and never writes main configuration')
    const save=page.locator('.workspace-savebar').getByRole('button',{name:/^保存菜单/})
    check(await save.isEnabled(),'import marks the workspace dirty and enables save')
    await page.reload();await page.locator('[data-tree-row]').filter({hasText:'系统服务'}).first().waitFor();check(hash()===before,'unsaved imported draft survives reload without committing')
    const [saved]=await Promise.all([page.waitForResponse(r=>r.url().includes('r=api.workspace.editor.save')),save.click()]);check((await saved.json()).status===200,'real workspace save commits all levels')
    check(JSON.parse(fs.readFileSync(config)).sidebar.shape===3,'effective configuration records three-level rendering')
    await page.getByRole('button',{name:'仅追加系统新增项（保留我已改的）',exact:true}).click();const [repeat]=await Promise.all([page.waitForResponse(r=>r.url().includes('r=api.workspace.editor.import')),page.getByRole('dialog').getByRole('button',{name:'追加',exact:true}).click()]);check((await repeat.json()).data.added===0,'repeat import adds nothing')
    await page.getByRole('dialog').waitFor({state:'hidden'});check(await save.isDisabled(),'repeat import does not create a dirty draft')
    rows.push(row(4,1,'系统新增入口','finance.htm'));fs.writeFileSync(catalogue,JSON.stringify(rows))
    await page.getByRole('button',{name:'仅追加系统新增项（保留我已改的）',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'追加',exact:true}).click();await page.locator('[data-tree-row]').filter({hasText:'系统新增入口'}).first().waitFor()
    await page.locator('.workspace-savebar').getByRole('button',{name:/^撤销/}).click();check(await page.locator('[data-tree-row]').filter({hasText:'系统新增入口'}).count()===0,'undo discards imported additions')
    await page.getByRole('button',{name:'重新导入（覆盖当前副本）',exact:true}).click();const [replace]=await Promise.all([page.waitForResponse(r=>r.url().includes('r=api.workspace.editor.import')),page.getByRole('dialog').getByRole('button',{name:'覆盖导入',exact:true}).click()]);check((await replace.json()).status===200,'replace proposal succeeds');await page.getByRole('dialog').waitFor({state:'hidden'});check(await page.locator(`[data-tree-row="${id(1)}"]`).count()===0,'replace removes the whole custom copy from the draft')
    await page.locator('.workspace-savebar').getByRole('button',{name:/^撤销/}).click()
    await page.getByRole('button',{name:'新增菜单',exact:true}).first().click();const dialog=page.getByRole('dialog');await dialog.getByLabel('显示名称').fill('新建空分组');await dialog.getByRole('button',{name:'应用到草稿',exact:true}).click();await page.locator('[data-tree-row]').filter({hasText:'新建空分组'}).first().waitFor();check(true,'empty first-level group can be created without a URL')
    const empty=page.locator('[data-tree-row]').filter({hasText:'新建空分组'});await empty.getByRole('button',{name:/添加下级/}).click();await dialog.getByLabel('显示名称').fill('空二级分组');await dialog.getByRole('button',{name:'应用到草稿',exact:true}).click();check(await page.locator('[data-tree-row]').filter({hasText:'空二级分组'}).count()===1,'empty second-level group can be created without a URL')
    await capture('admin-import')
    check(errors.length===0,'no browser exceptions: '+errors.join('; '))
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'passed',checks,productionWrites:0,screenshots:fs.readdirSync(out).filter(n=>n.endsWith('.png')).length},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length}))
  }
} catch(error){const states=[];for(const ctx of browser.contexts())for(const p of ctx.pages())states.push(await p.evaluate(()=>({url:location.href,text:document.body.innerText,nav:window.vm?.$children[0]&&{open:vm.$children[0].navOpen,shape:vm.$children[0].navShape,primary:vm.$children[0].primaryKey,width:vm.$children[0].viewportW}})).catch(()=>({})));fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.message,errors,checks,states},null,2));for(const ctx of browser.contexts())for(const page of ctx.pages())await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error}
finally{await browser.close();proc.kill();fs.closeSync(log);fs.rmSync(root,{recursive:true,force:true})}
