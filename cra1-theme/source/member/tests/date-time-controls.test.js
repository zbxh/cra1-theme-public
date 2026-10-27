import test from 'node:test'
import assert from 'node:assert/strict'
import { parseLocalDateTime, formatLocalDateTime, calendarDays, moveCalendarDate } from '../src/ui/date-time.js'

test('the date picker rejects impossible dates and retains minute precision', () => {
  assert.equal(parseLocalDateTime('2026-02-29T12:00'), null)
  assert.equal(parseLocalDateTime('2026-04-31T12:00'), null)
  assert.equal(parseLocalDateTime('2026-01-01T24:00'), null)
  assert.equal(parseLocalDateTime('2026-01-01T00:60'), null)
  assert.equal(parseLocalDateTime(''), null)
  assert.equal(formatLocalDateTime(parseLocalDateTime('2028-02-29T07:05')), '2028-02-29T07:05')
})

test('calendar cells and keyboard date movement cross month and year boundaries', () => {
  const days = calendarDays(2026, 11)
  assert.equal(days.length, 42)
  assert.deepEqual(days[0], { year: 2026, month: 10, day: 26 })
  assert.deepEqual(moveCalendarDate({ year: 2026, month: 12, day: 31, hour: 16, minute: 50 }, 1),
    { year: 2027, month: 1, day: 1, hour: 16, minute: 50 })
  assert.deepEqual(moveCalendarDate({ year: 2028, month: 3, day: 1 }, -1), { year: 2028, month: 2, day: 29 })
})

test('picker values stay in local time without UTC conversion', () => {
  for (const timezone of ['Asia/Shanghai', 'America/New_York', 'Europe/London']) {
    process.env.TZ = timezone
    const value = '2026-11-04T16:50'
    assert.equal(formatLocalDateTime(parseLocalDateTime(value)), value)
    assert.deepEqual(calendarDays(2026, 11)[0], { year: 2026, month: 10, day: 26 })
  }
})
