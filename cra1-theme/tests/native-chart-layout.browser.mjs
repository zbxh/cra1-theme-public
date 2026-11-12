import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const {chromium}=createRequire(root+'/cra1-theme/scripts/package.json')('playwright');
const script=fs.readFileSync(root+'/public/clientarea/template/pc/cra1/js/module-deps.js');
const server=http.createServer((req,res)=>{if(req.url==='/module-deps.js'){res.setHeader('content-type','text/javascript');res.end(script);return}res.end('<!doctype html><style>body{margin:0}#host{display:none;width:calc(100vw - 40px)}.my-echart{width:100%;height:230px}</style><main id="host"><div class="my-echart"></div></main><script src="/module-deps.js"></script>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++};
try{
 const page=await browser.newPage({viewport:{width:390,height:900}});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{
  window.drawn=100;window.drawnHeight=230;window.resizes=0;
  const chart={getWidth:()=>drawn,getHeight:()=>drawnHeight,resize:()=>{resizes++;drawn=document.querySelector('.my-echart').clientWidth;drawnHeight=document.querySelector('.my-echart').clientHeight}};
  window.echarts={getInstanceByDom:()=>chart};window.stopCharts=CRA1ModuleDeps.observeCharts(document.querySelector('#host'));
 });
 await page.waitForTimeout(80);check(await page.evaluate(()=>resizes===0),'hidden tabs do not resize their charts to zero');
 await page.evaluate(()=>document.querySelector('#host').style.display='block');
 await page.waitForFunction(()=>drawn===350);check(true,'opening a native tab corrects a chart initialized at 100px');
 await page.setViewportSize({width:320,height:900});await page.waitForFunction(()=>drawn===280);check(true,'narrow-screen resizing follows the actual chart container');
 const calls=await page.evaluate(()=>resizes);await page.waitForTimeout(180);check(await page.evaluate(n=>resizes===n,calls),'stable layouts do not create a resize loop');
 await page.evaluate(()=>{document.querySelector('#host').style.display='none'});await page.waitForTimeout(80);check(await page.evaluate(()=>drawn===280),'hiding a tab preserves its existing chart');
 await page.evaluate(()=>{document.querySelector('#host').style.display='block';stopCharts()});await page.setViewportSize({width:768,height:900});await page.waitForTimeout(100);check(await page.evaluate(()=>resizes===2),'disposing a module removes its chart layout observers');
 console.log(JSON.stringify({status:'passed',checks,business_writes:0}));
}finally{await browser.close();server.close()}
