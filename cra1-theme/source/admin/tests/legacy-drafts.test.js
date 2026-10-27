import test from 'node:test'
import assert from 'node:assert/strict'
import {migrateEditorDrafts} from '../src/lib/legacy-drafts.js'
const page={editorId:'page:cloud',editor:{pageKey:'cloud',sections:{content:'page:cloud:content',layout:'page:cloud:layout'}},scopes:{content:{fields:[{key:'rows',keys:['rows'],adapter:'page-rows',cols:[{key:'page'},{key:'name'}]}]},layout:{fields:[]}},values:{content:{rows:'cloud|Before'},layout:{order:['a','b']}},revisions:{content:'remote',layout:'layout'},revision:'all'}
test('legacy page drafts migrate with hidden rows and extras retained',()=>{
 const records={'page:cloud:content':{domain:'website',original:{rows:'cloud|Before'},values:{rows:'!cloud|After|EXTRA'}},'cart:goodslist':{values:{content:'another draft'},original:{content:'original'}}}
 const result=migrateEditorDrafts(records,'website',page)
 assert.equal(result.record.values.content.rows,'!cloud|After|EXTRA')
 assert.equal(result.record.remote,null)
 assert.equal(result.records['cart:goodslist'],records['cart:goodslist'])
 assert.equal(result.records['page:cloud:content'],undefined)
})
test('migration keeps baseline and presents changed server values for comparison',()=>{
 const r=migrateEditorDrafts({'page:cloud:content':{original:{rows:'cloud|Old'},values:{rows:'cloud|Mine'}}},'website',page)
 assert.equal(r.record.original.content.rows,'cloud|Old');assert.equal(r.record.remote,page)
})
test('new editor draft is never replaced by a legacy draft',()=>{
 const current={values:{content:{rows:'cloud|Current'}}};const records={'editor:website:page:cloud':current}
 assert.equal(migrateEditorDrafts(records,'website',page).record,current)
})
