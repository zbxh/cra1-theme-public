import test from 'node:test'
import assert from 'node:assert/strict'
import {formatFlowReset, flowCycleStart, DISK_STATUS} from '../src/pages/serverPanel/format.js'

test('provider reset time keeps hours, minutes and seconds; old date remains compatible', () => {
  assert.equal(formatFlowReset({reset_flow_time: '2026-11-04 16:50:17', reset_flow_date: '2026-11-04'}), '2026-11-04 16:50:17')
  assert.equal(formatFlowReset({reset_flow_date: '2026-11-04'}), '2026-11-04 00:00:00')
  assert.equal(formatFlowReset({reset_flow_timestamp: new Date(2026, 10, 4, 16, 50, 17).getTime() / 1000}), '2026-11-04 16:50:17')
  assert.equal(formatFlowReset({reset_flow_time: 'invalid'}), '')
  assert.equal(formatFlowReset(null), '')
})

test('traffic chart uses the real absolute cycle boundary across browser timezones', () => {
  const now = Date.parse('2026-10-12T12:00:00+08:00')
  assert.equal(flowCycleStart({reset_flow_timestamp: 1793782217, reset_flow_time: '2026-11-04 16:50:17'}, now), 1791103817)
  assert.equal(flowCycleStart({reset_flow_time: '2026-03-31 10:20:30'}, new Date(2026, 2, 10).getTime()), new Date(2026, 1, 28, 10, 20, 30).getTime() / 1000)
  assert.equal(flowCycleStart({reset_flow_time: '2026-10-13 16:50:17', flow_reset_cycle: 'day'}, new Date(2026, 9, 12, 18).getTime()), new Date(2026, 9, 12, 16, 50, 17).getTime() / 1000)
})

test('failed creation has a distinct label from pending creation', () => {
  assert.equal(DISK_STATUS[3], '创建中')
  assert.equal(DISK_STATUS[4], '创建失败')
})
