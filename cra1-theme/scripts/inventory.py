#!/usr/bin/env python3
"""Reproducible third-party metadata inventory. Reads lockfiles; never infers asset rights."""
import hashlib,json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[2]
rows=[];missing=[]
upstream=json.loads((root/'cra1-theme/licenses/upstream-license-sources.json').read_text()).get('sources',[])
for base in ['cra1-theme/source/member','cra1-theme/source/admin','public/cra1-shared','public/web/cra1/src']:
 lock=json.loads((root/base/'package-lock.json').read_text())
 for rel,doc in sorted(lock.get('packages',{}).items()):
  if not rel:continue
  name=doc.get('name') or rel.split('node_modules/')[-1]
  folder=root/base/rel
  files=[]
  for f in sorted(folder.rglob('*')) if folder.exists() else []:
   if f.is_file() and 'node_modules' not in f.relative_to(folder).parts and re.match(r'^(?:licen[sc]e|copying|copyright|notice)(?:[._-].*)?$',f.name,re.I):
    b=f.read_bytes();sha=hashlib.sha256(b).hexdigest();safe=re.sub('[^A-Za-z0-9_.-]+','-',name)
    suffix=re.sub('[^A-Za-z0-9_.-]+','-',f.relative_to(folder).as_posix())
    dest=root/f'cra1-theme/licenses/dependencies/{safe}-{doc.get("version","unknown")}-{suffix}.txt'
    dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists() and dest.read_bytes()!=b:raise RuntimeError('Conflicting license text '+str(dest))
    dest.write_bytes(b);files.append({'path':str(dest.relative_to(root)),'sha256':sha,'source':str(f.relative_to(root))})
  row={'project':base,'package':name,'version':doc.get('version'),'license':doc.get('license','UNVERIFIED'),'integrity':doc.get('integrity',''),'development':bool(doc.get('dev')),'license_texts':files}
  for source in upstream:
   if source['package']!=name or source['version']!=doc.get('version') or source['declared_license']!=doc.get('license'):continue
   metadata=json.loads((folder/'package.json').read_text());repository=metadata.get('repository','')
   if isinstance(repository,dict):repository=repository.get('url','')
   if repository!=source['repository']:raise RuntimeError('Upstream license repository mismatch: '+name)
   f=root/source['path'];b=f.read_bytes()
   if hashlib.sha256(b).hexdigest()!=source['sha256']:raise RuntimeError('Upstream license content changed: '+name)
   files.append({'path':source['path'],'sha256':source['sha256'],'source':source['upstream_license_api'],'upstream_blob_sha':source['upstream_blob_sha'],'scope':source['scope']})
  rows.append(row)
  if not files:missing.append({'package':name,'version':doc.get('version'),'project':base})
out={'format':1,'dependencies':rows,'missing_license_text':missing,'asset_rights':'Not covered by dependency licenses; see asset-inventory.json in candidate.'}
p=root/'cra1-theme/licenses/dependency-inventory.json';p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'dependencies':len(rows),'missing_license_text':len(missing),'inventory':str(p)}))
