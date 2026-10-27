/** All announcement editor sections and popup states, using disposable PHP data. */
import path from 'node:path'
export async function reviewAnnouncementUI({ browser, origin, out, backend, check }) {
  const targets = Object.fromEntries(['website', 'member', 'cart'].map(key => [key, { all: true, pages: [] }]))
  const items = [
    { id: 'ui-notice-one', title: '云产品服务与日常维护通知', label: '服务通知', summary: '查看维护安排与服务说明', detail: '<p>这是隔离环境中的通知内容示例。</p><p>支持<strong>文字格式</strong>、列表和链接。</p>', targets, enabled: true, action: 'detail', action_label: '查看详情', dismissible: true },
    { id: 'ui-notice-two', title: '控制台功能更新说明', label: '更新', summary: '', detail: '<p>近期更新内容与使用说明，详情请阅读下方正文。</p>', targets, enabled: true, action: 'detail', action_label: '查看详情', dismissible: true },
  ]
  check(backend('seed', { enabled: true, interval: 6, items }).status === 200, 'seed editor visual fixture')
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(origin + '/admin.html#/announcements')
  await page.getByLabel('通知标题', { exact: true }).waitFor()
  async function center(locator) { await locator.evaluate(el => el.scrollIntoView({ block: 'center' })) }
  async function shot(name) { await page.screenshot({ animations: 'disabled', path: path.join(out, name + '.png') }) }
  async function choose(name, option) { const trigger = page.getByRole('combobox', { name, exact: true }); await center(trigger); await trigger.click(); await page.getByRole('option', { name: option, exact: true }).click() }
  async function menu(name, file) {
    const trigger = page.getByRole('combobox', { name, exact: true }); await center(trigger); await trigger.click()
    const popup = page.getByRole('listbox'); await popup.waitFor()
    check(await popup.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 }), 'dropdown stays within viewport: ' + file)
    await shot(file); await page.keyboard.press('Escape'); await popup.waitFor({ state: 'hidden' })
    await trigger.evaluate(el => new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)) }))
    check(await trigger.evaluate(el => el === document.activeElement), 'dropdown Escape restores trigger focus: ' + file)
  }
  const rich = page.getByRole('textbox', { name: '通知详情', exact: true })
  await rich.fill('选中这段文字进行格式验证')
  await rich.press('Control+a'); await page.getByRole('button', { name: '加粗', exact: true }).click()
  check(await rich.evaluate(el => /<(?:b|strong)>/.test(el.innerHTML)), 'rich editor formats the retained selection')
  await page.getByRole('button', { name: '添加链接', exact: true }).click(); await page.getByLabel('富文本链接地址').fill('javascript:alert(1)'); await page.getByRole('button', { name: '应用链接', exact: true }).click()
  await page.getByText('请填写有效的网址、站内路径、电话或邮箱链接', { exact: true }).waitFor(); check(!(await rich.innerHTML()).includes('javascript:'), 'rich editor rejects unsafe link without changing content')
  await page.getByLabel('富文本链接地址').fill('/document.html'); await page.getByRole('button', { name: '应用链接', exact: true }).click()
  check(await rich.locator('a[href="/document.html"]').count() === 1, 'rich editor applies a link to selected text')
  await rich.fill('通知正文第一段。第二段用于测试。')
  await page.locator('.rich-editor details summary').click(); await page.getByLabel('通知详情原始 HTML', { exact: true }).fill('<p>完整通知内容，供用户阅读。</p><ul><li>服务维护安排</li><li>控制台使用说明</li></ul>'); await page.locator('.rich-editor details summary').click()
  await page.getByRole('button', { name: '保存通知', exact: true }).click(); await page.getByText('通知已保存', { exact: true }).waitFor()
  check(backend('api.workspace.get').data.values.items[0].detail.includes('<li>服务维护安排</li>'), 'editor HTML persists through normal isolated save')
  for (const width of [1920, 1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ animations: 'disabled', path: path.join(out, `editor-full-${width}.png`), fullPage: true })
    await shot(`editor-settings-${width}`)
    await center(rich); await shot(`editor-content-${width}`)
    await page.getByRole('button', { name: '文字颜色', exact: true }).click(); await shot(`editor-colors-${width}`); await page.getByRole('button', { name: '文字颜色', exact: true }).click()
    await page.getByRole('button', { name: '添加链接', exact: true }).click(); await shot(`editor-link-${width}`); await page.getByRole('button', { name: '取消', exact: true }).click()
    await page.locator('.rich-editor details summary').click(); await center(page.getByLabel('通知详情原始 HTML', { exact: true })); await shot(`editor-html-${width}`); await page.locator('.rich-editor details summary').click()
    await menu('文字操作', `action-menu-${width}`)
    await choose('文字操作', '不显示文字操作'); check(await page.getByLabel('操作文字', { exact: true }).count() === 0, 'no action hides dependent settings ' + width)
    await choose('文字操作', '跳转链接'); await page.getByLabel('通知跳转链接', { exact: true }).fill('/document.html'); await page.getByRole('button', { name: '选择链接', exact: true }).click()
    await page.getByRole('button', { name: '商品', exact: true }).click(); await menu('商品分组', `product-group-menu-${width}`); await choose('商品分组', '云服务器')
    check(await page.getByRole('button').filter({ hasText: '示例域名' }).count() === 0, 'product group filters selectable products ' + width)
    await page.getByRole('button', { name: '联系方式', exact: true }).click(); await menu('联系方式类型', `contact-menu-${width}`)
    await page.getByRole('button', { name: '选择链接', exact: true }).click(); await choose('文字操作', '打开通知详情')
    await center(page.getByLabel('搜索显示页面', { exact: true })); await shot(`editor-targets-${width}`)
    await center(page.getByLabel('开始时间', { exact: true })); await shot(`editor-schedule-${width}`)
    await menu('关闭记忆', `dismiss-menu-${width}`)
    await page.getByRole('button', { name: '预览效果', exact: true }).click(); await page.frameLocator('iframe[title="通知草稿预览"]').locator('.cra1-notices__title').waitFor()
    await shot(`preview-${width}`); await menu('预览主题', `preview-theme-menu-${width}`)
    await choose('预览主题', '官网主题'); await menu('预览显示页面', `preview-page-menu-${width}`)
    await choose('预览显示页面', '文档中心'); await page.frameLocator('iframe').locator('.cra1-notices__title').waitFor()
    await page.getByRole('button', { name: '切换手机', exact: true }).click(); await shot(`preview-mobile-${width}`); await page.getByRole('button', { name: '切换桌面', exact: true }).click()
    await page.keyboard.press('Escape'); check(await page.getByRole('heading', { name: '通知效果预览', exact: true }).count() === 0, 'preview closes after nested menu cancellation ' + width)
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'editor has no overflow ' + width)
  }
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.getByRole('button', { name: '选择通知图标', exact: true }).click(); await page.getByLabel('搜索图标', { exact: true }).waitFor(); await page.locator('.ip-cell').first().waitFor()
  for (const width of [1440, 768, 390]) { await page.setViewportSize({ width, height: 1000 }); await shot(`icon-picker-${width}`); if (width === 390) { await menu('图标分类', 'icon-category-menu-390'); check(await page.locator('dialog.ip-dialog[open]').count() === 1, 'nested select Escape keeps icon picker open') } }
  await page.keyboard.press('Escape'); check(await page.locator('dialog.ip-dialog[open]').count() === 0, 'icon picker cancels without modifying the notice')
  await page.setViewportSize({ width: 390, height: 1000 }); await page.getByRole('button', { name: '删除通知', exact: true }).first().click(); await shot('delete-confirm-390'); await page.getByRole('button', { name: '取消', exact: true }).click()
  check(backend('api.workspace.get').data.values.items.length === 2, 'cancelled delete never changes saved document')
  check(errors.length === 0, 'announcement editor has no browser exceptions: ' + errors.join('; '))
  await context.close()
}
