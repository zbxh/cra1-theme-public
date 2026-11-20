<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

use think\facade\Db;

/** Search the account's local product metadata before the native list paginates. */
final class ProductListSearch
{
    private const PAGE_SIZE = 250;
    private const MODULES = ['mf_cloud', 'mf_dcim'];
    private const UNITS = 'gbps|mbps|tib|gib|mib|tb|gb|mb|g|t|m|核|vcpu';
    private const SPEC_LABELS = 'cpu|内存|硬盘|磁盘|带宽|流量';
    private array $unavailable = [];

    public function matchingIds(array $terms, array $filters, ?array $visible): array
    {
        $matches = [];
        $clientId = (int)get_client_id();
        $after = 0;
        do {
            $query = Db::name('host')->alias('h')
                ->leftJoin('product p', 'p.id=h.product_id')
                ->leftJoin('server s', 's.id=h.server_id')
                ->where('h.client_id', $clientId)->where('h.is_delete', 0)
                ->where('h.is_sub', 0)->where('h.status', '<>', 'Cancelled')->where('h.id', '>', $after);
            if ($visible !== null) $query->whereIn('h.id', $visible);
            if (isset($filters['product_id'])) $query->whereIn('h.product_id', $filters['product_id']);
            if (isset($filters['statuses'])) $query->whereIn('h.status', $filters['statuses']);
            if (!$filters['show_deleted']) $query->where('h.status', '<>', 'Deleted');
            $hosts = $query->field('h.id,h.name,h.client_notes,h.first_payment_amount,h.base_info,p.name product_name,p.show_base_info,s.module')
                ->order('h.id', 'asc')->limit(self::PAGE_SIZE)->select()->toArray();

            foreach ($this->matchBatch($hosts, $terms) as $id) $matches[] = $id;
            if ($hosts) $after = (int)$hosts[count($hosts) - 1]['id'];
        } while (count($hosts) === self::PAGE_SIZE);
        return $matches;
    }

    private function matchBatch(array $hosts, array $terms): array
    {
        if (!$hosts) return [];
        $ids = array_column($hosts, 'id');
        $metadata = [];
        $ipRows = Db::name('host_ip')->whereIn('host_id', $ids)->field('host_id,dedicate_ip,assign_ip')->select()->toArray();
        foreach ($ipRows as $row) $metadata[$row['host_id']][] = [$row['dedicate_ip'], $row['assign_ip']];

        $addition = Db::name('host_addition')->alias('a')->leftJoin('country c', 'c.id=a.country_id')
            ->whereIn('a.host_id', $ids)->field('a.host_id,a.image_name,a.city,a.area,c.name_zh,c.nicename,c.iso')->select()->toArray();
        foreach ($addition as $row) {
            $id = $row['host_id'];
            unset($row['host_id']);
            $metadata[$id][] = $row;
        }

        $moduleIds = [];
        foreach ($hosts as $host) {
            if (in_array($host['module'], self::MODULES, true)) $moduleIds[$host['module']][] = $host['id'];
        }
        $moduleRows = [];
        foreach ($moduleIds as $module => $hostIds) {
            $prefix = 'module_'.$module;
            $rows = $this->optional($module, static function () use ($prefix, $hostIds): array {
                return Db::name($prefix.'_host_link')->alias('l')
                    ->leftJoin($prefix.'_image i', 'i.id=l.image_id')
                    ->leftJoin($prefix.'_data_center d', 'd.id=l.data_center_id')
                    ->leftJoin('country c', 'c.id=d.country_id')
                    ->whereIn('l.host_id', $hostIds)
                    ->field('l.host_id,l.config_data,i.name image_name,d.city,d.area,c.name_zh,c.nicename,c.iso')
                    ->select()->toArray();
            });
            foreach ($rows as $row) $moduleRows[$row['host_id']] = $row;
        }
        $cloudDisks = [];
        if (isset($moduleIds['mf_cloud'])) {
            $cloudDisks = $this->optional('cloud disks', static function () use ($moduleIds): array {
                $rows = Db::name('module_mf_cloud_disk')->whereIn('host_id', $moduleIds['mf_cloud'])
                    ->whereIn('type2', ['system', 'data'])->field('host_id,size')->select()->toArray();
                $disks = [];
                foreach ($rows as $row) $disks[$row['host_id']][] = $row['size'];
                return $disks;
            });
        }

        $matches = [];
        foreach ($hosts as $host) {
            $id = (int)$host['id'];
            $fields = [$host['product_name'], $host['name'], $host['client_notes'], $host['first_payment_amount']];
            $showSpecs = (int)($host['show_base_info'] ?? 1) !== 0;
            if ($showSpecs) $fields[] = $host['base_info'];
            foreach ($metadata[$id] ?? [] as $entry) $fields = array_merge($fields, array_values($entry));
            if (isset($moduleRows[$id])) {
                $fields = array_merge($fields, self::moduleFields($host['module'], $moduleRows[$id], $cloudDisks[$id] ?? [], $showSpecs));
            }
            if (self::matches($id, $fields, $terms)) $matches[] = $id;
        }
        return $matches;
    }

