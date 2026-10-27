<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/bootstrap.php';require CRA1_THEME_ROOT.'/public/cra1-shared/runtime.php';
$checks=0;function check($ok,$label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
class MockRows {private array $rows;function __construct($rows){$this->rows=$rows;}function fetchAll(...$args){return $this->rows;}function fetch(...$args){return $this->rows[0]??false;}}
class OptionalFailurePDO extends PDO {function __construct(){} public function query($sql,...$args){if(strpos($sql,'withdraw_rule')!==false)throw new RuntimeException('optional table changed');if(strpos($sql,'configuration')!==false)return new MockRows([['setting'=>'recharge_open','value'=>'1'],['setting'=>'recharge_min','value'=>'10']]);return new MockRows([['id'=>1,'name'=>'IdcsmartNews'],['id'=>2,'name'=>'IdcsmartWithdraw']]);}}
$caps=CRA1ThemePublicProjection::capabilities(new OptionalFailurePDO());check(isset($caps['plugins']['IdcsmartNews']),'optional withdrawal failure must preserve news');check($caps['features']['recharge_open']===1,'optional failure must preserve recharge');check($caps['features']['withdraw_open']===0,'failed withdrawal remains closed');
check(CRA1ThemePublicProjection::code(['css_enabled'=>false,'css'=>'private-disabled','js_enabled'=>false,'js'=>'private-disabled'])===['css_enabled'=>false,'js_enabled'=>false],'disabled code excluded');
check(strpos(json_encode(CRA1ThemePublicProjection::content(['enabled'=>false,'secret'=>'disabled text'])),'disabled text')===false,'disabled content excluded');
check(!CRA1ThemeRuntime::project(['recharge_open'=>0,'recharge_notice'=>1,'recharge_money_notice_content'=>'off-secret'],[],'recharge')['features']['recharge_open'],'recharge closed');
check(strpos(json_encode(CRA1ThemeRuntime::project(['recharge_open'=>0,'recharge_notice'=>1,'recharge_money_notice_content'=>'off-secret'],[],'recharge')),'off-secret')===false,'closed recharge notice excluded');
// Include all CRA1 hooks without a native application; callbacks never run for mycra1.
$hooks=[];function add_hook($name,$callback){$GLOBALS['hooks'][$name][]=$callback;}
function runtime_path(){return sys_get_temp_dir().'/cra1-isolation-empty-'.getmypid().'/';}
function configuration($key){if($key==='web_theme')return $GLOBALS['fixture_web_theme']??'cra1';return $key==='website_name'?'fixture':null;}
require CRA1_THEME_ROOT.'/public/web/cra1/controller/Cra1.php';
require CRA1_THEME_ROOT.'/public/web/cra1/controller/hooks.php';
foreach(['cra1','pc/cra1','mobile/cra1']as$theme){$guard=cra1_member_session_fallback(['themes'=>$theme]);check(strpos($guard,'member-session.js')!==false&&strpos($guard,'CRA1Shared')!==false,'native fallback login guard recognizes '.$theme);}
foreach(['cloud','pc/cloud','mycra1']as$theme)check(cra1_member_session_fallback(['themes'=>$theme])==='','native fallback login guard leaves other themes unchanged');
$nativeWeb=$hooks['web_data_custom'][0](['tpl_name'=>'','url'=>'https://fixture.invalid']);check(isset($nativeWeb['data']['cra1']),'native website hook without theme parameter uses exact selected theme');
$GLOBALS['fixture_web_theme']='mycra1';check($hooks['web_data_custom'][0](['tpl_name'=>'','url'=>'https://fixture.invalid'])===[],'website hook does not match a name containing cloud');$GLOBALS['fixture_web_theme']='cra1';
foreach(['clientarea_view_append','cart_view_append']as$name)foreach($hooks[$name]??[]as$callback){$out=$callback(['themes'=>'mycra1','public_themes'=>'mycra1','cart_theme'=>'mycra1','view_html'=>'home']);check(!$out||!array_filter($out),'unrelated theme injection: '.$name);}
$base=sys_get_temp_dir().'/cra1-hook-'.bin2hex(random_bytes(6));mkdir($base.'/public/web/cra1/controller',0700,true);copy(CRA1_THEME_ROOT.'/public/web/cra1/controller/hooks.php',$base.'/public/web/cra1/controller/hooks.php');
$output=[];$exit=0;exec(escapeshellarg(PHP_BINARY).' -r '.escapeshellarg('function add_hook($a,$b){} include '.var_export($base.'/public/web/cra1/controller/hooks.php',true).';echo "safe";').' 2>&1',$output,$exit);check($exit===0&&strpos(implode("\n",$output),'safe')!==false,'partial installation must not fatal other themes');
unlink($base.'/public/web/cra1/controller/hooks.php');rmdir($base.'/public/web/cra1/controller');rmdir($base.'/public/web/cra1');rmdir($base.'/public/web');rmdir($base.'/public');rmdir($base);
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0])."\n";
