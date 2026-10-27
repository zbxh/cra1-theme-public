import { currencyAffixes } from './currency.js'

// The list uses V10's public display fields. Never keep the full server-detail
// response here: that response also includes credentials and control settings.
const SERVER_MODULES = new Set(['mf_cloud', 'mf_dcim'])
const OS_ICONS = new Set(['Windows', 'CentOS', 'Ubuntu', 'Debian', 'ESXi', 'XenServer', 'FreeBSD', 'Fedora', 'ArchLinux', 'Rocky', 'AlmaLinux', 'OpenEuler', 'RedHat', 'Linux', 'TencentOS-Server', '其他'])
const NETWORK_ROOT = '/plugins/server/mf_cloud/template/clientarea/mobile/mfm301/img/cloudDetail/'

const text = value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
const positive = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null
const spec = (value, unit = '') => text(value) ? { value: text(value), unit } : null

export function productImageUrl(value) {
  const url = text(value)
  if (/^\/(?!\/)/.test(url) && !/[\u0000-\u0020\\]/.test(url)) return url
  if (/^https?:\/\//i.test(url)) {
    try { const parsed = new URL(url); return parsed.username || parsed.password ? '' : parsed.href } catch { return '' }
  }
  return ''
}

export function productSystemIcon(host) {
  const supplied = productImageUrl(host.card_summary?.imageIconUrl)
  if (supplied) return supplied
  const icon = text(host.card_summary?.imageIcon || host.image_icon)
  const custom = productImageUrl(icon)
  if (custom) return custom
  const name = icon.replace(/\.svg$/i, '')
  const module = host.module === 'mf_dcim' ? 'mf_dcim' : 'mf_cloud'
  return `/plugins/server/${module}/template/clientarea/pc/default/img/${module}/${encodeURIComponent(OS_ICONS.has(name) ? name : '其他')}.svg`
}

export function productNetwork(host) {
  const type = host.card_summary?.networkType || host.network_type
  if (type === 'normal') return { type, label: '经典网络', icon: NETWORK_ROOT + 'classical.svg' }
  if (type === 'vpc') return { type, label: 'VPC 网络', icon: NETWORK_ROOT + 'vpc.svg' }
  return { type: '', label: '', icon: '' }
}

