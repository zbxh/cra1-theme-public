/** Isolated UI and real native dependency-loader checks. No production network or mutations. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import http from 'node:http'
import {createRequire} from 'node:module'
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..')
const req=createRequire(path.join(root,'cra1-theme/source/admin/package.json'))
const {buildSync}=req('esbuild')
const {chromium}=process.env.CRA1_PLAYWRIGHT_MODULE?await import(process.env.CRA1_PLAYWRIGHT_MODULE):req('playwright')
const output=process.env.CRA1_BROWSER_OUT
if(!output)throw Error('Set CRA1_BROWSER_OUT outside the public root')
fs.mkdirSync(output,{recursive:true})
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cra1-release-browser-'))
const entry=path.join(temp,'entry.jsx')
fs.writeFileSync(entry,`import React from ${JSON.stringify(path.join(root,'cra1-theme/source/admin/node_modules/react/index.js'))};import {createRoot} from ${JSON.stringify(path.join(root,'cra1-theme/source/admin/node_modules/react-dom/client.js'))};import ThemeManagement from ${JSON.stringify(path.join(root,'cra1-theme/source/admin/src/pages/ThemeManagement.jsx'))};import MemberAppearance from ${JSON.stringify(path.join(root,'cra1-theme/source/admin/src/pages/MemberAppearance.jsx'))};createRoot(document.getElementById('root')).render(location.pathname==='/appearance.html'?<MemberAppearance member={{appearance:{aside_mobile_expand:'one'}}} loading={false} reload={()=>{}}/>:<ThemeManagement/>);`)
buildSync({entryPoints:[entry],outfile:path.join(temp,'management.js'),bundle:true,format:'iife',jsx:'automatic',nodePaths:[path.join(root,'cra1-theme/source/admin/node_modules')],alias:{'@ui':path.join(root,'cra1-theme/source/admin/src/components/ui')},logLevel:'silent'})
let installer=fs.readFileSync(path.join(root,'public/cra1-install/index.php'),'utf8').replace(/^[\s\S]*?\?>/,'')
installer=installer.replace(/<\?=htmlspecialchars\(\$csrf,ENT_QUOTES,'UTF-8'\)\?>/g,'fixture-csrf')
installer=installer.replace(/<\?=\$assetVersion\?>/g,'fixture-current-assets')
const assetDir=process.env.CRA1_ADMIN_ASSETS
if(!assetDir)throw Error('Set CRA1_ADMIN_ASSETS to the staged admin release')
const server=http.createServer((r,s)=>{
 const u=new URL(r.url,'http://fixture.invalid');let file
 if(u.pathname==='/management.html'){s.setHeader('Content-Type','text/html');s.end(`<!doctype html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/admin.css"><body class="p-4"><div id="root"></div><script>window.__CRA1_ADMIN__={role:new URLSearchParams(location.search).get('role')||'super_admin',csrf:'fixture-csrf',base:'/index.php'};</script><script src="/management.js"></script></body></html>`);return}
 if(u.pathname==='/appearance.html'){s.setHeader('Content-Type','text/html');s.end('<!doctype html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/admin.css"><body><div id="root" style="width:min(100%,256px);margin:16px auto"></div><script src="/management.js"></script></body></html>');return}
 if(u.pathname==='/installer/'){s.setHeader('Content-Type','text/html');s.end(installer);return}
 if(u.pathname==='/native.html'){s.setHeader('Content-Type','text/html');s.end('<!doctype html><meta charset="UTF-8"><script>window.__CRA1_SHARED_BASE__="/native/";window.url="/native/";window.lang={};</script><script src="/native/utils/util.js"></script><script src="/native/js/common/common.js"></script><script src="/native/components/asideMenu/asideMenu.js"></script><script src="/native/components/topMenu/topMenu.js"></script><script src="/native/js/module-deps.js"></script>');return}
 if(u.pathname==='/management.js')file=path.join(temp,'management.js')
 else if(u.pathname==='/admin.css')file=path.join(assetDir,'admin.css')
 else if(['/installer/installer.css','/installer/installer.js'].includes(u.pathname))file=path.join(root,'public/cra1-install',path.basename(u.pathname))
 else if(u.pathname.startsWith('/native/')&&!u.pathname.includes('..'))file=path.join(root,'public/clientarea/template/pc/cra1',u.pathname.slice(8))
 if(file&&!fs.existsSync(file)&&u.pathname.startsWith('/native/')&&process.env.CRA1_NATIVE_REFERENCE_ROOT){
  const relative='public/clientarea/template/pc/cra1/'+u.pathname.slice(8)
  const refs=JSON.parse(fs.readFileSync(path.join(root,'cra1-theme/source/native-references.json'),'utf8')).references
  for(const [alias,target] of Object.entries(refs))if(relative===alias||relative.startsWith(alias+'/')){
   const candidate=path.join(process.env.CRA1_NATIVE_REFERENCE_ROOT,target,relative.slice(alias.length))
   if(fs.existsSync(candidate)){file=candidate;break}
  }
 }
 if(file&&fs.existsSync(file)&&fs.statSync(file).isFile()){s.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');s.end(fs.readFileSync(file));return}
 s.statusCode=404;s.end('fixture not found')
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const origin=`http://127.0.0.1:${server.address().port}`
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const results=[];let writes=0
function check(ok,label){if(!ok)throw Error(label);results.push(label)}
const compatibility={release:'fixture-candidate',context:{system_version:'10.7.4'},compatible:false,counts:{pass:1,warning:0,blocked:1,unverified:1},checks:[{id:'fixture',status:'blocked',label:'模块版本待核验',path:'public/plugins/server/mf_cloud/MfCloud.php',detail:'数据库与源码版本不一致',impact:'增强操作暂不可用',owner:'V10 原文件（只读）'}]}
try{
 for(const width of [1920,1440,768,390]){
  const context=await browser.newContext({viewport:{width,height:960}}),page=await context.newPage(),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  let applications=0
  await page.route('**/index.php?*',async route=>{
   const action=new URL(route.request().url()).searchParams.get('r')
   if(!['api.release.check','api.release.history','api.release.upload','api.release.apply'].includes(action))throw Error('Unexpected management request: '+action)
   const details=page.url().includes('many=1')?{...compatibility,checks:Array.from({length:123},(_,i)=>({id:'file-'+i,status:'unverified',label:'待核验文件 '+(i+1),path:'public/cra1-fixture/file-'+i,detail:'隔离测试'}))}:compatibility
   let data=action.endsWith('check')?details:action.endsWith('history')?{current:{},history:[],interrupted:false}:{}
   if(action.endsWith('upload')){
    check(route.request().postData().includes('filename="cra1-theme-install.zip"'),`upload uses the same install ZIP ${width}`)
    data={candidate:'fixture-install',release:'fixture-overlay-v1',version:'v17.1',release_channel:'test',sha256:'a'.repeat(64),signature:'示例安装包',blockers:[],files:[],can_apply:true}
   }
   if(action.endsWith('apply')){
    const body=route.request().postDataJSON()
    check(body.candidate==='fixture-install'&&body.expectedDigest==='a'.repeat(64),`apply retains confirmed install digest ${width}`)
    applications++;data={applied:true}
   }
   await route.fulfill({json:{status:200,data}})
  })
  await page.goto(origin+'/management.html');await page.getByText('模块版本待核验',{exact:true}).waitFor()
  check(await page.getByRole('button',{name:'重新检查'}).count()===1,`management loaded ${width}`)
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`management no document overflow ${width}`)
  await page.screenshot({path:path.join(output,`management-${width}.png`),fullPage:true})
  await page.getByRole('tab',{name:'安装与更新'}).click();check(await page.locator('input[type=file]').count()===1,`superadmin update upload ${width}`)
  await page.getByLabel('上传主题安装包 ZIP（最多 80MB）').setInputFiles({name:'cra1-theme-install.zip',mimeType:'application/zip',buffer:Buffer.from('isolated upload fixture; PHP tests validate the real ZIP')})
  const apply=page.getByRole('button',{name:'确认覆盖更新',exact:true})
  await apply.waitFor()
  check(await apply.isEnabled(),`installation preflight allows overwrite ${width}`)
  page.once('dialog',dialog=>dialog.dismiss());await apply.click()
  check(applications===0,`cancel leaves installed theme untouched ${width}`)
  page.once('dialog',dialog=>dialog.accept());await apply.click()
  await page.getByText('更新完成，请刷新页面加载对应资源。',{exact:true}).waitFor()
  check(applications===1,`confirmed install submits only once ${width}`)
  check(await page.getByRole('tab').count()===4,`customer management has four tabs ${width}`)
  for(const name of ['版本与兼容','文件明细','安装与更新','备份与回退']){
   await page.getByRole('tab',{name,exact:true}).click()
   check(!/商业授权|商用发行|许可证|发行验收|免费商用/.test(await page.locator('body').innerText()),`customer tab contains only management content ${name} ${width}`)
  }
  check(errors.length===0,`management no JS errors ${width}`)
  await page.goto(origin+'/management.html?many=1');await page.getByRole('tab',{name:'文件明细',exact:true}).click()
  await page.getByRole('status').filter({hasText:'第 1 / 3 页，共 123 项'}).waitFor()
  check(await page.locator('tbody tr').count()===50,`file inspection renders at most 50 rows ${width}`)
  await page.getByRole('button',{name:'下一页',exact:true}).click();await page.getByText('待核验文件 51',{exact:true}).waitFor()
  check(await page.getByText('待核验文件 1',{exact:true}).count()===0,`file pagination replaces preceding rows ${width}`)
  await page.getByRole('button',{name:'下一页',exact:true}).click()
  check(await page.locator('tbody tr').count()===23&&await page.getByRole('button',{name:'下一页',exact:true}).isDisabled(),`file pagination last page ${width}`)
  await page.getByRole('textbox',{name:'搜索文件与作用'}).fill('file-0');await page.getByRole('status').filter({hasText:'第 1 / 1 页，共 1 项'}).waitFor()
  check(await page.locator('tbody tr').count()===1,`file search resets pagination ${width}`)
  await page.goto(origin+'/management.html?role=admin');await page.getByRole('tab',{name:'安装与更新'}).click();await page.getByText('只有超级管理员可以上传和应用更新。').waitFor();check(await page.locator('input[type=file]').count()===0,`non-superadmin no upload ${width}`)
  let ready=false
  await page.route('**/installer/api.php',async route=>{
   const body=route.request().postDataJSON();check(route.request().headers().authorization==='Bearer fixture-native-jwt',`installer native bearer ${width}`)
   const data=body.action==='check'?{...compatibility,mode:'install',installation_ready:ready,checks:ready?[{id:'fixture',status:'pass',label:'环境与文件',detail:'检查通过'}]:compatibility.checks,counts:ready?{blocked:0,unverified:0}:compatibility.counts}:{installed:true,admin_url:'/fixtureadmin/index.php',username:body.username,password:body.password}
   if(body.action==='install')writes++
   await route.fulfill({json:{status:200,data}})
  })
  await page.goto(origin+'/installer/');await page.getByRole('button',{name:'验证并检查'}).click();await page.getByText('请先在同一浏览器登录 V10 超级管理员账号，再返回此页。').waitFor()
  await page.evaluate(()=>localStorage.setItem('backJwt','fixture-native-jwt'))
  await page.getByRole('button',{name:'验证并检查'}).click();await page.getByText('环境或文件检查尚有阻断或未确认项，请处理后重新检查。',{exact:true}).waitFor();check(!await page.locator('#setup').isVisible(),`installer blocks unverified ${width}`)
  ready=true;await page.getByRole('button',{name:'验证并检查'}).click();await page.locator('#setup').waitFor({state:'visible'})
  check(!/商业授权|商用发行|许可证|发行验收|免费商用/.test(await page.locator('body').innerText()),`installer contains only setup steps ${width}`)
  await page.screenshot({path:path.join(output,`installer-${width}.png`),fullPage:true})
  await page.locator('[name=entry]').fill('fixtureadmin');await page.locator('[name=username]').fill('fixture-admin');await page.locator('[name=password]').fill('Fixture-password-2026!');await page.locator('[name=confirm]').fill('Fixture-password-2026!');await page.locator('[name=canonical]').fill('https://fixture.invalid')
  await page.getByRole('button',{name:'安装并启用三个主题'}).click();await page.getByText('安装成功，初始化入口已锁定。').waitFor()
  check(await page.locator('#credentials').textContent().then(x=>x.includes('Fixture-password-2026!')),`installer one-time credentials ${width}`)
  await page.getByRole('button',{name:'隐藏密码'}).click();check(!await page.locator('#credentials').textContent().then(x=>x.includes('Fixture-password-2026!')),`installer hides password ${width}`)
  check(await page.evaluate(()=>!JSON.stringify({...localStorage,...sessionStorage}).includes('Fixture-password-2026!')),`password never browser cached ${width}`)
  await page.goto(origin+'/appearance.html')
  const tier=page.getByRole('combobox',{name:'手机端二级菜单展开档位'});await tier.waitFor()
  const layout=await tier.evaluate(control=>{const row=control.parentElement,label=row.firstElementChild,title=label.firstElementChild;return{labelWidth:label.getBoundingClientRect().width,titleHeight:title.getBoundingClientRect().height,rowHeight:row.getBoundingClientRect().height,contained:control.getBoundingClientRect().right<=row.getBoundingClientRect().right}})
  check(layout.labelWidth>=160&&layout.titleHeight<=40&&layout.rowHeight<240&&layout.contained,`appearance narrow column remains readable ${width}`)
  await tier.selectOption('all');check(await tier.inputValue()==='all',`appearance selection updates local draft ${width}`)
  await page.getByRole('button',{name:'撤销',exact:true}).click();check(await tier.inputValue()==='one',`appearance undo restores selection ${width}`)
  await page.screenshot({path:path.join(output,`appearance-narrow-${width}.png`),fullPage:true})
  await context.close()
 }
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Native dependency error: '+e.message)});await page.goto(origin+'/native.html')
 await page.evaluate(()=>CRA1ModuleDeps.ensure(['batchRenewpage','flowPacket']))
 check(await page.evaluate(()=>typeof asideMenu==='object'&&typeof topMenu==='object'&&typeof batchRenewpage==='object'&&typeof flowPacket==='object'),'real native component bindings loaded')
 await page.evaluate(()=>CRA1ModuleDeps.ensure(['batchRenewpage','flowPacket']));check(errors.length===0,'native loader has no duplicate const or missing shell errors')
 let failed=false;await page.route('**/native/components/customGoods/customGoods.js',async route=>{if(!failed){failed=true;await route.abort()}else await route.continue()})
 const rejected=await page.evaluate(()=>CRA1ModuleDeps.ensure(['customGoods']).then(()=>false,()=>true));check(rejected,'loader reports a failed component')
 await page.evaluate(()=>CRA1ModuleDeps.ensure(['customGoods']));check(await page.evaluate(()=>typeof customGoods==='object'),'loader retries component after failed request')
 const result={status:'passed',checks:results.length,widths:[1920,1440,768,390],mock_install_writes:writes,production_business_writes:0,results}
 fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,results:undefined}))
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true})}
