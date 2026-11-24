<?php
declare(strict_types=1);

namespace CRA1\Theme\Storage;

use CRA1\Theme\Context;
use CRA1\Theme\Presentation\ClientareaTemplates;

/** Inspect the saved configuration and the same public projection the browser reads. */
trait EffectiveSources
{
    public function effectiveSources(string $domain, string $id): array
    {
        $editor = $this->editor($domain, $id);
        $settings = $this->member->themeSelectionForInspection();
        $data = ['theme'=>$this->inspectThemeSelection($domain, $id, $settings)];
        $raw = $this->editorRead($domain);
        if ($domain === 'website' && $editor['kind'] === 'page') {
            $data += $this->inspectWebsite($editor, $raw);
        } elseif ($domain === 'member' && in_array($id, ['sidebar','products'], true)) {
            $data += $this->inspectMember($id, $raw);
        } elseif ($domain === 'cart' && $editor['kind'] === 'page') {
            $data += $this->inspectCart($editor, $raw);
        } else {
            throw new \InvalidArgumentException('当前设置没有独立的页面生效来源');
        }
        return ['status'=>200, 'msg'=>'已读取', 'data'=>$data];
    }

    private function inspectThemeSelection(string $domain, string $id, array $settings): array
    {
        if (!$settings) return ['available'=>false];
        $templates = new ClientareaTemplates();
        $pc = $templates->normalizeName($settings['clientarea_theme'] ?? '');
        $phone = $templates->normalizeName($settings['clientarea_theme_mobile'] ?? '');
        $phoneOn = (int)($settings['clientarea_theme_mobile_switch'] ?? 0) === 1;
        if ($domain === 'website') {
            $theme = $templates->normalizeName($settings['web_theme'] ?? '');
            $enabled = (bool)($settings['web_switch'] ?? false);
            return ['available'=>true, 'pc'=>$enabled ? $theme : '', 'phone'=>$enabled ? $theme : '',
                'active'=>$enabled && Context::isCRA1($theme) && is_dir($this->root.'/public/web/'.$theme),
                'note'=>$enabled ? '官网使用同一个桌面与手机主题。' : 'V10 官网入口已关闭。'];
        }
        if ($domain === 'member') {
            return ['available'=>true, 'pc'=>$pc, 'phone'=>$phoneOn ? $phone : $pc,
                'active'=>Context::isCRA1($pc) || ($phoneOn && Context::isCRA1($phone)),
                'note'=>'分别显示 V10 的桌面及手机默认主题。访问参数、手机站开关和页面模板回退会影响实际页面。'];
        }
        $pages = ['goodslist'=>'goodsList','shoppingcar'=>'shoppingCar','settlement'=>'settlement','orderresult'=>'orderResult'];
        $page = $pages[$id] ?? '';
        $cartPc = $templates->normalizeName($settings['cart_theme'] ?? '');
        $cartPhone = $templates->normalizeName($settings['cart_theme_mobile'] ?? '');
        $desktop = $templates->cartTheme($page, false, $cartPc, $cartPhone);
        $mobile = $phoneOn ? $templates->cartTheme($page, true, $cartPc, $cartPhone) : $desktop;
        return ['available'=>true, 'pc'=>$desktop, 'phone'=>$mobile, 'shellPc'=>$pc, 'shellPhone'=>$phoneOn ? $phone : $pc,
            'active'=>Context::isCRA1($desktop) || Context::isCRA1($mobile),
            'note'=>'显示站点默认选择的购物车主体及会员导航。产品选配页可按模块回退到官方模板，浏览器主题选择也可能改变结果。'];
    }

