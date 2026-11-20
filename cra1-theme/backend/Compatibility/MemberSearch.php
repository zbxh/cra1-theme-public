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
        $queries = self::queryVariants($keywords);
        $visible = NativeAuthorization::visibleHostIds();
        // Native globalSearch treats the literal "0" as empty. Passing it to
        // searchHost directly would otherwise remove its keyword constraint.
        if (!$queries || $visible === []) return self::result([]);

        $ordered = [];
        foreach ($queries as $query) {
            $matches = (new \app\common\model\HostModel())->searchHost($query);
            if (!isset($matches['list']) || !is_array($matches['list'])) throw new \RuntimeException('Invalid native search response');
            foreach ($matches['list'] as $match) {
                if (!is_array($match)) continue;
                $value = $match['id'] ?? null;
                if (!is_scalar($value) || !ctype_digit((string)$value) || (int)$value <= 0) continue;
                $id = (int)$value;
                if ($visible !== null && !in_array($id, $visible, true)) continue;
                if (!isset($ordered[$id])) $ordered[$id] = ['product_name'=>$match['product_name']??''];
            }
        }
        foreach ($queries as $query) {
            foreach (self::ipMatches($query, $visible) as $id => $match) {
                if (!isset($ordered[$id])) $ordered[$id] = $match;
                $ordered[$id]['match_ip'] = $match['match_ip'];
            }
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

    /** Original native hooks run first; at most two literal alternatives follow. */
    private static function queryVariants(string $keywords): array
    {
        if ($keywords === '' || $keywords === '0') return [];
        $normalized = is_callable(['\Normalizer', 'normalize']) ? \Normalizer::normalize($keywords, \Normalizer::FORM_KC) : $keywords;
        if (!is_string($normalized)) $normalized = $keywords;
        // intl is optional. mbstring is already part of V10's runtime: use it
        // to cover all full-width ASCII without adding a new PHP extension.
        $normalized = preg_replace_callback('/[\x{FF01}-\x{FF5E}]/u', static function(array $match): string {
            return chr(mb_ord($match[0], 'UTF-8') - 0xFEE0);
        }, $normalized);
        if ($normalized === null) return [$keywords];
        $normalized = preg_replace('/[\x{180E}\x{200B}-\x{200D}\x{2060}\x{FEFF}]/u', '', $normalized);
        $normalized = trim((string)preg_replace('/[\s\p{Z}]+/u', ' ', $normalized));
        $normalized = (string)preg_replace('/\s*([.:-])\s*/u', '$1', $normalized);
        if ($normalized === '' || $normalized === '0') return [];
        // Do not turn supplied LIKE syntax (including its full-width form)
        // into broader alternatives. No theme-generated wildcard is added.
        if (strpbrk($keywords.$normalized, "%_\\") !== false) return [$keywords];
        $compact = (string)preg_replace('/\s+/u', '', $normalized);
        return array_values(array_unique([$keywords, $normalized, $compact]));
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
