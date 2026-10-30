<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('X-Robots-Tag: noindex');
ini_set('session.use_strict_mode','1');session_name('CRA1INSTALL');session_set_cookie_params(['lifetime'=>0,'path'=>'/cra1-install/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);$sessionReady=@session_start();
$root=dirname(__DIR__,2);
try{
    if(!$sessionReady)throw new RuntimeException('安装会话无法保存，请在网站面板检查 PHP 会话目录的写入权限后重新打开安装页');
    if(!is_file($root.'/cra1-theme/backend/bootstrap.php'))throw new RuntimeException('主题安装文件不完整，请将安装包解压到 V10 网站根目录后重新打开安装页');
    if(!is_readable($root.'/cra1-theme/backend/bootstrap.php'))throw new RuntimeException('主题启动文件无法读取，请在网站面板检查 cra1-theme/backend/ 的目录访问权限和文件读取权限');
    define('CRA1_THEME_INSTALLER_CANDIDATE',true);
    require_once $root.'/cra1-theme/backend/bootstrap.php';
    $https=!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off';
    if(!$https)throw new RuntimeException('安装与维护需要有效 HTTPS 地址');
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!is_string($_SESSION['csrf']??null)||!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))throw new RuntimeException('请求校验失败，请重新打开安装页');
    $origin=parse_url((string)($_SERVER['HTTP_ORIGIN']??''));
    $authority=strtolower(($origin['host']??'').(isset($origin['port'])?':'.$origin['port']:''));
    if(($origin['scheme']??'')!=='https'||$authority!==strtolower((string)($_SERVER['HTTP_HOST']??''))||($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')throw new RuntimeException('请从本站安装页面执行');
    $raw=(string)file_get_contents('php://input',false,null,0,16385);if(strlen($raw)>16384)throw new RuntimeException('请求过大');
    $input=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($input)||!in_array($input['action']??'',['check','install','update','recover_update'],true))throw new RuntimeException('未知安装操作');
    $bearer=(string)($_SERVER['HTTP_AUTHORIZATION']??'');
    $result=\CRA1\Theme\Http\NativeAdmin::run($root,$bearer,static function()use($root,$input,$https,$bearer){
        $installer=new \CRA1\Theme\Release\Installer($root);$siteOrigin='https://'.(string)$_SERVER['HTTP_HOST'];
        if($installer->state()['mode']==='maintenance'){
            $overlay=new \CRA1\Theme\Release\Overlay($root);
            if($input['action']==='check'){
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
                ||($saved['expires']??0)<time()||!hash_equals((string)($saved['admin']??''),hash('sha256',$bearer)))throw new RuntimeException('更新检查已失效，请重新点击“验证并检查”');
            if($input['action']==='update'&&($input['backup_confirmed']??false)!==true)throw new RuntimeException('请先备份网站，再勾选已备份');
            if(function_exists('set_time_limit'))@set_time_limit(120);
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
        // Native authentication above must succeed before any installer probe writes.
        if($installer->state()['mode']==='install') {
            try { \CRA1\Theme\Release\PrivatePaths::ensure($root,$siteOrigin,null,$input['action']==='check'); }
            catch(Throwable $error) { error_log('CRA1 installer environment probe failed: '.get_class($error)); }
        }
        $preflight=$installer->preflight(['https'=>$https,'origin'=>$siteOrigin]);
        if($input['action']==='check')return ['status'=>200,'data'=>$preflight];
        $data=$installer->install($input,$preflight,$siteOrigin);
        return ['status'=>200,'msg'=>'安装成功','data'=>$data];
    });
}catch(Throwable $e){error_log('CRA1 installer rejected: '.get_class($e).' at '.basename($e->getFile()).':'.$e->getLine());$result=['status'=>400,'msg'=>$e instanceof InvalidArgumentException||get_class($e)===RuntimeException::class||$e instanceof \CRA1ThemeSecurityError?$e->getMessage():'安装服务暂不可用，请检查环境后重新点击“验证并检查”'];}
session_write_close();header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');http_response_code(in_array($result['status'],[401,403],true)?$result['status']:200);echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);
