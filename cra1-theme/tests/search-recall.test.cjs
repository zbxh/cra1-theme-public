const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const directory = path.resolve(__dirname, '../../public/cra1-shared/src')
const plain = value => JSON.parse(JSON.stringify(value))
function fixture(read, token = '') {
  const calls = [], environment = { setTimeout, clearTimeout, AbortController, document: { getElementById() {}, documentElement: { getAttribute() {} } }, CRA1Shared: { Request: {
    getToken: () => token,
    request: async (route, options) => { calls.push({ route, options }); return read(route, options, calls.length) },
  } } }
  environment.window = environment
  for (const file of ['search-match.js', 'header-search.js']) vm.runInNewContext(fs.readFileSync(path.join(directory, file), 'utf8'), environment)
  return { api: environment.CRA1Shared.HeaderSearch, calls }
}
const product = { key: 'products', path: 'product', label: '订购商品' }
const article = key => ({ key, path: key, label: key })

test('native and supplementary public reads are bounded, deduplicated and ranked by the real input', async () => {
  const partials = []
  const f = fixture((route, options) => {
    const keyword = options.params.keywords
    return { data: { count: 2, list: keyword.includes('%') ? [
      { id: 7, name: 'SSH 密钥', description: '' }, { id: 8, name: 'SSH 代理', description: '' },
    ] : [{ id: 9, name: '原生描述命中', description: 'Native-only extension result' }] } }
  })
  const result = await f.api.search({ keywords: 'ＳＳＨ　密钥', sources: [product], onUpdate: value => partials.push(plain(value)) })
  assert.equal(f.calls.length, 4)
  assert.ok(f.calls.every(call => call.options.params.limit === 18 && call.options.params.page === 1))
  assert.equal(f.calls[0].options.params.keywords, 'ＳＳＨ　密钥')
  assert.ok(f.calls.every(call => call.options.unauthorized === 'ignore'))
  assert.deepEqual(plain(result.groups[0].items).map(item => item.key), ['products:7', 'products:9'])
  assert.ok(partials.some(value => value.pending === 1 && value.groups.length > 0))
  assert.ok(result.groups[0].items.every(item => !item.url.includes('%')))
})

test('global public query concurrency never exceeds three across enabled providers', async () => {
  let active = 0, maximum = 0
  const f = fixture(async () => {
    active++; maximum = Math.max(active, maximum)
    await new Promise(resolve => setTimeout(resolve, 8)); active--
    return { data: { list: [] } }
  })
  await f.api.search({ keywords: 'ＳＳＨ　密钥', sources: [product, article('news'), article('announcement'), article('help')] })
  assert.equal(maximum, 3)
  for (const key of ['product', 'news', 'announcement']) assert.equal(f.calls.filter(call => call.route === '/' + key).length, 4)
  assert.equal(f.calls.filter(call => call.route === '/help').length, 1)
})

test('expanded article alternatives honor the native maximum without truncating the original', async () => {
  const keywords = '中a'.repeat(50)
  const f = fixture(() => ({ data: { list: [] } }))
  const result = await f.api.search({ keywords, sources: [article('news'), article('announcement')] })
  assert.equal(f.calls.length, 2)
  assert.ok(f.calls.every(call => call.options.params.keywords === keywords))
  assert.equal(result.errors.length, 0)
})

test('help matches every visible title once and retains low-priority native content matches', async () => {
  const f = fixture(() => ({ data: { list: [{ name: '账户', helps: [
    { id: 1, title: 'SSH 密钥' }, { id: 2, title: 'SSH密钥教程' }, { id: 3, title: '其他标题', search: true }, { id: 4, title: '完全无关' },
  ] }] } }))
  const result = await f.api.search({ keywords: 'SSH密钥', sources: [article('help')], context: 'website' })
  assert.equal(f.calls.length, 1)
  assert.deepEqual(plain(result.groups[0].items).map(item => item.key), ['help:1', 'help:2', 'help:3'])
})

