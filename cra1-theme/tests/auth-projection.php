<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require dirname(__DIR__).'/backend/bootstrap.php';
require CRA1_THEME_ROOT.'/public/cra1-shared/runtime.php';
$checks=0;
function authCheck($ok,string $message):void {if(!$ok)throw new RuntimeException($message);$GLOBALS['checks']++;}
foreach([0,1] as $email)foreach([0,1] as $phone){
    $p=CRA1ThemeRuntime::project(['register_email'=>$email,'register_phone'=>$phone,'login_phone_password'=>1],[],'login');
    authCheck($p['auth']['reset']===['email','phone'],'existing accounts can recover passwords independently of registration');
    authCheck(count($p['auth']['register'])===$email+$phone,'registration follows enabled channels');
}
$p=CRA1ThemeRuntime::project(['captcha_client_security_verify'=>1,'first_login_type'=>'mp_weixin_notice'],[],'login',['qr_login'=>true,'oauth'=>[['name'=>'FutureSocial','title'=>'New provider','img'=>'/icon.svg']]]);
authCheck($p['auth']['captcha']['security_verify']===true,'native security CAPTCHA policy supplied');
authCheck($p['common']['captcha_client_security_verify']===1,'legacy security CAPTCHA policy supplied');
authCheck($p['auth']['qr']['preferred']===true&&$p['auth']['providers'][0]['name']==='FutureSocial','QR does not exclude dynamic providers');
$off=CRA1ThemeRuntime::project([],[],'login');
authCheck(empty($off['auth']['qr'])&&empty($off['auth']['providers'])&&empty($off['auth']['captcha']['security_verify']),'disabled capabilities absent');
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]),PHP_EOL;
