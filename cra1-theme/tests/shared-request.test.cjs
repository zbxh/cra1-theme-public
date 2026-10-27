const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const shared = path.resolve(__dirname, '../../public/cra1-shared/src')
const source = fs.readFileSync(path.join(shared, 'request.js'), 'utf8')
const errorSource = fs.readFileSync(path.join(shared, 'errors.js'), 'utf8')
function fixture(fetch) {
  const storage = new Map([['jwt', 'test-token'], ['lang', 'zh-cn']])
  const events = []
  const location = { pathname: '/home.htm', search: '', href: '/home.htm' }
  const env = {
    fetch, setTimeout, clearTimeout, AbortController, CustomEvent, FormData, URLSearchParams,
    localStorage: { getItem: key => storage.get(key), removeItem: key => storage.delete(key) },
    sessionStorage: { setItem: (key, value) => storage.set(key, value) }, location,
    document: { dispatchEvent: event => events.push(event.type) },
  }
  env.window = env; env.self = env; env.top = env
  vm.runInNewContext(errorSource, env)
  vm.runInNewContext(source, env)
  return { api: env.CRA1Shared.Request, storage, events, location, env }
}
const response = (data, status = 200) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(data) })
test('query retains false and zero, encodes arrays and ignores missing values', () => {
  const { api } = fixture()
  assert.equal(api.query({ ids: [4, 5], enabled: false, page: 0, missing: null, empty: '' }), 'ids%5B%5D=4&ids%5B%5D=5&enabled=false&page=0')
  assert.equal(api.query({ 'status[]': [1, 3] }), 'status%5B%5D=1&status%5B%5D=3')
})
test('request reads the current JWT each time and keeps the response envelope', async () => {
  const calls = [], f = fixture(async (url, options) => { calls.push({ url, options }); return response({ status: 200, data: { id: 1 } }) })
  assert.equal((await f.api.request('/account', { params: { keywords: '云' } })).data.id, 1)
  f.storage.set('jwt', 'new-token'); await f.api.request('/account')
  assert.equal(calls[0].url, '/console/v1/account?keywords=%E4%BA%91')
  assert.equal(calls[1].options.headers.Authorization, 'Bearer new-token')
  assert.equal(calls[0].options.credentials, 'include')
})
test('iframe token is scoped to embedded cart configuration', () => {
  const f = fixture(); f.env.top = {}; f.location.pathname = '/cart/goods_iframe.htm'; f.location.search = '?iframe_token=frame-token'
  assert.equal(f.api.getToken(), 'frame-token')
  f.location.pathname = '/home.htm'; assert.equal(f.api.getToken(), 'test-token')
})
test('FormData leaves the boundary to the browser; false bodies are preserved', async () => {
  const calls = [], f = fixture(async (url, options) => { calls.push(options); return response({ status: 200 }) })
  const form = new FormData(); form.append('file', 'sample')
  await f.api.request('/upload', { method: 'POST', body: form })
  await f.api.request('/flag', { method: 'PUT', body: false })
  assert.equal(calls[0].body, form); assert.equal(calls[0].headers['Content-Type'], undefined)
  assert.equal(calls[1].body, 'false'); assert.equal(calls[1].headers['Content-Type'], 'application/json')
})
test('business errors keep Chinese message, status and envelope', async () => {
  const f = fixture(async () => response({ status: 409, msg: '配置冲突', data: { revision: 2 } }))
  await assert.rejects(f.api.request('/account'), error => error.message === '配置冲突' && error.msg === '配置冲突' && error.status === 409 && error.data.data.revision === 2)
})
test('HTTP failures and malformed bodies cannot appear as success', async () => {
  const f = fixture(async () => response({ status: 200, msg: '服务异常' }, 500))
  await assert.rejects(f.api.request('/account'), error => error.code === 'API_ERROR' && error.status === 500)
  f.env.fetch = async () => ({ status: 200, ok: true, text: async () => '<html>failed</html>' })
  await assert.rejects(f.api.request('/account'), error => error.code === 'BAD_RESPONSE')
})
test('search unauthorized policy leaves login and navigation unchanged', async () => {
  const f = fixture(async () => response({ status: 401 }, 401))
  await assert.rejects(f.api.request('/host', { unauthorized: 'ignore' }))
  assert.equal(f.storage.get('jwt'), 'test-token'); assert.equal(f.location.href, '/home.htm'); assert.deepEqual(f.events, [])
})
test('website notifies; member private pages redirect; public cart pages stay open', async () => {
  const f = fixture(async () => response({ status: 401 }, 401))
  await assert.rejects(f.api.request('/account', { unauthorized: 'notify' }))
  assert.equal(f.location.href, '/home.htm'); assert.deepEqual(f.events, ['api:unauthorized'])
  f.storage.set('jwt', 'test-token'); await assert.rejects(f.api.request('/account', { unauthorized: 'redirect' }))
  assert.equal(f.location.href, '/login.htm'); assert.equal(f.storage.get('redirectUrl'), '/home.htm')
  f.location.pathname = '/cart/goodsList.htm'; f.location.href = '/cart/goodsList.htm'
  await assert.rejects(f.api.request('/account', { unauthorized: 'redirect' })); assert.equal(f.location.href, '/cart/goodsList.htm')
})
test('a late unauthorized response does not clear a newer login', async () => {
  const f = fixture(async () => { f.storage.set('jwt', 'new-login'); return response({ status: 401 }) })
  await assert.rejects(f.api.request('/account', { unauthorized: 'redirect' }))
  assert.equal(f.storage.get('jwt'), 'new-login'); assert.equal(f.location.href, '/home.htm')
})
test('a protected request still redirects after a parallel notification cleared the expired JWT', async () => {
  const pending = [], f = fixture(() => new Promise(resolve => pending.push(resolve)))
  f.location.href = 'https://fixture.invalid/home.htm?from=bookmark#recent'
  const notice = assert.rejects(f.api.request('/account', { unauthorized: 'notify' }), { code: 'UNAUTHORIZED' })
  const protectedRead = assert.rejects(f.api.request('/theme/access', { unauthorized: 'redirect' }), { code: 'UNAUTHORIZED' })
  pending[0](response({ status: 401 })); await notice
  assert.equal(f.storage.get('jwt'), undefined); assert.equal(f.location.href, 'https://fixture.invalid/home.htm?from=bookmark#recent')
  pending[1](response({ status: 401 }, 401)); await protectedRead
  assert.equal(f.location.href, '/login.htm'); assert.equal(f.storage.get('redirectUrl'), 'https://fixture.invalid/home.htm?from=bookmark#recent')
})
test('a new login between concurrent unauthorized responses remains intact', async () => {
  const pending = [], f = fixture(() => new Promise(resolve => pending.push(resolve)))
  const notice = assert.rejects(f.api.request('/account', { unauthorized: 'notify' }))
  const protectedRead = assert.rejects(f.api.request('/theme/access', { unauthorized: 'redirect' }))
  pending[0](response({ status: 401 })); await notice
  f.storage.set('jwt', 'new-login'); pending[1](response({ status: 401 }, 401)); await protectedRead
  assert.equal(f.storage.get('jwt'), 'new-login'); assert.equal(f.location.href, '/home.htm'); assert.equal(f.storage.get('redirectUrl'), undefined)
})
test('anonymous private reads redirect even without a JWT; HTTP 401 does not require JSON', async () => {
  const f = fixture(async () => ({ status: 401, ok: false, text: async () => '<html>Unauthorized</html>' }))
  f.storage.delete('jwt'); await assert.rejects(f.api.request('/theme/access', { unauthorized: 'redirect' }), { code: 'UNAUTHORIZED', status: 401 })
  assert.equal(f.location.href, '/login.htm'); assert.equal(f.storage.get('redirectUrl'), '/home.htm')
})
test('auth, public catalog and embedded configuration pages never redirect on an optional login probe', async () => {
  for (const path of ['/login.htm', '/regist.htm', '/forget.htm', '/cart/goodsList.htm', '/cart/goods.htm', '/cart/goods_iframe.htm', '/cart/goods_embed.htm', '/cart/index_iframe.htm']) {
    const f = fixture(async () => response({ status: 401 }, 401)); f.location.pathname = path; f.location.href = path
    f.storage.set('redirectUrl', '/account.htm')
    await assert.rejects(f.api.request('/theme/access', { unauthorized: 'redirect' }), { code: 'UNAUTHORIZED' })
    assert.equal(f.location.href, path); assert.equal(f.storage.get('redirectUrl'), '/account.htm')
  }
})
test('permission denial, server failure and network failure do not log the user out', async () => {
  for (const status of [403, 500]) {
    const f = fixture(async () => response({ status, msg: '稍后重试' }, status))
    await assert.rejects(f.api.request('/theme/access', { unauthorized: 'redirect' }), { code: 'API_ERROR', status })
    assert.equal(f.storage.get('jwt'), 'test-token'); assert.equal(f.location.href, '/home.htm')
  }
  const f = fixture(async () => { throw new TypeError('network') })
  await assert.rejects(f.api.request('/theme/access', { unauthorized: 'redirect' }), { code: 'NETWORK' })
  assert.equal(f.storage.get('jwt'), 'test-token'); assert.equal(f.location.href, '/home.htm')
})
test('timeout covers response body streaming', async () => {
  const f = fixture(async (url, options) => ({ status: 200, ok: true, text: () => new Promise((resolve, reject) => { options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))) }) }))
  await assert.rejects(f.api.request('/account', { timeout: 15 }), error => error.code === 'TIMEOUT')
})
test('caller cancellation stays distinguishable from timeout and network failure', async () => {
  const f = fixture((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))
  const controller = new AbortController(), pending = f.api.request('/account', { signal: controller.signal, timeout: 500 })
  controller.abort(); await assert.rejects(pending, error => error.code === 'CANCELLED' && error.name === 'AbortError')
})
test('auth cannot be sent to an external URL', async () => {
  const f = fixture(() => { throw new Error('must not fetch') })
  for (const path of ['https://example.test/account', '//example.test/account', 'javascript:alert(1)']) await assert.rejects(f.api.request(path), error => error.code === 'INVALID_URL')
})
test('repeated loading keeps the same request instance', () => {
  const f = fixture(), instance = f.api
  vm.runInNewContext(source, f.env)
  assert.equal(f.env.CRA1Shared.Request, instance)
})

