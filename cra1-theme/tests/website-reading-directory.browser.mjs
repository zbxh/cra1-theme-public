import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const root = new URL('../../', import.meta.url);
const { chromium } = createRequire(new URL('../scripts/package.json', import.meta.url))('playwright');
const stage = process.env.CRA1_REVIEW_STAGE;
const output = process.env.CRA1_BROWSER_OUT;
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const readStage = file => fs.readFileSync(path.join(stage, file), 'utf8');
const release = stage && JSON.parse(readStage('release.json')).release;
const script = stage ? readStage('public/web/cra1/releases/' + release + '/20261017-compat-v3/app.js') : read('public/cra1-shared/theme-sources/website/app.js');
const style = stage ? readStage('public/web/cra1/releases/' + release + '/20261014-theme-fixes-v1/app.css') : read('public/web/cra1/src/page-refinements.css');
const tokens = stage ? readStage('public/cra1-shared/releases/' + release + '/cra1-shared.css') : read('public/cra1-shared/src/tokens.css');
const alpine = read('public/web/cra1/assets/js/alpine.min.js');
const footer = read('public/web/cra1/footer.html');
const tools = footer.slice(footer.indexOf('    <div class="reading-mobile-tools"'), footer.indexOf('<script src="/web/cra1/assets/js/api.js'));
const articleRoutes = new Map([
  ['document-details', 'help'], ['document-view', 'help'], ['news-details', 'news'], ['announce-details', 'announcement'],
]);
const paragraphs = '<p>' + '在控制台打开产品详情，核对监控指标及采样时间。'.repeat(24) + '</p>';
const longHeading = '记录结果并将高峰期的系统监控指标及原始采样数据保存到本地';
const articleBody = [
  '<h2 id="start">打开监控</h2>', '<h3>检查资源</h3>', '<h4>定位波动</h4>',
  '<h2>确认指标</h2>', '<h4>对应时间</h4>', '<h3>对应时间</h3>',
  '<h2 id="finish">' + longHeading + '</h2>', '<h2 hidden>内部标题</h2>',
  '<div style="display:none"><section><h2>隐藏容器内的标题</h2></section></div>',
  '<section aria-hidden="true"><h3>辅助技术不可见的标题</h3></section>',
  '<section style="visibility:hidden"><h2>隐藏可见性的标题</h2></section>',
].map(heading => heading + paragraphs).join('');

function template(route, side, extra) {
  const sidebar = '<aside class="reading-sidebar" data-reading-sidebar>' +
    (extra ? '<div class="reading-sidebar-extra"><h3>相关资源</h3><p><a href="/document.html">打开帮助文档</a></p></div>' : '') + '</aside>';
  return read('public/web/cra1/sections/' + route + '/core_article.html')
    .replace(/data-toc-side="[^"]*"/, 'data-toc-side="' + side + '"')
    .replace('{include file="../../public/reading-sidebar"}', sidebar)
    .replace(/\{(?:[:$]|if\b|else|\/if)[^}]*\}/g, '');
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const evidence = [];
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; }

