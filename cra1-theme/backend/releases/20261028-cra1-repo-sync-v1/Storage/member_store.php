<?php
/**
 * 会员中心主题配置服务（CRA1 后台独立模块）
 *
 * 设计要点
 * --------
 * 1. 与官网主题控制【完全独立】
 *    官网读写的 runtime/cra1_theme/config.json 本文件一律不碰；
 *    会员中心自己的规范配置在 runtime/cra1_theme/member_center.json。
 * 2. 复用同一个后台账号
 *    本文件不含任何登录逻辑，全部由 cra1admin/index.php 的
 *    CRA1THEMEID session + CSRF 保护后调用。
 * 3. 不改系统导航
 *    只【只读】读取 idcsmart_menu / idcsmart_nav 作为导入源。
 *    刻意不走 MenuModel::getHomeMenu()：它会调用 createHomeMenu()，
 *    在没有菜单时写入默认数据；后台只读场景不应产生写副作用。
 *    为此这里用独立 PDO 只读查询，不引导 ThinkPHP。
 * 4. 独立副本
 *    导入后即为主题私有数据，使用稳定 UUID 作为身份，
 *    不使用 idcsmart_menu.id（该 ID 会在后台保存导航时整体删除重建）。
 * 5. 运行时快照
 *    member_center_public.json 是给前台读取的投影，只含公开字段
 *    （名称/URL/图标/层级/排序），不含内部管理信息。
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
require_once CRA1_THEME_ROOT.'/public/cra1-shared/cart-links.php';

final class MemberCenterStore
{
    public const SCHEMA_VERSION = 1;

    /** 侧栏最大层级（一级/二级/三级） */
    public const MAX_DEPTH = 3;

    /** 菜单类型白名单（与系统 saveHomeMenu 契约一致） */
    private const TYPES = ['system', 'plugin', 'custom', 'module', 'embedded', 'separator'];

    private string $dir;
    private string $mainFile;
    private string $publicFile;
    private string $lockFile;

    public function __construct(string $runtimeDir)
    {
        $this->dir        = rtrim($runtimeDir, '/') . '/cra1_theme';
        $this->mainFile   = $this->dir . '/member_center.json';
        $this->publicFile = $this->dir . '/member_center_public.json';
        $this->lockFile   = $this->dir . '/member_center.json.lock';
    }

    /* ===================================================================== */
    /* 默认值                                                                */
    /* ===================================================================== */

    /**
     * 默认配置。
     * 注意：appearance 只描述会员中心自身的展示，不复制官网 config.json 的任何键，
     * 避免两套配置在概念上混淆。
     */
    public static function defaults(): array
    {
        return [
            'custom_code' => ['css'=>'','js'=>'','css_enabled'=>true,'js_enabled'=>true],
            'schema_version' => self::SCHEMA_VERSION,
            'version'        => 1,
            'updated_at'     => 0,
            'updated_by'     => '',
            /*
             * appearance 只保留「会员中心外壳的展示开关」。
             *
             * 刻意不含主题选择（clientarea_theme / home_theme）：
             * 那两项由 v10 系统后台「主题设置」控制（写 idcsmart_configuration），
             * 主题后台再提供一份会造成两个入口互相覆盖。
             *
             * 也不含收藏：收藏是前台会员自己的偏好，存浏览器本地，
             * 后台不应替所有用户预设。
             */
            'appearance'     => [
                // 顶栏元素显隐
                'show_cart'        => 1,
                'show_language'    => 1,
                'show_message'     => 1,
                // 侧栏默认显隐
                'sidebar_default_open' => 0,
                // v20 手机端二级菜单折叠档位：one=展开一个 all=全部展开 none=全部关闭（仅手机端）
                'aside_mobile_expand'  => 'one',
            ],
            // 独立侧栏树（首次导入前为空）
            'sidebar'        => [
                'version'    => 1,
                'imported_at' => 0,
                // 树形态：2 = 旧两级（根节点即菜单），3 = 分组树（一级分组 → 菜单 → 页面）。
                // 3 由 migrateToGroupTree() 迁移后写入；公开快照据此下发 nav_shape。
                'shape'      => 2,
                'nodes'      => [],
                /*
                 * 最近访问设置（前台一级入口，置于「我的资源」上方）。
                 * 访问记录本身存于会员浏览器本地（localStorage，按会员区分），
                 * 后台只下发展示策略：标题 / 抓取天数 / 条数上限 / 新标签页打开。
                 */
                'recent'     => [
                    'enabled'   => 1,
                    'title'     => '最近访问',
                    'days'      => 7,      // 抓取几天内的访问记录
                    'max_items' => 8,      // 面板内最多展示条数
                    'new_tab'   => 0,      // 是否新标签页打开
                    'open_first' => 0,     // 打开侧边栏强制先显示最近访问
                ],
            ],
            /*
             * 会员中心内容设置（页面文案 / 公告），与官网 config.json 无关。
             *
             *   product_list  产品列表页顶部文案：default 全局默认，
             *                 overrides 按侧栏节点 UUID 覆盖（不用会重建的 menu id）。
             *                 每条可用 global 标记为「全局公告」（所有页面显示），
             *                 未标记的仅首页显示。标签/标题支持 HTML（含内联样式）。
             *
             * 与 appearance/sidebar 一样只保留白名单键；HTML 一律经过
             * sanitizeContentHtml() 白名单清理后才入库与下发。
             */
            'content'        => [
                'auth_login' => AuthAppearance::defaults('login'),
                'auth_regist' => AuthAppearance::defaults('regist'),
                'product_list' => [
                    'default'   => [
                        'enabled'     => 0,
                        'title'       => '',
                        'description' => '',
                        'html'        => '',
                    ],
                    'overrides' => new stdClass(),
                ],
                /*
                 * 首页快捷入口（§6：前台可见内容必须后台可控）。
                 * 按条编辑 + 拖拽排序（后台 MemberContent 复用 useFlatDrag）；
                 * icon 是前台图标映射表里的预设键（见 clientarea-cra1 home.jsx QUICK_ICONS），
                 * 不是任意 class，避免把不可控的字符串下发到前台。
                 */
                'home_quick_links' => [
                    'enabled' => 1,
                    'items'   => [
                        ['id' => 'ql-finance', 'label' => '财务中心', 'url' => 'finance.htm', 'icon' => 'wallet', 'enabled' => 1],
                        ['id' => 'ql-product', 'label' => '我的产品', 'url' => 'productList.htm', 'icon' => 'package', 'enabled' => 1],
                        ['id' => 'ql-withdraw', 'label' => '申请提现', 'url' => 'withdrawal.htm', 'icon' => 'arrow-up-right', 'enabled' => 1],
                        ['id' => 'ql-ticket', 'label' => '工单中心', 'url' => 'home.htm', 'icon' => 'life-buoy', 'enabled' => 1],
                        ['id' => 'ql-subuser', 'label' => '子账户管理', 'url' => 'home.htm', 'icon' => 'users', 'enabled' => 1],
                        ['id' => 'ql-security', 'label' => '安全中心', 'url' => 'security.htm', 'icon' => 'shield', 'enabled' => 1],
                        ['id' => 'ql-news', 'label' => '新闻公告', 'url' => 'home.htm', 'icon' => 'newspaper', 'enabled' => 1],
                        ['id' => 'ql-cart', 'label' => '购物车', 'url' => 'cart/shoppingCar.htm', 'icon' => 'shopping-cart', 'enabled' => 1],
                    ],
                ],
                /*
                 * 工单提交助手（主题层增强，不改工单插件）：
                 *   - placeholder        详情输入框的占位提示；
                 *   - require_host_types 这些「工单部门 id」提交时必须选择关联产品；
                 *   - categories         问题分类（内置知识库）：选择后自动匹配部门、
                 *                        预填可编辑的描述模板、展示教程链接；
                 *                        部门 id 来自工单插件类型表（接口 ticket.catalog）。
                 * 前台由 theme ticket-assist.js 消费（addTicket 页注入）。
                 */
                'ticket_assist' => [
                    'enabled'            => 0,
                    'placeholder'        => '',
                    'require_host_types' => [],
                    'type_placeholders'  => [],
                    'categories'         => [],
                ],
                /*
                 * 首页「待办事项」卡（大厂工作台式待办，提升续费率）：
                 *   - enabled 前台是否显示；title 卡片标题；
                 *   - days    到期窗口（几天内到期算待办，7-90）；
                 *   - limit   最多显示条数（3-10）。
                 * 数据来自核心 /index/host（含 due_time），前台按窗口过滤。
                 */
                'home_todo' => [
                    'enabled' => 1,
                    'title'   => '待办事项',
                    'days'    => 30,
                    'limit'   => 5,
                ],
                /*
                 * 首页文章时间轴：默认保持原来的新闻插件公告展示。
                 *   - source 新闻、公告或帮助文档；type_id 为对应来源的分类（0=全部）
                 *   - limit   最多显示条数（3-10）
                 */
                'home_news' => [
                    'enabled' => 1,
                    'title'   => '公告',
                    'description' => '产品动态与重要通知',
                    'source'  => 'news',
                    'type_id' => 0,
                    'limit'   => 6,
                ],
                /*
                 * 首页「账户安全概览」（环形仪表盘评分）：
                 * items 控制哪些项参与评分：实名认证 / 绑定手机 / 绑定邮箱 / 账号资料
                 */
                'home_security' => [
                    'enabled' => 1,
                    'items'   => [
                        'certification' => 1,
                        'phone'         => 1,
                        'email'         => 1,
                        'profile'       => 1,
                    ],
                ],
                /*
                 * 首页「推荐位」（阿里云营销位式图文卡，机房促销/维护公告）：
                 * items ≤3，image 可空（空则品牌渐变底 + 标题）。
                 */
                'home_banner' => [
                    'enabled' => 0,
                    'items'   => [],
                ],
                /*
                 * 服务器控制面板「订单记录」标签页（productdetail 云实例面板）。
                 *   - enabled    总开关：关闭时前台不显示该标签、也不发起订单请求；
                 *   - fetch_page 单次接口请求的条数（10-200，越大首屏越慢）；
                 *   - fetch_max  单台服务器最多拉取的订单总数（100-5000，防异常数据拖垮页面）。
                 * 默认值与前台原硬编码一致（开 / 100 / 1000），未配置时行为不变。
                 */
                'host_orders' => [
                    'enabled'    => 1,
                    'fetch_page' => 100,
                    'fetch_max'  => 1000,
                ],
            ],
        ];
    }


    /* ===================================================================== */
    /* 读写                                                                  */
    /* ===================================================================== */

    public function exists(): bool
    {
        return is_file($this->mainFile);
    }

    /** 读取规范配置（缺失时返回默认值，不写盘） */
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

    /**
     * 确保前台快照与主配置一致（自愈）。
     *
     * 快照原本只在保存时写入，因此有两种情况会让前台读到过期结构：
     *   1. 代码升级改变了快照字段（如移除 favorites）；
     *   2. 主配置被手工编辑或从备份恢复。
     * 这里比对 version 与关键字段，不一致就重建，避免前台长期拿到旧数据。
     */
    public function ensureSnapshot(): void
    {
        $lock = $this->acquireLock();
        if ($lock === false || is_string($lock)) throw new RuntimeException('快照存储锁不可用');
        try {
        $config = $this->read();
        $snap = $this->readJson($this->publicFile);
        $expected = $this->snapshotProjection($config);
        if (!is_array($snap) || $this->canonicalJson($snap) !== $this->canonicalJson($expected)) {
            if (!$this->writePublicSnapshot($config)) {
                throw new RuntimeException('前台快照同步失败，请检查存储目录权限');
            }
        }
        } finally { $this->releaseLock($lock); }
    }

    /**
     * 保存规范配置。
     * @param array  $patch    要写入的顶层片段（appearance/sidebar）
     * @param string $operator 后台管理员名（写审计用）
     * @param int    $expectVersion 期望的当前 version（>0 时做乐观锁校验）
     */
    public function save(array $patch, string $operator, int $expectVersion = 0, ?array $scope = null): array
    {
        $lock = $this->acquireLock();
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

            if(isset($patch['sidebar']['nodes']))cra1_icons_validate_nodes($patch['sidebar']['nodes'],$current['sidebar']['nodes']??[]);
            if(isset($patch['content']['home_quick_links']['items']))cra1_icons_validate_nodes($patch['content']['home_quick_links']['items'],$current['content']['home_quick_links']['items']??[],'member-quick');
            // Older content editors do not know these pages. Their whole-content
            // submission must not reset independently saved authentication copy.
            if (isset($patch['content']) && is_array($patch['content'])) {
                foreach (['auth_login','auth_regist'] as $authKey) {
                    if (!array_key_exists($authKey, $patch['content'])) $patch['content'][$authKey] = $current['content'][$authKey];
                }
            }
            // 逐段合并：只覆盖调用方明确提供的片段，未提供的保持原值。
            // sidebar 是嵌套结构，内部再按子段合并——否则只传 recent 时
            // 会把整棵 nodes 树覆盖为空（前端各保存口只提交自己负责的子段）。
            foreach (['appearance', 'sidebar', 'content', 'custom_code'] as $key) {
                if (!array_key_exists($key, $patch)) {
                    continue;
                }
                if ($key === 'sidebar' && is_array($patch[$key]) && is_array($current[$key] ?? null)) {
                    // 前端各保存口只提交自己负责的子段（nodes / recent / shape…），
                    // 未提供的子段沿用当前值；nodes 之前由完整覆盖语义，
                    // 不能在加 recent 后悄悄改成合并，否则删空 nodes 的操作会失效
                    $merged = $current[$key];
                    foreach ($patch[$key] as $sk => $sv) {
                        $merged[$sk] = $sv;
                    }
                    $current[$key] = $merged;
                } else {
                    $current[$key] = $patch[$key];
                }
            }

            $current['version']    = (int) $current['version'] + 1;
            $current['updated_at'] = time();
            $current['updated_by'] = $operator;

            $normalized = $this->normalizeConfig($current);

            if (!$this->atomicWrite($this->mainFile, (string) json_encode(
                $normalized,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
            ))) {
                return ['status' => 400, 'msg' => '保存失败：存储文件不可写'];
            }

            // 同步前台快照（失败不回滚主配置，但要在返回里说明）
            $snapshotOk = $this->writePublicSnapshot($normalized);

            return [
                'status' => 200,
                'msg'    => $snapshotOk ? '已保存' : '已保存，但前台快照写入失败',
                'data'   => [
                    'config'  => $this->read(),
                    'snapshot_ok' => $snapshotOk,
                ],
            ];
        } finally {
            $this->releaseLock($lock);
        }
    }

    /** 重置为默认（保留账号体系不动，仅清会员中心配置） */
    public function reset(string $operator): array
    {
        $current = $this->read();
        $fresh = self::defaults();
        return $this->save(['appearance' => $fresh['appearance'], 'sidebar' => $fresh['sidebar'],
            'content' => $fresh['content']], $operator, (int) $current['version']);
    }

    /** 写入前台运行时快照（只含公开字段） */
    public function writePublicSnapshot(?array $config = null): bool
    {
        $config = $config ?? $this->read();
        $snapshot = $this->snapshotProjection($config);
        return $this->atomicWrite($this->publicFile, (string) json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public function snapshotProjection(array $config): array
    {
        $content=CRA1ThemePublicProjection::content($config['content']);
        // Authentication pages get their own display-only projection at render
        // time; the global member snapshot does not need either page's copy.
        unset($content['auth_login'], $content['auth_regist']);
        foreach($content['home_quick_links']['items']??[] as $index=>$it) {
            $d=cra1_icons_resolve((string)($it['icon']??''),'member-quick','legacy:quick:package');
            if(!empty($d['available'])&&strpos($d['id'],'legacy:quick:')!==0) $content['home_quick_links']['items'][$index]['icon_resolved']=['url'=>$d['url'],'colorable'=>$d['colorable']];
        }
        $projection = [
            'schema_version' => self::SCHEMA_VERSION,
            'version'        => (int) $config['version'],
            'appearance'     => $config['appearance'],
            // 不含 favorites：收藏属前台会员个人偏好（浏览器本地存储），
            // 后台不下发、也不覆盖用户自己的设置。
            'sidebar' => $this->publicTree($config['sidebar']['nodes'] ?? []),
            // 树形态：3 = 一级分组树（前台按 分组→菜单→页面 渲染），
            // 2 = 旧两级（前台按 服务分类 面板渲染）。迁移/结构变化时前台自适应。
            'nav_shape' => ((int) ($config['sidebar']['shape'] ?? 2) >= 3) ? 3 : 2,
            // 最近访问展示策略（访问记录在前端浏览器本地，这里只下发策略）
            'recent' => CRA1ThemePublicProjection::content($config['sidebar']['recent']),
            // 会员中心内容设置（已过白名单/HTML 清理），前台直接渲染
            'content' => $content,
            'custom_code' => CRA1ThemePublicProjection::code($config['custom_code']),
            'projection_version' => 2,
            'updated_at' => (int) $config['updated_at'],
        ];
        return CRA1ThemePublicProjection::member($projection,CRA1ThemePublicProjection::capabilities($this->pdo()));
    }

    private function canonicalJson(array $snapshot): string
    {
        $normalized = json_decode((string) json_encode($snapshot), true);
        return (string) json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * 递归投影侧栏树为前台快照。
     * 只保留渲染必需字段；URL 为相对路径（前台自行拼 /）。
     */
    private function publicTree(array $nodes, int $depth = 1): array
    {
        $out = [];
        foreach ($nodes as $n) {
            if (!is_array($n)) {
                continue;
            }
            if (!empty($n['hidden'])) {
                continue;   // 隐藏项不下发（后台仍保留可恢复）
            }
            $item = [
                'id'      => (string) ($n['id'] ?? ''),
                'name'    => (string) ($n['label'] ?? ''),
                'url'     => (string) ($n['url'] ?? ''),
                'icon'    => (string) ($n['icon'] ?? ''),
                'type'    => (string) ($n['source_type'] ?? 'custom'),
                'second_reminder' => (int) ($n['second_reminder'] ?? 0),
            ];
            if(!empty($n['icon_style']))$item['icon_style']=cra1_icon_style_clean($n['icon_style']);
            if(!preg_match('/^icon-[a-z0-9-]+$/i',$item['icon'])&&$item['icon']!=='') { $d=cra1_icons_resolve($item['icon'],'member-sidebar');if($d['available'])$item['icon_resolved']=['url'=>$d['url'],'colorable'=>$d['colorable']]; }
            // 模块类菜单需要模块标识，前端据此决定是否为产品列表入口
            if (!empty($n['module']) || !empty($n['res_module']) || !empty($n['product_id'])) {
                $item['module']     = $n['module'] ?? [];
                $item['res_module'] = $n['res_module'] ?? [];
                $item['product_id'] = $n['product_id'] ?? [];
            }
            if (is_array($n['language'] ?? null) && !empty($n['language'])) {
                $item['language'] = $n['language'];
            }
            // 模块类菜单需要带上模块信息，前台才能走对应渲染分支
            $item['select_field_set'] = (bool)($n['select_field_set'] ?? !empty($n['select_field']));
            $item['select_field_version'] = (int)($n['select_field_version'] ?? 1) === 2 ? 2 : 1;
            foreach (['module', 'res_module', 'product_id', 'select_field'] as $k) {
                if (!empty($n[$k])) {
                    $item[$k] = $n[$k];
                }
            }
            if (!empty($n['is_cross_module'])) {
                $item['is_cross_module'] = 1;
            }
            if ($depth < self::MAX_DEPTH && !empty($n['children'])) {
                $kids = $this->publicTree($n['children'], $depth + 1);
                if ($kids) {
                    $item['children'] = $kids;
                }
            }
            $out[] = $item;
        }
        return $out;
    }

    /* ===================================================================== */
    /* 规范化与校验                                                          */
    /* ===================================================================== */

    public function normalizedPreview(array $data): array { return $this->normalizeConfig($data); }

    private function normalizeConfig(array $data): array
    {
        $def = self::defaults();

        // 只保留已知的顶层键。
        // 历史版本（以及磁盘上的旧数据）可能残留已废弃的键，例如 favorites
        // —— 收藏已改为前台会员自己的本地偏好，后台不再维护；
        // 不在这里丢弃的话，它会被原样经 api.member.get 回吐给界面，留下误导性字段。
        $data = array_intersect_key($data, $def);
        $code=is_array($data['custom_code']??null)?$data['custom_code']:[];
        $data['custom_code']=['css'=>(string)($code['css']??''),'js'=>(string)($code['js']??''),'css_enabled'=>(bool)($code['css_enabled']??true),'js_enabled'=>(bool)($code['js_enabled']??true)];

        $data['schema_version'] = self::SCHEMA_VERSION;
        $data['version']        = max(1, (int) ($data['version'] ?? 1));
        $data['updated_at']     = (int) ($data['updated_at'] ?? 0);
        $data['updated_by']     = (string) ($data['updated_by'] ?? '');

        // appearance：只允许白名单键，未知键丢弃（避免把官网配置串进来）
        $app = is_array($data['appearance'] ?? null) ? $data['appearance'] : [];
        $appOut = [];
        foreach ($def['appearance'] as $k => $v) {
            if (!array_key_exists($k, $app)) {
                $appOut[$k] = $v;
                continue;
            }
            $appOut[$k] = is_int($v) ? (int) $app[$k] : (string) $app[$k];
        }
        $data['appearance'] = $appOut;

        // sidebar
        $sb = is_array($data['sidebar'] ?? null) ? $data['sidebar'] : [];
        $rawNodes = is_array($sb['nodes'] ?? null) ? $sb['nodes'] : [];
        $data['sidebar'] = [
            'version'     => max(1, (int) ($sb['version'] ?? 1)),
            'imported_at' => (int) ($sb['imported_at'] ?? 0),
            'shape'       => max(2, min(3, (int) ($sb['shape'] ?? 2))),
            'nodes'       => $this->normalizeNodes($rawNodes),
            'recent'      => $this->normalizeRecent(is_array($sb['recent'] ?? null) ? $sb['recent'] : []),
        ];

        // content：会员中心内容设置（页面文案 / 公告）
        $data['content'] = $this->normalizeContent(is_array($data['content'] ?? null) ? $data['content'] : []);

        return $data;
    }

    /**
     * 规范化 content 段。
     * 三个子段各自白名单化；HTML 一律过 sanitizeContentHtml() 后才入库，
     * 保证主配置与公开快照里的都是已清理内容，前台不需要再信任原始 HTML。
     */
    private function normalizeContent(array $c): array
    {
        $def = self::defaults()['content'];
        $data = [];
        foreach (['login','regist'] as $page) $data['auth_'.$page] = AuthAppearance::normalize(is_array($c['auth_'.$page] ?? null) ? $c['auth_'.$page] : [], $page);

        /* ---- product_list ---- */
        $pl = is_array($c['product_list'] ?? null) ? $c['product_list'] : [];
        $plDef = $def['product_list'];

        $normBlock = function (array $b) use ($plDef): array {
            $d = $plDef['default'];
            return [
                'enabled'     => (int) ($b['enabled'] ?? $d['enabled']) ? 1 : 0,
                'title'       => mb_substr(trim((string) ($b['title'] ?? '')), 0, 60),
                'description' => mb_substr(trim((string) ($b['description'] ?? '')), 0, 200),
                'html'        => $this->sanitizeContentHtml((string) ($b['html'] ?? '')),
            ];
        };

        $overrides = [];
        $ov = is_array($pl['overrides'] ?? null) ? $pl['overrides'] : [];
        // 覆盖键必须是侧栏节点 UUID（6-64 位 [A-Za-z0-9_-]，与服务端 uuid()/前端 genId 同形状），
        // 绝不能是会整体重建的 idcsmart_menu.id。
        foreach ($ov as $key => $b) {
            if (!is_array($b)) {
                continue;
            }
            $key = (string) $key;
            if (!preg_match('/^[A-Za-z0-9_-]{6,64}$/', $key)) {
                continue;
            }
            // 只留「真的改了东西」的覆盖项，避免 overrides 无限膨胀
            if ($b['enabled'] ?? 0) {
                $overrides[$key] = $normBlock($b);
            }
        }
        ksort($overrides);

        $data['product_list'] = [
            'default'   => $normBlock(is_array($pl['default'] ?? null) ? $pl['default'] : []),
            'overrides' => $overrides === [] ? new stdClass() : $overrides,
        ];

        /* ---- home_quick_links（首页快捷入口，按条编辑 + 拖拽排序）----
         * 白名单字段：label 纯文本（≤12 字）、url 走 urlOk（非法链接整条丢弃——
         * 入口存在的意义就是跳转，坏链接的条目没有展示价值）、icon 只接受
         * 前台预设映射表的键。未启用条目保留在库里（可恢复），不下发的是
         * enabled 字段由前台判断。 */
        $ql = is_array($c['home_quick_links'] ?? null) ? $c['home_quick_links'] : [];
        $allowedIcons = [
            'wallet', 'package', 'arrow-up-right', 'life-buoy', 'users',
            'shield', 'newspaper', 'shopping-cart', 'file-text', 'server',
            'credit-card', 'lock', 'clock', 'gift', 'headphones',
        ];
        $qlItems = [];
        $qlSeen = [];
        foreach ((array) ($ql['items'] ?? []) as $it) {
            if (!is_array($it) || count($qlItems) >= 12) {
                continue;   // 最多 12 个：2 行 × 6 列，再多宫格失衡
            }
            $label = trim(strip_tags((string) ($it['label'] ?? '')));
            $url = trim((string) ($it['url'] ?? ''));
            if ($label === '' || $url === '' || !$this->urlOk($url)) {
                continue;
            }
            $id = preg_match('/^[A-Za-z0-9_-]{6,64}$/', (string) ($it['id'] ?? ''))
                ? (string) $it['id']
                : $this->uuid();
            if (isset($qlSeen[$id])) {
                $id = $this->uuid();
            }
            $qlSeen[$id] = true;
            $icon = (string) ($it['icon'] ?? '');
            $qlItems[] = [
                'id'      => $id,
                'label'   => mb_substr($label, 0, 12),
                'url'     => $url,
                'icon'    => $icon,
                'enabled' => (int) ($it['enabled'] ?? 1) ? 1 : 0,
            ];
            if(isset($it['icon_style'])) { $style=cra1_icon_style_clean($it['icon_style']);if($style)$qlItems[count($qlItems)-1]['icon_style']=$style; }
        }

        $data['home_quick_links'] = [
            'enabled' => (int) ($ql['enabled'] ?? 1) ? 1 : 0,
            'items'   => $qlItems,
        ];

        /* ---- home_todo（首页「到期续费待办」卡）----
         * enabled/title/days(7-90)/limit(3-10)。数据本身来自核心 /index/host
         * （含 due_time），这里只存展示策略——没有可被注入的用户输入。 */
        $todo = is_array($c['home_todo'] ?? null) ? $c['home_todo'] : [];
        $data['home_todo'] = [
            'enabled' => (int) ($todo['enabled'] ?? 1) ? 1 : 0,
            'title'   => mb_substr(trim(strip_tags((string) ($todo['title'] ?? ''))), 0, 20) ?: '待办事项',
            'days'    => max(7, min(90, (int) ($todo['days'] ?? 30))),
            'limit'   => max(3, min(10, (int) ($todo['limit'] ?? 5))),
        ];

        /* ---- home_news（首页文章时间轴；保留原键及旧数据默认来源）---- */
        $hn = is_array($c['home_news'] ?? null) ? $c['home_news'] : [];
        $newsTypeId = (int) ($hn['type_id'] ?? 0);
        $data['home_news'] = [
            'enabled' => (int) ($hn['enabled'] ?? 1) ? 1 : 0,
            'title'   => mb_substr(trim(strip_tags((string)($hn['title'] ?? '公告'))), 0, 40) ?: '公告',
            'description' => mb_substr(trim(strip_tags((string)($hn['description'] ?? '产品动态与重要通知'))), 0, 120),
            'source'  => in_array($hn['source'] ?? 'news', ['news','announcement','help'], true) ? ($hn['source'] ?? 'news') : 'news',
            'type_id' => max(0, $newsTypeId),
            'limit'   => max(3, min(10, (int) ($hn['limit'] ?? 6))),
        ];

        /* ---- home_security（账户安全概览评分项开关）---- */
        $sec = is_array($c['home_security'] ?? null) ? $c['home_security'] : [];
        $secItems = is_array($sec['items'] ?? null) ? $sec['items'] : [];
        $data['home_security'] = [
            'enabled' => (int) ($sec['enabled'] ?? 1) ? 1 : 0,
            'items'   => [
                'certification' => (int) ($secItems['certification'] ?? 1) ? 1 : 0,
                'phone'         => (int) ($secItems['phone'] ?? 1) ? 1 : 0,
                'email'         => (int) ($secItems['email'] ?? 1) ? 1 : 0,
                'profile'       => (int) ($secItems['profile'] ?? 1) ? 1 : 0,
            ],
        ];

        /* ---- home_banner（首页推荐位，图文卡 ≤3 条）----
         * title 纯文本（≤30）、description 纯文本（≤60）、link 走 urlOk
         * （非法链接整条丢弃）、image 走 urlOk 可空（空则前台渐变底+标题）。 */
        $bn = is_array($c['home_banner'] ?? null) ? $c['home_banner'] : [];
        $bnItems = [];
        foreach ((array) ($bn['items'] ?? []) as $it) {
            if (!is_array($it) || count($bnItems) >= 3) {
                continue;
            }
            $title = trim(strip_tags((string) ($it['title'] ?? '')));
            $link = trim((string) ($it['link'] ?? ''));
            if ($title === '' || !$this->urlOk($link)) {
                continue;
            }
            $image = trim((string) ($it['image'] ?? ''));
            if ($image !== '' && !$this->urlOk($image)) {
                $image = '';
            }
            $id = preg_match('/^[A-Za-z0-9_-]{6,64}$/', (string) ($it['id'] ?? ''))
                ? (string) $it['id']
                : $this->uuid();
            $bnItems[] = [
                'id'          => $id,
                'title'       => mb_substr($title, 0, 30),
                'description' => mb_substr(trim(strip_tags((string) ($it['description'] ?? ''))), 0, 60),
                'link'        => $link,
                'image'       => $image,
                'enabled'     => (int) ($it['enabled'] ?? 1) ? 1 : 0,
            ];
        }

        $data['home_banner'] = [
            'enabled' => (int) ($bn['enabled'] ?? 0) ? 1 : 0,
            'items'   => $bnItems,
        ];

        /* ---- host_orders（服务器面板「订单记录」标签页控制）----
         * fetch_max 不得小于 fetch_page（单次请求量不可能超过总上限），
         * 越界值一律钳制到区间内，避免把异常参数打到系统接口。 */
        $ho = is_array($c['host_orders'] ?? null) ? $c['host_orders'] : [];
        $fetchPage = max(10, min(200, (int) ($ho['fetch_page'] ?? 100)));
        $fetchMax  = max(100, min(5000, (int) ($ho['fetch_max'] ?? 1000)));
        $data['host_orders'] = [
            'enabled'    => (int) ($ho['enabled'] ?? 1) ? 1 : 0,
            'fetch_page' => $fetchPage,
            'fetch_max'  => max($fetchPage, $fetchMax),
        ];

        /* ---- ticket_assist（工单提交助手）----
         * placeholder 纯文本（≤200 字，兜底占位）；type_placeholders 按工单部门
         * 覆盖占位（选中部门后优先应用）；require_host_types 整数数组（部门 id，
         * 提交必须选关联产品——仅校验行为，前台不展示标记）；
         * categories 树形问题分类（深度 ≤3）：用户先选大类再逐层细化，选到叶子
         * 才显示正式提交表单。节点：name≤20 / type_id（工单部门 id，叶子节点
         * 生效）/ template（≤2000 纯文本）/ link+link_label（urlOk）/ enabled。
         * 工单类型 id 由后台从 ticket.catalog 接口选择，这里不校验存在性。 */
        $ta = is_array($c['ticket_assist'] ?? null) ? $c['ticket_assist'] : [];
        $normCat = function (array $cat, int $depth, array &$seen) use (&$normCat): ?array {
            if ($depth > 3) {
                return null;
            }
            $name = trim(strip_tags((string) ($cat['name'] ?? '')));
            if ($name === '') {
                return null;
            }
            $id = preg_match('/^[A-Za-z0-9_-]{6,64}$/', (string) ($cat['id'] ?? ''))
                ? (string) $cat['id']
                : $this->uuid();
            if (isset($seen[$id])) {
                $id = $this->uuid();
            }
            $seen[$id] = true;
            $link = trim((string) ($cat['link'] ?? ''));
            if ($link !== '' && !$this->urlOk($link)) {
                $link = '';
            }
            $children = [];
            foreach ((array) ($cat['children'] ?? []) as $kid) {
                if (!is_array($kid)) {
                    continue;
                }
                $n = $normCat($kid, $depth + 1, $seen);
                if ($n !== null) {
                    $children[] = $n;
                }
            }
            return [
                'id'         => $id,
                'name'       => mb_substr($name, 0, 20),
                'type_id'    => (int) ($cat['type_id'] ?? 0),
                'template'   => mb_substr(trim(strip_tags((string) ($cat['template'] ?? ''))), 0, 2000),
                'link'       => $link,
                'link_label' => mb_substr(trim(strip_tags((string) ($cat['link_label'] ?? ''))), 0, 20),
                'enabled'    => (int) ($cat['enabled'] ?? 1) ? 1 : 0,
                'children'   => $children,
            ];
        };
        $taCats = [];
        $taSeen = [];
        foreach ((array) ($ta['categories'] ?? []) as $cat) {
            if (!is_array($cat) || count($taCats) >= 12) {
                continue;   // 最多 12 个一级分类
            }
            $n = $normCat($cat, 1, $taSeen);
            if ($n !== null) {
                $taCats[] = $n;
            }
        }
        $taTypes = array_values(array_unique(array_filter(array_map('intval', (array) ($ta['require_host_types'] ?? [])))));
        $taPh = [];
        foreach ((array) ($ta['type_placeholders'] ?? []) as $ph) {
            if (!is_array($ph) || count($taPh) >= 20) {
                continue;
            }
            $tid = (int) ($ph['type_id'] ?? 0);
            $txt = mb_substr(trim(strip_tags((string) ($ph['placeholder'] ?? ''))), 0, 200);
            if (!$tid || $txt === '' || isset($taPh[$tid])) {
                continue;
            }
            $taPh[$tid] = ['type_id' => $tid, 'placeholder' => $txt];
        }
        $data['ticket_assist'] = [
            'enabled'            => (int) ($ta['enabled'] ?? 0) ? 1 : 0,
            'placeholder'        => mb_substr(trim(strip_tags((string) ($ta['placeholder'] ?? ''))), 0, 200),
            'require_host_types' => array_slice($taTypes, 0, 20),
            'type_placeholders'  => array_values($taPh),
            'categories'         => $taCats,
        ];

        return $data;
    }

    /**
     * 白名单 HTML 清理（后台保存与公开快照共用同一份实现）。
     *
     * 允许纯展示标签（段落/强调/列表/表格/图片/链接等），
     * 删除脚本与样式节点、事件属性、style/class 及危险协议 URL。
     * 目的：管理员可以贴富文本，但前台永远不会执行脚本或被恶意样式覆盖。
     *
     * @param bool $allowStyle 公告场景传 true：保留行内展示标签上的 style
     *                         （值经 CSS 危险模式拦截），供渐变标签等自定义外观。
     */
    public function sanitizeContentHtml(string $html, bool $allowStyle = false): string
    {
        $html = trim($html);
        if ($html === '') {
            return '';
        }
        // 长度护栏：公告条/顶部文案不需要长文（正文用新闻/公告详情）
        if (mb_strlen($html) > 20000) {
            $html = mb_substr($html, 0, 20000);
        }

        $allowTags = [
            'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sub', 'sup',
            'span', 'div', 'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
            'h1', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        ];

        // style 只放行给行内展示标签（不允许放进 <a>/<img>，避免覆盖链接态样式）
        $styleTags = [
            'span', 'b', 'strong', 'em', 'i', 'u', 's', 'small', 'p', 'div',
            'h1', 'h2', 'h3', 'h4', 'li', 'td', 'th', 'blockquote', 'pre', 'code',
        ];
        // CSS 值拦截：url()/expression/behavior/@import/javascript 等危险模式
        $safeStyle = function (string $css): string {
            // 按声明过滤：含危险模式（url()/expression/behavior/@import/js 伪协议）的
            // 单条声明丢弃，同属性串里的安全声明（如 color:red）保留。
            $keep = [];
            foreach (explode(';', $css) as $decl) {
                $decl = trim($decl);
                if ($decl === '') {
                    continue;
                }
                if (preg_match('~(url\s*\(|expression|behavior|@import|javascript\s*:|vbscript\s*:)~i', $decl)) {
                    continue;
                }
                $keep[] = $decl;
            }
            return implode('; ', $keep);
        };

        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        // 包一层容器并声明编码，避免中文被 loadHTML 误判为 GBK 乱码
        $wrapped = '<?xml encoding="utf-8"?><div id="cra1-sanitize-root">' . $html . '</div>';
        $doc->loadHTML($wrapped, LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_clear_errors();

        $root = $doc->getElementById('cra1-sanitize-root');
        if (!$root) {
            return '';
        }

        $safeUrl = function (string $url): string {
            $url = trim($url);
            if ($url === '') {
                return '';
            }
            // 拒绝危险协议与协议相对地址；保留站内相对/绝对、https、锚点、mailto、tel
            if (preg_match('~^\s*(javascript|vbscript|data|file)\s*:~i', $url)) {
                return '';
            }
            if (strpos($url, '//') === 0) {
                return '';
            }
            if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $url)
                && !preg_match('~^(https|mailto|tel):~i', $url)) {
                return '';
            }
            return $url;
        };

        $clean = function (DOMElement $el) use ($allowTags, $safeUrl, $allowStyle, $styleTags, $safeStyle): ?DOMElement {
            $tag = strtolower($el->tagName);
            if (!in_array($tag, $allowTags, true)) {
                return null;    // 不在白名单：整体移除（含内容，防止 <script>/<style> 夹带）
            }
            // 逐个删除属性，只按标签保留白名单
            $keep = [];
            if ($allowStyle && in_array($tag, $styleTags, true)) {
                $css = $safeStyle((string) $el->getAttribute('style'));
                if ($css !== '') {
                    $keep['style'] = $css;
                }
            }
            if ($tag === 'a') {
                $href = $safeUrl((string) $el->getAttribute('href'));
                if ($href === '') {
                    return null;    // 没有合法 href 的 <a> 直接移除
                }
                $keep['href'] = $href;
                if ($el->getAttribute('target') === '_blank') {
                    $keep['target'] = '_blank';
                }
                $keep['rel'] = 'noopener noreferrer';
            } elseif ($tag === 'img') {
                $src = $safeUrl((string) $el->getAttribute('src'));
                if ($src === '') {
                    return null;
                }
                $keep['src'] = $src;
                if (($alt = trim((string) $el->getAttribute('alt'))) !== '') {
                    $keep['alt'] = $alt;
                }
                foreach (['width', 'height'] as $dim) {
                    $v = $el->getAttribute($dim);
                    if ($v !== '' && preg_match('/^\d{1,4}(?:px)?$/', $v)) {
                        $keep[$dim] = (int) $v;
                    }
                }
            }
            foreach (iterator_to_array($el->attributes) as $attr) {
                $el->removeAttribute($attr->nodeName);
            }
            foreach ($keep as $k => $v) {
                $el->setAttribute($k, (string) $v);
            }
            return $el;
        };

        $walkRemove = function (DOMNode $node) use (&$walkRemove, $clean): void {
            $children = [];
            foreach ($node->childNodes as $c) {
                $children[] = $c;
            }
            foreach ($children as $c) {
                if ($c instanceof DOMElement) {
                    $kept = $clean($c);
                    if ($kept === null) {
                        $node->removeChild($c);
                        continue;
                    }
                    // <a>/<img> 不再递归（不允许嵌套链接/图），其余继续深挖子节点
                    if (strtolower($kept->tagName) !== 'a' && strtolower($kept->tagName) !== 'img') {
                        $walkRemove($kept);
                    }
                    continue;
                }
                if ($c instanceof DOMComment || $c instanceof DOMProcessingInstruction) {
                    $node->removeChild($c);
                    continue;
                }
                if ($c instanceof DOMText) {
                    continue;
                }
                if ($c->hasChildNodes()) {
                    $walkRemove($c);
                }
            }
        };
        $walkRemove($root);

        $out = '';
        foreach (iterator_to_array($root->childNodes) as $c) {
            $out .= $doc->saveHTML($c);
        }
        return trim($out);
    }

    /**
     * 公告专用清理：与 sanitizeContentHtml 同一套白名单，但额外保留内联 style。
     * 需求：公告标签支持 HTML（例如鎏金黑色渐变标签），没有 style 就写不出渐变。
     * style 值本身不含可执行语法（现代浏览器不会执行样式里的脚本），
     * 事件属性、脚本节点与危险协议 URL 的拦截与基础版完全一致。
     */


    /**
     * 规范化树：递归补齐字段、重排 order、丢弃非法项。
     * 这里只做「结构规范化」，来源合法性（nav/模块是否存在）在 validate 里单独判断。
     */
    private function normalizeNodes(array $nodes, int $depth = 1): array
    {
        $out = [];
        $order = 0;
        foreach ($nodes as $n) {
            if (!is_array($n)) {
                continue;
            }
            $label = trim((string) ($n['label'] ?? $n['name'] ?? ''));
            if ($label === '') {
                continue;
            }
            $type = (string) ($n['source_type'] ?? 'custom');
            if (!in_array($type, self::TYPES, true)) {
                $type = 'custom';
            }
            $id = (string) ($n['id'] ?? '');
            if ($id === '' || !preg_match('/^[A-Za-z0-9_-]{6,64}$/', $id)) {
                $id = self::uuid();
            }
            $item = [
                'id'              => $id,
                'label'           => $label,
                'language'        => is_array($n['language'] ?? null) ? $n['language'] : new stdClass(),
                'source_type'     => $type,
                'source_nav_id'   => (int) ($n['source_nav_id'] ?? 0),
                'url'             => trim((string) ($n['url'] ?? '')),
                'icon'            => trim((string) ($n['icon'] ?? '')),
                'second_reminder' => (int) ($n['second_reminder'] ?? 0) ? 1 : 0,
                'module'          => self::strList($n['module'] ?? []),
                'res_module'      => self::strList($n['res_module'] ?? []),
                'product_id'      => array_values(array_filter(array_map('intval', (array) ($n['product_id'] ?? [])))),
                'show_quick_order' => (int) ($n['show_quick_order'] ?? 0) ? 1 : 0,
                'quick_order_url' => trim((string) ($n['quick_order_url'] ?? '')),
                'is_cross_module' => (int) ($n['is_cross_module'] ?? 0) ? 1 : 0,
                'select_field'    => self::strList($n['select_field'] ?? []),
                'select_field_set'=> (bool)($n['select_field_set'] ?? !empty($n['select_field'])),
                'select_field_version'=> (int)($n['select_field_version'] ?? 1) === 2 ? 2 : 1,
                'hidden'          => (int) ($n['hidden'] ?? 0) ? 1 : 0,
                'order'           => $order,
            ];
            if(isset($n['icon_style'])) { $style=cra1_icon_style_clean($n['icon_style']);if($style)$item['icon_style']=$style; }
            $order++;
            $kids = is_array($n['children'] ?? null) ? $n['children'] : [];
            // 超出 MAX_DEPTH 的子级不在这里静默截断：由 validateTree 明确报错，
            // 避免「保存成功但数据被悄悄丢弃」。这里只保证不写入非法深度。
            $item['children'] = ($depth < self::MAX_DEPTH) ? $this->normalizeNodes($kids, $depth + 1) : [];
            $out[] = $item;
        }
        return $out;
    }

    /**
     * 规范化 sidebar.recent（最近访问设置）。
     * 只允许白名单键；天数/条数钳制到合法区间，标题做纯文本截断，
     * 保证非法值（负数、超长、HTML）进不了主配置与公开快照。
     */
    private function normalizeRecent($r): array
    {
        $def = self::defaults()['sidebar']['recent'];
        if (!is_array($r)) {
            $r = [];
        }
        $title = trim(strip_tags((string) ($r['title'] ?? '')));
        $days  = (int) ($r['days'] ?? 0);
        $max   = (int) ($r['max_items'] ?? 0);
        // 键缺失（旧配置）时回落到默认值而不是强制关闭——
        // 新增功能应对所有存量站点默认可用；管理员显式关掉才生效
        $pick = function (string $k, $v = null) use ($r, $def) {
            return array_key_exists($k, $r)
                ? (!empty($r[$k]) ? 1 : 0)
                : (int) $def[$k];
        };
        return [
            'enabled'   => $pick('enabled'),
            'title'     => array_key_exists('title', $r)
                            ? ($title !== '' ? $title : $def['title'])
                            : $def['title'],
            'days'      => max(1, min(90, $days > 0 ? $days : $def['days'])),
            'max_items' => max(1, min(20, $max > 0 ? $max : $def['max_items'])),
            'new_tab'   => $pick('new_tab'),
            'open_first' => $pick('open_first'),
        ];
    }

    private static function strList($v): array
    {
        if (is_string($v)) {
            $v = trim($v);
            if ($v === '') {
                $v = [];
            } else {
                // 系统里 module/res_module/select_field 有两种存法：
                //   逗号分隔字符串（module）与 JSON 数组文本（res_module='[]'、'["mf_cloud"]'）。
                // 不先解 JSON 会把 '[]' 当成一个普通字符串，产出 ["[]"] 这种脏数据。
                $json = json_decode($v, true);
                $v = is_array($json) ? $json : explode(',', $v);
            }
        }
        if (!is_array($v)) {
            return [];
        }
        return array_values(array_filter(array_map(function ($x) {
            return trim((string) $x);
        }, $v), function ($x) {
            return $x !== '';
        }));
    }

    /**
     * 深度校验：环、重复 ID、缺失来源、URL 合法性。
     * @param bool $topGroupsOk true = 一级节点允许无 URL（分组树形态下一级是纯容器，
     *                          新建空分组也应能保存）；false = 旧两级契约（根节点即菜单，必须有链接）
     * @return string[] 错误列表（空 = 通过）
     */
    public function validateTree(array $nodes, bool $topGroupsOk = false): array
    {
        $errors = [];
        $seen   = [];
        $walk = function (array $list, int $depth, ?string $parentId) use (&$walk, &$errors, &$seen, $topGroupsOk) {
            if ($depth > self::MAX_DEPTH) {
                $errors[] = "超过最大层级 " . self::MAX_DEPTH;
                return;
            }
            foreach ($list as $n) {
                if (!is_array($n)) {
                    continue;
                }
                $id = (string) ($n['id'] ?? '');
                if ($id === '') {
                    $errors[] = '存在缺少 id 的菜单项';
                    continue;
                }
                if (isset($seen[$id])) {
                    $errors[] = "菜单 id 重复：{$id}";
                    continue;
                }
                $seen[$id] = true;

                $label = trim((string) ($n['label'] ?? ''));
                if ($label === '') {
                    $errors[] = "菜单项 {$id} 缺少名称";
                }

                $type = (string) ($n['source_type'] ?? 'custom');
                if (!in_array($type, self::TYPES, true)) {
                    $errors[] = "菜单项 {$label} 的类型非法：{$type}";
                }
                if ($type === 'separator') {
                    if ($depth !== 1 || !empty($n['children']) || trim((string) ($n['url'] ?? '')) !== '') {
                        $errors[] = '分界线只能放在一级菜单之间，不能设置链接或子菜单';
                    }
                }
                // system/plugin 必须有来源 nav，否则前台无法解析真实地址
                if (in_array($type, ['system', 'plugin'], true) && (int) ($n['source_nav_id'] ?? 0) <= 0) {
                    $errors[] = "菜单项 {$label} 缺少来源导航（nav_id）";
                }
                // URL 要求分四种情况（与系统菜单实际用法对齐）：
                //   1. 有子级的父节点：URL 可为空（系统里「测试」「其他」就是纯容器，
                //      链接在子级上），不能强制要求；
                //   2. 一级分组（shape=3 的根节点）：纯容器，URL 可为空 ——
                //      新建一个还没有子级的一级分组也应能保存；
                //   3. 「分隔符」：menu_type=custom 且无 URL，表示分组分隔线，合法；
                //   4. 其余 custom/embedded 叶子节点：必须有可跳转地址。
                $kids0 = is_array($n['children'] ?? null) ? $n['children'] : [];
                $isContainer = count($kids0) > 0;
                $isSeparator = ($label === '分隔符');
                $isTopGroup = ($depth === 1 && $topGroupsOk);
                if (!$isContainer && !$isSeparator && !$isTopGroup
                    && in_array($type, ['custom', 'embedded'], true)
                    && trim((string) ($n['url'] ?? '')) === '') {
                    $errors[] = "菜单项 {$label} 缺少链接地址";
                }
                if (!empty($n['url']) && !$this->urlOk((string) $n['url'])) {
                    $errors[] = "菜单项 {$label} 的链接格式不受支持：" . $n['url'];
                }
                $kids = is_array($n['children'] ?? null) ? $n['children'] : [];
                if ($kids) {
                    $walk($kids, $depth + 1, $id);
                }
            }
        };
        $walk($nodes, 1, null);
        return $errors;
    }

    /**
     * 链接校验。
     * 允许：站内相对路径（security.htm / cart/goodsList.htm / plugin/28/x.htm）、
     *       站内绝对路径（/account.htm）、锚点（#）、https、tel:、mailto:。
     * 拒绝：协议相对（//evil.com）与其它协议。
     *
     * 注意不能用「必须以 / 开头」判断：系统内置导航存的都是相对路径，
     * 那样会把自带导航全部判为非法，导致无法导入。
     */
    public function urlOk(string $url): bool
    {
        $url = trim($url);
        if ($url === '') {
            return true;
        }
        if (strpos($url, '//') === 0) {
            return false;   // 协议相对，存在被外站利用的风险
        }
        // 相对路径：不含协议、不以 // 开头、允许字母数字/._-/?=&%# 与中文
        if (!preg_match('~^[a-z][a-z0-9+.-]*:~i', $url)) {
            return true;
        }
        return (bool) preg_match('~^(#|/|https://|tel:|mailto:)~i', $url);
    }

    public static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /* ===================================================================== */
    /* 系统导航只读导入源                                                    */
    /* ===================================================================== */

    /**
     * 读取系统导航目录（只读）。
     * 刻意不用 MenuModel：它会触发 createHomeMenu() 写入默认菜单。
     */
    public function readSystemCatalog(): array
    {
        $pdo = $this->pdo();
        if (!$pdo) {
            return ['menu' => [], 'navs' => [], 'plugins' => [], 'error' => '数据库连接不可用'];
        }

        try {
            // 可编辑菜单行（含模块/自定义等主题侧才有的类型）
            $menus = \CRA1\Theme\Compatibility\Database::query($pdo,
                "SELECT m.id, m.menu_type AS type, m.name, m.language, m.url, m.second_reminder, m.icon,
                        m.nav_id, m.parent_id, m.module, m.product_id, m.res_module,
                        m.show_quick_order, m.quick_order_url, m.is_cross_module, m.select_field, m.`order`,
                        n.url AS nav_url, n.plugin AS nav_plugin, n.module AS nav_module
                 FROM idcsmart_menu m
                 LEFT JOIN idcsmart_nav n ON n.id = m.nav_id
                 WHERE m.type = 'home'
                 ORDER BY m.`order` ASC, m.id ASC"
            )->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            return ['menu' => [], 'navs' => [], 'plugins' => [], 'error' => '读取系统菜单失败'];
        }

        // 规范化成前端易用的形状
        $rows = [];
        foreach ($menus as $m) {
            $rows[] = [
                'menu_id'         => (int) $m['id'],
                'source_type'     => (string) $m['type'],
                'label'           => (string) $m['name'],
                'language'        => json_decode((string) $m['language'], true) ?: new stdClass(),
                // 有 canonical nav 时用 nav.url；否则回落到菜单自身的 url（自定义项靠它）
                'url'             => (string) (($m['nav_url'] ?? null) !== null && $m['nav_url'] !== ''
                                                ? $m['nav_url'] : ($m['url'] ?? '')),
                'second_reminder' => (int) $m['second_reminder'] ? 1 : 0,
                'icon'            => (string) $m['icon'],
                'source_nav_id'   => (int) $m['nav_id'],
                'parent_menu_id'  => (int) $m['parent_id'],
                'module'          => self::strList($m['module']),
                'res_module'      => self::strList($m['res_module']),
                'product_id'      => array_values(array_filter(array_map('intval',
                    json_decode((string) $m['product_id'], true) ?: []))),
                'show_quick_order' => (int) $m['show_quick_order'] ? 1 : 0,
                'quick_order_url' => (string) $m['quick_order_url'],
                'is_cross_module' => (int) $m['is_cross_module'] ? 1 : 0,
                'select_field'    => self::strList($m['select_field']),
                'order'           => (int) $m['order'],
                'nav_plugin'      => (string) ($m['nav_plugin'] ?? ''),
            ];
        }

        // 可用导航目录（供「新增菜单」选择）
        $navs = [];
        try {
            $navRows = \CRA1\Theme\Compatibility\Database::query($pdo,
                "SELECT id, type, name, url, icon, parent_id, `order`, module, plugin
                 FROM idcsmart_nav WHERE type = 'home' ORDER BY `order` ASC, id ASC"
            )->fetchAll(PDO::FETCH_ASSOC);
            foreach ($navRows as $n) {
                $navs[] = [
                    'id'      => (int) $n['id'],
                    'name'    => (string) $n['name'],
                    'url'     => (string) $n['url'],
                    'icon'    => (string) $n['icon'],
                    'module'  => (string) $n['module'],
                    'plugin'  => (string) $n['plugin'],
                    'is_plugin' => trim((string) $n['plugin']) !== '',
                ];
            }
        } catch (Throwable $e) {
            $navs = [];
        }

        // 已启用的插件（用于标记 plugin 类导航是否可用）
        $plugins = [];
        try {
            $pRows = \CRA1\Theme\Compatibility\Database::query($pdo,"SELECT name, title, status FROM idcsmart_plugin WHERE status = 1")
                ->fetchAll(PDO::FETCH_ASSOC);
            foreach ($pRows as $p) {
                $plugins[(string) $p['name']] = ['title' => (string) $p['title'], 'enabled' => true];
            }
        } catch (Throwable $e) {
            $plugins = [];
        }

        return array_merge(['menu' => $rows, 'navs' => $navs, 'plugins' => $plugins, 'error' => ''], $this->visualCatalog());
    }

    public function visualCatalog(): array
    {
        $out=['modules'=>[],'res_modules'=>[],'products'=>[],'groups'=>[]];
        $root=dirname($this->dir,2);
        foreach(['server'=>'modules','reserver'=>'res_modules']as$folder=>$kind){
            foreach(glob($root.'/public/plugins/'.$folder.'/*',GLOB_ONLYDIR)?:[]as$dir){
                $name=basename($dir);$class=str_replace(' ','',ucwords(str_replace('_',' ',$name)));$file=$dir.'/'.$class.'.php';
                if(!is_file($file))continue;$text=file_get_contents($file);$title=$name;
                if(preg_match('/[\'"]display_name[\'"]\s*=>\s*[\'"]([^\'"]+)[\'"]/u',$text,$m))$title=$m[1];
                $out[$kind][]=['name'=>$name,'label'=>$title];
            }
        }
        $pdo=$this->pdo();if(!$pdo){$out['error']='商品目录暂时不可用';return $out;}
        try{
            $out['groups']=\CRA1\Theme\Compatibility\Database::query($pdo,'SELECT id,name FROM idcsmart_product_group WHERE parent_id=0 ORDER BY `order`,id')->fetchAll(PDO::FETCH_ASSOC);
            $sql="SELECT DISTINCT p.id,p.name,p.price,p.cycle,pg.name sub,pg.id group_id,pgf.name `group`,
                COALESCE(NULLIF(s.module,''),NULLIF(ss.module,''),'') module,COALESCE(up.res_module,'') res_module
                FROM idcsmart_product p LEFT JOIN idcsmart_product_group pg ON pg.id=p.product_group_id
                LEFT JOIN idcsmart_product_group pgf ON pgf.id=pg.parent_id
                LEFT JOIN idcsmart_server s ON p.type='server' AND s.id=p.rel_id
                LEFT JOIN idcsmart_server_group sg ON p.type='server_group' AND sg.id=p.rel_id
                LEFT JOIN idcsmart_server ss ON ss.server_group_id=sg.id
                LEFT JOIN idcsmart_upstream_product up ON up.product_id=p.id
                WHERE p.product_id=0 ORDER BY p.id";
            foreach(\CRA1\Theme\Compatibility\Database::query($pdo,$sql)->fetchAll(PDO::FETCH_ASSOC)as$p){$p['id']=(int)$p['id'];$p['url']=cra1_cart_product_url($p['id']);$out['products'][]=$p;}
        }catch(Throwable$e){$out['error']='商品目录读取失败';}
        return $out;
    }

    /**
     * 把系统菜单投影为独立副本节点树（首次导入 / 重新读取）。
     * parent_menu_id 映射为 UUID 父子关系，保持层级顺序。
     */
    public function importFromSystem(array $catalog): array
    {
        $rows = $catalog['menu'] ?? [];
        $byMenuId = [];
        $out = [];

        // 先建节点（parent 稍后挂）
        foreach ($rows as $r) {
            $id = self::uuid();
            $byMenuId[(int) $r['menu_id']] = $id;

            // module / res_module 菜单在系统里没有静态 url：
            // 运行时由 MenuModel 用「当时的菜单 id」拼出 product.htm?m=<id>。
            // 那个 id 会在后台保存导航时整体重建而失效，所以不能写进独立副本。
            // 这里记录模块信息，并给出不带参数的 productList.htm 作为安全回退，
            // 保证菜单始终可点、不会指向已失效的 id。
            $type = (string) $r['source_type'];
            $url  = (string) $r['url'];
            if ($url === '' && in_array($type, ['module', 'res_module'], true)) {
                $url = 'productList.htm';
            }

            $out[(int) $r['menu_id']] = [
                'id'              => $id,
                'label'           => (string) $r['label'],
                'language'        => is_array($r['language']) ? $r['language'] : new stdClass(),
                'source_type'     => $type,
                'source_nav_id'   => (int) $r['source_nav_id'],
                'url'             => $url,
                'icon'            => (string) $r['icon'],
                'second_reminder' => (int) $r['second_reminder'],
                'module'          => $r['module'],
                'res_module'      => $r['res_module'],
                'product_id'      => $r['product_id'],
                'show_quick_order' => (int) $r['show_quick_order'],
                'quick_order_url' => (string) $r['quick_order_url'],
                'is_cross_module' => (int) $r['is_cross_module'],
                'select_field'    => $r['select_field'],
                'hidden'          => 0,
                'order'           => (int) $r['order'],
                'children'        => [],
                // 记录来源，便于差异比对
                '_source_menu_id' => (int) $r['menu_id'],
            ];
        }

        // 再挂父子（只支持两层，与系统编辑器一致）。
        //
        // 注意：必须按【父级在前、子级在后】的顺序构建，
        // 且不能边遍历边改 $out —— PHP 的 foreach 遍历的是数组副本，
        // 对 $out[$pid] 的修改不会反映到正在遍历的 $node 上，
        // 会导致子级被静默丢弃（实测「其他 → DCIM(自定义配置)」整项消失）。
        // 这里改为先建 parent 索引，再收集 roots/children 两份引用后统一组装。
        $parentOf = [];
        foreach ($rows as $r) {
            $parentOf[(int) $r['menu_id']] = (int) $r['parent_menu_id'];
        }

        $roots = [];
        $pendingChildren = [];   // parentMenuId => [childNode, ...]
        foreach ($out as $menuId => $node) {
            unset($node['_source_menu_id']);
            $pid = $parentOf[$menuId] ?? 0;
            if ($pid > 0 && isset($byMenuId[$pid])) {
                $pendingChildren[$pid][] = $node;
            } else {
                $roots[] = $node;
            }
        }
        // 把子级挂回对应父级
        foreach ($roots as &$root) {
            $srcId = null;
            foreach ($rows as $r) {
                if ($byMenuId[(int) $r['menu_id']] === $root['id']) {
                    $srcId = (int) $r['menu_id'];
                    break;
                }
            }
            if ($srcId !== null && !empty($pendingChildren[$srcId])) {
                $root['children'] = $pendingChildren[$srcId];
            }
        }
        unset($root);

        return $roots;
    }

    /**
     * 读取「内容设置」可用的新闻/公告分类目录（只读）。
     *
     * 新闻与公告是两个独立插件（idcsmart_news / idcsmart_announcement），
     * 各自有 type 表。插件未启用或表不存在时返回空目录 + enabled=false，
     * 由管理台展示「插件未安装」状态，前台则隐藏对应区块。
     *
     * 刻意只读、独立 PDO，与 readSystemCatalog 同一套约束：
     * 不引导 ThinkPHP、不触发任何写副作用、不改系统插件数据。
     */
    /**
     * 工单部门（插件工单类型）目录：只读，供「工单提交助手」配置选择。
     * 表由工单插件管理（idcsmart_addon_idcsmart_ticket_type）；表不存在或
     * 插件未启用时返回空列表（配置仍可保存，恢复后自动可用）。
     */
    public function readTicketTypeCatalog(): array
    {
        $out = ['types' => [], 'error' => ''];
        $pdo = $this->pdo();
        if (!$pdo) {
            $out['error'] = '数据库不可用';
            return $out;
        }
        try {
            $rows = \CRA1\Theme\Compatibility\Database::query($pdo,
                'SELECT id, name FROM idcsmart_addon_idcsmart_ticket_type ORDER BY id ASC'
            )->fetchAll(PDO::FETCH_ASSOC);
            foreach ((array) $rows as $r) {
                $out['types'][] = [
                    'id'   => (int) $r['id'],
                    'name' => (string) $r['name'],
                ];
            }
        } catch (Throwable $e) {
            // 表不存在 = 工单插件未安装/未启用：不视为错误，目录为空即可
            $out['types'] = [];
        }
        return $out;
    }

    public function readContentCatalog(): array
    {
        $out = [
            'news'         => ['enabled' => false, 'types' => []],
            'announcement' => ['enabled' => false, 'types' => []],
            'help'         => ['enabled' => false, 'types' => []],
            'error'        => '',
        ];

        $plugins = [];
        $pdo = $this->pdo();
        if (!$pdo) {
            $out['error'] = '数据库连接不可用';
            return $out;
        }

        try {
            foreach (\CRA1\Theme\Compatibility\Database::query($pdo,"SELECT name, status FROM idcsmart_plugin")->fetchAll(PDO::FETCH_ASSOC) as $p) {
                // 插件名在库里是驼峰（IdcsmartNews / IdcsmartAnnouncement），
                // 归一成小写去下划线后匹配，避免大小写/命名风格差异导致误判「未安装」
                $norm = strtolower(str_replace('_', '', (string) $p['name']));
                $plugins[$norm] = (int) $p['status'] === 1;
            }
        } catch (Throwable $e) {
            // 插件表不可用时按未安装处理
        }

        $readTypes = function (string $table) use ($pdo): array {
            try {
                $rows = \CRA1\Theme\Compatibility\Database::query($pdo,"SELECT id, name FROM `{$table}` ORDER BY id ASC")
                    ->fetchAll(PDO::FETCH_ASSOC);
            } catch (Throwable $e) {
                return [];      // 表不存在 = 插件未安装
            }
            $out = [];
            foreach ($rows as $r) {
                $name = trim((string) $r['name']);
                if ($name === '') {
                    continue;
                }
                $out[] = ['id' => (int) $r['id'], 'name' => $name];
            }
            return $out;
        };

        $out['news']['enabled'] = ($plugins['idcsmartnews'] ?? false) === true;
        // ThinkPHP 模型名 addon_idcsmart_news_type + 全局前缀 idcsmart_
        $out['news']['types'] = $readTypes('idcsmart_addon_idcsmart_news_type');
        if ($out['news']['enabled'] && $out['news']['types'] === []) {
            // 插件启用但还没建分类：仍允许用「最新内容」作为来源（category_id=0）
            $out['news']['types'] = [];
        }

        $out['announcement']['enabled'] = ($plugins['idcsmartannouncement'] ?? false) === true;
        $out['announcement']['types'] = $readTypes('idcsmart_addon_idcsmart_announcement_type');
        $out['help']['enabled'] = ($plugins['idcsmarthelp'] ?? false) === true;
        $out['help']['types'] = $readTypes('idcsmart_addon_idcsmart_help_type');

        return $out;
    }

    /* ===================================================================== */
    /* 分组树迁移（一级分组 → 菜单 → 页面）                                    */
    /* ===================================================================== */

    /**
     * 静态三级页面种子表：与前台旧 SECONDARY_PAGES 完全一致。
     * 迁移时把这些「由主题代码写死的三级页」变成真实可编辑的节点，
     * 管理员此后可在后台增删改、拖拽排序，前台不再依赖写死表。
     */
    public const PAGE_SEEDS = [
        'cart/goodsList.htm' => [
            ['商品列表', 'cart/goodsList.htm'], ['购物车', 'cart/shoppingCar.htm'],
        ],
        'productList.htm' => [
            ['全部产品', 'productList.htm'], ['使用中', 'productList.htm?tab=using'],
            ['即将到期', 'productList.htm?tab=expiring'], ['已逾期', 'productList.htm?tab=overdue'],
            ['已删除', 'productList.htm?tab=deleted'],
        ],
        'account.htm' => [
            ['基本资料', 'account.htm?tab=profile'], ['安全设置', 'account.htm?tab=security'],
            ['余额记录', 'account.htm?tab=credit'],
        ],
        'finance.htm' => [
            ['我的订单', 'finance.htm?tab=orders'], ['余额记录', 'finance.htm?tab=credit'],
            ['冻结记录', 'finance.htm?tab=freeze'], ['申请提现', 'withdrawal.htm'],
        ],
        'security.htm' => [
            ['安全概览', 'security.htm?tab=overview'], ['API 密钥', 'security.htm?tab=api'],
            ['SSH 密钥', 'security.htm?tab=ssh'], ['操作日志', 'security.htm?tab=log'],
            ['安全组', 'security.htm?tab=group'],
        ],
        'plugin/21/source.htm' => [
            ['新闻中心', 'plugin/21/source.htm'], ['帮助中心', 'plugin/26/source.htm'],
            ['文件下载', 'plugin/19/source.htm'],
        ],
        'plugin/27/ticket.htm' => [
            ['工单列表', 'plugin/27/ticket.htm'], ['新建工单', 'plugin/27/addTicket.htm'],
        ],
        'plugin/28/childAccount.htm' => [
            ['子账户列表', 'plugin/28/childAccount.htm'], ['添加子账户', 'plugin/28/addChildAccount.htm'],
        ],
        'plugin/19/file_download.htm' => [
            ['文件下载', 'plugin/19/source.htm'],
        ],
    ];

    /** 造一个页面级节点（第三级） */
    private static function pageNode(string $name, string $url, int $order): array
    {
        return [
            'id' => self::uuid(), 'label' => $name, 'language' => new stdClass(),
            'source_type' => 'custom', 'source_nav_id' => 0, 'url' => $url, 'icon' => '',
            'second_reminder' => 0, 'module' => [], 'res_module' => [], 'product_id' => [],
            'show_quick_order' => 0, 'quick_order_url' => '', 'is_cross_module' => 0,
            'select_field' => [], 'hidden' => 0, 'order' => $order, 'children' => [],
        ];
    }

    /** 造一个分组/菜单节点 */
    private static function groupNode(string $name, string $icon, array $children, string $url = ''): array
    {
        return [
            'id' => self::uuid(), 'label' => $name, 'language' => new stdClass(),
            'source_type' => 'custom', 'source_nav_id' => 0, 'url' => $url, 'icon' => $icon,
            'second_reminder' => 0, 'module' => [], 'res_module' => [], 'product_id' => [],
            'show_quick_order' => 0, 'quick_order_url' => '', 'is_cross_module' => 0,
            'select_field' => [], 'hidden' => 0, 'order' => 0, 'children' => $children,
        ];
    }

    /**
     * 把旧两级结构迁移为分组树（一次性，幂等）：
     *
     *   旧：根节点 = 菜单（订购产品 / 其他 / 魔方云…），子级 = 菜单
     *   新：L1 = 一级分组（我的资源 / 产品与服务）
     *       L2 = 菜单（我的产品 / 魔方云…）
     *       L3 = 页面（使用中 / 已删除 / 安全概览…，原为前台写死的 SECONDARY_PAGES）
     *
     * 播种规则（L3 静态页）：
     *   - 节点 url 命中 PAGE_SEEDS 即播种；
     *   - module/res_module 的容器不播（其 productList.htm 是导入兜底地址，
     *     播了会和「魔方云」组的页面重复）；
     *   - 有子级的容器播种自身页面后，子级保持为 L3（如 安全中心 = 5 个标签 + 资源中心 + 工单中心）。
     */
    public function migrateToGroupTree(): array
    {
        $config = $this->read();
        if ((int) ($config['sidebar']['shape'] ?? 2) >= 3) {
            return $config;   // 已迁移
        }

        $seeds = self::PAGE_SEEDS;
        $seedPages = function (array $node) use ($seeds): array {
            $pages = [];
            $url = (string) $node['url'];
            $type = (string) ($node['source_type'] ?? 'custom');
            $isFallback = in_array($type, ['module', 'res_module'], true);
            // module 容器不播；叶子 module（魔方云）要播（用户示例：魔方云 → 使用中/已删除）
            if (isset($seeds[$url]) && !($isFallback && !empty($node['children']))) {
                foreach ($seeds[$url] as $i => [$name, $u]) {
                    $pages[] = self::pageNode($name, $u, $i);
                }
            }
            return $pages;
        };

        // 「我的产品」：原来由前台硬编码生成，迁移后成为真实可编辑节点
        $myProduct = self::groupNode('我的产品', 'icon-a-7', []);
        foreach ($seeds['productList.htm'] as $i => [$name, $u]) {
            $myProduct['children'][] = self::pageNode($name, $u, $i);
        }

        // 归类旧根节点：自身有真实页面（命中 PAGE_SEEDS）的保留为二级菜单，
        // 其旧子级降为三级页面；自身无页面的纯分组容器（如「测试」「其他」，
        // 旧两级菜单系统里只当分组用）—— 其子级【提升为二级】、容器本身移除，
        // 否则它们的子级会被压到三级、三级页面放不进三级以内。
        $resourceKids = [$myProduct];
        $serviceKids = [];

        $promote = function (array $child) use ($seedPages): array {
            $own = $seedPages($child);
            $child['children'] = is_array($child['children'] ?? null) ? $child['children'] : [];
            return array_merge($own, $child['children']);
        };

        foreach ($config['sidebar']['nodes'] as $node) {
            if (!is_array($node)) {
                continue;
            }
            $label = (string) ($node['label'] ?? '');
            $url = (string) ($node['url'] ?? '');
            // 订购入口归「我的资源」；其余根节点归「产品与服务」
            $target = ($url === 'cart/goodsList.htm' || stripos($label, '订购') === 0) ? 'resource' : 'service';

            $node['children'] = is_array($node['children'] ?? null) ? $node['children'] : [];
            $ownPages = $seedPages($node);

            if ($ownPages === [] && $node['children'] !== []) {
                // 纯分组容器：子级提升为二级，容器移除
                foreach ($node['children'] as $promoted) {
                    $promoted['children'] = $promote($promoted);
                    $promoted['order'] = $order;
                    $order++;
                    if ($target === 'resource') {
                        $resourceKids[] = $promoted;
                    } else {
                        $serviceKids[] = $promoted;
                    }
                }
                continue;
            }

            // 自身有页面：保留为二级菜单，自身页面排在前（与前台旧渲染顺序一致）
            $node['children'] = array_merge($ownPages, $node['children']);
            $node['order'] = $order;
            $order++;

            if ($target === 'resource') {
                $resourceKids[] = $node;
            } else {
                $serviceKids[] = $node;
            }
        }

        $resource = self::groupNode('我的资源', 'icon-a-7', $resourceKids);
        $service = self::groupNode('产品与服务', 'icon-a-6', $serviceKids);

        $config['sidebar']['nodes'] = [$resource, $service];
        $config['sidebar']['shape'] = 3;

        $errors = $this->validateTree($config['sidebar']['nodes'], true);
        if ($errors) {
            // 迁移产物必须合法；不合法时保持原状并在错误日志留痕，避免前台拿到坏树
            if (is_file($this->dir . '/migrate_error.log')) {
                @file_put_contents($this->dir . '/migrate_error.log', date('c') . "\t" . implode('；', $errors) . "\n", FILE_APPEND);
            }
            return $config;
        }

        $res = $this->save([
            'sidebar' => [
                'version'     => (int) $config['sidebar']['version'] + 1,
                'imported_at' => (int) $config['sidebar']['imported_at'],
                'shape'       => 3,
                'nodes'       => $config['sidebar']['nodes'],
            ],
        ], 'system:migrate');
        if (is_file($this->dir . '/migrate_error.log') && ($res['status'] ?? 0) !== 200) {
            @file_put_contents($this->dir . '/migrate_error.log', date('c') . "\t保存失败\n", FILE_APPEND);
        }
        return $this->read();
    }

    /**
     * 把导入的系统导航根节点包装进「产品与服务」一级分组（分组树形态专用）。
     *
     * 系统导航天然是两级（菜单 → 子菜单），直接作为根节点会破坏
     * 「一级分组 → 菜单 → 页面」的三级结构；这里把它们整体挂到
     * 产品与服务分组下（已存在则复用，不存在则创建），
     * 并按迁移同规则为导入菜单播种静态页面（module 容器除外）。
     * merge 模式下新增项追加到分组子级末尾。
     */
    public function wrapImportUnderServiceGroup(array $importedRoots, array $current): array
    {
        $seeds = self::PAGE_SEEDS;
        $seedPages = function (array $node) use ($seeds): array {
            $pages = [];
            $url = (string) ($node['url'] ?? '');
            $type = (string) ($node['source_type'] ?? 'custom');
            $isFallback = in_array($type, ['module', 'res_module'], true);
            if (isset($seeds[$url]) && !($isFallback && !empty($node['children']))) {
                foreach ($seeds[$url] as $i => [$name, $u]) {
                    $pages[] = self::pageNode($name, $u, $i);
                }
            }
            return $pages;
        };

        foreach ($importedRoots as &$n) {
            if (!is_array($n)) {
                continue;
            }
            $own = $seedPages($n);
            $kids = is_array($n['children'] ?? null) ? $n['children'] : [];
            $n['children'] = array_merge($own, $kids);
        }
        unset($n);

        $groups = is_array($current['sidebar']['nodes'] ?? null) ? $current['sidebar']['nodes'] : [];
        $service = null;
        foreach ($groups as $gi => $g) {
            if (is_array($g) && (string) ($g['label'] ?? '') === '产品与服务') {
                $service = &$groups[$gi];
                break;
            }
        }
        if ($service === null) {
            $groups[] = self::groupNode('产品与服务', 'icon-a-6', []);
            $service = &$groups[count($groups) - 1];
        }
        $existing = is_array($service['children'] ?? null) ? $service['children'] : [];
        // merge 语义由调用方保证（importedRoots 已剔除已存在项），这里直接追加
        $service['children'] = array_values(array_merge($existing, $importedRoots));

        return $groups;
    }

    /** Recursively merge system additions, preserving stable IDs and local customization. */
    public function mergeImported(array $existing, array $incoming, int &$added): array
    {
        foreach ($incoming as $node) {
            $key = $this->matchKey($node);
            $found = null;
            foreach ($existing as $i => $old) {
                if ($this->matchKey($old) === $key) { $found = $i; break; }
            }
            if ($found !== null) {
                $existing[$found]['children'] = $this->mergeImported(
                    $existing[$found]['children'] ?? [], $node['children'] ?? [], $added);
            } else {
                $count = function (array $nodes) use (&$count): int {
                    $n = 0; foreach ($nodes as $x) { $n += 1 + $count($x['children'] ?? []); } return $n;
                };
                $added += $count([$node]);
                $existing[] = $node;
            }
        }
        return array_values($existing);
    }

    /**
     * 计算「系统导航」与「当前独立副本」的差异，供后台预览后再决定是否合并。
     * 以 source_nav_id（system/plugin）或 label+url（其他）为匹配键。
     */
    public function diff(array $catalog): array
    {
        $current = $this->read();
        $existing = [];
        $walk = function (array $list) use (&$walk, &$existing) {
            foreach ($list as $n) {
                if (!is_array($n)) continue;
                $existing[$this->matchKey($n)] = $n;
                if (!empty($n['children'])) $walk($n['children']);
            }
        };
        $walk($current['sidebar']['nodes'] ?? []);

        $incoming = $this->importFromSystem($catalog);
        $flatIncoming = [];
        $flat = function (array $list) use (&$flat, &$flatIncoming) {
            foreach ($list as $n) {
                if (!is_array($n)) continue;
                $flatIncoming[$this->matchKey($n)] = $n;
                if (!empty($n['children'])) $flat($n['children']);
            }
        };
        $flat($incoming);

        $added = $changed = [];
        foreach ($flatIncoming as $k => $n) {
            if (!isset($existing[$k])) {
                $added[] = ['key' => $k, 'label' => $n['label']];
                continue;
            }
            $old = $existing[$k];
            if ($old['label'] !== $n['label'] || $old['url'] !== $n['url'] || (int) $old['icon'] !== 0 && $old['icon'] !== $n['icon']) {
                $changed[] = [
                    'key' => $k, 'label' => $n['label'],
                    'from' => ['label' => $old['label'], 'url' => $old['url']],
                    'to'   => ['label' => $n['label'], 'url' => $n['url']],
                ];
            }
        }
        $removed = [];
        foreach ($existing as $k => $n) {
            if (!isset($flatIncoming[$k])) {
                $removed[] = ['key' => $k, 'label' => $n['label'], 'reason' => '系统导航中已不存在'];
            }
        }

        return ['added' => $added, 'changed' => $changed, 'removed' => $removed];
    }

    private function matchKey(array $n): string
    {
        $navId = (int) ($n['source_nav_id'] ?? 0);
        if ($navId > 0) {
            return 'nav:' . $navId;
        }
        return 'url:' . (string) ($n['url'] ?? '') . '|' . (string) ($n['label'] ?? '');
    }

    /* ===================================================================== */
    /* 底层工具                                                              */
    /* ===================================================================== */

    private function pdo(): ?PDO
    {
        static $pdo = null;
        static $tried = false;
        if ($tried) {
            return $pdo;
        }
        $tried = true;

        // 独立管理台不引导 ThinkPHP，也就不会自动加载 config.php。
        // 这里按需加载一次站点配置以取得 DATABASE_* 常量（只读，不改任何配置）。
        if (!defined('DATABASE_HOSTNAME')) {
            global $ROOT;
            $cfg = ($ROOT ?: CRA1_THEME_ROOT) . '/config.php';
            if (is_file($cfg)) {
                require_once $cfg;
            }
        }

        if (!defined('DATABASE_HOSTNAME') || !defined('DATABASE_NAME')) {
            return null;
        }
        try {
            $dsn = 'mysql:host=' . DATABASE_HOSTNAME . ';port=' . DATABASE_PORT
                 . ';dbname=' . DATABASE_NAME . ';charset=' . DATABASE_CHARSET;
            $pdo = new PDO($dsn, DATABASE_USERNAME, DATABASE_PASSWORD, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT            => 5,
            ]);
        } catch (Throwable $e) {
            $pdo = null;
        }
        return $pdo;
    }

    private function readJson(string $file)
    {
        if (!is_file($file)) {
            return null;
        }
        $data = json_decode((string) file_get_contents($file), true);
        return is_array($data) ? $data : null;
    }

    private function atomicWrite(string $file, string $content): bool
    {
        if (!is_dir($this->dir) && !@mkdir($this->dir, 0750, true)) {
            return false;
        }
        $tmp = $file . '.tmp.' . getmypid();
        if (file_put_contents($tmp, $content, LOCK_EX) === false) {
            return false;
        }
        @chmod($tmp, 0640);
        if (!rename($tmp, $file)) {
            @unlink($tmp);
            return false;
        }
        return true;
    }

    /** @return resource|false */
    private function acquireLock()
    {
        if (!is_dir($this->dir)) {
            @mkdir($this->dir, 0750, true);
        }
        $fp = @fopen($this->lockFile, 'c');
        if (!$fp) {
            return false;
        }
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return false;
        }
        return $fp;
    }

    /** @param resource $fp */
    private function releaseLock($fp): void
    {
        if (is_resource($fp)) {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }
}
