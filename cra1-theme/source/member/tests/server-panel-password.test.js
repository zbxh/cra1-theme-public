import test from 'node:test'
import assert from 'node:assert/strict'
import { randomPassword } from '../src/pages/serverPanel/password.js'

test('generated passwords meet reinstall and reset rules even when random bytes pick the same character', () => {
  for (const value of [0, 1, 17, 4294967295]) for (const length of [7, 12, 65]) {
    const password = randomPassword(length, { getRandomValues: buffer => buffer.fill(value) })
    assert.equal(password.length, length)
    assert.match(password, /[a-z]/); assert.match(password, /[A-Z]/); assert.match(password, /\d/)
    assert.match(password, /^[A-Za-z2-9]+$/)
  }
})
test('password lengths outside the backend contract are rejected', () => {
  for (const length of [0, 6, 66, 12.5, NaN]) assert.throws(() => randomPassword(length), RangeError)
})
