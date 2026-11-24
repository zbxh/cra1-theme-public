import { get, memberSnapshot } from '../lib'
import { productNavigationCategories, productListEntries, productOverviewAliases } from './product-config'

/** Use the same navigation and product associations as the member sidebar. */
export async function memberProductCategories() {
  return (await memberProductNavigation()).categories
}

export async function memberProductNavigation() {
  const snapshot = await memberSnapshot()
  const language = localStorage.getItem('lang') || 'zh-cn'
  let nodes = snapshot?.sidebar
  if (!Array.isArray(nodes)) {
    const response = await get('/menu')
    if (!Array.isArray(response.data?.menu)) throw new Error('导航分类读取失败，请重试')
    nodes = response.data.menu
  }
  const entries = productListEntries(nodes)
  return { categories: productNavigationCategories(nodes, language), overviewAliases: productOverviewAliases(nodes, entries), entries }
}
