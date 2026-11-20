// Render the real forms; every read and submission is isolated in the browser.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const member = fileURLToPath(new URL('../source/member/', import.meta.url))
const { build } = createRequire(path.join(member, 'package.json'))('esbuild')
const { chromium } = createRequire(new URL('../scripts/package.json', import.meta.url))('playwright')
const built = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import CredentialForm from './components/CredentialForm';import ProfileEditor from './pages/ProfileEditor';const root=createRoot(document.getElementById('app'));window.renderForm=kind=>root.render(kind==='profile'?<ProfileEditor account={window.fixtureAccount}/>:<CredentialForm kind="regist"/>);window.unmountForm=()=>root.unmount();`,
    resolveDir: path.join(member, 'src'), sourcefile: 'optional-fields-fixture.jsx', loader: 'jsx',
  },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, logLevel: 'silent',
})
const checks = [], check = (pass, label) => { assert.ok(pass, label); checks.push(label) }
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--no-proxy-server'] })
const unavailable = { status: 400, message: '功能未授权', code: 'API_ERROR' }
const networkError = { status: 0, message: 'private upstream failure /internal/path', code: 'NETWORK_ERROR' }
const fields = [{ id: 1, name: '使用用途', type: 'text', required: 1, value: '' }]

async function fixture(kind, replies, customFields = true) {
  const page = await browser.newPage()
  const errors = []; page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', route => route.request().isNavigationRequest()
    ? route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body><div id="app"></div></body></html>' })
    : route.abort())
  await page.goto('https://isolated.example/')
  await page.evaluate(({ replies, customFields }) => {
    window.calls = []; window.fieldReads = 0; window.saved = 0
    window.__CRA1_RUNTIME__ = {
      client_custom_fields: customFields,
      auth: { register: [{ type: 'email', code: false }], sales: { required: false, select: false } },
      common: { prohibit_user_information_changes: [9] },
    }
    window.fixtureAccount = { id: 1, username: '原始用户名', email: 'test@example.com', company: '原始公司', notice_open: 1, notice_method: 'all' }
    window.CRA1Shared = {
      UI: { toast() {} },
      Request: { async request(path, options = {}) {
        const { method = 'GET', body } = options
        window.calls.push({ path, method, body: body === undefined ? null : JSON.parse(JSON.stringify(body)) })
        if (path === '/register/custom_field' || path === '/client_custom_field_value') {
          const reply = replies[Math.min(window.fieldReads++, replies.length - 1)]
          if (reply.pending) await new Promise(resolve => { window.releaseFields = resolve })
          if (reply.message) throw Object.assign(new Error(reply.message), { status: reply.status, code: reply.code, data: { status: reply.status, msg: reply.message } })
          return { status: 200, data: Object.hasOwn(reply, 'data') ? reply.data : { list: reply.list || [] } }
        }
        if (path === '/country') return { status: 200, data: { list: [] } }
        if (path === '/register') throw new Error('隔离测试已接收注册提交')
        if (path === '/account' && method === 'PUT') { window.saved++; return { status: 200, data: {} } }
        throw new Error('Unexpected isolated request: ' + path)
      } },
    }
  }, { replies, customFields })
  await page.addScriptTag({ content: built.outputFiles[0].text })
  await page.evaluate(kind => window.renderForm(kind), kind)
  await page.locator(kind === 'profile' ? '#profile-name' : '#auth-account').waitFor()
  return { page, errors, submitted: () => page.evaluate(() => window.calls.filter(call => call.path === '/register' || call.path === '/account')) }
}

async function fillRegistration(page) {
  await page.locator('#auth-username').fill('已填写的昵称')
  await page.locator('#auth-account').fill('test@example.com')
  await page.locator('#auth-password').fill('Az!7mx2Q')
  await page.locator('#auth-confirm').fill('Az!7mx2Q')
  await page.locator('#register-sale').fill('sale-example')
  await page.locator('#auth-agreement').check()
}

try {
  for (const kind of ['regist', 'profile']) {
    const { page, errors, submitted } = await fixture(kind, [unavailable])
    const submit = page.getByRole('button', { name: kind === 'profile' ? '保存资料' : '注册', exact: true })
    await submit.waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled)
    check(await page.getByRole('alert').count() === 0, `${kind}: explicit optional-feature unavailability does not show a form failure`)
    check(await page.locator('[id^="custom-"]').count() === 0, `${kind}: unavailable extension fields are omitted`)
    if (kind === 'profile') await page.locator('#profile-name').fill('更新后的用户名')
    else await fillRegistration(page)
    await submit.click()
    await page.waitForFunction(kind => window.calls.some(call => call.path === (kind === 'profile' ? '/account' : '/register')), kind)
    const [call] = await submitted()
    check(!call.body.customfield?.addon_client_custom_field, `${kind}: unavailable extension never enters the submitted payload`)
    if (kind === 'profile') {
      check(call.body.username === '更新后的用户名' && call.body.company === '原始公司', `${kind}: basic profile can still be saved without losing existing fields`)
      await page.waitForFunction(() => window.saved === 1)
    } else {
      check(call.body.customfield.sale_number === 'sale-example' && call.body.username === '已填写的昵称', `${kind}: registration and sales payloads remain intact`)
    }
    check(errors.length === 0, `${kind}: unavailable-feature handling has no browser exception`)
    await page.close()
  }

  for (const kind of ['regist', 'profile']) {
    const list = kind === 'profile' ? [...fields, { id: 9, name: '受限字段', type: 'text', value: '既有内容' }] : fields
    const { page, errors, submitted } = await fixture(kind, [networkError, { list, pending: true }])
    const submit = page.getByRole('button', { name: kind === 'profile' ? '保存资料' : '注册', exact: true })
    await page.getByRole('alert').waitFor()
    check((await page.getByRole('alert').innerText()).includes('补充资料暂时无法读取'), `${kind}: transient read failure is visible beside its retry control`)
    check(!(await page.locator('body').innerText()).includes('/internal/path'), `${kind}: transient failure does not expose upstream details`)
    check(await submit.isDisabled(), `${kind}: unresolved extension read blocks submission`)
    if (kind === 'profile') await page.locator('#profile-name').fill('重试前保留的用户名')
    else await fillRegistration(page)
    await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    check((await submitted()).length === 0, `${kind}: forced form submit cannot bypass unread required fields`)
    await page.getByRole('button', { name: '重新加载补充资料', exact: true }).click()
    await page.waitForFunction(() => typeof window.releaseFields === 'function')
    await page.getByRole('status').waitFor()
    check(await submit.isDisabled() && await page.getByRole('status').count() > 0, `${kind}: local retry keeps the loading and submission gate active`)
    await page.evaluate(() => window.releaseFields())
    await page.locator('#custom-1').waitFor()
    check(await page.locator(kind === 'profile' ? '#profile-name' : '#auth-username').inputValue() === (kind === 'profile' ? '重试前保留的用户名' : '已填写的昵称'), `${kind}: retry preserves typed basic fields`)
    check(await page.evaluate(() => window.fieldReads) === 2, `${kind}: local retry makes exactly one additional extension read`)
    await submit.click()
    check((await submitted()).length === 0 && (await page.getByRole('alert').innerText()).includes('请填写使用用途'), `${kind}: recovered required fields still validate before submission`)
    await page.locator('#custom-1').fill('有效用途')
    if (kind === 'profile') check(await page.locator('#custom-9').isDisabled(), `${kind}: existing custom-field change restrictions remain in effect`)
    await submit.click()
    await page.waitForFunction(kind => window.calls.some(call => call.path === (kind === 'profile' ? '/account' : '/register')), kind)
    const [call] = await submitted()
    check(call.body.customfield.addon_client_custom_field[1] === '有效用途', `${kind}: recovered custom-field values use the native payload contract`)
    if (kind === 'profile') check(call.body.customfield.addon_client_custom_field[9] === '既有内容', `${kind}: existing restricted custom values are preserved`)
    else check(call.body.customfield.sale_number === 'sale-example', `${kind}: sales reference survives extension retry`)
    check(errors.length === 0, `${kind}: retry flow has no browser exception`)
    await page.close()
  }

  for (const kind of ['regist', 'profile']) {
    const { page } = await fixture(kind, [{ status: 403, message: '无权访问', code: 'API_ERROR' }])
    await page.getByRole('alert').waitFor()
    check(await page.getByRole('button', { name: kind === 'profile' ? '保存资料' : '注册', exact: true }).isDisabled(), `${kind}: account permission failure is never mistaken for an absent optional plugin`)
    await page.close()
  }

  for (const kind of ['regist', 'profile']) {
    for (const [label, data] of [['missing-list', {}], ['object-list', { list: { id: 1 } }], ['null-list', { list: null }]]) {
      const { page, errors, submitted } = await fixture(kind, [{ data }, { list: [] }])
      const submit = page.getByRole('button', { name: kind === 'profile' ? '保存资料' : '注册', exact: true })
      await page.getByRole('alert').waitFor()
      check(await submit.isDisabled(), `${kind}/${label}: a successful HTTP response with invalid extension structure cannot bypass required fields`)
      check((await page.getByRole('alert').innerText()).includes('补充资料暂时无法读取'), `${kind}/${label}: invalid extension structure shows the friendly retry state`)
      await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
      check((await submitted()).length === 0, `${kind}/${label}: malformed extension data cannot be submitted through the form`)
      await page.getByRole('button', { name: '重新加载补充资料', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled)
      check(await page.getByRole('alert').count() === 0 && await page.locator('[id^="custom-"]').count() === 0, `${kind}/${label}: a genuine empty list after retry is accepted`)
      check(errors.length === 0, `${kind}/${label}: malformed extension data does not crash rendering`)
      await page.close()
    }
  }

  for (const kind of ['regist', 'profile']) {
    const { page } = await fixture(kind, [], false)
    await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled)
    check(await page.evaluate(() => window.fieldReads) === 0, `${kind}: installations without the extension make no extension request`)
    await page.close()
  }
} finally { await browser.close() }

if (process.env.CRA1_OPTIONAL_FIELDS_REPORT) {
  fs.mkdirSync(path.dirname(process.env.CRA1_OPTIONAL_FIELDS_REPORT), { recursive: true })
  fs.writeFileSync(process.env.CRA1_OPTIONAL_FIELDS_REPORT, JSON.stringify({ checks }, null, 2) + '\n')
}
console.log(`Optional custom-field component checks passed: ${checks.length}`)
