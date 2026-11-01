import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'
const source = fs.readFileSync(new URL('../../public/clientarea/template/pc/cra1/js/plugin-pages.js', import.meta.url), 'utf8')
function fixture(name, view, handler) {
  const mixins = [], errors = [], successes = [], calls = []
  const root = {Vue: {mixin: m => mixins.push(m)}, document: {documentElement: {getAttribute: () => JSON.stringify([{id: 71, name}]), setAttribute() {}}, querySelector: () => ({})}, location: {pathname: '/plugin/71/' + view + '.htm', origin: 'https://fixture.invalid'}, sessionStorage: {}, CRA1Shared: {Errors: {message: () => '页面错误，请刷新重试'}}, FormData: class {append() {}}}
  vm.runInNewContext(source, {window: root, URL, URLSearchParams, Promise})
  const instance = {$options: {data: () => ({}), methods: {[handler]() {throw Error('native handler should be adapted')}}}, $refs: {}, $message: {error: s => errors.push(s), success: s => successes.push(s), warning: s => errors.push(s)}, lang: {contract_text31: '请签名', contract_text32: '已签约', invoice_text138: '已申请', invoice_text150: '已修改', invoice_text133: '已添加'}}
  mixins[0].beforeCreate.call(instance)
  Object.assign(instance, instance.$options.data.call(instance), instance.$options.methods)
  return {root, instance, errors, successes, calls}
}
const ok = data => ({data: {status: 200, data}})
test('signature capture, upload and sign failures all release loading and stop subsequent actions', async () => {
  for (const step of ['capture', 'upload', 'sign', 'business']) {
    const {root, instance: v, errors, successes, calls} = fixture('EContract', 'signContract', 'saveImage')
    Object.assign(v, {isSign: true, id: 7, dataURLtoFile: () => ({}), signClose: () => calls.push('close')})
    root.html2canvas = async () => {calls.push('capture'); if (step === 'capture') throw Error('failure'); return {toDataURL: () => ''}}
    root.uploadSign = async () => {calls.push('upload'); if (step === 'upload') throw Error('failure'); return ok({save_name: 'fixture.png'})}
    root.signContract = async () => {calls.push('sign'); if (step === 'sign') throw Error('failure'); return {data: {status: 400}}}
    await v.saveImage()
    assert.equal(v.loading, false); assert.deepEqual(errors, ['页面错误，请刷新重试']); assert.equal(successes.length, 0)
    assert.equal(calls.includes('close'), false); assert.equal(root.location.href, undefined)
    if (step === 'capture' || step === 'upload') assert.equal(calls.includes('sign'), false)
  }
})
test('signature submits once and preserves the native successful return flow', async () => {
  const {root, instance: v, calls, successes} = fixture('EContract', 'signContract', 'saveImage')
  Object.assign(v, {isSign: true, id: 7, dataURLtoFile: () => ({}), signClose: () => calls.push('close')})
  root.html2canvas = async () => ({toDataURL: () => ''}); root.uploadSign = async () => ok({save_name: 'fixture.png'})
  root.signContract = async body => {calls.push({...body}); return ok({})}
  await Promise.all([v.saveImage(), v.saveImage()])
  assert.deepEqual(calls, [{id: 7, sign_name: 'fixture.png'}, 'close']); assert.deepEqual(successes, ['已签约'])
  assert.equal(v.loading, false); assert.equal(root.location.href, '/finance.htm?isActive=true')
})
test('invoice validation, rejection and duplicate clicks never create accidental orders', async () => {
  const {root, instance: v, errors, calls} = fixture('IdcsmartInvoice', 'issuedInvoice', 'handlePay')
  let valid = false, finish
  Object.assign(v, {isOk: true, openInvoiceVisible: true, openInvoiceForm: {invoice_title_id: 2}, orderIDList: [3], getTableData: async () => calls.push('read')})
  v.$refs = {openInvoiceFormRef: {validate: cb => cb(valid)}, payDialog: {showPayDialog: id => calls.push(id)}}
  root.addInvoicelAPI = body => {calls.push({...body, order_id: Array.from(body.order_id)}); return new Promise((resolve, reject) => finish = reject)}
  await v.handlePay(); assert.equal(calls.length, 0); assert.equal(v.cra1InvoiceSubmitting, false)
  valid = true; const pending = v.handlePay(); await new Promise(setImmediate); v.handlePay()
  assert.equal(calls.length, 1); assert.equal(v.cra1InvoiceSubmitting, true)
  finish(Error('failure')); await pending
  assert.equal(v.cra1InvoiceSubmitting, false); assert.equal(v.openInvoiceVisible, true); assert.deepEqual(errors, ['页面错误，请刷新重试'])
})
test('invoice success reads back the list before opening the returned payment order', async () => {
  const {root, instance: v, calls, errors} = fixture('IdcsmartInvoice', 'issuedInvoice', 'handlePay')
  Object.assign(v, {isOk: true, openInvoiceVisible: true, openInvoiceForm: {}, orderIDList: [3], getTableData: async () => calls.push('list')})
  v.$refs = {openInvoiceFormRef: {validate: cb => cb(true)}, payDialog: {showPayDialog: id => calls.push(id)}}
  root.addInvoicelAPI = async () => ok({id: 9})
  await v.handlePay(); assert.deepEqual(calls, ['list', 9]); assert.equal(v.openInvoiceVisible, false)
  assert.equal(v.cra1InvoiceSubmitting, false); assert.deepEqual(errors, [])
})
test('invoice address creation and editing use their own payload without leaking global region variables', async () => {
  for (const edit of [false, true]) {
    const {root, instance: v, calls, errors} = fixture('IdcsmartInvoice', 'invoice', 'handleSaveAddress')
    const form = {id: 4, cityArr: ['示例省', '示例市'], rec_type: 'paper'}
    Object.assign(v, {isEditInvoiceAddress: edit, invoiceAddressVisible: true, addInvoiceAddressForm: form, getInvoicelAddress: async () => calls.push('list')})
    v.$refs.addInvoiceAddressFormRef = {validate: cb => cb(true)}
    root.addInvoicelAddressAPI = async body => {calls.push(['create', {...body}]); return ok({})}
    root.editInvoicelAddressAPI = async body => {calls.push(['edit', {...body}]); return ok({})}
    await v.handleSaveAddress()
    assert.deepEqual(calls, [[edit ? 'edit' : 'create', {id: 4, rec_type: 'paper', province: '示例省', city: '示例市', region: ''}], 'list'])
    assert.equal(form.cityArr.length, 2); assert.equal(v.invoiceAddressVisible, false); assert.equal(v.cra1InvoiceSubmitting, false); assert.deepEqual(errors, [])
    root[edit ? 'editInvoicelAddressAPI' : 'addInvoicelAddressAPI'] = async () => {throw Error('failure')}
    v.invoiceAddressVisible = true; await v.handleSaveAddress()
    assert.equal(v.invoiceAddressVisible, true); assert.equal(v.cra1InvoiceSubmitting, false); assert.deepEqual(errors, ['页面错误，请刷新重试'])
  }
})
