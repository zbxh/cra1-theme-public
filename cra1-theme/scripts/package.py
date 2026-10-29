#!/usr/bin/env python3
"""Build deterministic source/install/update *candidates*. Never touches runtime or live releases."""
import argparse, hashlib, json, os, pathlib, re, stat, zipfile, shutil
from bundle_install import bundle_install, guide_sources, read_source
ROOT=pathlib.Path(__file__).resolve().parents[2]
RUNTIME_ROOTS=['cra1-theme/backend','cra1-theme/docs','cra1-theme/licenses','public/web/cra1','public/clientarea/template/pc/cra1','public/clientarea/template/mobile/cra1','public/cart/template/pc/cra1','public/cart/template/mobile/cra1','public/home/template/pc/cra1','public/home/template/mobile/cra1','public/cra1-shared','public/cra1admin','public/cra1-install']
LEGACY_HELPERS=['lib/cra1_theme_admin.php','lib/cra1_theme_security.php','lib/cra1_theme_media.php','lib/cra1_theme_seo.php','lib/cra1_theme_client_actions.php','bin/cra1-theme-security.php','bin/cra1-theme-media.php']
# Runtime consumers load the selected private backend directly. Existing legacy
# wrappers remain on disk; updating them would needlessly require system-directory writes.
HELPERS=['cra1-theme/scripts/security.php','cra1-theme/scripts/media.php','cra1-theme/THIRD_PARTY_NOTICES.md','cra1-theme/scripts/private-path-check.php']
NATIVE_CONTRACTS={
 'app/event/AppInit.php':'主题钩子装载时机',
 'app/http/middleware/CheckHome.php':'原生会员身份及会话校验',
 'app/http/middleware/Check.php':'通知读取的原生 JWT、注销及密码失效校验',
 'app/http/middleware/CheckClientCookieJwt.php':'通知读取的原生账户状态及会话有效期校验',
 'app/http/middleware/CheckClientOperatePassword.php':'原生敏感操作中间件位置',
 'app/home/model/ClientareaAuthRuleModel.php':'原生子账户权限分组及产品范围契约',
 'app/home/controller/ViewClientController.php':'会员模板与未知模块回退',
 'app/home/controller/ViewCartController.php':'购物车模板解析',
 'app/common/logic/ClientareaTemplateLogic.php':'原生外壳及页面解析契约',
 'app/common/model/HostModel.php':'权限过滤后的产品数据',
 'app/common/model/SelfDefinedFieldModel.php':'产品自定义字段类型与可见性',
 'app/common/model/ConfigurationModel.php':'原生主题设置读取与保存',
 'app/admin/validate/ConfigurationValidate.php':'原生主题设置校验',
 'app/http/middleware/CheckAdmin.php':'安装向导原生超级管理员鉴权',
 'route/home.php':'会员与业务接口路由契约',
 'public/plugins/server/mf_cloud/logic/CloudLogic.php':'磁盘及流量适配父类契约',
 'public/plugins/server/mf_cloud/controller/home/CloudController.php':'模块操作方法及权限',
 'public/plugins/server/mf_cloud/route.php':'模块已登记接口',
}
SKIP={'node_modules','.git','.vite','__pycache__','runtime','tests','test','previews','backup','backups','logs','coverage','dist'}
ICON_VERSION=json.loads((ROOT/'public/cra1-shared/icons/version.json').read_text())['version']
if not re.fullmatch('[a-z0-9-]+',ICON_VERSION):raise RuntimeError('Invalid icon release')
ICON_ROOT='public/cra1-shared/icons/releases/'+ICON_VERSION
def digest(b):return hashlib.sha256(b).hexdigest()
def excluded(rel,source=False):
 p=pathlib.PurePosixPath(rel)
 if p.name=='AGENTS.md':return True
 if not source:
  if rel.startswith('public/') and p.suffix=='.md':return True
  if rel.startswith('cra1-theme/docs/') and p.name not in ['product-identity.json','nginx.example.conf','安装更新与回退.md','测试版与后续更新.md','icon-source-evidence.json']:return True
  if rel in ['cra1-theme/backend/Release/LicenseCredential.php','cra1-theme/licenses/issuer-keys.json']:return True
 if rel.startswith('public/cra1-shared/icons/imported/'):return True
 # Historical URL/colour/size caches belong to the installation, not the source asset set.
 # Existing installations keep their files; updates do not delete unlisted paths.
 if p.parent.as_posix()=='public/web/cra1/assets/icons' and re.fullmatch(r'(?:builtin-[a-z0-9-]+-)?[a-f0-9]{32}\.(?:svg|png)',p.name):return True
 if any(x.startswith('.') or x in SKIP for x in p.parts):return True
 if 'releases' in p.parts and not rel.startswith(ICON_ROOT+'/'):return True
 if any(x in p.name.lower() for x in ['preview','previous','clipboard']) and rel not in ['public/cra1admin/preview.php','public/cra1-shared/preview-runtime.js']:return True
 if p.name=='交付记录.md':return True
 if p.suffix.lower() in ['.map','.log','.sqlite','.key','.pem','.zip','.tar','.gz','.bak','.old','.orig'] or p.name.endswith('~'):return True
 if p.name in ['storage.json','entry.json','admin.json','auth.json','config.php','issuer-secret.json']:return True
 if not source and ('src' in p.parts or p.name in ['package.json','package-lock.json'] or p.suffix in ['.less','.mjs','.cjs','.py']):return True
 return False

