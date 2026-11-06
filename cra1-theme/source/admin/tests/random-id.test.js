import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { randomId } from '../src/lib/random-id.js'

test('ordinary HTTP crypto supports distinct editable records without randomUUID', () => {
  const httpCrypto = { getRandomValues: array => webcrypto.getRandomValues(array) }
  const records = Array.from({ length: 100 }, () => ({ id: randomId(httpCrypto), title: '通知' }))
  assert.equal(new Set(records.map(row => row.id)).size, records.length)
  assert.ok(records.every(row => /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/.test(row.id)))
})

test('secure context keeps the native UUID provider', () => {
  assert.equal(randomId({ randomUUID: () => 'native-record-id' }), 'native-record-id')
})
