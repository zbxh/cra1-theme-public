<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;
use CRA1\Theme\Security\OperationVerification as Verification;
use CRA1\Theme\Security\NativeAuthorization;

final class MemberController
{
    public function dispatch(string $action, $request)
    {
        if ((int)$request->client_id <= 0 || $request->is_api || !preg_match('/^Bearer\s+\S+$/i', (string)$request->header('authorization'))) {
            return json(['status'=>401,'msg'=>'登录已失效，请重新登录'],401);
        }
        if (!\CRA1\Theme\Context::memberActive()) return json(['status'=>404,'msg'=>'功能不存在'],404);
        $origin = (string)$request->header('origin');
        if (($origin !== '' && rtrim($origin,'/') !== rtrim($request->domain(),'/')) || $request->header('sec-fetch-site') === 'cross-site') {
            return json(['status'=>403,'msg'=>'请求来源无效'],403);
        }
        try {
            $self = (int)get_client_id(false);
            switch ($action) {
                case 'verify':
                    $own = in_array((string)$request->param('scene'), ['update_password','update_operate_password'], true);
                    $result = Verification::verifyPassword((int)get_client_id(!$own), $request->param('password'));
                    break;
                case 'status':
                    $result = ['status'=>200,'data'=>['enabled'=>Verification::enabled(),'expires_at'=>Verification::expiresAt((int)get_client_id())]];
                    break;
                case 'avatar': case 'saveAvatar': case 'uploadAvatar':
                    require_once CRA1_THEME_ROOT.'/lib/cra1_theme_media.php';
                    if ($action === 'avatar') $data = ['theme_avatar'=>\CRA1ThemeMediaStore::avatarFor(CRA1_THEME_ROOT,$self)];
                    else {
                        $store = new \CRA1ThemeMediaStore(CRA1_THEME_ROOT);
                        if ($action === 'saveAvatar') $data = ['theme_avatar'=>$store->saveAvatar($self,$request->param())];
                        else { $file = $store->upload($_FILES['file']??[], 'avatar', $self); $data = ['attachment_id'=>(int)$file['id'],'url'=>$file['url'],'width'=>512,'height'=>512]; }
                    }
                    $result = ['status'=>200,'msg'=>'已完成','data'=>$data];
                    break;
                case 'products':
                    if (!NativeAuthorization::allows('app\\home\\controller\\HostController::homeHostList')) return $this->denied();
                    $params = array_intersect_key($request->param(), array_flip(['page','limit','orderby','sort']));
                    $params['limit'] = max(1,min(100,(int)($params['limit']??100)));
                    $params['page'] = max(1,(int)($params['page']??1));
                    $visible = NativeAuthorization::visibleHostIds();
                    // The native list does not constrain an empty assignment.
                    // Do not query or return the parent's other products.
                    $payload = $visible === [] ? ['status'=>200,'data'=>[]] : (new \app\common\model\HostModel())->homeHostList($params);
                    $result = \CRA1\Theme\Compatibility\HomeProducts::augment($payload);
                    break;
                case 'field':
                    if (!\CRA1\Theme\Compatibility\KnownContracts::security()) { $result=['status'=>503,'msg'=>'此功能暂时不可用，请稍后重试或联系客服'];break; }
                    if (!NativeAuthorization::allows('app\\home\\controller\\HostController::index')) return $this->denied();
                    if (!NativeAuthorization::group('clientarea_auth_control_reinstall_rescue_reset_set_mount')) return $this->denied();
                    if (!NativeAuthorization::hostVisible((int)$request->param('id'))) return $this->denied();
                    $owned=\app\common\model\HostModel::where('id',(int)$request->param('id'))
                        ->where('client_id',(int)get_client_id())->where('is_delete',0)->count();
                    if (!$owned) return $this->denied();
                    $host = (new \app\common\model\HostModel())->indexHost((int)$request->param('id'));
                    // Native indexHost checks access and then removes client_id.
                    if (empty($host['id'])) return $this->denied();
                    $gate = Verification::passwordGate((int)get_client_id());
                    if ((int)$gate['status'] !== 200) { $result = $gate; break; }
                    $fields = (new \app\common\model\SelfDefinedFieldModel())->showClientHostDetailField(['host_id'=>(int)$host['id']]);
                    $found = null;
                    foreach ($fields as $field) if ((int)$field['id']===(int)$request->param('field') && $field['field_type']==='password') $found=$field;
                    $result = $found ? ['status'=>200,'data'=>['value'=>(string)$found['value'],'verification_expires_at'=>Verification::expiresAt((int)get_client_id())]] : ['status'=>404,'msg'=>'内容不存在'];
                    break;
                case 'disks': case 'flow': case 'deleteFailedDisk':
                    $result = \CRA1\Theme\Compatibility\ModuleAdapter::run($action, $request);
                    break;
                default: $result = ['status'=>404,'msg'=>'功能不存在'];
            }
        } catch (\InvalidArgumentException $e) {
            $result = ['status'=>400,'msg'=>$e->getMessage()];
        } catch (\Throwable $e) {
            error_log('CRA1 member adapter failed: '.$action.' '.get_class($e));
            $result = ['status'=>503,'msg'=>'服务暂时不可用，请稍后重试'];
        }
        return json(CustomerError::payload($result))->header(['Cache-Control'=>'no-store, private','Pragma'=>'no-cache','X-Content-Type-Options'=>'nosniff']);
    }
    private function denied() { return json(['status'=>403,'msg'=>'当前账号无权访问此内容'],403)->header(['Cache-Control'=>'no-store']); }
}
