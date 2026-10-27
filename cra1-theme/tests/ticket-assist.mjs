import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const source=fs.readFileSync(root+'/public/clientarea/template/pc/cra1/js/ticket-assist.js','utf8')
let checks=0
function fixture(snapshot){
 const classes=new Set(),intervals=[],loads=[]
 const form={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}}
 const document={readyState:'complete',querySelector:q=>q==='.main-form'?form:q==='.template.add-ticket'?{__vue__:{ticketData:{}}}:null,addEventListener(){}}
 const window={location:{pathname:'/plugin/91/addTicket.htm',href:'https://example.invalid/plugin/91/addTicket.htm'},__CRA1_MEMBER_SNAPSHOT__:snapshot,addEventListener:(n,f)=>loads.push(f)}
 const context={window,document,URL,setInterval:f=>(intervals.push(f),intervals.length),clearInterval(){},setTimeout(){}}
 vm.runInNewContext(source,context)
 return{window,classes,tick:()=>[...intervals].forEach(f=>f())}
}
for(const snapshot of [{content:{}},{content:{ticket_assist:{enabled:0}}},{content:{ticket_assist:{enabled:'0'}}}]){
 const f=fixture(snapshot);assert(!f.classes.has('cra1-ta-form-hidden'),'disabled or omitted assistant must leave the native form visible immediately');checks++
}
const late=fixture(undefined)
assert(late.classes.has('cra1-ta-form-hidden'),'unknown configuration waits for the protected snapshot');checks++
late.tick();late.window.__CRA1_MEMBER_SNAPSHOT__={content:{}};late.tick()
assert(!late.classes.has('cra1-ta-form-hidden'),'an asynchronously loaded disabled snapshot restores the form without the 25-second recovery timer');checks++
assert(!source.includes('/plugin/27/'),'the current native ticket plugin route is retained');checks++
console.log(JSON.stringify({status:'passed',checks,production_writes:0}))
