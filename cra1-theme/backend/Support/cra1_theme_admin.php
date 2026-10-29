<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}
require_once __DIR__.'/cra1_theme_security.php';
function theme_security(): CRA1ThemeSecurity { return $GLOBALS['THEME_SECURITY']; }
function theme_actor(): ?array { return $GLOBALS['THEME_ACTOR']??null; }
function theme_context(array $extra=[]): array { $a=theme_actor();return $extra+['actor_id'=>$a?(int)$a['id']:null,'actor_name'=>$a['username']??null,'role'=>$a['role']??null,'ip'=>$GLOBALS['THEME_NETWORK']['ip']??'','device'=>theme_device(),'request_id'=>$GLOBALS['THEME_REQUEST_ID']??'','session_hash'=>$GLOBALS['THEME_SESSION_HASH']??(!empty($_SESSION['security_token'])?CRA1ThemeSecurity::hashToken($_SESSION['security_token']):'')]; }
function theme_device(): string { $ua=(string)($_SERVER['HTTP_USER_AGENT']??'');$os=preg_match('/Windows|Android|iPhone|iPad|Macintosh|Linux/i',$ua,$m)?$m[0]:'未知设备';$browser=preg_match('/Edg|Firefox|Chrome|Safari/i',$ua,$m)?$m[0]:'其他浏览器';return $os.' · '.$browser.' · '.substr(hash('sha256',$ua),0,10); }
function theme_event(string $action,string $result,array $extra=[],array $diff=[]): void { theme_security()->event($action,$result,theme_context($extra),$diff); }
function theme_request_check(): void {
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST'||!csrf_ok()||!CRA1ThemeSecurity::sameOrigin($_SERVER,(string)$GLOBALS['THEME_SETTINGS']['canonical_url'],(bool)$GLOBALS['THEME_NETWORK']['https'])){theme_event('csrf','denied',['category'=>'security','risk'=>'high','reason'=>'CSRF 或同源校验失败']);throw new CRA1ThemeSecurityError('请求校验失败，请刷新页面重试。',403,'CSRF_FAILED');}
}
function theme_require_role(array $roles): void { $a=theme_actor();if(!$a||!in_array($a['role'],$roles,true)){theme_event('permission.denied','denied',['category'=>'security','risk'=>'high','reason'=>'角色无权执行该操作','target'=>(string)($_GET['r']??'')]);throw new CRA1ThemeSecurityError('当前账号无权执行该操作。',403,'PERMISSION_DENIED');} }
function theme_new_login(array $a): array {
    if(session_status()!==PHP_SESSION_ACTIVE)session_start();session_regenerate_id(true);$_SESSION=['security_token'=>theme_security()->startSession($a,client_ip(),theme_device()),'cra1_admin'=>$a['username'],'cra1_csrf'=>bin2hex(random_bytes(24))];$GLOBALS['THEME_ACTOR']=$a;$GLOBALS['THEME_SESSION_HASH']=CRA1ThemeSecurity::hashToken($_SESSION['security_token']);return ['user'=>CRA1ThemeSecurity::publicAccount($a),'csrf'=>$_SESSION['cra1_csrf']];
}
function theme_captcha_valid(array $p): bool { $c=$_SESSION['security_captcha']??[];unset($_SESSION['security_captcha']);return !empty($c['hash'])&&($c['expires']??0)>=time()&&hash_equals($c['hash'],hash('sha256',strtoupper(trim((string)($p['captcha']??''))))); }
function theme_auth_api(string $action,array $p): void {
    $s=theme_security();theme_request_check();
    if($action==='auth.recovery.begin'){
        if(!$s->boundedRate('recovery:request:'.hash('sha256',client_ip()),30,900))throw new CRA1ThemeSecurityError('请求过于频繁，请稍后重试',429,'RATE_LIMITED');
        if(!theme_captcha_valid($p))json_out(['status'=>400,'msg'=>'图形验证码错误或已失效，请重新输入','code'=>'CAPTCHA_REQUIRED','data'=>['captcha_required'=>true]],400);
        $data=(new \CRA1\Theme\Security\AdminRecovery($s))->beginReset((string)($p['username']??''),(string)($p['email']??''),session_id(),client_ip());
        theme_event('auth.recovery.begin','ok',['category'=>'security','reason'=>'找回密码请求已处理，不记录账号匹配结果或验证码']);
        json_out(['status'=>200,'msg'=>'如果账号与已绑定邮箱匹配，验证码将发送至该邮箱。未收到时请稍后重试或联系管理员。','data'=>$data]);
    }
    if($action==='auth.recovery.finish'){
        (new \CRA1\Theme\Security\AdminRecovery($s))->finishReset((string)($p['challenge']??''),session_id(),(string)($p['code']??''),(string)($p['new_password']??''),client_ip());
        theme_event('auth.recovery.finish','ok',['category'=>'security','risk'=>'high','reason'=>'邮件验证后重置后台密码，旧会话已撤销，保留双重验证']);
        session_regenerate_id(true);$_SESSION=['cra1_csrf'=>bin2hex(random_bytes(24))];
        json_out(['status'=>200,'msg'=>'密码已重置，请使用新密码登录。已启用的双重验证仍需验证。']);
    }
    if($action==='auth.captcha'){
        if(!$s->boundedRate('captcha:'.hash('sha256',client_ip()),30,60)){header('Retry-After: 60');throw new CRA1ThemeSecurityError('验证码请求过于频繁，请稍后重试。',429,'RATE_LIMITED');}
        $alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';$code='';for($i=0;$i<5;$i++)$code.=$alphabet[random_int(0,strlen($alphabet)-1)];$_SESSION['security_captcha']=['hash'=>hash('sha256',$code),'expires'=>time()+300];
        $svg='<svg xmlns="http://www.w3.org/2000/svg" width="164" height="52" viewBox="0 0 164 52"><rect width="164" height="52" rx="10" fill="#eeeef0"/>';
        for($i=0;$i<9;$i++)$svg.='<path d="M '.random_int(0,164).' '.random_int(0,52).' L '.random_int(0,164).' '.random_int(0,52).'" stroke="#b2b2b8"/>';
        for($i=0;$i<5;$i++)$svg.='<text x="'.(14+$i*29).'" y="'.random_int(33,42).'" transform="rotate('.random_int(-12,12).' '.(14+$i*29).' 27)" fill="#34343b" font-family="monospace" font-weight="bold" font-size="27">'.$code[$i].'</text>';
        $svg.='</svg>';theme_event('captcha','ok',['category'=>'security','reason'=>'生成本地验证码']);json_out(['status'=>200,'msg'=>'验证码已更新','data'=>['image'=>'data:image/svg+xml;base64,'.base64_encode($svg)]]);
    }
    if($action==='auth.login'){
        theme_event('login','attempt',['category'=>'security','reason'=>'开始密码与账号验证']);
        $name=trim((string)($p['username']??''));$rate=$s->rate($name,client_ip());
        if($rate['blocked']){theme_event('rate.limit','locked',['category'=>'security','risk'=>'high','reason'=>'账号与来源触发登录限流']);header('Retry-After: '.$rate['retry_after']);json_out(['status'=>429,'msg'=>'登录失败，请稍后重试。','code'=>'RATE_LIMITED','data'=>$rate],429);}
        if($rate['captcha_required']&&!theme_captcha_valid($p)){$s->fail($name,client_ip());theme_event('captcha','fail',['category'=>'security','reason'=>'验证码缺失、错误或过期']);json_out(['status'=>400,'msg'=>'登录失败，请检查登录信息。','code'=>'LOGIN_FAILED','data'=>['captcha_required'=>true]],400);}
        $a=$s->checkPassword($name,(string)($p['password']??''));if(!$a){$s->fail($name,client_ip());theme_event('login','fail',['category'=>'security','reason'=>'账号、密码或账号状态验证失败']);json_out(['status'=>400,'msg'=>'登录失败，请检查登录信息。','code'=>'LOGIN_FAILED','data'=>$s->rate($name,client_ip())],400);}
        if(!empty($a['mfa_secret'])){session_regenerate_id(true);unset($_SESSION['security_token'],$_SESSION['cra1_admin']);$t=$s->challenge((int)$a['id'],'login',session_id());theme_event('login','ok',['category'=>'security','actor_id'=>(int)$a['id'],'actor_name'=>$a['username'],'role'=>$a['role'],'reason'=>'密码验证通过，等待双重验证']);json_out(['status'=>200,'msg'=>'请输入动态码或恢复码','data'=>['mfa_required'=>true,'challenge'=>$t,'expires_at'=>time()+300,'captcha_required'=>$rate['captcha_required']]]);}
        $s->clearRate($a['username'],client_ip());$data=theme_new_login($a);theme_event('login','ok',['category'=>'security','reason'=>'独立账号登录成功']);json_out(['status'=>200,'msg'=>'登录成功','data'=>$data]);
    }
    if($action==='auth.mfa'){
        theme_event('login.mfa','attempt',['category'=>'security','reason'=>'开始动态码或恢复码验证']);
        $candidate=$s->rows('SELECT a.id,a.username,a.role FROM challenges c JOIN accounts a ON a.id=c.account_id WHERE c.hash=? AND c.kind=? AND c.session_hash=?',[CRA1ThemeSecurity::hashToken((string)($p['challenge']??'')),'login',CRA1ThemeSecurity::hashToken(session_id())]);$candidate=$candidate[0]??null;$name=$candidate['username']??'#invalid-mfa';$rate=$s->rate($name,client_ip());
        if($rate['blocked']){header('Retry-After: '.$rate['retry_after']);throw new CRA1ThemeSecurityError('登录失败，请稍后重试。',429,'RATE_LIMITED');}
        if($rate['captcha_required']&&!theme_captcha_valid($p)){$s->fail($name,client_ip());json_out(['status'=>400,'msg'=>'登录失败，请检查验证信息。','code'=>'FACTOR_FAILED','data'=>['captcha_required'=>true]],400);}
        try{$v=$s->verifyChallenge((string)($p['challenge']??''),'login',session_id(),(string)($p['code']??''));}catch(CRA1ThemeSecurityError $e){$s->fail($name,client_ip());theme_event('login.mfa','fail',['category'=>'security','actor_id'=>$candidate?(int)$candidate['id']:null,'actor_name'=>$candidate['username']??null,'role'=>$candidate['role']??null,'risk'=>'medium','reason'=>'动态码、恢复码或待验证状态无效']);json_out(['status'=>$e->status,'msg'=>$e->getMessage(),'code'=>$e->errorCode,'data'=>$s->rate($name,client_ip())],$e->status);}
        $a=$v['account'];$s->clearRate($a['username'],client_ip());$data=theme_new_login($a);theme_event('login.mfa','ok',['category'=>'security','reason'=>preg_match('/^\d{6}$/',(string)($p['code']??''))?'动态码验证成功':'一次性恢复码验证成功']);json_out(['status'=>200,'msg'=>'登录成功','data'=>$data]);
    }
    throw new CRA1ThemeSecurityError('未知登录操作',404,'NOT_FOUND');
}
function theme_target(string $action,array $p): string {
    if(strpos($action,'media.')===0)return 'attachment:'.(string)($p['id']??'new');
    if(strpos($action,'security.accounts.')===0)return 'account:'.(string)($p['id']??'new');
    if($action==='security.audit.export')return 'audit';if($action==='path'||$action==='security.settings.save')return 'security';if($action==='security.session.revoke')return 'account:'.(string)($p['account_id']??theme_actor()['id']);
    if(strpos($action,'security.mfa.')===0||strpos($action,'security.recovery.')===0||$action==='security.password')return 'account:'.(theme_actor()['id']??0);
    return (string)($p['domain']??(strpos($action,'member.')===0?'member':(strpos($action,'cart.')===0?'cart':'website'))).':'.(string)($p['editorId']??$p['scopeId']??'all');
}
function theme_read_action(string $a): bool { return in_array($a,['announcements.preview','announcements.legacy-draft','release.check','release.history','release.license.get','release.candidate.get','release.local.list','media.list','media.attachments','get','products','site-pages','link-options','icons','icons.catalog','icons.page','icons.resolve','icons.preview','icon-search','navigation-catalog','product-options','logs','security.my','security.accounts.list','security.audit.list','security.audit.detail','security.settings.get','security.alerts'],true)||preg_match('/\.(get|catalog)$/D',$a)===1; }
function theme_protected_code_changes(array $p,array $current): bool {
    $keys=['custom_code','custom_css','custom_js','custom_css_enabled','custom_js_enabled'];
    foreach($p as$k=>$v){if(in_array($k,$keys,true)){if($v===null||!array_key_exists($k,$current)||json_encode($current[$k])!==json_encode($v))return true;}elseif(is_array($v)){if(theme_protected_code_changes($v,$current))return true;}elseif(is_string($v)&&preg_match('/(?:overrides|config|patch).*json$/i',(string)$k)){$d=json_decode($v,true);if(is_array($d)&&theme_protected_code_changes($d,$current))return true;}}
    return false;
}
function theme_read_domains(): array { $out=[];foreach(['website'=>'config','member'=>'member_center','cart'=>'cart_theme','announcements'=>'announcements']as$d=>$file){$r=json_decode((string)@file_get_contents($GLOBALS['ROOT'].'/runtime/cra1_theme/'.$file.'.json'),true);$out[$d]=is_array($r)?$r:[];}return $out; }
function theme_diff(array $before,array $after): array {
    $out=[];foreach($after as$domain=>$new){$old=$before[$domain]??[];$keys=array_unique(array_merge(array_keys($old),array_keys($new)));foreach($keys as$k){if(json_encode($old[$k]??null)===json_encode($new[$k]??null))continue;$a=json_encode($old[$k]??null,JSON_UNESCAPED_UNICODE);$b=json_encode($new[$k]??null,JSON_UNESCAPED_UNICODE);$item=['domain'=>$domain,'field'=>$k,'before'=>['bytes'=>strlen($a),'sha256'=>hash('sha256',$a)],'after'=>['bytes'=>strlen($b),'sha256'=>hash('sha256',$b)]];if(!in_array($k,['custom_code','custom_css','custom_js'],true)&&is_scalar($old[$k]??null)&&is_scalar($new[$k]??null)&&strlen($a)<200&&strlen($b)<200)$item+=['old'=>CRA1ThemeSecurity::safeDetail((string)$old[$k]),'new'=>CRA1ThemeSecurity::safeDetail((string)$new[$k])];$out[]=$item;}}return $out;
}
function theme_api_guard(string $action,array $p): void {
    $a=theme_actor();if(!$a)throw new CRA1ThemeSecurityError('未登录或会话已过期',401,'SESSION_INVALID');theme_request_check();
    if(is_file($GLOBALS['ROOT'].'/runtime/cra1_theme/distribution/pending.json')&&!theme_read_action($action)&&!in_array($action,['release.recover','auth.reauth','logout','security.password'],true))throw new CRA1ThemeSecurityError('主题更新尚未完成，请先从主题管理恢复。',503,'THEME_UPDATE_PENDING');
    $domain=(string)($p['domain']??(strpos($action,'member.')===0?'member':(strpos($action,'cart.')===0?'cart':'website')));$domains=null;$code=false;
    if(!theme_read_action($action)||$action==='workspace.preview'){$domains=theme_read_domains();$current=$domains[$domain]??[];if($domain==='website')$current+=\template\cra1\controller\Cra1::defaults();elseif($domain==='member')$current+=MemberCenterStore::defaults();elseif($domain==='cart')$current+=CartThemeStore::defaults();$code=theme_protected_code_changes($p,$current);}
    if(strpos($action,'release.')===0)theme_require_role(in_array($action,['release.check','release.history','release.license.get'],true)?['admin','super_admin']:['super_admin']);
    if($action==='path'||$action==='security.settings.get'||$action==='security.settings.save'||$code)theme_require_role(['super_admin']);
    if(in_array($action,['media.delete','media.restore','reset','member.reset','cart.reset','workspace.snapshot.rebuild','security.accounts.list','security.accounts.create','security.accounts.update','security.audit.export'],true)||(strpos($action,'import')!==false&&in_array($p['mode']??'',['replace','first'],true)))theme_require_role(['admin','super_admin']);
    if(preg_match('/save|import|preview$/',$action)&&strpos($action,'security.')!==0){$normal=$p;unset($normal['_reauth']);theme_safe_content($normal);}
    if($a['must_change']&&!theme_read_action($action)&&!in_array($action,['auth.reauth','security.password','logout','security.session.revoke','workspace.preview'],true))throw new CRA1ThemeSecurityError('请先在“我的安全”修改初始密码。',403,'PASSWORD_CHANGE_REQUIRED');
    if($action==='security.session.revoke'&&(int)($p['account_id']??$a['id'])!==(int)$a['id']){theme_require_role(['admin','super_admin']);theme_security()->manageAllowed($a,theme_security()->account((int)$p['account_id']));}
    $step=($action==='security.session.revoke'&&(int)($p['account_id']??$a['id'])!==(int)$a['id'])||in_array($action,['release.license.save','reset','member.reset','cart.reset','path','security.settings.save','security.accounts.create','security.accounts.update','security.audit.export','security.password','security.mfa.begin','security.mfa.disable','security.mfa.recovery','security.recovery.begin','security.recovery.remove'],true)||$code;
    if($step)theme_security()->useReauth((string)($p['_reauth']??''),(string)($_SESSION['security_token']??''),$action,theme_target($action,$p));
    if(!theme_read_action($action)){
        // Config writers hold a shared lock; reference checking/deletion holds an exclusive lock.
        if(strpos($action,'release.')!==0 && strpos($action,'auth.')!==0 && strpos($action,'media.')!==0 && strpos($action,'security.')!==0 && !in_array($action,['logout','path'],true)) {
            require_once __DIR__.'/cra1_theme_media.php';
            $GLOBALS['THEME_MEDIA_WRITE_LOCK']=(new CRA1ThemeMediaStore($GLOBALS['ROOT']))->lock();
        }
        $releaseWrite=in_array($action,['release.upload','release.local.import','release.apply','release.rollback','release.recover'],true);
        $GLOBALS['THEME_WRITE']=['action'=>$action,'target'=>theme_target($action,$p),'risk'=>$step||$releaseWrite?'high':'low','category'=>strpos($action,'security.')===0||$action==='logout'||$action==='path'?'security':'operation','before'=>$domains??theme_read_domains(),'code'=>$code];
        if($action==='security.accounts.update'){$GLOBALS['THEME_WRITE']['account_before']=CRA1ThemeSecurity::publicAccount(theme_security()->account((int)($p['id']??0)));$GLOBALS['THEME_WRITE']['password_reset']=array_key_exists('password',$p);$GLOBALS['THEME_WRITE']['mfa_reset']=!empty($p['reset_mfa']);}
        if($action==='security.settings.save')$GLOBALS['THEME_WRITE']['settings_before']=theme_security()->settings();
        if($action==='path')$GLOBALS['THEME_WRITE']['entry_before']=$GLOBALS['SLUG'];
        try{theme_event($action,'attempt',['category'=>$GLOBALS['THEME_WRITE']['category'],'target'=>$GLOBALS['THEME_WRITE']['target'],'risk'=>$GLOBALS['THEME_WRITE']['risk'],'reason'=>$code?'准备修改受保护的自定义代码':'准备执行写操作']);}catch(Throwable $e){unset($GLOBALS['THEME_WRITE']);throw new CRA1ThemeSecurityError('审计服务不可用，本次操作未执行。',503,'AUDIT_UNAVAILABLE');}
    }
}
function theme_api_complete(array $data): array {
    $w=$GLOBALS['THEME_WRITE']??null;if(!$w)return $data;unset($GLOBALS['THEME_WRITE']);$status=(int)($data['status']??500);$diff=theme_diff($w['before'],theme_read_domains());$partial=($data['data']['snapshot_ok']??true)===false;
    if($status===200&&strpos($w['action'],'media.')===0&&isset($data['data']['id'])){ $w['target']='attachment:'.$data['data']['id'];$diff[]=['field'=>'attachment','id'=>$data['data']['id'],'name'=>$data['data']['name']??'','url'=>$data['data']['url']??'','kind'=>$data['data']['kind']??'','bytes'=>$data['data']['bytes']??0]; }
    if($status===200&&strpos($w['action'],'security.accounts.')===0&&isset($data['data']['id'])){$account=$data['data'];$w['target']='account:'.$account['id'];$old=$w['account_before']??[];foreach(['username','role','enabled','mfa_enabled','must_change']as$k)if(($old[$k]??null)!==($account[$k]??null))$diff[]=['field'=>$k,'before'=>$old[$k]??null,'after'=>$account[$k]??null];if(!empty($w['password_reset']))$diff[]=['field'=>'password_reset','changed'=>true];if(!empty($w['mfa_reset']))$diff[]=['field'=>'mfa_reset','changed'=>true];}
    if($status===200&&isset($w['settings_before'])){foreach(theme_security()->settings()as$k=>$v)if(json_encode($w['settings_before'][$k]??null)!==json_encode($v))$diff[]=['field'=>$k,'before'=>$w['settings_before'][$k]??null,'after'=>$v];}
    if($status===200&&isset($w['entry_before'])){$r=json_decode((string)@file_get_contents($GLOBALS['ROOT'].'/runtime/cra1_theme/entry.json'),true);$diff[]=['field'=>'entry','before'=>$w['entry_before'],'after'=>$r['entry']??''];}
    try{theme_event($w['action'],$status===200?($partial?'partial':'ok'):'fail',['category'=>$w['category'],'target'=>$w['target'],'risk'=>$w['risk'],'reason'=>$status===200?($partial?'配置已保存，公开快照同步失败':($w['code']?'自定义代码已更新，仅记录摘要':'操作已完成')):(string)($data['msg']??'操作失败')],$diff);}catch(Throwable $e){$data['code']='AUDIT_COMPLETION_FAILED';$data['msg']=$status===200?'已保存，审计记录异常，请联系超级管理员。':'操作未完成，审计记录异常，请联系超级管理员。';$data['data']['audit_ok']=false;}
    return $data;
}
function theme_security_api(string $action,array $p): void {
    $s=theme_security();$a=theme_actor();$id=(int)$a['id'];$token=(string)$_SESSION['security_token'];
    if($action==='auth.reauth'){
        $rate=$s->rate($a['username'].'#reauth',client_ip());if($rate['blocked'])throw new CRA1ThemeSecurityError('验证次数过多，请稍后重试。',429,'RATE_LIMITED');
        try{$cap=$s->reauthenticate($a,(string)($p['password']??''),(string)($p['code']??''),$token,(string)($p['action']??''),(string)($p['target']??''));}catch(CRA1ThemeSecurityError $e){$s->fail($a['username'].'#reauth',client_ip());theme_event('auth.reauth','fail',['category'=>'security','risk'=>'medium','reason'=>'密码或第二因素验证失败']);throw $e;}
        if(session_status()!==PHP_SESSION_ACTIVE)session_start();session_regenerate_id(true);session_write_close();$s->clearRate($a['username'].'#reauth',client_ip());json_out(['status'=>200,'msg'=>'身份已验证','data'=>['credential'=>$cap,'expires_at'=>time()+300]]);
    }
    if($action==='security.my')json_out(['status'=>200,'msg'=>'已读取','data'=>['account'=>CRA1ThemeSecurity::publicAccount($a),'sessions'=>$s->sessionList($id,$token),'recovery_remaining'=>count(json_decode($a['recovery_hashes'],true)?:[]),'recovery_email'=>(new \CRA1\Theme\Security\AdminRecovery($s))->status($id)]]);
    if($action==='security.recovery.begin')json_out(['status'=>200,'msg'=>'验证码已发送，请在 5 分钟内完成验证','data'=>(new \CRA1\Theme\Security\AdminRecovery($s))->beginBinding($a,$token,(string)($p['email']??''),client_ip())]);
    if($action==='security.recovery.confirm'){(new \CRA1\Theme\Security\AdminRecovery($s))->finishBinding($a,(string)($p['challenge']??''),$token,(string)($p['code']??''));json_out(['status'=>200,'msg'=>'找回邮箱已绑定，请重新登录','data'=>['relogin'=>true]]);}
    if($action==='security.recovery.remove'){(new \CRA1\Theme\Security\AdminRecovery($s))->removeBinding($a);json_out(['status'=>200,'msg'=>'找回邮箱已解除，请重新登录','data'=>['relogin'=>true]]);}
    if($action==='security.password'){$s->changeOwnPassword($a,(string)($p['new_password']??''));json_out(['status'=>200,'msg'=>'密码已更新，请重新登录。','data'=>['relogin'=>true]]);}
    if($action==='security.session.revoke'){$target=(int)($p['account_id']??$id);if($target!==$id){$s->manageAllowed($a,$s->account($target));theme_require_role(['admin','super_admin']);}$h=!empty($p['session_id'])?(string)$p['session_id']:null;$s->revoke($target,$h);json_out(['status'=>200,'msg'=>'会话已撤销','data'=>['relogin'=>$target===$id&&($h===null||hash_equals($h,CRA1ThemeSecurity::hashToken($token)))]]);}
    if($action==='security.mfa.begin')json_out(['status'=>200,'msg'=>'绑定准备完成','data'=>$s->enrollment($a,$token)]);
    if($action==='security.mfa.cancel'){$s->db->prepare("UPDATE challenges SET used_at=? WHERE account_id=? AND kind='enroll' AND session_hash=? AND used_at=0")->execute([time(),$id,CRA1ThemeSecurity::hashToken($token)]);json_out(['status'=>200,'msg'=>'已取消绑定']);}
    if($action==='security.mfa.confirm'){$c=$s->rows('SELECT account_id FROM challenges WHERE hash=?',[CRA1ThemeSecurity::hashToken((string)($p['challenge']??''))]);if(!$c||(int)$c[0]['account_id']!==$id)throw new CRA1ThemeSecurityError('绑定状态无效',403,'PERMISSION_DENIED');$r=$s->enableMfa((string)$p['challenge'],$token,(string)($p['code']??''));if(!empty($r['failed']))throw new CRA1ThemeSecurityError('动态码验证失败',400,'FACTOR_FAILED');json_out(['status'=>200,'msg'=>'双重验证已启用，请保存恢复码并重新登录。','data'=>$r+['relogin'=>true]]);}
    if(in_array($action,['security.mfa.disable','security.mfa.recovery'],true)){$r=$s->mfaAction($id,$action==='security.mfa.disable'?'disable':'recovery');json_out(['status'=>200,'msg'=>'双重验证设置已更新，请重新登录。','data'=>$r+['relogin'=>true]]);}
    if($action==='security.accounts.list'){$where=$a['role']==='admin'?" WHERE role='operator'":'';json_out(['status'=>200,'msg'=>'已读取','data'=>['list'=>array_map([CRA1ThemeSecurity::class,'publicAccount'],$s->rows('SELECT * FROM accounts'.$where.' ORDER BY id LIMIT 200'))]]);}
    if($action==='security.accounts.create')json_out(['status'=>200,'msg'=>'账号已创建，首次登录需修改密码','data'=>$s->createAccount($a,$p)]);
    if($action==='security.accounts.update')json_out(['status'=>200,'msg'=>'账号已更新，相关会话已撤销','data'=>$s->changeAccount($a,(int)($p['id']??0),array_intersect_key($p,array_flip(['role','enabled','password','reset_mfa']))) ]);
    if($action==='security.settings.get')json_out(['status'=>200,'msg'=>'已读取','data'=>$s->settings()+['entry'=>$GLOBALS['SLUG']]]);
    if($action==='security.settings.save'){if(!empty($p['settings']['force_https'])&&!$GLOBALS['THEME_NETWORK']['https'])throw new CRA1ThemeSecurityError('请先通过已生效的 HTTPS 访问后台，再开启强制 HTTPS。');$s->updateSettings((array)($p['settings']??[]));json_out(['status'=>200,'msg'=>'安全策略已更新，请重新登录','data'=>['relogin'=>true]]);}
    if($action==='security.audit.list'||$action==='logs')json_out(['status'=>200,'msg'=>'已读取','data'=>$s->logs($a,$p)]);
    if($action==='security.audit.detail')json_out(['status'=>200,'msg'=>'已读取','data'=>$s->logDetail($a,(int)($p['id']??0))]);
    if($action==='security.audit.export'){
        $r=$s->logs($a,$p,5000);$GLOBALS['THEME_WRITE']=null;theme_event('security.audit.export','ok',['category'=>'security','risk'=>'high','target'=>'audit','reason'=>'导出脱敏审计记录，最多 5000 条']);header('Content-Type: text/csv; charset=utf-8');header('Content-Disposition: attachment; filename="theme-audit-'.date('Ymd-His').'.csv"');if($r['hasMore'])header('X-Next-Cursor: '.$r['nextCursor']);$f=fopen('php://output','w');fwrite($f,"\xEF\xBB\xBF");fputcsv($f,['时间','操作人','角色','操作','目标','结果','风险','IP','原因','请求 ID']);foreach($r['list']as$row)fputcsv($f,array_map([CRA1ThemeSecurity::class,'csvCell'],[date('Y-m-d H:i:s',(int)$row['time']),$row['actor_name'],$row['role_label'],$row['action_label'],$row['target'],$row['result_label'],$row['risk_label'],$row['ip'],$row['reason_label'],$row['request_id']]));fclose($f);exit;
    }
    if($action==='security.alerts'){theme_require_role(['admin','super_admin']);$r=$s->rows('SELECT * FROM alerts WHERE read_at=0 ORDER BY last_at DESC LIMIT 30');foreach($r as&$v)$v['label']=CRA1ThemeSecurity::actionLabel($v['action']);json_out(['status'=>200,'msg'=>'已读取','data'=>['list'=>$r]]);}
    throw new CRA1ThemeSecurityError('未知安全操作',404,'NOT_FOUND');
}
/** Validate normal content with a DOM allowlist. Explicit custom code is handled separately. */
function theme_safe_content($v,string $key=''): void {
    if(in_array($key,['custom_code','custom_css','custom_js','custom_css_enabled','custom_js_enabled'],true))return;
    if(is_array($v)){foreach($v as$k=>$x)theme_safe_content($x,(string)$k);return;}if(!is_string($v)||$v==='')return;
    $decoded=html_entity_decode($v,ENT_QUOTES|ENT_HTML5,'UTF-8');$normal=preg_replace('/[\x00-\x20\x7f]+/','',$decoded);
    if(preg_match('/(?:javascript|vbscript|file|data|blob)\s*:/i',$normal))throw new CRA1ThemeSecurityError('内容包含不允许的链接协议');
    if(preg_match('/^\s*\/\//',$decoded))throw new CRA1ThemeSecurityError('链接不允许使用省略协议的外部地址');
    if(strpos($v,'<')===false)return;
    // Icon ID strings, prose comparisons and CSS-style JSON do not become HTML.
    if(!preg_match('/<\s*[a-z!]/i',$v))return;
    $doc=new DOMDocument();$old=libxml_use_internal_errors(true);$doc->loadHTML('<?xml encoding="UTF-8"><div id="theme-safety">'.$v.'</div>',LIBXML_HTML_NOIMPLIED|LIBXML_HTML_NODEFDTD);libxml_clear_errors();libxml_use_internal_errors($old);
    $tags=['div','span','p','br','a','strong','b','em','i','u','s','small','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','pre','code','table','thead','tbody','tfoot','tr','th','td','img','hr','section','figure','figcaption','sup','sub'];
    $attrs=['class','title','href','src','alt','target','rel','width','height','colspan','rowspan','aria-label','style','id','loading'];
    foreach($doc->getElementsByTagName('*')as$el){if(!in_array(strtolower($el->tagName),$tags,true))throw new CRA1ThemeSecurityError('富文本包含不允许的元素');foreach($el->attributes as$attr){$name=strtolower($attr->name);if(!in_array($name,$attrs,true))throw new CRA1ThemeSecurityError('富文本包含不允许的属性');$value=html_entity_decode($attr->value,ENT_QUOTES,'UTF-8');if(in_array($name,['src','href'],true)&&!preg_match('~^(?:/(?!/)|\#|https?://|tel:|mailto:|$)~i',$value))throw new CRA1ThemeSecurityError('富文本链接不符合白名单');if($name==='style'&&preg_match('/url\s*\(|expression|@import|behavior|-moz-binding|\\\\/i',$value))throw new CRA1ThemeSecurityError('富文本样式不符合白名单');}}
}

register_shutdown_function(static function(): void {if(!empty($GLOBALS['THEME_WRITE'])){theme_api_complete(['status'=>500,'msg'=>'请求意外中断，请核对保存状态。']);}});
