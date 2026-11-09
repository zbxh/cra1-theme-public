<?php
namespace CRA1\Theme\Compatibility;

/** Read-only projection of the automated product termination policy. */
final class HomeProducts
{
    public function appendRecoveryDeadlines(array $hosts, array $policy): array
    {
        $limited = (int)($policy['cron_due_terminate_swhitch'] ?? 0) === 1;
        $days = $policy['cron_due_terminate_day'] ?? null;
        $validDays = is_numeric($days) && (float)$days >= 0;
        $exempt = (int)($policy['product_overdue_not_delete_open'] ?? 0) === 1
            ? array_filter(array_map('intval', explode(',', (string)($policy['product_overdue_not_delete_product_ids'] ?? ''))))
            : [];
        foreach ($hosts as &$host) {
            // null = unavailable, 0 = no automatic deletion deadline. Never
            // silently invent a recovery period when configuration is invalid.
            $host['renew_recovery_deadline'] = null;
            $due = $host['due_time'] ?? null;
            if (is_numeric($due) && (float)$due > 0) {
                if (!$limited || in_array((int)$host['product_id'], $exempt, true)) {
                    $host['renew_recovery_deadline'] = 0;
                } elseif ($validDays) {
                    $host['renew_recovery_deadline'] = (int)$due + (int)((float)$days * 86400);
                }
            }
        }
        unset($host);
        return $hosts;
    }
    /** Add lifecycle fields only for IDs already returned by the native permission-filtered list. */
    public static function augment(array $payload): array
    {
        $payload=\CRA1\Theme\Security\OperationVerification::redact($payload);
        $visible=\CRA1\Theme\Security\NativeAuthorization::visibleHostIds();
        if ($visible === []) {
            $payload['data']=['list'=>[],'count'=>0,'using_count'=>0,'expiring_count'=>0,'overdue_count'=>0,'deleted_count'=>0,'all_count'=>0,'data_center'=>[],'select_field'=>[]];
        }
        $list=$payload['data']['list']??[];
        if ($visible !== null) $list=array_values(array_filter($list,static function(array $host)use($visible):bool{return in_array((int)($host['id']??0),$visible,true);}));
        $ids=array_values(array_filter(array_map('intval',array_column($list,'id'))));
        $rows=$ids ? \think\facade\Db::name('host')->whereIn('id',$ids)->where('client_id',get_client_id())
            ->field('id,suspend_type,change_billing_cycle_id,is_delete,end_grace_time')->select()->toArray() : [];
        $map=array_column($rows,null,'id');
        foreach($list as &$host) {
            if (!isset($map[$host['id']])) { $host['is_delete']=1; continue; }
            $host=array_replace($host,$map[$host['id']]);
            // Keep only public display fields, not internal custom-field values.
            foreach(array_keys($host) as $key) if(strpos($key,'self_defined_field_')===0) unset($host[$key]);
        }
        unset($host);
        $policy=configuration(['cron_due_terminate_swhitch','cron_due_terminate_day','product_overdue_not_delete_open','product_overdue_not_delete_product_ids']);
        $payload['data']['list']=(new self())->appendRecoveryDeadlines($list,is_array($policy)?$policy:[]);
        $payload['data']['overview']=['server_time'=>time(),'renewal_enabled'=>(bool)\think\facade\Db::name('plugin')->where('name','IdcsmartRenew')->where('module','addon')->where('status',1)->count()];
        unset($payload['data']['self_defined_field']);
        return $payload;
    }
}
