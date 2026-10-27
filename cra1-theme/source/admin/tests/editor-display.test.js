import test from 'node:test'
import assert from 'node:assert/strict'
import {moduleVisible,effectiveContent} from '../src/lib/editor-display.js'

test('restoring visibility uses inherited state immediately in both directions',()=>{
  const module={id:'pricing',visibilityKey:'show_pricing'}
  for(const saved of [true,false]){
    const resolved={visibility:{pricing:saved},inheritedVisibility:{pricing:!saved}}
    assert.equal(moduleVisible(module,{visibility:{pricing:'inherit'}},resolved),!saved)
    assert.equal(moduleVisible(module,{visibility:{pricing:'show'}},resolved),true)
    assert.equal(moduleVisible(module,{visibility:{pricing:'hide'}},resolved),false)
  }
  assert.equal(moduleVisible({id:'system'},{},{}),true)
})

test('pending default restores resolve flattened fields without losing deliberate empty values',()=>{
  const values={card1_title:null,card1_desc:'',card2_title:'自定义'}
  const defaults={card1_title:'默认标题',card1_desc:'默认说明',card2_title:'其他'}
  assert.deepEqual(effectiveContent(values,defaults),{card1_title:'默认标题',card1_desc:'',card2_title:'自定义'})
  assert.equal(values.card1_title,null)
})
