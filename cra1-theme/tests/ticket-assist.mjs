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
 const document={readyState:'complete',querySelector:q=>q==='.main-form'?form:q.startsWith('.template.add-ticket')?{__vue__:{ticketData:{}}}:null,addEventListener(){}}
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

async function premiumPrefill(mobile, selected) {
  const native = { ticketData: { host_ids: selected }, hostList: [{ id: 12 }, { id: 34 }] }
  const form = { before() {} }
  const root = mobile
    ? { _vnode: { component: { proxy: native } }, before() {}, querySelector() { return null } }
    : { __vue__: native }
  const document = {
    readyState: 'complete',
    addEventListener() {},
    querySelector(selector) {
      if (selector === '.main-form' && !mobile) return form
      if (selector.startsWith('script[src*="/ticket_premium/"]')) return {}
      if (selector === '#template.create-box') return mobile ? root : null
      if (selector.startsWith('.template.add-ticket')) return mobile ? null : root
      return null
    },
    createElement() { return { setAttribute() {}, remove() {} } },
  }
  const requests = []
  const href = 'https://example.invalid/plugin/91/addTicket.htm?cra1_host=12'
  const window = {
    location: new URL(href),
    CRA1Shared: { Request: { request(url) {
      requests.push(url)
      return Promise.resolve({ data: { url: '/plugin/91/addTicket.htm?cra1_host=12' } })
    } } },
  }
  vm.runInNewContext(source, { window, document, URL })
  await Promise.resolve()
  assert.deepEqual(requests, ['/cra1-theme/member/host/12/ticket-entry'])
  checks++
  return JSON.parse(JSON.stringify(native.ticketData.host_ids))
}

assert.deepEqual(await premiumPrefill(false, []), [12], 'premium desktop stores the authorized host in its native array');checks++
assert.equal(await premiumPrefill(true, ''), 12, 'premium mobile retains its native scalar host value');checks++
assert.deepEqual(await premiumPrefill(false, [34]), [34], 'a native manual selection is preserved');checks++
console.log(JSON.stringify({status:'passed',checks,production_writes:0}))