    private function optional(string $source, callable $read): array
    {
        if (isset($this->unavailable[$source])) return [];
        try {
            return $read();
        } catch (\think\db\exception\PDOException $error) {
            // A stale server reference may remain after uninstalling a module.
            // Native fields (including synced configuration) are still searchable.
            error_log('CRA1 product search source unavailable: '.$source);
            $this->unavailable[$source] = true;
            return [];
        }
    }

    private static function moduleFields(string $module, array $row, array $disks, bool $showSpecs): array
    {
        $config = json_decode((string)$row['config_data'], true) ?: [];
        $fields = [$row['image_name'], $row['city'] ?: ($config['data_center']['city'] ?? ''),
            $row['area'] ?: ($config['data_center']['area'] ?? ''), $row['name_zh'], $row['nicename'], $row['iso']];
        if (!$showSpecs) return $fields;

        $flow = $config['flow']['value'] ?? null;
        if ($module === 'mf_cloud') {
            $cpu = self::measure($config['cpu']['value'] ?? null, '核');
            $memoryValue = $config['memory']['value'] ?? null;
            $memoryUnit = ($config['memory_unit'] ?? '') === 'MB' ? 'MB' : 'GB';
            $memory = self::measure($memoryValue, $memoryUnit);
            if ($memoryUnit === 'MB' && is_numeric($memoryValue) && (float)$memoryValue >= 1024) {
                $fields[] = '内存 '.self::measure((float)$memoryValue / 1024, 'GB');
            }
            $disk = self::measure($disks ? array_sum($disks) : ($config['system_disk']['value'] ?? null), 'GB');
            foreach ($disks as $size) {
                $fields[] = '硬盘 '.self::measure($size, 'GB');
                $fields[] = '磁盘 '.self::measure($size, 'GB');
            }
            $bw = isset($config['flow']) ? ($config['flow']['other_config']['out_bw'] ?? null) : ($config['bw']['value'] ?? null);
        } else {
            $hardware = !empty($config['admin_field']) ? $config['admin_field'] : ($config['model_config'] ?? []);
            $cpu = $hardware['cpu'] ?? '';
            $fields[] = $hardware['cpu_param'] ?? '';
            $memory = $hardware['memory'] ?? '';
            $disk = $hardware['disk'] ?? '';
            $bw = $config['admin_field']['bw'] ?? $config['bw']['value'] ?? $config['flow']['other_config']['out_bw'] ?? null;
            $flow = $config['admin_field']['flow'] ?? $flow;
        }
        $bandwidth = self::measure($bw, 'Mbps');
        if (is_numeric($bw) && (float)$bw >= 1000) $fields[] = '带宽 '.self::measure((float)$bw / 1000, 'Gbps');
        $traffic = self::measure($flow, 'GB');
        if (is_numeric($flow) && (float)$flow === 0.0) $fields[] = '不限流量';
        foreach (['CPU'=>$cpu, '内存'=>$memory, '硬盘'=>$disk, '磁盘'=>$disk, '带宽'=>$bandwidth, '流量'=>$traffic] as $label => $value) {
            if (is_scalar($value) && $value !== '') $fields[] = $label.' '.$value;
        }
        return $fields;
    }

    private static function measure($value, string $unit): string
    {
        return is_numeric($value) && (float)$value >= 0 ? (string)(float)$value.$unit : '';
    }

    public static function terms(string $text): array
    {
        $text = self::fold($text);
        return $text === '' ? [] : array_values(array_unique(explode(' ', $text)));
    }

    private static function fold(string $text): string
    {
        $text = mb_strtolower(mb_convert_kana($text, 'as', 'UTF-8'), 'UTF-8');
        $text = (string)preg_replace('/[\x{180E}\x{200B}-\x{200D}\x{2060}\x{FEFF}]/u', '', $text);
        $text = trim((string)preg_replace('/[\s\p{Z}]+/u', ' ', $text));
        $text = (string)preg_replace('/('.self::SPEC_LABELS.') *:? *(?=\d)/u', '$1', $text);
        return (string)preg_replace_callback('/(\d) *('.self::UNITS.')(?![a-z])/u', static function (array $match): string {
            $units = ['g'=>'gb', 't'=>'tb', 'm'=>'mbps', 'tib'=>'tb', 'gib'=>'gb', 'mib'=>'mb', 'vcpu'=>'核'];
            return $match[1].($units[$match[2]] ?? $match[2]);
        }, $text);
    }

    private static function matches(int $id, array $fields, array $terms): bool
    {
        $fields = array_map(static function ($value): string {
            return is_scalar($value) ? self::fold((string)$value) : '';
        }, $fields);
        foreach ($terms as $term) {
            if (ctype_digit($term) && (int)$term === $id) continue;
            $pattern = null;
            if (preg_match('/\d(?:核|mb|gb|tb|mbps|gbps)$/u', $term)) {
                $pattern = '~(?<![0-9.])'.preg_quote($term, '~').'(?![0-9a-z]|\.[0-9])~u';
            } elseif (preg_match('/^(?:'.self::SPEC_LABELS.')\d+(?:\.\d+)?$/u', $term)) {
                $pattern = '~'.preg_quote($term, '~').'(?![0-9]|\.[0-9])~u';
            }
            foreach ($fields as $field) {
                $matched = $pattern === null ? strpos(str_replace(' ', '', $field), $term) !== false : preg_match($pattern, $field);
                if ($matched) continue 2;
            }
            return false;
        }
        return true;
    }
}
