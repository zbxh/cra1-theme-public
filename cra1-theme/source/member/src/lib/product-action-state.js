import { quickActionOptions } from './product-operations.js'

export const ACTION_STATE_TTL = 10000
export const RENEW_ACTION = { key: 'renew', type: 'renew', title: '续费' }
export const VNC_ACTION = { key: 'vnc', type: 'vnc', title: '远程登录' }
export const SECURITY_ACTION = { key: 'security', type: 'security', title: '配置安全组' }
export const UPGRADE_ACTION = { key: 'upgrade', type: 'upgrade', title: '升降级' }

export function autoRenewReason(host) {
  const reason = renewalReason(host)
  return reason.replace('手动续费', '自动续费')
}

export function configurationReason(host, type) {
  if (host.module !== 'mf_cloud') return '该产品暂不支持此功能'
  if (!(type === 'security' ? ['Active', 'Suspended', 'Grace', 'Keep'] : ['Active']).includes(host.status)) return '该产品当前状态不支持此功能'
  return ''
}

export function securityGroupUrl(cloud) {
  const id = cloud?.security_group?.id
  if (!['number', 'string'].includes(typeof id) || !/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id))) throw new Error('安全组信息暂时无法读取，请重试')
  return Number(id) > 0 ? `/group_rules.htm?id=${Number(id)}` : '/security_group.htm'
}

export function upgradeMatches(cloud, context = {}) {
  if (context.recommendConfigId && Number(cloud?.recommend_config?.id) === Number(context.recommendConfigId)) return true
  const wanted = Object.entries(context.configuration || {}).filter(([key, value]) => ['cpu', 'memory', 'bw', 'flow', 'ip_num', 'ipv6_num', 'peak_defence'].includes(key) && value !== undefined && value !== null && value !== '')
  return wanted.length > 0 && wanted.every(([key, value]) => cloud?.[key] !== undefined && Number.isFinite(Number(cloud[key])) && Number(cloud[key]) === Number(value))
}

export function renewalReason(host) {
  if (Number(host.renew_forbidden) === 1) return '该产品当前不允许续费'
  if (['', 'free', 'onetime', 'on_demand', '免费', '一次性', '按需'].includes(host.billing_cycle)) return '该产品的计费方式不支持手动续费'
  if (!['Active', 'Suspended', 'Grace', 'Keep'].includes(host.status)) return '该产品当前状态不支持续费'
  return ''
}

/** Per-instance bounded cache. Opening menus never invokes this loader. */
export function createActionLoader({ read, host, now = Date.now }) {
  const cache = new Map()
  let epoch = 0
  function load(key, path, ttl = ACTION_STATE_TTL) {
    const prior = cache.get(key)
    if (prior?.promise) return prior.promise
    if (prior && prior.until > now()) return Promise.resolve(prior.value)
    const generation = epoch
    const entry = { promise: Promise.resolve().then(() => read(path)).then(response => {
      if (generation === epoch) cache.set(key, { value: response.data, until: now() + ttl })
      return response.data
    }).catch(error => { if (cache.get(key) === entry) cache.delete(key); throw error }) }
    cache.set(key, entry)
    return entry.promise
  }
  return {
    invalidate() { epoch++; cache.clear() },
    peekPower() { const entry = cache.get('power'); return entry?.until > now() ? entry.value : null },
    async prepare(action) {
      if (['security', 'upgrade'].includes(action.type)) {
        const reason = configurationReason(host, action.type)
        if (reason) throw new Error(reason)
        // Binding is intentionally read fresh; it may have changed elsewhere.
        const cloud = action.type === 'security' ? (await read(`/mf_cloud/${host.id}`)).data : await load('detail', `/mf_cloud/${host.id}`)
        if (action.type === 'security') return { host, cloud, url: securityGroupUrl(cloud) }
        if (!cloud?.config) throw new Error('实例配置暂时无法读取，请重试')
        if (Number(cloud.config.manual_manage) === 1) throw new Error('该实例由人工管理，请进入控制面板或联系客服处理')
        return { host, cloud, preparedAt: now() }
      }
      if (action.type === 'renew') {
        const reason = renewalReason(host)
        if (reason) throw new Error(reason)
        const renewData = await load('renew', `/host/${host.id}/renew`)
        if (!Array.isArray(renewData?.host)) throw new Error('续费信息暂时无法读取，请重试')
        if (Number(renewData.renew_forbidden) === 1 || !renewData.host.length) throw new Error('该产品当前不允许续费，请联系客服')
        return { host, renewData }
      }
      if (!['mf_cloud', 'mf_dcim'].includes(host.module) || host.status !== 'Active') throw new Error('该产品当前不支持此操作，请进入控制面板查看')
      const p = `/${host.module}/${host.id}`
      const detailNeeded = ['reinstall', 'resetPass'].includes(action.type)
      const [power, cloud, orderConfig] = await Promise.all([
        load('power', `${p}/status`),
        detailNeeded ? load('detail', p) : null,
        action.type === 'reinstall' ? load('order', `/product/${host.product_id}/${host.module}/order_page`, 60000).then(data => data?.config) : null,
      ])
      if (!power?.status || detailNeeded && !cloud?.config || action.type === 'reinstall' && !orderConfig) throw new Error('操作信息暂时无法读取，请重试')
      const context = { host, cloud, power, orderConfig, orderReady: action.type !== 'reinstall' || Boolean(orderConfig) }
      if (action.type === 'vnc') {
        if (power.status !== 'on') throw new Error(power.status === 'off' ? '服务器已关机，请开机后再远程登录' : '服务器当前状态不支持远程登录，请稍后重试')
      } else {
        const option = quickActionOptions({ ...context, ready: true }).find(item => item.key === action.key)
        if (!option || option.disabled) throw new Error(option?.reason || '当前状态无法执行此操作')
      }
      return context
    },
  }
}
