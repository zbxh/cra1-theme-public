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
foreach ([[], [['id'=>4,'name'=>'IdcsmartDomain','status'=>0]], [['id'=>4,'name'=>'IdcsmartDomain','status'=>1]]] as $plugins) {
    $projection=CRA1ThemeRuntime::project([], $plugins, 'website');
    check($projection['features']['domain_search']===(!empty($plugins)&&(int)$plugins[0]['status']===1),'website domain search follows the native plugin enable state');
    check(!isset($projection['plugins'])&&!isset($projection['common']['plugins']),'domain lookup does not expose plugin configuration');
    $cart=CRA1ThemeRuntime::project([], $plugins, 'goodsList');
    check(!isset($cart['features']['domain_search']),'website-specific search capability stays out of unrelated projections');
}
echo json_encode(['status'=>'passed','checks'=>$checks]),PHP_EOL;
