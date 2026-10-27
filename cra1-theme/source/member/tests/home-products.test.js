import test from 'node:test'
import assert from 'node:assert/strict'
import { homeProductCategories, homeProductState, loadHomeProducts } from '../src/lib/home-products.js'

const now = Math.floor(Date.now() / 1000)
const active = { status: 'Active', due_time: now + 86400, billing_cycle: 'recurring_prepayment' }
const expired = { ...active, due_time: now - 86400, renew_recovery_deadline: now + 6 * 86400, renew_forbidden: 0 }
const overview = { server_time: now, renewal_enabled: true }

const navigation = [
  {key:'primary',label:'生产服务',product_id:[4,5]},
  {key:'backup',label:'备用服务',product_id:[6]},
]
test('homepage groups by associated products even when modules are mixed or identical', () => {
  const rows=[{id:1,product_id:4,module:'mf_cloud'},{id:2,product_id:5,module:'mf_dcim'},{id:3,product_id:6,module:'mf_cloud'},{id:4,product_id:7,module:'mf_cloud'}]
  const categories=homeProductCategories(rows,navigation)
  assert.deepEqual(categories.map(c=>c.label),['全部分类','生产服务','备用服务'])
  assert.deepEqual(categories.map(c=>c.rows.map(h=>h.id)),[[1,2,3,4],[1,2],[3]])
})
test('empty associations do not pull in unrelated products from the same module', () => {
  const rows=[{id:1,product_id:4,module:'mf_cloud'}]
  assert.deepEqual(homeProductCategories(rows,[{key:'empty',label:'空分类',module:['mf_cloud'],product_id:[]}]).map(c=>c.rows.length),[1,0])
  assert.deepEqual(homeProductCategories(rows).map(c=>c.key),['all'])
})
test('products linked to multiple navigations appear in each while the overall count stays unique', () => {
  const rows=[{id:1,product_id:4},{id:2,product_id:5}]
  const groups=homeProductCategories(rows,[{key:'a',product_id:[4,4]},{key:'b',product_id:[4,5]}])
  assert.deepEqual(groups.map(g=>g.rows.map(h=>h.id)),[[1,2],[1],[1,2]])
})

test('categories and counts include products beyond the first 100', async () => {
  const data = Array.from({ length: 205 }, (_, i) => ({ ...active, id: 205 - i, module:'mf_cloud', product_id:i < 200 ? 4 : 6 }))
  const calls = []
  const { rows } = await loadHomeProducts(async (path, p) => {
    calls.push({ path, ...p })
    return { data: { list: data.slice((p.page - 1) * p.limit, p.page * p.limit), count: 205 } }
  })
  assert.equal(rows.length, 205)
  assert.deepEqual(calls.map(c => c.page), [1, 2, 3])
  assert.ok(calls.every(c => c.path === '/cra1-theme/member/products' && c.limit === 100 && c.orderby === 'id' && c.sort === 'desc'))
  assert.deepEqual(homeProductCategories(rows,navigation).map(g => g.rows.length), [205, 200, 5])
})

test('hidden first page does not prevent loading eligible products and matching totals', async () => {
  const data = [
    ...Array.from({ length: 100 }, (_, i) => ({ id: i + 1, module: 'idcsmart_common', status: 'Unpaid' })),
    { ...active, id: 101, module: 'mf_cloud', product_id:4 },
    { ...active, id: 102, module: 'mf_cloud', status: 'Pending' },
    { ...expired, id: 103, module: 'mf_dcim', product_id:6, status: 'Suspended', suspend_type: 'overdue' },
    { id: 104, module: 'mf_dcim', status: 'Unpaid' },
  ]
  const pages = []
  const { rows } = await loadHomeProducts(async (path, p) => {
    if (path === '/host/renew/batch') return { data: { list: [{ ...data[102], billing_cycles: [{ duration: 2592000 }] }] } }
    pages.push(p.page)
    return { data: { list: data.slice((p.page - 1) * p.limit, p.page * p.limit), count: data.length, overview } }
  })
  assert.deepEqual(pages, [1, 2])
  assert.deepEqual(rows.map(h => h.id), [101, 103])
  assert.deepEqual(homeProductCategories(rows,navigation).map(g => [g.key, g.rows.length]), [
    ['all', 2], ['primary', 1], ['backup', 1],
  ])
  const { rows: unpaidOnly } = await loadHomeProducts(async () => ({ data: { list: data.slice(0, 100), count: 100 } }))
  assert.deepEqual(unpaidOnly, [])
  assert.deepEqual(homeProductCategories(unpaidOnly).map(g => [g.key, g.rows.length]), [['all', 0]])
})

