import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeFlowPackets, defaultFlowPacketType, flowPacketOrderBody } from '../src/pages/serverPanel/flow-packets.js'
test('catalog accepts numeric strings and uses capacity for fixed packages',()=>{
  const [p]=normalizeFlowPackets([{id:'3',billing_mode:'0',long_term_valid:'1',capacity:'50'}])
  assert.equal(p.capacity,50);assert.equal(p.billing_mode,0);assert.equal(defaultFlowPacketType([p]),1)
  assert.deepEqual(flowPacketOrderBody(p,'abc'),{flow_packet_id:3})
})
test('initial category chooses available limited then unlimited, including limited packages at purchase limit',()=>{
  const ps=normalizeFlowPackets([{id:1,long_term_valid:0,monthly_purchase_limit_reached:'1'},{id:2,long_term_valid:1}])
  assert.equal(defaultFlowPacketType(ps),1)
  assert.equal(defaultFlowPacketType(normalizeFlowPackets([{id:1,long_term_valid:0},{id:2,long_term_valid:1}])),0)
})
test('range capacity is validated; fixed orders omit selected_capacity; reached limits reject',()=>{
  const [p]=normalizeFlowPackets([{id:'1',billing_mode:'1',min_capacity:'10',max_capacity:'100'}])
  assert.deepEqual(flowPacketOrderBody(p,'20'),{flow_packet_id:1,selected_capacity:20})
  for(const v of ['',0,9,101,'abc'])assert.throws(()=>flowPacketOrderBody(p,v))
  assert.deepEqual(flowPacketOrderBody(p),{flow_packet_id:1,selected_capacity:10})
  assert.throws(()=>flowPacketOrderBody({...p,monthly_purchase_limit_reached:1},20),/上限/)
})
test('malformed catalog produces visible error instead of empty data',()=>{
  assert.throws(()=>normalizeFlowPackets(undefined),/格式/);assert.deepEqual(normalizeFlowPackets([]),[])
})
