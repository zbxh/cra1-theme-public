const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const shared = path.resolve(__dirname, '../../public/cra1-shared/src')
const source = ['runtime.js', 'search-match.js', 'member-search-pages.js'].map(file => fs.readFileSync(path.join(shared, file), 'utf8'))
const plain = value => JSON.parse(JSON.stringify(value))
const rule = name => 'app\\home\\controller\\' + name.replace('::', 'Controller::')
const later = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fixture({ snapshot, menu = [], access = { all: true }, plugins = [], runtime = {}, session = 'member-a', request } = {}) {
  const storage = new Map([['jwt', session]]), requests = [], fetches = [], writes = [], listeners = {}, watchers = []
  const attributes = { addons_js: JSON.stringify(plugins) }
  const env = {
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    location: { origin: 'https://fixture.invalid', pathname: '/home.htm' },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => { writes.push(key); storage.set(key, value) } },
    document: {
      documentElement: { getAttribute: key => attributes[key], hasAttribute: () => false },
      getElementById: () => null,
      addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn) },
    },
    __CRA1_RUNTIME__: runtime,
    CRA1Shared: {
      Request: {
        getToken: () => storage.get('jwt') || '',
        request: async (url, options) => {
          requests.push({ url, options })
          if (request) return request(url, options)
          return { status: 200, data: url === '/theme/access' ? access : { menu } }
        },
      },
      NotificationSession: { watch: fn => { watchers.push(fn); return () => {} } },
    },
    fetch: async url => { fetches.push(url); return { ok: false } },
  }
  if (snapshot !== undefined) env.__CRA1_MEMBER_SNAPSHOT__ = snapshot
  env.window = env
  source.forEach(script => vm.runInNewContext(script, env))
  return { env, api: env.CRA1Shared.MemberSearchPages, storage, requests, fetches, writes, watchers, listeners }
}
const sidebar = (...nodes) => ({ sidebar: nodes, features: {} })

test('guests never read member permissions, sidebar or fallback menu', async () => {
  const f = fixture({ session: '' })
  Object.defineProperty(f.env, '__CRA1_MEMBER_SNAPSHOT__', { get() { throw Error('private directory must not be read') } })
  assert.deepEqual(plain(await f.api.search('账户')), [])
  assert.deepEqual(f.requests, [])
  assert.deepEqual(f.fetches, [])
  assert.equal(f.watchers.length, 0)
})

test('real account, finance, security and product tabs retain working query values', async () => {
  const f = fixture({ runtime: { features: { ssh: true, security_group: true } }, snapshot: { sidebar: [
    { name: '账户中心', children: [{ name: '账户信息', url: 'account.htm' }, { name: '安全中心', url: 'security.htm' }] },
    { name: '财务中心', url: 'finance.htm' }, { id: 'products-a', name: '我的产品', url: 'productList.htm?m=mf_cloud' },
  ], features: { ssh: true, security_group: true } } })
  for (const [query, target] of [
    ['基本资料', '/account.htm?tab=profile'], ['安全设置', '/account.htm?tab=security'],
    ['我的订单', '/finance.htm?tab=orders'], ['交易记录', '/finance.htm?tab=transactions'],
    ['冻结记录', '/finance.htm?tab=freeze'], ['API 密钥', '/security.htm?tab=api'],
    ['SSH 密钥', '/security.htm?tab=ssh'], ['安全组', '/security.htm?tab=group'],
    ['即将到期', '/productList.htm?m=mf_cloud&cloud_menu=products-a&tab=expiring'],
    ['已逾期', '/productList.htm?m=mf_cloud&cloud_menu=products-a&tab=overdue'],
    ['已删除', '/productList.htm?m=mf_cloud&cloud_menu=products-a&tab=deleted'],
  ]) {
    const result = await f.api.search(query)
    assert.ok(result.length, query)
    assert.equal(result[0].url, target, query)
    assert.match(result[0].description, /^标签页 · /)
  }
  assert.equal(f.requests.filter(read => read.url === '/theme/access').length, 1)
  assert.deepEqual(f.writes, ['common_set_before'])
})

