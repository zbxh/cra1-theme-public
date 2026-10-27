<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;
use CRA1\Theme\Security\NativeAuthorization;

final class ModuleAdapter
{
    public static function run(string $action, $request): array
    {
        $unsupported = ['status'=>503,'msg'=>'此操作暂不可用，请联系管理员检查兼容性'];
        if (\CRA1\Theme\Context::version() !== '10.7.4' || !Capabilities::module('mf_cloud', ['disk','flowDetail'])) return $unsupported;
        $version = \think\facade\Db::name('plugin')->where('module','server')->where('name','MfCloud')->value('version');
        if (!KnownContracts::module('MfCloud',(string)$version)) return $unsupported;
        $rule = ['disks'=>'disk','flow'=>'flowDetail','deleteFailedDisk'=>'diskUnmount'][$action]??'';
        if (!$rule || !NativeAuthorization::allows('server\\mf_cloud\\controller\\home\\CloudController::'.$rule)) return ['status'=>403,'msg'=>'当前账号无权执行此操作'];
        if (!NativeAuthorization::hostVisible((int)$request->param('id'))) return ['status'=>404,'msg'=>'产品不存在'];
        if ($action === 'deleteFailedDisk' && !NativeAuthorization::group('clientarea_auth_delete')) return ['status'=>403,'msg'=>'当前账号无权执行此操作'];
        $host = \app\common\model\HostModel::where('id',(int)$request->param('id'))->where('client_id',get_client_id())->where('is_delete',0)->find();
        if (!$host || $host->getModule() !== 'mf_cloud') return ['status'=>404,'msg'=>'产品不存在'];
        // Require the actual native adapter contract before instantiating it.
        $base = new \ReflectionClass('server\\mf_cloud\\logic\\CloudLogic');
        foreach (['hostModel','id','idcsmartCloud','downstreamHostLogic'] as $property) if (!$base->hasProperty($property) || $base->getProperty($property)->isPrivate()) return $unsupported;
        $logic = new MfCloudAdapter((int)$host['id']);
        if ($action === 'deleteFailedDisk') {
            $gate = \CRA1\Theme\Security\OperationVerification::passwordGate((int)get_client_id());
            if ((int)$gate['status'] !== 200) return $gate;
            return $logic->removeFailed((int)$request->param('disk'));
        }
        return $action === 'disks' ? ['status'=>200,'data'=>$logic->readDisks()] : $logic->readFlow();
    }
}
