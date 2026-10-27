import test from 'node:test'
import assert from 'node:assert/strict'
import { productListTree, homeArticleCatalog } from '../src/lib/member-content.js'

test('product copy keeps grouping parents, every depth, stable identities and menu order', () => {
  const nodes = [{ id: 'group', label: '产品管理', hidden: 1, children: [
    { id: 'cloud', label: '我的产品', url: 'productList.htm?nav=1', children: [{ id: 'using', label: '使用中', url: '/productList.htm?tab=using' }] },
    { id: 'dcim', label: '我的产品', url: 'productList.htm?nav=2' },
    { id: 'account', label: '账户', url: 'account.htm' },
  ] }, { id: 'cart', label: '订购', url: 'cart/goodsList.htm' }]
  const before = structuredClone(nodes), tree = productListTree(nodes)
  assert.equal(tree.length, 1)
  assert.equal(tree[0].product, false)
  assert.deepEqual(tree[0].children.map(row => row.id), ['cloud', 'dcim'])
  assert.equal(tree[0].children[0].product, true)
  assert.deepEqual(tree[0].children[0].children[0].path, ['产品管理', '我的产品', '使用中'])
  assert.equal(tree[0].children[0].children[0].hidden, true)
  assert.deepEqual(nodes, before)
})
test('similar external URLs and non-list pages cannot become product settings', () => {
  assert.deepEqual(productListTree(['productList.htm.bad', 'https://other.test/productList.htm', 'xproductList.htm'].map((url, id) => ({ id, url }))), [])
  assert.equal(productListTree([{ id: 'legacy', url: 'productList.htm#current' }])[0].id, 'legacy')
})
test('article catalogue reads its actual endpoint envelope and retains all sources', () => {
  const catalog = { news: { enabled: true, types: [{ id: 1, name: '新闻动态' }] }, help: { enabled: true, types: [{ id: 3, name: '入门指南' }] } }
  assert.deepEqual(homeArticleCatalog({ status: 200, data: { catalog } }), catalog)
  assert.throws(() => homeArticleCatalog({ status: 200, data: { catalog: { error: 'private diagnostic' } } }), /分类暂时无法读取/)
  assert.throws(() => homeArticleCatalog({ status: 500, msg: '读取失败' }), /读取失败/)
})
