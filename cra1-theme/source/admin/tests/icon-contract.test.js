import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRows, serializeRows } from '../src/lib/row-contract.js'
import { iconStyleVars, styleTail } from '../src/lib/icon-style.js'
const cols=['name','url','desc','blank','icon','source','sidebar'].map(key=>({key}))
const style={v:1,mode:'custom',foreground:'#556677',background:{kind:'gradient',from:'#eeeeee',to:'#cccccc',opacity:65,angle:210}}
test('row metadata stays attached through rename, hiding and reordering without consuming sidebar or unknown columns',()=>{
 const original='云产品|/cloud.html|介绍||cloud||sidebar:v1:opaque|unknown-one||unknown-two|'+styleTail({icon:style})+'\n>子菜单|/about.html|说明|1|server|||legacy'
 const rows=parseRows(original,cols)
 assert.deepEqual(rows[0].row.__iconStyles.icon,style)
 assert.equal(rows[0].row.sidebar,'sidebar:v1:opaque')
 assert.equal(rows[0].row.__extra,'unknown-one||unknown-two')
 rows[0].row.name='新名称';rows[0].hidden=true
 const reloaded=parseRows(serializeRows(rows.reverse(),cols),cols)
 assert.deepEqual(reloaded[1].row.__iconStyles.icon,style)
 assert.equal(reloaded[1].hidden,true)
 assert.equal(reloaded[1].row.sidebar,'sidebar:v1:opaque')
 assert.equal(reloaded[1].row.__extra,'unknown-one||unknown-two')
 reloaded[1].row.__iconStyles.icon=null
 const restored=serializeRows(reloaded,cols)
 assert(!restored.includes('@icon-style:'))
 assert(restored.includes('|unknown-one||unknown-two'))
})
test('unrecognised future tail columns round-trip exactly',()=>{
 const line='菜单|/|x||server|||@icon-style:v9:unknown'
 assert.equal(serializeRows(parseRows(line,cols),cols),line)
})
test('manual colours remain independent and inline icons do not gain a background',()=>{
 assert.deepEqual(iconStyleVars(null),{})
 assert.equal(iconStyleVars(style)['--cui-icon-manual-ink'],'#556677')
 assert.equal(iconStyleVars(style)['--cui-icon-background'],'linear-gradient(210deg,#eeeeee,#cccccc)')
 assert.deepEqual(Object.keys(iconStyleVars(style,false)),['--cui-icon-ink','--cui-icon-manual-ink'])
 assert(iconStyleVars({v:1,mode:'preset',preset:'titanium'})['--cui-icon-ink'].includes('--cui-icon-titanium'))
})
