const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const shared = path.resolve(__dirname, '../../public/cra1-shared/src')
const scripts = ['request.js', 'search-match.js', 'header-search.js'].map(name => fs.readFileSync(path.join(shared, name), 'utf8'))
const plain = value => JSON.parse(JSON.stringify(value))
const envelope = (data, status = 200) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify({ status, data }) })
const product = { key: 'products', path: 'product', label: '订购商品' }
const hosts = { key: 'hosts', path: 'host', label: '我的产品' } // Retained consumer options use the new theme adapter.
function fixture(read, { plugins = [], theme = 'member', pathname = '/home.htm' } = {}) {
  const storage = new Map([['jwt', 'fixture-session']]), calls = [], events = []
  const attrs = { 'data-cra1-theme': theme, addons_js: JSON.stringify(plugins) }
  const env = {
    setTimeout, clearTimeout, AbortController, CustomEvent, URLSearchParams, FormData,
    location: { pathname, search: '', href: pathname, replace(value) { this.href = value } },
    localStorage: { getItem: key => storage.get(key), removeItem: key => storage.delete(key) },
    sessionStorage: { setItem: (key, value) => storage.set(key, value) },
    document: {
      documentElement: { getAttribute: key => attrs[key] }, getElementById: () => null,
      dispatchEvent: event => events.push(event.type),
    },
    fetch: async (url, options) => { const parsed = new URL(url, 'https://fixture.invalid'); calls.push({ url: parsed, options }); return read(parsed, options) },
  }
  env.window = env; env.self = env; env.top = env
  scripts.forEach(source => vm.runInNewContext(source, env))
  return { api: env.CRA1Shared.HeaderSearch, env, storage, calls, events, attrs }
}
const empty = () => envelope({ list: [], count: 0 })
const later = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('default search requests only the currently enabled native article plugins', async () => {
  const f = fixture(empty, { plugins: [
    { id: 19, name: 'IdcsmartNews', status: 0 },
    { id: 25, name: 'IdcsmartAnnouncement', status: 1 },
    { id: 31, name: 'IdcsmartHelp', enabled: false },
  ] })
  await f.api.search({ keywords: '云' })
  assert.deepEqual(f.calls.map(call => call.url.pathname), ['/console/v1/product', '/console/v1/announcement'])
  assert.equal(f.api.pluginSources()[1].pluginId, 25)
  f.attrs.addons_js = 'broken'
  assert.deepEqual(plain(f.api.pluginSources()).map(source => source.key), ['products'])
})

test('projected website capabilities do not depend on a native addons element', () => {
  const f = fixture(empty)
  f.env.document.getElementById = () => { throw Error('must not read the member DOM') }
  assert.deepEqual(plain(f.api.pluginSources({ capabilities: { news: true, announcement: false, help: 1 }, includeHosts: true })).map(source => source.key), ['hosts', 'products', 'news', 'help'])
  assert.deepEqual(plain(f.api.pluginSources({ capabilities: { news: 'unknown' } })).map(source => source.key), ['products'])
})

test('member news, announcements and help use the installed plugin IDs and native views', async () => {
  const plugins = [{ id: 35, name: 'IdcsmartNews' }, { id: 41, name: 'IdcsmartAnnouncement' }, { id: 56, name: 'IdcsmartHelp' }]
  const f = fixture(url => envelope({ list: url.pathname.endsWith('/help') ? [{ name: '基础', helps: [{ id: 8, title: '云帮助' }] }] : [{ id: 8, title: '云文章' }] }), { plugins })
  const result = await f.api.search({ keywords: '云' })
  assert.deepEqual(plain(result.groups).filter(group => group.key !== 'products').map(group => group.items[0].url), [
    '/plugin/35/news_detail.htm?id=8', '/plugin/41/news_detail.htm?id=8', '/plugin/56/helpTotal.htm?id=8',
  ])
  const website = await f.api.search({ keywords: '云', context: 'website' })
  assert.equal(website.groups.find(group => group.key === 'announcement').items[0].url, '/announce-details.html?id=8')
})

test('search sends trimmed keywords without turning special characters into URL parameters', async () => {
  const f = fixture(empty)
  await f.api.search({ keywords: '  云 & a?b=1 + #  ', sources: [product] })
  assert.equal(f.calls[0].url.searchParams.get('keywords'), '云 & a?b=1 + #')
  assert.equal(f.calls[0].url.searchParams.has('b'), false)
  assert.equal(f.calls[0].options.method, 'GET')
  await f.api.search({ keywords: '  ', sources: [product] })
  assert.equal(f.calls.length, 1)
})

