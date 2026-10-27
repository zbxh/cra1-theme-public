#!/usr/bin/env python3
"""Record package lineage and isolated file baselines; never asserts official provenance."""
import argparse,datetime,hashlib,json,pathlib,sys,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1048576),b''):h.update(block)
 return h.hexdigest()
def main():
 p=argparse.ArgumentParser();sub=p.add_subparsers(dest='action',required=True)
 pkg=sub.add_parser('package');pkg.add_argument('--archive',required=True,type=pathlib.Path);pkg.add_argument('--version',required=True);pkg.add_argument('--kind',required=True,choices=['system-install','system-upgrade','module-install','module-upgrade']);pkg.add_argument('--source',required=True);pkg.add_argument('--out',required=True,type=pathlib.Path)
 snap=sub.add_parser('snapshot');snap.add_argument('--root',required=True,type=pathlib.Path);snap.add_argument('--isolation-id',required=True);snap.add_argument('--phase',required=True,choices=['official-install','official-upgrade','before-theme-install','after-theme-install','before-theme-update','after-theme-update','after-theme-rollback','before-module-upgrade','after-module-upgrade']);snap.add_argument('--out',required=True,type=pathlib.Path)
 diff=sub.add_parser('compare');diff.add_argument('--before',required=True,type=pathlib.Path);diff.add_argument('--after',required=True,type=pathlib.Path);diff.add_argument('--out',required=True,type=pathlib.Path)
 a=p.parse_args();out=a.out.resolve()
 if out.exists() or ROOT==out or ROOT in out.parents:p.error('Use a new evidence file outside the live site')
 record={'format':1,'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'official_source_verified':False,'support_claim_created':False}
 if a.action=='package':
  archive=a.archive.resolve()
  with zipfile.ZipFile(archive) as z:count=len(z.infolist());valid=z.testzip() is None
  record.update(kind=a.kind,version=a.version,source=a.source,sha256=digest(archive),bytes=archive.stat().st_size,zip_files=count,zip_integrity=valid)
 elif a.action=='snapshot':
  site=a.root.resolve()
  if site==ROOT or ROOT in site.parents or not (site/'public').is_dir():p.error('Only an isolated site root may be recorded')
  files={}
  for rel in ['app','route','vendor','public/clientarea/template/pc/default','public/clientarea/template/mobile/default','public/cart/template/pc/default','public/cart/template/mobile/default','public/home/template/pc/default','public/home/template/mobile/default','public/plugins']:
   folder=site/rel
   if not folder.exists():continue
   if folder.is_symlink():p.error('A clean baseline cannot point back to another site: '+rel)
   for f in sorted(folder.rglob('*')):
    if f.is_symlink():p.error('Resolve native package links before baseline capture: '+str(f.relative_to(site)))
    if f.is_file():files[f.relative_to(site).as_posix()]=digest(f)
  record.update(kind='isolated-files',phase=a.phase,isolation_id=a.isolation_id,root_hash=hashlib.sha256(str(site).encode()).hexdigest(),files=files,file_count=len(files))
 else:
  before=json.loads(a.before.read_text());after=json.loads(a.after.read_text())
  if before.get('isolation_id')!=after.get('isolation_id') or before.get('root_hash')!=after.get('root_hash'):p.error('Cannot compare unrelated isolated installations')
  old=before['files'];new=after['files'];changed=sorted(k for k in old.keys()&new.keys() if old[k]!=new[k]);added=sorted(new.keys()-old.keys());removed=sorted(old.keys()-new.keys())
  record.update(kind='isolated-comparison',before_sha256=digest(a.before),after_sha256=digest(a.after),before_phase=before['phase'],after_phase=after['phase'],changed=changed,added=added,removed=removed,unchanged=not(changed or added or removed))
 out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'record':str(out),'sha256':digest(out),'official_source_verified':False}))
if __name__=='__main__':main()
