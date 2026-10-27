import test from 'node:test'
import assert from 'node:assert/strict'
import { supportToTree, supportFromTree, supportDropPositions } from '../src/lib/support-contacts.js'

const document = () => ({ schema: 1, enabled: true, groups: [
  { id: 'sales', title: '售前', enabled: true, items: [
    { id: 'phone', type: 'phone', value: '400-000-0000', text: '', icon: 'phone', showText: false, showIcon: true, enabled: false, url: '', newWindow: false },
    { id: 'mail', type: 'email', value: 'sales@example.test', text: '售前邮箱', icon: 'mail', showText: true, showIcon: false, enabled: true, url: '', newWindow: true },
  ] },
  { id: 'service', title: '', enabled: false, items: [] },
] })

test('tree editing round-trip preserves every contact option and empty group', () => {
  const doc = document()
  assert.deepEqual(supportFromTree(doc, supportToTree(doc)), doc)
})

test('moving a contact across groups preserves identities, other options and source document', () => {
  const doc = document(), original = structuredClone(doc), tree = supportToTree(doc)
  const moved = tree[0].children.pop()
  tree[1].children.push(moved)
  const next = supportFromTree(doc, [tree[1], tree[0]])
  assert.equal(next.groups[0].id, 'service')
  assert.deepEqual(next.groups[0].items[0], original.groups[0].items[1])
  assert.deepEqual(next.groups[1].items[0], original.groups[0].items[0])
  assert.equal(next.groups[0].enabled, false)
  assert.deepEqual(doc, original)
})

test('contact drop rules keep groups at root and contacts within groups', () => {
  const [a, b] = supportToTree(document()), item = a.children[0]
  assert.deepEqual(supportDropPositions(a, b), ['before', 'after'])
  assert.deepEqual(supportDropPositions(item, b), ['inside'])
  assert.deepEqual(supportDropPositions(item, a.children[1]), ['before', 'after'])
  assert.deepEqual(supportDropPositions(a, item), [])
})

test('invalid nesting and duplicate identities cannot be serialized into a save', () => {
  const doc = document(), tree = supportToTree(doc)
  assert.throws(() => supportFromTree(doc, [tree[0].children[0]]), /必须放在分组内/)
  assert.throws(() => supportFromTree(doc, [{ ...tree[0], children: [tree[1]] }]), /只支持分组和条目两级/)
  assert.throws(() => supportFromTree(doc, [tree[0], tree[0]]), /标识重复/)
})