test('zero keywords do not become an unfiltered native product search', async () => {
  const f = fixture(() => { throw Error('must not request native search') })
  for(const keywords of ['0', ' 0 ']) {
    const result = await f.api.search({ keywords, sources: [hosts, product] })
    assert.equal(result.groups.length, 0)
    assert.equal(result.errors.length, 0)
  }
  assert.equal(f.calls.length, 0)
})

test('anonymous search excludes member products from default and retained explicit sources', async () => {
  for (const options of [
    { includeHosts: true, capabilities: {} },
    { sources: [hosts, product] },
    { sources: [hosts] },
  ]) {
    const f = fixture(url => {
      assert.ok(!url.pathname.endsWith('/member/search'), 'guest search must not read member products')
      return envelope({ list: [{ id: 8, name: '云商品' }], count: 1 })
    }, { theme: 'website' })
    f.storage.delete('jwt')
    const result = await f.api.search({ keywords: '云', ...options })
    assert.ok(result.groups.every(group => group.key !== 'hosts'))
    assert.deepEqual(plain(result.errors), [])
    assert.deepEqual(f.events, [])
    assert.equal(f.calls.length, options.sources?.length === 1 ? 0 : 1)
  }
})

test('a later login enables member products without caching guest source selection', async () => {
  const f = fixture(url => envelope({
    list: [{ id: 5, name: '实例', product_name: '云主机', status: 'Active', billing_cycle: 'onetime' }],
    overview: { server_time: 1000, renewal_enabled: false },
  }))
  f.storage.delete('jwt')
  const guest = await f.api.search({ keywords: '云', sources: [hosts] })
  assert.deepEqual(plain(guest.groups), [])
  f.storage.set('jwt', 'new-session')
  const member = await f.api.search({ keywords: '云', sources: [hosts] })
  assert.equal(member.groups[0].items[0].key, 'hosts:5')
  assert.equal(f.calls.length, 1)
})

test('member page and tab search is private even when an old consumer explicitly supplies it', async () => {
  const f = fixture(empty), pageCalls = []
  f.env.CRA1Shared.MemberSearchPages = { search: async (keywords, options) => {
    pageCalls.push({ keywords, options })
    return [{ key: 'page:security', title: '安全设置', description: '账户中心 · 标签', url: '/account.htm?tab=security' }]
  } }
  assert.deepEqual(plain(f.api.pluginSources({ includeHosts: true, capabilities: {} })).map(source => source.key), ['pages', 'hosts', 'products'])
  f.storage.delete('jwt')
  let result = await f.api.search({ keywords: '安全', sources: [{ key: 'pages', label: '会员页面与标签' }, product] })
  assert.equal(pageCalls.length, 0)
  assert.deepEqual(plain(result.groups), [])
  assert.equal(result.pending, 0)
  f.storage.set('jwt', 'member-session')
  result = await f.api.search({ keywords: '安全', sources: [{ key: 'pages', label: '会员页面与标签' }] })
  assert.equal(pageCalls.length, 1)
  assert.equal(result.groups[0].items[0].url, '/account.htm?tab=security')
  assert.equal(result.groups[0].items[0].index, 0)
  assert.equal(result.pending, 0)
})

test('late page-directory results cannot survive logout or an account switch', async () => {
  for (const token of ['', 'another-session']) {
    const f = fixture(empty), page = later(), updates = []
    f.env.CRA1Shared.MemberSearchPages = { search: () => page.promise }
    const pending = f.api.search({ keywords: '账户', sources: [{ key: 'pages', label: '会员页面与标签' }], onUpdate: value => updates.push(value) })
    if (token) f.storage.set('jwt', token)
    else f.storage.delete('jwt')
    page.resolve([{ key: 'page:account', title: '账户信息', description: '账户中心', url: '/account.htm' }])
    const result = await pending
    assert.equal(result.groups.length, 0)
    assert.equal(updates.length, 0)
    assert.equal(result.pending, 0)
  }
})

test('page matches preserve real query routes and healthy sources survive a directory failure', async () => {
  const f = fixture(() => envelope({ list: [{ id: 5, product_name: '云主机', name: 'host-mark', match_ip: '2001:db8::5', status: 'Active', billing_cycle: 'onetime' }] }))
  f.env.CRA1Shared.MemberSearchPages = { search: async () => { throw Error('internal directory details') } }
  const result = await f.api.search({ keywords: '2001:db8', sources: [{ key: 'pages', label: '会员页面与标签' }, hosts] })
  assert.equal(result.partialFailure, true)
  assert.deepEqual(plain(result.errors), ['会员页面与标签'])
  assert.equal(result.groups[0].items[0].description, 'host-mark · 2001:db8::5 · 编号 5')
  assert.equal(JSON.stringify(result).includes('internal directory'), false)
})

