import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=process.env.CRA1_INSTALLER_BROWSER_OUT;
if(!output)throw Error('Set CRA1_INSTALLER_BROWSER_OUT to an isolated output directory.');
fs.mkdirSync(output,{recursive:true});
const require=createRequire(path.join(root,'cra1-theme/scripts/package.json'));
const {chromium}=require('playwright');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cra1-submit-test-'));
const rendered=spawnSync(process.env.CRA1_PHP||'php',[path.join(root,'public/cra1-install/index.php')],{encoding:'utf8'});
if(rendered.status!==0)throw Error(rendered.stderr);
const adminRequire=createRequire(path.join(root,'cra1-theme/source/admin/package.json'));
const entry=path.join(temp,'admin.jsx'),bundle=path.join(temp,'admin.js');
fs.writeFileSync(entry,`import React from ${JSON.stringify(path.join(root,'cra1-theme/source/admin/node_modules/react/index.js'))};import{createRoot}from ${JSON.stringify(path.join(root,'cra1-theme/source/admin/node_modules/react-dom/client.js'))};import Security from ${JSON.stringify(path.join(root,'cra1-theme/source/admin/src/pages/Security.jsx'))};createRoot(document.getElementById('root')).render(<Security mode="accounts"/>);`);
adminRequire('esbuild').buildSync({entryPoints:[entry],outfile:bundle,bundle:true,format:'iife',jsx:'automatic',loader:{'.css':'empty'},nodePaths:[path.join(root,'cra1-theme/source/admin/node_modules')],alias:{'@ui':path.join(root,'cra1-theme/source/admin/src/components/ui')},logLevel:'silent'});
const certificate=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',path.join(temp,'key.pem'),'-out',path.join(temp,'cert.pem'),'-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{encoding:'utf8'});
if(certificate.status!==0)throw Error('Unable to create isolated HTTPS fixture.');
const server=https.createServer({key:fs.readFileSync(path.join(temp,'key.pem')),cert:fs.readFileSync(path.join(temp,'cert.pem'))},(req,res)=>{
  const url=new URL(req.url,'http://fixture.invalid');
  if(url.pathname==='/cra1-install/'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end(rendered.stdout);return;
  }
  if(url.pathname==='/accounts.html'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.__CRA1_ADMIN__={base:"/admin.php",role:"super_admin",user_id:1,csrf:"fixture-csrf"}</script><script src="/admin.js"></script>');return;
  }
  const file=url.pathname==='/admin.js'?bundle:['/cra1-install/installer.js','/cra1-install/installer.css'].includes(url.pathname)?path.join(root,'public',url.pathname):null;
  if(file){res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/css');res.end(fs.readFileSync(file));return;}
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  res.writeHead(404);res.end('Fixture not found');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='https://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const checks=[],errors=[],consoles=[];
let totalWrites=0;
const ready={mode:'install',installation_ready:true,version:'v17.1',release_channel:'test',checks:[{status:'pass',label:'运行环境',detail:'检查通过'}]};
const password='Example-password-123!';
function check(value,label){if(!value)throw Error(label);checks.push(label);}
async function fixture({width=1440,fastTimeout=false}={}){
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width,height:1000}}),page=await context.newPage();
  if(fastTimeout)await page.addInitScript(()=>{const original=window.setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===60000?100:ms,...args);});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoles.push(message.text());});
  const state={mode:'success',checkResponse:structuredClone(ready),calls:0,installs:0,release:null};
  await page.route('**/cra1-install/api.php',async route=>{
    const input=route.request().postDataJSON();state.calls++;
    check(route.request().headers().authorization==='Bearer isolated-native-admin','native administrator authentication retained');
    check(!!route.request().headers()['x-csrf-token'],'installer CSRF retained');
    if(input.action==='check'){await route.fulfill({json:{status:200,data:state.checkResponse}});return;}
    check(input.action==='install','only registered installation actions are sent');
    check(!Object.hasOwn(input,'confirm'),'confirmation password is not sent to the server');
    state.installs++;totalWrites++;
    if(state.mode==='hold')await new Promise(resolve=>state.release=resolve);
    if(state.mode==='timeout'){await new Promise(resolve=>setTimeout(resolve,250));await route.abort().catch(()=>{});return;}
    if(state.mode==='network'){await route.abort();return;}
    if(state.mode==='html'){await route.fulfill({contentType:'text/html',body:'<h1>Temporary error</h1>'});return;}
    if(state.mode==='forbidden-html'){await route.fulfill({status:403,contentType:'text/html',body:'<h1>Access denied</h1>'});return;}
    if(state.mode==='missing-api'){await route.fulfill({status:404,contentType:'text/html',body:'<h1>Not found</h1>'});return;}
    if(state.mode==='http-error'){await route.fulfill({status:503,json:{status:400,msg:'Internal exception details'}});return;}
    if(state.mode==='auth'){await route.fulfill({status:401,json:{status:401}});return;}
    if(state.mode==='auth-forbidden'){await route.fulfill({status:403,json:{status:403}});return;}
    if(state.mode==='rejected'){await route.fulfill({json:{status:400,msg:'后台地址已存在，请更换地址。'}});return;}
    if(state.mode==='incomplete'){await route.fulfill({json:{status:200,data:{installed:true}}});return;}
    await route.fulfill({json:{status:200,data:{installed:true,admin_url:'/exampleadmin/index.php',username:input.username,password:input.password}}});
  });
  await page.goto(origin+'/cra1-install/');
  await page.evaluate(()=>localStorage.setItem('backJwt','isolated-native-admin'));
  async function inspect(){await page.locator('#check').click();await page.waitForFunction(()=>!document.getElementById('check').disabled||document.getElementById('status').textContent.includes('已安装酷锐A1'));}
  async function fill(values={}){
    for(const [name,value]of Object.entries({entry:'exampleadmin',username:'example_admin',password,confirm:password,canonical:origin,...values}))await page.locator(`[name=${name}]`).fill(value);
  }
  return {context,page,state,inspect,fill,close:()=>context.close()};
}
try{
  const f=await fixture();await f.inspect();await f.fill();
  for(const [name,value,description]of [
    ['entry','','missing entry'],['entry','abc','short entry'],['entry','ExampleAdmin','uppercase entry'],
    ['username','ab','short username'],['username','测试账号','non-ASCII username'],['username','user@example.com','invalid username punctuation'],
    ['password','short-pass','short password'],['confirm','','missing confirmation'],['confirm','Different-password!','mismatching confirmation'],
    ['canonical','https://other.invalid','different installation origin'],['canonical','http://example.invalid','HTTP origin'],['canonical','https://example.invalid/a','origin with path'],['canonical','https://example.invalid/?q=a','origin with query'],['canonical','','missing origin']
  ]){
    await f.fill({[name]:value});const before=f.state.installs;
    await f.page.locator('#install').click();
    check(f.state.installs===before,description+' does not start installation');
    check(await f.page.locator(`[name=${name}]`).getAttribute('aria-invalid')==='true',description+' has a field error');
    check(await f.page.locator('#setup-status').isVisible(),description+' has visible feedback at the button');
    check(await f.page.locator(`[name=${name}]`).evaluate(node=>document.activeElement===node),description+' focuses its field');
  }
  for(const width of [1920,1440,768,390]){
    await f.page.setViewportSize({width,height:1000});await f.fill({password:'short-pass'});await f.page.locator('#install').click();
    check(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'invalid form fits '+width+'px');
    check(await f.page.locator('#setup-status').boundingBox().then(box=>!!box&&box.width>100),'validation feedback remains legible '+width+'px');
    await f.page.screenshot({path:path.join(output,'validation-'+width+'.png'),fullPage:true});
  }
  await f.fill();f.state.mode='hold';await f.page.locator('#install').click();
  await f.page.getByRole('button',{name:'正在安装…',exact:true}).waitFor();
  check(await f.page.locator('#setup').getAttribute('aria-busy')==='true','real click exposes the busy state');
  check(await f.page.locator('#install').isDisabled(),'busy button prevents repeated clicks');
  check((await f.page.locator('#setup-status').innerText()).includes('正在安装'),'progress is visible next to submit');
  await f.page.keyboard.press('Enter');check(f.state.installs===1,'Enter during installation does not duplicate the request');
  f.state.release();await f.page.locator('#success').waitFor({state:'visible'});
  check(await f.page.locator('#check').isDisabled(),'successful install cannot initialize again');
  check(await f.page.locator('#credentials').innerText().then(t=>t.includes(password)),'credentials display on successful installation');
  check(await f.page.evaluate(p=>!JSON.stringify({...localStorage,...sessionStorage}).includes(p),password),'password is never cached in browser storage');
  await f.page.getByRole('button',{name:'隐藏密码'}).click();check(!(await f.page.locator('#credentials').innerText()).includes(password),'one-time password can be hidden');
  await f.close();
  for(const username of ['test-user','test_user','abc']){
    const f=await fixture();await f.inspect();await f.fill({username});
    check(await f.page.locator('[name=username]').evaluate(node=>node.validity.valid),'HTML pattern accepts '+username);
    await f.page.locator('[name=canonical]').press('Enter');await f.page.locator('#success').waitFor({state:'visible'});
    check(f.state.installs===1,'keyboard submits valid username '+username+' exactly once');await f.close();
  }
  for(const mode of ['rejected','auth','auth-forbidden','html','forbidden-html','missing-api','network','http-error','timeout','incomplete']){
    const f=await fixture({fastTimeout:mode==='timeout'});await f.inspect();await f.fill();f.state.mode=mode;
    await f.page.locator('#install').click();await f.page.waitForFunction(()=>document.getElementById('setup').getAttribute('aria-busy')==='false');
    check(await f.page.locator('#setup-status').isVisible(),mode+' shows a visible failure');
    check(!(await f.page.locator('#setup-status').innerText()).includes('Internal exception'),mode+' does not expose internal response text');
    if(['forbidden-html','missing-api'].includes(mode))check((await f.page.locator('#setup-status').innerText()).includes('目录访问权限')&&!(await f.page.locator('#setup-status').innerText()).includes('登录已失效'),mode+' identifies a blocked controller rather than an expired login');
    if(['auth','auth-forbidden'].includes(mode))check((await f.page.locator('#setup-status').innerText()).includes('登录已失效'),mode+' retains the native authentication message');
    check(await f.page.locator('#check').isEnabled(),mode+' permits an explicit state check');
    check(f.state.installs===1,mode+' is never automatically retried');
    if(mode==='rejected'){
      check(await f.page.locator('#install').isEnabled(),'business rejection allows correction');
      f.state.mode='success';await f.page.locator('[name=entry]').fill('otheradmin');await f.page.locator('#install').click();await f.page.locator('#success').waitFor({state:'visible'});
      check(f.state.installs===2,'explicit corrected retry succeeds');
    }else{
      check(await f.page.locator('#install').isDisabled(),mode+' requires state confirmation before another install');
      f.state.checkResponse={...ready,mode:'maintenance'};await f.inspect();
      check(await f.page.locator('#setup').isHidden(),mode+' recognizes installation completed despite a lost response');
      check(f.state.installs===1,mode+' maintenance check does not install again');
    }
    await f.close();
  }
  const guard=await fixture();await guard.page.evaluate(()=>localStorage.removeItem('backJwt'));const calls=guard.state.calls;
  await guard.inspect();check(guard.state.calls===calls,'anonymous check sends no request');
  check((await guard.page.locator('#status').innerText()).includes('请先'),'anonymous visitor gets a login instruction');
  await guard.page.evaluate(()=>localStorage.setItem('backJwt','isolated-native-admin'));guard.state.checkResponse={...ready,installation_ready:false};await guard.inspect();
  check(await guard.page.locator('#setup').isHidden(),'failed preflight never exposes an enabled form');await guard.close();
  const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage();page.on('console',m=>{if(m.type()==='error')consoles.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
  let accountWrites=0;await page.route('**/admin.php?*',async route=>{
    const action=new URL(route.request().url()).searchParams.get('r');
    if(action==='api.security.accounts.list'){await route.fulfill({json:{status:200,data:{list:[]}}});return;}
    check(action==='api.security.accounts.create','account form uses registered native theme API');accountWrites++;await route.fulfill({json:{status:200,msg:'已保存',data:{}}});
  });
  await page.goto(origin+'/accounts.html');await page.getByRole('button',{name:'新增账号'}).click();
  await page.locator('#account-name').fill('invalid@user');await page.locator('#account-password').fill(password);
  await page.getByRole('button',{name:'保存账号'}).click();check(accountWrites===0,'admin account HTML pattern rejects invalid punctuation');
  await page.locator('#account-name').fill('test-user');await page.getByRole('button',{name:'保存账号'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  check(accountWrites===1,'admin account accepts a hyphen username');await context.close();
  check(errors.length===0,'all tested pages have no uncaught JavaScript exceptions');
  check(!consoles.some(message=>/Pattern attribute|regular expression|Invalid character in character class/i.test(message)),'installer and real admin account form have no HTML pattern console errors');
  const unexpected=consoles.filter(message=>!/Failed to load resource: net::ERR_FAILED|Failed to load resource: the server responded with a status of (401|403|404|503)/.test(message));
  fs.writeFileSync(path.join(output,'console.json'),JSON.stringify({errors,consoles,unexpected},null,2)+'\n');
  check(unexpected.length===0,'no unexpected browser console errors');
  const report={status:'passed',checks:checks.length,mock_install_writes:totalWrites,production_writes:0,widths:[1920,1440,768,390],results:checks};
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:undefined}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