test('page names and hierarchy are searchable with distinct page and tab descriptions', async () => {
  const f = fixture({ snapshot: sidebar({ name: '运营账户', children: [{ name: '我的资料', url: 'account.htm' }] }) })
  const result = plain(await f.api.search('运营账户'))
  assert.equal(result.length, 4)
  assert.equal(result[0].description, '会员页面 · 运营账户')
  assert.equal(result[1].description, '标签页 · 运营账户 / 我的资料')
  assert.ok(result.every(item => item.url.startsWith('/account.htm')))
  assert.equal((await f.api.search('我的资料'))[0].title, '我的资料')
})

test('specific-tab menus do not invent other tabs or drop their parameters', async () => {
  const f = fixture({ snapshot: sidebar({ name: '登录安全', url: 'account.htm?tab=security&section=operate_password' }) })
  assert.equal((await f.api.search('登录安全'))[0].url, '/account.htm?tab=security&section=operate_password')
  assert.equal((await f.api.search('基本资料')).length, 0)
})

test('subaccount rules and native page grants filter page and tab results', async () => {
  const f = fixture({
    snapshot: sidebar({ name: '账户信息', url: 'account.htm' }, { name: '财务中心', url: 'finance.htm' }, { name: '安全中心', url: 'security.htm' }),
    access: { all: false, known: ['Account::update', 'Account::updatePassword', 'Account::creditList', 'Order::list', 'Transaction::list', 'Api::list', 'Log::list'].map(rule), rules: [rule('Account::update'), rule('Log::list')], pages: [{ url: '/finance.htm', allowed: false }, { url: '/security.htm?tab=log', allowed: false }] },
  })
  assert.equal((await f.api.search('基本资料')).length, 1)
  for (const term of ['安全设置', '余额记录', '财务', '我的订单', 'API 密钥', '操作日志']) assert.equal((await f.api.search(term)).length, 0, term)
})

test('disabled features and hidden branches never enter directory results', async () => {
  const f = fixture({ snapshot: sidebar(
    { name: '安全中心', url: 'security.htm' },
    { name: '余额充值', url: 'recharge.htm' }, { name: '申请提现', url: 'withdrawal.htm' },
    { name: '隐藏根', hidden: 1, children: [{ name: '隐藏资料', url: 'account.htm' }] },
    { name: '关闭资料', enabled: 0, url: 'account.htm' },
    { name: '正常资料', hidden: '0', url: 'account.htm' },
  ) })
  for (const query of ['SSH', '安全组', '充值', '提现', '隐藏', '关闭']) assert.equal((await f.api.search(query)).length, 0, query)
  assert.equal((await f.api.search('正常资料')).length, 4)
})

test('an explicitly empty sidebar never restores system default pages', async () => {
  const f = fixture({ snapshot: sidebar(), menu: [{ name: '账户信息', url: 'account.htm' }] })
  assert.equal((await f.api.search('账户')).length, 0)
  assert.deepEqual(f.requests.map(item => item.url), ['/theme/access'])
  assert.equal((await f.api.search('控制台'))[0].url, '/home.htm')
})

test('missing projection falls back to native menu and filters inactive plugin IDs', async () => {
  const f = fixture({ menu: [
    { name: '原生财务', url: 'finance.htm', child: [{ name: '有效工单', url: 'plugin/43/ticket.htm' }, { name: '停用工单', url: 'plugin/44/ticket.htm' }] },
  ], plugins: [{ id: 43, name: 'IdcsmartTicket', status: 1 }, { id: 44, name: 'OtherTicket', status: 0 }] })
  assert.equal((await f.api.search('有效工单'))[0].url, '/plugin/43/ticket.htm')
  assert.equal((await f.api.search('停用工单')).length, 0)
  assert.equal(f.fetches.length, 1)
  assert.deepEqual(f.requests.map(item => item.url), ['/theme/access', '/menu'])
})

test('website fallback can resolve plugin availability from projected links', async () => {
  const f = fixture({ menu: [{ name: '工单中心', url: 'plugin/81/ticket.htm' }], runtime: { links: { ticket: '/plugin/81/ticket.htm' } } })
  assert.equal((await f.api.search('工单'))[0].url, '/plugin/81/ticket.htm')
})

