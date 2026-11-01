<?php
/**
 * 购物车主题配置服务（CRA1 后台独立模块）— schema v2
 *
 * 设计要点（照 member_store.php 模式，第三个配置域）
 * --------
 * 1. 与官网 / 会员中心控制【完全独立】：不碰 config.json / member_center.json，
 *    购物车主题自己的规范配置在 runtime/cra1_theme/cart_theme.json。
 * 2. 复用同一个后台账号：本文件不含登录逻辑，全部由 cra1admin/index.php 的
 *    CRA1THEMEID session + CSRF 保护后调用。
 * 3. 运行时快照：cart_theme_public.json 只含前台展示字段（白名单投影）。
 * 4. v10 一级/二级导航名称（first_navigation/second_navigation）属系统设置，
 *    由 /console/v1/common 下发，不进入本配置域（单一真相）。
 * 5. v1 → v2 显式迁移（migrateV1ToV2），未知字段丢弃，旧文案按映射保留。
 */

declare(strict_types=1);
namespace CRA1\Theme\Storage;
use PDO;
use CRA1ThemeSecurity;
use stdClass;
use Throwable;
use RuntimeException;
use InvalidArgumentException;
use DOMDocument;
use DOMElement;
use DOMComment;
use DOMProcessingInstruction;
use DOMText;
use DOMNode;
use CRA1ThemePublicProjection;

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }
require_once CRA1_THEME_ROOT.'/public/cra1-shared/icons.php';

require_once CRA1_THEME_ROOT.'/public/cra1-shared/runtime.php';

final class CartThemeStore
{
    public const SCHEMA_VERSION = 2;

    /** 推荐位条目字段白名单（v2：product_id 为唯一商品来源，name/url 由前台按商品派生） */
    private const ITEM_FIELDS = ['id', 'product_id', 'title_override', 'desc_override', 'enabled'];

    /** 卡片展示区块 key 白名单（名称带恒显，v4 卡片无购买按钮） */
    private const SECTION_KEYS = ['desc', 'tags', 'stock', 'promo', 'price'];

    /** 列数/数量边界 */
    private const COL_DESKTOP = [2, 4];
    private const COL_TABLET = [1, 3];
    private const COL_MOBILE = [1, 2];
    private const ROWS_PER_LOAD = [1, 6];

    private string $dir;
    private string $mainFile;
    private string $publicFile;
    private string $lockFile;

    public function __construct(string $runtimeDir)
    {
        $this->dir        = rtrim($runtimeDir, '/') . '/cra1_theme';
        $this->mainFile   = $this->dir . '/cart_theme.json';
        $this->publicFile = $this->dir . '/cart_theme_public.json';
        $this->lockFile   = $this->dir . '/cart_theme.json.lock';
    }

    /* ===================================================================== */
    /* 默认值                                                                */
    /* ===================================================================== */

    public static function defaults(): array
    {
        return [
            'custom_code' => ['css'=>'','js'=>'','css_enabled'=>true,'js_enabled'=>true],
            'schema_version' => self::SCHEMA_VERSION,
            'version'        => 0,
            'updated_at'     => 0,
            'updated_by'     => '',
            'content'        => [
                'goodslist' => [
                    // 页面文案（一条记录；空=多语言默认）
                    'copy' => [
                        'title'       => '',
                        'subtitle'    => '',
                        'card_title'  => '产品型号', // 卡片区标题（空=隐藏该标题块）
                        'tabs_title'  => '选配方式', // 选配方式切换区标题（iframe 内 tabs 上方）
                        'show_desc'   => true,
                    ],
                    // 受控网格：三档列数 + 每批行数 + 描述行数
                    'grid' => [
                        'desktop_columns' => 3,
                        'tablet_columns'  => 2,
                        'mobile_columns'  => 1,
                        'rows_per_load'   => 3,
                        'desc_max_lines'  => 2,
                    ],
                    // 卡片展示区块 rows：{key, enabled}；顺序即展示顺序（模板固定容器内按此渲染）
                    'card_sections' => self::defaultSections(),
                    // 默认选择策略：first_available | 指定商品
                    'default_selection' => [
                        'product_id' => 0, // 0=首个可售
                    ],
                    // 配置区行为
                    'config_panel' => [
                        'default_open' => true,
                    ],
                    // Stable section identifiers; empty means the theme icon.
                    'heading_icons' => array_fill_keys(array_keys(self::headingDefinitions()), ''),
                    'heading_icon_styles' => array_fill_keys(array_keys(self::headingDefinitions()), null),
                ],
                'shoppingcar' => [
                    'empty' => [
                        'title'        => '',
                        'description'  => '',
                        'button_text'  => '',
                        'button_target' => '/cart/goodsList.htm',
                    ],
                    'recommendations' => [
                        'enabled' => false,
                        'title'   => '',
                        'items'   => [], // rows：{id, product_id, title_override, desc_override, enabled}
                    ],
                ],
                'settlement' => [
                    'copy' => [
                        'title'      => '',
                        'agree_text' => '',
                    ],
                ],
                'orderresult' => [
                    'copy' => [
                        'success_title' => '',
                        'cancel_title'  => '',
                        'pending_title' => '',
                    ],
                ],
            ],
        ];
    }

