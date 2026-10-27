<?php
declare(strict_types=1);
namespace CRA1\Theme\Security;

final class NativeAuthorization
{
    public static function group(string $title): bool
    {
        $id=(int)get_client_id(false);
        if ($id<=0) return false;
        $plugin=\think\facade\Db::name('plugin')->where('module','addon')->where('name','IdcsmartSubAccount')->where('status',1)->find();
        if (!$plugin) return true;
        $child=\think\facade\Db::name('addon_idcsmart_sub_account')->where('client_id',$id)->find();
        if (!$child) return true;
        $ids=json_decode((string)$child['auth'],true);
        if (!is_array($ids)||!$ids) return false;
        return \think\facade\Db::name('clientarea_auth')->whereIn('id',$ids)->where('title',$title)->count()>0;
    }

    /** Reuse the native subaccount decision for the original business action. */
    public static function allows(string $rule): bool
    {
        $id = (int)get_client_id(false);
        if ($id <= 0) return false;
        // Native controllers enforce only registered route rules. Product and
        // module reads may have no registry row on an otherwise valid install.
        // Operation groups are checked separately, including credential reads.
        if (strpos($rule, '::') !== false
            && !(new \app\home\model\ClientareaAuthRuleModel())->getAuthName($rule)) return true;
        $key = 'home_auth_rule_'.$id;
        if (\think\facade\Cache::has($key)) {
            $allowed = json_decode((string)\think\facade\Cache::get($key), true);
            return is_array($allowed) && in_array($rule, $allowed, true);
        }
        foreach ((array)hook('home_check_access', ['rule'=>$rule, 'client_id'=>$id]) as $result) {
            if (is_array($result) && isset($result['status']) && (int)$result['status'] !== 200) return false;
        }
        return true;
    }

    /** null means unrestricted; an empty native assignment means no products. */
    public static function visibleHostIds(): ?array
    {
        $id = (int)get_client_id(false);
        if ($id <= 0) return [];
        $visible = null;
        foreach ((array)hook('get_client_host_id', ['client_id'=>$id]) as $result) {
            if (!is_array($result) || (int)($result['status']??0) !== 200) continue;
            $rows = $result['data']['host']??null;
            if (!is_array($rows)) return [];
            $ids = [];
            foreach ($rows as $row) {
                $value = is_array($row) ? ($row['host_id']??null) : $row;
                if (!is_scalar($value) || !ctype_digit((string)$value) || (int)$value <= 0) return [];
                $ids[] = (int)$value;
            }
            $ids = array_values(array_unique($ids));
            $visible = $visible === null ? $ids : array_values(array_intersect($visible,$ids));
        }
        return $visible;
    }

    public static function hostVisible(int $hostId): bool
    {
        $ids = self::visibleHostIds();
        return $hostId > 0 && ($ids === null || in_array($hostId,$ids,true));
    }
}
