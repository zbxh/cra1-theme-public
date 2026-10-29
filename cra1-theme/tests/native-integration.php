<?php
declare(strict_types=1);
/** Called by an external, network-isolated native bootstrap; all changes use its private database. */
function cra1IntegrationChecks(array $fixture): array
{
    $identity=\think\facade\Db::query('SELECT DATABASE() AS db, @@socket AS socket')[0];
    if(empty($fixture['isolated'])||$identity['db']!==$fixture['database']||$identity['socket']!==$fixture['socket']
        ||$identity['socket']==='/tmp/mysql.sock')throw new RuntimeException('An isolated database and bootstrap are required');
    $app=$fixture['app'];$checks=[];
    $check=static function($ok,string $label)use(&$checks){if(!$ok)throw new RuntimeException($label);$checks[]=$label;};
    $db='think\\facade\\Db';$cache='think\\facade\\Cache';
    $db::startTrans();
    try {
        $now=time();$password='fixture-'.bin2hex(random_bytes(16));
        $owner=(int)$db::name('client')->insertGetId(['username'=>'isolated-owner','status'=>1,'password'=>idcsmart_password($password),'operate_password'=>idcsmart_password($password),'phone_code'=>86,'phone'=>'13900000123','email'=>'fixture@example.invalid','create_time'=>$now]);
        $child=(int)$db::name('client')->insertGetId(['username'=>'isolated-child','status'=>1,'password'=>idcsmart_password($password),'operate_password'=>idcsmart_password($password),'create_time'=>$now]);
        $host=(int)$db::name('host')->insertGetId(['client_id'=>$owner,'name'=>'isolated-host','status'=>'Active','create_time'=>$now,'due_time'=>$now+86400]);
        foreach([$owner,$child]as$id)$db::name('client_login')->insert(['client_id'=>$id,'create_time'=>$now,'last_action_time'=>$now,'last_login_ip'=>'127.0.0.1']);
        $setting=static function(string $key,string $value)use($db){$db::name('configuration')->where('setting',$key)->update(['value'=>$value]);idcsmart_cache(\app\common\logic\CacheLogic::CACHE_CONFIGURATION,null);};
        $setting('home_enforce_safe_method','');$setting('maintenance_mode','0');$setting('home_login_check_ip','0');
        $fixtureLogin=0;
        $requestFor=static function(int $id,string $path,string $method='POST',array $params=[],?string $token=null)use($app,&$fixtureLogin){
            $request=(new \think\Request())->withServer(['REQUEST_METHOD'=>$method,'REQUEST_URI'=>$path,'REMOTE_ADDR'=>'127.0.0.1','HTTP_HOST'=>'fixture.invalid','HTTPS'=>'on','SERVER_PORT'=>443])->setMethod($method)->setPathinfo(ltrim($path,'/'))->setUrl($path);
            $app->instance('request',$request);
            if($token===null&&$id>0)$token=create_jwt(['id'=>$id,'name'=>'isolated-fixture','remember_password'=>1,'fixture_login'=>++$fixtureLogin]);
            $request->withHeader(['host'=>'fixture.invalid','authorization'=>$token?'Bearer '.$token:'','accept'=>'application/json','content-type'=>'application/json']);
            if($method==='GET')$request->withGet($params);else $request->withInput(json_encode($params+['__isolated_fixture'=>1]));
            return $request;
        };
        $guard=static function($request,bool $operation=false,?callable $validator=null) {
            return (new \CRA1\Theme\Http\MemberGuard())->handle($request,static function($request)use($operation,$validator){
                $next=static function($request)use($validator){
                    if($validator){$result=$validator($request);if((int)($result['status']??0)!==200)return json($result);}
                    return json(['status'=>200,'guard_reached'=>true]);
                };
                return $operation?(new \CRA1\Theme\Http\OperationGuard())->handle($request,$next):$next($request);
            })->getData();
        };
        $check(\CRA1\Theme\Compatibility\KnownContracts::security(),'reviewed native security combination matches');
        $check(\CRA1\Theme\Compatibility\KnownContracts::module('MfCloud','4.3.0'),'reviewed native module combination matches');
        $cases=[
            ['POST',"/host/$host/renew"],['PUT',"/host/$host/renew/auto"],['POST',"/host/$host/product_upgrade/order"],
            ['POST',"/host/$host/flow_packet_order"],['POST',"/host/$host/on_demand_to_recurring_prepayment"],
            ['PUT',"/host/$host/auto_release_time"],['POST',"/mf_cloud/$host/on"],['POST',"/mf_cloud/$host/off"],
            ['POST',"/mf_cloud/$host/reboot"],['POST',"/mf_cloud/$host/hard_reboot"],['POST',"/mf_cloud/$host/reinstall"],
            ['POST',"/mf_cloud/$host/reset_password"],['POST',"/mf_cloud/$host/rescue"],['POST',"/mf_cloud/$host/vnc"],
            ['POST',"/mf_cloud/$host/disk/1/mount"],['POST',"/mf_cloud/$host/disk/1/unmount"],
            ['DELETE',"/mf_cloud/$host/disk/1/failed"],['POST',"/mf_cloud/$host/disk/order"],['POST',"/mf_cloud/$host/disk/resize/order"],
            ['POST',"/mf_cloud/$host/common_config/order"],['POST',"/mf_cloud/$host/recommend_config/order"],
            ['POST',"/mf_cloud/$host/ip_num/order"],['POST',"/mf_cloud/$host/upgrade_defence/order"],
            ['POST',"/mf_cloud/$host/snapshot"],['POST',"/mf_cloud/$host/snapshot/restore"],['DELETE',"/mf_cloud/$host/snapshot/1"],
            ['POST',"/mf_cloud/$host/backup"],['POST',"/mf_cloud/$host/backup/restore"],['POST',"/mf_cloud/$host/vpc_network"],
            ['POST','/security_group'],['PUT','/security_group/1'],['DELETE','/security_group/rule/1'],
            ['POST',"/mf_dcim/$host/on"],['POST',"/mf_dcim/$host/off"],['POST',"/mf_dcim/$host/reinstall"],
            ['POST',"/mf_dcim/$host/reset_bmc"],['GET',"/mf_dcim/$host/remote_info"],
            ['POST',"/idcsmart_common/host/$host/upgrade"],['POST',"/idcsmart_common/host/$host/provision/on"],
            ['GET',"/mf_cloud/$host/remote_info"],['GET',"/mf_cloud/$host/download_rdp"],
        ];
        foreach($cases as [$method,$relative]){
            $request=$requestFor($owner,'/console/v1'.$relative,$method);
            $reply=$guard($request,true);
            $check(($reply['status']??0)===200&&!empty($reply['guard_reached']),$method.' '.$relative.' passes native and theme guards');
        }
        $reply=$guard($requestFor(0,"/console/v1/host/$host/renew"));$check($reply['status']===401,'anonymous renewal stays unauthorized');
        $db::name('client')->where('id',$owner)->update(['status'=>0]);
        $reply=$guard($requestFor($owner,"/console/v1/host/$host/renew"));$check($reply['status']===401,'disabled account stays unauthorized');
        $db::name('client')->where('id',$owner)->update(['status'=>1]);
        $setting('home_enforce_safe_method','operate_password');
        $request=$requestFor($owner,"/console/v1/host/$host/renew");$token=get_header_jwt();
        $reply=$guard($request);$check($reply['status']===400&&!empty($reply['data']['need_security_verify']),'renewal still requests configured operation password');
        $grant=\CRA1\Theme\Security\OperationVerification::verifyPassword($owner,$password);
        $check($grant['status']===200,'native password hash verifies through theme service');
        $reply=$guard($requestFor($owner,"/console/v1/host/$host/renew",'POST',[],$token));
        $check($reply['status']===200,'current native login can use its verified grant');
        $reply=$guard($requestFor($owner,"/console/v1/host/$host/renew"));
        $check($reply['status']===400,'another native login cannot reuse the grant');
        $db::name('client')->where('id',$owner)->update(['operate_password'=>'']);
        $reply=$guard($requestFor($owner,"/console/v1/host/$host/renew"));
        $check($reply['status']===403&&!empty($reply['data']['setup_required']),'missing operation password keeps the setup instruction');
        $setting('home_enforce_safe_method','');
        // Exercise actual installed subaccount hooks, not a simulated permission decision.
        $db::name('plugin')->where('module','addon')->where('name','IdcsmartSubAccount')->update(['status'=>1]);
        $sub=(int)$db::name('addon_idcsmart_sub_account')->insertGetId(['parent_id'=>$owner,'client_id'=>$child,'auth'=>'[]','notice'=>'[]','visible_product'=>'host','module'=>'[]','host_id'=>json_encode([$host]),'create_time'=>$now]);
        $request=$requestFor($child,"/console/v1/host/$host/renew");
        $reply=$guard($request);
        $check(get_client_id()===$owner,'real subaccount hook resolves parent account');
        $check($reply['status']===403,'subaccount without billing permission cannot renew');
        $power=(int)$db::name('clientarea_auth')->where('title','clientarea_auth_on_off_restart')->value('id');
        $billing=(int)$db::name('clientarea_auth')->where('title','clientarea_auth_refund_renew_upgrade')->value('id');
        $check($power>0&&$billing>0,'native permission groups exist');
        $db::name('addon_idcsmart_sub_account')->where('id',$sub)->update(['auth'=>json_encode([$billing])]);
        $reply=$guard($requestFor($child,"/console/v1/host/$host/renew"));$check($reply['status']===200,'billing permission permits assigned product renewal');
        $reply=$guard($requestFor($child,"/console/v1/mf_cloud/$host/reboot"));$check($reply['status']===403,'billing permission cannot grant power controls');
        $db::name('addon_idcsmart_sub_account')->where('id',$sub)->update(['host_id'=>'[]']);
        $reply=$guard($requestFor($child,"/console/v1/host/$host/renew"));$check($reply['status']===404,'unassigned product stays hidden from subaccount');
        // Native SMS validation consumes the code once; the theme observes only the request-local proof.
        $template=$db::name('host')->where('id',(int)$fixture['host_id'])->find();
        if(!$template)throw new RuntimeException('A native MfCloud fixture host is required');
        $db::name('host')->where('id',$host)->update(['product_id'=>$template['product_id'],'server_id'=>$template['server_id']]);
        $db::name('module_mf_cloud_config')->where('product_id',$template['product_id'])->update(['reinstall_sms_verify'=>1]);
        $codeKey='verification_code_verify_86_13900000123';
        $request=$requestFor($owner,"/console/v1/mf_cloud/$host/reinstall",'POST',['code'=>'123456']);
        if(class_exists('app\\common\\logic\\VerificationCodeAttemptLogic'))(new \app\common\logic\VerificationCodeAttemptLogic())->store($codeKey,'123456');
        else $cache::set($codeKey,'123456',300);
        $nativeCode=static function($request){return (new \app\common\model\ClientModel())->verifyOldPhone(['code'=>$request->param('code')]);};
        $reply=$guard($request,true,$nativeCode);$check($reply['status']===200,'native SMS proof passes both theme guards without a second consume');
        $reply=$guard($requestFor($owner,"/console/v1/mf_cloud/$host/reinstall",'POST',['code'=>'123456']),true,$nativeCode);
        $check($reply['status']===400,'consumed native SMS code cannot be replayed');
        return ['status'=>'passed','checks'=>count($checks),'results'=>$checks,'real_native_auth'=>true,'control_actions'=>'guard sentinel only','production_writes'=>0];
    } finally {$db::rollback();idcsmart_cache(\app\common\logic\CacheLogic::CACHE_CONFIGURATION,null);}
}
