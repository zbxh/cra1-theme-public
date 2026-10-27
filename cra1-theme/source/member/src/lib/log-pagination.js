// V10 returns this sentinel instead of executing COUNT(*) for the log list.
// Keep navigation available without presenting it as an actual record count.
export function logPagination(count, rowCount, limit) {
  const value = Number(count)
  const known = count !== null && count !== undefined && count !== '' &&
    Number.isSafeInteger(value) && value >= 0 && value !== 100000000
  return known ? { total: value } : { total: 0, hasMore: rowCount >= limit }
}
