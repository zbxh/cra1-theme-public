<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;

final class NativeAdmin
{
    /** Re-enter the real native authentication route; never decode a JWT without verifying it. */
    public static function run(string $root,string $bearer,callable $work): array
    {
        if(!preg_match('/^Bearer [^\s]{1,8192}$/D',$bearer))return ['status'=>401,'msg'=>'请先在同一浏览器登录 V10 超级管理员账号'];
        require_once $root.'/config.php';require_once $root.'/vendor/autoload.php';
        if(!defined('IDCSMART_ROOT'))define('IDCSMART_ROOT',$root.'/');
        if(!defined('WEB_ROOT'))define('WEB_ROOT',$root.'/public/');
        if(!defined('UPLOAD_DEFAULT'))define('UPLOAD_DEFAULT',WEB_ROOT.'upload/common/default/');
        $_GET=[];$_POST=[];$_REQUEST=[];
        $_SERVER['HTTP_AUTHORIZATION']=$bearer;$_SERVER['REQUEST_METHOD']='GET';
        $_SERVER['PATH_INFO']='/'.DIR_ADMIN.'/v1/login_info';$_SERVER['REQUEST_URI']=$_SERVER['PATH_INFO'];
        $_SERVER['SCRIPT_NAME']='/index.php';$_SERVER['PHP_SELF']='/index.php';
        unset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
        $level=ob_get_level();ob_start();
        try{
            $app=new \think\App($root.'/');$app->debug(false);$app->initialize();
            $request=$app->make('request',[],true);$request->setMethod('GET');
            $response=$app->http->run($request);$data=$response->getData();
            if(!is_array($data))$data=json_decode(json_encode($data),true);
            if((int)($data['status']??0)!==200||(int)$request->admin_id!==1){$result=['status'=>(int)($data['status']??0)===200?403:401,'msg'=>'安装与维护仅允许已登录的 V10 超级管理员执行'];}
            else $result=$work($request);
            $app->http->end($response);
            return $result;
        }finally{while(ob_get_level()>$level)ob_end_clean();header_remove('Location');}
    }
}
