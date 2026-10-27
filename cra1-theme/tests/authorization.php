<?php
declare(strict_types=1);
namespace think\facade {
 class Cache {public static array $values=[];static function has($key){return array_key_exists($key,self::$values);}static function get($key){return self::$values[$key]??null;}}
}
namespace app\home\model {
 class ClientareaAuthRuleModel {public function getAuthName($rule){return in_array($rule,$GLOBALS['known'],true)?'native permission':'';}}
}
namespace {
 require dirname(__DIR__).'/backend/bootstrap.php';
 use CRA1\Theme\Security\NativeAuthorization as Auth;
 use think\facade\Cache;
 $client=2;$known=[];$results=[];$checks=0;
 function get_client_id($parent=true){return $GLOBALS['client'];}
 function hook($name,$params=[]){return $GLOBALS['results'][$name]??[];}
 function check($ok,$label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
 $read='server\\mf_cloud\\controller\\home\\CloudController::disk';
 Cache::$values['home_auth_rule_2']=json_encode(['native\\RegisteredController::allowed']);
 check(Auth::allows($read),'unregistered native reads retain the native controller decision');
 $known=[$read];check(!Auth::allows($read),'registered native route still requires an explicit grant');
 Cache::$values['home_auth_rule_2']=json_encode([$read]);check(Auth::allows($read),'registered allowed native route is accepted');
 Cache::$values=[];$results['home_check_access']=[['status'=>200],['status'=>400]];
 check(!Auth::allows($read),'one hook cannot override another hook denial');
 $results['home_check_access']=[['status'=>200]];check(Auth::allows($read),'uncached native permission hook is reused');
 check(Auth::visibleHostIds()===null&&Auth::hostVisible(17),'main account retains native unrestricted visibility');
 $results['get_client_host_id']=[['status'=>200,'data'=>['host'=>[]]]];
 check(Auth::visibleHostIds()===[]&&!Auth::hostVisible(17),'empty assignment never becomes all parent products');
 $results['get_client_host_id']=[['status'=>200,'data'=>['host'=>['17',18]]]];
 check(Auth::hostVisible(17)&&!Auth::hostVisible(19),'child visibility uses explicit native host identifiers');
 $results['get_client_host_id'][]=['status'=>200,'data'=>['host'=>[18,19]]];
 check(Auth::visibleHostIds()===[18],'multiple visibility providers are intersected');
 $results['get_client_host_id']=[['status'=>200,'data'=>['host'=>[['host_id'=>17]]]]];
 check(Auth::visibleHostIds()===[17],'native project host rows are supported');
 $results['get_client_host_id']=[['status'=>200,'data'=>['host'=>[['id'=>17]]]]];
 check(Auth::visibleHostIds()===[],'unknown project row shape is rejected');
 $results['get_client_host_id']=[['status'=>200,'data'=>['host'=>'17']]];
 check(Auth::visibleHostIds()===[],'invalid native assignment does not broaden visibility');
 $client=0;check(!Auth::allows($read)&&Auth::visibleHostIds()===[],'anonymous account has no route or host authorization');
 echo json_encode(['status'=>'passed','checks'=>$checks]).PHP_EOL;
}
