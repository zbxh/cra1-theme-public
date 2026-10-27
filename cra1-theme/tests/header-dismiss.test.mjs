import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'
const source=fs.readFileSync(new URL('../../public/cra1-shared/theme-sources/member/topMenu.js',import.meta.url),'utf8')
const context={};vm.runInNewContext(source+';globalThis.header=topMenu',context)
function fixture(state={}){
 const focused=[],messages={},languages={}
 const instance={searchOpen:false,msgPanelOpen:false,langOpen:false,$refs:{messageTrigger:messages,languageTrigger:languages},closeSearch:value=>focused.push(['search',value]),...state}
 const ctx=vm.createContext({CRA1Shared:{UI:{focus:el=>focused.push(el)}}})
 const handle=vm.runInContext('('+context.header.methods.onHeaderKeydown.toString().replace(/^onHeaderKeydown/,'function')+')',ctx)
 const event={key:'Escape',preventDefault(){this.defaultPrevented=true}}
 return {instance,focused,messages,languages,event,run:()=>handle.call(instance,event)}
}
test('Escape dismisses message and language panels and returns focus to their own trigger',()=>{
 for(const state of [{msgPanelOpen:true},{langOpen:true}]){
  const f=fixture(state);f.run();assert.equal(f.instance.msgPanelOpen,false);assert.equal(f.instance.langOpen,false)
  assert.equal(f.focused[0],state.msgPanelOpen?f.messages:f.languages);assert.equal(f.event.defaultPrevented,true)
 }
})
test('unrelated keys, composition and already-consumed Escape leave the header alone',()=>{
 for(const override of [{key:'Enter'},{isComposing:true},{defaultPrevented:true}]){
  const f=fixture({msgPanelOpen:true});Object.assign(f.event,override);f.run();assert.equal(f.instance.msgPanelOpen,true);assert.equal(f.focused.length,0)
 }
 const closed=fixture();closed.run();assert.equal(closed.focused.length,0);assert.equal(closed.event.defaultPrevented,undefined)
})
test('search keeps its existing dismissal and focus behavior',()=>{
 const f=fixture({searchOpen:true});f.run();assert.equal(f.focused.length,1);assert.equal(f.focused[0][0],'search');assert.equal(f.focused[0][1],true)
})