test('supplementary failure preserves originals and distinguishes a confirmed empty read from total failure', async () => {
  for (const list of [[], [{ id: 1, name: 'SSH 密钥' }]]) {
    const f = fixture((route, options, count) => { if (count > 1) throw Error('private-diagnostics'); return { data: { list } } })
    const result = await f.api.search({ keywords: 'SSH密钥', sources: [product] })
    assert.equal(result.partialFailure, true)
    assert.deepEqual(plain(result.errors), ['订购商品'])
    assert.equal(result.groups.length, list.length ? 1 : 0)
    assert.equal(JSON.stringify(result).includes('private-diagnostics'), false)
  }
})

test('an original-source outage can recover through a valid normalized result without losing the warning', async () => {
  const f = fixture((route, options, count) => { if (count === 1) throw Error('private'); return { data: { list: [{ id: 1, title: 'SSH 密钥' }] } } })
  const result = await f.api.search({ keywords: 'SSH密钥', sources: [article('news')] })
  assert.equal(result.partialFailure, true)
  assert.equal(result.groups[0].items.length, 1)
})

test('cancelled queued work never becomes a new native request or a stale progressive update', async () => {
  const controller = new AbortController(), partials = []
  const f = fixture(async () => { controller.abort(); await new Promise(resolve => setTimeout(resolve, 1)); return { data: { list: [] } } })
  await f.api.search({ keywords: 'SSH密钥', sources: [product, article('news'), article('announcement'), article('help')], signal: controller.signal, onUpdate: value => partials.push(value) })
  assert.equal(f.calls.length, 1)
  assert.equal(partials.length, 0)
})

test('hosts keep their one exact request and guests never enter that source', async () => {
  const f = fixture(() => ({ data: { list: [], overview: {} } }), 'session')
  await f.api.search({ keywords: '2001:db8::8', sources: [{ key: 'hosts', label: '我的产品' }] })
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].options.params.keywords, '2001:db8::8')
  assert.equal(f.calls[0].options.params.limit, 6)
  const guest = fixture(() => { throw Error('private read') })
  assert.equal((await guest.api.search({ keywords: 'SSH密钥', sources: [{ key: 'hosts' }, { key: 'pages' }] })).groups.length, 0)
  assert.equal(guest.calls.length, 0)
})

test('search details use existing public list fields as bounded text without fetching detail bodies', async () => {
  const f = fixture((route) => ({ data: { list: [{
    id: 1, name: '云商品', title: '公开新闻', product_group_name_first: '云服务', product_group_name_second: '计算',
    description: '<p>2核 &amp; 4GB<br>高速云盘</p><script>private-script()</script>',
    excerpt: '<b>公开摘要</b> &lt;script&gt;文字&lt;/script&gt;', create_time: 1794430800,
    content: 'not-for-summary',
  }] } }))
  const result = await f.api.search({ keywords: '云', sources: [product, article('news')] })
  const byKey = Object.fromEntries(result.groups.map(group => [group.key, group.items[0]]))
  assert.equal(byKey.products.summary, '2核 & 4GB 高速云盘')
  assert.equal(byKey.products.description, '云服务 / 计算')
  assert.match(byKey.news.summary, /公开摘要 <script>文字<\/script>/)
  assert.match(byKey.news.description, /^news · \d{4}-\d{2}-\d{2}$/)
  assert.ok(!JSON.stringify(result).includes('private-script') && !JSON.stringify(result).includes('not-for-summary'))
  assert.deepEqual(f.calls.map(call => call.route).sort(), ['/news', '/product'])
})

test('missing public summaries remain optional and long summaries end without splitting unicode code points', async () => {
  const f = fixture(() => ({ data: { list: [
    { id: 1, title: '无摘要新闻', create_time: 'invalid', content: 'never-use-full-content' },
    { id: 2, title: '长商品', description: '云😀'.repeat(160) },
  ] } }))
  const result = await f.api.search({ keywords: '云', sources: [product, article('announcement')] })
  for (const group of result.groups) {
    const missing = group.items.find(item => item.key.endsWith(':1')), long = group.items.find(item => item.key.endsWith(':2'))
    assert.equal(missing.summary, undefined)
    assert.ok(!missing.description.includes('Invalid'))
    assert.equal(Array.from(long.summary).length, 241)
    assert.ok(long.summary.endsWith('😀…'))
    assert.ok(!long.summary.includes('\ufffd'))
  }
})
