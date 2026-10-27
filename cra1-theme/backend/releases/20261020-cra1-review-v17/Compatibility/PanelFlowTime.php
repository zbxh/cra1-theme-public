<?php
namespace CRA1\Theme\Compatibility;

/** Keep the provider's cycle boundary, including hours, minutes and seconds. */
class PanelFlowTime
{
    public static function nextReset(array $meta, int $now): int
    {
        $exact = $meta['flow_reset_time'] ?? null;
        if (is_numeric($exact) && (float)$exact > 0) {
            return (int)((float)$exact > 1000000000000 ? (float)$exact / 1000 : (float)$exact);
        }
        if (is_string($exact) && trim($exact) !== '') {
            $time = strtotime($exact);
            if ($time !== false) return $time;
        }
        // Older cloud versions only expose a monthly day, at midnight.
        $day = max(1, min(31, (int)($meta['reset_flow_day'] ?? 1)));
        $time = mktime(0, 0, 0, (int)date('n', $now), min($day, (int)date('t', $now)), (int)date('Y', $now));
        if ($time <= $now) {
            $nextMonth = strtotime(date('Y-m-01', $now) . ' +1 month');
            $time = mktime(0, 0, 0, (int)date('n', $nextMonth), min($day, (int)date('t', $nextMonth)), (int)date('Y', $nextMonth));
        }
        return $time;
    }
}
