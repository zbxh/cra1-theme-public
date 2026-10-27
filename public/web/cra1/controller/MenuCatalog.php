<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

require_once dirname(__DIR__, 3) . "/cra1-shared/cart-links.php";
/** Shared, read-only shopping-cart projection for the website and theme editor. */
function cra1_menu_catalog_rows(): array
{
    static $catalog = null;
    if ($catalog !== null) return $catalog;
    $catalog = ['groups' => [], 'products' => [], 'error' => ''];
    try {
        if (class_exists('think\\facade\\Db') && defined('WEB_ROOT')) {
            $catalog['groups'] = \think\facade\Db::name('product_group')->where('hidden', 0)
                ->field('id,name,parent_id,type,description')->order('order', 'desc')->order('id', 'asc')->select()->toArray();
            $catalog['products'] = \think\facade\Db::name('product')->where('hidden', 0)->where('product_id', 0)
                ->field('id,name,product_group_id')->order('order', 'desc')->order('id', 'asc')->select()->toArray();
        } else {
            if (!defined('DATABASE_HOSTNAME')) {
                $file = dirname(__DIR__, 4) . '/config.php';
                if (is_file($file)) require_once $file;
            }
            if (!defined('DATABASE_HOSTNAME') || !defined('DATABASE_NAME')) throw new \RuntimeException();
            $pdo = new \PDO('mysql:host=' . DATABASE_HOSTNAME . ';port=' . DATABASE_PORT . ';dbname=' . DATABASE_NAME . ';charset=' . DATABASE_CHARSET,
                DATABASE_USERNAME, DATABASE_PASSWORD, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION, \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC, \PDO::ATTR_TIMEOUT => 3]);
            $catalog['groups'] = $pdo->query('SELECT id,name,parent_id,type,description FROM idcsmart_product_group WHERE hidden=0 ORDER BY `order` DESC,id ASC')->fetchAll();
            $catalog['products'] = $pdo->query('SELECT id,name,product_group_id FROM idcsmart_product WHERE hidden=0 AND product_id=0 ORDER BY `order` DESC,id ASC')->fetchAll();
        }
    } catch (\Throwable $e) {
        $catalog = ['groups' => [], 'products' => [], 'error' => '购物车目录暂时不可用'];
    }
    return $catalog;
}

/** Rows must already follow the cart's descending order; hidden ancestors never leak. */
function cra1_menu_catalog_tree(array $groups, array $products): array
{
    $first = [];
    $second = [];
    foreach ($groups as $group) {
        if (!empty($group['hidden']) || (int)($group['id'] ?? 0) < 1) continue;
        if ((int)$group['parent_id'] === 0) $first[(int)$group['id']] = $group;
        else $second[(int)$group['id']] = $group;
    }
    $byGroup = [];
    foreach ($products as $product) {
        if (!empty($product['hidden']) || !empty($product['product_id']) || (int)($product['id'] ?? 0) < 1) continue;
        $byGroup[(int)$product['product_group_id']][] = $product;
    }
    $out = [];
    $node = static function ($name, $url, $level, $description = '') {
        return ['name' => (string)$name, 'file_address' => $url, 'description' => $description,
            'blank' => 0, 'level' => $level, 'children' => [], 'icon' => '', 'icon_svg' => '', 'icon_img' => '', 'source' => ''];
    };
    $description = static function ($group) {
        return mb_substr(trim(preg_replace('/\s+/u', ' ', strip_tags((string)($group['description'] ?? '')))), 0, 160);
    };
    foreach ($first as $id => $group) {
        $item = $node($group['name'], '/cart/goodsList.htm?fpg_id=' . $id, 2, $description($group));
        foreach ($second as $subId => $sub) {
            if ((int)$sub['parent_id'] !== $id) continue;
            $child = $node($sub['name'], '/cart/goodsList.htm?fpg_id=' . $id . '&spg_id=' . $subId, 3, $description($sub));
            foreach ($byGroup[$subId] ?? [] as $product) {
                $child['children'][] = $node($product['name'], cra1_cart_product_url($product['id']), 4);
            }
            $item['children'][] = $child;
        }
        // Same rule as the cart: a first-level category needs a visible second-level category.
        if ($item['children']) $out[] = $item;
    }
    return $out;
}

function cra1_menu_cart_tree(): array
{
    $rows = cra1_menu_catalog_rows();
    return cra1_menu_catalog_tree($rows['groups'], $rows['products']);
}

/** Per-parent sidebar data stays with the navigation record through reorder/rename. */
function cra1_menu_sidebar(array $item, int $depth, string $commonLinks): array
{
    $config = null;
    $raw = $item['sidebar_raw'] ?? '';
    if (is_string($raw) && strlen($raw) <= 32768) {
        $decoded = json_decode(rawurldecode($raw), true);
        if (is_array($decoded) && ($decoded['version'] ?? 0) === 1) $config = $decoded;
    }
    if ($config === null) {
        $config = ['title' => $item['name'], 'description' => $depth === 2 ? $item['description'] : '',
            'overview' => ['enabled' => $depth === 2, 'name' => $item['name'], 'url' => $item['file_address'], 'blank' => $item['blank'] === 1],
            'links' => $depth === 2 ? $commonLinks : ''];
    }
    $text = static function ($value, $length) { return is_string($value) ? mb_substr($value, 0, $length) : ''; };
    $overview = is_array($config['overview'] ?? null) ? $config['overview'] : [];
    $url = $text($overview['url'] ?? '', 2048);
    $name = $text($overview['name'] ?? '', 160);
    $links = cra1_parse_menu($text($config['links'] ?? '', 16384));
    return ['title' => $text($config['title'] ?? '', 160), 'description' => $text($config['description'] ?? '', 1024),
        'overview' => ['enabled' => ($overview['enabled'] ?? false) === true && $name !== '' && $url !== '' && cra1_url_ok($url) && !preg_match('/[\x00-\x1f\x7f]/', $url),
            'name' => $name, 'url' => $url, 'blank' => ($overview['blank'] ?? false) === true ? 1 : 0],
        'links' => array_slice($links, 0, 32)];
}

function cra1_resolve_menu($text, ?array $cart = null, string $commonLinks = ''): array
{
    $tree = cra1_parse_menu($text);
    foreach ($tree as &$item) {
        if (($item['source'] ?? '') === 'cart') {
            $item['children'] = $cart === null ? cra1_menu_cart_tree() : $cart;
            $item['layout_depth'] = 4;
        }
        $depth = static function (array $nodes) use (&$depth): int {
            $max = 0;
            foreach ($nodes as $node) $max = max($max, 1 + $depth($node['children']));
            return $max;
        };
        $item['layout_depth'] = $item['layout_depth'] ?? max(2, 1 + $depth($item['children']));
        $item['sidebar'] = cra1_menu_sidebar($item, $item['layout_depth'], $commonLinks);
    }
    unset($item);
    return $tree;
}