test('member results follow current lifecycle and actual native renewal eligibility', async () => {
  const active = { status: 'Active', billing_cycle: 'monthly', due_time: 2000, renew_recovery_deadline: 3000 }
  const expired = { ...active, due_time: 900, renew_recovery_deadline: 1500 }
  const rows = [
    { ...active, id: 1 }, { ...expired, id: 2 },
    { ...active, id: 3, status: 'Unpaid' }, { ...active, id: 4, status: 'Deleted' },
    { ...active, id: 5, status: 'Cancelled' }, { ...active, id: 6, is_delete: 1 },
    { ...expired, id: 7, renew_forbidden: 1 }, { ...expired, id: 8, change_billing_cycle_id: 7 },
    { ...expired, id: 9, renew_recovery_deadline: 999 }, { ...expired, id: 10, renew_recovery_deadline: null },
    { ...expired, id: 11, status: 'Suspended', suspend_type: 'abuse' },
    { ...expired, id: 12, status: 'Suspended', suspend_type: 'overdue' },
    { ...active, id: 13, status: 'Grace', billing_cycle: 'on_demand', end_grace_time: 1200 },
    { ...active, id: 14, status: 'Grace', billing_cycle: 'on_demand', end_grace_time: 900 },
    { ...active, id: 15, status: 'Keep', billing_cycle: 'on_demand' },
    { ...expired, id: 16 },
  ].map(row => ({ ...row, product_name: '云主机 ' + row.id }))
  const f = fixture(url => url.pathname.endsWith('/member/search')
    ? envelope({ list: rows, count: rows.length, overview: { server_time: 1000, renewal_enabled: true } })
    : envelope({ list: [{ id: 2, billing_cycles: [{ name: '月付' }] }, { id: 12, billing_cycles: [] }, { id: 16, billing_cycles: [{ name: '月付' }], status: 'Deleted' }] }))
  const result = await f.api.search({ sources: [hosts], keywords: '云' })
  assert.deepEqual(plain(result.groups[0].items).map(item => item.key), ['hosts:1', 'hosts:2', 'hosts:13'])
  assert.equal(result.groups[0].more, false)
  assert.deepEqual(f.calls.map(call => call.url.pathname), ['/console/v1/cra1-theme/member/search', '/console/v1/host/renew/batch'])
  assert.deepEqual(Array.from(f.calls[1].url.searchParams.values()), ['2', '11', '12', '16'])
  assert.ok(f.calls.every(call => call.options.method === 'GET'))
})

test('paid pending, failed and manually suspended products keep their search management entry', async () => {
  const rows = [
    { id: 1, status: 'Pending', due_time: 0, billing_cycle: 'monthly' },
    { id: 2, status: 'Failed', due_time: 2000, billing_cycle: 'monthly' },
    { id: 3, status: 'Suspended', suspend_type: 'manual', due_time: 2000, billing_cycle: 'monthly' },
    { id: 4, status: 'Suspended', suspend_type: 'manual', billing_cycle: 'onetime' },
  ]
  const f = fixture(() => envelope({ list: rows, count: 4, overview: { server_time: 1000, renewal_enabled: false } }))
  const result = await f.api.search({ keywords: '产品', sources: [hosts] })
  assert.deepEqual(plain(result.groups[0].items).map(item => item.key), ['hosts:1', 'hosts:2', 'hosts:3', 'hosts:4'])
  assert.equal(f.calls.length, 1)
})

test('disabled renewal and failed renewal preserve confirmed running products without promising recovery', async () => {
  for (const enabled of [false, true]) {
    const f = fixture(url => url.pathname.endsWith('/member/search')
      ? envelope({ list: [{ id: 1, status: 'Active', billing_cycle: 'onetime' }, { id: 2, status: 'Active', billing_cycle: 'monthly', due_time: 900, renew_recovery_deadline: 1500 }], overview: { server_time: 1000, renewal_enabled: enabled } })
      : envelope({}, 503))
    const result = await f.api.search({ keywords: '云', sources: [hosts] })
    assert.deepEqual(plain(result.groups[0].items).map(item => item.key), ['hosts:1'])
    assert.equal(f.calls.length, enabled ? 2 : 1)
    assert.equal(result.errors.length, enabled ? 1 : 0)
    assert.equal(result.partialFailure, enabled)
  }
})

