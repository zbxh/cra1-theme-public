<?php
declare(strict_types=1);

namespace {
    final class ProductListFixture
    {
        public static array $hosts = [];
        public static ?array $visible = null;
        public static bool $showDeleted = false;
        public static array $hooks = [];
        public static bool $fireHook = true;
        public static int $queries = 0;
        public static array $sources = [];
        public static bool $moduleMissing = false;

        public static function seed(): void
        {
            foreach (['Active','Pending','Suspended','Failed','Grace','Keep','Unpaid','Deleted','Cancelled'] as $index => $status) {
                $id = $index + 1;
                self::$hosts[] = ['id'=>$id, 'status'=>$status, 'client_id'=>12, 'is_delete'=>0,
                    'product_id'=>$index % 2 + 1, 'billing_cycle'=>'monthly', 'name'=>'host-'.$id, 'renewal_first_day_time'=>604800,
                    'is_sub'=>0, 'client_notes'=>'', 'notes'=>'管理员内部专用备注', 'product_name'=>'示例服务器',
                    'first_payment_amount'=>'19.25', 'base_info'=>'', 'show_base_info'=>1, 'module'=>'idcsmart_common'];
            }
            self::$hosts[0] = array_replace(self::$hosts[0], ['module'=>'mf_cloud', 'client_notes'=>'项目 Alpha_100%　生产']);
            self::$hosts[1] = array_replace(self::$hosts[1], ['module'=>'mf_dcim', 'client_notes'=>'项目 AlphaX100Z', 'base_info'=>'备用硬盘 80GB']);
            self::$hosts[2] = array_replace(self::$hosts[2], ['client_notes'=>'项目 非公开规格', 'show_base_info'=>0, 'base_info'=>'隐私标记CPU12核']);
            self::$hosts[6]['client_notes'] = '待付实例备注';
            self::$hosts[7]['client_notes'] = '历史实例备注';
            self::$hosts[] = array_replace(self::$hosts[0], ['id'=>10, 'client_id'=>13, 'client_notes'=>'别的账户备注']);
            self::$hosts[] = array_replace(self::$hosts[0], ['id'=>11, 'is_delete'=>1, 'client_notes'=>'物理删除的备注']);
            self::$hosts[] = array_replace(self::$hosts[0], ['id'=>12, 'is_sub'=>1, 'client_notes'=>'子产品限定备注']);
            self::$sources = [
                'host_ip' => [['host_id'=>1, 'dedicate_ip'=>'192.0.2.24', 'assign_ip'=>'2001:db8::24']],
                'host_addition' => [
                    ['host_id'=>1, 'image_name'=>'Ubuntu 24.04', 'city'=>'香港', 'area'=>'亚太', 'name_zh'=>'中国香港'],
                    ['host_id'=>3, 'image_name'=>'AlmaLinux', 'city'=>'东京', 'area'=>'日本', 'name_zh'=>'日本'],
                ],
                'module_mf_cloud_host_link' => [[
                    'host_id'=>1, 'config_data'=>json_encode(['cpu'=>['value'=>4], 'memory'=>['value'=>4096], 'memory_unit'=>'MB',
                        'flow'=>['value'=>500, 'other_config'=>['out_bw'=>100]]]),
                    'image_name'=>'Ubuntu', 'city'=>'香港', 'area'=>'亚太', 'name_zh'=>'中国香港', 'nicename'=>'Hong Kong', 'iso'=>'HK',
                ]],
                'module_mf_cloud_disk' => [
                    ['host_id'=>1, 'size'=>40, 'type2'=>'system'], ['host_id'=>1, 'size'=>250, 'type2'=>'data'],
                ],
                'module_mf_dcim_host_link' => [[
                    'host_id'=>2, 'config_data'=>json_encode(['admin_field'=>['cpu'=>'40 核', 'memory'=>'64 G', 'disk'=>'1 TB', 'bw'=>1100, 'flow'=>0]]),
                    'image_name'=>'Debian 12', 'city'=>'上海', 'area'=>'华东', 'name_zh'=>'中国', 'nicename'=>'China', 'iso'=>'CN',
                ]],
            ];
        }
    }

