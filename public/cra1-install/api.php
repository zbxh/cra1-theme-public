<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('X-Robots-Tag: noindex');
$https=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')||strtolower(trim(explode(',',(string)($_SERVER['HTTP_X_FORWARDED_PROTO']??''))[0]))==='https';
ini_set('session.use_strict_mode','1');session_name($https?'CRA1INSTALL':'CRA1INSTALL_HTTP');session_set_cookie_params(['lifetime'=>0,'path'=>'/cra1-install/','secure'=>$https,'httponly'=>true,'samesite'=>'Strict']);$sessionReady=@session_start();
$root=dirname(__DIR__,2);
$phase='读取安装程序';$input=[];
try{
    if(!$sessionReady)throw new RuntimeException('安装会话无法保存，请在网站面板检查 PHP 会话目录的写入权限后重新打开安装页');
    if(!is_file($root.'/cra1-theme/backend/bootstrap.php'))throw new RuntimeException('主题安装文件不完整，请将安装包解压到 V10 网站根目录后重新打开安装页');
    if(!is_readable($root.'/cra1-theme/backend/bootstrap.php'))throw new RuntimeException('主题启动文件无法读取，请在网站面板检查 cra1-theme/backend/ 的目录访问权限和文件读取权限');
    define('CRA1_THEME_INSTALLER_CANDIDATE',true);
    require_once $root.'/cra1-theme/backend/bootstrap.php';
    $phase='读取安装请求';
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!is_string($_SESSION['csrf']??null)||!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))throw new RuntimeException('页面会话已失效，请刷新安装页');
    require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php';
    $siteOrigin=method_exists(CRA1ThemeSecurity::class,'currentOrigin')?CRA1ThemeSecurity::currentOrigin($_SERVER):(($https?'https':'http').'://'.($_SERVER['HTTP_HOST']??''));
    $raw=(string)file_get_contents('php://input',false,null,0,16385);if(strlen($raw)>16384)throw new RuntimeException('请求过大');
    $input=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($input)||!in_array($input['action']??'',['check','install','update','recover_update'],true))throw new RuntimeException('未知安装操作');
    $bearer=(string)($_SERVER['HTTP_AUTHORIZATION']??'');
    $phase='读取安装状态';
    $installer=new \CRA1\Theme\Release\Installer($root);
    $work=static function()use($root,$input,$siteOrigin,$bearer,$installer,&$phase){
        if($installer->state()['mode']==='maintenance'){
            $phase='读取已有主题';
            $overlay=new \CRA1\Theme\Release\Overlay($root);
            if($input['action']==='check'){
                $phase='检查解压的更新文件';
                \CRA1\Theme\Release\Overlay::discard($root,$_SESSION['overlay']['confirmation']??[]);
                unset($_SESSION['overlay']);
                $prepared=$overlay->prepare();$data=$prepared['data'];
                if(isset($prepared['confirmation'])){
                    $token=bin2hex(random_bytes(32));
                    $_SESSION['overlay']=['token'=>$token,'expires'=>time()+900,'admin'=>hash('sha256',$bearer),'confirmation'=>$prepared['confirmation']];
                    $data['confirmation']=$token;
                }
                return ['status'=>200,'data'=>$data];
            }
            if(!in_array($input['action'],['update','recover_update'],true))throw new RuntimeException('本站已经安装，请使用“完成更新”，不会重新初始化账号或配置');
            $saved=$_SESSION['overlay']??[];
            if(!is_string($input['confirmation']??null)||!is_string($saved['token']??null)||!hash_equals($saved['token'],$input['confirmation'])
                ||($saved['expires']??0)<time()||!hash_equals((string)($saved['admin']??''),hash('sha256',$bearer)))throw new RuntimeException('更新检查已失效，请点击“重新检测”');
            if($input['action']==='update'&&($input['backup_confirmed']??false)!==true)throw new RuntimeException('请先备份网站，再勾选已备份');
            if(function_exists('set_time_limit'))@set_time_limit(120);
            $phase=$input['action']==='update'?'完成主题更新':'恢复未完成的更新';
            $data=$input['action']==='update'?$overlay->apply($saved['confirmation']):$overlay->recover($saved['confirmation']);
            \CRA1\Theme\Release\Overlay::discard($root,$saved['confirmation']);
            if(empty($saved['completed'])){
                try{
                    require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php';
                    (new \CRA1ThemeSecurity($root))->event($input['action']==='update'?'distribution.overlay_update':'distribution.overlay_recover','ok',
                        ['category'=>'security','actor_id'=>0,'actor_name'=>'V10超级管理员','role'=>'super_admin','target'=>'theme','reason'=>'固定维护入口完成','risk'=>'high']);
                }catch(Throwable $error){error_log('CRA1 maintenance audit failed: '.get_class($error));}
            }
            $_SESSION['overlay']['completed']=true;
            if($input['action']==='recover_update')unset($_SESSION['overlay']);
            return ['status'=>200,'msg'=>$input['action']==='update'?'更新完成':'已恢复，请重新检查','data'=>$data];
        }
        if(!in_array($input['action'],['check','install'],true))throw new RuntimeException('请先完成首次安装');
        $phase='读取运行环境';
        $preflight=$installer->preflight();
        if($input['action']==='check')return ['status'=>200,'data'=>$preflight];
        $phase='创建主题后台';
        $data=$installer->install($input,$preflight,$siteOrigin);
        return ['status'=>200,'msg'=>'安装成功','data'=>$data];
    };
    // A newly extracted theme has no independent administrator yet. Complete
    // its one-time setup directly; the install lock rechecks state atomically.
    // Existing installations keep their authentication and are never reset.
    if($installer->state()['mode']==='install')$result=$work();
    else{
        $phase='验证更新权限';
        $result=\CRA1\Theme\Http\NativeAdmin::run($root,$bearer,$work);
        if(in_array($result['status']??0,[401,403],true))$result['msg']='本站已安装主题。可从原主题后台上传安装包更新；通过此入口完成解压更新时，请先登录本站 V10 系统超级管理员。';
    }
}catch(Throwable $e){
    $secrets=[is_string($input['password']??null)?$input['password']:'',(string)($_SERVER['HTTP_AUTHORIZATION']??'')];
    if(class_exists(\CRA1\Theme\Release\InstallerFailure::class)){
        $result=\CRA1\Theme\Release\InstallerFailure::response($e,$phase,$root,$secrets);
    }else{
        // Bootstrap failures must also explain the cause. This fallback runs
        // before the selected backend and its error formatter can be loaded.
        foreach(['DATABASE_PASSWORD','DATABASE_USERNAME','DATABASE_NAME','DATABASE_HOSTNAME']as$name)if(defined($name))$secrets[]=(string)constant($name);
        $reason=$e->getMessage();
        foreach($secrets as$secret)if(strlen($secret)>=3)$reason=str_replace($secret,'[已隐藏]',$reason);
        $reason=str_replace([$root.'/', $root],['','网站根目录'],$reason);
        $reason=(string)preg_replace('/Bearer\s+[^\s,;]+/i','Bearer [已隐藏]',$reason);
        $reason=(string)preg_replace('/\b(password|passwd|pwd|secret|token|csrf|cookie|jwt|authorization)\b["\x27]?\s*[:=]\s*(?:"[^"]*"|\x27[^\x27]*\x27|[^\s,;&]+)/i','$1=[已隐藏]',$reason);
        $reason=(string)preg_replace('~(?<![\w/:])/(?:[^/\s()<>"\x27:]+/)+([^/\s()<>"\x27:]+)~u','[目录]/$1',$reason);
        $reason=substr(str_replace(["\r","\n","\0"],' ',$reason),0,1200);
        if($reason==='')$reason='服务未返回错误原因（'.get_class($e).'）';
        $reference=strtoupper(bin2hex(random_bytes(6)));
        error_log('CRA1 installer '.json_encode(['reference'=>$reference,'phase'=>$phase,'type'=>get_class($e),'file'=>basename($e->getFile()),'line'=>$e->getLine(),'message'=>$reason],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE));
        $result=['status'=>400,'msg'=>'操作在“'.$phase.'”时失败。'."\n".'原因：'.$reason."\n".'参考编号：'.$reference,
            'error'=>['phase'=>$phase,'reason'=>$reason,'reference'=>$reference,'needs_check'=>true]];
    }
}
session_write_close();header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');http_response_code(in_array($result['status'],[401,403],true)?$result['status']:200);echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);
