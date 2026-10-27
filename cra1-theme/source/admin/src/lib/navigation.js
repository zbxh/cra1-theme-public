import registry from '../workspace.registry.json'

export const menuLabel = label => label.replace(/配置$/, '')
const common = Object.values(registry.editors).filter(e => e.id.startsWith('common:')).map(e => ({
  id: e.id,
  label: ({ 'common:faq_board': '常见问题（服务与行业方案）', 'common:faq': '常见问题（产品与方案总览）' })[e.id] || menuLabel(e.label).replace(/通用内容$/, ''),
}))
export const PUBLIC_SETTINGS = {
  website: [
    { id: 'header', label: '头部' }, { id: 'footer', label: '底部' }, { id: 'float', label: '悬浮工具' },
    { id: 'common', label: '通用内容', children: common },
    { id: 'seo-default', label: '搜索引擎默认设置' }, { id: 'custom', label: '自定义 CSS / JS' },
  ],
  member: [{ id: 'sidebar', label: '菜单' }, { id: 'appearance', label: '外观' }, { id: 'custom', label: '自定义 CSS / JS' }],
  cart: [{ id: 'custom', label: '自定义 CSS / JS' }],
}
export const publicEditors = domain => (PUBLIC_SETTINGS[domain] || []).flatMap(item => item.children || [item])
export function publicSelection(domain, id) {
  if (id === 'common' && domain === 'website') return common[0]?.id || 'header'
  return publicEditors(domain).some(item => item.id === id) ? id : publicEditors(domain)[0]?.id
}
export function publicSettingRoute(domain, id, query = '') {
  const params = new URLSearchParams({ item: publicSelection(domain, id) })
  for (const [key, value] of new URLSearchParams(query)) if (key !== 'item') params.set(key, value)
  return `/${domain}/settings?${params}`
}
export function routeFor(domain, id, query = '') {
  if (domain === 'member' && id === 'notices' || id === 'site-notice') return '/notifications'
  if (publicEditors(domain).some(item => item.id === id) || domain === 'website' && id === 'common') return publicSettingRoute(domain, id, query)
  const params = new URLSearchParams(query)
  return `/${domain}/edit/${encodeURIComponent(id)}` + (params.size ? `?${params}` : '')
}
export function scopeRoute(id, query = '') {
  if (['announcements:all','member:notices','site-notice'].includes(id)) return '/notifications'
  if (id.startsWith('editor:')) { const [, domain, ...parts] = id.split(':'); return routeFor(domain, parts.join(':'), query) }
  if (id.startsWith('page:')) {
    const params = new URLSearchParams(query)
    if (id.endsWith(':seo')) params.set('module', 'seo')
    return routeFor('website', id.slice(0, id.lastIndexOf(':')), params)
  }
  if (id.startsWith('shared:')) return routeFor('website', 'common:' + id.slice(7), query)
  if (id.startsWith('member:') || id.startsWith('cart:')) { const [domain, key] = id.split(':'); return routeFor(domain, key, query) }
  const sections = { 'site-support': 'header', 'site-info': 'header', 'site-menu': 'header', 'site-notice': 'header', 'site-footer': 'footer', 'site-float': 'float', 'site-custom': 'custom', 'site:seo': 'seo-default' }
  const params = new URLSearchParams(query)
  if (['site-info', 'site-menu', 'site-notice', 'site-support'].includes(id) && !params.has('section')) params.set('section', id)
  return routeFor('website', sections[id] || 'page:home', params)
}
export function normalizeRoute(input) {
  let [base, query = ''] = (input || '/overview').replace(/^#/, '').split('?')
  if (!base.startsWith('/')) base = '/' + base
  const old = base.slice(1)
  const aliases = {
    announcements: ['/notifications'],
    overview: ['/overview'], 'website-config': ['website', 'header'], 'website-layout': ['website', 'page:home'],
    'website-seo': ['website', 'seo-default'], 'website-pages': ['website', 'page:home'],
    'member-content': ['member', 'home'], 'member-appearance': ['member', 'appearance'], 'member-sidebar': ['member', 'sidebar'],
    'cart-content': ['cart', 'goodslist'], security: ['/admin/me'],
  }
  if (aliases[old]) { const [domain, id] = aliases[old]; return id ? routeFor(domain, id, query) : domain + (query ? '?' + query : '') }
  if (registry.aliases[old]) return scopeRoute(registry.aliases[old], query)
  const bits = base.split('/').filter(Boolean), domain = bits[0]
  if(domain==='member'&&['notices','notice'].includes(bits[1])||domain==='member'&&['edit','pages'].includes(bits[1])&&bits[2]==='notices')return '/notifications'
  try {
    if (PUBLIC_SETTINGS[domain] && bits[1] === 'settings') { const p=new URLSearchParams(query); if(domain==='member'&&p.get('item')==='notices'||domain==='website'&&p.get('section')==='site-notice')return '/notifications'; return publicSettingRoute(domain,p.get('item'),query) }
    if (base === '/website/common') return publicSettingRoute('website', 'common', query)
    if (domain === 'website' && bits[1] === 'pages') {
      let page = decodeURIComponent(bits[2] || 'home'); page = registry.pageAliases[page]?.aliasOf || page
      const params = new URLSearchParams(query)
      if (bits[3] === 'seo') params.set('module', 'seo')
      return routeFor('website', 'page:' + (registry.pages[page] ? page : 'home'), params)
    }
    if (domain === 'website' && bits[1] === 'site') return scopeRoute(bits[2] || 'site-info', query)
    if (domain === 'website' && bits[1] === 'shared') return scopeRoute('shared:' + decodeURIComponent(bits[2]), query)
    if (base === '/website/seo') return routeFor('website', 'seo-default', query)
    if (['member', 'cart'].includes(domain) && bits[1] !== 'edit') return routeFor(domain, bits[1] === 'pages' ? bits[2] || 'home' : bits[1], query)
    if (bits[1] === 'edit') {
      const id = decodeURIComponent(bits[2] || ''), key = domain === 'website' ? id : domain + ':' + id
      return registry.editors[key] ? routeFor(domain, id, query) : '/overview'
    }
  } catch { return '/overview' }
  if(base==='/admin/account')base='/admin/me';if(base==='/admin/logs')base='/admin/audit'
  return ['/overview', '/notifications', '/attachments', '/admin/me', '/admin/accounts', '/admin/audit', '/admin/settings', '/admin/theme'].includes(base) ? base + (query ? '?' + query : '') : '/overview'
}
