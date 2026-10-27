import test from 'node:test'
import assert from 'node:assert/strict'
import { quickActionOptions, quickDialogCapabilities, reinstallImages } from '../src/lib/product-operations.js'

const ready = { host: { id:1, module:'mf_cloud', status:'Active' }, power:{status:'on'}, cloud:{config:{manual_manage:0}}, ready:true }
const enabled = value => quickActionOptions(value).filter(action => !action.disabled).map(action => action.key)

test('power choices reflect confirmed state and all five requested actions are present', () => {
  assert.deepEqual(quickActionOptions(ready).map(action => action.key),['reboot','reinstall','powerOn','powerOff','resetPass'])
  assert.deepEqual(enabled(ready),['reboot','reinstall','powerOff','resetPass'])
  assert.deepEqual(enabled({...ready,power:{status:'off'}}),['reinstall','powerOn','resetPass'])
})
test('unknown, loading, unprovisioned and unsupported instances cannot submit operations', () => {
  for (const state of ['pending','operating','fault','suspend','unknown']) assert.deepEqual(enabled({...ready,power:{status:state}}),[])
  for (const status of ['Unpaid','Pending','Suspended','Deleted','Failed']) assert.deepEqual(enabled({...ready,host:{...ready.host,status}}),[])
  assert.deepEqual(enabled({...ready,ready:false}),[])
  assert.deepEqual(enabled({...ready,busy:true}),[])
  assert.deepEqual(enabled({...ready,host:{...ready.host,module:'custom'}}),[])
})
test('manual management and failed reinstall settings cannot bypass restrictions', () => {
  assert.deepEqual(enabled({...ready,cloud:{config:{manual_manage:'1'}}}),['reboot','powerOff'])
  assert.deepEqual(enabled({...ready,cloud:{config:{manual_manage:'0'}}}),['reboot','reinstall','powerOff','resetPass'])
  assert.deepEqual(enabled({...ready,orderReady:false}),['reboot','powerOff','resetPass'])
  assert.deepEqual(enabled({...ready,host:{...ready.host,module:'mf_dcim'}}),['reboot','reinstall','powerOff','resetPass'])
})
test('reinstall capabilities use product port rules and manual-management SSH restrictions', () => {
  const caps=quickDialogCapabilities({config:{manual_manage:0}},{support_ssh_key:1,rand_ssh_port:2,rand_ssh_port_linux:2233,rand_ssh_port_windows:3388})
  assert.equal(caps.sshKey,true);assert.equal(caps.portMode,2);assert.equal(caps.portCfg.linux,2233)
  assert.equal(quickDialogCapabilities({config:{manual_manage:1}},{support_ssh_key:1}).sshKey,false)
})
test('cloud and physical image groups retain backend order and image ownership metadata', () => {
  const groups=[{id:2,name:'Debian',image:[{id:21,name:'Debian 12',charge:1,price:'5.00'},{id:20,name:'Debian 11'}]},{id:1,name:'Windows',image:[{id:10,name:'Windows Server'}]}]
  const images=reinstallImages(groups)
  assert.deepEqual(images.map(image=>image.id),[21,20,10])
  assert.equal(images[0].image_group_name,'Debian');assert.equal(images[0].charge,1);assert.equal(images[0].price,'5.00')
  assert.deepEqual(reinstallImages([{id:5,name:'Flat image',image_group_name:'Legacy'}]),[{id:5,name:'Flat image',image_group_name:'Legacy'}])
  assert.throws(()=>reinstallImages(null),/不完整/)
})
