<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

use CRA1\Theme\Security\NativeAuthorization;

/** Native matches and the standard product IP index share the native account scope. */
final class MemberSearch
{
    public static function search(string $keywords): array
    {
        $keywords = trim($keywords);
        $visible = NativeAuthorization::visibleHostIds();
        // Native globalSearch treats the literal "0" as empty. Passing it to
        // searchHost directly would otherwise remove its keyword constraint.
        if ($keywords === '' || $keywords === '0' || $visible === []) return self::result([]);

        $matches = (new \app\common\model\HostModel())->searchHost($keywords);
        if (!isset($matches['list']) || !is_array($matches['list'])) throw new \RuntimeException('Invalid native search response');
        $ordered = [];
        foreach ($matches['list'] as $match) {
            if (!is_array($match)) continue;
            $value = $match['id'] ?? null;
            if (!is_scalar($value) || !ctype_digit((string)$value) || (int)$value <= 0) continue;
            $id = (int)$value;
            if ($visible !== null && !in_array($id, $visible, true)) continue;
            if (!isset($ordered[$id])) $ordered[$id] = ['product_name'=>$match['product_name']??''];
        }
        foreach (self::ipMatches($keywords, $visible) as $id => $match) {
            if (!isset($ordered[$id])) $ordered[$id] = $match;
            $ordered[$id]['match_ip'] = $match['match_ip'];
        }
        if (!$ordered) return self::result([]);

        // Do not rely on site patches in searchHost, or on IDs returned by a plugin hook.
        $fields = ['id','name','product_id','status','billing_cycle','due_time','renew_forbidden'];
        $rows = \think\facade\Db::name('host')->whereIn('id', array_keys($ordered))
            ->where('client_id', (int)get_client_id())->where('is_delete', 0)
            ->field(implode(',', $fields))->select()->toArray();
        $byId = array_column($rows, null, 'id');
        $list = [];
        foreach ($ordered as $id => $match) {
            if (!isset($byId[$id])) continue;
            $row = array_intersect_key($byId[$id], array_flip($fields));
            // searchHost has already applied the native multi_language hook.
            $row['product_name'] = is_scalar($match['product_name'] ?? null) ? (string)$match['product_name'] : '';
            if (isset($match['match_ip'])) $row['match_ip'] = $match['match_ip'];
            $list[] = $row;
        }
        return self::result($list);
    }

    /** Read only the V10 HostIpModel index; module credentials are never queried. */
    private static function ipMatches(string $keywords, ?array $visible): array
    {
        // A valid IPv4/IPv6 address can contain only these characters. Other
        // keywords still use the untouched native module search contract.
        if (!preg_match('/^[a-f0-9:.]+$/iD', $keywords)) return [];
        $pattern = '%'.strtr(strtolower($keywords), ['!'=>'!!', '%'=>'!%', '_'=>'!_']).'%';
        $query = \think\facade\Db::name('host')->alias('h')
            ->join('host_ip i', 'i.host_id=h.id')
            ->leftJoin('product p', 'p.id=h.product_id')
            ->where('h.client_id', (int)get_client_id())->where('h.is_delete', 0)
            ->where('h.status', '<>', 'Cancelled')
            ->whereRaw("(LOWER(i.dedicate_ip) LIKE :cra1_ip_primary ESCAPE '!' OR LOWER(i.assign_ip) LIKE :cra1_ip_additional ESCAPE '!')", [
                'cra1_ip_primary'=>$pattern, 'cra1_ip_additional'=>$pattern,
            ]);
        if ($visible !== null) $query->whereIn('h.id', $visible);
        // The original product search grants plugins the aliased host query.
        // Reuse that same restriction for additional IP matches as well.
        $query->where(static function($scope) use ($keywords): void {
            hook('host_search_where_query_append', ['keywords'=>$keywords, 'app'=>'home', 'query'=>$scope]);
        });
        $rows = $query->field('h.id,h.name,p.name product_name,i.dedicate_ip,i.assign_ip')->select()->toArray();
        $matches = [];
        foreach ($rows as $row) {
            $id = (int)($row['id'] ?? 0);
            if ($id <= 0 || isset($matches[$id])) continue;
            $ips = array_merge([(string)($row['dedicate_ip']??'')], explode(',', (string)($row['assign_ip']??'')));
            foreach ($ips as $ip) {
                $ip = trim($ip);
                if (!filter_var($ip, FILTER_VALIDATE_IP) || stripos($ip, $keywords) === false) continue;
                $translated = hook_one('multi_language', ['replace'=>['product_name'=>(string)($row['product_name']??'')]]);
                $matches[$id] = [
                    'id'=>$id, 'product_name'=>is_scalar($translated['product_name']??null)
                        ? (string)$translated['product_name'] : (string)($row['product_name']??''),
                    'match_ip'=>$ip,
                ];
                break;
            }
        }
        return $matches;
    }

    private static function result(array $list): array
    {
        $payload = HomeProducts::augment(['status'=>200,'data'=>['list'=>$list,'count'=>count($list)]]);
        // A search response contains only the list and the lifecycle decisions it needs.
        $rows = $payload['data']['list'] ?? [];
        $allowed = array_flip(['id','name','product_name','product_id','match_ip','status','billing_cycle','due_time','renew_forbidden','suspend_type','change_billing_cycle_id','is_delete','end_grace_time','renew_recovery_deadline']);
        return ['status'=>200,'data'=>[
            'list'=>array_map(static function(array $row) use ($allowed): array { return array_intersect_key($row, $allowed); }, $rows),
            'count'=>count($rows),
            'overview'=>$payload['data']['overview'] ?? [],
        ]];
    }
}
