import test from 'node:test'
import assert from 'node:assert/strict'
import { autoRenewReason, configurationReason, createActionLoader, renewalReason, securityGroupUrl, upgradeMatches, ACTION_STATE_TTL, SECURITY_ACTION, UPGRADE_ACTION } from '../src/lib/product-action-state.js'
import { QUICK_ACTIONS, quickActionOptions } from '../src/lib/product-operations.js'

const host = { id: 9, product_id: 4, name: 'fixture', module: 'mf_cloud', status: 'Active', billing_cycle: 'monthly' }
const action = key => QUICK_ACTIONS.find(item => item.key === key)
function fixture(extra = {}) {
  let time = 1000
  const paths = [], data = { '/mf_cloud/9/status': { status: 'on' }, '/mf_cloud/9': { config: { manual_manage: 0 } }, '/product/4/mf_cloud/order_page': { config: { support_ssh_key: 1 } }, '/host/9/renew': { host: [{ billing_cycle: 'monthly', price: 10 }] }, ...extra }
  const loader = createActionLoader({ host, now: () => time, read: async path => { paths.push(path); if (data[path] instanceof Error) throw data[path]; return { data: data[path] } } })
  return { loader, paths, data, tick: ms => { time += ms } }
}
test('menu choices need no network and unknown runtime state does not block selection', () => {
  const f = fixture()
  assert.equal(f.loader.peekPower(), null); assert.equal(f.paths.length, 0)
  assert.equal(quickActionOptions({ host, deferCheck: true }).filter(item => item.disabled).length, 0)
  assert(quickActionOptions({ host: { ...host, status: 'Suspended' }, deferCheck: true }).every(item => item.disabled))
})
test('power actions load only runtime state, not host details or reinstall configuration', async () => {
  const f = fixture(); await f.loader.prepare(action('reboot'))
  assert.deepEqual(f.paths, ['/mf_cloud/9/status'])
})
test('reset password loads its rules and power state without loading order configuration', async () => {
  const f = fixture(); await f.loader.prepare(action('resetPass'))
  assert.deepEqual(new Set(f.paths), new Set(['/mf_cloud/9/status', '/mf_cloud/9']))
})
test('reinstall loads all needed rules in parallel and preserves capability data', async () => {
  const f = fixture(); const result = await f.loader.prepare(action('reinstall'))
  assert.equal(f.paths.length, 3); assert.equal(result.orderConfig.support_ssh_key, 1)
})
test('short-lived runtime results are reused, then expire; operations invalidate caches', async () => {
  const f = fixture(); await f.loader.prepare(action('reboot')); await f.loader.prepare(action('powerOff')); assert.equal(f.paths.length, 1)
  f.tick(ACTION_STATE_TTL + 1); assert.equal(f.loader.peekPower(), null)
  await f.loader.prepare(action('reboot')); assert.equal(f.paths.length, 2)
  f.loader.invalidate(); await f.loader.prepare(action('reboot')); assert.equal(f.paths.length, 3)
})
test('concurrent actions share a read; failed reads are retried instead of cached', async () => {
  const f = fixture(); await Promise.all([f.loader.prepare(action('reboot')), f.loader.prepare(action('powerOff'))]); assert.equal(f.paths.length, 1)
  f.loader.invalidate(); f.data['/mf_cloud/9/status'] = new Error('暂时无法获取服务器状态，请稍后重试')
  await assert.rejects(f.loader.prepare(action('reboot'))); f.data['/mf_cloud/9/status'] = { status: 'on' }
  await f.loader.prepare(action('reboot')); assert.equal(f.paths.length, 3)
})
test('late responses cannot repopulate an invalidated cache', async () => {
  let release; const loader = createActionLoader({ host, read: () => new Promise(resolve => { release = resolve }) })
  const pending = loader.prepare(action('reboot')); await Promise.resolve(); loader.invalidate(); release({ data: { status: 'on' } }); await pending
  assert.equal(loader.peekPower(), null)
})
test('fresh power and manual-management restrictions are enforced after selection', async () => {
  for (const state of ['operating', 'pending', 'fault', 'suspend']) await assert.rejects(fixture({ '/mf_cloud/9/status': { status: state } }).loader.prepare(action('reboot')))
  const f = fixture({ '/mf_cloud/9/status': { status: 'off' } }); await assert.rejects(f.loader.prepare(action('reboot')), /已关机/); await f.loader.prepare(action('powerOn'))
  await assert.rejects(fixture({ '/mf_cloud/9': { config: { manual_manage: 1 } } }).loader.prepare(action('reinstall')), /人工管理/)
})
test('renewal loads no server status and honors authoritative renewal restrictions', async () => {
  const f = fixture(); await f.loader.prepare({ type: 'renew' }); assert.deepEqual(f.paths, ['/host/9/renew'])
  await assert.rejects(fixture({ '/host/9/renew': { renew_forbidden: 1, host: [] } }).loader.prepare({ type: 'renew' }), /不允许续费/)
  for (const billing_cycle of ['free', 'onetime', 'on_demand']) assert(renewalReason({ ...host, billing_cycle }))
})
test('remote login validates current power state and never creates a console by itself', async () => {
  const f = fixture(); await f.loader.prepare({ type: 'vnc' }); assert.deepEqual(f.paths, ['/mf_cloud/9/status'])
  await assert.rejects(fixture({ '/mf_cloud/9/status': { status: 'off' } }).loader.prepare({ type: 'vnc' }), /开机后/)
})

