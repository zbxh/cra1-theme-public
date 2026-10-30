<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\Inspector;
$base=sys_get_temp_dir().'/cra1-installation-gates-'.bin2hex(random_bytes(6));$checks=0;
function check($ok,$message){if(!$ok)throw new RuntimeException($message);$GLOBALS['checks']++;}
function cleanup($path){if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')cleanup($path.'/'.$name);rmdir($path);}
try{
 Files::atomic($base.'/app/native.php','official fixture');
 Files::atomic($base.'/public/web/cra1/page.php','theme fixture');
 Files::putJson($base.'/runtime/cra1_theme/private-path-check.json',['passed'=>true,'root_hash'=>hash('sha256',realpath($base)),'checked_at'=>time(),'origin'=>'https://fixture.invalid']);
 $release=['release'=>'fixture-installation-v1','verified_combinations'=>[],
  'installation_combinations'=>[['system'=>'10.7.4','modules'=>[],'evidence'=>['scope'=>'native-runtime-baseline','official_upgrade'=>true,'record_sha256'=>hash('sha256','isolated official evidence')]]],
  'release_blockers'=>[],'commercial_blockers'=>['redistribution evidence pending'],
  'files'=>['public/web/cra1/page.php'=>['sha256'=>hash('sha256','theme fixture'),'bytes'=>13]],
  'native_dependencies'=>[['path'=>'app/native.php','verified_sha256'=>[hash('sha256','official fixture')]]]];
 Files::putJson($base.'/cra1-theme/release.json',$release);
 $options=['https'=>true,'origin'=>'https://fixture.invalid','context'=>['database'=>true,'system_version'=>'10.7.4','modules'=>[],'database_sql_mode'=>'STRICT_TRANS_TABLES']];
 $inspect=Inspector::inspect($base,$options);
 check($inspect['installation_ready']&&$inspect['installation_counts']['blocked']===0,'matching runtime and original byte checks allow installation acceptance');
 check($inspect['compatible']&&$inspect['counts']['blocked']===0,'customer compatibility reflects technical requirements only');
 check(strpos(json_encode($inspect),'commercial')===false&&!isset($inspect['license']),'customer check does not expose repository-only records');
 $testRelease=$release;$testRelease['release_channel']='test';Files::putJson($base.'/cra1-theme/release.json',$testRelease);
 $testInspect=Inspector::inspect($base,$options);
 check($testInspect['release_channel']==='test'&&$testInspect['installation_ready']&&$testInspect['compatible'],'test channel separates install readiness from complete commercial support');
 Files::putJson($base.'/cra1-theme/release.json',$release);
 $unknown=$options;$unknown['context']['system_version']='10.7.5';check(!Inspector::inspect($base,$unknown)['installation_ready'],'unknown runtime cannot install');
 $insecure=$options;$insecure['https']=false;check(!Inspector::inspect($base,$insecure)['installation_ready'],'HTTPS remains mandatory');
 $badOrigin=$options;$badOrigin['origin']='https://different.invalid';$diagnostic=Inspector::inspect($base,$badOrigin);check($diagnostic['installation_ready']&&$diagnostic['counts']['warning']===1,'private-path proof cannot transfer across origins and remains an optional diagnostic');
 Files::atomic($base.'/app/native.php','changed');check(!Inspector::inspect($base,$options)['installation_ready'],'same version with unverified native bytes cannot install');
 unlink($base.'/app/native.php');check(!Inspector::inspect($base,$options)['installation_ready'],'missing native dependency blocks installation');
 Files::atomic($base.'/app/native.php','official fixture');
 $hard=$release;$hard['release_blockers']=['unsafe technical condition'];Files::putJson($base.'/cra1-theme/release.json',$hard);check(!Inspector::inspect($base,$options)['installation_ready'],'legacy hard package gates still block installation');
 Files::putJson($base.'/cra1-theme/release.json',$release);
 $sqlMode=$options;$sqlMode['context']['database_sql_mode']='ONLY_FULL_GROUP_BY';check(!Inspector::inspect($base,$sqlMode)['installation_ready'],'native SQL environment remains checked');
 Files::putJson($base.'/runtime/cra1_theme/private-path-check.json',['passed'=>true,'root_hash'=>hash('sha256',realpath($base)),'checked_at'=>time()-86401,'origin'=>'https://fixture.invalid']);check(Inspector::inspect($base,$options)['installation_ready'],'an expired network diagnostic does not invalidate otherwise compatible files');
 Files::putJson($base.'/runtime/cra1_theme/private-path-check.json',['format'=>2,'outcome'=>'exposed','passed'=>false,'root_hash'=>hash('sha256',realpath($base)),'checked_at'=>time(),'origin'=>'https://fixture.invalid']);check(!Inspector::inspect($base,$options)['installation_ready'],'a confirmed private-file leak remains actionable in detailed compatibility');
 echo json_encode(['status'=>'passed','checks'=>$checks,'commercial_release_accepted'=>false,'production_writes'=>0]).PHP_EOL;
}finally{cleanup($base);}
