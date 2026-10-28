<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\Installer;
use CRA1\Theme\Release\Inspector;
use CRA1\Theme\Release\InstallationEnvironment;

$base=sys_get_temp_dir().'/cra1-install-environment-'.bin2hex(random_bytes(6));$checks=0;
function check($ok,$message){if(!$ok)throw new RuntimeException($message);$GLOBALS['checks']++;}
function cleanup($path){if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')cleanup($path.'/'.$name);rmdir($path);}
function proof($base,$extra=[]){Files::putJson($base.'/runtime/cra1_theme/private-path-check.json',array_replace(['passed'=>true,'root_hash'=>hash('sha256',realpath($base)),'checked_at'=>time(),'origin'=>'https://fixture.invalid'],$extra));}
try {
 Files::atomic($base.'/public/cra1-install/index.php','fixture');
 Files::atomic($base.'/app/common/model/HostModel.php','a different official build');
 Files::atomic($base.'/route/home.php','a different route build');
 proof($base);
 $release=['release'=>'fixture-environment-v1','version'=>'v17.1','release_channel'=>'test',
  'installation_combinations'=>[['system'=>'10.7.4','modules'=>['MfCloud'=>'4.3.0']]],
  'files'=>array_fill_keys(array_map(static function($n){return 'public/web/cra1/file'.$n.'.php';},range(1,3400)),['sha256'=>hash('sha256','fixture'),'bytes'=>7]),
  'native_dependencies'=>[['path'=>'app/common/model/HostModel.php','verified_sha256'=>[hash('sha256','official fixture')]],['path'=>'route/home.php','verified_sha256'=>[hash('sha256','official fixture')]]]];
 Files::putJson($base.'/cra1-theme/release.json',$release);
 $options=['https'=>true,'origin'=>'https://fixture.invalid','context'=>['database'=>true,'system_version'=>'10.7.4','modules'=>[]]];
 $installer=new Installer($base);$result=$installer->preflight($options);
 check($result['installation_ready'],'ordinary 10.7.4 installation is allowed without identical modules and native file hashes');
 check(array_column($result['checks'],'id')===['php','extensions','database','directories','https','private-paths'],'only the six grouped runtime checks are returned');
 check($result['counts']['pass']===6,'no per-file rows leak into the installer');
 check(!isset($result['context'])&&!isset($result['files'])&&!isset($result['native_dependencies']),'no backend settings, module inventory or file manifest is sent to the page');
 check($result['environment']['system_version']==='10.7.4','actual V10 version remains available as display information');
 check(Inspector::nativeDependency($base,$release['native_dependencies'][0])['status']==='unverified','detailed compatibility inspection still reports unknown native files');
 check(!\CRA1\Theme\Compatibility\KnownContracts::filesMatch($base,['app/common/model/HostModel.php'=>hash('sha256','official fixture')]),'installation readiness does not bypass runtime sensitive-operation contracts');
 $custom=$options;$custom['context']['modules']=[['name'=>'OtherModule','version'=>'9.0.0','status'=>1]];
 check($installer->preflight($custom)['installation_ready'],'a third-party module does not block initial installation');
 $custom['context']['database_sql_mode']='ONLY_FULL_GROUP_BY';
 check($installer->preflight($custom)['installation_ready'],'native query compatibility is separate from the install environment');
 $custom['context']['system_version']='10.7.5';$result=$installer->preflight($custom);
 check($result['installation_ready']&&$result['environment']['system_version']==='10.7.5','version display is not an exact test-site whitelist');
 $failed=$options;$failed['context']['database']=false;
 check(!$installer->preflight($failed)['installation_ready'],'database connection failure blocks installation');
 $failed=$options;$failed['https']=false;
 check(!$installer->preflight($failed)['installation_ready'],'HTTPS remains required');
 $failed=$options;$failed['origin']='https://other.invalid';
 $result=$installer->preflight($failed);
 check($result['installation_ready']&&$result['checks'][5]['status']==='warning','a report from another site is not trusted and does not block the running environment');
 proof($base,['checked_at'=>time()-86401]);
 check($installer->preflight($options)['installation_ready'],'an expired diagnostic does not block otherwise usable installation');
 proof($base,['passed'=>false,'checks'=>[['passed'=>false,'status'=>0]]]);$result=$installer->preflight($options);
 $row=$result['checks'][5];
 check($result['installation_ready']&&$row['status']==='warning'&&strpos($row['detail'],'不影响安装')!==false,'network failure is advisory and does not instruct the user to change a correct public root');
 proof($base,['passed'=>false,'checks'=>[['passed'=>true,'status'=>200],['passed'=>false,'status'=>200]]]);$result=$installer->preflight($options);
 check($result['installation_ready']&&$result['checks'][5]['status']==='warning','legacy HTTP 200 alone no longer blocks installation');
 proof($base,['format'=>2,'passed'=>false,'outcome'=>'exposed']);$result=$installer->preflight($options);
 check(!$result['installation_ready']&&$result['checks'][5]['status']==='blocked','only a current-site report with actual file-content evidence blocks setup');
 check(strpos(json_encode($result),'root_hash')===false&&strpos(json_encode($result),'cra1-check-')===false,'the page does not receive private diagnostic paths or probe details');
 proof($base,['format'=>2,'passed'=>false,'outcome'=>'inconclusive']);$result=$installer->preflight($options);
 check($result['installation_ready']&&$result['counts']['warning']===1,'an inconclusive diagnostic does not count as a runtime failure');
 Files::atomic($base.'/runtime/cra1_theme/private-path-check.json','malformed optional diagnostic');
 check($installer->preflight($options)['installation_ready'],'a damaged optional diagnostic does not stop installation');
 unlink($base.'/runtime/cra1_theme/private-path-check.json');
 check($installer->preflight($options)['installation_ready'],'a missing optional diagnostic does not stop installation');
 proof($base);Files::atomic($base.'/config','not a directory');
 check(!$installer->preflight($options)['installation_ready'],'invalid configuration directory prevents initialization');unlink($base.'/config');
 Files::putJson($base.'/runtime/cra1_theme/distribution/pending.json',['state'=>'interrupted']);
 check(!$installer->preflight($options)['installation_ready'],'an interrupted update cannot be overwritten by initialization');
 unlink($base.'/runtime/cra1_theme/distribution/pending.json');
 check($installer->preflight($options)['installation_ready'],'corrected environment can be checked again');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
} finally {cleanup($base);}
