import path from 'node:path'
import {createRequire} from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
const member = new URL('../source/member/', import.meta.url).pathname
const {buildSync} = createRequire(path.join(member, 'package.json'))('esbuild')
const result = buildSync({stdin: {contents: "export {detectServerModule} from './src/pages/serverPanel/api.js'", resolveDir: member}, bundle: true, format: 'esm', platform: 'node', write: false, define: {'import.meta.env': '{}'}, logLevel: 'silent'})
globalThis.window = {CRA1Shared: {UI: {}, Request: {}}}
const {detectServerModule} = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
test('each registered panel reads exactly its own module; other modules issue no panel request', async () => {
  for (const module of ['mf_cloud', 'mf_dcim', 'idcsmart_common', 'custom_module', '']) {
    const calls = [], detail = {id: 12}
    const result = await detectServerModule(12, {id: 12, module}, async p => {calls.push(p); return {data: detail}})
    assert.deepEqual(calls, ['mf_cloud', 'mf_dcim'].includes(module) ? ['/' + module + '/12'] : [])
    assert.equal(result?.module || null, ['mf_cloud', 'mf_dcim'].includes(module) ? module : null)
  }
})
test('registered module failures cannot silently fall back to a different module or an empty panel', async () => {
  for (const invalid of [null, {}, {status: 'on'}]) {
    const calls = []
    await assert.rejects(detectServerModule(12, {id: 12, module: 'mf_dcim'}, async p => {calls.push(p); return {data: invalid}}), /页面错误/)
    assert.deepEqual(calls, ['/mf_dcim/12'])
  }
  const calls = []
  await assert.rejects(detectServerModule(12, {id: 12, module: 'mf_cloud'}, async p => {calls.push(p); throw Error('network')}))
  assert.deepEqual(calls, ['/mf_cloud/12'])
})
