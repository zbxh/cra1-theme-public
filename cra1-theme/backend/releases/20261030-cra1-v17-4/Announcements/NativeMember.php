<?php
declare(strict_types=1);
namespace CRA1\Theme\Announcements;

/** Optional, read-only native member authentication for public notification readers. */
final class NativeMember
{
    public static function authenticated(string $root,string $authorization): bool
    {
        // Cookies alone must not retain private notices after local logout.
        if (!preg_match('/^Bearer ([^\s]{1,8192})$/D',$authorization,$match)) return false;
        $level=ob_get_level();ob_start();
        try {
            require_once $root.'/config.php';
            require_once $root.'/vendor/autoload.php';
            if (!defined('IDCSMART_ROOT')) define('IDCSMART_ROOT',$root.'/');
            if (!defined('WEB_ROOT')) define('WEB_ROOT',$root.'/public/');
            if (!defined('UPLOAD_DEFAULT')) define('UPLOAD_DEFAULT',WEB_ROOT.'upload/common/default/');
            $app=new \think\App($root.'/');$app->debug(false);$app->initialize();
            $request=$app->make('request',[],true);$request->client_id=0;
            // Reuse the native JWT/cache/logout/password checks, then the native
            // read-only page guard for account status, IP and session expiry.
            $guard=new class($match[1]) extends \app\http\middleware\CheckClientCookieJwt {
                private string $token;
                public function __construct(string $token) { $this->token=$token; }
                public function checkToken(\think\Request $request,$is_admin=false,$jwt='')
                {
                    $result=(new \app\http\middleware\Check())->checkToken($request,false,$this->token);
                    $info=$result['data']['jwt_token']??[];
                    if (!empty($info['is_admin'])||!empty($info['is_api'])) return ['status'=>401];
                    return $result;
                }
            };
            return $guard->handle($request,static function($checked):bool{return (int)$checked->client_id>0;})===true;
        } catch (\Throwable $error) {
            error_log('CRA1 notification member check unavailable: '.get_class($error));
            return false;
        } finally {
            while (ob_get_level()>$level) ob_end_clean();
        }
    }
}