test('foreign links, sensitive URLs, placeholders and parameterless details stay out', async () => {
  const f = fixture({ snapshot: sidebar(...[
    'https://other.invalid/account.htm', 'account.htm?token=private', '#', '/',
    'productdetail.htm', 'orderDetail.htm', 'login.htm', 'oauth.htm',
  ].map(url => ({ name: '不可索引', url }))) })
  assert.equal((await f.api.search('不可索引')).length, 0)
})

test('category containers do not gain generic product pages, real leaf selection survives', async () => {
  const f = fixture({ snapshot: sidebar({ name: '产品管理', type: 'module', url: 'productList.htm', children: [{ id: 'server-class', name: '云服务器', url: 'productList.htm?m=mf_cloud' }] }) })
  const result = plain(await f.api.search('云服务器'))
  assert.equal(result[0].url, '/productList.htm?m=mf_cloud&cloud_menu=server-class')
  assert.equal((await f.api.search('产品管理')).filter(item => item.title === '产品管理').length, 0)
  assert.ok(result.every(item => item.url.includes('m=mf_cloud')))
})

test('logout clears cache, does not read again, and an account switch reloads its own directory', async () => {
  const f = fixture({ snapshot: sidebar({ name: '甲会员资料', url: 'account.htm' }) })
  assert.equal((await f.api.search('甲会员'))[0].title, '甲会员资料')
  f.storage.delete('jwt'); f.watchers.forEach(fn => fn())
  assert.equal((await f.api.search('甲会员')).length, 0)
  f.storage.set('jwt', 'member-b'); f.watchers.forEach(fn => fn())
  f.env.__CRA1_MEMBER_SNAPSHOT__ = sidebar({ name: '乙会员财务', url: 'finance.htm' })
  assert.equal((await f.api.search('甲会员')).length, 0)
  assert.equal((await f.api.search('乙会员'))[0].title, '乙会员财务')
  assert.equal(f.requests.filter(item => item.url === '/theme/access').length, 2)
})

test('a pending permission read cannot publish into a changed session', async () => {
  const auth = later()
  const f = fixture({ snapshot: sidebar({ name: '旧会员资料', url: 'account.htm' }), request: () => auth.promise })
  const search = f.api.search('旧会员')
  f.storage.set('jwt', 'member-b'); f.watchers.forEach(fn => fn())
  auth.resolve({ status: 200, data: { all: true } })
  assert.equal((await search).length, 0)
  assert.equal(f.fetches.length, 0)
})

test('cancellation suppresses a result and permission failures are not cached as access', async () => {
  const controller = new AbortController(), auth = later()
  const f = fixture({ snapshot: sidebar({ name: '账户资料', url: 'account.htm' }), request: () => auth.promise })
  const search = f.api.search('资料', { signal: controller.signal })
  controller.abort(); auth.resolve({ status: 200, data: { all: true } })
  assert.equal((await search).length, 0)
  const denied = fixture({ request: async () => { throw Error('登录已失效') } })
  await assert.rejects(denied.api.search('账户'), /登录已失效/)
  assert.equal(denied.fetches.length, 0)
  await assert.rejects(denied.api.search('账户'), /登录已失效/)
  assert.equal(denied.requests.length, 2)
})

test('localized labels and multiword matching use only the current menu language', async () => {
  const f = fixture({ snapshot: sidebar({ name: '账户信息', language: { 'en-us': 'Account profile' }, url: 'account.htm' }) })
  assert.equal((await f.api.search('Account profile', { language: 'en-us' }))[0].title, 'Account profile')
  assert.equal((await f.api.search('profile Account', { language: 'en-us' })).length, 4)
  assert.equal((await f.api.search('Account profile', { language: 'zh-cn' })).length, 0)
})

