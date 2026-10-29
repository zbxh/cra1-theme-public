#!/usr/bin/env python3
"""Exercise updates and recovery as the site's PHP account with read-only helpers."""
import argparse
import json
import os
from pathlib import Path
import pwd
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--php', default='php')
args = parser.parse_args()
source = Path(__file__).resolve().parents[2]
account = pwd.getpwnam('www') if os.geteuid() == 0 else pwd.getpwuid(os.geteuid())
prefix = ['runuser', '-u', account.pw_name, '--'] if os.geteuid() == 0 else []
with tempfile.TemporaryDirectory(prefix='cra1-updater-permissions-') as temporary:
    base = Path(temporary)
    base.chmod(0o755)
    site = base / 'site'
    shutil.copytree(source / 'cra1-theme/backend', site / 'cra1-theme/backend', ignore=shutil.ignore_patterns('releases'))
    for name in ['runtime', 'public/web/cra1', 'lib', 'bin']:
        (site / name).mkdir(parents=True, exist_ok=True)
    for directory, _, files in os.walk(site):
        Path(directory).chmod(0o755)
        for name in files:
            (Path(directory) / name).chmod(0o644)
    for name in ['runtime', 'public/web/cra1']:
        os.chown(site / name, account.pw_uid, account.pw_gid)
    script = base / 'exercise.php'
    script.write_text(r'''<?php
require $argv[1].'/cra1-theme/backend/bootstrap.php';
use CRA1\Theme\Release\Updater;
use CRA1\Theme\Files;
$site=$argv[1];$temp=$site.'/runtime';$checks=[];
function check($value,$label){if(!$value)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
function archive($name,$files){
 $rows=[];foreach($files as$p=>$b)$rows[$p]=['sha256'=>hash('sha256',$b),'bytes'=>strlen($b)];
 $doc=['format'=>1,'product'=>'cra1-theme','release'=>'fixture-permissions-v1','files'=>$rows,'verified_combinations'=>[['system'=>'10.7.4','modules'=>[],'evidence'=>'isolated permission fixture']],'release_blockers'=>[]];
 $zip=new ZipArchive();$zip->open($name,ZipArchive::CREATE|ZipArchive::OVERWRITE);$zip->addFromString('manifest.json',json_encode($doc));foreach($files as$p=>$b)$zip->addFromString('payload/'.$p,$b);$zip->close();return hash_file('sha256',$name);
}
$context=static function(){return ['database'=>true,'system_version'=>'10.7.4','modules'=>[]];};
$updater=new Updater($site,'cra1admin',$context);
$helper='lib/cra1_theme_media.php';$command='bin/cra1-theme-media.php';
$files=[$helper=>'stable-helper',$command=>'stable-command','public/web/cra1/page.js'=>'after'];
$archive=$temp.'/update.zip';$hash=archive($archive,$files);
$inode=fileinode($site.'/'.$helper);$mode=fileperms($site.'/lib')&0777;
check(!is_writable($site.'/lib')&&!is_writable($site.'/bin'),'PHP cannot write original V10 helper directories');
$inspection=CRA1\Theme\Release\Inspector::inspect($site,['https'=>true,'context'=>$context()]);
check(!array_filter($inspection['checks'],static function($row){return $row['id']==='writable:public';}),'read-only public root is not falsely reported as an ordinary-theme compatibility blocker');
$check=$updater->preflight($archive);check($check['can_apply'],'unchanged helper directories do not block actual UI changes');
check(count(array_filter($check['files'],static function($r){return $r['status']==='一致';}))===2,'unchanged files retain accurate comparison status');
$result=$updater->apply($archive,$hash);
check(file_get_contents($site.'/public/web/cra1/page.js')==='after','update succeeds as the unprivileged PHP account');
$history=$temp.'/cra1_theme/distribution/history/'.$result['history'];
$journal=Files::json($history.'/journal.json');
check(!isset($journal['files'][$helper])&&!isset($journal['files'][$command]),'unchanged helpers excluded from transaction journal');
check(!file_exists($history.'/files/'.$helper),'unchanged helpers are not backed up or replaced');
check(fileinode($site.'/'.$helper)===$inode,'helper file identity retained');
$updater->rollback($result['history']);
check(file_get_contents($site.'/public/web/cra1/page.js')==='before','rollback succeeds without access to helper directories');
check(fileinode($site.'/'.$helper)===$inode&&(fileperms($site.'/lib')&0777)===$mode,'rollback preserves helper ownership and permissions');
// Even a writable helper cannot be atomically replaced in a read-only parent.
$files[$helper]='changed-helper';$files[$command]='changed-command';$hash=archive($archive,$files);
$check=$updater->preflight($archive);
check(!$check['can_apply'],'actually changed read-only helpers still stop before any update');
check(count($check['blockers'])===1&&strpos($check['blockers'][0],'lib/')!==false&&strpos($check['blockers'][0],'bin/')!==false,'permission failures are grouped with actionable relative directories');
check(strpos($check['blockers'][0],$site)===false,'permission explanation omits the absolute server path');
check(!is_file($temp.'/cra1_theme/distribution/pending.json'),'blocked preflight creates no update transaction');
try{$updater->apply($archive,$hash);check(false,'blocked apply must fail');}catch(RuntimeException $error){check(true,'server rejects blocked apply independently of the browser');}
check(file_get_contents($site.'/public/web/cra1/page.js')==='before','blocked apply leaves installed files intact');
$files[$helper]='stable-helper';$files[$command]='stable-command';$hash=archive($archive,$files);
$fail=new Updater($site,'cra1admin',$context,static function($p,$b,$m){Files::atomic($p,$b,$m);throw new RuntimeException('isolated write interruption');});
try{$fail->apply($archive,$hash);check(false,'interrupted apply must fail');}catch(RuntimeException $error){check(strpos($error->getMessage(),'已恢复')!==false,'failed update automatically recovers with read-only unchanged helpers');}
check(file_get_contents($site.'/public/web/cra1/page.js')==='before'&&!is_file($temp.'/cra1_theme/distribution/pending.json'),'failed update restores original content and clears pending state');
// Legacy journals included unchanged helpers; recovering them must not write.
$legacy=['release'=>'legacy-permissions','entry'=>'cra1admin','previous'=>[],'created_at'=>time(),'state'=>'prepared','backup'=>$temp.'/cra1_theme/distribution/history/legacy-permissions','files'=>[$helper=>['before'=>hash('sha256','stable-helper'),'after'=>hash('sha256','stable-helper'),'mode'=>0644],'public/web/cra1/page.js'=>['before'=>hash('sha256','before'),'after'=>hash('sha256','half'),'mode'=>0644]]];
Files::atomic($legacy['backup'].'/files/public/web/cra1/page.js','before',0600);Files::atomic($site.'/public/web/cra1/page.js','half');Files::putJson($temp.'/cra1_theme/distribution/pending.json',$legacy);
$updater->recover();check(file_get_contents($site.'/public/web/cra1/page.js')==='before','older journals recover without rewriting unchanged files');
check(fileinode($site.'/'.$helper)===$inode,'legacy recovery also preserves original helper identity');
$result=$updater->apply($archive,$hash);$again=$updater->apply($archive,$hash);
check($again['files']===0,'re-uploading identical contents does not produce file writes');
$updater->rollback($again['history']);check(file_get_contents($site.'/public/web/cra1/page.js')==='after','repeat-upload rollback preserves the actual preceding version');
$updater->rollback($result['history']);check(file_get_contents($site.'/public/web/cra1/page.js')==='before','the preceding real update remains recoverable');
check(file_get_contents($site.'/runtime/keep.json')==='private-preserved','configuration remains unchanged through update, failure and rollback');
echo json_encode(['status'=>'passed','checks'=>count($checks),'results'=>$checks,'production_writes'=>0],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
''')
    (site / 'lib/cra1_theme_media.php').write_text('stable-helper')
    (site / 'bin/cra1-theme-media.php').write_text('stable-command')
    # File write permission alone does not permit an atomic replacement.
    (site / 'lib/cra1_theme_media.php').chmod(0o666)
    (site / 'public/web/cra1/page.js').write_text('before')
    os.chown(site / 'public/web/cra1/page.js', account.pw_uid, account.pw_gid)
    (site / 'runtime/keep.json').write_text('private-preserved')
    result = subprocess.run([*prefix, args.php, str(script), str(site)], text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    report = json.loads(result.stdout)
    report['php_user'] = account.pw_name
    print(json.dumps(report, ensure_ascii=False))
