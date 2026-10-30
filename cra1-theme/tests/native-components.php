<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Compatibility\NativeComponents;
$checks=0;
function checkComponents(bool $value,string $label):void {if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
foreach(['/home.htm','/productdetail.htm?id=24','/cart/goods.htm?id=4','/plugin/32/product_detail.htm','/module/../product_detail.htm','/module/mf_cloud/other.htm']as$path)checkComponents(NativeComponents::forPath($path)===[],'preloading stays within native module pages');
foreach(['mf_cloud','mf_dcim','idcsmart_common','west_domain','future_server']as$module)foreach(['product_list','product_detail']as$view){
 $scripts=NativeComponents::forPath('/module/'.$module.'/'.$view.'.htm?id=24');$names=array_keys($scripts);
 checkComponents(count($names)===count(array_unique($names)),'components load only once');
 foreach(NativeComponents::registry()['dependencies']as$name=>$dependencies)if(isset($scripts[$name]))foreach($dependencies as$dependency)checkComponents(array_search($dependency,$names,true)<array_search($name,$names,true),'component dependency precedes its consumer');
 checkComponents(isset($scripts['pagination'],$scripts['payDialog']),'native page dependencies are present');
 if($view==='product_detail')checkComponents(isset($scripts['flowPacket'],$scripts['unsubscribe'],$scripts['securityVerification']),'detail supports flow and sensitive-operation dialogs');
}
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]),PHP_EOL;
