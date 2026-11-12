<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;
use server\mf_cloud\model\DiskModel;
use app\common\model\HostModel;
use think\facade\Db;

/** Extends the registered native 4.3.0 public/protected contract without changing the module. */
class MfCloudAdapter extends \server\mf_cloud\logic\CloudLogic
{
    private function states(array $local, ?array $remote): array
    {
        $pending = array_filter($local, static function ($disk) { return in_array((int)$disk['status'],[3,4],true) && !(int)$disk['rel_id'] && !(int)$disk['upstream_id']; });
        if (!$pending) return [];
        $times = array_column($pending,'create_time');
        $logs = Db::name('system_log')->where('type','host')->where('rel_id',$this->hostModel['id'])
            ->whereBetween('create_time',[min($times),max($times)+600])->field('create_time,description')->select()->toArray();
        $states=[];
        foreach ($pending as $disk) $states[(int)$disk['id']] = PanelDiskState::resolve($disk,$local,$remote,$logs,'订购失败磁盘(GB):');
        return $states;
    }

    public function readDisks(): array
    {
        $data = parent::diskList();
        if ($this->downstreamHostLogic->isDownstream()) return $data;
        $remote = $this->idcsmartCloud->cloudDetail($this->id);
        $rows = (new DiskModel())->diskList((int)$this->hostModel['id']);
        $states = $this->states($rows,(int)($remote['status']??0)===200 && is_array($remote['data']['disk']??null) ? $remote['data']['disk'] : null);
        foreach ($data['list'] as &$disk) {
            $state = $states[(int)$disk['id']]??[];
            if (!empty($state['creation_failed'])) $disk['status']=4;
            $disk['can_delete']=!empty($state['can_delete']);
            // Provider diagnostics remain private, even on a failed disk.
            $disk['failure_reason']=!empty($state['creation_failed'])?'磁盘创建失败':'';
            unset($disk['rel_id'],$disk['upstream_id']);
        }
        unset($disk);
        return $data;
    }

    public function readFlow(): array
    {
        $result = parent::flowDetail();
        if ((int)$result['status']!==200 || $this->downstreamHostLogic->isDownstream()) return $result;
        $net = $this->idcsmartCloud->netInfo($this->id);
        if ((int)($net['status']??0)!==200 || !is_array($net['data']['meta']??null)) return ['status'=>503,'msg'=>'流量信息暂不可用，请重试'];
        $time=PanelFlowTime::nextReset($net['data']['meta'],time());
        $result['data']['reset_flow_date']=date('Y-m-d',$time);
        $result['data']['reset_flow_time']=date('Y-m-d H:i:s',$time);
        $result['data']['reset_flow_timestamp']=$time;
        return $result;
    }

    public function removeFailed(int $diskId): array
    {
        if ($diskId<=0 || $this->downstreamHostLogic->isDownstream()) return ['status'=>400,'msg'=>'此磁盘不支持删除失败记录'];
        Db::startTrans();
        try {
            $host=HostModel::where('id',$this->hostModel['id'])->where('client_id',get_client_id())->where('is_delete',0)->lock(true)->find();
            $disk=$host ? DiskModel::where('host_id',$host['id'])->where('id',$diskId)->lock(true)->find() : null;
            if (!$disk || $disk['type2']!=='data' || (int)$disk['rel_id'] || (int)$disk['upstream_id']) throw new \RuntimeException('not-unbound');
            $remote=$this->idcsmartCloud->cloudDetail($this->id);
            if ((int)($remote['status']??0)!==200 || !is_array($remote['data']['disk']??null)) throw new \RuntimeException('remote-unknown');
            $states=$this->states((new DiskModel())->diskList((int)$host['id']),$remote['data']['disk']);
            if (empty($states[$diskId]['can_delete'])) throw new \RuntimeException('not-proven-failed');
            DiskModel::where('host_id',$host['id'])->where('id',$diskId)->where('rel_id',0)->where('upstream_id',0)->delete();
            active_log('删除创建失败的磁盘记录 ID:'.$diskId,'host',(int)$host['id']);
            Db::commit();
            return ['status'=>200,'msg'=>'已删除创建失败的磁盘记录'];
        } catch (\Throwable $e) {
            Db::rollback(); error_log('CRA1 failed disk cleanup rejected: '.$e->getMessage());
            return ['status'=>409,'msg'=>'尚未确认磁盘创建失败或状态已变化，请刷新后重试'];
        }
    }
}
