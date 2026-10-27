import test from 'node:test'
import assert from 'node:assert/strict'
import { preserveCurrentUpgradeOption } from '../src/pages/serverPanel/upgrade-options.js'

test('retired 1-core configuration remains selected while 2-core stays an explicit upgrade', () => {
  const available = [{ type: 'radio', value: '2' }]
  const options = preserveCurrentUpgradeOption(available, 1)
  assert.equal(options[0].value, 1)
  assert.equal(options[0].currentOnly, true)
  assert.equal(options[1].value, '2')
  assert.deepEqual(available, [{ type: 'radio', value: '2' }])
})
test('existing numeric/string configurations do not duplicate and zero IPv6 is preserved', () => {
  const options = [{ type: 'radio', value: '1' }, { type: 'radio', value: 2 }]
  assert.deepEqual(preserveCurrentUpgradeOption(options, 1), options)
  assert.equal(preserveCurrentUpgradeOption([{ value: 1 }], 0)[0].value, 0)
  assert.deepEqual(preserveCurrentUpgradeOption([], undefined), [])
})
test('range and step values preserve unsupported old values without changing available bounds', () => {
  const options = [{ type: 'step', min_value: 2, max_value: 8, step: 2 }]
  assert.deepEqual(preserveCurrentUpgradeOption(options, 4), options)
  assert.equal(preserveCurrentUpgradeOption(options, 3)[0].currentOnly, true)
  assert.equal(preserveCurrentUpgradeOption(options, 1)[1].min_value, 2)
})
