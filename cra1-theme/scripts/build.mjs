#!/usr/bin/env node
/** The sole supported release build. Every output must be outside the source site's public root. */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')
const stage=process.env.CRA1_RELEASE_STAGE,release=process.env.CRA1_RELEASE_ID
const channel=process.env.CRA1_RELEASE_CHANNEL||'candidate'
if(!['candidate','test'].includes(channel))throw new Error('CRA1_RELEASE_CHANNEL must be candidate or test.')
if(!stage||!release||!/^[a-z0-9][a-z0-9-]{3,80}$/.test(release))throw new Error('Set CRA1_RELEASE_STAGE and a new immutable CRA1_RELEASE_ID.')
const output=path.resolve(stage)
let ancestor=output
while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor)
const resolved=path.join(fs.realpathSync(ancestor),path.relative(ancestor,output))
if(resolved===root||resolved.startsWith(root+path.sep))throw new Error('Release staging must be outside the source site. Live builds are forbidden.')
if(fs.existsSync(output))throw new Error('Staging directory must be new; refusing to overwrite a candidate.')
fs.mkdirSync(output,{recursive:true})
process.env.CRA1_RELEASE_BUILD='1'
if(process.env.CRA1_MAINTENANCE_SITE){
  const {buildMaintenance}=await import('./maintenance-build.mjs')
  buildMaintenance({root,output,release,channel,site:process.env.CRA1_MAINTENANCE_SITE,patchList:process.env.CRA1_MAINTENANCE_PATCH_LIST})
  process.exit(0)
}
const native=JSON.parse(fs.readFileSync(path.join(root,'cra1-theme/source/native-references.json'),'utf8'))
const integrations=JSON.parse(fs.readFileSync(path.join(root,'cra1-theme/source/native-integration-profiles.json'),'utf8'))
if(integrations.format!==1||!Array.isArray(integrations.profiles))throw new Error('Reviewed integration profile input is unsupported.')
const identity=JSON.parse(fs.readFileSync(path.join(root,'cra1-theme/docs/product-identity.json'),'utf8'))
if(identity.format!==1||identity.product!=='cra1-theme'||identity.theme_id!=='cra1')throw new Error('Reviewed CRA1 identity metadata is required.')
const assigned=JSON.parse(fs.readFileSync(path.join(root,'cra1-theme/release.json'),'utf8'))
if(assigned.version!==undefined&&!/^v\d+\.\d+(?:\.\d+)?$/.test(assigned.version))throw new Error('Invalid assigned public version.')
const identityAudit=spawnSync('python3',[path.join(root,'cra1-theme/scripts/identity-audit.py')],{cwd:root,stdio:'inherit'})
if(identityAudit.status!==0)throw new Error('CRA1 identity/license audit failed; no release assets were built.')
if(native.format!==1)throw new Error('Native reference input is unsupported.')
const nativeRefs=Object.fromEntries(Object.entries(native.references).map(([p,target])=>[p.replaceAll('{release}',release),target]))
const nativeHashes=new Map(native.native_dependencies.map(row=>[row.path,row.observed_sha256]))
function run(args,cwd,extra={}){const result=spawnSync(process.execPath,args,{cwd,env:{...process.env,...extra},stdio:'inherit'});if(result.status!==0)throw new Error('Build failed: '+args.join(' '))}
function copyRegularTree(from,to){
  if(!fs.existsSync(from))return
  for(const ent of fs.readdirSync(from,{withFileTypes:true})){
    if(ent.isSymbolicLink()||ent.name==='node_modules'||ent.name==='previews')continue
    const src=path.join(from,ent.name),dst=path.join(to,ent.name)
    if(ent.isDirectory())copyRegularTree(src,dst)
    else if(ent.isFile()){
      const rel=path.relative(output,dst).split(path.sep).join('/'),target=nativeRefs[rel]
      if(target){
        const observed=createHash('sha256').update(fs.readFileSync(src)).digest('hex')
        if(observed!==nativeHashes.get(target))throw new Error('Native reference source changed; review ownership before building: '+rel)
        continue
      }
      fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst)
    }
  }
}
const member=path.join(root,'cra1-theme/source/member'),admin=path.join(root,'cra1-theme/source/admin')
for(const dir of [member,admin,path.join(root,'public/cra1-shared'),path.join(root,'public/web/cra1/src')])if(!fs.existsSync(path.join(dir,'node_modules')))throw new Error('Run npm ci in '+path.relative(root,dir)+' first. Do not use an external build tree.')
run(['node_modules/vite/bin/vite.js','build'],member,{CRA1_MEMBER_OUT_DIR:path.join(output,'public/clientarea/template/pc/cra1/releases',release,'assets'),VITE_CRA1_SHARED_BASE:`/cra1-shared/releases/${release}`})
run(['node_modules/vite/bin/vite.js','build'],admin,{CRA1ADMIN_OUT_DIR:path.join(output,'public/cra1admin/assets/releases',release)})
const shared=path.join(output,'public/cra1-shared')
fs.cpSync(path.join(root,'public/cra1-shared/src'),path.join(shared,'src'),{recursive:true})
run([path.join(root,'public/cra1-shared/build.mjs')],root,{CRA1_SHARED_ROOT:shared,CRA1_SHARED_RELEASE:release})
fs.rmSync(path.join(shared,'src'),{recursive:true})
// Isolated previews use an opaque sandbox. Bundle the actual React release entries
// as classic scripts; no server CORS changes or extra production page requests.
fs.copyFileSync(path.join(root,'public/cra1-shared/preview-runtime.js'),path.join(shared,'releases',release,'preview-runtime.js'))
const previewBuild=createRequire(path.join(member,'package.json'))('esbuild').buildSync
for(const entry of ['home','productList','productdetail','login','regist']){
  const original=`/clientarea/template/pc/cra1/releases/${release}/assets/js/${entry}.js`
  previewBuild({entryPoints:[path.join(output,'public',original)],outfile:path.join(shared,'releases',release,'preview/member',entry+'.js'),bundle:true,format:'iife',minify:true,legalComments:'none',define:{'import.meta.url':'__cra1_preview_import_meta_url__'},banner:{js:`var __cra1_preview_import_meta_url__=window.__THEME_PREVIEW__.resource_origin+${JSON.stringify(original)};`},logLevel:'warning'})
}