test('equivalent URLs are deduplicated while different product selections remain distinct', async () => {
  const f = fixture({ snapshot: sidebar(
    { name: '菜单一', url: 'account.htm?tab=security&section=operate_password' },
    { name: '菜单二', url: 'account.htm?section=operate_password&tab=security' },
    { id: 'one', name: '产品一', url: 'productList.htm' },
    { id: 'two', name: '产品二', url: 'productList.htm' },
  ) })
  assert.equal((await f.api.search('菜单')).length, 1)
  const products = plain(await f.api.search('产品'))
  assert.equal(new Set(products.map(item => new URL(item.url, 'https://fixture.invalid').searchParams.get('cloud_menu'))).size, 2)
})

test('indexed tab values are consumed by the actual member React pages', () => {
  const root = path.resolve(__dirname, '../source/member/src/pages')
  for (const [file, values] of Object.entries({
    account: ['profile', 'security', 'credit'], finance: ['orders', 'credit', 'freeze', 'transactions'],
    security: ['overview', 'api', 'ssh', 'log', 'group'], productList: ['using', 'expiring', 'overdue', 'deleted'],
  })) {
    const text = fs.readFileSync(path.join(root, file + '.jsx'), 'utf8')
    assert.match(text, /usePageTab/)
    for (const value of values) assert.ok(text.includes("'" + value + "'"), file + ':' + value)
  }
})

test('spacing, fullwidth and approved aliases find the real API and SSH tab labels', async () => {
  const f = fixture({ runtime: { features: { ssh: true } }, snapshot: { sidebar: [{ name: '安全中心', url: 'security.htm' }], features: { ssh: true } } })
  for (const query of ['SSH密钥', 'ＳＳＨ　密钥', 'SSH key', 'SSH keys', 'SSH公钥']) {
    const result = plain(await f.api.search(query))
    assert.ok(result.length, query)
    assert.equal(result[0].title, 'SSH 密钥', query)
    assert.equal(result[0].url, '/security.htm?tab=ssh', query)
  }
  for (const query of ['API密钥', 'ＡＰＩ　密钥', 'API key', 'API keys', 'apikey']) {
    const result = plain(await f.api.search(query))
    assert.equal(result[0].title, 'API 密钥', query)
    assert.equal(result[0].url, '/security.htm?tab=api', query)
  }
  for (const query of ['ssh miyao', 'ssh 公匙', 'aipkey']) assert.equal((await f.api.search(query)).length, 0, query)
})

test('aliases attach to the route, and actual title matches retain priority', async () => {
  const f = fixture({ runtime: { features: { ssh: true } }, snapshot: { sidebar: [
    { name: 'SSH keys', url: 'account.htm?tab=security' },
    { name: '主机访问', url: 'security.htm?tab=ssh' },
    { name: '接口凭据', url: 'security.htm?tab=api' },
    { name: 'SSH 密钥', url: 'finance.htm?tab=orders' },
  ], features: { ssh: true } } })
  const rows = plain(await f.api.search('SSH keys'))
  assert.deepEqual(rows.map(item => item.title), ['SSH keys', '主机访问'])
  assert.equal(rows[1].url, '/security.htm?tab=ssh')
  const apiRows = plain(await f.api.search('apikey'))
  assert.deepEqual(apiRows.map(item => item.title), ['接口凭据'])
  assert.equal(apiRows[0].url, '/security.htm?tab=api')
})

test('alias searches never restore denied permissions or disabled SSH features', async () => {
  const denied = fixture({
    runtime: { features: { ssh: true } },
    snapshot: { sidebar: [{ name: '安全中心', url: 'security.htm' }], features: { ssh: true } },
    access: { all: false, known: ['Api::list', 'SshKey::list'].map(rule), rules: [], pages: [
      { url: '/security.htm?tab=ssh', allowed: false }, { url: '/security.htm?tab=api', allowed: false },
    ] },
  })
  for (const query of ['SSH key', 'SSH keys', 'SSH公钥', 'API key', 'API keys', 'apikey']) assert.equal((await denied.api.search(query)).length, 0, query)
  const disabled = fixture({ snapshot: sidebar({ name: '安全中心', url: 'security.htm' }) })
  assert.equal((await disabled.api.search('SSH key')).length, 0)
  assert.equal((await disabled.api.search('apikey'))[0].title, 'API 密钥')
})
