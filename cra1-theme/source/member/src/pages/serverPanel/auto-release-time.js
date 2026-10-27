const pad = value => String(value).padStart(2, '0')

export function releaseLocalValue(timestamp) {
  const date = new Date(Number(timestamp) * 1000)
  if (!timestamp || !Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function releaseTimestamp(value, current = 0) {
  // Opening and saving an unchanged setting must not discard existing seconds.
  return value && value === releaseLocalValue(current) ? Number(current) : Math.floor(new Date(value).getTime() / 1000)
}

export function releaseTimeText(timestamp) {
  const date = new Date(Number(timestamp) * 1000)
  if (!Number.isFinite(date.getTime())) return '时间无效'
  const offset = -date.getTimezoneOffset()
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时间'
  const utc = `UTC${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
  return `${releaseLocalValue(timestamp).replace('T', ' ')}:${pad(date.getSeconds())}（${zone}，${utc}）`
}
