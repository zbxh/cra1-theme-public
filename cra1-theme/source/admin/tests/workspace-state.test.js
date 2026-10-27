import test from 'node:test'
import assert from 'node:assert/strict'
import { threeWay, setAt, changes, editorChanges } from '../src/lib/workspace-state.js'
import { parseRows, serializeRows } from '../src/lib/row-contract.js'

test('independent nested changes merge without replacing either draft', () => {
  const base = { copy:{title:'old',desc:'old'}, rows:['a','b'] }
  const local = { copy:{title:'mine',desc:'old'}, rows:['a','b'] }
  const remote = { copy:{title:'old',desc:'theirs'}, rows:['b','a'] }
  const result = threeWay(base,local,remote)
  assert.deepEqual(result,{value:{copy:{title:'mine',desc:'theirs'},rows:['b','a']},conflicts:[]})
  assert.equal(local.copy.desc,'old')
})
test('conflicting values require a choice and keep local content', () => {
  const result = threeWay({title:'old'},{title:'mine'},{title:'theirs'})
  assert.equal(result.value.title,'mine')
  assert.equal(result.conflicts.length,1)
  assert.deepEqual(setAt(result.value,result.conflicts[0].path,result.conflicts[0].remote),{title:'theirs'})
})
test('deleting a map entry preserves an unrelated remote addition', () => {
  const result = threeWay({overrides:{abcdef:{title:'old'}}},{overrides:{}},{overrides:{abcdef:{title:'old'},ghijkl:{title:'new'}}})
  assert.deepEqual(result,{value:{overrides:{ghijkl:{title:'new'}}},conflicts:[]})
})
test('lists are compared as a unit when both sessions reorder', () => {
  const result = threeWay({rows:['a','b','c']},{rows:['b','a','c']},{rows:['a','c','b']})
  assert.equal(result.conflicts.length,1)
  assert.deepEqual(result.conflicts[0].path,['rows'])
})
test('scope patch includes changed keys only', () => {
  assert.deepEqual(changes({title:'x',layout:['a']},{title:'x',layout:['b']}),{layout:['b']})
})
test('whole-page patch leaves untouched inherited content outside overrides', () => {
  const base = { content: { title: 'Inherited', rows: '', fallback: '' }, layout: { order: ['a', 'b'], visibility: { a: 'inherit' } }, seo: { title: '' } }
  const draft = structuredClone(base)
  draft.content.title = 'This page'
  draft.layout.visibility.a = 'hide'
  assert.deepEqual(editorChanges(base, draft), { content: { title: 'This page' }, layout: { visibility: { a: 'hide' } } })
  draft.content.rows = null
  assert.deepEqual(editorChanges(base, draft).content, { title: 'This page', rows: null })
})
test('composite patches keep nested scope contracts atomic', () => {
  const base = { main: { content: { notices: { items: [{title:'Old'}] } }, custom_code: {css:'',js:''} } }
  const draft = { main: { ...base.main, content: { notices: { items: [] } } } }
  assert.deepEqual(editorChanges(base, draft), { main: { content: { notices: { items: [] } } } })
})
test('row editing retains hidden state, depth and unknown extra columns', () => {
  const cols=[{key:'title'},{key:'desc'}]
  const text='!>>Title|Description|EXTRA||'
  const rows=parseRows(text,cols)
  assert.equal(serializeRows(rows,cols),text)
  rows[0].row.desc='Updated'
  assert.equal(serializeRows(rows,cols),'!>>Title|Updated|EXTRA||')
  assert.equal(serializeRows(parseRows('A|B|',cols),cols),'A|B|')
})
test('copy values with embedded pipes keep their remainder contract', () => {
  const cols=[{key:'key'},{key:'value',remainder:true}]
  assert.equal(serializeRows(parseRows('desc|A|B|C',cols),cols),'desc|A|B|C')
})

test('Chinese copy inputs save through both legacy column contracts and retain unknown rows', async () => {
  const { updateCopyText } = await import('../src/lib/row-contract.js')
  for (const cols of [[{key:'name'},{key:'desc',remainder:true}],[{key:'key'},{key:'text',remainder:true}]]) {
    const text='!txt1|Hidden\ntxt1|Shown\nunknown|A|B'
    assert.equal(updateCopyText(text,cols,'txt1','中文按钮'),'!txt1|Hidden\ntxt1|中文按钮\nunknown|A|B')
    assert.equal(updateCopyText(text,cols,'new_key',''),'!txt1|Hidden\ntxt1|Shown\nunknown|A|B\nnew_key|')
  }
})
