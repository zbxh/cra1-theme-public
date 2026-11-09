import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'

const source = name => fs.readFileSync(new URL('../../public/cra1-shared/src/' + name, import.meta.url), 'utf8')
function runtime(native) {
  class Storage {
    values = new Map()
    getItem(key) { return this.values.get(key) ?? null }
    setItem(key, value) { this.values.set(key, String(value)) }
  }
  const storage = new Storage()
  const original = Storage.prototype.setItem
  const common = { website_name: 'Native site', cart_change_product: 1, custom_fields: { before_settle: 1 }, third_party_module: { enabled: true } }
  storage.setItem('common_set_before', JSON.stringify(common))
  const window = {
    Storage, localStorage: storage, location: new URL('https://fixture.invalid/cart/goods.htm?id=501'),
    document: { documentElement: { hasAttribute: name => native && name === 'data-cra1-native-cart' }, addEventListener() {} },
    __CRA1_RUNTIME__: { common: { website_name: 'Projected site', disabled_private_setting: 'omit' }, features: {} },
    CRA1Shared: { Request: { getToken: () => '' } },
  }
  vm.runInNewContext(source('runtime.js'), { window, URL })
  return { window, storage, original, common }
}

test('native navigation leaves native /common, Storage and plugin fields intact', () => {
  const { window, storage, original, common } = runtime(true)
  assert.equal(window.Storage.prototype.setItem, original)
  assert.deepEqual(JSON.parse(storage.getItem('common_set_before')), common)
  const updated = { ...common, next_plugin_setting: [1, 2, 3] }
  storage.setItem('common_set_before', JSON.stringify(updated))
  assert.deepEqual(JSON.parse(storage.getItem('common_set_before')), updated)
  assert.equal(window.CRA1Shared.Runtime.common().website_name, 'Projected site')
  assert.equal(window.CRA1Shared.Runtime.common().disabled_private_setting, undefined)
  assert.ok(window.CRA1Shared.Access)
  assert.ok(window.CRA1Shared.Navigation.href('/cart/goods.htm?id=501'))
})

test('ordinary CRA1 pages retain filtered public caches', () => {
  const { window, storage, common } = runtime(false)
  assert.deepEqual(JSON.parse(storage.getItem('common_set_before')), { website_name: 'Projected site' })
  storage.setItem('common_set_before', JSON.stringify(common))
  assert.deepEqual(JSON.parse(storage.getItem('common_set_before')), { website_name: 'Native site', cart_change_product: 1 })
  assert.equal(window.Storage.prototype.__cra1Filtered, true)
})

test('shared header follows the installed goods cart-count prop, including zero', async () => {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync(new URL('../../public/clientarea/template/pc/cra1/components/topMenu/topMenu.js', import.meta.url), 'utf8') + '\nglobalThis.menu = topMenu', context)
  const menu = context.menu, state = { shoppingCarNum: 4 }
  assert.ok(menu.props.num)
  menu.watch.num.call(state, 7)
  assert.equal(state.shoppingCarNum, 7)
  menu.watch.num.call(state, 0)
  assert.equal(state.shoppingCarNum, 0)
  menu.watch.num.call(state, -1)
  assert.equal(state.shoppingCarNum, 0)
})
