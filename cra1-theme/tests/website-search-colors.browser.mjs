import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { chromium } = createRequire(new URL('../scripts/package.json', import.meta.url))('playwright');
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const tokens = read('../../public/cra1-shared/src/tokens.css');
const search = read('../../public/cra1-shared/src/header-search.css');
const cssInputs = [
  ['website source', read('../../public/web/cra1/src/app.css').replace(/^@import[^\n]+\n/gm, '').replace(/^@tailwind[^\n]+\n/gm, '')],
  ['website compatibility', read('../source/legacy-assets/website/20261014-theme-fixes-v1/app.css')],
];
const content = '<div class="cra1-header-search"><p class="cra1-header-search__status">找到 6 条</p><p class="cra1-header-search__group-title">帮助文档</p><p class="cra1-header-search__item-description">辅助说明</p><button class="cra1-header-search__close">Esc</button></div>';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let checks = 0;
try {
  const page = await browser.newPage();
  for (const [name, website] of cssInputs) {
    await page.setContent('<html data-cra1-theme="website" data-theme="cra1"><head><style>' + tokens + '</style><style>' + search + '</style><style>' + website + '</style></head><body>' + content + '<footer class="footer-night"><span id="footer-muted" style="color:var(--muted)">页脚说明</span></footer></body></html>');
    const colours = () => page.evaluate(() => ({
      search: [...document.querySelectorAll('.cra1-header-search__status,.cra1-header-search__group-title,.cra1-header-search__item-description,.cra1-header-search__close')].map(el => getComputedStyle(el).color),
      footer: getComputedStyle(document.querySelector('#footer-muted')).color,
    }));
    const actual = await colours();
    assert.deepEqual(actual.search, Array(4).fill('rgb(75, 88, 91)'), name); checks++;
    assert.equal(actual.footer, 'rgb(156, 168, 171)', name); checks++;
    await page.addStyleTag({ content: ':root{--muted:#384850}' });
    assert.deepEqual((await colours()).search, Array(4).fill('rgb(56, 72, 80)'), name + ' preserves merchant CSS'); checks++;
  }
  for (const theme of ['member', 'cart']) {
    await page.setContent('<html data-cra1-theme="' + theme + '"><head><style>' + tokens + '</style><style>' + search + '</style></head><body>' + content + '<div id="muted" style="background:var(--muted)">次级背景</div></body></html>');
    const actual = await page.evaluate(() => ({
      text: getComputedStyle(document.querySelector('.cra1-header-search__status')).color,
      surface: getComputedStyle(document.querySelector('#muted')).backgroundColor,
    }));
    assert.equal(actual.text, 'rgb(75, 88, 91)', theme); checks++;
    assert.equal(actual.surface, 'rgb(241, 243, 243)', theme + ' keeps the muted background semantic'); checks++;
  }
  console.log(JSON.stringify({ status: 'passed', checks, consumers: cssInputs.map(([name]) => name) }));
} finally {
  await browser.close();
}
