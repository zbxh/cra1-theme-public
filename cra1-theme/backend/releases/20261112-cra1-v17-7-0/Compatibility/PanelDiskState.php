<?php
namespace CRA1\Theme\Compatibility;

/** Resolve a failed local creation from terminal evidence, never from age. */
class PanelDiskState
{
    public static function resolve(array $disk, array $localDisks, ?array $remoteDisks, array $logs, string $failurePrefix): array
    {
        $state = ['creation_failed' => false, 'can_delete' => false, 'failure_reason' => ''];
        if (($disk['type2'] ?? '') !== 'data' || !in_array((int)($disk['status'] ?? -1), [3, 4], true)) return $state;
        // Bound resources must use their live state and ordinary lifecycle.
        if ((int)($disk['rel_id'] ?? 0) > 0 || (int)($disk['upstream_id'] ?? 0) > 0) return $state;
        $reason = (int)$disk['status'] === 4 ? '磁盘创建失败' : '';
        foreach ($logs as $log) {
            $at = (int)($log['create_time'] ?? 0);
            $created = (int)($disk['create_time'] ?? 0);
            if ($created <= 0 || $at < $created || $at > $created + 600) continue;
            $description = html_entity_decode((string)($log['description'] ?? ''), ENT_QUOTES, 'UTF-8');
            // Logs can have been written using a different account language.
            $prefixes = array_unique([$failurePrefix, '订购失败磁盘(GB):', '訂購失敗磁盤(GB):', 'order failure disk (GB):']);
            $prefix = '(?:' . implode('|', array_map(function ($value) { return preg_quote($value, '~'); }, array_filter($prefixes))) . ')';
            $size = preg_quote((string)(int)($disk['size'] ?? 0), '~');
            if (!preg_match('~' . $prefix . $size . '[,，](?:原因|Reason)[:：]([^;；]+)~iu', $description, $hit)) continue;
            // A transport error can mean an accepted operation with a lost response.
            if (preg_match('/CURL_ERROR|timeout|timed out|超时|执行失败|connection|连接/i', $hit[1])) continue;
            $siblings = array_filter($localDisks, function ($row) use ($disk, $at) {
                return ($row['type2'] ?? '') === 'data' && (int)($row['size'] ?? 0) === (int)$disk['size']
                    && (int)($row['rel_id'] ?? 0) === 0 && (int)($row['upstream_id'] ?? 0) === 0
                    && (int)($row['create_time'] ?? 0) <= $at && (int)($row['create_time'] ?? 0) >= $at - 600;
            });
            if (count($siblings) !== 1) continue;
            $reason = trim($hit[1]);
            break;
        }
        if ($reason === '') return $state;
        $state['creation_failed'] = true;
        $state['failure_reason'] = $reason;
        if ($remoteDisks === null) return $state;
        $bound = array_filter(array_map(function ($row) { return (int)($row['rel_id'] ?? 0); }, $localDisks));
        foreach ($remoteDisks as $remote) {
            if (!is_array($remote) || !isset($remote['id'], $remote['type'], $remote['size'])) return $state;
            // An unbound same-size cloud resource could be this disk; reconcile first.
            if ($remote['type'] !== 'system' && (int)$remote['size'] === (int)$disk['size']
                && !in_array((int)$remote['id'], $bound, true)) return $state;
        }
        $state['can_delete'] = true;
        return $state;
    }
}
