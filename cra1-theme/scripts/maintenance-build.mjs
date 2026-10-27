/** Invoked only by build.mjs: preserve verified installed bytes, apply an explicit backend patch list. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const validId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{3,80}$/.test(value)
function regular(root,relative){
  if(typeof relative!=='string'||relative.startsWith('/')||relative.includes('\\')||relative.split('/').some(p=>!p||p.startsWith('.')))throw new Error('Invalid maintenance input path')
  const file=path.join(root,relative)
  for(let p=file;p!==root;p=path.dirname(p))if(fs.lstatSync(p).isSymbolicLink())throw new Error('Maintenance input cannot follow links: '+relative)
  if(!fs.statSync(file).isFile())throw new Error('Maintenance input must be a regular file: '+relative)
  return fs.readFileSync(file)
}
export function buildMaintenance({root,output,release,channel,site,patchList}){
  site=path.resolve(site)
  if(fs.realpathSync(site)!==site||site===root||output===site||output.startsWith(site+path.sep)||!patchList)throw new Error('A separate installed site, external staging and an explicit patch list are required')
  const pointerBytes=regular(site,'runtime/cra1_theme/distribution/current.json'),current=JSON.parse(pointerBytes)
  const base=current.manifest,old=current.release
  if(!validId(old)||old===release||base?.release!==old||base.backend_root!==`cra1-theme/backend/releases/${old}`)throw new Error('Installed immutable release metadata is incomplete')
  const changes=readJson(path.resolve(patchList)),integrations=readJson(path.join(root,'cra1-theme/source/native-integration-profiles.json'))
  if(changes.format!==1||!Array.isArray(changes.patches)||!changes.patches.length||integrations.format!==1||!Array.isArray(integrations.profiles))throw new Error('Invalid reviewed maintenance inputs')
  const review=regular(root,'cra1-theme/docs/native-integration-review.md')
  if(integrations.profiles.some(p=>p.provenance!=='reviewed-integration'||p.review_sha256!==sha(review)))throw new Error('Integration review evidence changed')
  const data=new Map(),rebase=rel=>rel.replace(`/releases/${old}/`,`/releases/${release}/`)
  // No unregistered source, credentials, configuration or customer data enters this build.
  for(const [relative,row] of Object.entries(base.files||{})){
    const bytes=regular(site,relative)
    if(sha(bytes)!==row.sha256||bytes.length!==row.bytes)throw new Error('Installed release changed; review it before building: '+relative)
    if(relative!=='cra1-theme/release.json')data.set(rebase(relative),bytes)
  }
  const patches={}
  for(const relative of changes.patches){
    if(!/^cra1-theme\/backend\/(?!releases\/|bootstrap\.php$)[A-Za-z0-9_./-]+\.(?:php|json)$/.test(relative))throw new Error('Maintenance patches are restricted to private backend files')
    const target=`cra1-theme/backend/releases/${release}/`+relative.slice('cra1-theme/backend/'.length)
    if(!data.has(target))throw new Error('A maintenance patch cannot silently add a new subsystem: '+relative)
    const bytes=regular(root,relative);data.set(target,bytes);patches[relative]=sha(bytes)
  }
  data.set('cra1-theme/docs/native-integration-review.md',review)
  const metadata={...base,release,release_channel:channel,backend_root:`cra1-theme/backend/releases/${release}`,
    asset_bases:Object.fromEntries(Object.entries(base.asset_bases).map(([k,v])=>[k,v.replace(`/releases/${old}`,`/releases/${release}`)])),
    references:Object.fromEntries(Object.entries(base.references||{}).map(([k,v])=>[rebase(k),v])),integration_profiles:integrations.profiles,
    maintenance:{base_release:old,base_pointer_sha256:sha(pointerBytes),patches}}
  delete metadata.files
  for(const [relative,bytes] of data){const file=path.join(output,'payload',relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes)}
  fs.writeFileSync(path.join(output,'release.json'),JSON.stringify(metadata,null,2)+'\n')
  fs.writeFileSync(path.join(output,'build.json'),JSON.stringify({format:1,mode:'maintenance',release,entry:'cra1-theme/scripts/build.mjs',base_release:old,base_pointer_sha256:sha(pointerBytes),patches,files:data.size},null,2)+'\n')
  console.log(JSON.stringify({release,mode:'maintenance',base_release:old,files:data.size,backend_patches:Object.keys(patches),frontend_bytes_changed:0}))
}