test('expired member search clears the login and redirects only on protected pages', async () => {
  for (const theme of ['member', 'website']) {
    const f = fixture(url => url.pathname.endsWith('/member/search') ? envelope({}, 401) : envelope({ list: [{ id: 1, name: '云商品' }] }), { theme })
    const result = await f.api.search({ keywords: '云', sources: [hosts, product] })
    assert.equal(f.storage.get('jwt'), undefined)
    assert.deepEqual(f.events, ['api:unauthorized'])
    assert.equal(f.env.location.href, theme === 'member' ? '/login.htm' : '/home.htm')
    assert.equal(result.groups.some(group => group.key === 'hosts'), false)
  }
})

test('a public article failure cannot invalidate an otherwise valid member login', async () => {
  const f = fixture(() => envelope({}, 401))
  const result = await f.api.search({ keywords: '云', sources: [{ key: 'news', path: 'news', label: '新闻文章' }] })
  assert.equal(f.storage.get('jwt'), 'fixture-session')
  assert.deepEqual(f.events, [])
  assert.equal(result.partialFailure, false)
  assert.deepEqual(plain(result.errors), ['新闻文章'])
})

test('fast sources publish before a slow source while final group order and indices remain deterministic', async () => {
  const news = later(), partials = []
  const f = fixture(url => url.pathname.endsWith('/news') ? news.promise : envelope({ list: [{ id: 2, name: '云商品' }] }))
  const pending = f.api.search({ keywords: '云', sources: [{ key: 'news', path: 'news', label: '新闻文章' }, product], onUpdate: value => partials.push(plain(value)) })
  await new Promise(done => setImmediate(done))
  assert.ok(partials.some(value => value.pending > 0 && value.groups.some(group => group.key === 'products')))
  assert.ok(partials.every(value => value.pending > 0 && value.groups.every(group => group.key === 'products')))
  news.resolve(envelope({ list: [{ id: 3, title: '云文章' }] }))
  const result = await pending
  assert.deepEqual(plain(result.groups).map(group => group.key), ['news', 'products'])
  assert.deepEqual(plain(result.groups).flatMap(group => group.items).map(item => item.index), [0, 1])
  assert.equal(partials.at(-1).pending, 0)
})

test('source failure keeps healthy results and distinguishes partial from complete failure without diagnostics', async () => {
  for (const failAll of [false, true]) {
    const f = fixture(url => url.pathname.endsWith('/news') || failAll ? envelope({ error: 'private credentials' }, 503) : envelope({ list: [{ id: 1, name: '云商品' }] }))
    const result = await f.api.search({ keywords: '云', sources: [product, { key: 'news', path: 'news', label: '新闻文章' }] })
    assert.equal(result.groups.length, failAll ? 0 : 1)
    assert.equal(result.partialFailure, !failAll)
    assert.equal(result.errors.length, failAll ? 2 : 1)
    assert.equal(JSON.stringify(result).includes('credentials'), false)
  }
  const f = fixture(url => url.pathname.endsWith('/news') ? envelope({}, 503) : empty())
  const result = await f.api.search({ keywords: '无匹配', sources: [product, { key: 'news', path: 'news', label: '新闻文章' }] })
  assert.equal(result.groups.length, 0)
  assert.equal(result.partialFailure, true)
})

test('late member responses and progressive updates are discarded after logout or a session switch', async () => {
  for (const token of ['', 'new-session']) {
    const response = later(), updates = []
    const f = fixture(() => response.promise)
    const pending = f.api.search({ keywords: '云', sources: [hosts], onUpdate: value => updates.push(value) })
    if (token) f.storage.set('jwt', token)
    else f.storage.delete('jwt')
    response.resolve(envelope({ list: [{ id: 1, product_name: '前账号产品', status: 'Active', billing_cycle: 'onetime' }] }))
    const result = await pending
    assert.equal(result.groups.length, 0)
    assert.equal(updates.length, 0)
  }
})

test('cancelled searches do not publish late partial results', async () => {
  const response = later(), updates = [], controller = new AbortController()
  const f = fixture(() => response.promise)
  const pending = f.api.search({ keywords: '云', sources: [product], signal: controller.signal, onUpdate: value => updates.push(value) })
  controller.abort(); response.resolve(envelope({ list: [{ id: 1, name: '云商品' }] }))
  await pending
  assert.equal(updates.length, 0)
})
