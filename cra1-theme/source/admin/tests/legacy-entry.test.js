import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const base = new URL('../../../../public/web/cra1/controller/template/admin/', import.meta.url)
const source = name => fs.readFileSync(new URL(name, base), 'utf8')

for (const adminRoot of ['/panel-original', '/renamed-admin', '/nested/admin']) {
  test(`legacy redirect and stylesheet preserve the admin path ${adminRoot}`, () => {
    let destination
    const location = {
      href: `https://fixture.invalid${adminRoot}/template/cra1/content.htm?theme=cloud`,
      replace: value => { destination = value },
    }
    const script = source('content.html').match(/<script>([\s\S]*?)<\/script>/)[1]
    vm.runInNewContext(script, { URL, location })
    assert.equal(destination, `https://fixture.invalid${adminRoot}/template/cra1/dashboard.htm?theme=cra1`)
    const css = source('dashboard.html').match(/href="([^"]+)"/)[1]
    assert.equal(new URL(css, destination).pathname, `${adminRoot}/template/default/css/template_controller.css`)
  })

  for (const page of ['content', 'dashboard']) {
    test(`legacy ${page} reads CRA1 at ${adminRoot} and keeps writes disabled`, async () => {
      let options
      const calls = [], warnings = [], errors = []
      const location = new URL(`https://fixture.invalid${adminRoot}/template/cra1/${page}.htm?theme=cloud`)
      const window = { location }
      const axios = {
        get: (path, config) => { calls.push({ path, config }); return Promise.resolve({ data: { status: 200, data: {} } }) },
        post: () => { throw new Error('Legacy editor must stay read-only') },
      }
      vm.runInNewContext(source(`${page}.js`), {
        URL, window, location, axios, comConfig: {},
        localStorage: { getItem: () => 'fixture-token' },
        document: { getElementById: () => ({}) },
        Vue: function (config) { options = config },
      })
      window.onload()
      const model = {
        ...options.data(), ...options.methods,
        $message: { error: value => errors.push(value), warning: value => warnings.push(value) },
      }
      model.load()
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(calls.length, 1)
      assert.equal(calls[0].path, `${adminRoot}/v1/template/cra1/content/get`)
      assert.equal(calls[0].config.headers.Authorization, 'Bearer fixture-token')
      assert.deepEqual(errors, [])
      assert.equal(model.loading, false)
      model.save()
      model.reset()
      assert.equal(warnings.length, 2)
      assert.equal(calls.length, 1)
      if (page === 'content') {
        assert.equal(model.theme, 'cra1')
        model.changeTab('template/cra1/dashboard.htm')
        assert.equal(location.href, `https://fixture.invalid${adminRoot}/template/cra1/dashboard.htm?theme=cra1`)
      }
    })
  }
}
