export function releaseChecks(check) {
  // An older backend may still return internal native baseline rows.
  return (check?.checks ?? []).filter(row => row.id !== 'compatibility' && !row.id?.startsWith('dependency:'))
}

export function releaseStatus(rows) {
  if (rows.some(row => row.status === 'blocked')) return '发现需要处理的问题。'
  if (rows.some(row => row.status === 'unverified' && row.id?.startsWith('file:'))) return '部分主题文件有差异，可在文件明细中核对。'
  if (rows.some(row => row.status !== 'pass')) return '检查完成，有项目可进一步核对。'
  return '检查完成，未发现需要处理的问题。'
}
