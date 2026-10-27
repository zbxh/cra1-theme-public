const pad = (value) => String(value).padStart(2, '0')

export function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '')
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  if (year < 100 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null
  const days = new Date(year, month, 0).getDate()
  if (day > days) return null
  return { year, month, day, hour, minute }
}

export function formatLocalDateTime({ year, month, day, hour, minute }) {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
}

export function calendarDays(year, month) {
  const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, month - 1, i - offset + 1)
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  })
}

export function moveCalendarDate(value, days) {
  const date = new Date(value.year, value.month - 1, value.day + days)
  return { ...value, year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}
