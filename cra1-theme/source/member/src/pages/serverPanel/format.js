/** 服务器控制面板：单位换算与格式化（与旧面板 cloudDetail.js 的展示口径一致） */
import { formatCurrency } from '../../lib/currency.js'

/** bytes → 可读容量（B/KB/MB/GB/TB，1024 进制） */
export function formatBytes(bytes, digits = 1) {
  const n = Number(bytes)
  if (!isFinite(n) || n < 0) return '--'
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const v = n / Math.pow(1024, i)
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`
}

/** bps → 可读带宽（Kbps/Mbps/Gbps，1000 进制） */
export function formatBps(bps, digits = 2) {
  const n = Number(bps)
  if (!isFinite(n) || n < 0) return '--'
  if (n === 0) return '0bps'
  if (n < 1000) return `${n.toFixed(0)}bps`
  const units = ['Kbps', 'Mbps', 'Gbps', 'Tbps']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1000)) - 1, units.length - 1)
  const v = n / Math.pow(1000, i + 1)
  return `${v.toFixed(digits)}${units[i]}`
}

/** chart 接口的秒级时间点 → HH:mm 或 MM-DD（按跨度） */
export function chartTimeLabel(sec, spanHours) {
  const d = new Date(sec * 1000)
  const pad = (x) => String(x).padStart(2, '0')
  if (spanHours <= 24) return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}时`
}

/** 到期剩余天数（向上取整；负数表示已过期） */
export function remainDays(dueTimeSec) {
  if (!dueTimeSec) return null
  return Math.ceil((dueTimeSec * 1000 - Date.now()) / 86400000)
}

export function formatMoney(n, currency) {
  const current = currency ?? globalThis.window?.CRA1Shared?.Runtime?.common() ?? globalThis.window?.__CRA1_RUNTIME__?.common ?? {}
  return formatCurrency(n, current)
}

/**
 * 磁盘状态 → 文案（0=卸载,1=挂载,2=正在挂载,3=创建中,4=已确认创建失败）。
 * 注意：创建磁盘时后端默认 status=3 且此后不回写 —— 系统盘的 status 恒为 3，
 * 但它随实例必然处于使用中，故渲染层对系统盘固定显示「使用中」。
 */
export const DISK_STATUS = { 0: '已卸载', 1: '使用中', 2: '挂载中', 3: '创建中', 4: '创建失败' }

function flowResetDate(flow) {
  const value = flow?.reset_flow_time || flow?.reset_flow_timestamp || flow?.reset_flow_date
  if (value === undefined || value === null || value === '') return null
  let date
  if (Number(value) > 0) {
    const number = Number(value)
    date = new Date(number > 1e12 ? number : number * 1000)
  } else if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(String(value))) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = String(value).split(/[- T:]/).map(Number)
    date = new Date(year, month - 1, day, hour, minute, second)
  } else {
    date = new Date(String(value))
  }
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatFlowReset(flow) {
  const date = flowResetDate(flow)
  if (!date) return ''
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** The chart and displayed reset time use the same provider cycle boundary. */
export function flowCycleStart(flow, now = Date.now()) {
  const timestamp = Number(flow?.reset_flow_timestamp)
  const absolute = Number.isFinite(timestamp) && timestamp > 0
  const next = absolute ? new Date(timestamp > 1e12 ? timestamp : timestamp * 1000) : flowResetDate(flow)
  if (!next) return Math.floor(now / 1000) - 30 * 86400
  const start = new Date(next)
  const number = Math.max(1, Number(flow?.flow_reset_cycle_num) || 1)
  const cycle = flow?.flow_reset_cycle || 'month'
  const get = name => start[`${absolute ? 'getUTC' : 'get'}${name}`]()
  const set = (name, value) => start[`${absolute ? 'setUTC' : 'set'}${name}`](value)
  if (cycle === 'day') set('Date', get('Date') - number)
  else if (cycle === 'hour') set('Hours', get('Hours') - number)
  else if (cycle === 'year') set('FullYear', get('FullYear') - number)
  else {
    const day = get('Date')
    set('Date', 1)
    set('Month', get('Month') - number)
    const lastDay = absolute ? new Date(Date.UTC(get('FullYear'), get('Month') + 1, 0)).getUTCDate() : new Date(get('FullYear'), get('Month') + 1, 0).getDate()
    set('Date', Math.min(day, lastDay))
  }
  return start.getTime() <= now ? Math.floor(start.getTime() / 1000) : Math.floor(now / 1000) - 30 * 86400
}
/** 快照/备份状态 → 文案（0创建中 1完成） */
export const BS_STATUS = { 0: '创建中', 1: '已完成' }
