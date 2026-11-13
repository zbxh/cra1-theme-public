import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';

const website = fs.readFileSync(new URL('../../public/cra1-shared/theme-sources/website/app.js', import.meta.url), 'utf8');
const shared = fs.readFileSync(new URL('../../public/cra1-shared/src/header-search.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
function response(endpoint) {
  if (endpoint === '/help') return {list: [{id: 1, name: '使用帮助', helps: [{id: 17, title: '如何续费', search: true}]}]};
  if (/\/\d+$/.test(endpoint)) return {[endpoint.split('/')[1]]: {id: 9, title: '公开文章'}};
  return {list: [{id: 9, title: '公开文章'}], count: 1};
}
function fixture(features, get) {
  const events = {}, components = {}, calls = [];
  const env = {
    document: {addEventListener: (name, callback) => { (events[name] ||= []).push(callback); }, title: '文章详情'},
    addEventListener() {}, location: {pathname: '/news-details.html', search: '?id=9'}, URLSearchParams,
    API: {get: (endpoint, params) => {calls.push({endpoint, params}); return get ? get(endpoint, params) : Promise.resolve(response(endpoint));}},
    Alpine: {data: (name, factory) => {components[name] = factory;}, store() {}},
    __CRA1_RUNTIME__: features === undefined ? undefined : {features},
  };
  env.window = env;
  vm.runInNewContext(fs.readFileSync(new URL('../../public/cra1-shared/src/search-match.js', import.meta.url), 'utf8'), env);
  vm.runInNewContext(shared, env);
  vm.runInNewContext(website, env);
  events['alpine:init'].forEach(callback => callback());
  return {env, calls, instance(name) {return Object.assign(components[name](), {$nextTick: callback => callback(), $refs: {}});}};
}

test('closed article providers never query in list, detail, document center or home widgets', async () => {
  const f = fixture({news: false, announcement: false, help: false});
  for (const endpoint of ['/news', '/announcement']) {
    const page = f.instance('contentList'); page.items = [{id: 999}]; page.total = 1;
    page.initEndpoint(endpoint); assert.equal(page.items.length, 0); assert.equal(page.total, 0);
    assert.equal(page.loading, false); assert.equal(page.loadFailed, false);
  }
  for (const endpoint of ['/news', '/announcement', '/help']) {
    const page = f.instance('contentDetail'); page.item = {id: 999}; page.previous = {id: 998}; page.next = {id: 1000};
    page.initEndpoint(endpoint); assert.equal(page.item, null); assert.equal(page.previous, null); assert.equal(page.next, null);
    assert.equal(page.loading, false); assert.equal(page.notFound, true); assert.equal(page.loadFailed, false);
  }
  const help = f.instance('helpCenter'); help.groups = [{helps: [{id: 999}]}]; help.load();
  assert.equal(help.groups.length, 0); assert.equal(help.loading, false); assert.equal(help.loadFailed, false);
  const home = f.instance('home'); home.news = home.notices = [{id: 999}]; home.loadNews();
  assert.equal(home.news.length, 0); assert.equal(home.notices.length, 0); assert.equal(home.loadingNews, false); assert.equal(home.loadingNotices, false);
  await settle(); assert.equal(f.calls.length, 0);
});

test('missing or unread capability states stop queries and use the existing generic failure state', () => {
  for (const features of [undefined, {}, {news: null, announcement: null, help: null}, {news: 'unknown', announcement: '1', help: 'true'}]) {
    const f = fixture(features);
    const list = f.instance('contentList'); list.initEndpoint('/news'); assert.equal(list.loadFailed, true); assert.equal(list.loading, false);
    const detail = f.instance('contentDetail'); detail.initEndpoint('/announcement'); assert.equal(detail.loadFailed, true); assert.equal(detail.loading, false);
    const help = f.instance('helpCenter'); help.load(); assert.equal(help.loadFailed, true); assert.equal(help.loading, false);
    const home = f.instance('home'); home.loadNews(); assert.equal(home.newsFailed, true); assert.equal(home.noticesFailed, true);
    assert.equal(f.calls.length, 0);
  }
});

test('provider states are independent and confirmed enabled providers retain their native requests', async () => {
  const f = fixture({news: true, announcement: false, help: 1});
  const news = f.instance('contentList'); news.initEndpoint('/news', {addon_idcsmart_news_type_id: 3});
  const closed = f.instance('contentList'); closed.initEndpoint('/announcement');
  const detail = f.instance('contentDetail'); detail.initEndpoint('/news');
  const help = f.instance('helpCenter'); help.keyword = '续费'; help.load();
  const home = f.instance('home'); home.loadNews();
  await settle();
  assert.deepEqual(f.calls.map(call => call.endpoint), ['/news', '/news/9', '/help', '/news']);
  assert.equal(f.calls[0].params.addon_idcsmart_news_type_id, 3); assert.equal(f.calls[2].params.keywords, '续费');
  assert.equal(news.items[0].id, 9); assert.equal(detail.item.id, 9); assert.equal(help.resultCount(), 1); assert.equal(home.news.length, 1);
});

test('a result already in flight cannot restore content after its capability closes', async () => {
  for (const name of ['contentList', 'contentDetail', 'helpCenter', 'home']) {
    let finish;
    const f = fixture({news: true, help: true, announcement: false}, endpoint => new Promise(resolve => {finish = () => resolve(response(endpoint));}));
    const page = f.instance(name);
    const load = name === 'contentList' ? () => page.initEndpoint('/news') : name === 'contentDetail' ? () => page.initEndpoint('/news') : name === 'home' ? () => page.loadNews('news') : () => page.load();
    load(); f.env.__CRA1_RUNTIME__.features.news = false; f.env.__CRA1_RUNTIME__.features.help = false; load(); finish(); await settle();
    assert.equal(name === 'contentList' ? page.items.length : name === 'contentDetail' ? page.item : name === 'helpCenter' ? page.groups.length : page.news.length, name === 'contentDetail' ? null : 0, name);
    assert.equal(f.calls.length, 1, name);
  }
});

test('a later successful projection can retry a previously unread page without reinitializing it', async () => {
  const f = fixture(undefined), page = f.instance('contentDetail');
  page.initEndpoint('/news', '新闻详情'); assert.equal(page.loadFailed, true); assert.equal(f.calls.length, 0);
  f.env.__CRA1_RUNTIME__ = {features: {news: true}}; page.retry(); await settle();
  assert.equal(page.item.id, 9); assert.equal(page.loadFailed, false); assert.equal(page.loading, false);
});