    /** 中文标题图标目录。图标标识只在内部使用，不依赖标题文案。 */
    public static function headingDefinitions(): array
    {
        return [
            'category_primary' => ['label'=>'一级产品分类','defaultIcon'=>'iconify:lucide:package'],
            'category_secondary' => ['label'=>'二级产品分类','defaultIcon'=>'iconify:lucide:package'],
            'product_model' => ['label'=>'产品型号','defaultIcon'=>'iconify:lucide:package'],
            'config_method' => ['label'=>'选配方式','defaultIcon'=>'iconify:lucide:settings'],
            'billing_cycle' => ['label'=>'付费周期','defaultIcon'=>'iconify:lucide:credit-card'],
            'basic' => ['label'=>'基础配置','defaultIcon'=>'iconify:lucide:cpu'],
            'package' => ['label'=>'套餐配置','defaultIcon'=>'iconify:lucide:package'],
            'instance' => ['label'=>'实例配置','defaultIcon'=>'iconify:lucide:cpu'],
            'model' => ['label'=>'型号配置','defaultIcon'=>'iconify:lucide:package'],
            'image' => ['label'=>'镜像配置','defaultIcon'=>'iconify:lucide:monitor'],
            'storage' => ['label'=>'存储配置','defaultIcon'=>'iconify:lucide:server'],
            'network' => ['label'=>'网络配置','defaultIcon'=>'iconify:lucide:network'],
            'security' => ['label'=>'安全组','defaultIcon'=>'iconify:lucide:shield-check'],
            'other' => ['label'=>'其他设置','defaultIcon'=>'iconify:lucide:settings'],
            'option' => ['label'=>'自定义选项','defaultIcon'=>'iconify:lucide:settings'],
            'price' => ['label'=>'配置费用','defaultIcon'=>'iconify:lucide:credit-card'],
        ];
    }

    private static function cleanHeadingIcon($value): string { return is_string($value)?$value:''; }
    public static function validateHeadingIcons($icons,array $old=[]): void {
        if(!is_array($icons))throw new InvalidArgumentException('标题图标格式不正确');
        foreach($icons as $key=>$value){if(!isset(self::headingDefinitions()[$key]))throw new InvalidArgumentException('未知标题图标');cra1_icon_validate_change($value,$old[$key]??null,'cart');}
    }

    private static function headingIconUrl(string $spec): string { return cra1_icons_url($spec); }
    public static function validateHeadingIconStyles($styles): void {
        if (!is_array($styles))throw new InvalidArgumentException('栏目图标样式格式不正确');
        foreach($styles as $id=>$style){if(!isset(self::headingDefinitions()[$id]))throw new InvalidArgumentException('未知栏目图标样式');cra1_icon_style_clean($style);}
    }

