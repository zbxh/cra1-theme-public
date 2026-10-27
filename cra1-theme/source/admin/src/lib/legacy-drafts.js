import {clone,equal,changes} from './workspace-state.js'
import {parseRows,serializeRows} from './row-contract.js'

// Migrate only the legacy scopes that belong to the opened editor. Originals are
// retained for three-way comparison; untouched editors keep their own drafts.
export function migrateEditorDrafts(records,domain,data){
 const id=`editor:${domain}:${data.editorId}`
 if(records[id]?.values)return {records,record:records[id]}
 const original=clone(data.values),values=clone(data.values),consumed=[]
 for(const [section,scopeId] of Object.entries(data.editor.sections)){
  const prior=records[scopeId];if(!prior?.values||!prior.original||equal(prior.values,prior.original))continue
  const patch=changes(prior.original,prior.values),fields=data.scopes[section].fields||[]
  let recognized=0
  for(const [key,v]of Object.entries(patch)){
   const f=fields.find(f=>(f.keys||[f.key]).includes(key)||f.legacyPageKey===key)
   const target=f?.legacyPageKey===key?f.key:key
   if(!(target in original[section]))continue
   const convert=(val)=>{
    if(f?.legacyPageKey===key&&f.adapter==='page-rows')return String(val||'').split('\n').filter(Boolean).map(line=>line.replace(/^([!>]*)(.*)$/,'$1'+data.editor.pageKey+'|$2')).join('\n')
    if(f?.adapter==='page-rows')return serializeRows(parseRows(val,f.cols).map(r=>({...r,row:{...r.row,page:data.editor.pageKey}})),f.cols)
    return clone(val)
   }
   original[section][target]=convert(prior.original[key]);values[section][target]=convert(v);recognized++
  }
  if(recognized===Object.keys(patch).length)consumed.push(scopeId)
 }
 if(!consumed.length)return{records,record:null}
 const next={...records};for(const key of consumed)delete next[key]
 const record={domain,values,original,revision:data.revision,revisions:data.revisions,remote:equal(original,data.values)?null:data,migrated:true}
 next[id]=record;return{records:next,record}
}
