import test from 'node:test'
import assert from 'node:assert/strict'
import { articleSource, articleSourceInfo, articleRequest, articleRows } from '../source/member/src/lib/article-timeline.js'

test('native article endpoints receive the correct category and requested limit', () => {
  for (const source of ['news', 'announcement']) {
    const request = new URL(articleRequest(source, 7, 10), 'https://fixture.invalid')
    assert.equal(request.pathname, '/' + source)
    assert.equal(request.searchParams.get(`addon_idcsmart_${source}_type_id`), '7')
    assert.equal(request.searchParams.get('limit'), '10')
    assert.equal(request.searchParams.get('sort'), 'desc')
  }
  assert.equal(articleRequest('help', 7, 6), '/help')
  assert.equal(articleSource('https://other.test'), 'news')
  assert.equal(articleSourceInfo('help').view, 'helpTotal.htm')
})
test('help categories use their actual nested lists and preserve native order', () => {
  const response = { data: { list: [{ id: 1, helps: [{ id: 9, title: '其他分类' }] }, { id: 2, helps: [{ id: 4, title: '置顶指南' }, { id: 2, title: '入门指南' }, { id: 'bad', title: '损坏记录' }] }] } }
  assert.deepEqual(articleRows(response, 'help', 2, 6).map(row => row.id), [4, 2])
  assert.deepEqual(articleRows(response, 'help', 0, 2).map(row => row.id), [9, 4])
  assert.deepEqual(articleRows(response, 'help', 5, 6), [])
  assert.equal(articleRows(response, 'help', 2, 6)[0].create_time, undefined)
})
test('article read failures do not silently appear as an empty successful timeline', () => {
  assert.throws(() => articleRows({ data: {} }, 'news', 0, 6), /暂时无法读取/)
  assert.deepEqual(articleRows({ data: { list: [] } }, 'announcement', 0, 6), [])
  assert.deepEqual(articleRows({ data: { list: [{ id: 2, title: '公开新闻', create_time: 123 }] } }, 'news', 0, 6), [{ id: 2, title: '公开新闻', create_time: 123 }])
})