    final class ProductListFixtureQuery
    {
        private array $rows;
        public function __construct(array $rows) { $this->rows = $rows; }
        public function where(string $key, $operator, $value = null): self
        {
            $comparison = func_num_args() === 2 ? '=' : $operator;
            $value = func_num_args() === 2 ? $operator : $value;
            $key = self::column($key);
            $this->rows = array_filter($this->rows, static function (array $row) use ($comparison, $key, $value): bool {
                if ($comparison === '>') return $row[$key] > $value;
                if ($comparison === '<>') return $row[$key] !== $value;
                return $row[$key] === $value;
            });
            return $this;
        }
        public function whereIn(string $key, array $values): self
        {
            $key = self::column($key);
            $this->rows = array_filter($this->rows, static fn(array $row): bool => in_array($row[$key], $values, true));
            return $this;
        }
        private static function column(string $key): string { return substr($key, strrpos('.'.$key, '.')); }
        public function alias(string $alias): self { return $this; }
        public function leftJoin(string $table, string $on): self { return $this; }
        public function order(string $key, string $direction): self
        {
            $key = self::column($key);
            usort($this->rows, static fn(array $a, array $b): int => $a[$key] <=> $b[$key]);
            return $this;
        }
        public function limit(int $limit): self { $this->rows = array_slice($this->rows, 0, $limit); return $this; }
        public function field(string $fields): self { return $this; }
        public function select(): self { return $this; }
        public function toArray(): array { return array_values($this->rows); }
    }

    function add_hook(string $tag, callable $callback): void { ProductListFixture::$hooks[$tag] = $callback; }
    function configuration(string $key): int { return $key === 'home_show_deleted_host' && ProductListFixture::$showDeleted ? 1 : 0; }
    function get_client_id(): int { return 12; }
}

namespace app\common\model {
    final class HostModel
    {
        public function hostList(array $params): array
        {
            ++\ProductListFixture::$queries;
            $query = (new \ProductListFixtureQuery(\ProductListFixture::$hosts))->where('client_id', \get_client_id())
                ->where('is_delete', 0)->where('is_sub', 0)->where('status', '<>', 'Cancelled');
            if (isset($params['product_id'])) $query->whereIn('product_id', $params['product_id']);
            $tabs = ['using'=>['Pending','Active','Grace'], 'expiring'=>['Pending'], 'overdue'=>['Suspended','Failed'], 'deleted'=>['Deleted']];
            if (isset($tabs[$params['tab']])) $query->whereIn('status', $tabs[$params['tab']]);
            if (\ProductListFixture::$fireHook) {
                $apply = \ProductListFixture::$hooks['host_list_where_query_append'];
                // A native call without the private scope must never get a CRA1 filter.
                $native = new \ProductListFixtureQuery(\ProductListFixture::$hosts);
                $apply(['app'=>'home', 'param'=>[], 'query'=>$native]);
                if (count($native->toArray()) !== count(\ProductListFixture::$hosts)) throw new \RuntimeException('Unscoped native call was changed');
                $apply(['app'=>'home', 'param'=>$params, 'query'=>$query]);
            }
            if (isset($params['keywords'])) throw new \RuntimeException('Native wildcard search must not filter the expanded matches');
            $rows = array_reverse($query->toArray());
            $page = array_slice($rows, ($params['page'] - 1) * $params['limit'], $params['limit']);
            foreach ($page as &$row) {
                if ($row['status'] === 'Failed') $row['status'] = 'Pending';
                $row['billing_cycle'] = '每月';
            }
            unset($row);
            return ['count'=>count($rows), 'list'=>$page];
        }
    }
}

namespace think\db\exception {
    final class PDOException extends \RuntimeException {}
}

namespace think\facade {
    final class Db
    {
        public static function name(string $table): \ProductListFixtureQuery
        {
            if ($table === 'host') return new \ProductListFixtureQuery(\ProductListFixture::$hosts);
            if (\ProductListFixture::$moduleMissing && strpos($table, 'module_') === 0) throw new \think\db\exception\PDOException();
            if (!isset(\ProductListFixture::$sources[$table])) throw new \RuntimeException('Unexpected fixture table: '.$table);
            return new \ProductListFixtureQuery(\ProductListFixture::$sources[$table]);
        }
    }
}

namespace CRA1\Theme\Security {
    final class NativeAuthorization
    {
        public static function visibleHostIds(): ?array { return \ProductListFixture::$visible; }
    }
    final class OperationVerification
    {
        public static function redact(array $value): array { return $value; }
    }
}

namespace {
    use CRA1\Theme\Compatibility\ProductList;

    require dirname(__DIR__).'/backend/Compatibility/ProductListSearch.php';
    require dirname(__DIR__).'/backend/Compatibility/ProductList.php';
    ProductListFixture::seed();
    $check = static function (bool $ok, string $label): void {
        if (!$ok) throw new RuntimeException($label);
    };
    $read = static fn(array $params = []): array => (new ProductList())->read($params);
    $ids = static fn(array $result): array => array_column($result['list'], 'id');

