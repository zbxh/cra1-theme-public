/** Read-only layout checks on installed native module views with real fixture data. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
const {chromium}=await import(process.env.CRA1_PLAYWRIGHT_MODULE||'playwright')
const origin=process.env.CRA1_BROWSER_ORIGIN,state=process.env.CRA1_BROWSER_STATE,out=process.env.CRA1_BROWSER_OUT
if(!origin||!state||!out)throw Error('An isolated origin, member state and output directory are required')
const cases=[['mf_cloud',process.env.CRA1_CLOUD_HOST_ID],['mf_dcim',process.env.CRA1_DCIM_HOST_ID]].filter(([,id])=>id)
if(!cases.length)throw Error('Provide owned fixture host IDs')
const report={status:'running',checks:[],errors:[],blockedWrites:[]},check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label)}
const browser=await chromium.launch({args:['--no-sandbox']}),context=await browser.newContext({ignoreHTTPSErrors:true,storageState:state,viewport:{width:1440,height:1000},reducedMotion:'reduce'})
await context.route('**/*',route=>{
 const req=route.request(),u=new URL(req.url())
 if(u.origin!==origin)return route.abort()
 if(!['GET','HEAD','OPTIONS'].includes(req.method())&&!['/cra1-shared/notifications.php','/cra1-shared/announcements.php','/console/v1/promo_code/apply'].includes(u.pathname)){
  report.blockedWrites.push({path:u.pathname,method:req.method()});return route.abort()
 }
 return route.continue()
})
fs.mkdirSync(out,{recursive:true})
try{
 for(const [module,id]of cases){
  assert.match(id,/^[1-9][0-9]*$/)
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message))
  await page.goto(origin+'/module/'+module+'/product_detail.htm?id='+id,{waitUntil:'networkidle'})
  await page.locator('.manage-content .manage-item').first().waitFor({state:'visible'})
  // A source override is only for the explicit pre-build fixture run. Final
  // installed-package verification leaves this unset and uses browser assets.
  if(process.env.CRA1_LAYOUT_SOURCE_CSS)await page.addStyleTag({path:process.env.CRA1_LAYOUT_SOURCE_CSS})
  for(const width of [1920,1440,768,390,320]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(150)
   const layout=await page.evaluate(()=>{
    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}
    const cards=[...document.querySelectorAll('.manage-content .manage-item')].filter(n=>n.getBoundingClientRect().height>0)
    const within=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1
    return {
     overflow:document.documentElement.scrollWidth>innerWidth+1,
     cards:cards.length,
     inside:[...cards,...document.querySelectorAll('.top-msg > .msg-l,.top-msg > .msg-r,.top-operation,.main-card .tabs')].every(n=>within(rect(n),rect(n.closest('.main-card')))),
     controls:cards.every(n=>[...n.querySelectorAll('.item-top-btn,.el-select')].filter(c=>c.getBoundingClientRect().height>0).every(c=>within(rect(c),rect(n)))),
     separate:cards.every((n,i)=>cards.slice(i+1).every(m=>{const a=rect(n),b=rect(m);return a.right<=b.x+1||b.right<=a.x+1||a.bottom<=b.y+1||b.bottom<=a.y+1}))
    }
   })
   check(layout.cards>0&&!layout.overflow&&layout.inside&&layout.controls&&layout.separate,module+' cards and controls remain readable and contained at '+width+' '+JSON.stringify(layout))
   await page.evaluate(()=>{
    const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n
    while(n=walk.nextNode())if(!/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement?.tagName))n.nodeValue=n.nodeValue.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:ser\d{6,}|C\d{10,})\b/gi,'••••••••')
    document.querySelectorAll('.cra1-topbar__account-name,.t-user-info').forEach(n=>n.style.filter='blur(8px)');scrollTo(0,0)
   })
   await page.screenshot({path:path.join(out,module+'-'+width+'.png'),fullPage:true})
  }
  await page.close()
 }
 check(report.errors.length===0,'no browser runtime errors')
 check(report.blockedWrites.length===0,'no business writes attempted')
 report.status='passed'
}catch(error){report.status='failed';report.error=error.message;process.exitCode=1}
finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error}))}
