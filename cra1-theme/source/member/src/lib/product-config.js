/** Menu display metadata shared by product tabs and category host loading. */
export function localizedMenuName(node, language = 'zh-cn') {
  return node?.language?.[language] || node?.name || node?.label || ''
}

export function associatedProductIds(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { value = value.split(',') }
  }
  const values = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []
  return [...new Set(values.filter(id => ['number', 'string'].includes(typeof id)).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))]
}

/** Preserve navigation order and membership, including status links below a category. */
export function productNavigationCategories(nodes, language = 'zh-cn') {
  const categories = [], seen = new Set()
  const walk = (items, owner = null) => {
    for (const node of Array.isArray(items) ? items : []) {
      if (Number(node.hidden) === 1) continue
      const key = String(node.id ?? '')
      let category = owner
      if (['module', 'res_module'].includes(node.type) && key && !seen.has(key)) {
        seen.add(key)
        const name = localizedMenuName(node, language)
        category = { ...node, key, name, label: name, product_id: associatedProductIds(node.product_id), aliases: [key] }
        categories.push(category)
      } else if (category && key) category.aliases.push(key)
      walk(node.children || node.child, category)
    }
  }
  walk(nodes)
  return categories
}

export function findProductCategory(categories, key) {
  return categories.find(category => category.key === String(key) || category.aliases?.includes(String(key))) || null
}

/** Track the visible entry separately from the category that supplies its products. */
export function productListEntries(nodes) {
  const entries = new Map()
  const walk = (items, parent = null, inCategory = false) => {
    for (const node of Array.isArray(items) ? items : []) {
      if (Number(node.hidden) === 1) continue
      const owned = inCategory || ['module', 'res_module'].includes(node.type)
      const url = String(node.url || '')
      let next = parent
      if (node.id != null && /^\/?productList\.htm(?:[?#]|$)/.test(url)) {
        const tab = new URLSearchParams(url.split('#', 1)[0].split('?')[1]).get('tab')
        next = { key: String(node.id), parent: parent?.key, tab, owned, purchaseUrl: node.purchase_url }
        entries.set(next.key, next)
      }
      walk(node.children || node.child, next, owned)
    }
  }
  walk(nodes)
  return entries
}

export function productOverviewAliases(nodes, entries = productListEntries(nodes)) {
  return [...entries.values()].filter(entry => !entry.owned).map(entry => entry.key)
}

/** Resolve the matching page, including old links that used the parent ID. */
function productListSelection(entries, key, tab) {
  const entry = entries.get(key)
  const parent = entries.get(entry?.parent)
  const group = parent || entry
  if (!group || (entry.tab || 'current') === tab) return [entry, group]
  const matches = [...entries.values()].filter(candidate => candidate.parent === group.key && candidate.tab === tab)
  return [matches.length === 1 ? matches[0] : null, group]
}

export function productListCopy(config, entries, key, tab) {
  return productListSources(config, entries, key, tab).copy
}

export function productListPurchase(config, entries, key, tab, category) {
  return productListSources(config, entries, key, tab, category).purchase
}

export function productListSources(config, entries, key, tab, category) {
  const [selected, group] = productListSelection(entries, key, tab)
  const candidates = [
    ...(selected ? [{ key: selected.key, block: config?.overrides?.[selected.key] }] : []),
    ...(group && group !== selected ? [{ key: group.key, block: config?.overrides?.[group.key] }] : []),
    { key: 'default', block: config?.default },
  ]
  const copy = candidates.find(({ block }) => Number(block?.enabled) === 1)
  const purchase = candidates.find(({ block }) => block?.purchase != null)
  const button = purchase?.block.purchase
  const url = [
    { value: button?.url, source: 'button' },
    { value: selected?.purchaseUrl, source: 'menu' },
    { value: group?.purchaseUrl, source: 'menu' },
    { value: category?.purchase_url, source: 'menu' },
    { value: '/cart/goodsList.htm', source: 'theme' },
  ].find(({ value }) => value)
  return {
    selectedKey: selected?.key || group?.key || null,
    copy: copy?.block || null,
    copySource: copy?.key || null,
    titleSource: copy?.block.title ? copy.key : category ? 'category' : null,
    descriptionSource: copy?.block.description ? copy.key : null,
    title: copy?.block.title || category?.name || '我的产品',
    description: copy?.block.description || (category ? '查看与管理该分类下的产品与服务' : '查看与管理已订购的产品与服务'),
    purchaseSource: purchase?.key || null,
    purchaseUrlSource: url.source,
    purchase: Number(button?.enabled) === 1 ? {
      url: url.value, text: button.text || '购买产品', newTab: button.target === 'blank',
    } : null,
  }
}

export const DEFAULT_HOST_FIELDS = ['product_name', 'base_info', 'ip', 'notes', 'status', 'due_time', 'os', 'area']
export function hostDisplayFields(category) {
  const explicit = category && (category.select_field_set || category.select_field?.length)
  const selected = Array.isArray(category?.select_field) ? category.select_field : String(category?.select_field || '').split(',').map(v=>v.trim()).filter(Boolean)
  const fields = new Set(explicit ? selected : DEFAULT_HOST_FIELDS)
  if ((!explicit || Number(category.select_field_version || 1) < 2) && fields.has('product_name')) fields.add('instance_name')
  return fields
}

export function hostCardTitle(host, fields) {
  if (fields.has('product_name')) return host.product_name || '—'
  if (fields.has('instance_name')) return host.name || `产品 #${host.id}`
  return `产品 #${host.id}`
}

export async function completeHostDisplayData(get, list, category) {
  const fields = hostDisplayFields(category)
  return Promise.all(list.map(async host => {
    const extra = {}
    const jobs = []
    if ((fields.has('is_auto_renew') && host.is_auto_renew == null) || (fields.has('billing_cycle') && !host.billing_cycle_name)) {
      jobs.push(get(`/host/${host.id}`).then(res => {
        const value = res.data?.host
        if (!value?.id) return
        if (value.auto_renew != null) extra.is_auto_renew = value.auto_renew
        if (value.billing_cycle_name) extra.billing_cycle_name = value.billing_cycle_name
      }).catch(() => {}))
    }
    if (fields.has('power_status') && !host.power_status && ['mf_cloud', 'mf_dcim'].includes(host.module)) {
      jobs.push(get(`/${host.module}/${host.id}/status`).then(res => {
        if (res.data?.status) extra.power_status = res.data.status
      }).catch(() => {}))
    }
    await Promise.all(jobs)
    return { ...host, ...extra }
  }))
}

export async function loadCategoryHosts(get, params, category) {
  const base = { ...params, orderby: 'id', sort: 'desc' }
  if (category) {
    const products = associatedProductIds(category.product_id)
    // An unassigned category is empty. Never widen it to a whole server module.
    if (!products.length) return { list: [], count: 0 }
    products.forEach((id, i) => { base[`product_id[${i}]`] = id })
  }
  return (await get('/cra1-theme/member/product-list', base)).data || {}
}
