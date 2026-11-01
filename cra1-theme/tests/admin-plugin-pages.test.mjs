import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'
const source = fs.readFileSync(new URL('../backend/Compatibility/admin-pages.js', import.meta.url), 'utf8')
function fixture() {
  const mixins = [], calls = [], errors = []
  const root = {Vue: {mixin: m => mixins.push(m)}, getSmsInterface: async () => ({data: {status: 200, data: {list: [{id: 1, name: 'fixture'}]}}}), getSmsTemplate: async name => {calls.push(name); return {data: {status: 200, data: {list: [{id: 7}]}}}}}
  vm.runInNewContext(source, {window: root})
  const instance = {$options: {methods: {getOssPageConfig() {}, smsTemplate() {}}}, $message: {error: s => errors.push(s)}, smsList: [], smsTemplateList: [], ossPageData: {oss_sms_plugin: ''}, isGetsms: false}
  mixins[0].beforeCreate.call(instance); Object.assign(instance, instance.$options.methods)
  return {root, instance, calls, errors}
}
test('unselected or missing SMS provider never reads an empty template route', async () => {
  const {instance: v, calls, errors} = fixture()
  await v.smsTemplate(); v.ossPageData.oss_sms_plugin = 9; await v.smsTemplate()
  assert.deepEqual(calls, []); assert.deepEqual(errors, []); assert.equal(v.smsList.length, 1)
})
test('valid SMS provider reads templates while request failures remain handled', async () => {
  const {root, instance: v, calls, errors} = fixture(); v.ossPageData.oss_sms_plugin = 1
  await v.smsTemplate(); assert.deepEqual(calls, ['fixture']); assert.equal(v.smsTemplateList[0].id, 7)
  root.getSmsTemplate = async () => {throw Error('private response')}
  await v.smsTemplate(); assert.equal(v.smsTemplateList.length, 0); assert.deepEqual(errors, ['页面错误，请刷新重试'])
})
test('late template responses cannot overwrite the newly selected channel', async () => {
  const {root, instance: v} = fixture(); let finish
  v.isGetsms = true; v.smsList = [{id: 1, name: 'fixture'}]; v.ossPageData.oss_sms_plugin = 1
  root.getSmsTemplate = () => new Promise(r => finish = r)
  const pending = v.smsTemplate(); v.ossPageData.oss_sms_plugin = ''; await v.smsTemplate()
  finish({data: {status: 200, data: {list: [{id: 7}]}}}); await pending
  assert.equal(v.smsTemplateList.length, 0)
})
