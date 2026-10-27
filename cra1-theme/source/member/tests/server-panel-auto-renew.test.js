import test from 'node:test'
import assert from 'node:assert/strict'
import { createAutoRenewController, parseAutoRenewStatus } from '../src/pages/serverPanel/auto-renew-state.js'

const reply = (status) => ({ status: 200, data: { status } })
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function fixture(api) {
  const history = []
  const control = createAutoRenewController(api, state => history.push(state))
  return { control, history, get state() { return history.at(-1) } }
}

test('自动续费识别数值、字符串和布尔状态，主字段优先', () => {
  for (const value of [0, '0', false]) assert.equal(parseAutoRenewStatus(reply(value)), false)
  for (const value of [1, '1', true]) assert.equal(parseAutoRenewStatus(reply(value)), true)
  assert.equal(parseAutoRenewStatus({ status: 200, data: { is_open: '0' } }), false)
  assert.equal(parseAutoRenewStatus({ status: 200, data: { status: '0', is_open: 1 } }), false)
  for (const value of ['', null, undefined, 2, 'false', {}, []]) {
    assert.throws(() => parseAutoRenewStatus(reply(value)), /无法识别/)
  }
  assert.throws(() => parseAutoRenewStatus({ status: 400, msg: '没有权限', data: { status: 1 } }), /没有权限/)
  assert.throws(() => parseAutoRenewStatus({ status: 200, data: { status: null, is_open: 1 } }), /无法识别/)
})

test('开启发 1、关闭发 0，每次保存后重新确认实际状态', async () => {
  let current = '0', reads = 0
  const writes = []
  const f = fixture({
    renewAutoStatus: async () => { reads++; return reply(current) },
    renewAutoSet: async body => { writes.push(body); current = String(body.status); return { status: 200 } },
  })
  await f.control.read()
  assert.equal(f.state.enabled, false)
  await f.control.toggle()
  assert.equal(f.state.enabled, true)
  await f.control.toggle()
  assert.equal(f.state.enabled, false)
  assert.deepEqual(writes, [{ status: 1 }, { status: 0 }])
  assert.equal(reads, 3)
  assert.equal(f.state.error, '')
})

test('保存及确认期间阻止重复提交，不提前改变已确认状态', async () => {
  const write = deferred(), confirmation = deferred()
  let reads = 0, writes = 0
  const f = fixture({
    renewAutoStatus: () => ++reads === 1 ? Promise.resolve(reply(0)) : confirmation.promise,
    renewAutoSet: () => { writes++; return write.promise },
  })
  await f.control.read()
  const pending = f.control.toggle()
  await f.control.toggle(); await f.control.read()
  assert.equal(writes, 1)
  assert.equal(reads, 1)
  assert.equal(f.state.phase, 'saving')
  assert.equal(f.state.enabled, false)
  write.resolve({ status: 200 })
  await Promise.resolve(); await Promise.resolve()
  assert.equal(f.state.phase, 'confirming')
  assert.equal(f.state.enabled, false)
  await f.control.toggle()
  confirmation.resolve(reply('1'))
  await pending
  assert.equal(f.state.phase, 'ready')
  assert.equal(f.state.enabled, true)
  assert.equal(writes, 1)
})

test('读取失败时不推断关闭，不允许写入，读取重试可恢复', async () => {
  let failed = true, writes = 0
  const f = fixture({
    renewAutoStatus: async () => failed ? { status: 400, msg: '读取失败' } : reply('1'),
    renewAutoSet: async () => { writes++; return { status: 200 } },
  })
  await f.control.read(); await f.control.toggle()
  assert.equal(f.state.phase, 'error')
  assert.equal(f.state.enabled, null)
  assert.match(f.state.error, /读取失败/)
  assert.equal(writes, 0)
  failed = false
  await f.control.read()
  assert.equal(f.state.enabled, true)
  assert.equal(f.state.error, '')
})

