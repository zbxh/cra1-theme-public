import test from 'node:test'
import assert from 'node:assert/strict'
import {announcementDrafts,importedAnnouncementItems,consumeAnnouncementDraft} from '../src/lib/announcement-legacy.js'
test('announcement recovery finds only changed old announcement data',()=>{
 const records={
  'member:notices':{original:{notices:{items:[]}},values:{notices:{items:[{id:'old'}]}}},
  'editor:website:header':{original:{'site-menu':{a:1},'site-notice':{notice_bar_text:'old'}},values:{'site-menu':{a:2},'site-notice':{notice_bar_text:'mine'}}},
  'member:home':{original:{title:'old'},values:{title:'mine'}},
 }
 const drafts=announcementDrafts(records)
 assert.deepEqual(drafts.map(row=>row.source),['member','website'])
 assert.deepEqual(drafts[1].values,{notice_bar_text:'mine'})
 assert.equal(records['editor:website:header'].values['site-menu'].a,2)
})
test('recovered items replace only matching legacy IDs and retain new announcements',()=>{
 const current=[{id:'new'},{id:'legacy-1'},{id:'legacy-2'},{id:'other-theme'}]
 const result=importedAnnouncementItems(current,{original:[{id:'legacy-1'},{id:'legacy-2'}],values:[{id:'legacy-2',title:'local'}]})
 assert.deepEqual(result,[{id:'new'},{id:'legacy-2',title:'local'},{id:'other-theme'}])
 assert.equal(current.length,4)
})
test('consuming a header announcement draft preserves unsaved navigation edits',()=>{
 const record={values:{'site-menu':{label:'mine'},'site-notice':{notice_bar_text:'mine'}},original:{'site-menu':{label:'old'},'site-notice':{notice_bar_text:'old'}},revisions:{'site-menu':'a','site-notice':'b'}}
 const next=consumeAnnouncementDraft(record,{id:'editor:website:header'})
 assert.deepEqual(next.values,{'site-menu':{label:'mine'}})
 assert.deepEqual(next.original,{'site-menu':{label:'old'}})
 assert.deepEqual(next.revisions,{'site-menu':'a'})
 assert.ok(record.values['site-notice'])
})
