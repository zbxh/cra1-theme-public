import test from 'node:test'
import assert from 'node:assert/strict'
import { currencyAffixes, formatCurrency } from '../src/lib/currency.js'
import { productCardPrice } from '../src/lib/product-card-data.js'
import { formatMoney as panelMoney } from '../src/pages/serverPanel/format.js'

test('system currency preserves intentional empty prefix and configured suffix', () => {
  const c = { currency_prefix: '', currency_suffix: ' USD' }
  assert.deepEqual(currencyAffixes(c, { currency_prefix: '¥' }), { prefix: '', suffix: ' USD' })
  assert.equal(formatCurrency('12.3', c), '12.30 USD')
  assert.equal(panelMoney('12.3', c), '12.30 USD')
  assert.equal(formatCurrency(0, { currency_prefix: '€', currency_suffix: '' }), '€0.00')
  assert.equal(formatCurrency(null, c), '—')
})

test('product price uses system currency and retains configured metered precision', () => {
  const host = { billing_cycle: 'on_demand', billing_cycle_name: '小时', renew_amount: '0.0034', currency_prefix: '¥' }
  assert.deepEqual(productCardPrice(host, { currency_prefix: '', currency_suffix: ' USD' }), { prefix: '', suffix: ' USD', amount: '0.0034', cycle: '小时' })
  assert.equal(productCardPrice({ billing_cycle: '月付', renew_amount: '99.5' }, { currency_prefix: '€' }).prefix, '€')
})
