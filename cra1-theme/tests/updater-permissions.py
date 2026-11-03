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
import time

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
// Dependency destinations are not archive members. Check the actual derived
// write plan using candidate hashes, rather than the currently installed source.
$reference='public/cart/template/pc/cra1/js/native.js';$source='public/cart/template/pc/default/js/native.js';
Files::putJson(CRA1\Theme\Release\References::copyRegistry($site),['files'=>[$reference=>hash('sha256','old native')]]);
$zip=new ZipArchive();$zip->open($archive);$doc=json_decode($zip->getFromName('manifest.json'),true);$zip->close();
$candidate='public/cart/template/pc/cra1/new-source.js';
$doc['references']=[$reference=>$source,'public/cart/template/mobile/cra1/js/candidate.js'=>$candidate];
$files[$candidate]='candidate only source';
$doc['files'][$candidate]=['sha256'=>hash('sha256','candidate only source'),'bytes'=>strlen('candidate only source')];
$zip=new ZipArchive();$zip->open($archive,ZipArchive::CREATE|ZipArchive::OVERWRITE);$zip->addFromString('manifest.json',json_encode($doc));foreach($files as$p=>$b)$zip->addFromString('payload/'.$p,$b);$zip->close();
$check=$updater->preflight($archive);
check(!$check['can_apply'],'changed derived dependencies in read-only directories stop at preflight');
check((bool)array_filter($check['blockers'],static function($message){return strpos($message,'public/cart/template/pc/cra1/js/')!==false;}),'derived dependency error names only the actual relative directory');
check(file_get_contents($site.'/'.$candidate)==='installed source','preflight does not extract prospective dependency sources');
check(CRA1\Theme\Release\References::copyPlan($site,$doc['references'],'',$doc['files'])['public/cart/template/mobile/cra1/js/candidate.js']['after']===hash('sha256','candidate only source'),'dependency preflight reads the candidate hash instead of old source bytes');
check(file_get_contents($site.'/'.$reference)==='old native','dependency permission check never rewrites old copies');
// Cache deletion needs permission on its parent, not merely the file. Native
// template caches are unrelated to this update and must not block it.
$hash=archive($archive,['public/web/cra1/page.js'=>'after']);
$nativeCache=$site.'/runtime/temp/'.str_repeat('b',32).'.php';
check($updater->preflight($archive)['can_apply'],'a read-only cache directory containing only native templates does not block');
$cache=$site.'/runtime/temp/'.str_repeat('a',32).'.php';
$trigger=$site.'/runtime/theme-cache-trigger';Files::atomic($trigger,'ready');
while(!is_file($site.'/runtime/theme-cache-placed'))usleep(10000);
$check=$updater->preflight($archive);
check(!$check['can_apply'],'a theme cache that PHP cannot delete is reported before the update');
check((bool)array_filter($check['blockers'],static function($message){return strpos($message,'runtime/temp/')!==false;}),'theme cache failure has an actionable relative path');
check(file_get_contents($site.'/public/web/cra1/page.js')==='before','cache preflight failure leaves theme files and pointer intact');
echo json_encode(['status'=>'passed','checks'=>count($checks),'results'=>$checks,'production_writes'=>0],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
''')
    (site / 'lib/cra1_theme_media.php').write_text('stable-helper')
    (site / 'bin/cra1-theme-media.php').write_text('stable-command')
    # File write permission alone does not permit an atomic replacement.
    (site / 'lib/cra1_theme_media.php').chmod(0o666)
    (site / 'public/web/cra1/page.js').write_text('before')
    os.chown(site / 'public/web/cra1/page.js', account.pw_uid, account.pw_gid)
    (site / 'runtime/keep.json').write_text('private-preserved')
    native = site / 'public/cart/template/pc/default/js/native.js'
    native.parent.mkdir(parents=True)
    native.write_text('new native')
    reference = site / 'public/cart/template/pc/cra1/js/native.js'
    reference.parent.mkdir(parents=True)
    reference.write_text('old native')
    (site / 'public/cart/template/pc/cra1/new-source.js').write_text('installed source')
    cache_directory = site / 'runtime/temp'
    cache_directory.mkdir()
    (cache_directory / ('b' * 32 + '.php')).write_text('<?php /*' + str(site / 'public/cart/template/pc/default/page.php') + '*/ native')
    process = subprocess.Popen([*prefix, args.php, str(script), str(site)], text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    for _ in range(500):
        if (site / 'runtime/theme-cache-trigger').is_file() or process.poll() is not None:
            break
        time.sleep(0.01)
    if process.poll() is None:
        (cache_directory / ('a' * 32 + '.php')).write_text('<?php /*' + str(site / 'public/web/cra1/page.php') + '*/ theme')
        (site / 'runtime/theme-cache-placed').write_text('ready')
    stdout, stderr = process.communicate(timeout=15)
    result = subprocess.CompletedProcess(process.args, process.returncode, stdout, stderr)
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    report = json.loads(result.stdout)
    report['php_user'] = account.pw_name
    print(json.dumps(report, ensure_ascii=False))
