#!/usr/bin/env python3
"""Exercise the packaged backend, sessions, role checks and interrupted recovery over HTTP."""
import argparse,hashlib,http.cookiejar,json,pathlib,re,socket,subprocess,tempfile,time,urllib.error,urllib.request,zipfile
parser=argparse.ArgumentParser();parser.add_argument('--install',required=True,type=pathlib.Path);parser.add_argument('--php',default='php');parser.add_argument('--out',required=True,type=pathlib.Path);args=parser.parse_args()
checks=[]
def check(ok,label):
 if not ok:raise AssertionError(label)
 checks.append(label)
with tempfile.TemporaryDirectory(prefix='cra1-release-http-') as tmp:
 root=pathlib.Path(tmp);public=root/'public'
 with zipfile.ZipFile(args.install) as z:
  for item in z.infolist():
   p=pathlib.PurePosixPath(item.filename)
   if p.is_absolute() or '..' in p.parts or item.is_dir():raise RuntimeError('Invalid test package')
   dest=root.joinpath(*p.parts);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(z.read(item))
 (root/'config.php').write_text('<?php // Isolated fixture: no system database connection.\n')
 (public/'cra1admin').rename(public/'testadmin')
 sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();origin='http://127.0.0.1:'+str(port);base=origin+'/testadmin/index.php'
 php_code='require $argv[1]."/lib/cra1_theme_security.php"; CRA1ThemeSecurity::install($argv[1],"fixture-root",CRA1ThemeSecurity::password("Fixture-release-only-2026!"),["canonical_url"=>$argv[2],"http_test"=>true,"force_https"=>false]);$s=new CRA1ThemeSecurity($argv[1]);foreach(["fixture-manager"=>"admin","fixture-worker"=>"operator"]as$n=>$r)$s->createAccount($s->account(1),["username"=>$n,"password"=>"Fixture-release-only-2026!","role"=>$r]);$s->db->exec("UPDATE accounts SET must_change=0");'
 subprocess.run([args.php,'-r',php_code,str(root),origin],check=True,capture_output=True)
 runtime=root/'runtime/cra1_theme';(runtime/'entry.json').write_text('{"entry":"testadmin"}')
 for file in ['config.json','member_center.json','cart_theme.json']:(runtime/file).write_text('{}')
 # Real public helpers are included while an update marker exists: the admin must still boot.
 (public/'fixture-runtime.php').write_text('<?php require __DIR__."/cra1-shared/runtime.php";echo "dependency-ready";')
 (public/'fixture-page.php').write_text('<?php require __DIR__."/cra1-shared/assets.php";echo cra1_theme_asset_url("shared","cra1-shared.js");')
 # Fixture-only endpoint to model a retained older backend session without exposing any secret values.
 (public/'testadmin'/'fixture-session.php').write_text('''<?php
session_name('CRA1THEMEID');session_start();
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
 $_SESSION['cloud_admin']=$_SESSION['cra1_admin'];$_SESSION['cloud_csrf']=$_SESSION['cra1_csrf'];
 unset($_SESSION['cra1_admin'],$_SESSION['cra1_csrf']);
}
header('Content-Type: application/json');
echo json_encode(['new_admin'=>isset($_SESSION['cra1_admin']),'new_csrf'=>isset($_SESSION['cra1_csrf']),'old_admin'=>isset($_SESSION['cloud_admin']),'old_csrf'=>isset($_SESSION['cloud_csrf'])]);
''')
 log=open(root/'php-server.log','w+');proc=subprocess.Popen([args.php,'-S','127.0.0.1:'+str(port),'-t',str(public)],stdout=log,stderr=log)
 def opener():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def request(client,url,body=None,headers=None):
  data=None if body is None else json.dumps(body).encode();h={'Origin':origin,'Content-Type':'application/json'};h.update(headers or {})
  try:r=client.open(urllib.request.Request(url,data=data,headers=h),timeout=25)
  except urllib.error.HTTPError as e:r=e
  return r.code,r.read().decode(),dict(r.headers)
 def api(client,csrf,action,body=None):
  status,text,_=request(client,base+'?r=api.'+action,body or {},{'X-CSRF-Token':csrf})
  try:return json.loads(text)
  except json.JSONDecodeError:raise AssertionError('Invalid API response '+action+' HTTP '+str(status)+': '+text[:120])
 def login(name):
  c=opener();status,text,_=request(c,base+'?r=login');check(status==200,'login loads '+name)
  boot=json.loads(re.search(r'window.__THEME_AUTH__=(.*?);',text)[1]);reply=api(c,boot['csrf'],'auth.login',{'username':name,'password':'Fixture-release-only-2026!'})
  check(reply['status']==200,'native theme session '+name);return c,reply['data']['csrf']
 try:
  for _ in range(80):
   try:
    if request(opener(),base+'?r=login')[0]==200:break
   except OSError:time.sleep(.1)
  else:raise RuntimeError('Isolated PHP server not ready')
  s,csrf=login('fixture-root');manager,mcsrf=login('fixture-manager');worker,wcsrf=login('fixture-worker')
  catalog=api(s,csrf,'member.content.catalog');check(catalog['status']==200 and all(key in catalog['data']['catalog'] for key in ['news','announcement','help']),'content catalogue handles the real admin route without obsolete notification methods')
  keys=json.loads(request(s,origin+'/testadmin/fixture-session.php')[1]);check(keys['new_admin'] and keys['new_csrf'] and not keys['old_admin'] and not keys['old_csrf'],'new logins write only CRA1 session keys')
  request(s,origin+'/testadmin/fixture-session.php',{})
  check(api(s,csrf,'release.history')['status']==200,'a retained legacy session keeps its login and CSRF after key migration')
  keys=json.loads(request(s,origin+'/testadmin/fixture-session.php')[1]);check(keys['new_admin'] and keys['new_csrf'] and not keys['old_admin'] and not keys['old_csrf'],'legacy session keys are removed after migration')
  check(api(opener(),'invalid','release.history')['status']==401,'anonymous release history denied')
  check(api(s,'invalid','release.history')['status']==403,'release API requires CSRF')
  reply=api(manager,mcsrf,'release.check');check(reply['status']==200 and reply['data']['read_only'],'manager compatibility check is read-only')
  baseline={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in runtime.glob('*.json')}
  api(s,csrf,'release.check');check(baseline=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in runtime.glob('*.json')},'compatibility check does not change config, snapshots or JSON records')
  check(api(worker,wcsrf,'release.history')['status']==403,'operator cannot read distribution details')
  for action in ['upload','apply','rollback','recover','license.save']:
   check(api(manager,mcsrf,'release.'+action)['status']==403,'non-superadmin denied '+action)
  check(api(s,csrf,'release.apply',{'candidate':'0'*32})['code']=='REAUTH_REQUIRED','superadmin applying update requires scoped reauthentication')
  # Keep a real prepared recovery journal, and partially changed theme file.
  dist=runtime/'distribution';backup=dist/'history'/'fixture-interrupted';path='public/web/cra1/fixture-state.txt';before='before interruption';after='half applied'
  saved=backup/'files'/path;saved.parent.mkdir(parents=True,exist_ok=True);saved.write_text(before)
  target=root/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(after)
  journal={'release':'fixture-interrupted','entry':'testadmin','previous':{},'created_at':int(time.time()),'state':'prepared','backup':str(backup),'files':{path:{'before':hashlib.sha256(before.encode()).hexdigest(),'after':hashlib.sha256(after.encode()).hexdigest(),'mode':420}}}
  (dist/'pending.json').write_text(json.dumps(journal))
  status,text,_=request(opener(),origin+'/fixture-runtime.php');check(status==200 and text=='dependency-ready','shared runtime include does not block the recovery admin')
  check(request(opener(),origin+'/fixture-page.php')[0]==503,'frontend page paused during update')
  check(request(opener(),origin+'/cra1-shared/snapshot.php?domain=member')[0]==503,'snapshot paused during update')
  fresh,fcsrf=login('fixture-root');check(api(fresh,fcsrf,'release.history')['data']['interrupted'],'admin can login and inspect an interrupted update')
  check(api(fresh,fcsrf,'workspace.editor.save',{})['code']=='THEME_UPDATE_PENDING','ordinary writes denied while update is pending')
  challenge=api(fresh,fcsrf,'auth.reauth',{'password':'Fixture-release-only-2026!','action':'release.recover','target':'website:all'})
  check(challenge['status']==200,'recovery reauthentication available while pending')
  cap=challenge['data']['credential'];reply=api(fresh,fcsrf,'release.recover',{'_reauth':cap})
  check(reply['status']==200 and reply['data']['restored'] and target.read_text()==before,'authenticated HTTP recovery restores partial file')
  check(not (dist/'pending.json').exists(),'HTTP recovery clears marker after restoration')
  check(api(fresh,fcsrf,'release.recover',{'_reauth':cap})['code']=='REAUTH_REQUIRED','recovery proof cannot be replayed')
  check(request(opener(),origin+'/fixture-page.php')[0]==200,'frontend resources available after recovery')
  # Never persist a real system token or customer record in this fixture.
  result={'status':'passed','checks':len(checks),'results':checks,'production_writes':0,'fixture':'packaged backend, fresh SQLite accounts; no V10 DB'}
  args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='results'}))
 except Exception:
  log.flush();log.seek(0);print(log.read()[-10000:]);raise
 finally:
  proc.terminate()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
  log.close()
