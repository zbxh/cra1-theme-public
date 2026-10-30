<?php
declare(strict_types=1);
namespace app\home\controller { class ViewClientController {public $request;public function module(){return 'native-render';}} }
namespace {
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');require CRA1_THEME_BACKEND.'/bootstrap.php';
$GLOBALS['theme']='cra1';$GLOBALS['mobile']=false;
function cookie($key){return '';}
function configuration($key){return $GLOBALS['theme'];}
function use_mobile(){return $GLOBALS['mobile'];}
function redirect($url){return $url;}
class NativeViewRequest {public $params=[];public function param(){return $this->params;}}
$view=new CRA1\Theme\Http\home\ViewClientController();$view->request=new NativeViewRequest();$checks=0;
function nativeViewCheck(bool $ok,string $label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
foreach([null,'',0,'0','invalid',[],['1'],'-1','1.2']as$id){$view->request->params=['view_html'=>'product_detail','id'=>$id];nativeViewCheck($view->module()==='/productList.htm','incomplete host links return to the product list');}
foreach([1,'24','1565834']as$id){$view->request->params=['view_html'=>'product_detail','id'=>$id];nativeViewCheck($view->module()==='native-render','valid hosts retain native dispatch');}
$view->request->params=['view_html'=>'product_list'];nativeViewCheck($view->module()==='native-render','native lists remain unchanged');
$GLOBALS['theme']='mycra1';$view->request->params=['view_html'=>'product_detail'];nativeViewCheck($view->module()==='native-render','other themes are not intercepted');
$GLOBALS['theme']='cra1';$GLOBALS['mobile']=true;nativeViewCheck($view->module()==='/productList.htm','CRA1 mobile uses the same missing-host recovery');
$view->request->params=['view_html'=>'product_detail','theme_mobile'=>'default'];nativeViewCheck($view->module()==='native-render','explicit native mobile theme remains native');
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]),PHP_EOL;
}
