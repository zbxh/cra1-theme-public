<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('X-Robots-Tag: noindex');
ini_set('session.use_strict_mode','1');session_name('CRA1INSTALL');session_set_cookie_params(['lifetime'=>0,'path'=>'/cra1-install/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);session_start();
$root=dirname(__DIR__,2);require_once $root.'/cra1-theme/backend/bootstrap.php';
try{
    $https=!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off';
    if(!$https)throw new RuntimeException('安装与维护需要有效 HTTPS 地址');
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!is_string($_SESSION['csrf']??null)||!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))throw new RuntimeException('请求校验失败，请重新打开安装页');
    $origin=parse_url((string)($_SERVER['HTTP_ORIGIN']??''));
    $authority=strtolower(($origin['host']??'').(isset($origin['port'])?':'.$origin['port']:''));
    if(($origin['scheme']??'')!=='https'||$authority!==strtolower((string)($_SERVER['HTTP_HOST']??''))||($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')throw new RuntimeException('请从本站安装页面执行');
    $raw=(string)file_get_contents('php://input',false,null,0,16385);if(strlen($raw)>16384)throw new RuntimeException('请求过大');
    $input=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($input)||!in_array($input['action']??'',['check','install'],true))throw new RuntimeException('未知安装操作');
    $bearer=(string)($_SERVER['HTTP_AUTHORIZATION']??'');
    $result=\CRA1\Theme\Http\NativeAdmin::run($root,$bearer,static function()use($root,$input,$https){
        $installer=new \CRA1\Theme\Release\Installer($root);$siteOrigin='https://'.(string)$_SERVER['HTTP_HOST'];
        // Native authentication above must succeed before any installer probe writes.
        if($installer->state()['mode']==='install') {
            try { \CRA1\Theme\Release\PrivatePaths::ensure($root,$siteOrigin); }
            catch(Throwable $error) { error_log('CRA1 installer environment probe failed: '.get_class($error)); }
        }
        $preflight=$installer->preflight(['https'=>$https,'origin'=>$siteOrigin]);
        if($input['action']==='check')return ['status'=>200,'data'=>$preflight];
        $model=new \app\common\model\ConfigurationModel();
        $data=$installer->install($input,static function()use($model){return $model->themeList();},static function($settings)use($model){
            $validator=new \app\admin\validate\ConfigurationValidate();
            if(!$validator->scene('theme_update')->check($settings))return ['status'=>400];
            return $model->themeUpdate($settings);
        },$preflight);
        return ['status'=>200,'msg'=>'安装成功','data'=>$data];
    });
}catch(Throwable $e){error_log('CRA1 installer rejected: '.get_class($e).' at '.basename($e->getFile()).':'.$e->getLine());$result=['status'=>400,'msg'=>$e instanceof RuntimeException||$e instanceof InvalidArgumentException?$e->getMessage():'安装服务暂不可用，请检查环境'];}
session_write_close();http_response_code(in_array($result['status'],[401,403],true)?$result['status']:200);echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);
