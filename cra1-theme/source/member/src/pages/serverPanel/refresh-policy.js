export const REFRESH_INTERVALS = {
  power: 15000, usage: 10000, flow: 60000, flowCurve: 60000,
  ipv4: 60000, ipv6: 60000, vpc: 60000, disks: 30000,
  backup: 60000, snapshot: 60000, securityRules: 120000,
  // 详情接口同时提供配置和安全组绑定，按其中较短周期只读一次。
  detail: 120000, host: 300000, remote: 0, orders: 0, logs: 0,
}
export const RESOURCE_LABELS = {
  power: '实例状态', usage: 'CPU / 内存', flow: '流量', flowCurve: '流量曲线',
  ipv4: 'IPv4', ipv6: 'IPv6', vpc: '网络', disks: '磁盘', backup: '备份', snapshot: '快照',
  securityRules: '安全组规则', detail: '实例配置', host: '到期与计费信息', remote: '登录信息',
  orders: '订单记录', logs: '操作日志',
}

export function changedUpgradeResources(cloud, form) {
  const changed = key => form[key] !== undefined && form[key] !== '' && String(form[key]) !== String(cloud?.[key] ?? '')
  const ids = []
  if (changed('ip_num')) ids.push('ipv4')
  if (changed('ipv6_num')) ids.push('ipv6')
  if (changed('flow')) ids.push('flow', 'flowCurve')
  if (form.image_id && String(form.image_id) !== String(cloud?.image?.id)) ids.push('power', 'remote')
  if (changed('cpu') || changed('memory')) ids.push('usage')
  return ids
}

/** 跟踪异步资源，普通相关读取只刷新一次。所有订单在付款确认后调用。 */
export function refreshForOperation(type, context = {}) {
  const bs = context.isBackup ? 'backup' : 'snapshot'
  const policies = {
    power: { track: ['power'], once: [] },
    resetPass: { track: ['power', 'remote'], once: [] },
    rescue: { track: ['power', 'remote'], once: [] },
    rescueExit: { track: ['power', 'remote'], once: [] },
    reinstall: { track: ['power', 'detail', 'remote'], once: [] },
    simulate: { track: ['remote'], once: [] },
    notes: { track: [], once: ['host'] }, autoRelease: { track: [], once: ['host'] },
    unsubscribe: { track: [], once: ['host'] },
    securityGroup: { track: ['detail'], once: ['securityRules'] },
    vpc: { track: ['vpc', 'detail'], once: ['ipv4', 'ipv6'] },
    diskMount: { track: ['disks'], once: [] }, diskDelete: { track: ['disks'], once: [] },
    diskOrder: { track: ['disks', 'detail'], once: ['host', 'orders'] },
    diskResize: { track: ['disks', 'detail'], once: ['host', 'orders'] },
    renew: { track: ['host'], once: ['orders'] },
    flowPacket: { track: ['flow'], once: ['orders'] },
    bsCreate: { track: [bs], once: [] }, bsDelete: { track: [bs], once: [] },
    bsConfig: { track: ['detail'], once: [bs, 'host', 'orders'] },
    bsRestore: { track: [bs, 'power', 'disks', 'remote'], once: ['detail'] },
    upgradeElastic: { track: ['detail', ...(context.resources || [])].filter(id => !['usage', 'flowCurve'].includes(id)), once: ['host', 'orders'] },
    upgradePackage: { track: ['detail', 'ipv4', 'ipv6', 'disks', 'flow'], once: ['host', 'orders'] },
    defence: { track: ['detail'], once: ['orders'] },
    billingConvert: { track: ['host'], once: ['detail', 'orders'] },
    // 买下镜像或应用只更新订单及配置，重新安装仍由用户明确发起。
    imageOrder: { track: [], once: ['host', 'detail', 'orders'] },
    appPreset: { track: [], once: ['host', 'detail', 'orders'] },
    nat: { track: [], once: [] },
    // 列表内付款无法确定具体插件操作时，保守更新实例相关资源。
    unknownOrder: { track: ['host', 'detail', 'disks', 'ipv4', 'ipv6', 'flow'], once: ['orders'] },
  }
  const p = policies[type] || { track: [], once: [] }
  return { track: [...new Set(p.track)], once: [...new Set([...p.once, 'logs'])] }
}

export function orderOperation(order) {
  if (order?.type === 'renew') return 'renew'
  if (order?.type === 'change_billing_cycle') return 'billingConvert'
  return 'unknownOrder'
}
