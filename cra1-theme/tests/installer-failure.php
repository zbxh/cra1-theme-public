<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Release\InstallerFailure;
$base=sys_get_temp_dir().'/cra1-error-test-'.bin2hex(random_bytes(6));mkdir($base,0700);$checks=0;
function check($value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
$log=$base.'/errors.log';$old=ini_get('error_log');ini_set('error_log',$log);
define('DATABASE_PASSWORD','fixture-db-password');define('DATABASE_USERNAME','fixture-db-user');
define('DATABASE_NAME','fixture-db-name');define('DATABASE_HOSTNAME','fixture-db-host');
try{
 $secret='fixture-admin-password';
 $source=new PDOException('SQLSTATE[HY000]: near "ON": syntax error in '.$base.'/site/runtime/cra1_theme/security.sqlite password='.$secret.' token=fixture-token DATABASE_PASSWORD=fixture-db-password user fixture-db-user database fixture-db-name host fixture-db-host /outside/private/site.php');
 $result=InstallerFailure::response(new InstallerFailure('写入安装日志',$source),'创建主题后台',$base.'/site',[$secret]);
 $serialized=json_encode($result,JSON_UNESCAPED_UNICODE);
 check(strpos($result['msg'],'near "ON": syntax error')!==false,'the original SQL failure is visible');
 check($result['error']['phase']==='写入安装日志','the specific failing operation survives the outer API boundary');
 check(strpos($result['msg'],'runtime/cra1_theme/security.sqlite')!==false,'the useful relative theme path remains visible');
 check((bool)preg_match('/^[A-F0-9]{12}$/',$result['error']['reference']),'a failure has a log reference');
 check($result['error']['needs_check']===true,'a failed write requires confirmation before another initialization');
 $logged=(string)file_get_contents($log);
 check(strpos($logged,$result['error']['reference'])!==false&&strpos($logged,'PDOException')!==false,'the reference locates the original exception chain');
 foreach([$secret,'fixture-db-password','fixture-db-user','fixture-db-name','fixture-db-host','fixture-token',$base,'/outside/private']as$value){
  check(strpos($serialized,$value)===false&&strpos($logged,$value)===false,'credentials and unrelated private paths are removed: '.hash('sha256',$value));
 }
 $validation=InstallerFailure::response(new InvalidArgumentException('管理账号格式不正确'),'设置主题后台账号',$base);
 check($validation['error']['needs_check']===false&&strpos($validation['msg'],'管理账号格式不正确')!==false,'correctable form input keeps the actual message and allows a retry');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0])."\n";
}finally{ini_set('error_log',$old);if(is_file($log))unlink($log);rmdir($base);}
