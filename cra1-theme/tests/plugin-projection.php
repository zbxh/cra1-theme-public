<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/Compatibility/runtime.php';
require dirname(__DIR__,2).'/public/cra1-shared/compatibility.php';
$checks=0;
function check($ok,string $label):void {if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
$urls=['security_ssh.htm','/security.htm?tab=ssh','security_group.htm','security.htm?tab=group','security.htm?tab=api','https://example.invalid/security_ssh.htm','//example.invalid/security.htm?tab=ssh'];
$items=array_map(static function($url){return ['url'=>$url];},$urls);
foreach([false,true]as$on){
    $p=CRA1ThemePublicProjection::member(['sidebar'=>$items,'content'=>['home_quick_links'=>['items'=>$items]]],['features'=>['ssh'=>$on,'security_group'=>$on]]);
    $expected=$on?$urls:array_slice($urls,4);
    check(array_column($p['sidebar'],'url')===$expected,'local navigation follows capability; external and other tabs preserved');
    check(array_column($p['content']['home_quick_links']['items'],'url')===$expected,'quick links use the same capability rules');
}
$calls=[];
$resolve=static function($id)use(&$calls){$calls[]=$id;return'mf_dcim';};
$p=CRA1ThemeCompatibility::host(['host'=>['id'=>12],'self_defined_field'=>[['id'=>1,'field_type'=>'password','value'=>'private']]],$resolve);
check($p['host']['module']==='mf_dcim'&&$calls===[12],'authorized native host receives its registered module');
check(!isset($p['self_defined_field'][0]['value']),'protected custom field values remain hidden');
CRA1ThemeCompatibility::host(['host'=>[]],$resolve);
check($calls===[12],'empty native host never triggers a module lookup');
echo json_encode(['status'=>'passed','checks'=>$checks]),PHP_EOL;
