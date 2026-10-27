import test from 'node:test'
import assert from 'node:assert/strict'
import { formatLoginInfo, loginInfoReason } from '../src/lib/product-login-info.js'

test('login copy preserves credentials, deduplicates addresses and copies only the supported fields', () => {
  const host = { name: 'fixture-server', dedicate_ip: '192.0.2.1', assign_ip: '192.0.2.1,192.0.2.2\n2001:db8::2', product_name: 'ignored' }
  const remote = { username: 'root', password: ' space and :符号 ', port: '2222', panel_pass: 'panel-fixture', vpc_private_ip: '10.0.0.2', upstream_url: 'https://ignored.invalid', arbitrary_secret: 'ignored' }
  assert.equal(formatLoginInfo(host, remote), '主机标识：fixture-server\n服务器 IP：192.0.2.1, 192.0.2.2, 2001:db8::2\n内网 IP：10.0.0.2\n用户名：root\n密码： space and :符号 \n端口：2222\n面板密码：panel-fixture')
})

test('login copy handles DCIM and absent passwords without inventing credentials', () => {
  assert.equal(formatLoginInfo({ name: 'physical', card_summary: { ip: '192.0.2.5' } }, { username: 'Administrator', port: 3389 }), '主机标识：physical\n服务器 IP：192.0.2.5\n用户名：Administrator\n端口：3389')
  assert.equal(formatLoginInfo({}, { username: 'root', password: '0', port: 0 }), '用户名：root\n密码：0')
  assert.equal(formatLoginInfo({}, { username: 'root', password: '', port: { value: 22 }, extra: 'ignored' }), '用户名：root')
  assert.equal(formatLoginInfo({}, { username: 'root', port: 65536 }), '用户名：root')
})

test('an empty or malformed login response cannot be copied as if it were successful', () => {
  for (const remote of [undefined, {}, [], { username: {}, password: [] }, { username: '', password: '', port: 22 }, { username: false }]) assert.throws(() => formatLoginInfo({ dedicate_ip: '192.0.2.1' }, remote), /暂未获取到登录信息/)
})

test('copying login details does not depend on power but respects product lifecycle and module', () => {
  for (const module of ['mf_cloud', 'mf_dcim']) for (const status of ['Active', 'Suspended', 'Grace', 'Keep']) assert.equal(loginInfoReason({ module, status, power_status: 'off' }), '')
  for (const status of ['Unpaid', 'Pending', 'Failed', 'Deleted']) assert(loginInfoReason({ module: 'mf_cloud', status }))
  assert(loginInfoReason({ module: 'other', status: 'Active' }))
})