    private function inspectWebsite(array $editor, array $raw): array
    {
        $page = $editor['pageKey'];
        $config = $this->resolved($raw);
        $pageConfig = cra1_page_content_config($page, $config);
        $orders = $this->document($raw, 'page_module_orders_json');
        $orders['pages'] = $orders['pages'] ?? [];
        $order = cra1_page_module_order($page, $orders);
        $visibility = $this->document($raw, 'page_module_visibility_json');
        $overrides = $this->document($raw, 'page_content_overrides_json')['pages'][$page]['values'] ?? [];
        $fields = $this->pageEditorValues($editor, $raw);
        $modules = [];
        foreach ($editor['modules'] as $module) {
            $id = $module['id'];
            $key = $module['visibilityKey'] ?? null;
            $position = array_search($id, $order, true);
            $origin = '模板默认';
            if ($key !== null) {
                if (array_key_exists($id, $visibility['pages'][$page] ?? [])) $origin = '当前页面';
                elseif (array_key_exists($id, $visibility['defaults'] ?? [])) $origin = '公共设置';
                elseif (array_key_exists($key, $raw) && $raw[$key] !== '' && $raw[$key] !== null) $origin = '已有显隐设置';
                elseif (isset($raw['shared_module_off_text']) && !cra1_module_visible($id, $page, $config, $raw)) $origin = '已有公共隐藏规则';
            }
            $modules[$id] = ['id'=>$id, 'label'=>$module['label'], 'position'=>$position === false ? null : $position+1,
                'visible'=>cra1_module_visible($id, $page, $config, $raw), 'visibilitySource'=>$origin, 'fields'=>[]];
        }
        foreach ($editor['fields'] as $field) {
            $id = $field['moduleId'] ?? '';
            if (!isset($modules[$id])) continue;
            $key = $field['key'];
            $source = '模板默认';
            $shared = null;
            foreach ($this->catalog['assignments'][$key] ?? [] as $assignment) {
                if (strpos($assignment,'shared:') === 0) {$shared = substr($assignment,7);break;}
            }
            $legacy = $field['legacyPageKey'] ?? '';
            if (array_key_exists($key, $overrides)) $source = '当前页面';
            elseif ($legacy !== '' && trim((string)($pageConfig[$legacy] ?? '')) !== '') {
                if (array_key_exists($legacy, $overrides) || in_array($legacy, $config['_theme_saved_fields'], true)) $source = '已有页面设置';
            } elseif (in_array($key, $config['_theme_saved_fields'], true) || in_array($key, $config['_public_explicit_fields'], true)) {
                $source = $shared === null ? '已保存配置' : '公共设置';
                if ($field['adapter'] === 'page-rows') {
                    $source = '模板默认';
                    foreach (preg_split('/\r?\n/', (string)$pageConfig[$key]) as $line) {
                        if (trim($line) === '' || strpos(ltrim($line), '!') === 0) continue;
                        $target = $this->rowPage($line);
                        if ($target === $page) {$source = '已有页面条目';break;}
                        if (cra1_row_targets_page($target,$page)) $source = '公共条目';
                    }
                }
            }
            $modules[$id]['fields'][] = ['key'=>$key, 'label'=>$field['label'], 'source'=>$source,
                'value'=>$this->inspectionText($fields[$key] ?? ''), 'shared'=>in_array($source, ['公共设置','公共条目'],true) ? $shared : null];
        }
        $sortKey = cra1_page_module_registry()[$page]['sortKey'] ?? '';
        return ['label'=>$editor['label'], 'url'=>$this->catalog['pages'][$page]['route'],
            'orderSource'=>isset($orders['pageOverrides'][$page]) ? '当前页面' : (isset($orders['pages'][$sortKey]) ? '同类页面设置' : '模板默认'),
            'modules'=>array_values($modules)];
    }

    private function inspectMember(string $id, array $raw): array
    {
        $expected = $this->member->snapshotProjection($raw);
        $data = $this->inspectSnapshot('member_center_public.json', $expected)
            + ['url'=>$id === 'products' ? '/productList.htm' : '/home.htm'];
        $live = $expected['sidebar'] ?? [];
        if ($id === 'products') {
            return $data + ['nav'=>$live, 'productList'=>$expected['content']['product_list'] ?? null];
        }
        $byId = [];
        $index = static function (array $items) use (&$index,&$byId): void {
            foreach ($items as $node) {
                $byId[(string)$node['id']] = $node;
                $index($node['children'] ?? []);
            }
        };
        $index($live);
        $items = [];
        $origin = (string)($GLOBALS['THEME_ORIGIN'] ?? '');
        $collect = static function (array $nodes, array $parents = [], bool $hidden = false) use (&$collect,&$items,$byId,$origin): void {
            foreach ($nodes as $node) {
                $path = array_merge($parents, [(string)$node['label']]);
                $entry = $byId[(string)$node['id']] ?? null;
                $isHidden = $hidden || !empty($node['hidden']);
                $items[] = ['id'=>(string)$node['id'], 'path'=>implode(' → ',$path), 'type'=>$node['source_type'] ?? 'custom',
                    'state'=>$entry ? 'published' : ($isHidden ? 'hidden' : 'unavailable'),
                    'url'=>$entry ? MenuTransfer::target($entry,$origin) : '', 'savedUrl'=>$node['url'] ?? '',
                    'products'=>$entry['product_id'] ?? []];
                $collect($node['children'] ?? [], $path, $isHidden);
            }
        };
        $collect($raw['sidebar']['nodes']);
        return $data + ['items'=>$items];
    }

