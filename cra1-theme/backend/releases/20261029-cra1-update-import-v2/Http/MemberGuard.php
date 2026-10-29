<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;

/** Extend native authentication rather than reimplementing JWT/session validation. */
class MemberGuard extends \app\http\middleware\CheckHome
{
    public function handle($request, \Closure $next)
    {
        return parent::handle($request, static function ($authenticated) use ($next) {
            if ((int)$authenticated->client_id <= 0) return json(['status'=>401,'msg'=>'登录已失效，请重新登录']);
            if(is_file(CRA1_THEME_ROOT.'/runtime/cra1_theme/distribution/pending.json'))return json(['status'=>503,'msg'=>'服务正在维护，请稍后重试']);
            $path = \CRA1\Theme\Security\OperationVerification::path($authenticated);
            if (!$authenticated->is_api && strtoupper($authenticated->method())==='GET'
                && preg_match('~^/console/v1/(?:home/host|client/host|host|(?:re)?mf_(?:cloud|dcim|finance|finance_common|finance_dcim))/?$~D',$path)
                && \CRA1\Theme\Security\NativeAuthorization::visibleHostIds()===[]) {
                return json(\CRA1\Theme\Compatibility\HomeProducts::augment(['status'=>200,'data'=>[]]))->header(['Cache-Control'=>'no-store, private']);
            }
            if (!$authenticated->is_api && preg_match('~^/console/v1/(?:(?:re)?(?:mf_cloud|mf_dcim|mf_finance|mf_finance_common|mf_finance_dcim)|host|(?:re)?idcsmart_common/host|cra1-theme/(?:module/mf_cloud|member/host))/([1-9][0-9]*)(?:/|$)~D',$path,$match)
                && !\CRA1\Theme\Security\NativeAuthorization::hostVisible((int)$match[1])) {
                return json(['status'=>404,'msg'=>'产品不存在'])->header(['Cache-Control'=>'no-store, private']);
            }
            if (!$authenticated->is_api && preg_match('~^/console/v1/(?:security_group/(?:[1-9][0-9]*/)?host|refund/host)/([1-9][0-9]*)(?:/|$)~D',$path,$match)
                && !\CRA1\Theme\Security\NativeAuthorization::hostVisible((int)$match[1])) {
                return json(['status'=>404,'msg'=>'产品不存在'])->header(['Cache-Control'=>'no-store, private']);
            }
            if (!$authenticated->is_api && $path==='/console/v1/refund' && (int)$authenticated->param('host_id')>0
                && !\CRA1\Theme\Security\NativeAuthorization::hostVisible((int)$authenticated->param('host_id'))) {
                return json(['status'=>404,'msg'=>'产品不存在'])->header(['Cache-Control'=>'no-store, private']);
            }
            $sensitive = \CRA1\Theme\Security\OperationVerification::sensitive($path, strtoupper($authenticated->method()));
            $credentials=strtoupper($authenticated->method())==='GET'&&(string)$authenticated->param('credentials_only')==='1'
                &&preg_match('~/(?:re)?idcsmart_common/host/[1-9][0-9]*/configoption$~D',$path);
            $summary = \CRA1\Theme\Security\OperationVerification::remoteSummary($path, strtoupper($authenticated->method()), $authenticated->param());
            if (!$authenticated->is_api && ($sensitive||$credentials) && !$summary && !\CRA1\Theme\Compatibility\KnownContracts::security()) {
                return json(['status'=>503,'msg'=>'此功能暂时不可用，请稍后重试或联系客服']);
            }
            $group=$credentials ? 'clientarea_auth_control_reinstall_rescue_reset_set_mount'
                : \CRA1\Theme\Security\OperationVerification::requiredGroup($path,strtoupper($authenticated->method()),$authenticated->param());
            if (!$authenticated->is_api && $group!=='' && !\CRA1\Theme\Security\NativeAuthorization::group($group)) {
                return json(['status'=>403,'msg'=>'当前账号无权访问此内容'])->header(['Cache-Control'=>'no-store, private']);
            }
            $gate = \CRA1\Theme\Security\OperationVerification::enforce($authenticated);
            if ((int)$gate['status'] !== 200) return json($gate);
            $response = $next($authenticated);
            if ($path === '/console/v1/account' && strtoupper($authenticated->method()) === 'GET') {
                require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_media.php';
                $data = $response->getData();
                if (is_array($data) && (int)($data['status']??0)===200 && isset($data['data']['account'])) {
                    $data['data']['account']['theme_avatar'] = \CRA1ThemeMediaStore::avatarFor(CRA1_THEME_ROOT,(int)get_client_id(false));
                    $response->data($data);
                }
            }
            return \CRA1\Theme\Security\OperationVerification::filterResponse($authenticated, $response);
        });
    }
}
