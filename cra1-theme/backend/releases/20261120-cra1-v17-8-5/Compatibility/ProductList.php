<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

use app\common\model\HostModel;
use CRA1\Theme\Security\NativeAuthorization;
use CRA1\Theme\Security\OperationVerification;
use think\facade\Db;

/** Apply the theme's status groups before native counting and pagination. */
final class ProductList
{
    private const CURRENT_STATUSES = ['Active', 'Pending', 'Suspended', 'Failed', 'Grace', 'Keep'];
    private const TABS = ['current', 'using', 'expiring', 'overdue', 'all', 'deleted'];
    private const SCOPE = '_cra1_product_list_scope';

    private bool $applied = false;
    private string $tab;
    private bool $showDeleted;
    private ?array $visible;
    private ?array $matched;

    public function read(array $input): array
    {
        $tab = $input['tab'] ?? 'current';
        if (!in_array($tab, self::TABS, true)) throw new \InvalidArgumentException('请选择有效的产品状态');
        $this->tab = $tab;
        $keywords = $input['keywords'] ?? '';
        if (!is_string($keywords)) throw new \InvalidArgumentException('请输入搜索关键词');
        $this->visible = NativeAuthorization::visibleHostIds();
        $this->showDeleted = (int)configuration('home_show_deleted_host') === 1;
        $empty = ['list'=>[], 'count'=>0];
        if ($this->visible === [] || ($this->tab === 'deleted' && !$this->showDeleted)) return $empty;

        $params = [
            'tab' => in_array($this->tab, ['current', 'all'], true) ? '' : $this->tab,
            'page' => max(1, (int)($input['page'] ?? 1)),
            'limit' => max(1, min(100, (int)($input['limit'] ?? 6))),
            'orderby' => 'id',
            'sort' => 'desc',
            self::SCOPE => $this,
        ];
        if (array_key_exists('product_id', $input)) {
            $productIds = array_values(array_unique(array_filter((array)$input['product_id'], static function ($id): bool {
                return (is_int($id) || is_string($id)) && ctype_digit((string)$id) && (int)$id > 0;
            })));
            if (!$productIds) return $empty;
            $params['product_id'] = array_map('intval', $productIds);
        }

        $this->matched = null;
        $terms = ProductListSearch::terms($keywords);
        if ($terms) {
            $filters = [
                'product_id' => $params['product_id'] ?? null,
                'statuses' => $tab === 'current' ? self::CURRENT_STATUSES : ($tab === 'deleted' ? ['Deleted'] : null),
                'show_deleted' => $this->showDeleted,
            ];
            $this->matched = (new ProductListSearch())->matchingIds($terms, $filters, $this->visible);
            if (!$this->matched) return $empty;
        }

        add_hook('host_list_where_query_append', [self::class, 'applyScope']);
        $this->applied = false;
        $data = (new HostModel())->hostList($params);
        if (!$this->applied && ((int)($data['count'] ?? 0) > 0 || !empty($data['list']))) {
            throw new \RuntimeException('Native product list did not apply the theme query scope');
        }
        $data = OperationVerification::redact($data);
        $data['list'] = $this->appendStatusFields($data['list']);
        return $data;
    }

    public static function applyScope(array $event): void
    {
        $scope = $event['param'][self::SCOPE] ?? null;
        if (!$scope instanceof self || ($event['app'] ?? '') !== 'home') return;

        $query = $event['query'];
        if ($scope->visible !== null) $query->whereIn('h.id', $scope->visible);
        if ($scope->matched !== null) $query->whereIn('h.id', $scope->matched);
        if ($scope->tab === 'current') $query->whereIn('h.status', self::CURRENT_STATUSES);
        elseif (!$scope->showDeleted) $query->where('h.status', '<>', 'Deleted');
        $scope->applied = true;
    }

    private function appendStatusFields(array $hosts): array
    {
        if (!$hosts) return $hosts;
        // V10 formats the billing cycle and folds Failed into Pending in this list.
        $lifecycle = Db::name('host')->where('client_id', (int)get_client_id())
            ->whereIn('id', array_map('intval', array_column($hosts, 'id')))
            ->where('is_delete', 0)->field('id,status,billing_cycle')->select()->toArray();
        $byId = array_column($lifecycle, null, 'id');
        $now = time();
        foreach ($hosts as &$host) {
            $raw = $byId[$host['id']] ?? null;
            if ($raw) {
                $host['status'] = $raw['status'];
                $host['billing_cycle_code'] = $raw['billing_cycle'];
            }
            $host['list_server_time'] = $now;
            $host['renewal_window_end'] = strtotime(date('Y-m-d 23:59:59', $now + (int)($host['renewal_first_day_time'] ?? 0)));
        }
        unset($host);
        return $hosts;
    }
}
