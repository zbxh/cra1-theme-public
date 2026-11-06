/** Real browser logins across transports and a TLS-terminating proxy, in an isolated site only. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright');
const environment=JSON.parse(fs.readFileSync(process.env.CRA1_TRANSPORT_ENV));
const credentials=JSON.parse(fs.readFileSync(process.env.CRA1_TRANSPORT_CREDENTIALS));
const output=process.env.CRA1_TRANSPORT_OUT;
assert.ok(output&&environment.site?.startsWith('/tmp/cra1-'),'Use the isolated loopback fixture');
const origins=[environment.origin,environment.http_origin,environment.proxy_origin,'http://127.0.0.1:'+environment.ports.http,environment.http_origin];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--host-resolver-rules=MAP theme.example.test 127.0.0.1','--no-proxy-server']});
const context=await browser.newContext({ignoreHTTPSErrors:true});
const report={status:'running',checks:[],errors:[]};
const check=(ok,message)=>{assert.ok(ok,message);report.checks.push(message)};
try{
 await context.route('**/*',r=>{
  const q=r.request(),u=new URL(q.url());
  if(!origins.includes(u.origin))return r.abort();
  if(['GET','HEAD'].includes(q.method())||u.pathname==='/'+credentials.theme_entry+'/index.php')return r.continue();
  return r.abort();
 });
 for(let i=0;i<origins.length;i++){
  const origin=origins[i],page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const response=await page.goto(origin+'/'+credentials.theme_entry+'/index.php?r=login',{waitUntil:'networkidle'});
  check(response.status()===200,'login remains reachable across domain, port and transport '+i);
  let csrf;
  if(await page.locator('#authForm').count()){
   await page.locator('#authForm [name=username]').fill(credentials.theme_username);
   await page.locator('#authForm [name=password]').fill(credentials.theme_password);
   await page.locator('#authSubmit').click();
   await page.waitForFunction(()=>!!window.__CRA1_ADMIN__);
   check(true,'existing account logs in without matching saved canonical or a proxy whitelist '+i);
  }else{
   check(true,'returning to an earlier transport retains its valid session '+i);
  }
  await page.waitForFunction(()=>!!window.__CRA1_ADMIN__);
  csrf=csrf||await page.evaluate(()=>window.__CRA1_ADMIN__.csrf);
  const endpoint=origin+'/'+credentials.theme_entry+'/index.php?r=api.release.history';
  const read=async token=>{const cookies=await context.cookies(endpoint),physical=new URL(endpoint);physical.hostname='127.0.0.1';return (await context.request.post(physical.href,{headers:{Host:new URL(endpoint).host,Cookie:cookies.map(c=>c.name+'='+c.value).join('; '),'X-CSRF-Token':token},data:{}})).json()};
  check((await read('')).status===403&&(await read('incorrect')).status===403,'missing and incorrect session CSRF remain rejected '+i);
  const valid=await read(csrf);
  check(valid.status===200,'valid session token works without Origin and Referer '+i);
  const cookie=(await context.cookies(origin+'/'+credentials.theme_entry+'/index.php')).find(c=>c.name===(origin.startsWith('https:')?'CRA1THEMEID':'CRA1THEMEID_HTTP'));
  check(cookie&&cookie.httpOnly&&cookie.secure===origin.startsWith('https:'),'usable transport-specific session cookie '+i);
  if(i===1){
   await context.clearCookies({name:'CRA1THEMEID_HTTP'});
   await context.addCookies([{...cookie,name:'CRA1THEMEID'}]);
   await page.reload({waitUntil:'networkidle'});
   check(await page.evaluate(token=>window.__CRA1_ADMIN__?.csrf===token,csrf),'legacy HTTP cookie continues the existing login and CSRF after upgrade');
   check((await context.cookies(origin+'/'+credentials.theme_entry+'/index.php')).some(c=>c.name==='CRA1THEMEID_HTTP'&&c.value===cookie.value),'existing server session receives the new HTTP cookie without creating another login');
  }
  if(origin===environment.proxy_origin){
   const preview=await page.evaluate(async()=>{
    const boot=window.__CRA1_ADMIN__,r=await fetch(boot.base+'?r=api.workspace.preview',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':boot.csrf},body:JSON.stringify({domain:'website',editorId:'page:404',patch:{}})}),v=await r.json();
    if(v.status!==200)return {status:v.status,msg:v.msg};
    const rendered=await fetch(v.data.url),html=await rendered.text(),match=html.match(/window\.__THEME_PREVIEW__=(.*?);<\/script>/s);return {url:v.data.url,status:rendered.status,boot:match?JSON.parse(match[1]):{},csp:rendered.headers.get('Content-Security-Policy'),text:match?'':html.slice(0,400)};
   });
   report.preview={status:preview.status,origin:preview.boot?.resource_origin,csp:preview.csp,text:preview.text,msg:preview.msg};
   check(preview.status===200&&preview.boot.resource_origin===origin,'preview GET retains the public browser address behind a rewritten proxy Host');
   check(preview.csp.includes('frame-ancestors '+origin)&&!preview.csp.includes('origin.internal'),'preview resources and framing policy use the same public address');
   check(preview.csp.length<1024,'preview response header fits ordinary FastCGI and reverse-proxy buffers');
   await page.evaluate(url=>{const frame=document.createElement('iframe');frame.id='transport-preview';frame.sandbox='allow-scripts';frame.src=url;document.body.appendChild(frame)},preview.url);
   const frame=page.frameLocator('#transport-preview');
   await frame.locator('[data-theme-preview-status="ready"]').waitFor();
   check(await frame.locator('body').evaluate(()=>window.__THEME_PREVIEW__?.resource_origin&&window.__CRA1_RUNTIME__?.projection_version===2&&window.localStorage.getItem('jwt')==='preview-demo-token'),'preview scripts render inside their sandbox behind the rewritten proxy Host');
  }
  await page.close();
 }
 const anonymous=await browser.newContext({ignoreHTTPSErrors:true});
 const denied=await anonymous.request.post(environment.origin+'/'+credentials.theme_entry+'/index.php?r=api.release.history',{headers:{'X-CSRF-Token':'unrelated'},data:{}});
 check((await denied.json()).status===401,'transport compatibility does not grant anonymous administrator access');
 await anonymous.close();
 check(report.errors.length===0,'no browser exceptions during transport transitions');
 report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync(output,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error}));}
