const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const source = fs.readFileSync(path.resolve(__dirname, '../../public/cra1-shared/src/search-match.js'), 'utf8')
function fixture(extra = {}) {
  const env = { ...extra }
  env.window = env
  vm.runInNewContext(source, env)
  return env.CRA1Shared.SearchMatch
}
const plain = value => JSON.parse(JSON.stringify(value))
const match = fixture()

test('normalization folds compatibility, case, invisible characters and whitespace', () => {
  assert.equal(match.normalize(' \tＡＰＩ\u200b\u200c\u200d\u2060\ufeff　密钥 \n '), 'api 密钥')
  assert.equal(match.normalize('ﬃ ＳＳＨ'), 'ffi ssh')
  assert.equal(match.normalize(null), '')
  assert.equal(match.normalize(0), '0')
  assert.deepEqual(plain(match.tokens(' ＳＳＨ密钥　API key ')), ['ssh', '密钥', 'api', 'key'])
})

test('tokenization preserves IP and host identifiers including their punctuation', () => {
  for (const query of ['192.0.2.15', '2001:db8::1', 'srv-01.example.net', 'host_name-01', 'host\\name', '#123']) {
    assert.deepEqual(plain(match.tokens(query)), [query.toLowerCase()], query)
  }
})

test('title tiers, aliases and descriptions retain the required relevance order', () => {
  for (const [title, query, expected, options] of [
    ['API 密钥', 'API 密钥', 1000],
    ['API 密钥', 'ａｐｉ　密钥', 980],
    ['API 密钥', 'api密钥', 960],
    ['API 密钥管理', 'api 密钥', 850],
    ['API 密钥管理', 'api密钥', 830],
    ['我的 API 密钥管理', 'api 密钥', 750],
    ['我的 API 密钥管理', 'api密钥', 730],
    ['密钥管理 API', 'api 密钥', 600],
    ['SSH 密钥', 'SSH keys', 450, { aliases: ['SSH key', 'SSH keys', 'SSH公钥'] }],
    ['基本资料', '个人账户', 300, { description: '会员页面 · 个人账户' }],
    ['个人资料', '资料 账户', 300, { description: '会员页面 · 账户中心' }],
    ['基本资料', '不存在', 0],
    ['', '', 0],
  ]) assert.equal(match.score(title, query, options), expected, title + ' / ' + query)
})

test('literal title results sort ahead of aliases and description matches', () => {
  const records = [
    { id: 'description', title: '账户安全', description: 'SSH keys' },
    { id: 'alias', title: 'SSH 密钥', aliases: ['SSH keys'] },
    { id: 'contains', title: '管理 SSH keys 项目' },
    { id: 'prefix', title: 'SSH keys 管理' },
    { id: 'exact', title: 'SSH keys' },
    { id: 'normalized', title: 'ＳＳＨ　ｋｅｙｓ' },
  ]
  records.sort((a, b) => match.score(b.title, 'SSH keys', b) - match.score(a.title, 'SSH keys', a))
  assert.deepEqual(records.map(item => item.id), ['exact', 'normalized', 'prefix', 'contains', 'alias', 'description'])
})

test('highlighting maps compact and normalized matches back to the unchanged title', () => {
  for (const [title, query, highlights] of [
    ['ＡＰＩ　密钥', 'api密钥', ['ＡＰＩ　密钥']],
    ['SSH\u200b 密钥', 'ssh密钥', ['SSH\u200b 密钥']],
    ['API 密钥 / API 密钥', 'api密钥', ['API 密钥', 'API 密钥']],
    ['密钥管理 API', 'api 密钥', ['密钥', 'API']],
    ['office ﬃ', 'ffi', ['ffi', 'ﬃ']],
    ['Café e\u0301', 'é', ['é', 'e\u0301']],
    ['İstanbul', 'i\u0307s', ['İs']],
    ['ΟΣ', 'ος', ['ΟΣ']],
  ]) {
    const parts = plain(match.parts(title, query))
    assert.equal(parts.map(part => part.text).join(''), title, query)
    assert.deepEqual(parts.filter(part => part.match).map(part => part.text), highlights, query)
  }
  assert.deepEqual(plain(match.parts('SSH 密钥', 'key')), [{ text: 'SSH 密钥', match: false }])
  assert.deepEqual(plain(match.parts('', 'key')), [{ text: '', match: false }])
})

test('emoji and combining sequences remain whole when highlighted', () => {
  for (const api of [match, fixture({ Intl: undefined })]) {
    for (const [title, query, expected] of [
      ['😀 API 密钥 🔑', 'api密钥', 'API 密钥'],
      ['家庭 👩‍👩‍👧‍👦 SSH', '👩', '👩‍👩‍👧‍👦'],
      ['主题 🇨🇳 😀', '🇨', '🇨🇳'],
      ['颜色 👍🏽 设置', '👍', '👍🏽'],
      ['字母 e\u0301', 'é', 'e\u0301'],
    ]) {
      const parts = plain(api.parts(title, query))
      assert.equal(parts.map(part => part.text).join(''), title)
      assert.equal(parts.filter(part => part.match).map(part => part.text).join(''), expected)
      assert.ok(parts.every(part => !/^[\udc00-\udfff]|[\ud800-\udbff]$/.test(part.text)))
    }
  }
})

test('remote variants are bounded, deduplicated and limited to useful normalization', () => {
  assert.deepEqual(plain(match.variants(' SSH 密钥 ')), ['SSH 密钥', 'ssh 密钥', 'ssh%密钥', '密钥%ssh'])
  assert.deepEqual(plain(match.variants('ssh密钥')), ['ssh密钥', 'ssh%密钥', '密钥%ssh'])
  assert.deepEqual(plain(match.variants('ＡＰＩ')), ['ＡＰＩ', 'api'])
  assert.deepEqual(plain(match.variants('账户 信息')), ['账户 信息', '账户%信息', '信息%账户'])
  assert.deepEqual(plain(match.variants('foo foo')), ['foo foo', 'foo%foo'])
  for (const query of ['', '   ', '0', '０', '\u200b', 0, null]) assert.deepEqual(plain(match.variants(query)), [])
  for (const query of ['SSH', '账户', '192.0.2.1', '2001:db8::1', 'srv-01.example', 'ＡＰＩ.example', 'SSH%密钥', 'SSH_密钥', 'SSH\\密钥', 'SSH％密钥', 'SSH＿密钥', 'A & B', 'API?key=1', 'A+B', '#SSH 密钥', 'A ＆ B', 'API / 密钥']) {
    assert.deepEqual(plain(match.variants(query)), [query], query)
  }
})
