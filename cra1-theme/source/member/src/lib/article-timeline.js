const sources = {
  news: { label: '新闻', view: 'news_detail.htm' },
  announcement: { label: '公告', view: 'news_detail.htm' },
  help: { label: '帮助文档', view: 'helpTotal.htm' },
}
export const articleSource = value => Object.hasOwn(sources, value) ? value : 'news'
export const articleSourceInfo = value => sources[articleSource(value)]
export function articleRequest(source, typeId, limit) {
  source = articleSource(source)
  // V10's help endpoint returns public categories with their article lists.
  if (source === 'help') return '/help'
  const params = new URLSearchParams({ page: '1', limit: String(limit), sort: 'desc' })
  if (typeId > 0) params.set(`addon_idcsmart_${source}_type_id`, String(typeId))
  return `/${source}?${params}`
}
export function articleRows(response, source, typeId, limit) {
  const list = response.data?.list
  if (!Array.isArray(list)) throw new Error('文章暂时无法读取')
  const rows = articleSource(source) === 'help'
    ? list.filter(group => !typeId || Number(group.id) === typeId).flatMap(group => Array.isArray(group.helps) ? group.helps : [])
    : list
  return rows.filter(row => Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0 && typeof row.title === 'string' && row.title.trim()).slice(0, limit)
}
