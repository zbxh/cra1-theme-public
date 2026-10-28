<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;

/** Native route placement is retained; no account-wide cached plaintext password. */
class OperationGuard extends \app\http\middleware\CheckClientOperatePassword
{
    public function handle($request, \Closure $next)
    {
        if ((int)$request->client_id <= 0) return json(['status'=>401,'msg'=>'登录已失效，请重新登录']);
        $summary = \CRA1\Theme\Security\OperationVerification::remoteSummary(\CRA1\Theme\Security\OperationVerification::path($request), strtoupper($request->method()), $request->param());
        if(!$request->is_api&&!$summary&&!\CRA1\Theme\Compatibility\KnownContracts::security())return json(['status'=>503,'msg'=>'此功能暂时不可用，请稍后重试或联系客服']);
        $gate = \CRA1\Theme\Security\OperationVerification::enforce($request, true);
        return (int)$gate['status'] === 200 ? $next($request) : json($gate);
    }
}