test('empty inventory does not trigger additional requests', async () => {
  let calls = 0
  const { rows } = await loadHomeProducts(async () => { calls++; return { data: { list: [], count: 0 } } })
  assert.deepEqual(rows, [])
  assert.equal(calls, 1)
  assert.deepEqual(homeProductCategories(rows).map(g => g.key), ['all'])
})

test('failed and malformed pages reject instead of silently undercounting', async () => {
  await assert.rejects(loadHomeProducts(async (path, p) => {
    if (p.page === 2) throw new Error('暂时不可用')
    return { data: { list: [{ id: 1 }], count: 2 } }
  }), /暂时不可用/)
  for (const data of [{}, { list: [], count: -1 }, { list: [{ id: 0 }], count: 1 }, { list: [], count: 5 }]) {
    await assert.rejects(loadHomeProducts(async () => ({ data })), /不完整/)
  }
})

test('repeated API pages cannot duplicate products or loop forever', async () => {
  let calls = 0
  await assert.rejects(loadHomeProducts(async () => {
    calls++
    return { data: { list: [{ id: 1 }], count: 2 } }
  }), /不完整/)
  assert.equal(calls, 2)
})

test('unmounted homepage stops requesting remaining pages', async () => {
  let cancelled = false
  let calls = 0
  const { rows } = await loadHomeProducts(async () => {
    calls++; cancelled = true
    return { data: { list: [{ id: 1 }], count: 1000 } }
  }, () => cancelled)
  assert.deepEqual(rows, [])
  assert.equal(calls, 1)
})

test('status and expiry both gate running or recoverable products', () => {
  assert.equal(homeProductState(active, now), 'using')
  assert.equal(homeProductState({ ...active, renew_forbidden: 1 }, now), 'using')
  assert.equal(homeProductState({ ...active, due_time: 0 }, now), 'using')
  assert.equal(homeProductState(expired, now), 'expired')
  assert.equal(homeProductState({ ...expired, status: 'Suspended', suspend_type: 'overdue' }, now), 'expired')
  for (const status of ['Deleted', 'Cancelled', 'Unpaid', 'Pending', 'Failed', 'Keep', '', 'unknown']) {
    assert.equal(homeProductState({ ...active, status }, now), 'hidden', status + ' future')
    assert.equal(homeProductState({ ...expired, status }, now), 'hidden', status + ' expired')
  }
  for (const patch of [
    { status: 'Suspended' }, { is_delete: '1' }, { due_time: null }, { due_time: '' }, { due_time: -1 }, { due_time: 'invalid' },
  ]) assert.equal(homeProductState({ ...active, ...patch }, now), 'hidden', JSON.stringify(patch))
  for (const patch of [
    { renew_forbidden: '1' }, { change_billing_cycle_id: 42 }, { renew_recovery_deadline: now },
    { renew_recovery_deadline: now - 1 }, { renew_recovery_deadline: null }, { renew_recovery_deadline: '' },
    { status: 'Suspended', suspend_type: 'overtraffic' }, { status: 'Suspended', suspend_type: 'other' },
    { status: 'Suspended', suspend_type: 'upstream' }, { status: 'Suspended', suspend_type: 'certification_not_complete' },
  ]) assert.equal(homeProductState({ ...expired, ...patch }, now), 'hidden', JSON.stringify(patch))
  assert.equal(homeProductState({ ...expired, renew_recovery_deadline: 0 }, now), 'expired')
  assert.equal(homeProductState({ ...expired, due_time: now }, now), 'expired')
})

