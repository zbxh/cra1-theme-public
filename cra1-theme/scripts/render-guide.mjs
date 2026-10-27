#!/usr/bin/env node
/** Build offline HTML/PDF from the reviewed Markdown; generated documents stay outside Git. */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import {marked} from 'marked'
import {chromium} from 'playwright'

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const {values}=parseArgs({options:{source:{type:'string',default:repo},out:{type:'string'}}})
if(!values.out)throw Error('Set --out to a new directory outside the source tree.')
const root=fs.realpathSync(values.source),out=path.resolve(values.out)
let ancestor=out
while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor)
const resolved=path.join(fs.realpathSync(ancestor),path.relative(ancestor,out))
if(resolved===root||resolved.startsWith(root+path.sep)||fs.existsSync(out))throw Error('Output must be a new directory outside the source tree.')
const read=relative=>{
 const file=path.join(root,relative)
 for(let current=file;current!==root;current=path.dirname(current))if(fs.lstatSync(current).isSymbolicLink())throw Error('Guide inputs cannot follow symlinks.')
 return fs.readFileSync(file)
}
const markdown=read('docs/installation.md').toString('utf8')
marked.use({renderer:{image({href,text}){
 if(!/^images\/[A-Za-z0-9_-]+\.(png|jpe?g|webp)$/.test(href))throw Error('Guide images must use local reviewed filenames.')
 const mime=href.endsWith('.webp')?'image/webp':/\.jpe?g$/.test(href)?'image/jpeg':'image/png'
 const alt=String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 return `<figure><img src="data:${mime};base64,${read('docs/'+href).toString('base64')}" alt="${alt}"><figcaption>${alt}</figcaption></figure>`
}}})
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>酷锐A1主题手动安装图文教程</title><style>
*{box-sizing:border-box}html{background:#eef0f1;color:#35383c;font:15px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}body{margin:0}main{max-width:960px;margin:32px auto;padding:40px 48px;background:#fff;border-radius:16px}h1{font-size:28px;line-height:1.4}h2{margin:36px 0 16px;padding-bottom:8px;border-bottom:1px solid #dedfe2;font-size:22px}h3{font-size:17px}a{color:#746036;overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}code{padding:2px 5px;background:#f3f4f5;border-radius:4px;font-size:.9em}pre{padding:14px;background:#f3f4f5;border:1px solid #e3e5e8;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}pre code{padding:0;background:none}blockquote{margin:16px 0;padding:1px 16px;border-left:3px solid #b59a64;background:#faf9f6;color:#61656b}table{border-collapse:collapse;width:100%;margin:16px 0;font-size:13px}th,td{border:1px solid #dedfe2;padding:9px;text-align:left;vertical-align:top}th{background:#f4f5f6}figure{margin:20px 0;break-inside:avoid}figure img{display:block;width:100%;height:auto;border:1px solid #e3e5e8;border-radius:8px}figcaption{margin-top:6px;color:#61656b;text-align:center;font-size:12px}h1,h2,h3{break-after:avoid}tr,blockquote,pre{break-inside:avoid}@media(max-width:600px){main{margin:0;padding:20px 16px;border-radius:0}h1{font-size:24px}th,td{padding:6px;font-size:12px}}@media print{@page{size:A4;margin:16mm 14mm}html{background:#fff;font-size:10.5pt;line-height:1.65}main{max-width:none;margin:0;padding:0;border-radius:0}h1{font-size:22pt}h2{break-before:page;margin-top:0;font-size:17pt}h2:first-of-type{break-before:auto}h3{font-size:12pt}figure img{max-height:150mm;object-fit:contain}table{font-size:9pt}a{color:inherit}thead{display:table-header-group}}
</style></head><body><main>${marked.parse(markdown,{gfm:true})}</main></body></html>`
fs.mkdirSync(out,{recursive:true})
fs.writeFileSync(path.join(out,'installation.html'),html)
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
try{
 const page=await browser.newPage({viewport:{width:960,height:1080},locale:'zh-CN'})
 const requests=[]
 await page.route('**/*',r=>{requests.push(r.request().url());return r.abort()})
 await page.setContent(html,{waitUntil:'load'})
 await page.evaluate(()=>document.fonts.ready)
 const images=await page.evaluate(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0))
 if(!images||requests.length)throw Error('Generated guide must load entirely offline.')
 const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false})
 // Chromium includes wall-clock metadata. Normalize these fixed-length fields so
 // identical Markdown and images can produce identical delivery archives.
 const stable=pdf.toString('latin1').replace(/\/(CreationDate|ModDate) \(D:[^)]*\)/g,match=>{
  const value=match.replace(/D:[^)]*/,"D:20260101000000+00'00'")
  if(value.length!==match.length)throw Error('Unexpected PDF date format.')
  return value
 })
 fs.writeFileSync(path.join(out,'installation.pdf'),Buffer.from(stable,'latin1'))
 await page.setViewportSize({width:390,height:844})
 const mobile=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)
 if(!mobile)throw Error('Generated mobile guide overflows.')
 console.log(JSON.stringify({status:'passed',offline:true,mobile:true,images:await page.locator('img').count(),out}))
}finally{await browser.close()}