    $first = $read(['limit'=>3]);
    $second = $read(['limit'=>3, 'page'=>2]);
    $check($first['count'] === 6 && $second['count'] === 6 && array_merge($ids($first), $ids($second)) === [6,5,4,3,2,1], 'Current uses raw statuses, one result per host and stable pagination');
    $check($first['list'][2]['status'] === 'Failed' && $first['list'][2]['billing_cycle_code'] === 'monthly'
        && $first['list'][2]['renewal_window_end'] > $first['list'][2]['list_server_time'], 'Raw card metadata replaces the native display alias');
    $check($ids($read(['product_id'=>[2], 'keywords'=>'host-4'])) === [4], 'Category and keyword share the native count and pagination');
    $find = static fn(string $keywords, array $params = []): array => $ids($read($params + ['keywords'=>$keywords]));
    foreach ([
        'Ubuntu 香港 100Mbps'=>[1], 'ＵＢＵＮＴＵ　香港 带宽 100 M'=>[1], '系统不存在'=>[],
        'CPU 4 核'=>[1], 'CPU 4'=>[1], '内存 4 GB'=>[1], '内存4096MB'=>[1], '64GB'=>[2],
        '硬盘 40GB'=>[1], '磁盘 250G'=>[1], '290GB'=>[1], '1TB'=>[2], '100Mbps'=>[1],
        '带宽 1100 Mbps'=>[2], '1.1Gbps'=>[2], '流量 500 GB'=>[1], '不限流量'=>[2],
        'Debian 上海'=>[2], 'AlmaLinux 东京'=>[3], '192.0.2.24'=>[1], '2001:db8::24'=>[1],
        'Alpha_100%'=>[1], '备注不存在'=>[], '项目 ALPHA'=>[2,1], '项目 生产'=>[1],
        '管理员内部专用备注'=>[], '别的账户备注'=>[], '物理删除的备注'=>[], '子产品限定备注'=>[],
        '隐私标记'=>[], '19.25 生产'=>[1],
    ] as $keywords => $expected) {
        $check($find($keywords) === $expected, 'Search scope and matching: '.$keywords);
    }
    $check($find('生产', ['product_id'=>[2]]) === [], 'Search preserves category filtering');
    $check($find('待付实例备注') === [] && $find('待付实例备注', ['tab'=>'all']) === [7], 'Keywords preserve lifecycle filtering');
    $check($find('历史实例备注', ['tab'=>'all']) === [], 'Search respects hidden deleted products');
    $projectPage = $read(['keywords'=>'项目', 'limit'=>1, 'page'=>2]);
    $check($projectPage['count'] === 3 && $ids($projectPage) === [2], 'Search total and pagination include all matches');
    ProductListFixture::$moduleMissing = true;
    $check($find('Ubuntu 香港 Alpha') === [1] && $find('80GB') === [2], 'Optional module failure retains synced and native data');
    ProductListFixture::$moduleMissing = false;
    $check($ids($read(['tab'=>'all', 'limit'=>20])) === [7,6,5,4,3,2,1], 'All includes unpaid and respects hidden deleted state');
    $check($ids($read(['tab'=>'deleted'])) === [], 'Direct deleted reads respect the setting');
    ProductListFixture::$showDeleted = true;
    $check($ids($read(['tab'=>'deleted'])) === [8] && $ids($read(['tab'=>'all','limit'=>20])) === [8,7,6,5,4,3,2,1], 'Enabling deleted adds that status without exposing cancelled hosts');
    $check($find('历史实例备注', ['tab'=>'deleted']) === [8], 'Search sees deleted products when V10 permits it');
    foreach (['using'=>[5,2,1], 'expiring'=>[2], 'overdue'=>[4,3]] as $tab => $expected) {
        $check($ids($read(['tab'=>$tab])) === $expected, 'Legacy tab retains its native scope');
    }
    ProductListFixture::$visible = [2,4,8];
    $limited = $read(['limit'=>1, 'page'=>2]);
    $check($limited['count'] === 2 && $ids($limited) === [2], 'Subaccount limits apply before the count and page');
    $check($find('项目') === [2] && $find('Alpha_100%') === [], 'Subaccount search does not match a hidden product or note');
    ProductListFixture::$visible = [];
    $queries = ProductListFixture::$queries;
    $check($read()['count'] === 0 && ProductListFixture::$queries === $queries, 'Empty assignment never queries parent products');
    ProductListFixture::$visible = null;
    for ($id = 20; $id <= 300; $id++) {
        ProductListFixture::$hosts[] = array_replace(ProductListFixture::$hosts[0], [
            'id'=>$id, 'module'=>'idcsmart_common', 'client_notes'=>$id === 300 ? '第二批唯一备注' : '',
        ]);
    }
    $check($find('第二批唯一备注') === [300], 'Matching includes a later candidate batch before pagination');
    ProductListFixture::$fireHook = false;
    try { $read(); } catch (RuntimeException $error) { $rejected = strpos($error->getMessage(), 'query scope') !== false; }
    $check($rejected ?? false, 'An unscoped native result is discarded');
    echo "Product list scope and pagination checks passed\n";
}
