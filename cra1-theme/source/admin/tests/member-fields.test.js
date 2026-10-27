import test from 'node:test'
import assert from 'node:assert/strict'
import { memberDisplayFields } from '../src/lib/member-fields.js'
import { hostDisplayFields, hostCardTitle } from '../../member/src/lib/product-config.js'

test('editor choices match frontend defaults and legacy/custom selections',()=>{
  for(const node of [null,{}, {select_field:[]}, {select_field:['product_name']}, {select_field:[],select_field_set:true}, {select_field:['area','instance_name'],select_field_set:true,select_field_version:2}]) {
    assert.deepEqual([...memberDisplayFields(node)], [...hostDisplayFields(node)])
  }
  const firstChange=[...memberDisplayFields({select_field:[]}), 'area']
  assert.ok(firstChange.includes('ip')&&firstChange.includes('status')&&firstChange.includes('instance_name'))
})
test('new name choices are independent and preserve old cards until edited',()=>{
  const host={id:7,product_name:'商品名',name:'实例名'}
  assert.ok(hostDisplayFields({select_field:['product_name']}).has('instance_name'))
  assert.equal(hostDisplayFields({select_field:['product_name'],select_field_version:2}).has('instance_name'),false)
  assert.equal(hostCardTitle(host,hostDisplayFields({select_field:['instance_name'],select_field_version:2})),'实例名')
  assert.equal(hostCardTitle(host,hostDisplayFields({select_field:[],select_field_set:true,select_field_version:2})),'产品 #7')
})