run([path.join(root,'public/web/cra1/src/build.mjs')],path.join(root,'public/web/cra1/src'),{CRA1_WEB_OUT_DIR:path.join(output,'public/web/cra1/releases',release)})
// Keep native/module compatibility assets in the same immutable release namespace.
const memberRelease=path.join(output,'public/clientarea/template/pc/cra1/releases',release)
for(const rel of ['api','components','js'])copyRegularTree(path.join(root,'public/clientarea/template/pc/cra1',rel),path.join(memberRelease,rel))
copyRegularTree(path.join(root,'cra1-theme/source/legacy-assets/member/20261012-nav-auth-v1'),path.join(memberRelease,'20261012-nav-auth-v1'))
// The header still uses this relative location; its bytes come from the single
// maintained shell stylesheet, including announcement removal and navigation fixes.
fs.mkdirSync(path.join(memberRelease,'20261012-nav-auth-v1/css'),{recursive:true})
fs.copyFileSync(path.join(root,'public/cra1-shared/theme-sources/member/cra1-shell.css'),path.join(memberRelease,'20261012-nav-auth-v1/css/cra1-shell.css'))
const cartRelease=path.join(output,'public/cart/template/pc/cra1/releases',release)
for(const old of ['20261011-titanium-v1','20261012-icon-suite-v1','20261012-cart-entry-v1','20261013-security-snapshot-v1','20261017-compat-v3'])copyRegularTree(path.join(root,'cra1-theme/source/legacy-assets/cart',old),path.join(cartRelease,old))
// Purchase pages replace their existing stylesheet with one combined resource.
// Other cart pages keep their original CSS; no extra first-screen request.
const purchaseTheme=path.join(cartRelease,'20261017-compat-v3/css/purchase-theme.css')
fs.mkdirSync(path.dirname(purchaseTheme),{recursive:true})
fs.writeFileSync(purchaseTheme,fs.readFileSync(path.join(cartRelease,'20261011-titanium-v1/css/cart-theme.css'),'utf8')+'\n'+fs.readFileSync(path.join(root,'cra1-theme/source/legacy-assets/cart/20261017-compat-v3/css/purchase-pages.css'),'utf8'))
const websiteRelease=path.join(output,'public/web/cra1/releases',release)
for(const old of ['20261011-business-icons-v1','20261014-theme-fixes-v1','20261017-compat-v3'])copyRegularTree(path.join(root,'cra1-theme/source/legacy-assets/website',old),path.join(websiteRelease,old))
fs.mkdirSync(path.join(websiteRelease,'20261017-compat-v3'),{recursive:true})
fs.copyFileSync(path.join(root,'public/cra1-shared/theme-sources/website/app.js'),path.join(websiteRelease,'20261017-compat-v3/app.js'))
// Compatibility styles are frozen source inputs; the website script has its canonical source.
const oldWebApp=path.join(root,'public/cra1-shared/theme-sources/website/app.js')
if(fs.existsSync(oldWebApp))fs.copyFileSync(oldWebApp,path.join(websiteRelease,'app.js'))
const officialEvidenceBytes=fs.readFileSync(path.join(root,'cra1-theme/docs/official-baseline-evidence.json'))
const officialEvidence=JSON.parse(officialEvidenceBytes)
if(officialEvidence.official_upgrade_completed!==true||officialEvidence.system_upgrade?.to!=='10.7.4'||!officialEvidence.modules)throw new Error('Reviewed official runtime evidence is required.')
// Flat product metadata is readable by earlier updaters without repository-only fields.
const metadata={...identity,release,release_channel:channel,security_epoch:1,
  ...(assigned.version?{version:assigned.version}:{}),
  backend_root:`cra1-theme/backend/releases/${release}`,
  installation_combinations:[{system:officialEvidence.system_upgrade.to,modules:officialEvidence.modules,evidence:{scope:'native-runtime-baseline',official_upgrade:true,record_sha256:createHash('sha256').update(officialEvidenceBytes).digest('hex')}}],
  integration_profiles:integrations.profiles,
  release_blockers:[],
  asset_bases:{member:`/clientarea/template/pc/cra1/releases/${release}`,native:`/clientarea/template/pc/cra1/releases/${release}`,cart:`/cart/template/pc/cra1/releases/${release}`,shared:`/cra1-shared/releases/${release}`,website:`/web/cra1/releases/${release}`,admin:`assets/releases/${release}`},
  references:nativeRefs,native_dependencies:native.native_dependencies}
fs.writeFileSync(path.join(output,'release.json'),JSON.stringify(metadata,null,2)+'\n')
fs.writeFileSync(path.join(output,'build.json'),JSON.stringify({format:1,release,release_channel:channel,entry:'cra1-theme/scripts/build.mjs',outputs:{member:release,admin:release,shared:release,website:release}},null,2)+'\n')
