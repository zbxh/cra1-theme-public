<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;
use CRA1\Theme\Security\NativeAuthorization;

final class ModuleAdapter
{
    public static function run(string $action, $request): array
    {
        $unsupported = ['status'=>503,'msg'=>'此功能暂时不可用，请稍后重试或联系客服'];
        $rule = ['disks'=>'disk','flow'=>'flowDetail','deleteFailedDisk'=>'diskUnmount'][$action]??'';
        if (!$rule || strtoupper($request->method()) !== ($action === 'deleteFailedDisk' ? 'DELETE' : 'GET')) return ['status'=>405,'msg'=>'请求方式无效'];
        if (!Capabilities::module('mf_cloud', [$rule])) return $unsupported;
        if (!NativeAuthorization::allows('server\\mf_cloud\\controller\\home\\CloudController::'.$rule)) return ['status'=>403,'msg'=>'当前账号无权执行此操作'];
        if (!NativeAuthorization::hostVisible((int)$request->param('id'))) return ['status'=>404,'msg'=>'产品不存在'];
        if ($action === 'deleteFailedDisk' && !NativeAuthorization::group('clientarea_auth_delete')) return ['status'=>403,'msg'=>'当前账号无权执行此操作'];
        $host = \app\common\model\HostModel::where('id',(int)$request->param('id'))->where('client_id',get_client_id())->where('is_delete',0)->find();
        if (!$host || $host->getModule() !== 'mf_cloud') return ['status'=>404,'msg'=>'产品不存在'];
        $version = \think\facade\Db::name('plugin')->where('module','server')->where('name','MfCloud')->value('version');
        $enhanced = \CRA1\Theme\Context::version() === '10.7.4' && KnownContracts::module('MfCloud',(string)$version);
        // Native read methods keep working on installations with historical
        // module differences. Never infer enhanced mutation compatibility.
        if (!$enhanced) return $action === 'deleteFailedDisk' ? $unsupported : self::nativeRead($action, $rule);
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

    private static function nativeRead(string $action, string $method): array
    {
        try {
            $controller = new \server\mf_cloud\controller\home\CloudController();
            $reply = $controller->$method();
            $result = $reply->getData();
            if (!is_array($result) || (int)($result['status'] ?? 0) !== 200 || !is_array($result['data'] ?? null)) throw new \RuntimeException('native-read-unavailable');
            $data = $result['data'];
            if ($action === 'disks') {
                if (!isset($data['list']) || !is_array($data['list'])) throw new \RuntimeException('native-disk-shape');
                $list = [];
                foreach ($data['list'] as $disk) {
                    if (!is_array($disk)) throw new \RuntimeException('native-disk-row');
                    $row = array_filter(array_intersect_key($disk, array_flip(['id','name','size','create_time','type','type2','is_free','status'])), 'is_scalar');
                    $row['can_delete'] = false;
                    $row['failure_reason'] = (int)($row['status'] ?? 0) === 4 ? '磁盘创建失败' : '';
                    $list[] = $row;
                }
                return ['status'=>200, 'data'=>['list'=>$list]];
            }
            $flow = array_filter(array_intersect_key($data, array_flip(['total','used','leave','reset_flow_date','reset_flow_time','reset_flow_timestamp','flow_reset_cycle','flow_reset_cycle_num','total_num','used_num','base_flow','temp_flow'])), 'is_scalar');
            if (isset($data['flow_packet']) && is_array($data['flow_packet'])) {
                $flow['flow_packet'] = array_filter(array_intersect_key($data['flow_packet'], array_flip(['leave_size','total_size','used_size'])), 'is_scalar');
            }
            if (!$flow) throw new \RuntimeException('native-flow-shape');
            return ['status'=>200, 'data'=>$flow];
        } catch (\Throwable $e) {
            error_log('CRA1 native module read unavailable: '.$action.' '.get_class($e));
            return ['status'=>503, 'msg'=>$action === 'disks' ? '磁盘信息暂时无法获取，请稍后重试' : '流量信息暂时无法获取，请稍后重试'];
        }
    }
}
