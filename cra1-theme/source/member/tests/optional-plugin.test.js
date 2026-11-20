import { test } from 'node:test'
import assert from 'node:assert/strict'
import { optionalPluginUnavailable } from '../src/optional-plugin.js'

test('only exact unavailable-feature business errors permit optional-plugin fallback', () => {
  for (const msg of ['功能未授权', '插件未授权', '插件未安装', '插件未启用', '插件已停用', '功能未启用', '功能未开启']) {
    assert.equal(optionalPluginUnavailable({ code: 'API_ERROR', status: 400, data: { status: 400, msg } }), true, msg)
  }
  assert.equal(optionalPluginUnavailable({ status: '400', message: ' 功能未授权。 ' }), true)
  assert.equal(optionalPluginUnavailable({ response: { status: 200, data: { status: 400, msg: '功能未授权' } } }), true)
  assert.equal(optionalPluginUnavailable({ response: { status: 400, data: { status: 400, message: '插件未启用！' } } }), true)
  for (const msg of ['无权访问', '请先登录', '请填写必填资料', '功能未授权，请联系管理员核验', '', '请求失败']) {
    assert.equal(optionalPluginUnavailable({ code: 'API_ERROR', status: 400, data: { status: 400, msg } }), false, msg)
  }
})

test('transport and business status disagreement never hides permission or service failures', () => {
  for (const status of [0, 200, 401, 403, 404, 500, 503]) {
    assert.equal(optionalPluginUnavailable({ code: 'API_ERROR', status, data: { status: 400, msg: '功能未授权' } }), false, `request status ${status}`)
  }
  for (const status of [0, 401, 403, 404, 500, 503]) {
    assert.equal(optionalPluginUnavailable({ response: { status, data: { status: 400, msg: '功能未授权' } } }), false, `transport status ${status}`)
  }
  for (const status of [200, 401, 403, 500]) {
    assert.equal(optionalPluginUnavailable({ code: 'API_ERROR', status: 400, data: { status, msg: '功能未授权' } }), false, `business status ${status}`)
  }
})

test('session, cancellation, network and malformed-response codes never permit fallback', () => {
  for (const code of ['UNAUTHORIZED', 'CANCELLED', 'TIMEOUT', 'NETWORK', 'NETWORK_ERROR', 'BAD_RESPONSE', 'SECURITY_CANCELLED']) {
    assert.equal(optionalPluginUnavailable({ code, status: 400, data: { status: 400, msg: '功能未授权' } }), false, code)
  }
  for (const value of [undefined, null, {}, new Error('功能未授权'), { data: { msg: '功能未授权' } }]) {
    assert.equal(optionalPluginUnavailable(value), false)
  }
})
