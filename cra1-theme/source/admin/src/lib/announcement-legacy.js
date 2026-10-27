import { equal, clone } from './workspace-state.js'
const webKeys = ['show_notice','notice_bar_text','notice_bar_interval','notice_bar_links_text']
export function announcementDrafts(records) {
  const drafts=[]
  for(const [id,record] of Object.entries(records)) {
    if(!record.values || !record.original)continue
    let source,values,original,part
    if(['member:notices','editor:member:notices'].includes(id)) {
      source='member';part=id.startsWith('editor:')?'main':null
      values=(part?record.values[part]:record.values)?.notices
      original=(part?record.original[part]:record.original)?.notices
    } else if(id==='site-notice'||id==='editor:website:header') {
      source='website';part=id.startsWith('editor:')?'site-notice':null
      const select=value=>Object.fromEntries(webKeys.filter(key=>key in (value||{})).map(key=>[key,value[key]]))
      values=select(part?record.values[part]:record.values);original=select(part?record.original[part]:record.original)
    }
    if(source&&values&&original&&!equal(values,original))drafts.push({id,source,values,original,part})
  }
  // Preserve every raw source in the recovery copy, applying the newer editor last.
  return drafts.sort((a,b)=>Number(a.id.startsWith('editor:'))-Number(b.id.startsWith('editor:')))
}
export function importedAnnouncementItems(current,converted) {
  const affected=new Set([...converted.original,...converted.values].map(item=>item.id))
  const first=current.findIndex(item=>affected.has(item.id))
  const kept=current.filter(item=>!affected.has(item.id)),position=first<0?kept.length:first
  kept.splice(position,0,...converted.values)
  return kept
}
export function consumeAnnouncementDraft(record,draft) {
  if(draft.id==='editor:website:header') {
    const next=clone(record)
    for(const key of ['values','original'])delete next[key]['site-notice']
    if(next.revisions)delete next.revisions['site-notice']
    return next
  }
  return {...record,values:clone(record.original),saveError:'',remote:null}
}