test('non-recurring products and on-demand grace use their own lifetime semantics', () => {
  for (const billing_cycle of ['free', 'onetime', 'on_demand']) {
    assert.equal(homeProductState({ ...expired, billing_cycle }, now), 'using')
    assert.equal(homeProductState({ ...expired, billing_cycle, status: 'Suspended', suspend_type: 'overdue' }, now), 'hidden')
    assert.equal(homeProductState({ ...expired, billing_cycle, status: 'Deleted' }, now), 'hidden')
  }
  const grace = { ...expired, status: 'Grace', billing_cycle: 'on_demand', end_grace_time: now + 60 }
  assert.equal(homeProductState(grace, now), 'grace')
  assert.equal(homeProductState({ ...grace, end_grace_time: now }, now), 'hidden')
  assert.equal(homeProductState({ ...grace, billing_cycle: 'recurring_prepayment' }, now), 'hidden')
})

test('expired hosts need actual renewal approval and nonempty cycles; internal response fields are not copied', async () => {
  const inventory = [
    { ...active, id: 1 }, { ...expired, id: 2 }, { ...expired, id: 3 },
    { ...expired, id: 4, status: 'Suspended', suspend_type: 'overdue' },
    { ...expired, id: 5, status: 'Suspended', suspend_type: 'other' },
    { ...expired, id: 6, renew_forbidden: 1 }, { ...expired, id: 7, status: 'Deleted' },
    { ...expired, id: 8, renew_recovery_deadline: now - 1 },
  ]
  const calls = []
  const result = await loadHomeProducts(async (path, p) => {
    calls.push({ path, p })
    if (path === '/cra1-theme/member/products') return { data: { list: inventory, count: inventory.length, overview } }
    return { data: { list: [
      { ...inventory[1], billing_cycles: [{ duration: 2592000 }], password: 'private', server_id: 999 },
      { ...inventory[2], billing_cycles: [] },
      // id=4 omitted by renewal eligibility/module hook; not recoverable.
    ] } }
  })
  assert.deepEqual(result.rows.map(h => h.id), [1, 2])
  assert.deepEqual(result.rows.map(h => h.home_state), ['using', 'expired'])
  assert.deepEqual(calls[1].p, { 'ids[0]': 2, 'ids[1]': 3, 'ids[2]': 4 })
  assert.equal(result.rows[1].password, undefined)
  assert.equal(result.rows[1].server_id, undefined)
  assert.equal(result.renewalError, false)
})

test('renewal check failure retains running products with an explicit retry state', async () => {
  const result = await loadHomeProducts(async path => {
    if (path === '/host/renew/batch') throw new Error('暂时不可用')
    return { data: { list: [{ ...active, id: 1 }, { ...expired, id: 2 }], count: 2, overview } }
  })
  assert.deepEqual(result.rows.map(h => h.id), [1])
  assert.equal(result.renewalError, true)
})

test('fresh deleted/blocked renewal responses cannot reintroduce an expired host', async () => {
  const result = await loadHomeProducts(async path => {
    if (path === '/cra1-theme/member/products') return { data: { list: [{ ...expired, id: 1 }, { ...expired, id: 2 }], count: 2, overview } }
    return { data: { list: [
      { id: 1, status: 'Deleted', billing_cycles: [{ duration: 3600 }] },
      { id: 2, renew_forbidden: 1, billing_cycles: [{ duration: 3600 }] },
    ] } }
  })
  assert.deepEqual(result.rows, [])
})

test('disabled renewal never requests renewal APIs and uses server time for lifecycle checks', async () => {
  const calls = []
  const result = await loadHomeProducts(async path => {
    calls.push(path)
    return { data: { list: [{ ...active, id: 1 }, { ...expired, id: 2 }], count: 2, overview: { server_time: now - 2 * 86400, renewal_enabled: false } } }
  })
  assert.deepEqual(result.rows.map(h => h.id), [1, 2]) // neither has expired according to the server
  assert.deepEqual(calls, ['/cra1-theme/member/products'])
  const disabled = await loadHomeProducts(async () => ({ data: { list: [{ ...active, id: 1 }, { ...expired, id: 2 }], count: 2, overview: { ...overview, renewal_enabled: false } } }))
  assert.deepEqual(disabled.rows.map(h => h.id), [1])
})
