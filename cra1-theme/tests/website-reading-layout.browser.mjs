/** Public article markup with isolated API data, preserving actual table semantics. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const {chromium}=createRequire(path.join(root,'cra1-theme/scripts/package.json'))('playwright');
const out=process.env.CRA1_BROWSER_OUT,stage=process.env.CRA1_REVIEW_STAGE;
if(!out||path.resolve(out).startsWith(root+path.sep))throw Error('Set external CRA1_BROWSER_OUT.');
fs.mkdirSync(out,{recursive:true});
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const release=stage?JSON.parse(fs.readFileSync(path.join(stage,'release.json'))).release:null;
const app=stage?fs.readFileSync(path.join(stage,'public/web/cra1/releases',release,'app.js'),'utf8'):read('public/cra1-shared/theme-sources/website/app.js');
const css=stage?fs.readFileSync(path.join(stage,'public/cra1-shared/releases',release,'cra1-shared.css'),'utf8')+'\n'+fs.readFileSync(path.join(stage,'public/web/cra1/releases',release,'app.css'),'utf8'):read('public/cra1-shared/src/tokens.css')+'\n'+read('public/web/cra1/src/page-refinements.css');
const browser=await chromium.launch({args:['--no-sandbox']});
const report={status:'running',checks:[],errors:[]};
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);};
try{
 for(const width of [1920,1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  page.on('pageerror',error=>report.errors.push(error.message));
  await page.route('https://fixture.invalid/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html data-cra1-theme="website"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}main{max-width:1000px;margin:auto;padding:20px;box-sizing:border-box}.reading-content{min-width:0}table{border-collapse:collapse}td,th{padding:12px;border:1px solid #d0d6d8}</style><body x-data="contentDetail" x-init="initEndpoint('/help','文档详情')"><main><article data-reading-article><h1 x-text="item?.title"></h1><div class="reading-content rich-content" x-html="item?.content" x-effect="if(item)$nextTick(()=>prepareReading())"></div></article></main></body></html>`}));
  await page.goto('https://fixture.invalid/?id=9');
  await page.evaluate(()=>{
   window.__CRA1_RUNTIME__={features:{help:true}};window.CRA1Shared={Request:{getToken:()=>''}};
   window.API={get:()=>Promise.resolve({help:{id:9,title:'长表格与代码示例',content:'<p>可横向滚动查看完整参数，正文仍按屏幕宽度排版。</p><table style="width:1200px"><caption>配置参数示例</caption><thead><tr><th scope="col">IPv6 地址</th><th scope="col">配置说明</th></tr></thead><tbody><tr><td>2001:0db8:85a3:0000:0000:8a2e:0370:7334</td><td>超长配置说明ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ</td></tr></tbody></table><pre><code>'+('example-command --preserve-content '.repeat(12))+'</code></pre><p>后续正文正常阅读。</p>'}})};
  });
  await page.addStyleTag({content:css});await page.addScriptTag({content:app});await page.addScriptTag({path:path.join(root,'public/web/cra1/assets/js/alpine.min.js')});
  const region=page.getByRole('region',{name:'配置参数示例'});await region.waitFor();
  check(await page.getByRole('table',{name:'配置参数示例'}).count()===1,'table semantics preserved '+width);
  const before=await page.locator('table').textContent();
  await page.evaluate(()=>document.body._x_dataStack[0].prepareReading());
  check(await page.locator('.reading-table-scroll').count()===1,'repeated enhancement never nests wrappers '+width);
  check(await page.locator('table').textContent()===before,'all table values preserved '+width);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'table and pre do not expand document '+width);
  await region.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);
  check(await region.evaluate(el=>el.scrollLeft>0),'keyboard can reach overflowed columns '+width);
  check(await page.locator('pre').evaluate(el=>el.scrollWidth>el.clientWidth),'code preserves lines with its own scroll '+width);
  await page.screenshot({path:path.join(out,'article-long-content-'+width+'.png'),fullPage:true});await page.close();
 }
 check(report.errors.length===0,'no browser exceptions');report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error}));}
