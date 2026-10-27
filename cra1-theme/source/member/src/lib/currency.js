// Currency affixes may intentionally be empty. Native prices use two decimals;
// metered rates retain the precision selected by their consumer.
export function currencyAffixes(currency = {}, fallback = {}) {
  return {
    prefix: String(currency.currency_prefix ?? fallback.currency_prefix ?? '¥'),
    suffix: String(currency.currency_suffix ?? fallback.currency_suffix ?? ''),
  }
}

export function formatCurrency(value, currency = {}, digits = 2) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  if (!Number.isFinite(amount)) return String(value)
  const { prefix, suffix } = currencyAffixes(currency)
  return prefix + amount.toFixed(digits) + suffix
}
