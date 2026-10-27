import test from 'node:test'
import assert from 'node:assert/strict'
import { loadProductCardSummaries, productCardPrice, productCardSpecs, productNetwork, productPageNumbers, productSystemIcon, projectServerCard } from '../src/lib/product-card-data.js'

test('V10 image identifiers and custom system image URLs resolve without theme icons', () => {
  assert.equal(productSystemIcon({ module: 'mf_cloud', image_icon: 'Debian' }), '/plugins/server/mf_cloud/template/clientarea/pc/default/img/mf_cloud/Debian.svg')
  assert.equal(productSystemIcon({ module: 'mf_dcim', image_icon: 'CentOS' }), '/plugins/server/mf_dcim/template/clientarea/pc/default/img/mf_dcim/CentOS.svg')
  assert.equal(productSystemIcon({ image_icon: '/upload/os/custom.svg' }), '/upload/os/custom.svg')
  assert.equal(productSystemIcon({ card_summary: { imageIconUrl: 'https://example.com/image.svg' } }), 'https://example.com/image.svg')
  assert(productSystemIcon({ image_icon: '../../fake', card_summary: { imageIconUrl: 'javascript:alert(1)' } }).endsWith('/%E5%85%B6%E4%BB%96.svg'))
})

test('network icons follow explicit server network type and unknown data stays unknown', () => {
  assert.equal(productNetwork({ card_summary: { networkType: 'vpc' } }).label, 'VPC 网络')
  assert(productNetwork({ network_type: 'normal' }).icon.endsWith('/classical.svg'))
  assert.deepEqual(productNetwork({ module: 'mf_dcim' }), { type: '', label: '', icon: '' })
})

test('current prices retain product cycle names and do not depend on renewal eligibility', () => {
  assert.deepEqual(productCardPrice({ billing_cycle: '月付', first_payment_amount: '9.00', renew_amount: '82.00', renew_forbidden: 1 }), { amount: '82.00', cycle: '月付', prefix: '¥', suffix: '' })
  assert.deepEqual(productCardPrice({ billing_cycle: 'recurring_prepayment', billing_cycle_name: '每 45 天', renew_amount: '120', currency_prefix: '$', suffix: '' }), { amount: '120.00', cycle: '每 45 天', prefix: '$', suffix: '' })
  assert.equal(productCardPrice({ billing_cycle: '年付', first_payment_amount: '99.00' }), null)
})

test('one-time, free and metered prices use the correct amounts and preserve precision', () => {
  assert.deepEqual(productCardPrice({ billing_cycle: '', first_payment_amount: '100.00', renew_amount: '0.00' }), { amount: '100.00', cycle: '一次性', prefix: '¥', suffix: '' })
  assert.equal(productCardPrice({ billing_cycle: 'onetime', first_payment_amount: '25.00', renew_amount: '0' }).amount, '25.00')
  assert.equal(productCardPrice({ billing_cycle: 'free', renew_amount: '0' }).amount, '0.00')
  assert.deepEqual(productCardPrice({ billing_cycle: '每小时', renew_amount: '0.0034' }), { amount: '0.0034', cycle: '每小时', prefix: '¥', suffix: '' })
  assert.equal(productCardPrice({ billing_cycle: 'on_demand', billing_cycle_name: '小时', renew_amount: '0.1' }).amount, '0.1000')
  assert.equal(productCardPrice({ billing_cycle: '月', renew_amount: 'invalid' }), null)
})

test('cloud configuration uses actual CPU, summed disks and bandwidth, keeping credentials out', () => {
  const summary = projectServerCard({ cpu: 1, memory: 1, system_disk: { size: 30 }, data_disk: { total_size: 30 }, bw: 60, network_type: 'normal', image: { name: 'Debian-12.0_x64', icon: 'Debian' }, username: 'private', password: 'private', config: { secret: true } }, 'mf_cloud')
  assert.deepEqual(summary.cpu, { value: '1', unit: '核' })
  assert.deepEqual(summary.disk, { value: '60', unit: 'GB' })
  assert.deepEqual(summary.bandwidth, { value: '60', unit: 'Mbps' })
  for (const key of ['username', 'password', 'config']) assert.equal(Object.hasOwn(summary, key), false)
  const parsed = productCardSpecs({ module: 'mf_cloud', base_info: '2核-1G-30G', card_summary: { ...summary, disk: null } })
  assert.equal(parsed.cpu.value, '1')
  assert.equal(parsed.disk.value, '30')
})

