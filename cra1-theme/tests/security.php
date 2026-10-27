<?php
declare(strict_types=1);
namespace think\facade { class Cache {public static array $values=[];static function get($key){return self::$values[$key]??null;}static function set($key,$value,$ttl){self::$values[$key]=$value;return true;}static function delete($key){unset(self::$values[$key]);}} }
namespace app\common\model {
 class ClientModel {static array $client=['operate_password'=>'hash:operation-test','password'=>'login-hash','phone_code'=>'86','phone'=>'13900000000','email'=>'fixture@example.invalid'];static function find($id){return $id>0?self::$client:null;}}
 class HostModel {static function where(...$args){return new self();}function find(){return ['id'=>1,'product_id'=>2,'client_id'=>1];}}
}
namespace server\mf_cloud\model {class ConfigModel {static function where(...$args){return new self();}function value($key){return 1;}}}
namespace app\http\middleware {
 class CheckHome {function handle($request,\Closure $next){$GLOBALS['order'][]='native-auth';if(!$request->authenticated)return \json(['status'=>401]);$request->client_id=1;return $next($request);}}
 class CheckClientOperatePassword {}
}
namespace {
 $temp=sys_get_temp_dir().'/cra1-security-'.bin2hex(random_bytes(6));mkdir($temp,0700);define('CRA1_THEME_ROOT',$temp);
 require dirname(__DIR__).'/backend/bootstrap.php';
 use CRA1\Theme\Security\OperationVerification as Verify;
 use think\facade\Cache;
 $checks=0;$token='signed-fixture-token';$order=[];
 function check($value,$label){if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
 function configuration($name){return $name==='home_enforce_safe_method'?'operate_password':($name==='system_version'?'10.7.4':0);}
 function get_header_jwt(){return $GLOBALS['token'];}function get_client_id($parent=true){return 1;}
 function hook($name,$params=[]){return [];}
 function idcsmart_password_compare($plain,$hash){return hash_equals('hash:'.$plain,$hash);}function idcsmart_cache(...$args){return null;}
 class Reply {public array $value;public array $headers=[];function __construct($v){$this->value=$v;}function getData(){return $this->value;}function data($v){$this->value=$v;return $this;}function header($v){$this->headers+=$v;return $this;}}
 function json($value){return new Reply($value);}
 class Req {public bool $is_api=false;public bool $authenticated=true;public int $client_id=0;public $client_operation_summary=false;public $client_operation_phone_verified=0;public array $params=[];public string $path='/console/v1/mf_cloud/1/reboot';public string $verb='POST';function pathinfo(){return $this->path;}function method(){return $this->verb;}function param($key=null){return $key===null?$this->params:($this->params[$key]??null);}}
 try{
  check(Verify::sensitive('/console/v1/mf_cloud/1/reboot','POST'),'power is sensitive');check(!Verify::sensitive('/console/v1/mf_cloud/1/status','GET'),'status read not sensitive');
  check(Verify::sensitive('/console/v1/mf_cloud/1/remote_info','GET'),'credentials read sensitive');
  check(Verify::requiredGroup('/console/v1/mf_cloud/1/reboot','POST')==='clientarea_auth_on_off_restart','power uses native power permission group');
  check(Verify::requiredGroup('/console/v1/mf_cloud/1/remote_info','GET')==='clientarea_auth_control_reinstall_rescue_reset_set_mount','credential grant never replaces control permission');
  check(Verify::requiredGroup('/console/v1/mf_cloud/1/remote_info','GET',['metadata_only'=>'1'])==='','redacted metadata remains readable');
  check(Verify::requiredGroup('/console/v1/security_group/1/host/2','POST')==='clientarea_auth_control_reinstall_rescue_reset_set_mount','security group writes require control permission');
  check(Verify::requiredGroup('/console/v1/mf_cloud/1/disk/order','POST')==='clientarea_auth_refund_renew_upgrade','disk purchase requires billing permission');
  check(Verify::requiredGroup('/console/v1/mf_cloud/1/disk/2/failed','DELETE')==='clientarea_auth_delete','failure cleanup requires deletion permission');
  check(Verify::requiredGroup('/console/v1/refund','POST')==='clientarea_auth_refund_renew_upgrade','refund permissions retain native channel verification flow');
  check(Verify::sensitive('/console/v1/mf_cloud/1/app_preset_task/2/retry','POST'),'application retry requires verification');
  check(Verify::requiredGroup('/console/v1/mf_cloud/batch_operate','POST',['action'=>'off'])==='clientarea_auth_on_off_restart','batch power reuses native power permission');
  check(Verify::requiredGroup('/console/v1/idcsmart_common/host/1/custom/provision','POST',['func'=>'trafficUsage'])==='','redacted common traffic read needs no mutation permission');
  $r=new Req();$challenge=Verify::enforce($r);check($challenge['data']['security_verification']['kind']==='operation','requires server proof');
  check(Verify::verifyPassword(1,'wrong')['status']===400,'wrong password rejected');check(Verify::expiresAt(1)===0,'wrong password does not grant');
  $proof=Verify::verifyPassword(1,'operation-test');check($proof['status']===200,'password accepted');check(Verify::expiresAt(1)>time(),'server stores ttl');check(Verify::enforce($r)['status']===200,'current login reuses grant');
  check(strpos(json_encode(Cache::$values),'operation-test')===false,'cache contains no plaintext');
  $token='another-signed-token';check(Verify::expiresAt(1)===0,'grant not shared across login tokens');$token='signed-fixture-token';
  \app\common\model\ClientModel::$client['email']='changed@example.invalid';check(Verify::expiresAt(1)===0,'contact change invalidates grant');
  \app\common\model\ClientModel::$client['email']='fixture@example.invalid';
  $r->path='/console/v1/mf_cloud/1/reinstall';$r->params=[];check(Verify::enforce($r)['data']['security_verification']['kind']==='native_code','native sms takes precedence even with grant');
  $r->params=['code'=>'unverified-code'];check(Verify::enforce($r)['status']===200,'native code delegated for native validation');check($r->client_operation_phone_verified===0,'theme must not claim OTP has been verified');
  Verify::revoke(1);$r=new Req();$r->params=['verified'=>true,'expires_at'=>time()+900];check(Verify::enforce($r)['status']!==200,'browser flags cannot authorize');
  $data=Verify::redact(['password'=>'secret','child'=>['root_password'=>'secret'],'self_defined_field'=>[['field_type'=>'password','value'=>'secret']],'name'=>'host']);check(strpos(json_encode($data),'secret')===false,'ordinary data redacted recursively');check($data['name']==='host','ordinary fields retained');
  $mapped=['data'=>['self_defined_field'=>[['id'=>41,'field_type'=>'password'],['id'=>42,'field_type'=>'text']], 'list'=>[['self_defined_field'=>[41=>'private-map',42=>'public-map'], 'self_defined_field_41'=>'private-flat','self_defined_field_42'=>'public-flat']]]];
  $safe=Verify::redact($mapped);check(strpos(json_encode($safe),'private-')===false,'native per-host maps and flattened fields cannot disclose passwords');
  check($safe['data']['list'][0]['self_defined_field'][42]==='public-map'&&$safe['data']['list'][0]['self_defined_field_42']==='public-flat','public custom fields retain their values and identifiers');
  check(Verify::redact(['self_defined_field'=>[41=>'unknown-value']])['self_defined_field']===[],'untyped native field values fail closed');
  $r->path='/console/v1/home/host';$r->verb='GET';$res=Verify::filterResponse($r,new Reply($mapped));check(strpos(json_encode($res->value),'private-')===false,'native home list shares the custom-field redaction');
  $r->path='/console/v1/host/1';$r->verb='GET';$res=Verify::filterResponse($r,new Reply(['status'=>200,'data'=>['password'=>'private','self_defined_field'=>[['field_type'=>'password','value'=>'private']]]]));check(strpos(json_encode($res->value),'private')===false,'ordinary response always redacted');
  check($res->headers['Cache-Control']==='no-store, private','credentials-related data never cached');
  $r->path='/console/v1/mf_cloud/1/remote_info';$r->params=['metadata_only'=>'1'];
  check(Verify::remoteSummary($r->path,'GET',$r->params),'registered remote summary recognized');
  check(Verify::enforce($r,true)['status']===200,'non-secret summary needs no password grant');
  foreach ([['POST',$r->path,['metadata_only'=>'1']],['GET','/console/v1/unknown/1/remote_info',['metadata_only'=>'1']],['GET',$r->path,['metadata_only'=>['1']]],['GET',$r->path,['metadata_only'=>true]],['GET',$r->path,[]]] as [$verb,$path,$params]) {
      check(!Verify::remoteSummary($path,$verb,$params),'summary exemption rejects unrelated routes, verbs and invalid flags');
  }
  Verify::verifyPassword(1,'operation-test');
  $summaryPayload=['status'=>200,'msg'=>'provider-internal','extra'=>'private','data'=>['username'=>'root','port'=>22,'rescue'=>0,'simulate_physical_machine'=>1,'password'=>'secret','future_credential'=>'secret','nested'=>['token'=>'secret']]];
  $res=Verify::filterResponse($r,new Reply($summaryPayload));
  check($res->value===['status'=>200,'data'=>['username'=>'root','port'=>22,'rescue'=>0,'simulate_physical_machine'=>1]],'summary is a strict whitelist even with valid verification');
  check($res->headers['Cache-Control']==='no-store, private','summary cannot enter ordinary browser caches');
  $res=Verify::filterResponse($r,new Reply(['status'=>400,'msg'=>'private provider path','data'=>['password'=>'secret']]));
  check($res->value===['status'=>503,'msg'=>'实例信息暂时无法获取，请稍后重试'],'summary failures contain no native diagnostics or data');
  $guard=new \CRA1\Theme\Http\MemberGuard();$r=new Req();$r->authenticated=false;$order=[];
  $reply=$guard->handle($r,function(){ $GLOBALS['order'][]='native-action';return json(['status'=>200]);});check($reply->value['status']===401&&$order===['native-auth'],'native auth rejects before theme guard or action');
  $r->authenticated=true;$r->verb='GET';$r->path='/console/v1/index';$order=[];$guard->handle($r,function(){ $GLOBALS['order'][]='native-action';return json(['status'=>200]);});check($order===['native-auth','native-action'],'authenticated native action preserved');
  $r->verb='POST';$r->path='/console/v1/mf_cloud/1/reboot';$order=[];$reply=$guard->handle($r,function(){ $GLOBALS['order'][]='native-action';return json(['status'=>200]);});check($reply->value['status']===503&&$order===['native-auth'],'unverified native source blocks a sensitive action after authentication');
  $r->verb='GET';$r->path='/console/v1/idcsmart_common/host/1/configoption';$r->params=['credentials_only'=>'1'];$order=[];$reply=$guard->handle($r,function(){ $GLOBALS['order'][]='native-action';return json(['status'=>200]);});check($reply->value['status']===503&&$order===['native-auth'],'credential-only request also requires a registered source contract');
  $r->path='/console/v1/mf_cloud/1/remote_info';$r->params=['metadata_only'=>'1'];$order=[];
  $operationGuard=new \CRA1\Theme\Http\OperationGuard();
  $reply=$guard->handle($r,function($request)use($operationGuard,$summaryPayload){return $operationGuard->handle($request,function()use($summaryPayload){$GLOBALS['order'][]='native-summary';return json($summaryPayload);});});
  check($reply->value['status']===200&&$order===['native-auth','native-summary'],'both theme guards allow an authenticated safe summary on a historical native installation');
  check(!isset($reply->value['data']['password'],$reply->value['data']['future_credential']),'guard chain filters native summary before responding');
  $r->params=[];$reply=$operationGuard->handle($r,function(){throw new RuntimeException('credential action reached');});
  check($reply->value['status']===503,'explicit credential reads still fail closed without a source contract');
  $r->client_id=0;$r->params=['metadata_only'=>'1'];$reply=$operationGuard->handle($r,function(){throw new RuntimeException('anonymous action reached');});
  check($reply->value['status']===401,'metadata flag cannot bypass authentication');
  check(\CRA1\Theme\Context::isCRA1('pc/cra1')&&!\CRA1\Theme\Context::isCRA1('mycra1')&&!\CRA1\Theme\Context::isCRA1('cra1-custom'),'exact theme identity');
  for($i=0;$i<5;$i++)Verify::verifyPassword(1,'wrong');check(Verify::verifyPassword(1,'operation-test')['status']===429,'failure limit cannot be bypassed with a later correct password');
  echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0])."\n";
 }finally{foreach(glob($temp.'/runtime/cra1_theme/verification_locks/*')?:[]as$file)unlink($file);@rmdir($temp.'/runtime/cra1_theme/verification_locks');@rmdir($temp.'/runtime/cra1_theme');@rmdir($temp.'/runtime');rmdir($temp);}
}
