import assert from 'node:assert/strict'
import {test} from 'node:test'
import {releaseStatus} from '../src/lib/release-status.js'
test('unverified native contracts do not claim the runtime files are broken or verified',()=>{
 assert.match(releaseStatus({counts:{blocked:0,unverified:21},overview:{files:{unverified:0}}}),/兼容记录待核验/)
 assert.match(releaseStatus({counts:{blocked:1,unverified:21}}),/需要处理/)
 assert.match(releaseStatus({counts:{blocked:0,unverified:1},overview:{files:{unverified:1}}}),/主题文件.*差异/)
 assert.match(releaseStatus({counts:{blocked:0,unverified:0}}),/检查通过/)
})
