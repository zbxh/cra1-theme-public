<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND', dirname(__DIR__).'/backend');
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Http\CustomerError as Error;
$checks=0;
function check($value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
foreach(['余额不足，请先充值','验证码错误','操作密码错误','当前账号无权执行此操作','IP 地址格式不正确','密码长度必须为 8 至 32 位']as$value){check(Error::message($value,400)===$value,'business reasons preserved');}
foreach(['魔方云请求失败','SQLSTATE[HY000]','数据库连接失败','程序 /www/private.php 出错','错误 C:\\private\\file.php','服务地址 https://provider.invalid','服务 192.0.2.1 失败','错误 password=secret','<b>错误</b>','{"msg":"私有诊断"}','TypeError: fixture','错误'.str_repeat('长',241)]as$value){check(Error::message($value)==='操作暂时无法完成，请稍后重试或联系客服','private diagnostics removed');}
foreach([0,1,'0','1',false,true]as$flag){
 $data=Error::payload(['status'=>400,'msg'=>'请先完成验证','data'=>['operate_password'=>$flag,'security_verification'=>['kind'=>'operation','scene'=>'operation'],'trace'=>'secret','password'=>'secret']]);
 check(array_key_exists('operate_password',$data['data'])&&$data['data']['operate_password']===$flag,'native password requirement preserved');
 check(!isset($data['data']['set_operate_password'],$data['data']['trace'],$data['data']['password']),'no added flags, traces or credentials');
 check($data['data']['security_verification']['kind']==='operation','structured challenge preserved');
}
$data=Error::payload(['status'=>400,'msg'=>'private provider failure','data'=>['operate_password'=>'hash:secret','child'=>['secret_key'=>'secret','msg'=>'数据库异常'],'debug'=>['sql'=>'private']]]);
check(strpos(json_encode($data),'secret')===false,'secret hashes and nested credentials removed');
check(strpos(json_encode($data),'private')===false,'diagnostics do not survive payload');
$data=['status'=>200,'msg'=>'成功','data'=>['file'=>'business-attachment.png']];check(Error::payload($data)===$data,'successful business payload unchanged');
check(Error::payload(['status'=>400,'msg'=>'验证码错误','data'=>['captcha'=>true,'verify_code'=>1,'safe_method'=>['email_code']]])['data']['safe_method']===['email_code'],'email and captcha requirements unchanged');
check(Error::payload(['status'=>200,'msg'=>'private'],500)['msg']==='服务暂时不可用，请稍后重试或联系客服','HTTP status wins for failed responses');
echo json_encode(['status'=>'passed','checks'=>$checks,'production_requests'=>0])."\n";