test('security-group navigation reads the latest binding without querying power or a group list', async () => {
  const f = fixture({ '/mf_cloud/9': { security_group: { id: 37 } } })
  assert.equal((await f.loader.prepare(SECURITY_ACTION)).url, '/group_rules.htm?id=37')
  f.data['/mf_cloud/9'] = { security_group: { id: '0' } }
  assert.equal((await f.loader.prepare(SECURITY_ACTION)).url, '/security_group.htm')
  assert.deepEqual(f.paths, ['/mf_cloud/9', '/mf_cloud/9'])
  for (const security_group of [undefined, {}, { id: -1 }, { id: '3&host=9' }, { id: true }]) assert.throws(() => securityGroupUrl({ security_group }), /无法读取/)
})

test('security-group navigation follows product capability and remains available while suspended', async () => {
  assert.equal(configurationReason({ ...host, status: 'Suspended' }, 'security'), '')
  assert(configurationReason({ ...host, status: 'Suspended' }, 'upgrade'))
  assert(configurationReason({ ...host, module: 'mf_dcim' }, 'security'))
  for (const status of ['Deleted', 'Unpaid', 'Pending', 'Failed']) assert(configurationReason({ ...host, status }, 'security'))
})

test('upgrade prepares current configuration without reading runtime, prices or unselected upgrade rules', async () => {
  const f = fixture({ '/mf_cloud/9': { cpu: 1, memory: 1, config: { manual_manage: 0 } } })
  const context = await f.loader.prepare(UPGRADE_ACTION)
  assert.equal(context.cloud.cpu, 1); assert.equal(context.preparedAt, 1000)
  assert.deepEqual(f.paths, ['/mf_cloud/9'])
  await assert.rejects(fixture({ '/mf_cloud/9': { config: { manual_manage: 1 } } }).loader.prepare(UPGRADE_ACTION), /人工管理/)
  await assert.rejects(fixture({ '/mf_cloud/9': {} }).loader.prepare(UPGRADE_ACTION), /无法读取/)
})

test('upgrade refresh waits for all requested resources, including IP counts, before settling', () => {
  const context = { configuration: { cpu: 2, memory: 4, ip_num: 2, ipv6_num: 0, bw: undefined } }
  assert.equal(upgradeMatches({ cpu: 2, memory: 4, ip_num: 1, ipv6_num: 0 }, context), false)
  assert.equal(upgradeMatches({ cpu: '2', memory: 4, ip_num: 2, ipv6_num: '0' }, context), true)
  assert.equal(upgradeMatches({}, { configuration: {} }), false)
  assert.equal(upgradeMatches({ recommend_config: { id: 11 } }, { recommendConfigId: 11 }), true)
})

test('automatic renewal uses its own lifecycle and billing restrictions rather than power status', () => {
  assert.equal(autoRenewReason({ ...host, status: 'Suspended', power_status: 'off' }), '')
  for (const billing_cycle of ['', 'free', 'onetime', 'on_demand', '免费', '一次性', '按需']) assert.match(autoRenewReason({ ...host, billing_cycle }), /自动续费/)
  assert(autoRenewReason({ ...host, renew_forbidden: 1 }))
  assert(autoRenewReason({ ...host, status: 'Deleted' }))
})
