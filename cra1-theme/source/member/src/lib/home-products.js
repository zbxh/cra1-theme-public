import { associatedProductIds } from './product-config.js'

export function homeProductCategories(rows, navigation = []) {
  const categories = navigation.map(category => {
    const products = new Set(associatedProductIds(category.product_id))
    return { ...category, label: category.label || category.name, rows: rows.filter(host => products.has(Number(host.product_id))) }
  })
  return [{ key: 'all', label: '全部分类', rows }, ...categories]
}

// Eligibility is based on service state AND actual expiry. On-demand/free/
// one-time billing has no recurring expiry; Grace remains usable only until
// its own deadline. An expired candidate still needs the renewal API's approval.
export function homeProductState(host, now = Date.now() / 1000) {
  if (Number(host.is_delete) === 1) return 'hidden'
  const status = host.status
  const cycle = host.billing_cycle
  if (status === 'Grace') {
    return cycle === 'on_demand' && Number(host.end_grace_time) > now ? 'grace' : 'hidden'
  }
  if (!['Active', 'Suspended'].includes(status)) return 'hidden'
  if (['free', 'onetime', 'on_demand'].includes(cycle)) return status === 'Active' ? 'using' : 'hidden'
  const due = host.due_time
  if (due === null || due === undefined || due === '' || !Number.isFinite(Number(due)) || Number(due) < 0) return 'hidden'
  if (Number(due) === 0 || Number(due) > now) return status === 'Active' ? 'using' : 'hidden'
  if (status === 'Suspended' && host.suspend_type !== 'overdue') return 'hidden'
  if (Number(host.renew_forbidden) === 1 || Number(host.change_billing_cycle_id) > 0) return 'hidden'
  const deadline = host.renew_recovery_deadline
  if (deadline === null || deadline === undefined || deadline === '' || !Number.isFinite(Number(deadline))) return 'hidden'
  if (Number(deadline) !== 0 && Number(deadline) <= now) return 'hidden'
  return 'expired'
}

async function availableHomeProducts(get, hosts, overview, isCancelled) {
  const now = Number(overview.server_time) > 0 ? Number(overview.server_time) : Date.now() / 1000
  const visible = new Map()
  const expired = []
  let renewalError = false
  for (const host of hosts) {
    const state = homeProductState(host, now)
    if (state === 'using' || state === 'grace') visible.set(String(host.id), { ...host, home_state: state })
    else if (state === 'expired' && (overview.renewal_enabled === true || Number(overview.renewal_enabled) === 1)) expired.push(host)
  }
  // Read the existing renewal eligibility endpoint (including module hooks).
  // Never create a renewal order or call a server operation from the homepage.
  for (let start = 0; start < expired.length; start += 20) {
    if (isCancelled()) return { rows: [], renewalError: false }
    const batch = expired.slice(start, start + 20)
    const params = Object.fromEntries(batch.map((host, i) => [`ids[${i}]`, host.id]))
    try {
      const response = await get('/host/renew/batch', params)
      if (!Array.isArray(response.data?.list)) throw new Error('续费资格读取失败')
      const allowed = new Map(response.data.list.filter(h => h && h.id).map(h => [String(h.id), h]))
      for (const host of batch) {
        const current = allowed.get(String(host.id))
        if (!current) continue
        // Only copy public lifecycle fields from the renewal response, which
        // otherwise includes internal host attributes irrelevant to this view.
        const fresh = { ...host }
        for (const field of ['status', 'due_time', 'suspend_type', 'billing_cycle', 'renew_forbidden', 'change_billing_cycle_id', 'is_delete']) {
          if (Object.hasOwn(current, field)) fresh[field] = current[field]
        }
        const state = homeProductState(fresh, now)
        if (state === 'using' || (state === 'expired' && Array.isArray(current.billing_cycles) && current.billing_cycles.length > 0)) {
          visible.set(String(host.id), { ...fresh, home_state: state })
        }
      }
    } catch {
      // Keep confirmed running products visible, but do not claim that an
      // unverified expired product can be recovered. The UI offers a retry.
      renewalError = true
    }
  }
  return { rows: hosts.filter(h => visible.has(String(h.id))).map(h => visible.get(String(h.id))), renewalError }
}

// Finish inventory pagination before filtering; API totals also include hidden
// states. A failed inventory page must not look like a smaller inventory.
export async function loadHomeProducts(get, isCancelled = () => false) {
  const rows = new Map()
  const limit = 100
  let overview = {}
  for (let page = 1; ; page++) {
    if (isCancelled()) return { rows: [], renewalError: false }
    const res = await get('/cra1-theme/member/products', { page, limit, orderby: 'id', sort: 'desc' })
    if (isCancelled()) return { rows: [], renewalError: false }
    const data = res.data
    if (data?.overview) overview = data.overview
    const count = Number(data?.count)
    if (!Array.isArray(data?.list) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('产品数据不完整，请重试')
    }
    const before = rows.size
    for (const host of data.list) {
      if (!host || !Number.isSafeInteger(Number(host.id)) || Number(host.id) <= 0) {
        throw new Error('产品数据不完整，请重试')
      }
      rows.set(String(host.id), host)
    }
    if (rows.size >= count) return availableHomeProducts(get, [...rows.values()], overview, isCancelled)
    if (rows.size === before) throw new Error('产品列表读取不完整，请重试')
  }
}