def owned_walk(root):
 if root.is_symlink():yield root;return
 if not root.exists():return
 for base,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=sorted(d for d in dirs if d not in SKIP and (d!='releases' or (pathlib.Path(base)/d).relative_to(ROOT).as_posix()=='public/cra1-shared/icons/releases'))
  if pathlib.Path(base).relative_to(ROOT).as_posix()=='public/cra1-shared/icons/releases':dirs[:]=[d for d in dirs if d==ICON_VERSION]
  for name in list(dirs):
   p=pathlib.Path(base)/name
   if p.is_symlink():yield p;dirs.remove(name)
  for name in sorted(files):yield pathlib.Path(base)/name

def archive(path,files):
 if path.exists():raise RuntimeError('Output already exists; refusing to replace a delivered candidate: '+str(path))
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,data in sorted(files.items()):
   i=zipfile.ZipInfo(name,(2026,1,1,0,0,0));i.create_system=3;i.external_attr=(stat.S_IFREG|0o644)<<16;i.compress_type=zipfile.ZIP_DEFLATED
   z.writestr(i,data)
 return {'path':path.name,'bytes':path.stat().st_size,'sha256':digest(path.read_bytes())}

def maintenance_archive(stage,out,meta,build):
 if build.get('entry')!='cra1-theme/scripts/build.mjs' or build.get('release')!=meta['release'] or build.get('patches')!=meta.get('maintenance',{}).get('patches'):raise RuntimeError('Maintenance build identity mismatch')
 data={}
 for p in sorted((stage/'payload').rglob('*')):
  if p.is_symlink():raise RuntimeError('Maintenance payload cannot contain links')
  if p.is_file():data[p.relative_to(stage/'payload').as_posix()]=p.read_bytes()
 if len(data)!=build['files']:raise RuntimeError('Maintenance payload count changed')
 meta['files']={p:{'sha256':digest(b),'bytes':len(b)} for p,b in sorted(data.items())}
 data['cra1-theme/release.json']=(json.dumps(meta,ensure_ascii=False,indent=2)+'\n').encode()
 outer={**meta,'files':{p:{'sha256':digest(b),'bytes':len(b)} for p,b in sorted(data.items())}}
 update={'manifest.json':(json.dumps(outer,ensure_ascii=False,indent=2)+'\n').encode(),**{'payload/'+p:b for p,b in data.items()}}
 result=archive(out/f"cra1-theme-{meta['release']}-maintenance-candidate.zip",update)
 report={'release':meta['release'],'mode':'maintenance','base_release':build['base_release'],'files':len(data),'frontend_bytes_changed':0,'packages':[result]}
 (out/'candidate-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report,ensure_ascii=False,indent=2))

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--stage',required=True,type=pathlib.Path);ap.add_argument('--out',required=True,type=pathlib.Path);ap.add_argument('--with-guide-bundle',action='store_true',help='Also generate an optional offline tutorial bundle');args=ap.parse_args()
 stage=args.stage.resolve();out=args.out.resolve()
 if ROOT==out or ROOT in out.parents or ROOT==stage or ROOT in stage.parents:raise RuntimeError('Staging and package outputs must be outside the site')
 meta=json.loads((stage/'release.json').read_text());release=meta['release']
 if not re.fullmatch('[a-z0-9][a-z0-9-]{3,80}',release):raise RuntimeError('Invalid release id')
 version=meta.get('version',release)
 if 'version' in meta and (not isinstance(version,str) or not re.fullmatch(r'v[0-9]+\.[0-9]+(?:\.[0-9]+)?',version)):raise RuntimeError('Invalid public version')
 out.mkdir(parents=True,exist_ok=True)
 build=json.loads((stage/'build.json').read_text())
 if build.get('mode')=='maintenance':return maintenance_archive(stage,out,meta,build)
 guides=guide_sources(ROOT)
 data={};refs=dict(meta.get('references',{}));native={r['path']:r for r in meta.get('native_dependencies',[])};asset_rows=[]
 rights=json.loads((ROOT/'cra1-theme/docs/asset-rights.json').read_text())
 if rights.get('format')!=1 or not isinstance(rights.get('assets'),dict):raise RuntimeError('Unsupported asset rights registry')
 for rel,purpose in NATIVE_CONTRACTS.items():
  if rel not in native:raise RuntimeError('Missing reviewed native contract input: '+rel)
 def include(rel,b):
  if rel in refs:
   if digest(b)!=native.get(refs[rel],{}).get('observed_sha256'):raise RuntimeError('Native reference ownership changed; review before packaging: '+rel)
  else:data[rel]=b
 for base in RUNTIME_ROOTS:
  for p in owned_walk(ROOT/base):
   rel=p.relative_to(ROOT).as_posix()
   if excluded(rel):continue
   if p.is_symlink():
    target=os.path.normpath(os.path.join(os.path.dirname(rel),os.readlink(p)))
    if not target.startswith('public/') or '..' in pathlib.PurePosixPath(target).parts:raise RuntimeError('External dependency link: '+rel)
    if refs.get(rel)!=target:raise RuntimeError('Undeclared native reference; review before packaging: '+rel)
    continue
   if p.is_file():include(rel,p.read_bytes())
 for rel in HELPERS:
  if (ROOT/rel).is_file():data[rel]=(ROOT/rel).read_bytes()
 for p in sorted((stage/'public').rglob('*')):
  if not p.is_file() or p.is_symlink() or any(x.startswith('.') for x in p.relative_to(stage).parts):continue
  rel=p.relative_to(stage).as_posix();include(rel,p.read_bytes())
 # Explicit prerequisites are manifest data, never archive symlinks.
 meta['references']=dict(sorted(refs.items()));meta['native_dependencies']=list(sorted(native.values(),key=lambda x:x['path']))
 for rel,b in sorted(data.items()):
  if pathlib.PurePosixPath(rel).suffix.lower() in ['.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.svg']:
   reviewed=rights['assets'].get(rel,{})
   valid=reviewed.get('sha256')==digest(b) and reviewed.get('redistribution')=='verified' and all(isinstance(reviewed.get(k),str) and reviewed[k].strip() for k in ['source','license','evidence'])
   asset_rows.append({'path':rel,'sha256':digest(b),'bytes':len(b),'provenance':reviewed.get('source','pending') if valid else 'pending','redistribution':'verified' if valid else 'unverified',**({'license':reviewed['license'],'evidence':reviewed['evidence']} if valid else {})})
 # Pin the complete private implementation per request; updates prepare it before pointer commit.
 backend_root='cra1-theme/backend/releases/'+release
 meta['backend_root']=backend_root
 for rel in list(data):
  if rel.startswith('cra1-theme/backend/') and rel!='cra1-theme/backend/bootstrap.php':
   data[backend_root+'/'+rel.removeprefix('cra1-theme/backend/')]=data.pop(rel)
 pending_assets=[row for row in asset_rows if row['redistribution']!='verified']
 inventory={'format':1,'assets':asset_rows,'native_dependencies_count':len(native),'no_core_payload':True}
 # release.json excludes its own checksum to avoid a circular digest. The outer manifest covers it.
 meta['files']={p:{'sha256':digest(b),'bytes':len(b)} for p,b in sorted(data.items())}
 data['cra1-theme/release.json']=(json.dumps(meta,ensure_ascii=False,indent=2)+'\n').encode()
 outer={**meta,'files':{p:{'sha256':digest(b),'bytes':len(b)} for p,b in sorted(data.items())}}
 update={'manifest.json':(json.dumps(outer,ensure_ascii=False,indent=2)+'\n').encode(),**{'payload/'+p:b for p,b in data.items()}}
 results=[]
 results.append(archive(out/f'cra1-theme-{version}-install-candidate.zip',data))
 results.append(archive(out/f'cra1-theme-{version}-update-candidate.zip',update))
 source=dict(data)
 for base in ['cra1-theme/backend','cra1-theme/docs','cra1-theme/licenses','cra1-theme/source','cra1-theme/scripts','cra1-theme/tests','cra1-theme/source/member/tests','cra1-theme/source/admin/tests','public/cra1-shared/src','public/web/cra1/src','public/cra1-shared/theme-sources']:
  for p in owned_walk(ROOT/base):
   rel=p.relative_to(ROOT).as_posix()
   # Tests belong to source only. Runtime packages above never include them.
   if p.is_file() and not p.is_symlink() and p.name!='AGENTS.md' and not any(x in p.parts for x in ['node_modules','.git','__pycache__']) and not any(x.startswith('.') for x in p.relative_to(ROOT).parts) and p.suffix not in ['.map','.log','.key','.pem','.sqlite','.pyc']:
    source[rel]=p.read_bytes()
 for rel in LEGACY_HELPERS:
  if (ROOT/rel).is_file():source[rel]=(ROOT/rel).read_bytes()
 source['cra1-theme/LICENSE.txt']=(ROOT/'cra1-theme/LICENSE.txt').read_bytes()
 source['LICENSE']=(ROOT/'LICENSE').read_bytes()
 source.update(guides)
 source['docs/usage.md']=read_source(ROOT,'docs/usage.md')
 for image in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',source['docs/usage.md'].decode('utf-8')):
  if not re.fullmatch(r'images/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|webp)',image):raise RuntimeError('Usage guide images must use reviewed local filenames')
  source['docs/'+image]=read_source(ROOT,'docs/'+image)
 source['cra1-theme/docs/asset-inventory.json']=(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n').encode()
 for rel in ['public/cra1-shared/README.md','public/clientarea/template/pc/cra1/README.md','public/cra1-shared/package.json','public/cra1-shared/package-lock.json','public/cra1-shared/build.mjs','public/cra1-shared/build-icons.py']:
  if (ROOT/rel).is_file():source[rel]=(ROOT/rel).read_bytes()
 results.append(archive(out/f'cra1-theme-{version}-source-candidate.zip',source))
 delivery_dir=out/'delivery';delivery_dir.mkdir()
 delivery_file=delivery_dir/f'CRA1-theme-{version}-install.zip'
 shutil.copyfile(out/results[0]['path'],delivery_file)
 delivery={'path':'delivery/'+delivery_file.name,'kind':'install','version':version,'bytes':delivery_file.stat().st_size,'sha256':digest(delivery_file.read_bytes())}
 report={'release':release,'version':version,'release_channel':meta.get('release_channel','candidate'),'commercial_release_accepted':False,'release_blockers':outer['release_blockers'],'files':len(data),'native_references':len(refs),'native_dependencies':len(native),'asset_provenance_pending':len(pending_assets),'packages':results,'delivery':delivery}
 if args.with_guide_bundle:report['guide_bundle']=bundle_install(out/results[0]['path'],out/'optional-guide-bundle',ROOT)
 (out/'candidate-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
