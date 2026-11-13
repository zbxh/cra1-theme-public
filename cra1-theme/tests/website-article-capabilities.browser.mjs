import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {chromium} = createRequire(new URL('../scripts/package.json', import.meta.url))('playwright');
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const stage = process.env.CRA1_REVIEW_STAGE;
const manifest = stage ? JSON.parse(fs.readFileSync(path.join(stage, 'release.json'), 'utf8')) : null;
const source = stage ? fs.readFileSync(path.join(stage, 'public/web/cra1/releases', manifest.release, 'app.js'), 'utf8') : read('../../public/cra1-shared/theme-sources/website/app.js');
const search = stage ? fs.readFileSync(path.join(stage, 'public/cra1-shared/releases', manifest.release, 'cra1-shared.js'), 'utf8') : read('../../public/cra1-shared/src/search-match.js') + '\n' + read('../../public/cra1-shared/src/header-search.js');
const alpine = read('../../public/web/cra1/assets/js/alpine.min.js');
if (stage) assert.equal(source, fs.readFileSync(path.join(stage, 'public/web/cra1/releases', manifest.release, '20261017-compat-v3/app.js'), 'utf8'), 'website release and compatibility entry must use identical components');
const scenarios = [
  {component: 'contentList', init: "initEndpoint('/news')", paths: ['/news'], empty: 'items.length === 0', value: 'items[0]?.title'},
  {component: 'contentList', init: "initEndpoint('/announcement')", paths: ['/announcement'], empty: 'items.length === 0', value: 'items[0]?.title'},
  ...['news', 'announcement', 'help'].map(type => ({component: 'contentDetail', init: "initEndpoint('/" + type + "')", paths: ['/' + type + '/9'], empty: 'item === null', value: 'item?.title'})),
  {component: 'helpCenter', init: '', paths: ['/help'], empty: 'groups.length === 0', value: 'groups[0]?.helps[0]?.title'},
  {component: 'home', init: 'loadNews()', paths: ['/announcement', '/news'], empty: 'news.length === 0 && notices.length === 0', value: 'news[0]?.title'},
];
const browser = await chromium.launch({args: ['--no-sandbox']});
let checks = 0;
try {
  for (const state of ['enabled', 'closed', 'unknown']) {
    for (const scenario of scenarios) {
      const page = await browser.newPage();
      const errors = [], calls = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fixture.invalid/**', route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/console/v1/')) return route.fulfill({contentType: 'text/html', body: '<!doctype html><body x-data="' + scenario.component + '" x-init="' + scenario.init.replaceAll('"', '&quot;') + '"><p id="article" x-text="' + scenario.value + '"></p><p id="empty" x-show="' + scenario.empty + '">暂无可查看的内容</p><p id="failure" x-show="' + (scenario.component === 'home' ? 'newsFailed || noticesFailed' : 'loadFailed') + '">内容暂时不可用</p></body>'});
        const endpoint = url.pathname.replace('/console/v1', ''); calls.push(endpoint);
        const data = endpoint === '/help' ? {list: [{id: 1, name: '帮助', helps: [{id: 9, title: '已公开的文章', search: true}]}]} : /\/\d+$/.test(endpoint) ? {[endpoint.split('/')[1]]: {id: 9, title: '已公开的文章'}} : {list: [{id: 9, title: '已公开的文章'}], count: 1};
        return route.fulfill({contentType: 'application/json', body: JSON.stringify(data)});
      });
      await page.goto('https://fixture.invalid/?id=9');
      await page.evaluate(state => {
        const features = state === 'unknown' ? {} : {news: state === 'enabled', announcement: state === 'enabled', help: state === 'enabled'};
        window.__CRA1_RUNTIME__ = {features};
        window.CRA1Shared = {Request: {getToken: () => ''}};
        window.API = {get: (endpoint, params) => fetch('/console/v1' + endpoint + '?' + new URLSearchParams(params || {})).then(response => response.json())};
      }, state);
      // Use the actual shared ranking, website components and Alpine runtime.
      await page.addScriptTag({content: search}); await page.addScriptTag({content: source}); await page.addScriptTag({content: alpine});
      await page.waitForFunction(() => document.body._x_dataStack?.[0]?.loading === false || document.body._x_dataStack?.[0]?.loadingNews === false);
      await page.waitForTimeout(20);
      if (state === 'enabled') {
        assert.deepEqual(calls, scenario.paths, scenario.component); checks++;
        assert.equal(await page.locator('#article').textContent(), '已公开的文章'); checks++;
      } else {
        assert.equal(calls.length, 0, scenario.component + ' ' + state); checks++;
        assert.equal(await page.locator('#article').textContent(), ''); checks++;
        assert.equal(await page.locator('#empty').isVisible(), true); checks++;
      }
      assert.deepEqual(errors, [], scenario.component + ' ' + state); checks++;
      await page.close();
    }
  }
  // Exercise actual delayed fetches: a request begun while enabled must not
  // repopulate content or set a failure state after its provider is disabled.
  for (const outcome of ['success', 'failure']) {
    for (const scenario of scenarios) {
      const page = await browser.newPage(), calls = [], pending = [], errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fixture.invalid/**', async route => {
        const url = new URL(route.request().url());
        if (!url.pathname.startsWith('/console/v1/')) return route.fulfill({contentType: 'text/html', body: '<!doctype html><body x-data="' + scenario.component + '" x-init="' + scenario.init.replaceAll('"', '&quot;') + '"><p id="article" x-text="' + scenario.value + '"></p></body>'});
        const endpoint = url.pathname.replace('/console/v1', ''); calls.push(endpoint);
        await new Promise(resolve => pending.push(resolve));
        if (outcome === 'failure') return route.abort('failed');
        const data = endpoint === '/help' ? {list: [{id: 1, name: '帮助', helps: [{id: 9, title: '不应恢复的文章', search: true}]}]} : /\/\d+$/.test(endpoint) ? {[endpoint.split('/')[1]]: {id: 9, title: '不应恢复的文章'}} : {list: [{id: 9, title: '不应恢复的文章'}], count: 1};
        return route.fulfill({contentType: 'application/json', body: JSON.stringify(data)});
      });
      await page.goto('https://fixture.invalid/?id=9');
      await page.evaluate(() => {
        window.__CRA1_RUNTIME__ = {features: {news: true, announcement: true, help: true}};
        window.CRA1Shared = {Request: {getToken: () => ''}};
        window.API = {get: (endpoint, params) => fetch('/console/v1' + endpoint + '?' + new URLSearchParams(params || {})).then(response => response.json())};
      });
      await page.addScriptTag({content: search}); await page.addScriptTag({content: source}); await page.addScriptTag({content: alpine});
      await page.waitForFunction(() => document.body._x_dataStack?.[0]);
      const requestDeadline = Date.now() + 5000;
      while (pending.length < scenario.paths.length && Date.now() < requestDeadline) await page.waitForTimeout(10);
      assert.equal(pending.length, scenario.paths.length, 'all enabled requests enter the deferred fixture');
      await page.evaluate(scenario => {
        window.__CRA1_RUNTIME__.features = {news: false, announcement: false, help: false};
        const component = document.body._x_dataStack[0];
        if (scenario.component === 'contentList' || scenario.component === 'helpCenter') component.load();
        else if (scenario.component === 'contentDetail') component.retry();
        else component.loadNews();
      }, scenario);
      pending.forEach(resolve => resolve());
      await page.waitForTimeout(100);
      assert.deepEqual(calls, scenario.paths, 'disabled reload does not start another request'); checks++;
      assert.equal(await page.locator('#article').textContent(), '', 'late ' + outcome + ' stays suppressed in ' + scenario.component); checks++;
      assert.equal(await page.evaluate(name => {
        const component = document.body._x_dataStack[0];
        return name === 'home' ? component.newsFailed || component.noticesFailed || component.loadingNews || component.loadingNotices : component.loadFailed || component.loading;
      }, scenario.component), false, 'disabled state stays settled after late ' + outcome); checks++;
      assert.deepEqual(errors, [], scenario.component + ' deferred ' + outcome); checks++;
      await page.close();
    }
  }
  console.log(JSON.stringify({status: 'passed', release: manifest?.release || 'source', pageStates: scenarios.length * 5, checks}));
} finally {await browser.close();}
