import test from 'node:test'
import assert from 'node:assert/strict'
import { logPagination } from '../src/lib/log-pagination.js'

test('native log count sentinel uses count-free navigation', () => {
  assert.deepEqual(logPagination(100000000, 15, 15), { total: 0, hasMore: true })
  assert.deepEqual(logPagination('100000000', 5, 15), { total: 0, hasMore: false })
  assert.deepEqual(logPagination(100000000, 0, 15), { total: 0, hasMore: false })
})
test('real log counts remain exact, including an empty list', () => {
  for (const count of [0, 12, 31, 100000001]) {
    assert.deepEqual(logPagination(count, 15, 15), { total: count })
  }
})
test('missing or invalid counts never become invented totals', () => {
  for (const count of [null, undefined, '', -1, 2.5, 'unknown']) {
    assert.deepEqual(logPagination(count, 15, 15), { total: 0, hasMore: true })
  }
})
