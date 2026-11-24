<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Release\CustomerData;
use CRA1\Theme\Release\Management;
$checks=0;$roles=[];
function check($ok,$label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function theme_actor(){return ['id'=>1];}
function theme_require_role($roles){$GLOBALS['roles'][]=$roles;}
$GLOBALS['ROOT']=sys_get_temp_dir().'/cra1-no-output-'.bin2hex(random_bytes(4));
$GLOBALS['SLUG']='cra1admin';
$old=['sha256'=>str_repeat('a',64),'bytes'=>100,'release_channel'=>'test',
 'manifest'=>['release'=>'fixture-history-v1','license'=>['text'=>'private fixture'],'commercial_blockers'=>['internal fixture']],
 'commercial_blockers'=>['internal fixture'],'commercial_release_accepted'=>false,
 'files'=>[['path'=>'cra1-theme/LICENSE.txt','status'=>'阻断'],['path'=>'cra1-theme/docs/商业授权.md','status'=>'阻断'],
     ['path'=>'public/web/cra1/index.html','status'=>'阻断'],['path'=>'public/web/cra1/about.html','status'=>'新增']],
 'native_dependencies'=>[['path'=>'route/home.php','detail'=>'internal baseline']], 'signature'=>'internal digest note',
 'blockers'=>['native contract mismatch'],'can_apply'=>false,'candidate'=>'fixture-id','credential'=>['subject'=>'private fixture']];
$view=CustomerData::candidate($old);
check($view['blockers']===['native contract mismatch']&&!$view['can_apply'],'technical blockers are preserved');
check($view['release']==='fixture-history-v1'&&$view['sha256']===$old['sha256']&&$view['candidate']==='fixture-id','update identity remains usable');
check(count($view['files'])===1&&$view['files'][0]['path']==='public/web/cra1/index.html','only blocked runtime files are returned for older admin clients');
check(!isset($view['native_dependencies'])&&!isset($view['signature']),'candidate API omits native rows and internal digest notes');
check(strpos(json_encode($view),'commercial')===false&&strpos(json_encode($view),'private fixture')===false&&!isset($view['manifest']),'candidate API never forwards old package metadata');
$current=CustomerData::current(['release'=>'fixture-history-v1','history'=>'history-id','installed_at'=>123,'previous_release'=>'fixture-old-v1','manifest'=>$old['manifest'],'archive_sha256'=>'private fixture']);
check($current===['release'=>'fixture-history-v1','history'=>'history-id','installed_at'=>123,'previous_release'=>'fixture-old-v1'],'history projects only version and rollback information');
$named=$old;$named['manifest']['version']='v17.1';$named['manifest']['release_channel']='test';
check(CustomerData::candidate($named)['version']==='v17.1','candidate exposes assigned public version without forwarding its manifest');
$namedCurrent=CustomerData::current(['release'=>'fixture-history-v1','manifest'=>$named['manifest']]);
check($namedCurrent===['release'=>'fixture-history-v1','version'=>'v17.1','release_channel'=>'test'],'history separates assigned version, test channel and resource ID');
$inspection=CustomerData::inspection(['context'=>['system_version'=>'10.7.4','settings'=>['private'=>'fixture']], 'checks'=>[
 ['id'=>'compatibility','status'=>'unverified'], ['id'=>'dependency:route/home.php','status'=>'blocked'],
 ['id'=>'database','status'=>'blocked'], ['id'=>'file:public/web/cra1/index.html','status'=>'unverified'],
]]);
check(array_column($inspection['checks'],'id')===['database','file:public/web/cra1/index.html'],'inspection keeps actionable rows and removes native baseline inventory');
check($inspection['counts']===['pass'=>0,'warning'=>0,'blocked'=>1,'unverified'=>1],'inspection counts only displayable checks');
check($inspection['context']===['system_version'=>'10.7.4','php_version'=>PHP_VERSION],'inspection exposes only runtime versions');
foreach(['license.get','license.save']as$action){
 $rejected=false;
 try{Management::run($action,['credential'=>['private'=>'fixture']]);}catch(InvalidArgumentException $e){$rejected=$e->getMessage()==='未知主题管理操作';}
 check($rejected,'removed customer action is rejected: '.$action);
}
check(!is_dir($GLOBALS['ROOT']),'removed actions cannot create credential files');
check($roles===[['super_admin'],['super_admin']],'removed action attempts do not bypass role checks');
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