try {
  for (const scenario of [
    { route: 'document-details', width: 1440, side: 'right', extra:true },
    { route: 'document-view', width: 768, side: 'left', hash: '#reading-section-0' },
    { route: 'news-details', width: 390, side: 'right', hash: '#start', extra:true },
    { route: 'announce-details', width: 320, side: 'left' },
    { route: 'news-details', width: 767, side: 'right' },
    { route: 'document-view', width: 390, side: 'right', body: '<h4>独立标题</h4>' + paragraphs },
    { route: 'document-details', width: 390, side: 'right', body: paragraphs },
    { route: 'announce-details', width: 390, side: 'right', notFound: true },
    { route: 'news-details', width: 390, side: 'right', failed: true },
    { route: 'home', width: 390, side: 'right' },
    { route: 'news-details', width: 1440, height:520, side: 'left', extra:true,
      long:true, body: Array.from({length:35}, (_, i) => '<h2>章节 '+(i+1)+'</h2>'+paragraphs).join('') },
    { route: 'document-details', width: 1440, side: 'right', body: paragraphs, extra:true },
  ]) {
    const { route, width, side, hash, notFound, failed } = scenario;
    const type = articleRoutes.get(route);
    const narrow = width < 768;
    const page = await browser.newPage({ viewport: {width, height: scenario.height || 850}, reducedMotion: 'reduce', hasTouch: narrow, isMobile: narrow });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fixture.invalid/**', request => request.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="zh-CN" data-cra1-theme="website" data-theme="cra1"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body ' +
        (type ? 'x-data="contentDetail" x-init="initEndpoint(&apos;/' + type + '&apos;, &apos;文章详情&apos;)"' : '') +
        '><header class="cra1-site-header" style="position:sticky;top:0;z-index:41;background:white;height:64px;padding:14px 24px">酷锐A1</header>' +
        '<main style="max-width:1280px;margin-inline:auto;padding:12px">' + (type ? template(route, side, scenario.extra) : '<h1>官网首页</h1><div style="height:1600px"></div><div class="mobile-action-bar" style="height:68px">底部操作</div>') + '</main>' +
        '<footer style="min-height:600px"></footer>' + tools + '</body></html>',
    }));
    await page.goto('https://fixture.invalid/' + route + '.html?id=9' + (hash || ''));
    await page.evaluate(({ type, content, notFound, failed }) => {
      window.__CRA1_RUNTIME__ = { features: {help:true, news:true, announcement:true} };
      window.CRA1Shared = { Request: {getToken: () => ''} };
      window.API = { get: () => failed ? Promise.reject({status:500}) : Promise.resolve(notFound ? {} : {[type]: {id:9, title:'服务器监控使用说明', content}}) };
    }, { type, content: scenario.body ?? articleBody, notFound, failed });
    await page.addStyleTag({content: tokens + '\n' + style + '\n[x-cloak]{display:none!important}'});
    await page.addScriptTag({content: script});
    await page.addScriptTag({content: alpine});
    if (type) await page.waitForFunction(() => document.body._x_dataStack?.[0]?.loading === false);
    const trigger = page.getByRole('button', {name:'文章目录', exact:true});
    const panel = page.locator('.reading-toc-side');
    const nav = page.locator('#cra1-reading-toc');
    const active = nav.locator('[aria-current="location"]');
    const top = page.locator('[data-reading-top]');
    const hasToc = type && !notFound && !failed && scenario.body !== paragraphs;
    const extra = page.locator('.reading-sidebar-extra');
    const showExtra = Boolean(scenario.extra && !narrow && !notFound && !failed);
    if (showExtra) await extra.waitFor();
    check(await extra.isVisible() === showExtra, 'custom module visibility follows the article and desktop breakpoint');
    if (!hasToc) {
      check(await nav.count() === 0, route + ': no empty directory');
      check(!await trigger.isVisible(), route + ': no directory button');
      if (!type) {
        await page.evaluate(() => window.scrollTo(0, 520));
        await top.waitFor({ state:'visible' });
        check((await top.boundingBox()).y + 44 < (await page.locator('.mobile-action-bar').boundingBox()).y, 'back to top clears sticky buy bar');
        await top.click();
        await page.waitForFunction(() => window.scrollY === 0);
      }
    } else {
      await nav.waitFor({state:'attached'});
      check(await page.locator('article .reading-toc-nav').count() === 0, 'directory sits outside article');
      check(await nav.locator('a').count() === (scenario.long ? 35 : scenario.body ? 1 : 7), 'directory includes valid headings only');
      check(await trigger.isVisible() === narrow, 'mobile trigger honors breakpoint ' + width);
      check(await panel.isVisible() === !narrow, 'desktop rail honors breakpoint ' + width);
      if (!narrow) {
        const paperBox = await page.locator('[data-reading-article]').boundingBox();
        const panelBox = await panel.boundingBox();
        check(side === 'left' ? panelBox.x + panelBox.width < paperBox.x : panelBox.x > paperBox.x + paperBox.width, 'side setting positions directory outside article');
        check(await panel.evaluate(node => getComputedStyle(node).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'desktop directory has a background');
        if (scenario.extra) {
          const extraBox = await extra.boundingBox();
          check(extraBox.y > panelBox.y + panelBox.height, 'custom module is below the desktop directory');
          check(await extra.getByRole('link',{name:'打开帮助文档'}).getAttribute('href') === '/document.html', 'module HTML keeps the actual link');
        }
        if (scenario.long) {
          check(panelBox.height <= Math.min(360, scenario.height * .45) + 1, 'long directory has a viewport-aware maximum height');
          check(await nav.evaluate(node => node.scrollHeight > node.clientHeight), 'long directory scrolls internally');
          await nav.getByRole('link',{name:'章节 35'}).click();
          check(await nav.evaluate(node => node.scrollTop > 0), 'last heading is reachable inside the capped directory');
          const sidebar = await page.locator('.reading-sidebar').boundingBox();
          check(sidebar.y >= 63 && sidebar.y + sidebar.height <= scenario.height, 'directory and module fit in the short viewport');
          if (output) {
            const file = path.join(output, 'article-sidebar-long.png');
            await page.screenshot({path:file});
            evidence.push(file);
          }
        }
      }
      if (hash) {
        await active.waitFor({state:'attached'});
        check(await active.textContent() === '打开监控', 'initial and legacy links resolve to author ID');
      }
      if (!scenario.body) {
        await page.locator('h4', {hasText:'定位波动'}).evaluate(node => node.scrollIntoView());
        await active.filter({hasText:'定位波动'}).waitFor({state:'attached'});
        if (narrow) {
          await top.waitFor({state:'visible'});
          check((await trigger.boundingBox()).y < (await top.boundingBox()).y, 'directory sits above back to top');
          await trigger.click();
          await page.getByRole('dialog', {name:'本文目录'}).waitFor();
        } else {
          const sticky = await panel.boundingBox();
          const header = await page.locator('.cra1-site-header').boundingBox();
          check(sticky.y >= header.y + header.height - 1 && sticky.y < header.y + header.height + 40, 'directory follows header while reading');
          const depth = await nav.locator('a').evaluateAll(links => links.slice(0, 3).map(link => parseFloat(getComputedStyle(link).paddingInlineStart)));
          check(depth[0] < depth[1] && depth[1] < depth[2], 'desktop title padding increases with each directory level');
          const mark = await active.evaluate(link => getComputedStyle(link.parentElement, '::before').content);
          check(mark === '""', 'desktop current chapter has a shared edge marker at every level');
          const longLink = nav.getByRole('link', {name:longHeading});
          check(await longLink.evaluate(link => link.scrollWidth <= link.clientWidth && link.scrollHeight <= link.clientHeight), 'long desktop title wraps without clipping');
          const toggle = panel.getByRole('button', {name:'本文目录'});
          await toggle.click();
          check(await toggle.getAttribute('aria-expanded') === 'false', 'desktop directory collapses');
          await page.evaluate(() => window.scrollBy(0, 20));
          check(await toggle.getAttribute('aria-expanded') === 'false', 'reading does not reopen the whole directory');
          await toggle.click();
        }
        check(await nav.locator('ul ul ul a').filter({hasText:'定位波动'}).isVisible(), 'active third-level branch opens');
        const other = nav.getByRole('button', {name:'确认指标的子目录'});
        await other.click();
        check(!await nav.getByRole('link', {name:'定位波动'}).isVisible(), 'manually opening a branch closes its neighbor');
        if (output && [1440, 390, 320].includes(width)) {
          await nav.getByRole('button', {name:'打开监控的子目录'}).click();
          await nav.getByRole('button', {name:'检查资源的子目录'}).click();
          const file = path.join(output, 'article-directory-' + width + '.png');
          await page.screenshot({path:file});
          evidence.push(file);
        }
        await nav.getByRole('link', {name:'记录结果'}).click();
        await active.filter({hasText:'记录结果'}).waitFor({state:narrow ? 'attached' : 'visible'});
        check(await page.evaluate(() => location.hash === '#finish' && document.activeElement.id === 'finish'), 'click updates hash and focuses article heading');
        if (narrow) {
          check(!await page.getByRole('dialog').isVisible(), 'choosing heading closes the sheet');
          await trigger.click();
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => document.activeElement.matches('[data-reading-open]'));
          await top.click();
          await page.waitForFunction(() => window.scrollY === 0);
        }
        await page.locator('h4', {hasText:'对应时间'}).evaluate(node => node.scrollIntoView());
        await active.filter({hasText:'对应时间'}).waitFor({state:'attached'});
        check(await nav.getByRole('button', {name:'确认指标的子目录', includeHidden:true}).getAttribute('aria-expanded') === 'true', 'scrolling into another chapter opens its branch');
        check(await nav.getByRole('button', {name:'打开监控的子目录', includeHidden:true}).getAttribute('aria-expanded') === 'false', 'last branch is closed');
      }
    }
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at ' + width);
    assert.deepEqual(errors, [], route);
    await page.close();
  }
  console.log(JSON.stringify({status:'passed', release:release || 'source', assertions, evidence}));
} finally {
  await browser.close();
}