test('DCIM CPU models and storage descriptions remain text rather than invented core counts', () => {
  const summary = projectServerCard({ model_config: { cpu: 'Xeon E5-2680 v4 ×2', memory: '256G DDR4', disk: '200GB SSD' }, bw: 0 }, 'mf_dcim')
  assert.deepEqual(summary.cpu, { value: 'Xeon E5-2680 v4 ×2', unit: '' })
  assert.deepEqual(summary.memory, { value: '256G DDR4', unit: '' })
  assert.deepEqual(summary.bandwidth, { value: '0', unit: 'Mbps' })
  assert.deepEqual(productCardSpecs({ module: 'mf_dcim', base_info: '8888TEST-256G-200GB SSD' }), {})
})

test('configured traffic quotas stay distinct from bandwidth, unlimited and temporary flow', () => {
  for (const module of ['mf_cloud', 'mf_dcim']) {
    const summary = projectServerCard({ flow: '500', bw: 60, line: { bill_type: 'flow' }, temp_flow: 27, recommend_config: { flow: 999 }, password: 'private' }, module)
    assert.deepEqual(summary.traffic, { value: '500', unit: 'GB' })
    assert.equal(productCardSpecs({ module, card_summary: summary }).traffic.value, '500')
    assert.equal(summary.bandwidth.value, '60')
    assert.equal(Object.hasOwn(summary, 'temp_flow'), false)
    assert.equal(Object.hasOwn(summary, 'password'), false)
    for (const flow of [0, '0', null, undefined, '', -1, true, 'invalid']) assert.equal(projectServerCard({ flow, line: { bill_type: 'flow' } }, module).traffic, undefined)
    assert.deepEqual(projectServerCard({ flow: 500, line: { bill_type: 'bw' } }, module).traffic, { value: '500', unit: 'GB' })
  }
})

test('server summaries limit concurrency, tolerate individual failure and skip irrelevant fields', async () => {
  let pending = 0, peak = 0, calls = 0
  const results = []
  const read = async path => {
    calls++; pending++; peak = Math.max(peak, pending)
    await new Promise(resolve => setTimeout(resolve, 5))
    pending--
    if (path.endsWith('/3')) throw Error('unavailable')
    return { data: { ip: '', cpu: 1, memory: 2 } }
  }
  const rows = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, module: 'mf_cloud', status: 'Active' }))
  await loadProductCardSummaries(read, rows, new Set(['ip']), { onUpdate: (id, summary, failed) => results.push({ id, summary, failed }) })
  assert.equal(calls, 12); assert.equal(peak, 4); assert.equal(results.length, 12)
  assert.equal(results.find(r => r.id === 3).failed, true)
  await loadProductCardSummaries(read, rows, new Set(['product_name']))
  assert.equal(calls, 12)
})

test('leaving the page stops queued summary reads and suppresses stale updates', async () => {
  let cancelled = false, calls = 0, updates = 0
  const read = async () => { calls++; cancelled = true; return { data: { ip: '' } } }
  await loadProductCardSummaries(read, Array.from({ length: 12 }, (_, i) => ({ id: i + 1, module: 'mf_cloud' })), new Set(['ip']), { isCancelled: () => cancelled, onUpdate: () => updates++ })
  assert.equal(calls, 1); assert.equal(updates, 0)
})

test('large product inventories keep pagination bounded and include both ends', () => {
  assert.deepEqual(productPageNumbers(1, 3), [1, 2, 3])
  assert.deepEqual(productPageNumbers(50, 1000), [1, '…', 49, 50, 51, '…', 1000])
  assert.deepEqual(productPageNumbers(1000, 1000), [1, '…', 998, 999, 1000])
})
