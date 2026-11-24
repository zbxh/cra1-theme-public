/** Keep copy overrides attached to the real menu entry, including nested pages. */
export function productListTree(nodes = [], parents = [], hidden = false, parentProduct = null) {
  return nodes.flatMap(node => {
    const label = node.label || '未命名菜单'
    const path = [...parents, label]
    const menuHidden = hidden || Boolean(Number(node.hidden))
    const product = /^\/?productList\.htm(?:[?#]|$)/.test(node.url || '')
    const children = productListTree(node.children || [], path, menuHidden, product ? { id: node.id, label } : parentProduct)
    if (!product && !children.length) return []
    return [{ id: node.id, label, path, hidden: menuHidden, product, parentProduct, children }]
  })
}

export function productCopyFallback(config, node) {
  const parent = node?.parentProduct
  if (parent && Number(config.overrides?.[parent.id]?.enabled) === 1) return `继承「${parent.label}」`
  return node && Number(config.default?.enabled) === 1 ? '继承全局默认' : '使用主题默认文案'
}

export function productPurchaseFallback(config, node) {
  const parent = node?.parentProduct
  const inherited = config.overrides?.[parent?.id]?.purchase
  if (inherited) return { value: inherited, label: `「${parent.label}」` }
  return { value: node ? config.default?.purchase : undefined, label: '全局默认' }
}

export function validProductPurchaseUrl(value) {
  const url = value.trim()
  if (!url) return true
  if (/[\x00-\x20\x7f<>"'\\]/.test(url) || url.startsWith('//')) return false
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url)
      return /^https?:\/\/[^/?#@]+(?:[/?#]|$)/i.test(url) && Boolean(parsed.hostname)
    } catch { return false }
  }
  return !/^[^/?#]*:/.test(url)
}

/** The admin endpoint returns the plugin catalogue inside data.catalog. */
export function homeArticleCatalog(response) {
  if (response.status !== 200) throw new Error(response.msg || '分类读取失败，请重试')
  const catalog = response.data?.catalog
  if (!catalog || catalog.error || !Array.isArray(catalog.news?.types)) {
    throw new Error('分类暂时无法读取，请重试')
  }
  return catalog
}
