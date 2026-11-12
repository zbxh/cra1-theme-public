<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Compatibility\NativeComponents;
$checks=0;
function checkComponents(bool $value,string $label):void {if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
foreach(['/home.htm','/productdetail.htm?id=24','/cart/goods.htm?id=4','/plugin/32/product_detail.htm','/module/../product_detail.htm','/module/mf_cloud/other.htm']as$path)checkComponents(NativeComponents::forPath($path)===[],'preloading stays within native module pages');
foreach(['mf_cloud','mf_dcim','idcsmart_common','west_domain','future_server','mf_dcim_cabinet','mf_cloud_mysql','chinac_cloud_phone']as$module)foreach(['product_list','product_detail']as$view){
 $scripts=NativeComponents::forPath('/module/'.$module.'/'.$view.'.htm?id=24');$names=array_keys($scripts);
 checkComponents(count($names)===count(array_unique($names)),'components load only once');
 foreach(NativeComponents::registry()['dependencies']as$name=>$dependencies)if(isset($scripts[$name]))foreach($dependencies as$dependency)checkComponents(array_search($dependency,$names,true)<array_search($name,$names,true),'component dependency precedes its consumer');
 checkComponents(isset($scripts['pagination'],$scripts['payDialog']),'native page dependencies are present');
 if($view==='product_detail')checkComponents(isset($scripts['flowPacket'],$scripts['unsubscribe'],$scripts['securityVerification']),'detail supports flow and sensitive-operation dialogs');
}
foreach(NativeComponents::registry()['module_dependencies']as$module=>$views)foreach($views as$view=>$required){
 $scripts=NativeComponents::forPath('/module/'.$module.'/'.$view.'.htm?id=900001');
 foreach($required as$name)checkComponents(isset($scripts[$name]),$module.' declares its actual native component '.$name);
}
// Validate the installed modules' real business declarations, rather than a
// second copy of the expected per-module map. A module upgrade can add bindings.
$checked=0;
$installed=glob(CRA1_THEME_ROOT.'/public/plugins/server/*/template/clientarea/pc/default/product_detail.html');
foreach($installed as$html){
 $module=basename(dirname($html,5));
 $scripts=NativeComponents::forPath('/module/'.$module.'/product_detail.htm');
 preg_match_all('~<script[^>]+src=[\'\"]([^\'\"]+/js/([A-Za-z0-9_.-]+\.js))~i',(string)file_get_contents($html),$sources,PREG_SET_ORDER);
 foreach($sources as$source){
  $file=dirname($html).'/js/'.$source[2];if(!is_file($file))continue;
  if(!preg_match('~components\\s*:\\s*\\{([^}]+)\\}~s',(string)file_get_contents($file),$components))continue;
  foreach(explode(',',$components[1])as$name){
   $name=trim($name);if(!isset(NativeComponents::registry()['paths'][$name])||in_array($name,['asideMenu','topMenu'],true))continue;
   checkComponents(isset($scripts[$name]),$module.' preloads declared '.$name);
  }
  $checked++;
 }
}
if($installed)checkComponents($checked>0,'real installed native module business scripts were inspected');
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]),PHP_EOL;
