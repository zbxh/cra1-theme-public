import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright'),origin=process.env.CRA1_ISOLATED_ORIGIN,out=process.env.CRA1_MODULE_COMPAT_OUT,state=process.env.CRA1_BROWSER_STATE;
if(!origin||new URL(origin).hostname!=='127.0.0.1'||!out||!state)throw Error('Isolated origin, state and output required');
fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),checks=[];
try{
const c=await browser.newContext({ignoreHTTPSErrors:true,storageState:state}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();if(u.pathname==='/fixture-embedded')return r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px system-ui;margin:24px;color:#35383c}input,button{font:inherit;padding:8px}</style><h2>内嵌服务示例</h2><p>页面保留在会员中心内容区域内。</p><label>演示输入 <input></label><button onclick="this.textContent=&quot;操作正常&quot;">演示操作</button>'});if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return r.continue()});
for(const width of [1920,1440,768,390]){
await p.setViewportSize({width,height:960});await p.goto(origin+'/custom_iframe.htm?iframe_url='+encodeURIComponent(origin+'/fixture-embedded?a=1&b=2'),{waitUntil:'networkidle'});
const frame=p.frameLocator('iframe[title="内嵌页面"]');await frame.getByRole('heading',{name:'内嵌服务示例'}).waitFor();await frame.getByRole('textbox').fill('演示内容');await frame.getByRole('button',{name:'演示操作'}).click();assert(await frame.getByRole('button',{name:'操作正常'}).isVisible());
assert(await p.getByRole('link',{name:'在新窗口打开'}).getAttribute('href')===origin+'/fixture-embedded?a=1&b=2');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:out+'/embedded-'+width+'.png',fullPage:true});checks.push('iframe preserves shell, query, inputs and actions '+width);
}
await p.goto(origin+'/custom_iframe.htm?iframe_url=javascript%3Aalert(1)',{waitUntil:'networkidle'});assert(await p.locator('[role=alert]').isVisible());assert(await p.locator('iframe').count()===0);checks.push('unsafe target is refused');
const anonymous=await browser.newContext({ignoreHTTPSErrors:true}),guest=await anonymous.newPage();await guest.goto(origin+'/custom_iframe.htm?iframe_url='+encodeURIComponent(origin+'/fixture-embedded'),{waitUntil:'networkidle'});await guest.waitForURL(u=>u.pathname==='/login.htm');checks.push('anonymous access redirects before embedded content loads');await anonymous.close();
assert.deepEqual(errors,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({status:'passed',checks,errors},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length}));
}finally{await browser.close()}