    /** 卡片区块默认顺序（可分别关闭，这里给出初始 rows） */
    public static function defaultSections(): array
    {
        return [
            ['key' => 'desc',  'enabled' => true],
            ['key' => 'tags',  'enabled' => true],
            ['key' => 'stock', 'enabled' => true],
            ['key' => 'promo', 'enabled' => true],
            ['key' => 'price', 'enabled' => true],
        ];
    }

    /* ===================================================================== */
    /* 读 / 写                                                               */
    /* ===================================================================== */

    public function exists(): bool
    {
        return is_file($this->mainFile);
    }

    /** 读取规范配置（缺失/损坏时返回默认值，不写盘） */
    public function read(): array
    {
        $data = $this->readJson($this->mainFile);
        if (!is_array($data)) {
            if (is_file($this->mainFile)) {
                throw new RuntimeException('主配置 JSON 损坏，保存已中止，原文件保留');
            }
            return self::defaults();
        }
        return $this->normalizeConfig($data);
    }

    /** 确保前台快照与主配置一致（自愈） */
    public function ensureSnapshot(): void
    {
        $lock = $this->acquireLock();
        if ($lock === false || is_string($lock)) throw new RuntimeException('快照存储锁不可用');
        try {
        $config = $this->read();
        $snap = $this->readJson($this->publicFile);
        $stale = !is_array($snap)
            || (int) ($snap['projection_version'] ?? -1) !== 2
            || (int) ($snap['schema_version'] ?? -1) !== self::SCHEMA_VERSION
            || (int) ($snap['version'] ?? -1) !== (int) $config['version']
            || json_encode($snap['content'] ?? null, JSON_UNESCAPED_UNICODE)
               !== json_encode($this->publicContent($config), JSON_UNESCAPED_UNICODE)
            || json_encode($snap['custom_code'] ?? null, JSON_UNESCAPED_UNICODE)
               !== json_encode(CRA1ThemePublicProjection::code($config['custom_code']), JSON_UNESCAPED_UNICODE);
        if ($stale && !$this->writePublicSnapshot($config)) {
            throw new RuntimeException('前台快照同步失败，请检查存储目录权限');
        }
        } finally { $this->releaseLock($lock); }
    }

    /** 保存规范配置（顶层只接受 content；乐观锁防并发覆盖） */
    public function save(array $patch, string $operator, int $expectVersion = 0, ?array $scope = null): array
    {
        $lock = $this->acquireLock();
        if (is_string($lock)) {
            return ['status' => 400, 'msg' => $lock];
        }
        if ($lock === false) {
            return ['status' => 400, 'msg' => '配置正被其他请求修改，请稍后重试'];
        }

        try {
            $current = $this->read();

            if ($scope !== null) {
                $values = $scope['project']($current);
                $revision = theme_workspace_revision($values);
                if (!hash_equals($revision, (string) $scope['expectedRevision'])) {
                    return ['status' => 409, 'msg' => '当前范围已被其他会话修改，草稿已保留',
                        'data' => ['values' => $values, 'revision' => $revision, 'version' => $current['version']]];
                }
                $patch = $scope['merge']($current);
            }

            if ($expectVersion > 0 && (int) $current['version'] !== $expectVersion) {
                return [
                    'status' => 409,
                    'msg'    => '配置已被其他会话修改（当前版本 ' . $current['version'] . '），请刷新后重试',
                    'data'   => ['version' => $current['version']],
                ];
            }

            if (array_key_exists('content', $patch) && is_array($patch['content'])) {
                if (isset($patch['content']['goodslist']) && array_key_exists('heading_icons',$patch['content']['goodslist'])) {
                    self::validateHeadingIcons($patch['content']['goodslist']['heading_icons'],$current['content']['goodslist']['heading_icons']??[]);
                }
                if (array_key_exists('heading_icon_styles',$patch['content']['goodslist']??[])) self::validateHeadingIconStyles($patch['content']['goodslist']['heading_icon_styles']);
                $current['content'] = $this->mergeContent($current['content'], $patch['content']);
            }
            if (array_key_exists('custom_code',$patch)) $current['custom_code']=$patch['custom_code'];

            $current['schema_version'] = self::SCHEMA_VERSION;
            $current['version']        = (int) $current['version'] + 1;
            $current['updated_at']     = time();
            $current['updated_by']     = $operator;

            $normalized = $this->normalizeConfig($current);

            if (!$this->atomicWrite($this->mainFile, (string) json_encode(
                $normalized,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
            ))) {
                return ['status' => 400, 'msg' => '保存失败：存储文件不可写'];
            }

            $snapshotOk = $this->writePublicSnapshot($normalized);

            return [
                'status' => 200,
                'msg'    => $snapshotOk ? '已保存' : '已保存，但前台快照写入失败',
                'data'   => [
                    'config'      => $this->read(),
                    'snapshot_ok' => $snapshotOk,
                ],
            ];
        } finally {
            $this->releaseLock($lock);
        }
    }

