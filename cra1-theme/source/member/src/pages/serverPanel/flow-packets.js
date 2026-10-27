export function normalizeFlowPackets(list) {
  if (!Array.isArray(list)) throw new Error('流量包列表格式错误')
  return list.map(pkg => ({ ...pkg,
    id: Number(pkg.id), billing_mode: Number(pkg.billing_mode || 0),
    long_term_valid: Number(pkg.long_term_valid || 0),
    capacity: Number(pkg.capacity ?? pkg.size ?? 0),
    min_capacity: Number(pkg.min_capacity || 0), max_capacity: Number(pkg.max_capacity || 0),
    monthly_purchase_limit_reached: Number(pkg.monthly_purchase_limit_reached || 0),
  })).filter(pkg => Number.isSafeInteger(pkg.id) && pkg.id > 0)
}
export const flowPacketDisabled = pkg => Number(pkg.monthly_purchase_limit_reached) === 1
export function defaultFlowPacketType(list) {
  const available = list.filter(pkg => !flowPacketDisabled(pkg))
  return (available.length ? available : list).some(pkg => pkg.long_term_valid === 0) ? 0 : 1
}
export function flowPacketOrderBody(pkg, input) {
  if (flowPacketDisabled(pkg)) throw new Error('该流量包本月购买次数已达上限')
  const body = { flow_packet_id: pkg.id }
  if (Number(pkg.billing_mode) === 1) {
    const value = Number(input ?? pkg.min_capacity)
    if (!Number.isFinite(value) || value <= 0 || value < pkg.min_capacity || value > pkg.max_capacity) {
      throw new Error(`购买容量需在 ${pkg.min_capacity} ~ ${pkg.max_capacity} GB 之间`)
    }
    body.selected_capacity = value
  }
  return body
}