// The home /host endpoint exposes the product's configured cycle name as
// billing_cycle, and an empty cycle for one-time products. Preserve that name
// (including custom durations) instead of abbreviating it in the browser.
export function productCardPrice(host, currency = {}) {
  const cycleName = text(host.billing_cycle_name)
  const cycle = text(host.billing_cycle)
  const types = new Set(['free', 'onetime', 'on_demand', 'recurring_prepayment', 'recurring_postpaid'])
  const type = types.has(cycle) ? cycle : host.billing_cycle === '' ? 'onetime' : ''
  const name = cycleName || (types.has(cycle) ? ({ free: '免费', onetime: '一次性', on_demand: '按需' })[cycle] || '' : cycle) || (type === 'onetime' ? '一次性' : '')
  const value = type === 'onetime' ? host.first_payment_amount : type === 'free' || cycle === '免费' ? 0 : host.renew_amount
  if (value == null || text(value) === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return null
  const fraction = text(value).split('.')[1]?.length || 0
  const digits = type === 'on_demand' ? 4 : Math.max(2, Math.min(4, fraction))
  return { amount: Number(value).toFixed(digits), cycle: name, ...currencyAffixes(currency, host) }
}

export function projectServerCard(detail, module) {
  if (!detail || !SERVER_MODULES.has(module)) return {}
  const summary = {
    imageName: text(detail.image?.name),
    imageIcon: text(detail.image?.icon),
    imageIconUrl: productImageUrl(detail.image?.icon_url),
    dataCenter: [...new Set(['country', 'city', 'area'].map(k => text(detail.data_center?.[k])).filter(Boolean))].join(' · '),
    ip: text(detail.ip),
    networkType: ['normal', 'vpc'].includes(detail.network_type) ? detail.network_type : '',
  }
  if (module === 'mf_cloud') {
    const cpu = positive(detail.cpu), memory = positive(detail.memory)
    const system = positive(detail.system_disk?.size), data = positive(detail.data_disk?.total_size)
    if (cpu != null) summary.cpu = spec(cpu, '核')
    if (memory != null) summary.memory = spec(memory, 'GB')
    if (system != null || data != null) summary.disk = spec((system || 0) + (data || 0), 'GB')
  } else {
    // DCIM hardware names are text, not cloud vCPU counts. Preserve that
    // contract instead of interpreting a CPU model number as a core count.
    summary.cpu = spec(detail.model_config?.cpu)
    summary.memory = spec(detail.model_config?.memory)
    summary.disk = spec(detail.model_config?.disk)
  }
  if (text(detail.bw_show)) summary.bandwidth = spec(detail.bw_show)
  else if (detail.bw !== '' && detail.bw != null && Number.isFinite(Number(detail.bw)) && Number(detail.bw) >= 0) summary.bandwidth = spec(Number(detail.bw), 'Mbps')
  // V10's instance detail exposes the configured base quota in GB as flow.
  // Zero means unlimited. Keep it separate from bandwidth and temporary packs.
  const quota = ['number', 'string'].includes(typeof detail.flow) ? positive(detail.flow) : null
  if (quota != null) summary.traffic = spec(quota, 'GB')
  return summary
}

export function productCardSpecs(host) {
  const fallback = {}
  const base = text(host.base_info)
  // The system's cloud base_info is "CPU核-内存G-磁盘G". Do not
  // extrapolate this positional format to DCIM/custom-module product names.
  const cloud = host.module === 'mf_cloud' && base.match(/^(\d+(?:\.\d+)?)\s*核\s*[-/|·]\s*(\d+(?:\.\d+)?)\s*G(?:B)?\s*[-/|·]\s*(\d+(?:\.\d+)?)\s*G(?:B)?(?:\b|$)/i)
  if (cloud) {
    if (positive(cloud[1])) fallback.cpu = spec(cloud[1], '核')
    if (positive(cloud[2])) fallback.memory = spec(cloud[2], 'GB')
    if (positive(cloud[3])) fallback.disk = spec(cloud[3], 'GB')
  }
  const bw = base.match(/(?:带宽\s*[:：]?\s*)?(\d+(?:\.\d+)?)\s*Mbps\b/i)
  if (bw) fallback.bandwidth = spec(bw[1], 'Mbps')
  const merged = { ...fallback }
  for (const key of ['cpu', 'memory', 'disk', 'bandwidth', 'traffic']) {
    const current = host.card_summary?.[key]
    if (current && text(current.value)) merged[key] = current
  }
  return merged
}

export async function loadProductCardSummaries(read, rows, fields, { isCancelled = () => false, onUpdate = () => {} } = {}) {
  if (!['base_info', 'ip', 'os', 'area'].some(field => fields.has(field))) return
  const queue = rows.filter(h => SERVER_MODULES.has(h.module) && /^\d+$/.test(String(h.id)) && h.status !== 'Deleted')
  let next = 0
  async function worker() {
    while (!isCancelled() && next < queue.length) {
      const host = queue[next++]
      try {
        const response = await read(`/${host.module}/${host.id}`)
        const detail = response.data
        if (!detail || !(detail.data_center || detail.image || detail.ip !== undefined)) throw new Error('实例信息未同步')
        if (!isCancelled()) onUpdate(host.id, projectServerCard(detail, host.module), false)
      } catch {
        if (!isCancelled()) onUpdate(host.id, {}, true)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker))
}

export function productPageNumbers(page, pages) {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1)
  const numbers = new Set([1, pages, page - 1, page, page + 1])
  if (page <= 2) { numbers.add(2); numbers.add(3) }
  if (page >= pages - 1) { numbers.add(pages - 1); numbers.add(pages - 2) }
  const result = []
  for (const number of [...numbers].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b)) {
    if (result.length && number > result[result.length - 1] + 1) result.push('…')
    result.push(number)
  }
  return result
}
