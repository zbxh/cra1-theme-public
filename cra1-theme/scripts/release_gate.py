#!/usr/bin/env python3
"""Read-only candidate gate. Passing unit tests never creates an official support claim."""
import argparse, hashlib, json, pathlib, re, stat, subprocess, sys, zipfile

ROOT=pathlib.Path(__file__).resolve().parents[2]
def sha(data): return hashlib.sha256(data).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--candidates',required=True,type=pathlib.Path);p.add_argument('--php',default='php');p.add_argument('--out',required=True,type=pathlib.Path);p.add_argument('--private-markers-json',type=pathlib.Path);p.add_argument('--channel',choices=['commercial','test'],default='commercial');a=p.parse_args()
 folder=a.candidates.resolve();output=a.out.resolve()
 if output==ROOT or ROOT in output.parents: p.error('Write gate results outside the site')
 if output.exists(): p.error('Do not overwrite an existing gate record')
 report=json.loads((folder/'candidate-report.json').read_text());checks=[];blockers=[]
 markers=[str(ROOT).encode()]
 if a.private_markers_json:
  values=json.loads(a.private_markers_json.read_text())
  if not isinstance(values,list) or any(not isinstance(v,str) or len(v)<4 for v in values):p.error('Private scan markers must be a list of nonempty strings, kept outside distribution')
  markers.extend(v.encode() for v in values)
 technical_blockers=[]
 def check(ok,label,scope='technical'):
  checks.append({'check':label,'passed':bool(ok),'scope':scope})
  if not ok:
   blockers.append(label)
   if scope=='technical':technical_blockers.append(label)
 packages={}
 for row in report['packages']:
  path=folder/row['path']
  if path.parent!=folder or not path.is_file():raise RuntimeError('Candidate path invalid')
  check(path.stat().st_size==row['bytes'] and sha(path.read_bytes())==row['sha256'],'包校验：'+path.name)
  kind=next((kind for kind in ['install','update','source'] if '-'+kind+'-candidate.zip' in path.name),None)
  if kind in packages or not kind:raise RuntimeError('Candidate package set invalid')
  packages[kind]=path
 check(set(packages)=={'install','update','source'},'安装、更新及源码包齐全')
 delivery=report.get('delivery',{})
 delivery_name=f"delivery/CRA1-theme-{report.get('version',report['release'])}.zip"
 check(delivery.get('path')==delivery_name,'安装交付为包含版本号的单一合集')
 delivery_path=folder/delivery_name
 check(delivery_path.is_file() and delivery_path.stat().st_size==delivery.get('bytes') and sha(delivery_path.read_bytes())==delivery.get('sha256'),'安装合集存在且内容完整')
 if delivery_path.is_file():
  with zipfile.ZipFile(delivery_path) as bundle:
   check(bundle.read('cra1-theme-install.zip')==packages['install'].read_bytes(),'安装合集内的安装包与已检查候选包完全一致')
   guide_files={'安装教程/安装教程.md','安装教程/安装教程.html','安装教程/安装教程.pdf','安装教程/nginx.example.conf','开始安装.txt'}
   check(guide_files.issubset(bundle.namelist()) and any(n.startswith('安装教程/images/') for n in bundle.namelist()),'安装合集包含完整图文教程和说明')
 code='define("CRA1_THEME_BACKEND",$argv[1]."/cra1-theme/backend"); require $argv[1]."/cra1-theme/backend/bootstrap.php"; $r=CRA1\\Theme\\Release\\Package::inspect($argv[2]); echo json_encode(["release"=>$r["manifest"]["release"],"files"=>count($r["manifest"]["files"])]);'
 native=subprocess.run([a.php,'-r',code,str(ROOT),str(packages['update'])],capture_output=True,text=True)
 check(native.returncode==0,'PHP 发行清单、路径、类型、体积及全部负载校验')
 if native.returncode:raise RuntimeError(native.stderr.strip() or 'PHP package inspection failed')
 native_install=subprocess.run([a.php,'-r',code,str(ROOT),str(packages['install'])],capture_output=True,text=True)
 check(native_install.returncode==0,'同一安装 ZIP 通过覆盖更新的完整解析与负载校验')
 with zipfile.ZipFile(packages['install']) as install,zipfile.ZipFile(packages['update']) as update,zipfile.ZipFile(packages['source']) as source:
  doc=json.loads(update.read('manifest.json'));files=doc['files']
  check(doc.get('version',doc['release'])==report.get('version',report['release'])==delivery.get('version',delivery.get('release')),'安装合集、更新包及报告使用同一版本号')
  check(set(install.namelist())==set(files),'安装与更新负载完全对应')
  check(set(source.namelist()).issuperset(files),'源码包保留运行文件')
  identity=json.loads(install.read('cra1-theme/docs/product-identity.json'))
  license_bytes=source.read('cra1-theme/LICENSE.txt');license_meta=json.loads(source.read('cra1-theme/docs/repository-license.json'))
  check(all(doc.get(k)==identity.get(k) for k in identity),'发行标识与统一登记表一致')
  check(license_meta.get('version')==3 and license_bytes==source.read('LICENSE')==(ROOT/'LICENSE').read_bytes()==(ROOT/'cra1-theme/LICENSE.txt').read_bytes(),'许可原文仅保留于仓库源码且两份正文一致')
  check(not any(key in doc for key in ['license','commercial_blockers','commercial_release_accepted','test_evidence','verified_combinations']) and 'license' not in identity,'运行清单仅包含运行信息')
  repository_docs=['repository-license.json','商业授权.md','发行支持矩阵.md','identity-and-license.md','asset-inventory.json','asset-rights.json','official-baseline-evidence.json','business-acceptance-evidence.json','https-lifecycle-evidence.json']
  check('cra1-theme/LICENSE.txt' not in files and all('cra1-theme/docs/'+name not in files for name in repository_docs) and not any(name.endswith('/Release/LicenseCredential.php') for name in files),'客户安装与更新包无自有许可及内部商业资料')
  check(all('cra1-theme/docs/'+name in source.namelist() for name in repository_docs),'仓库源码保留原始许可与开发记录')
  check(all(name in source.namelist() for name in ['docs/installation.md','docs/usage.md','cra1-theme/scripts/bundle_install.py','cra1-theme/scripts/render-guide.mjs','cra1-theme/scripts/package.json','cra1-theme/scripts/package-lock.json']) and not any(name in source.namelist() for name in ['docs/installation.html','docs/installation.pdf']),'源码包仅保留 Markdown 教程、图片及可复现文档构建输入')
  customer_markers=['商用发行','商业授权','许可证','发行验收','免费商用']
  customer_entries=['public/cra1-install/installer.js','cra1-theme/docs/安装更新与回退.md','cra1-theme/docs/测试版与后续更新.md']
  check(all(not any(marker in install.read(name).decode() for marker in customer_markers) for name in customer_entries),'安装器与客户说明没有内部商业内容')
  safe=True;private=True;content=True;source_safe=True;source_content=True
  private_names=re.compile(r'(^|/)(?:runtime|config|node_modules|\.git|logs?|backups?)(/|$)|(?:\.sqlite(?:-wal|-shm)?|\.key|\.pem|\.env|storage\.json|entry\.json|admin\.json|auth\.json)$',re.I)
  origin_data=re.compile(rb'/root/(?:mfbuild|cloudbuild)(?:/|\b)|/www/wwwroot/[A-Za-z0-9_.-]+(?:/|\b)')
  credentials=re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')
  for name,row in files.items():
   b=install.read(name)
   safe=safe and sha(b)==row['sha256'] and len(b)==row['bytes'] and b==update.read('payload/'+name)
   private=private and not bool(private_names.search(name))
   if pathlib.PurePosixPath(name).suffix.lower() in ['.php','.js','.css','.json','.html','.txt','.md','.conf'] and '/licenses/dependencies/' not in name:
    content=content and not bool(origin_data.search(b) or credentials.search(b) or any(marker in b for marker in markers))
  for item in source.infolist():
   name=item.filename;parts=pathlib.PurePosixPath(name).parts
   source_safe=source_safe and not(name.startswith('/') or '..' in parts or bool(private_names.search(name))) and stat.S_IFMT(item.external_attr>>16)!=stat.S_IFLNK
   if pathlib.PurePosixPath(name).suffix.lower() in ['.php','.js','.jsx','.css','.json','.html','.txt','.md','.mjs','.cjs','.py'] and '/licenses/dependencies/' not in name:
    b=source.read(item);source_content=source_content and not any(marker in b for marker in markers)
  check(safe,'三个包中的文件内容与 SHA-256 一致')
  check(private,'运行包无配置、账号、密钥、日志、备份或 Node 依赖')
  check(content,'运行包不含已知本站地址、测试登录资料或凭据')
  check(source_safe,'源码包无私有运行资料、路径穿越或压缩包软链接')
  check(source_content,'源码包无已登记本站地址、测试登录资料或本机绝对路径')
  icon_version=json.loads(install.read('public/cra1-shared/icons/version.json'))['version']
  icon_catalog='public/cra1-shared/icons/releases/'+icon_version+'/catalog.json'
  check(icon_catalog in files,'正式图标目录未被通用 releases 过滤规则漏掉')
  check(not any(name.startswith('public/cra1-shared/icons/imported/') for name in source.namelist()),'商家导入图标不进入安装、更新或源码发行包')
  check(not any(re.fullmatch(r'public/web/cra1/assets/icons/(?:builtin-[a-z0-9-]+-)?[a-f0-9]{32}\.(?:svg|png)',name) for name in source.namelist()),'旧站尺寸、颜色及外部地址图标缓存不进入发行包')
  preview_files=['public/cra1admin/preview.php','public/cra1-shared/preview-runtime.js','public/cra1-shared/releases/'+doc['release']+'/preview-runtime.js']+['public/cra1-shared/releases/'+doc['release']+'/preview/member/'+entry+'.js' for entry in ['home','productList','productdetail']]
  check(all(name in files for name in preview_files),'草稿预览渲染器、沙箱拦截与真实组件预览资源完整')
  backend=doc.get('backend_root','')
  check(backend=='cra1-theme/backend/releases/'+doc['release'] and backend+'/Release/Updater.php' in files and backend+'/Support/cra1_theme_security.php' in files,'私有后端与安全实现完整并采用不可变目录')
  for rel in ['cra1-theme/scripts/build.mjs','cra1-theme/backend/Release/Updater.php','cra1-theme/source/member/package-lock.json','cra1-theme/source/admin/package-lock.json','public/cra1-shared/package-lock.json','public/web/cra1/src/package-lock.json']:
   check(rel in source.namelist(),'源码入口：'+rel)
  asset_inventory=json.loads(source.read('cra1-theme/docs/asset-inventory.json'))
  pending=[row for row in asset_inventory['assets'] if row.get('redistribution')!='verified']
  check(all(row.get('redistribution')!='verified' or (row.get('sha256')==files.get(row.get('path'),{}).get('sha256') and row.get('provenance') and row.get('license') and row.get('evidence')) for row in asset_inventory['assets']),'素材权利记录绑定实际文件校验值、来源、许可及依据')
  check(not pending,'素材可再分发依据已逐项核验（待核验 '+str(len(pending))+' 项）','commercial')
  icon_evidence=json.loads(install.read('cra1-theme/docs/icon-source-evidence.json'))
  icon_licenses=True
  for collection in icon_evidence.get('sources',[]):
   for license_file in collection.get('license_files',[]):
    name='cra1-theme/licenses/icons/'+license_file['name']
    icon_licenses=icon_licenses and name in files and sha(install.read(name))==license_file['sha256']
  check(icon_licenses and bool(icon_evidence.get('sources')),'已登记图标的来源、署名与许可原文校验值一致')
  deps=json.loads(install.read('cra1-theme/licenses/dependency-inventory.json'))
  missing=[row for row in deps['dependencies'] if not row.get('development') and not row.get('license_texts')]
  check(not missing,'运行依赖许可原文齐全（缺少 '+str(len(missing))+' 条记录）')
  check(bool(doc.get('verified_combinations')),'已有官方安装、官方升级和业务验收通过的系统与模块组合','commercial')
  for combination in doc.get('verified_combinations',[]):
   evidence=combination.get('evidence',{})
   check(isinstance(evidence,dict) and evidence.get('official_upgrade') is True and bool(re.fullmatch('[a-f0-9]{64}',evidence.get('record_sha256',''))),'兼容声明携带真实官方升级验收记录校验值')
  if a.channel=='test':
   check(doc.get('release_channel')=='test','清单明确登记为测试发行渠道')
   evidence_paths=['cra1-theme/docs/official-baseline-evidence.json','cra1-theme/docs/business-acceptance-evidence.json','cra1-theme/docs/https-lifecycle-evidence.json']
   records={}
   for name in evidence_paths:
    raw=source.read(name)
    check(bool(raw) and name not in files,'内部测试记录保留在仓库源码：'+pathlib.PurePosixPath(name).name)
    records[name]=json.loads(raw)
   official,business,lifecycle=(records[n] for n in evidence_paths)
   check(official.get('official_upgrade_completed') is True and official.get('system_upgrade',{}).get('to')=='10.7.4' and any(c.get('system')=='10.7.4' and c.get('modules')==official.get('modules') and c.get('evidence',{}).get('record_sha256')==sha(source.read(evidence_paths[0])) for c in doc.get('installation_combinations',[])),'测试版原生基线具有官方安装升级证据')
   check(business.get('environment',{}).get('official_install_then_upgrade') is True and business.get('environment',{}).get('core_default_official_plugin_source_modified') is False and bool(business.get('suites')) and all(s.get('status') in ['passed','passed_with_native_limitation'] for s in business.get('suites',[])),'已登记业务范围通过，模拟分支和原生限制保留原记录')
   check(lifecycle.get('public_installer_checks',0)>0 and lifecycle.get('real_update_recovery_rollback_checks',0)>0 and lifecycle.get('native_files_unchanged',0)>0 and lifecycle.get('preflight_seam_used') is False and lifecycle.get('https_certificate_verification') is True,'公开 HTTPS 安装、更新、中断恢复和回退已有真实验收')
   check('cra1-theme/docs/测试版与后续更新.md' in files,'测试版包含后续更新与支持范围说明')
  technical_blockers.extend(doc.get('release_blockers',[]))
  blockers.extend(doc.get('release_blockers',[]))
  blockers.extend(doc.get('commercial_blockers',[]))
  accepted=not technical_blockers if a.channel=='test' else not blockers
  result={'format':1,'release':doc['release'],'release_channel':doc.get('release_channel','candidate'),'gate_channel':a.channel,'accepted':accepted,'test_release_accepted':a.channel=='test' and accepted,'commercial_release_accepted':not blockers,'checks':checks,'release_blockers':list(dict.fromkeys(technical_blockers if a.channel=='test' else blockers)),'commercial_limitations':list(dict.fromkeys(blockers)) if a.channel=='test' else [],'production_writes':0,'package_checksums':report['packages']}
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'release':result['release'],'checks':len(checks),'channel':a.channel,'accepted':accepted,'technical_failures':technical_blockers,'commercial_release_accepted':result['commercial_release_accepted'],'result':str(output)},ensure_ascii=False))
 return 0 if accepted else 1
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as e:print('Release gate error: '+str(e),file=sys.stderr);sys.exit(2)
