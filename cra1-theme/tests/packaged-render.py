#!/usr/bin/env python3
"""Test an extracted package with only declared native asset fixtures; never opens V10 DB."""
import argparse,hashlib,json,pathlib,stat,subprocess,tempfile,zipfile
p=argparse.ArgumentParser();p.add_argument('--install',required=True,type=pathlib.Path);p.add_argument('--native',required=True,type=pathlib.Path);p.add_argument('--php',default='php');p.add_argument('--out',required=True,type=pathlib.Path);a=p.parse_args()
with tempfile.TemporaryDirectory(prefix='cra1-packaged-render-') as tmp:
 root=pathlib.Path(tmp)
 with zipfile.ZipFile(a.install) as z:
  for item in z.infolist():
   path=pathlib.PurePosixPath(item.filename)
   if path.is_absolute() or '..' in path.parts or stat.S_IFMT(item.external_attr>>16)==stat.S_IFLNK:raise RuntimeError('Unsafe fixture package')
   dest=root.joinpath(*path.parts);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(item))
 manifest=json.loads((root/'cra1-theme/release.json').read_text())
 for row in manifest['native_dependencies']:
  if not row['path'].startswith('public/') or '/default/' not in row['path']:continue
  rel=pathlib.PurePosixPath(row['path'])
  if '..' in rel.parts:raise RuntimeError('Unexpected native asset dependency')
  file=a.native.joinpath(*rel.parts);data=file.read_bytes()
  if hashlib.sha256(data).hexdigest() not in [row['observed_sha256']]+row.get('verified_sha256',[]):raise RuntimeError('Native fixture differs from recorded input: '+row['path'])
  dest=root.joinpath(*rel.parts);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 (root/'runtime/cra1_theme').mkdir(parents=True)
 (root/'runtime/cra1_theme/config.json').write_text('{}')
 script=pathlib.Path(__file__).with_suffix('.php')
 result=subprocess.run([a.php,str(script),str(root),str(a.native.resolve())],capture_output=True,text=True)
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.with_suffix('.log').write_text(result.stderr)
 if result.returncode:print(result.stdout+result.stderr);raise SystemExit(result.returncode)
 doc=json.loads(result.stdout);a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'status':doc['status'],'checks':doc['checks'],'pages':len(doc['pages']),'unique_assets':doc['unique_assets'],'production_writes':0}))
