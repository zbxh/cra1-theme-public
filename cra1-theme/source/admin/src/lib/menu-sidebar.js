export function navigationDepth(node) {
  if (node?.row?.source === 'cart') return 4
  const depth = nodes => nodes?.length ? 1 + Math.max(...nodes.map(n => depth(n.children))) : 0
  return Math.min(4, Math.max(2, 1 + depth(node?.children)))
}

export function menuSidebarDefaults(row, depth, commonLinks = '') {
  return {
    version: 1, title: row.name || '', description: depth === 2 ? (row.desc || '') : '',
    overview: { enabled: depth === 2 && !!row.url, name: row.name || '', url: row.url || '', blank: row.blank === '1' },
    links: depth === 2 ? commonLinks : '',
  }
}

export function readMenuSidebar(value, row, depth, commonLinks = '') {
  const fallback = menuSidebarDefaults(row, depth, commonLinks)
  try {
    const data = JSON.parse(decodeURIComponent(value))
    if (data?.version !== 1) return fallback
    return {
      version: 1, title: typeof data.title === 'string' ? data.title : '',
      description: typeof data.description === 'string' ? data.description : '',
      overview: { enabled: data.overview?.enabled === true, name: String(data.overview?.name || ''), url: String(data.overview?.url || ''), blank: data.overview?.blank === true },
      links: typeof data.links === 'string' ? data.links : '',
    }
  } catch { return fallback }
}

// A single encoded column keeps pipes, newlines and Unicode inside the parent record.
export function writeMenuSidebar(value) { return encodeURIComponent(JSON.stringify(value)) }
