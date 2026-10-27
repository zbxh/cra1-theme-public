import test from 'node:test'
import assert from 'node:assert/strict'
import {parseRows,serializeRows} from '../src/lib/row-contract.js'
import {navigationDepth,readMenuSidebar,writeMenuSidebar} from '../src/lib/menu-sidebar.js'
const cols=[{key:'name'},{key:'url'},{key:'desc'},{key:'blank',type:'checkbox'},{key:'icon'},{key:'source'}]
test('four-level editing preserves hidden branches, icons, source and link flags',()=>{
 const raw='Products|/cart/goodsList.htm||1|cart|cart\nManual|/manual|Introduction|0|cloud|\n>First|/first||0|server|\n!>>Hidden group|/hidden||0|book|\n>>>Fourth|/cart/goods.htm?id=6||1|cpu||EXTRA'
 const parsed=parseRows(raw,cols)
 assert.deepEqual(parsed.map(r=>r.level),[1,1,2,3,4])
 assert.equal(parsed[0].row.source,'cart')
 assert.equal(parsed[2].row.blank,'')
 assert.equal(parsed[3].hidden,true)
 parsed[4].row.name='Updated product'
 const saved=serializeRows(parsed,cols)
 const restored=parseRows(saved,cols)
 assert.equal(restored[4].level,4)
 assert.equal(restored[4].row.name,'Updated product')
 assert.equal(restored[4].row.__extra,'EXTRA')
 assert.equal(restored[4].row.blank,'1')
 assert.equal(restored[4].row.icon,'cpu')
 assert.equal(restored[0].row.source,'cart')
 assert.equal(restored[3].hidden,true)
})

test('sidebar stays on its menu through rename/reorder and safely stores nested row text',()=>{
 const schema=[...cols,{key:'sidebar',type:'menu-sidebar'}]
 const sidebar={version:1,title:'标题 | 换行\n新标题',description:'说明\n第二行',overview:{enabled:true,name:'总览',url:'/cloud.html?a=1&b=2',blank:true},links:'帮助|/document.html||0\n!隐藏|/hidden||1\n联系|/contact.html||1'}
 const rows=parseRows('First|/first||0|||'+writeMenuSidebar(sidebar)+'\nSecond|/second||1||',schema)
 rows[0].row.name='Renamed';rows.reverse()
 const roundtrip=parseRows(serializeRows(rows,schema),schema)
 assert.equal(roundtrip.length,2)
 assert.deepEqual(readMenuSidebar(roundtrip[1].row.sidebar,roundtrip[1].row,2),sidebar)
 assert.equal(roundtrip[1].row.name,'Renamed')
 assert.equal(roundtrip[0].row.sidebar,'')
})

test('sidebar defaults respect menu depth while explicit clearing stays empty',()=>{
 const row={name:'Parent',url:'/parent',desc:'Introduction',blank:'1'}
 assert.equal(readMenuSidebar('',row,2,'Help|/help').links,'Help|/help')
 assert.equal(readMenuSidebar('',row,3,'Help|/help').links,'')
 const explicit={version:1,title:'',description:'',overview:{enabled:false,name:'',url:'',blank:false},links:''}
 assert.deepEqual(readMenuSidebar(writeMenuSidebar(explicit),row,2,'Help|/help'),explicit)
 assert.equal(readMenuSidebar('%invalid',row,2).title,'Parent')
 assert.equal(navigationDepth({row:{source:'cart'},children:[]}),4)
 assert.equal(navigationDepth({children:[{children:[{children:[]}]}]}),3)
})
