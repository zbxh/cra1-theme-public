import test from 'node:test'
import assert from 'node:assert/strict'
import { refreshForOperation, changedUpgradeResources, REFRESH_INTERVALS, orderOperation } from '../src/pages/serverPanel/refresh-policy.js'
test('power, network, disks and security operations use their own affected resources',()=>{
  assert.deepEqual(refreshForOperation('power').track,['power'])
  assert.deepEqual(refreshForOperation('diskMount').track,['disks'])
  assert.deepEqual(refreshForOperation('securityGroup'),{track:['detail'],once:['securityRules','logs']})
  assert.deepEqual(refreshForOperation('notes'),{track:[],once:['host','logs']})
  assert.deepEqual(refreshForOperation('flowPacket'),{track:['flow'],once:['orders','logs']})
})
test('backup/snapshot operations map to actual isBackup marker and renewal reads billing only',()=>{
  assert.deepEqual(refreshForOperation('bsCreate',{isBackup:true}).track,['backup'])
  assert.deepEqual(refreshForOperation('bsDelete',{isBackup:false}).track,['snapshot'])
  assert.deepEqual(refreshForOperation('renew'),{track:['host'],once:['orders','logs']})
  assert.equal(orderOperation({type:'renew'}),'renew')
})
test('elastic CPU-only upgrade does not reread disks or IPs; IP upgrade uses only changed address family',()=>{
  const cloud={cpu:1,memory:1,ip_num:2,ipv6_num:0,flow:100,image:{id:12}}
  assert.deepEqual(changedUpgradeResources(cloud,{cpu:2,memory:1,ip_num:2,image_id:12}),['usage'])
  assert.deepEqual(refreshForOperation('upgradeElastic',{resources:['usage']}).track,['detail'])
  assert.deepEqual(changedUpgradeResources(cloud,{cpu:1,ip_num:3}),['ipv4'])
  assert.deepEqual(refreshForOperation('upgradeElastic',{resources:['ipv4']}).track,['detail','ipv4'])
})
test('central maintenance intervals match agreed independent periods',()=>{
  assert.equal(REFRESH_INTERVALS.power,15000);assert.equal(REFRESH_INTERVALS.usage,10000)
  assert.equal(REFRESH_INTERVALS.disks,30000);assert.equal(REFRESH_INTERVALS.ipv4,60000)
  assert.equal(REFRESH_INTERVALS.securityRules,120000);assert.equal(REFRESH_INTERVALS.host,300000)
  assert.equal(REFRESH_INTERVALS.remote,0);assert.equal(REFRESH_INTERVALS.orders,0)
})
test('paid image and app purchases refresh metadata without running installation or power tracking',()=>{
  for(const operation of ['imageOrder','appPreset'])assert.deepEqual(refreshForOperation(operation),{track:[],once:['host','detail','orders','logs']})
})