test('order creation marks lost responses as uncertain without retrying the request', async () => {
  for (const fetch of [async () => { throw new TypeError('network') },
    async () => response({ status: 500 }, 500),
    async () => ({ status: 200, ok: true, text: async () => '<html>proxy error</html>' })]) {
    let calls = 0
    const f = fixture((...args) => { calls++; return fetch(...args) })
    await assert.rejects(f.api.request('/mf_cloud/24/disk/order', { method: 'POST', body: {}, orderCreation: true }), error => error.uncertain === true && error.method === 'POST')
    assert.equal(calls, 1)
  }
  const f = fixture(async () => response({ status: 400, msg: '容量超出限制' }))
  await assert.rejects(f.api.request('/mf_cloud/24/disk/order', { method: 'POST', body: {}, orderCreation: true }), error => error.code === 'API_ERROR' && !error.uncertain)
})

test('security retries keep the order uncertainty flag after a lost verified submission', async () => {
  let calls = 0, uncertain = false
  const f = fixture(async () => {
    if (++calls === 1) return response({ status: 400, data: { operate_password: 1 } })
    throw new TypeError('response lost after verification')
  })
  f.env.CRA1Shared.Security = {
    setup: () => false, challenge: envelope => envelope.data?.operate_password === 1,
    perform: async (envelope, submit) => {
      try { return await submit({}) } catch (error) { uncertain = error.uncertain; throw error }
    },
  }
  await assert.rejects(f.api.request('/mf_cloud/24/disk/order', { method: 'POST', body: {}, orderCreation: true }), error => error.uncertain === true)
  assert.equal(uncertain, true); assert.equal(calls, 2)
})
