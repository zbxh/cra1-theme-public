import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiskOrderGuard, definiteOrderRejection, diskOrderScope, validQuoteAmount } from '../src/pages/serverPanel/order-guard.js'
import { releaseLocalValue, releaseTimestamp, releaseTimeText } from '../src/pages/serverPanel/auto-release-time.js'

const token = (id, sub = 0) => `header.${Buffer.from(JSON.stringify({ info: { id, sub_account_id: sub } })).toString('base64url')}.signature`
const scope = (id = 1, host = 24, module = 'mf_cloud', sub = 0) => diskOrderScope(token(id, sub), module, host)
function memoryStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values }
}

test('disk receipts survive remount, token renewal and long delays without retaining credentials', () => {
  const store = memoryStorage(), first = createDiskOrderGuard(store, scope())
  const attempt = first.claim('attempt-a', 1)
  assert.equal(first.claim('double-click'), null)
  const reloaded = createDiskOrderGuard(store, scope())
  assert.equal(reloaded.read().attempt, 'attempt-a')
  assert.equal(reloaded.claim('retry-after-refresh'), null)
  first.update(attempt, 'unknown')
  assert.equal(reloaded.read().state, 'unknown')
  assert.doesNotMatch([...store.values.values()].join(''), /password|signature|header|token/i)
})

test('account, subaccount, host and module receipts never share a key', () => {
  assert.equal(new Set([scope(), scope(2), scope(1, 25), scope(1, 24, 'mf_dcim'), scope(1, 24, 'mf_cloud', 2)]).size, 5)
  for (const invalid of ['', 'not-a-jwt', token(0)]) assert.equal(diskOrderScope(invalid, 'mf_cloud', 24), '')
  assert.equal(diskOrderScope(token(1), '../invalid', 24), '')
})

test('explicit rejection can release its own attempt; stale responses cannot release another attempt', () => {
  const guard = createDiskOrderGuard(memoryStorage(), scope())
  const old = guard.claim('old'); guard.clear(old)
  const current = guard.claim('new')
  guard.clear(old)
  assert.equal(guard.read().attempt, 'new')
  assert.throws(() => guard.update(old, 'created', 77))
  guard.update(current, 'created', 88)
  assert.equal(guard.read().orderId, 88)
  assert.equal(guard.claim('new-order'), null)
})

test('corrupt or unavailable storage never enables blind resubmission', () => {
  const store = memoryStorage(); store.setItem(scope(), '{')
  const guard = createDiskOrderGuard(store, scope())
  assert.throws(() => guard.claim('x'))
  const unavailable = createDiskOrderGuard({ getItem: () => null, setItem: () => { throw Error('quota') } }, scope())
  assert.throws(() => unavailable.claim('x'))
})

test('timeouts, bad bodies, proxy failures and ambiguous exceptions are not business refusals', () => {
  for (const error of [new Error('lost response'), { code: 'TIMEOUT' }, { code: 'NETWORK' }, { code: 'CANCELLED' },
    { code: 'BAD_RESPONSE', status: 200 }, { code: 'API_ERROR', status: 503, data: { status: 400 } },
    { code: 'API_ERROR', status: 500, data: { status: 500 } }, { code: 'SECURITY_SESSION_CHANGED' }]) {
    assert.equal(definiteOrderRejection(error), false)
  }
  assert.equal(definiteOrderRejection({ code: 'API_ERROR', status: 400, data: { status: 400 } }), true)
  assert.equal(definiteOrderRejection({ code: 'SECURITY_CANCELLED' }), true)
  assert.equal(definiteOrderRejection({ code: 'SECURITY_CANCELLED', uncertain: true }), false)
})

test('zero is a valid quote, but missing, blank and malformed amounts never become zero', () => {
  for (const price of [0, '0', '0.00', 12.5]) assert.equal(validQuoteAmount(price), true)
  for (const price of [null, undefined, '', ' ', NaN, Infinity, -1, false, {}, []]) assert.equal(validQuoteAmount(price), false)
})

test('auto-release confirmation includes seconds and timezone and preserves unchanged seconds', () => {
  process.env.TZ = 'Asia/Shanghai'
  const timestamp = Date.parse('2027-02-03T04:05:46+08:00') / 1000
  assert.equal(releaseLocalValue(timestamp), '2027-02-03T04:05')
  assert.equal(releaseTimestamp('2027-02-03T04:05', timestamp), timestamp)
  assert.equal(releaseTimestamp('2027-02-03T04:06', timestamp), timestamp + 14)
  assert.equal(releaseTimeText(timestamp), '2027-02-03 04:05:46（Asia/Shanghai，UTC+08:00）')
  assert.equal(Number.isNaN(releaseTimestamp('')), true)
})
