/** Keep copy overrides attached to the real menu entry, including nested pages. */
export function productListTree(nodes = [], parents = [], hidden = false) {
  return nodes.flatMap(node => {
    const path = [...parents, node.label || '未命名菜单']
    const menuHidden = hidden || Boolean(Number(node.hidden))
    const children = productListTree(node.children || [], path, menuHidden)
    const product = /^\/?productList\.htm(?:[?#]|$)/.test(node.url || '')
    if (!product && !children.length) return []
    return [{ id: node.id, label: node.label || '未命名菜单', path, hidden: menuHidden, product, children }]
  })
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
