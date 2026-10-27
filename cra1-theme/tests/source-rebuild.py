#!/usr/bin/env python3
"""Rebuild a locally generated source candidate without using the original site's dependencies."""
import argparse,hashlib,json,os,pathlib,shutil,stat,subprocess,tempfile,zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--source',required=True,type=pathlib.Path)
parser.add_argument('--reference',required=True,type=pathlib.Path)
parser.add_argument('--out',required=True,type=pathlib.Path)
parser.add_argument('--node',default='node')
parser.add_argument('--candidates',type=pathlib.Path)
args=parser.parse_args()
live=pathlib.Path(__file__).resolve().parents[2]
out=args.out.resolve()
if out.exists() or out==live or live in out.parents:parser.error('Use a new output directory outside the source site')
out.mkdir(parents=True)
node=shutil.which(args.node)
if not node:parser.error('Node is unavailable')
env={**os.environ,'PATH':str(pathlib.Path(node).parent)+os.pathsep+os.environ.get('PATH','')}
def run(command,cwd,name,extra=None):
 with (out/(name+'.log')).open('w') as log:
  result=subprocess.run(command,cwd=cwd,env={**env,**(extra or {})},stdout=log,stderr=subprocess.STDOUT)
 if result.returncode:raise RuntimeError(name+' failed; inspect '+str(out/(name+'.log')))
def hashes(root):
 return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file()}
with tempfile.TemporaryDirectory(prefix='cra1-source-rebuild-') as tmp:
 root=pathlib.Path(tmp)/'source';root.mkdir()
 with zipfile.ZipFile(args.source) as archive:
  items=archive.infolist()
  if len(items)>20000 or sum(i.file_size for i in items)>500*1024*1024:raise RuntimeError('Source candidate exceeds fixture limits')
  for item in items:
   p=pathlib.PurePosixPath(item.filename)
   if p.is_absolute() or '..' in p.parts or '\\' in item.filename or stat.S_IFMT(item.external_attr>>16)==stat.S_IFLNK:raise RuntimeError('Unsafe source candidate path')
   target=root.joinpath(*p.parts)
   if item.is_dir():target.mkdir(parents=True,exist_ok=True)
   else:target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.read(item))
 for name,rel in [('member','cra1-theme/source/member'),('admin','cra1-theme/source/admin'),('shared','public/cra1-shared'),('website','public/web/cra1/src')]:
  run(['npm','ci','--ignore-scripts','--no-audit','--no-fund'],root/rel,'npm-'+name)
 metadata=json.loads((args.reference/'release.json').read_text())
 stage=out/'rebuilt'
 run([node,'cra1-theme/scripts/build.mjs'],root,'build',{'CRA1_RELEASE_STAGE':str(stage),'CRA1_RELEASE_ID':metadata['release'],'CRA1_RELEASE_CHANNEL':metadata.get('release_channel','candidate')})
 old=hashes(args.reference);new=hashes(stage)
 changed=sorted(k for k in old.keys()&new.keys() if old[k]!=new[k])
 result={'passed':old==new,'release':metadata['release'],'reference_files':len(old),'rebuilt_files':len(new),'changed':changed,'added':sorted(new.keys()-old.keys()),'removed':sorted(old.keys()-new.keys()),'source_sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'original_node_modules_used':False,'production_writes':0}
 if args.candidates:
  packages=out/'packages'
  run(['python3','cra1-theme/scripts/package.py','--stage',str(stage),'--out',str(packages)],root,'package')
  expected=json.loads((args.candidates/'candidate-report.json').read_text())
  actual=json.loads((packages/'candidate-report.json').read_text())
  result['package_checksums_match']=expected['packages']==actual['packages']
  result['passed']=result['passed'] and result['package_checksums_match']
  result['delivery_checksums_match']=expected.get('delivery')==actual.get('delivery')
  result['passed']=result['passed'] and result['delivery_checksums_match']
 (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(result,ensure_ascii=False))
 if not result['passed']:raise SystemExit(1)