    /** 重置为默认（同一把锁） */
    public function reset(string $operator): array
    {
        $lock = $this->acquireLock();
        if (is_string($lock)) {
            return ['status' => 400, 'msg' => $lock];
        }
        if ($lock === false) {
            return ['status' => 400, 'msg' => '配置正被其他请求修改，请稍后重试'];
        }
        try {
            $cur = $this->read();
            $fresh = self::defaults();
            $fresh['custom_code']=$cur['custom_code'];
            $fresh['version']    = (int) $cur['version'] + 1;
            $fresh['updated_at'] = time();
            $fresh['updated_by'] = $operator;

            if (!$this->atomicWrite($this->mainFile, (string) json_encode(
                $fresh,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
            ))) {
                return ['status' => 400, 'msg' => '重置失败：存储文件不可写'];
            }
            $snapshotOk = $this->writePublicSnapshot($fresh);
            return ['status' => 200, 'msg' => $snapshotOk ? '已恢复默认' : '配置已恢复默认，前台同步失败，请重试同步',
                'data' => ['config' => $this->read(), 'snapshot_ok' => $snapshotOk]];
        } finally {
            $this->releaseLock($lock);
        }
    }

    /** 前台公开投影（白名单：只含展示字段） */
    public function publicContent(array $config): array
    {
        $c = $config['content'];
        $public = [
            'goodslist' => [
                'copy' => [
                    'title'        => (string) $c['goodslist']['copy']['title'],
                    'subtitle'     => (string) $c['goodslist']['copy']['subtitle'],
                    'card_title'   => (string) $c['goodslist']['copy']['card_title'],
                    'tabs_title'   => (string) $c['goodslist']['copy']['tabs_title'],
                    'show_desc'    => (bool) $c['goodslist']['copy']['show_desc'],
                ],
                'grid' => [
                    'desktop_columns' => (int) $c['goodslist']['grid']['desktop_columns'],
                    'tablet_columns'  => (int) $c['goodslist']['grid']['tablet_columns'],
                    'mobile_columns'  => (int) $c['goodslist']['grid']['mobile_columns'],
                    // rows_per_load：前台 goodsList.js 的 limitFromGrid 依赖它算每批条数
                    // （早前投影漏了该键，后台可编但前台恒回落默认 3 行 —— 幽灵字段）
                    'rows_per_load'   => (int) $c['goodslist']['grid']['rows_per_load'],
                    'desc_max_lines'  => (int) $c['goodslist']['grid']['desc_max_lines'],
                ],
                'card_sections' => array_values(array_map(
                    static function ($r): array {
                        return ['key' => (string) $r['key'], 'enabled' => (bool) $r['enabled']];
                    },
                    array_values(array_filter(
                        $c['goodslist']['card_sections'],
                        static function ($r): bool { return is_array($r); }
                    ))
                )),
                'default_selection' => ['product_id' => (int)$c['goodslist']['default_selection']['product_id']],
                'config_panel' => [
                    'default_open' => (bool) $c['goodslist']['config_panel']['default_open'],
                ],
            ],
            'shoppingcar' => [
                'empty' => [
                    'title'         => (string) $c['shoppingcar']['empty']['title'],
                    'description'   => (string) $c['shoppingcar']['empty']['description'],
                    'button_text'   => (string) $c['shoppingcar']['empty']['button_text'],
                    'button_target' => (string) $c['shoppingcar']['empty']['button_target'],
                ],
                'recommendations' => [
                    'enabled' => (bool) $c['shoppingcar']['recommendations']['enabled'],
                    'title'   => (string) $c['shoppingcar']['recommendations']['title'],
                    'items'   => array_values(array_map(
                        static function ($r): array {
                            return [
                                'id'             => (string) $r['id'],
                                'product_id'     => (int) $r['product_id'],
                                'title_override' => (string) $r['title_override'],
                                'desc_override'  => (string) $r['desc_override'],
                                'enabled'        => (bool) $r['enabled'],
                            ];
                        },
                        array_values(array_filter(
                            $c['shoppingcar']['recommendations']['items'],
                            static function ($r): bool {
                                return is_array($r) && (bool) $r['enabled'] && (int) $r['product_id'] > 0;
                            }
                        ))
                    )),
                ],
            ],
            'settlement' => [
                'copy' => [
                    'title'      => (string) $c['settlement']['copy']['title'],
                    'agree_text' => (string) $c['settlement']['copy']['agree_text'],
                ],
            ],
            'orderresult' => [
                'copy' => [
                    'success_title' => (string) $c['orderresult']['copy']['success_title'],
                    'cancel_title'  => (string) $c['orderresult']['copy']['cancel_title'],
                    'pending_title' => (string) $c['orderresult']['copy']['pending_title'],
                ],
            ],
        ];
        // Keep the old public projection byte-equivalent until an icon is set.
        // Upgrading the interface must not rewrite otherwise current snapshots.
        $icons=array_filter($c['goodslist']['heading_icons']??[],static function($v){return $v!=='';});
        if ($icons) {
            foreach ($icons as $id=>$spec) {
                $url=self::headingIconUrl($spec);
                if ($url!=='') { $public['goodslist']['heading_icons'][$id]=$url;$d=cra1_icons_resolve($spec);$public['goodslist']['heading_icon_meta'][$id]=['colorable'=>!empty($d['colorable'])]; }
            }
        }
        $styles=array_filter($c['goodslist']['heading_icon_styles']??[],static function($v){return $v!==null;});
        if($styles)$public['goodslist']['heading_icon_styles']=$styles;
        return CRA1ThemePublicProjection::content($public);
    }

