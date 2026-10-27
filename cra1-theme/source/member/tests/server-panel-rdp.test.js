import test from 'node:test'
import assert from 'node:assert/strict'
import { saveRdpFile } from '../src/pages/serverPanel/rdp-download.js'

test('JSON RDP response downloads the exact contents and revokes its temporary URL', async () => {
  const events = [], content = 'full address:s:192.0.2.1\r\nusername:s:fixture\r\n'
  let blob, link
  const browser = {
    Blob,
    URL: { createObjectURL: value => { blob = value; return 'blob:fixture' }, revokeObjectURL: url => events.push(['revoke', url]) },
    document: { body: { appendChild: value => { link = value; events.push('append') } }, createElement: () => ({ click: () => events.push('click'), remove: () => events.push('remove') }) },
    setTimeout: (callback, delay) => { assert.ok(delay >= 1000); callback() },
  }
  assert.equal(saveRdpFile({ content, name: '../my-server' }, browser), 'my-server.rdp')
  assert.equal(link.download, 'my-server.rdp'); assert.equal(link.href, 'blob:fixture')
  assert.equal(await blob.text(), content)
  assert.deepEqual(events, ['append', 'click', 'remove', ['revoke', 'blob:fixture']])
})
test('missing or corrupt RDP content cannot produce a download', () => {
  for (const data of [null, {}, { content: '' }, { content: {} }]) assert.throws(() => saveRdpFile(data, {}), /内容为空/)
})
