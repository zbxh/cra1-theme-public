<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;

/** Native route placement is retained; no account-wide cached plaintext password. */
class OperationGuard extends \app\http\middleware\CheckClientOperatePassword
{
    public function handle($request, \Closure $next)
    {
        if ((int)$request->client_id <= 0) return json(['status'=>401,'msg'=>'登录已失效，请重新登录']);
        if(!$request->is_api&&!\CRA1\Theme\Compatibility\KnownContracts::security())return json(['status'=>503,'msg'=>'此操作暂不可用，请联系管理员检查兼容性']);
        $gate = \CRA1\Theme\Security\OperationVerification::enforce($request, true);
        return (int)$gate['status'] === 200 ? $next($request) : json($gate);
    }
}