    private function inspectCart(array $editor, array $raw): array
    {
        $id = $editor['id'];
        $effective = $this->cart->snapshotProjection($raw);
        $routes = ['goodslist'=>'/cart/goodsList.htm','shoppingcar'=>'/cart/shoppingCar.htm','settlement'=>'/cart/settlement.htm','orderresult'=>'/cart/orderResult.htm'];
        $labels = ['copy'=>'页面文案','grid'=>'商品卡片排列','card_sections'=>'卡片显示内容','default_selection'=>'默认商品','config_panel'=>'选配区域',
            'heading_icon_styles'=>'标题图标','heading_icons'=>'标题图标','empty'=>'空购物车','recommendations'=>'推荐商品'];
        $defaults = [
            'goodslist'=>['copy'=>['title'=>'订购产品','card_title'=>'产品型号','tabs_title'=>'选配方式'],'default_selection'=>['product_id'=>0],'config_panel'=>['default_open'=>false]],
            'shoppingcar'=>['empty'=>['title'=>'暂无商品']],
            'settlement'=>['copy'=>['title'=>'请核对商品信息','agree_text'=>'已阅读并同意']],
            'orderresult'=>['copy'=>['success_title'=>'订单已支付','cancel_title'=>'订单提交成功，请尽快付款！','pending_title'=>'订单提交成功，请尽快付款！订单号']],
        ][$id] ?? [];
        $fieldLabels = ['title'=>'标题','subtitle'=>'副标题','card_title'=>'商品区标题','tabs_title'=>'选配区标题',
            'show_desc'=>'显示分组说明','description'=>'说明','button_text'=>'按钮文字','button_target'=>'按钮地址',
            'enabled'=>'启用','product_id'=>'商品编号','default_open'=>'默认展开','desktop_columns'=>'桌面列数',
            'tablet_columns'=>'平板列数','mobile_columns'=>'手机列数','rows_per_load'=>'每批行数','desc_max_lines'=>'说明最多行数',
            'agree_text'=>'协议确认文案','success_title'=>'成功标题','cancel_title'=>'取消支付标题','pending_title'=>'待支付标题'];
        $blocks = [];
        $live = $effective['content'][$id] ?? [];
        foreach (array_unique(array_merge(array_keys($live), array_keys($defaults))) as $key) {
            $values = [];
            foreach ($live[$key] ?? [] as $field=>$value) {
                $source = '已保存设置';
                if ($value === '' && $field !== 'card_title') {
                    $value = $defaults[$key][$field] ?? '使用页面默认';
                    $source = '页面默认';
                }
                if ($field === 'product_id' && $value === 0) {
                    $value = '当前分组的首个可售商品';
                    $source = 'V10 商品目录';
                }
                if (is_array($value)) $value = count($value).' 项';
                if (is_bool($value)) $value = $value ? '开启' : '关闭';
                $values[] = ['label'=>$fieldLabels[$field] ?? (is_int($field) ? '第 '.($field+1).' 项' : $field),
                    'source'=>$source, 'value'=>$this->inspectionText($value)];
            }
            if ($key === 'card_sections') foreach ($values as $index=>&$value) {
                $item = $live[$key][$index];
                $value['value'] = (['image'=>'商品图片','name'=>'商品名称','description'=>'商品说明','price'=>'商品价格','button'=>'购买按钮'][$item['key']] ?? $item['key'])
                    .' · '.($item['enabled'] ? '显示' : '隐藏');
            }
            unset($value);
            $blocks[] = ['id'=>$key === 'heading_icon_styles' ? 'heading_icons' : $key, 'key'=>$key,
                'label'=>$labels[$key] ?? $key,'fields'=>$values];
        }
        return $this->inspectSnapshot('cart_theme_public.json',$effective) + [
            'label'=>$editor['label'],'url'=>$routes[$id] ?? '', 'blocks'=>$blocks,
            'note'=>$id === 'goodslist' ? '商品、分组及可售状态来自 V10 商品目录。默认商品不在当前分组或不可售时，使用分组内首个可售商品。'
                : (in_array($id,['settlement','orderresult'],true) ? '此页需要会员登录及有效购物车或订单。金额与状态由 V10 决定。' : '商品与金额由 V10 购物车提供。')];
    }

    private function inspectSnapshot(string $name, array $effective): array
    {
        [$snapshot,$state] = $this->readInspectionSnapshot($name);
        if ($state === 'current' && theme_workspace_revision($snapshot) !== theme_workspace_revision($effective)) $state = 'stale';
        return ['snapshot'=>$state,'version'=>$snapshot['version'] ?? null,'savedVersion'=>$effective['version']];
    }

    private function readInspectionSnapshot(string $name): array
    {
        $path = $this->root.'/runtime/cra1_theme/'.$name;
        if (!is_file($path)) return [[], 'missing'];
        try {
            $snapshot = self::readJson($path, false);
        } catch (\Throwable $error) {
            return [[], 'invalid'];
        }
        return [$snapshot, (int)($snapshot['projection_version'] ?? 0) === 2 ? 'current' : 'stale'];
    }

    private function inspectionText($value): string
    {
        return mb_strimwidth(trim(strip_tags(is_scalar($value) ? (string)$value : '')), 0, 720, '…', 'UTF-8');
    }
}
