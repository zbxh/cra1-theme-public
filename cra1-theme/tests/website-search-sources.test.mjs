import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const searchSource = fs.readFileSync(new URL('../../public/cra1-shared/src/header-search.js', import.meta.url), 'utf8');
const websiteSource = fs.readFileSync(new URL('../../public/cra1-shared/theme-sources/website/app.js', import.meta.url), 'utf8');

function fixture(runtime) {
  const events = {}, components = {}, stores = {}, calls = [], watches = {};
  let mounted, refreshes = 0, nativePluginReads = 0;
  const env = {
    document: {
      addEventListener: (name, callback) => { (events[name] ||= []).push(callback); },
      // The website has no native addons_js node and must use its projection.
      getElementById: () => { nativePluginReads++; return null; },
    },
    location: { pathname: '/' }, addEventListener() {},
    CRA1Shared: { Request: {
      getToken: () => stores.auth?.loggedIn ? 'fixture-session' : '',
      request: async (path, options) => { calls.push({ path, options }); return { data: { list: [], count: 0 } }; },
    } },
    Alpine: {
      data: (name, factory) => { components[name] = factory; },
      store: (name, value) => value === undefined ? stores[name] : (stores[name] = value),
    },
    __CRA1_RUNTIME__: runtime,
  };
  env.window = env;
  vm.runInNewContext(fs.readFileSync(new URL('../../public/cra1-shared/src/search-match.js', import.meta.url), 'utf8'), env);
  vm.runInNewContext(searchSource, env);
  env.CRA1Shared.HeaderSearch.mount = (element, options) => {
    mounted = options;
    return { refresh() { refreshes++; } };
  };
  vm.runInNewContext(websiteSource, env);
  events['alpine:init'].forEach(callback => callback());
  const page = components.searchBox();
  Object.assign(page, {
    $el: { dataset: {} }, $store: stores, $nextTick: callback => callback(),
    $watch: (expression, callback) => { watches[expression] = callback; }, $dispatch() {},
  });
  page.init();
  return {
    env, stores, calls, watches, options: () => mounted.getSearchOptions(), refreshes: () => refreshes,
    nativePluginReads: () => nativePluginReads,
    search: () => env.CRA1Shared.HeaderSearch.search({ ...mounted.getSearchOptions(), keywords: '云 & 主机' }),
  };
}

test('website search requests only projected available article providers', async () => {
  const providers = ['news', 'announcement', 'help'];
  for (let mask = 0; mask < 8; mask++) {
    const features = Object.fromEntries(providers.map((name, index) => [name, !!(mask & (1 << index))]));
    const f = fixture({ features });
    await f.search();
    assert.deepEqual(f.calls.map(call => call.path), ['/product', ...providers.filter(name => features[name]).map(name => '/' + name)]);
    assert.equal(f.options().context, 'website');
    assert.equal(f.nativePluginReads(), 0);
    assert.ok(f.calls.every(call => call.options.params.keywords === '云 & 主机'));
  }
});

test('missing runtime and unknown provider states do not enable optional article searches', async () => {
  for (const runtime of [undefined, {}, { features: {} }, { features: { news: null, announcement: 'unknown', help: false } }]) {
    const f = fixture(runtime);
    await f.search();
    assert.deepEqual(f.calls.map(call => call.path), ['/product']);
  }
});

test('website adds private product search only after confirmed login and refreshes when the login changes', async () => {
  const f = fixture({ features: { help: true } });
  assert.deepEqual(Array.from(f.options().sources, source => source.key), ['products', 'help']);
  f.stores.auth.loggedIn = true;
  f.watches['$store.auth.loggedIn']();
  await f.search();
  assert.equal(f.refreshes(), 1);
  assert.deepEqual(f.calls.map(call => call.path), ['/cra1-theme/member/search', '/product', '/help']);
  f.stores.auth.loggedIn = false;
  f.watches['$store.auth.loggedIn']();
  assert.deepEqual(Array.from(f.options().sources, source => source.key), ['products', 'help']);
  assert.equal(f.refreshes(), 2);
});

test('website reads the latest projected capability state instead of retaining a previous provider list', () => {
  const f = fixture({ features: { news: true, help: true } });
  assert.deepEqual(Array.from(f.options().sources, source => source.key), ['products', 'news', 'help']);
  f.env.__CRA1_RUNTIME__ = { features: { announcement: true } };
  assert.deepEqual(Array.from(f.options().sources, source => source.key), ['products', 'announcement']);
});
