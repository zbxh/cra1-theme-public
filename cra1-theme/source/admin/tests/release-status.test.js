import assert from 'node:assert/strict'
import {test} from 'node:test'
import {releaseChecks, releaseStatus} from '../src/lib/release-status.js'

test('legacy baseline rows stay out of the operator view while actionable checks remain', () => {
 const native = [{id:'compatibility',status:'unverified'}, {id:'dependency:route/home.php',status:'blocked'}]
 const database = {id:'database',status:'blocked'}
 const file = {id:'file:public/web/cra1/index.html',status:'unverified'}
 assert.deepEqual(releaseChecks({checks:[...native,database,file]}), [database,file])
 assert.match(releaseStatus(releaseChecks({checks:native})), /未发现需要处理/)
 assert.match(releaseStatus([database,file]), /^发现需要处理/)
 assert.match(releaseStatus([file]), /主题文件.*差异/)
})
