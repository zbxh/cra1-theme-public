/** Real packaged admin sessions/storage and real built member home; disposable data only. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { randomBytes } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.CRA1_PLAYWRIGHT_MODULE || 'playwright')
const install = process.env.CRA1_INSTALL_PACKAGE, out = process.env.CRA1_BROWSER_OUT
const php = process.env.CRA1_PHP || '/www/server/php/74/bin/php'
if (!install || !out) throw new Error('Set CRA1_INSTALL_PACKAGE and CRA1_BROWSER_OUT outside the repository')
fs.mkdirSync(out, { recursive: true })
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cra1-admin-content-'))
execFileSync('python3', ['-c', 'import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', install, root])
fs.writeFileSync(path.join(root, 'config.php'), '<?php // Disposable fixture, no system database.\n')
// Diagnostic detail stays inside the disposable fixture and its private test log.
const adminEntry = path.join(root, 'public/cra1admin/index.php')
fs.writeFileSync(adminEntry, fs.readFileSync(adminEntry, 'utf8').replace(".' exception '.get_class($e)", ".' exception '.get_class($e).' '.$e->getMessage()"))
const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
const origin = `http://127.0.0.1:${port}`, base = origin + '/cra1admin/index.php', password = randomBytes(24).toString('hex')
execFileSync(php, ['-r', `require $argv[1].'/cra1-theme/backend/bootstrap.php';require CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php'; CRA1ThemeSecurity::install($argv[1],'fixture-admin',CRA1ThemeSecurity::password($argv[3]),['canonical_url'=>$argv[2],'http_test'=>true,'force_https'=>false]); $s=new CRA1ThemeSecurity($argv[1]);$s->db->exec('UPDATE accounts SET must_change=0');require $argv[1].'/public/cra1admin/member_store.php';$m=new MemberCenterStore($argv[1].'/runtime');$id=static fn($n)=>sprintf('00000000-0000-4000-8000-%012d',$n);$node=static fn($n,$label,$url,$children=[])=>['id'=>$id($n),'label'=>$label,'url'=>$url,'source_type'=>'custom','hidden'=>0,'children'=>$children];$nodes=[$node(1,'产品管理','',[$node(2,'云服务器','productList.htm?nav=1',[$node(3,'使用中','productList.htm?nav=1&tab=using')]),$node(4,'独立服务器','productList.htm?nav=2')])];$r=$m->save(['sidebar'=>['shape'=>3,'nodes'=>$nodes]],'fixture');if($r['status']!==200)throw new RuntimeException($r['msg']);`, root, origin, password], { encoding: 'utf8' })
execFileSync(php, ['-r', "require $argv[1].'/cra1-theme/backend/bootstrap.php';require CRA1_THEME_BACKEND.'/Support/cra1_theme_media.php';new CRA1ThemeMediaStore($argv[1],true);", root])
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'cra1-theme/release.json'))), release = manifest.release
const sharedBase = `/cra1-shared/releases/${release}`, memberBase = `/clientarea/template/pc/cra1/releases/${release}/assets`
fs.writeFileSync(path.join(root, 'public/article-test.html'), `<!doctype html><html data-cra1-theme="member"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${sharedBase}/cra1-shared.css"><link rel="stylesheet" href="${memberBase}/css/app.css"><style>body{margin:0;padding:24px;background:#f5f6f8}#root{max-width:1400px;margin:auto}</style><div id="root"></div><script src="${sharedBase}/cra1-shared.js"></script><script>window.__CRA1_FEAT__={ready:true};window.__CRA1_RUNTIME__={features:{news:true,announcement:true,help:true},links:{news:'/plugin/21/source.htm',announcement:'/plugin/22/source.htm',help:'/plugin/23/source.htm'}};window.__CRA1_MEMBER_SNAPSHOT__={content:{home_news:JSON.parse(new URLSearchParams(location.search).get('cfg'))},sidebar:[]};localStorage.setItem('jwt','isolated-fixture-only');</script><script type="module" src="${memberBase}/js/home.js"></script></html>`)
const log = fs.openSync(path.join(out, 'php-server.log'), 'w'), proc = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public')], { stdio: ['ignore', log, log] })
const checks = [], errors = [], browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const check = (value, label) => { assert.ok(value, label); checks.push(label) }
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }), page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + '?r=login'); const auth = await page.evaluate(() => window.__THEME_AUTH__)
  const login = await context.request.post(base + '?r=api.auth.login', { headers: { 'X-CSRF-Token': auth.csrf, Origin: origin }, data: { username: 'fixture-admin', password } })
  check((await login.json()).status === 200, 'packaged admin authenticates through its real security service')
  await page.goto(base + '?r=dashboard#/member/edit/home?module=news')
  await page.getByLabel('文章时间轴前台标题', { exact: true }).waitFor()
  const boot = await page.evaluate(() => window.__CRA1_ADMIN__)
  const original = await context.request.post(base + '?r=api.member.content.catalog', { headers: { 'X-CSRF-Token': boot.csrf, Origin: origin }, data: {} })
  check((await original.json()).status === 200, 'real content catalogue endpoint no longer calls a deleted method')
  check(!(await page.locator('body').innerText()).includes('服务端处理失败'), 'time-axis editor has no server error')
  const catalog = { news: { enabled: true, types: [{ id: 4, name: '新闻动态' }] }, announcement: { enabled: true, types: [{ id: 7, name: '维护公告' }] }, help: { enabled: true, types: [{ id: 2, name: '入门指南' }] }, error: '' }
  let catalogFail = false
  await context.route('**/index.php?r=api.member.content.catalog', route => route.fulfill({ json: catalogFail ? { status: 503, msg: '分类暂时无法读取，请重试' } : { status: 200, data: { catalog } } }))
  await page.reload(); await page.getByRole('option', { name: '新闻动态', exact: true }).waitFor({ state: 'attached' })
  await page.getByLabel('文章时间轴前台标题', { exact: true }).fill('帮助指南')
  await page.getByLabel('文章时间轴补充说明', { exact: true }).fill('服务器使用与入门帮助')
  await page.getByLabel('显示的分类', { exact: true }).selectOption('4')
  await page.getByLabel('文章时间轴内容来源', { exact: true }).selectOption('help')
  check(await page.getByLabel('显示的分类', { exact: true }).inputValue() === '0', 'changing source resets the category instead of reusing another plugin ID')
  await page.getByLabel('显示的分类', { exact: true }).selectOption('2')
  const [homeSave] = await Promise.all([page.waitForResponse(response => response.url().includes('r=api.workspace.editor.save')), page.locator('.workspace-savebar').getByRole('button', { name: /^保存首页/ }).click()])
  const homeResult = await homeSave.json(); check(homeResult.status === 200, 'actual home save succeeds: ' + (homeResult.msg || ''))
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'runtime/cra1_theme/member_center.json')))
  check(saved.content.home_news.title === '帮助指南' && saved.content.home_news.source === 'help' && saved.content.home_news.type_id === 2, 'title, source and category persist through the actual whole-page save')
  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: path.join(out, `timeline-admin-${width}.png`), fullPage: true })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'timeline admin fits viewport ' + width)
  }
  await page.goto(base + '?r=dashboard#/member/edit/products'); await page.locator('[data-product-row]').first().waitFor()
  check(await page.locator('[data-product-row]').count() === 4, 'group, product menus and nested status pages all have a location')
  const rootId = '00000000-0000-4000-8000-000000000001', cloudId = '00000000-0000-4000-8000-000000000002', childId = '00000000-0000-4000-8000-000000000003'
  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const boxes = await Promise.all([rootId, cloudId, childId].map(id => page.locator(`[data-product-row="${id}"]`).boundingBox()))
    check(boxes[0].x < boxes[1].x && boxes[1].x < boxes[2].x, 'every child is indented beneath its parent ' + width)
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'product hierarchy fits viewport ' + width)
    await page.screenshot({ path: path.join(out, `product-tree-${width}.png`), fullPage: true })
  }
  await page.getByRole('button', { name: '收起：云服务器', exact: true }).click(); check(await page.locator(`[data-product-row="${childId}"]`).count() === 0, 'menu group collapses')
  await page.getByRole('button', { name: '展开：云服务器', exact: true }).press('Enter'); check(await page.locator(`[data-product-row="${childId}"]`).isVisible(), 'menu group expands from the keyboard')
  await page.locator(`[data-product-row="${childId}"]`).getByRole('button', { name: '编辑：使用中', exact: true }).click()
  await page.getByRole('dialog').getByLabel('标题', { exact: true }).fill('正在使用的服务器')
  await page.getByRole('dialog').getByRole('switch', { name: '启用本配置', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '应用到草稿', exact: true }).click()
  const [productSave] = await Promise.all([page.waitForResponse(response => response.url().includes('r=api.workspace.editor.save')), page.locator('.workspace-savebar').getByRole('button', { name: /^保存产品列表/ }).click()])
  const productResult = await productSave.json(); check(productResult.status === 200, 'actual product copy save succeeds: ' + (productResult.msg || ''))
  const changed = JSON.parse(fs.readFileSync(path.join(root, 'runtime/cra1_theme/member_center.json')))
  check(changed.content.product_list.overrides[childId].title === '正在使用的服务器', 'nested entry saves its own stable identity')
  check(JSON.stringify(changed.sidebar) === JSON.stringify(saved.sidebar), 'editing product copy never changes the real menu tree')
  check(!changed.content.product_list.overrides[cloudId], 'editing the child does not alter its parent')
  await page.goto(base + '?r=dashboard#/notifications'); await page.getByRole('button', { name: '添加通知', exact: true }).click(); await page.getByLabel('分类文字', { exact: true }).waitFor()
  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await page.getByLabel('分类文字', { exact: true }).scrollIntoViewIfNeeded()
    const field = await page.getByLabel('分类文字', { exact: true }).boundingBox(), picker = await page.locator('[data-icon-picker="通知图标"] .ip-field-line').boundingBox()
    await page.screenshot({ path: path.join(out, `notification-fields-${width}.png`) })
    fs.writeFileSync(path.join(out, `icon-geometry-${width}.json`), JSON.stringify({field,picker},null,2))
    if (width >= 1440) check(Math.abs(field.y + field.height / 2 - picker.y - picker.height / 2) < 1, 'category and icon picker align on the same row ' + width)
    else check(picker.y >= field.y, 'category and icon fields stack in order on narrow screens ' + width)
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'notification fields fit viewport ' + width)
    await page.screenshot({ path: path.join(out, `notification-fields-${width}.png`) })
  }
  await page.getByRole('button', { name: '选择通知图标', exact: true }).click(); await page.getByLabel('搜索图标', { exact: true }).waitFor(); await page.keyboard.press('Escape')
  check(await page.locator('dialog.ip-dialog[open]').count() === 0, 'aligned icon picker still opens and cancels normally')
  await page.goto(base + '?r=dashboard#/member/edit/home?module=news'); await page.getByLabel('文章时间轴前台标题', { exact: true }).waitFor()
  catalogFail = true; await page.reload(); await page.getByText('页面错误，请刷新重试', { exact: true }).waitFor(); check(await page.getByRole('button', { name: '重试分类', exact: true }).count() === 0, 'catalogue failure has no retry button')
  check(await page.getByLabel('显示的分类', { exact: true }).isDisabled(), 'catalogue failure prevents accidental category changes')
  check(await page.getByLabel('文章时间轴前台标题', { exact: true }).inputValue() === '帮助指南', 'catalogue failure retains saved copy')
  catalogFail = false; await page.reload(); await page.getByRole('option', { name: '入门指南', exact: true }).waitFor({ state: 'attached' })
  await context.close()
  const front = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }), member = await front.newPage(), requests = []
  member.on('pageerror', error => errors.push(error.message))
  await front.route('**/cra1-shared/compat.php?target=**', route => route.fulfill({ json: { status: 200, data: { all: true, security: [] } } }))
  await front.route('**/cra1-shared/announcements.php', route => route.fulfill({ json: { status: 200, data: { items: [] } } }))
  await front.route('**/console/v1/**', async route => {
    const url = new URL(route.request().url()); requests.push(url.pathname + url.search)
    let data = { list: [], count: 0 }
    if (url.pathname.endsWith('/theme/access')) data = { all: true, security: [] }
    if (url.pathname.endsWith('/index')) data = { account: { id: 1 } }
    if (url.pathname.endsWith('/news')) data = { list: [{ id: 101, title: '新闻动态示例', create_time: 1792684800 }] }
    if (url.pathname.endsWith('/announcement')) data = { list: [{ id: 102, title: '维护安排示例', create_time: 1792684800 }] }
    if (url.pathname.endsWith('/help')) data = { list: [{ id: 1, helps: [{ id: 103, title: '其他分类内容' }] }, { id: 2, helps: [{ id: 104, title: '服务器入门指南' }] }] }
    await route.fulfill({ json: { status: 200, data } })
  })
  for (const [source, title, article, expected] of [['news', '新闻动态', '新闻动态示例', '/plugin/21/news_detail.htm?id=101'], ['announcement', '服务公告', '维护安排示例', '/plugin/22/news_detail.htm?id=102'], ['help', '帮助指南', '服务器入门指南', '/plugin/23/helpTotal.htm?id=104']]) {
    const cfg = { enabled: 1, source, title, description: '隔离示例资料', type_id: 2, limit: 6 }
    await member.goto(origin + '/article-test.html?cfg=' + encodeURIComponent(JSON.stringify(cfg)))
    try { await member.getByRole('link', { name: new RegExp(article) }).waitFor() }
    catch (error) { await member.screenshot({ path: path.join(out, `timeline-${source}-failure.png`), fullPage: true }); fs.writeFileSync(path.join(out, 'front-failure.json'), JSON.stringify({ requests, body: await member.locator('body').innerText() }, null, 2)); throw error }
    const list = member.getByRole('list', { name: title + '时间轴', exact: true }), card = list.locator('xpath=../..')
    check(await member.getByRole('link', { name: new RegExp(article) }).getAttribute('href') === expected, 'real home bundle uses the selected plugin detail link: ' + source)
    check(await member.getByText('其他分类内容', { exact: true }).count() === 0, 'unselected help category never appears: ' + source)
    for (const width of [1920, 1440, 768, 390]) { await member.setViewportSize({ width, height: 1000 }); await card.screenshot({ path: path.join(out, `timeline-${source}-${width}.png`) }); check(await member.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'member home fits viewport: ' + source + ' ' + width) }
  }
  check(requests.some(url => url.includes('/news?') && url.includes('addon_idcsmart_news_type_id=2')), 'real news request uses the configured category')
  check(requests.some(url => url.includes('/announcement?') && url.includes('addon_idcsmart_announcement_type_id=2')), 'real announcement request uses the configured category')
  await front.close(); check(errors.length === 0, 'no browser exceptions: ' + errors.join('; '))
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ status: 'passed', checks, screenshots: fs.readdirSync(out).filter(name => name.endsWith('.png')).length, productionWrites: 0 }, null, 2))
  console.log(JSON.stringify({ status: 'passed', checks: checks.length, output: out }))
} catch (error) { fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: error.stack, checks, errors }, null, 2)); throw error }
finally { await browser.close(); proc.kill(); fs.closeSync(log); fs.rmSync(root, { recursive: true, force: true }) }
