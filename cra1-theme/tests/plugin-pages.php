<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Compatibility\PluginPages;
$checks=0;
function check($ok,string $label):void {if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
foreach(['authentication_person','authentication_company']as$view){
    foreach([[],['name'=>''],['name'=>[]]]as$p)check(PluginPages::redirect('IdcsmartCertification',$view,$p,77)==='/plugin/77/authentication_select.htm','missing provider');
    check(PluginPages::redirect('IdcsmartCertification',$view,['name'=>'native_provider'],77)==='','native provider retained');
}
foreach(['authentication_status','authentication_thrid']as$view){
    foreach([[],['type'=>'wrong']]as$p)check(PluginPages::redirect('IdcsmartCertification',$view,$p,77)==='/plugin/77/authentication_select.htm','missing flow type');
    foreach(['1','2','3']as$type)check(PluginPages::redirect('IdcsmartCertification',$view,['type'=>$type],77)==='','valid flow type retained');
}
check(PluginPages::redirect('ClientCare','msgDetail',[],88)==='/account.htm','missing message uses existing account page');
check(PluginPages::redirect('ClientCare','msgDetail',['id'=>3],88)==='','valid message remains native');
check(PluginPages::redirect('IdcsmartDomain','whois',[],99)==='/plugin/99/domain_list.htm','missing domain uses native list');
check(PluginPages::redirect('IdcsmartDomain','whois',['domain'=>'example.org'],99)==='','domain retained');
check(PluginPages::redirect('OtherPlugin','authentication_person',[],77)==='','same view on another plugin untouched');
check(PluginPages::redirect('IdcsmartAnnouncement','source',[],77)==='','public announcement has no forced redirect');
require CRA1_THEME_BACKEND.'/Compatibility/runtime.php';
$active=CRA1ThemeRuntime::project([],[['id'=>88,'name'=>'ClientCare','status'=>1]],'home');
$off=CRA1ThemeRuntime::project([],[['id'=>88,'name'=>'ClientCare','status'=>0]],'home');
check($active['links']['client_care']==='/plugin/88/msgDetail.htm','message link derives actual enabled plugin');
check(!isset($off['links']['client_care']),'disabled message link omitted');
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]),PHP_EOL;