test('写请求失败后只重新读取，明确显示未生效并允许重新操作', async () => {
  let current = 0, fail = true
  const writes = []
  const f = fixture({
    renewAutoStatus: async () => reply(current),
    renewAutoSet: async body => {
      writes.push(body)
      if (fail) return { status: 400, msg: '不能修改' }
      current = body.status; return { status: 200 }
    },
  })
  await f.control.read(); await f.control.toggle()
  assert.equal(f.state.phase, 'error')
  assert.match(f.state.error, /设置未完成.*不能修改/)
  await f.control.toggle()
  assert.equal(writes.length, 1)
  await f.control.read()
  assert.equal(writes.length, 1)
  assert.equal(f.state.enabled, false)
  assert.match(f.state.error, /未生效/)
  fail = false
  await f.control.toggle()
  assert.equal(f.state.enabled, true)
  assert.equal(f.state.error, '')
})

test('写入成功但确认失败，重试不重复写入且能确认最终状态', async () => {
  let reads = 0, writes = 0
  const f = fixture({
    renewAutoStatus: async () => {
      reads++
      if (reads === 2) throw new Error('连接超时')
      return reply(reads === 1 ? 0 : '1')
    },
    renewAutoSet: async () => { writes++; return { status: 200 } },
  })
  await f.control.read(); await f.control.toggle()
  assert.equal(f.state.phase, 'error')
  assert.match(f.state.error, /已提交.*确认失败/)
  await f.control.read()
  assert.equal(f.state.enabled, true)
  assert.equal(f.state.error, '')
  assert.equal(writes, 1)
  assert.equal(reads, 3)
})

test('请求超时但服务器已保存，读取重试能恢复，避免再次反转', async () => {
  let current = 0, writes = 0
  const f = fixture({
    renewAutoStatus: async () => reply(current),
    renewAutoSet: async body => { writes++; current = body.status; throw new Error('网络断开') },
  })
  await f.control.read(); await f.control.toggle()
  assert.equal(f.state.phase, 'error')
  await f.control.read()
  assert.equal(f.state.enabled, true)
  assert.equal(f.state.error, '')
  assert.equal(writes, 1)
})

test('确认值与目标不一致时显示真实状态，不能假报已开启', async () => {
  const f = fixture({ renewAutoStatus: async () => reply(0), renewAutoSet: async () => ({ status: 200 }) })
  await f.control.read(); await f.control.toggle()
  assert.equal(f.state.enabled, false)
  assert.match(f.state.error, /未生效/)
  assert.equal(f.state.phase, 'ready')
})

test('缺失或错误的确认值不能被当作成功，后续只读取确认', async () => {
  let reads = 0, writes = 0
  const f = fixture({
    renewAutoStatus: async () => ++reads === 2 ? { status: 200, data: {} } : reply(reads === 1 ? 1 : 0),
    renewAutoSet: async () => { writes++; return { status: 200 } },
  })
  await f.control.read(); await f.control.toggle()
  assert.equal(f.state.phase, 'error')
  assert.match(f.state.error, /确认失败/)
  await f.control.read()
  assert.equal(f.state.enabled, false)
  assert.equal(writes, 1)
})

test('实例切换或卸载后，旧读取及写入响应不能更新新的开关', async () => {
  const oldRead = deferred(), oldWrite = deferred()
  let reads = 0
  const old = fixture({ renewAutoStatus: () => { reads++; return oldRead.promise } })
  const pendingRead = old.control.read()
  old.control.dispose()
  const count = old.history.length
  oldRead.resolve(reply(1)); await pendingRead
  assert.equal(old.history.length, count)
  const next = fixture({
    renewAutoStatus: async () => { reads++; return reply(0) },
    renewAutoSet: () => oldWrite.promise,
  })
  await next.control.read()
  const pendingWrite = next.control.toggle()
  next.control.dispose()
  const savedCount = next.history.length
  oldWrite.resolve({ status: 200 }); await pendingWrite
  assert.equal(next.history.length, savedCount)
  assert.equal(reads, 2)
})