    /** 写入前台运行时快照（publicContent 投影） */
    public function writePublicSnapshot(?array $config = null): bool
    {
        $config = $config ?? $this->read();
        $snapshot = [
            'schema_version' => self::SCHEMA_VERSION,
            'version'        => (int) $config['version'],
            'content'        => $this->publicContent($config),
            'custom_code'    => CRA1ThemePublicProjection::code($config['custom_code']),
            'projection_version' => 2,
        ];
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0755, true);
        }
        return $this->atomicWrite($this->publicFile, (string) json_encode(
            $snapshot,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
        ));
    }

    /* ===================================================================== */
    /* 规范化与迁移                                                          */
    /* ===================================================================== */

    public function normalizedPreview(array $data): array { return $this->normalizeConfig($data); }

    private function normalizeConfig(array $data): array
    {
        $def = self::defaults();
        $version = (int) ($data['version'] ?? 0);
        $updatedBy = (string) ($data['updated_by'] ?? '');
        $updatedAt = (int) ($data['updated_at'] ?? 0);

        // v1 → v2 显式迁移（旧 goodslist.* 平铺键 / shoppingcar.empty_* / hot_* → 新结构）
        $migrated = $this->migrateV1ToV2($data);
        $contentRaw = $migrated['content'];

        $out = $def;
        $code=is_array($data['custom_code']??null)?$data['custom_code']:[];
        $out['custom_code']=['css'=>(string)($code['css']??''),'js'=>(string)($code['js']??''),'css_enabled'=>(bool)($code['css_enabled']??true),'js_enabled'=>(bool)($code['js_enabled']??true)];
        $out['version']    = $version;
        $out['updated_at'] = $updatedAt;
        $out['updated_by'] = $updatedBy;
        if (is_array($contentRaw)) {
            $out['content'] = $this->mergeContent($def['content'], $contentRaw);
        }
        return $out;
    }

    /**
     * v1 → v2：旧平铺键映射进新嵌套结构；未知键丢弃。
     * 幂等：已是 v2 键时原样保留。
     */
    private function migrateV1ToV2(array $data): array
    {
        if ((int) ($data['schema_version'] ?? 0) >= self::SCHEMA_VERSION) {
            return $data;
        }
        $c = is_array($data['content'] ?? null) ? $data['content'] : [];
        $g = is_array($c['goodslist'] ?? null) ? $c['goodslist'] : [];
        $s = is_array($c['shoppingcar'] ?? null) ? $c['shoppingcar'] : [];
        $st = is_array($c['settlement'] ?? null) ? $c['settlement'] : [];
        $or = is_array($c['orderresult'] ?? null) ? $c['orderresult'] : [];

        $new = $c;
        // goodslist
        $ng = $new['goodslist'] ?? [];
        if (!isset($ng['copy']) && (isset($g['title']) || isset($g['subtitle']) || isset($g['show_desc']))) {
            $ng['copy'] = [
                'title'     => $g['title'] ?? '',
                'subtitle'  => $g['subtitle'] ?? '',
                'show_desc' => $g['show_desc'] ?? true,
            ];
        }
        $new['goodslist'] = $ng;
        // shoppingcar
        $ns = $new['shoppingcar'] ?? [];
        if (!isset($ns['empty']) && (isset($s['empty_title']) || isset($s['empty_desc']) || isset($s['empty_btn']))) {
            $ns['empty'] = [
                'title'         => $s['empty_title'] ?? '',
                'description'   => $s['empty_desc'] ?? '',
                'button_text'   => $s['empty_btn'] ?? '',
                'button_target' => '/cart/goodsList.htm',
            ];
        }
        if (!isset($ns['recommendations']) && (isset($s['hot_enable']) || isset($s['hot_items']))) {
            $ns['recommendations'] = [
                'enabled' => $s['hot_enable'] ?? false,
                'title'   => $s['hot_title'] ?? '',
                'items'   => array_map(
                    static function (array $r): array {
                        // 旧条目手填 url/name：提取 product_id，提取失败则 product_id=0（后台提示重绑）
                        $pid = 0;
                        if (!empty($r['url']) && preg_match('/[?&]id=(\d+)/', (string) $r['url'], $m)) {
                            $pid = (int) $m[1];
                        }
                        return [
                            'id'             => (string) ($r['id'] ?? ''),
                            'product_id'     => $pid,
                            'title_override' => (string) ($r['name'] ?? ''),
                            'desc_override'  => (string) ($r['desc'] ?? ''),
                            'enabled'        => (bool) ($r['enabled'] ?? true),
                        ];
                    },
                    is_array($s['hot_items'] ?? null) ? $s['hot_items'] : []
                ),
            ];
        }
        $new['shoppingcar'] = $ns;
        // settlement / orderresult
        if (!isset($new['settlement']['copy']) && (isset($st['title']) || isset($st['agree_text']))) {
            $new['settlement']['copy'] = ['title' => $st['title'] ?? '', 'agree_text' => $st['agree_text'] ?? ''];
        }
        if (!isset($new['orderresult']['copy']) && (isset($or['success_title']) || isset($or['cancel_title']) || isset($or['pending_title']))) {
            $new['orderresult']['copy'] = [
                'success_title' => $or['success_title'] ?? '',
                'cancel_title'  => $or['cancel_title'] ?? '',
                'pending_title' => $or['pending_title'] ?? '',
            ];
        }
        $data['content'] = $new;
        $data['schema_version'] = self::SCHEMA_VERSION;
        return $data;
    }

    /* ===================================================================== */
    /* content 合并与校验（白名单制 + 严格类型）                              */
    /* ===================================================================== */

    private function mergeContent(array $base, array $patch): array
    {
        $out = $base;
        foreach (['goodslist', 'shoppingcar', 'settlement', 'orderresult'] as $group) {
            if (!isset($patch[$group]) || !is_array($patch[$group]) || !isset($base[$group]) || !is_array($base[$group])) {
                continue;
            }
            foreach ($patch[$group] as $k => $v) {
                if (!array_key_exists($k, $base[$group]) || !is_array($base[$group][$k])) {
                    continue; // 白名单外/结构不符拒绝
                }
                // rows 类字段：列表结构，按专用清洗器处理（不走关联键合并）
                if ($group === 'goodslist' && $k === 'card_sections') {
                    $out[$group][$k] = $this->sanitizeSections($v);
                    continue;
                }
                if ($group === 'shoppingcar' && $k === 'items') {
                    $out[$group][$k] = $this->sanitizeItems($v);
                    continue;
                }
                $out[$group][$k] = $this->mergeSub($base[$group][$k], $v, $group, $k);
            }
        }
        return $out;
    }

    private function mergeSub(array $base, $patch, string $group, string $sub): array
    {
        if (!is_array($patch)) {
            return $base;
        }
        $out = $base;
            foreach ($patch as $k => $v) {
                if (!array_key_exists($k, $base)) {
                    continue; // 白名单外拒绝
                }
                if ($group==='goodslist' && $sub==='heading_icon_styles') { $out[$k]=cra1_icon_style_clean($v);continue; }
                if ($group==='goodslist' && $sub==='heading_icons') {
                    $out[$k]=self::cleanHeadingIcon($v);
                    continue;
                }
                if (is_array($base[$k])) {
                    // rows 类列表字段（recommendations.items 等）走专用清洗器
                    if ($group === 'shoppingcar' && $sub === 'recommendations' && $k === 'items') {
                        $out[$k] = $this->sanitizeItems($v);
                        continue;
                    }
                    continue; // 其它嵌套结构不接受
                }
            if (is_bool($base[$k])) {
                $out[$k] = $this->strictBool($v, (bool) $base[$k]);
                continue;
            }
            if (is_int($base[$k])) {
                $out[$k] = $this->boundedInt($v, $group, $sub, $k, (int) $base[$k]);
                continue;
            }
            if ($k === 'button_target') {
                $out[$k] = $this->safePath((string) $v, (string) $base[$k]);
                continue;
            }
            $out[$k] = $this->cleanText((string) $v, 200);
        }
        return $out;
    }

    /** 严格布尔：仅 true/false/1/0/"1"/"0" */
    private function strictBool($v, bool $fallback): bool
    {
        if (is_bool($v)) return $v;
        if (is_int($v)) return $v === 1;
        if (is_string($v)) {
            if ($v === '1') return true;
            if ($v === '0') return false;
        }
        return $fallback;
    }

    /** 带边界的整数（列数/行数等），越界回落默认 */
    private function boundedInt($v, string $group, string $sub, string $key, int $fallback): int
    {
        $n = (int) $v;
        if ((string) (int) $v !== (string) $v && !is_int($v)) return $fallback;
        if ($group === 'goodslist' && $sub === 'grid') {
            switch ($key) {
                case 'desktop_columns': return ($n >= self::COL_DESKTOP[0] && $n <= self::COL_DESKTOP[1]) ? $n : $fallback;
                case 'tablet_columns':  return ($n >= self::COL_TABLET[0] && $n <= self::COL_TABLET[1]) ? $n : $fallback;
                case 'mobile_columns':  return ($n >= self::COL_MOBILE[0] && $n <= self::COL_MOBILE[1]) ? $n : $fallback;
                case 'rows_per_load':   return ($n >= self::ROWS_PER_LOAD[0] && $n <= self::ROWS_PER_LOAD[1]) ? $n : $fallback;
                case 'desc_max_lines':  return ($n >= 1 && $n <= 12) ? $n : $fallback;
            }
        }
        if ($key === 'product_id') {
            return $n > 0 ? min($n, 2147483647) : 0;
        }
        return $fallback;
    }

    /** 卡片区块 rows：key 白名单 + 去重；空列表表示关闭全部区块；顺序保留 */
    private function sanitizeSections($rows): array
    {
        if (!is_array($rows)) {
            return self::defaultSections();
        }
        $seen = [];
        $out = [];
        foreach (array_slice($rows, 0, count(self::SECTION_KEYS)) as $r) {
            if (!is_array($r)) continue;
            $key = (string) ($r['key'] ?? '');
            if (!in_array($key, self::SECTION_KEYS, true) || isset($seen[$key])) continue;
            $seen[$key] = true;
            $out[] = ['key' => $key, 'enabled' => $this->strictBool($r['enabled'] ?? true, true)];
        }
        return $out;
    }

    /** 推荐条目 rows：product_id 必填、去重、上限 12 */
    private function sanitizeItems($rows): array
    {
        if (!is_array($rows)) {
            return [];
        }
        $seen = [];
        $out = [];
        foreach (array_slice($rows, 0, 12) as $r) {
            if (!is_array($r)) continue;
            $pid = (int) ($r['product_id'] ?? 0);
            if ($pid <= 0 || isset($seen[$pid])) continue;
            $seen[$pid] = true;
            $out[] = [
                'id'             => $this->cleanText((string) ($r['id'] ?? ''), 64) ?: ('h' . bin2hex(random_bytes(4))),
                'product_id'     => $pid,
                'title_override' => $this->cleanText((string) ($r['title_override'] ?? ''), 100),
                'desc_override'  => $this->cleanText((string) ($r['desc_override'] ?? ''), 200),
                'enabled'        => $this->strictBool($r['enabled'] ?? true, true),
            ];
        }
        return $out;
    }

    /** Match the visual link picker: site pages, HTTPS, anchors and contacts. */
    private function safePath(string $v, string $fallback): string
    {
        $v = $this->cleanText($v, 200);
        if ($v === '') return $fallback;
        if (strncmp($v, '//', 2) === 0 || !preg_match('~^(?:/|#|https://|tel:|mailto:)~i', $v)) return $fallback;
        if (preg_match('/[<>"\'\s]/', $v)) return $fallback;
        return $v;
    }

    /** 纯文本清洗：去标签、合并空白、限长 */
    private function cleanText(string $s, int $max = 200): string
    {
        $s = strip_tags($s);
        $s = preg_replace('/\s+/u', ' ', $s) ?? '';
        return trim(mb_substr($s, 0, $max));
    }

    /* ===================================================================== */
    /* 文件原子操作（同 member_store 模式）                                   */
    /* ===================================================================== */

    private function readJson(string $file)
    {
        if (!is_file($file)) {
            return null;
        }
        $raw = (string) file_get_contents($file);
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    private function atomicWrite(string $file, string $content): bool
    {
        $tmp = $file . '.' . getmypid() . '.tmp';
        if (@file_put_contents($tmp, $content) === false) {
            return false;
        }
        if (!@rename($tmp, $file)) {
            @unlink($tmp);
            return false;
        }
        @chmod($file, 0644);
        return true;
    }

    /**
     * 获取排他锁。
     * @return resource|false|string 成功返回句柄；fopen 失败（权限/属主问题）返回错误文案字符串；flock 竞争失败返回 false
     */
    private function acquireLock()
    {
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0755, true);
        }
        $fp = @fopen($this->lockFile, 'c');
        if ($fp === false) {
            $owner = @fileowner($this->lockFile);
            $whoami = function_exists('getmyuid') ? getmyuid() : -1;
            if ($owner !== false && $whoami !== false && $owner !== $whoami) {
                return '配置存储文件属主与 Web 进程不一致，保存不可用（历史上曾以其他用户运行过命令行工具；请将 runtime/cra1_theme/cart_theme* 文件属主改为 Web 用户）';
            }
            return '配置存储不可写：无法打开锁文件（请检查 ' . $this->lockFile . ' 的权限）';
        }
        if (!@flock($fp, LOCK_EX)) {
            fclose($fp);
            return false;
        }
        return $fp;
    }

    /** @param resource|false $fp */
    private function releaseLock($fp): void
    {
        if (is_resource($fp)) {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }
}
