<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

// V10 loads every website hook file, including inactive and partial installs.
$cra1Required = [dirname(__DIR__,4).'/cra1-theme/backend/bootstrap.php', dirname(__DIR__,3).'/cra1-shared/icons.php', dirname(__DIR__,3).'/cra1-shared/assets.php', dirname(__DIR__,3).'/cra1-shared/cart-links.php'];
foreach (['PageModuleRegistry.php','SeoRegistry.php','HeaderSupport.php','MenuCatalog.php','ThemeCode.php','MemberSession.php','Cra1.php','PageContent.php','ContentDefaults.php','BuiltinIcons.php','VisualPresentation.php'] as $cra1File) $cra1Required[] = __DIR__.'/'.$cra1File;
foreach ($cra1Required as $cra1File) if (!is_file($cra1File)) { error_log('CRA1 theme installation incomplete; hooks skipped'); return; }
try { require_once dirname(__DIR__,4).'/cra1-theme/backend/bootstrap.php'; }
catch (\Throwable $e) { error_log('CRA1 release unavailable; hooks skipped'); return; }
foreach (['Context.php','Files.php','Presentation/Footer.php','Release/Assets.php','Http/HookBootstrap.php','Http/Routes.php','Http/home/MemberController.php','Http/MemberGuard.php','Http/OperationGuard.php','Http/MemberController.php','Security/OperationVerification.php','Security/NativeAuthorization.php','Compatibility/Capabilities.php','Compatibility/Database.php','Compatibility/runtime.php'] as $cra1File) if (!is_file(CRA1_THEME_BACKEND.'/'.$cra1File)) { error_log('CRA1 backend incomplete; hooks skipped'); return; }
if (!function_exists('add_hook')) return;
if(!defined('CRA1_THEME_PREVIEW_DISPLAY_ONLY')||CRA1_THEME_PREVIEW_DISPLAY_ONLY!==true){
    try { \CRA1\Theme\Http\HookBootstrap::register(); }
    catch (\Throwable $e) { error_log('CRA1 hooks unavailable; installation check required'); return; }
}

/**
 * 酷锐A1主题 hooks（由 AppInit::loadAllHooksFiles 自动加载，前后台请求均生效）
 * - web_data_custom：把主题配置（defaults 合并后台保存值）注入前台模板变量 {$data.cra1.*}；
 *   同时在 酷锐A1主题下用独立管理台配置的菜单覆盖 header_nav（其他主题不受影响）。
 *
 * 多行文本格式：
 *   菜单：名称|链接|简介|新窗口，二级项名称前加 >
 *   轮播：图片或视频地址|链接|标题|描述|按钮文字|按钮链接（后四段可省略）
 *   节点：名称|经度|纬度 或 名称|地区|经度|纬度|是否显示
 *   快捷对：名称|链接
 *   悬浮：名称|链接|图标
 */
if (is_file(__DIR__ . '/PageModuleRegistry.php')) {
    require_once __DIR__ . '/PageModuleRegistry.php';
}
if (is_file(__DIR__ . '/SeoRegistry.php')) {
    require_once __DIR__ . '/SeoRegistry.php';
}
require_once dirname(__DIR__,3) . '/cra1-shared/icons.php';
require_once __DIR__ . '/HeaderSupport.php';
require_once __DIR__ . '/MenuCatalog.php';

/** A picture source must point at a real companion, including uploaded images.
 * Remote images retain their original URL; runtime never makes network probes.
 */
if (!function_exists('cra1_carousel_webp_source')) {
function cra1_carousel_webp_source(string $url, ?string $publicRoot = null): string
{
    if ($url === '' || $url[0] !== '/' || substr($url, 0, 2) === '//') return '';
    $path = parse_url($url, PHP_URL_PATH);
    if (!is_string($path) || !preg_match('/\.(?:jpe?g|png)$/i', $path)) return '';
    $candidate = preg_replace('/\.(?:jpe?g|png)$/i', '.webp', $path);
    $root = realpath($publicRoot ?? dirname(__DIR__, 3));
    if ($root === false) return '';
    $file = realpath($root . rawurldecode($candidate));
    if ($file === false || strpos($file, $root . DIRECTORY_SEPARATOR) !== 0 || !is_file($file)) return '';
    return $candidate . substr($url, strlen($path));
}
}

if (!function_exists('cra1_theme_defaults')) {

    function cra1_theme_defaults()
    {
        // 单一默认值来源：主题控制器 CRA1::defaults()；类不可用时使用精简兜底
        if (class_exists(\template\cra1\controller\Cra1::class)) {
            return \template\cra1\controller\Cra1::defaults();
        }

        return [
            'cloud_menu_text'       => '',
            'slides_text'           => '',
            'show_capability'       => '1',
            'panel_links_text'      => '',
            'show_pricing'          => '1',
            'show_solutions'        => '1',
            'show_steps'            => '1',
            'show_nodes'            => '1',
            'show_news'             => '1',
            'home_products_text'    => '',
            'home_products_limit'   => '8',
            'home_products_mobile_limit' => '3',
            'home_products_group'   => '0',
            'nodes_text'            => '',
            'float_enable'          => '1',
            'float_items_text'      => '',
            'hotline'               => '',
            'footer_promise_items_text' => '',
            'footer_about'          => '',
        ];
    }
}

if (!function_exists('cra1_url_ok')) {

    /** 链接白名单：站内相对地址（非协议相对）、https、tel、mailto */
    function cra1_url_ok($url)
    {
        $url = trim((string) $url);
        if ($url === '') {
            return true; // 空链接交由模板回退处理
        }
        if (preg_match('#^//#', $url)) {
            return false;
        }
        return (bool) preg_match('~^(#|/|https://|tel:|mailto:)~i', $url);
    }
}

if (!function_exists('cra1_line_hidden')) {

    /**
     * 多行配置的「隐藏」标记：行首 ! 表示该项在前台不显示。
     * 返回 [是否隐藏, 去掉标记后的行内容]。存储格式保持不变，向后兼容。
     */
    function cra1_line_hidden($line)
    {
        $line = trim((string) $line);
        if ($line !== '' && $line[0] === '!') {
            return [true, trim(substr($line, 1))];
        }
        return [false, $line];
    }
}

// 主题自带图标库（内置键的单一真相：后台点选清单 + 前台内联渲染）
require_once __DIR__ . '/BuiltinIcons.php';
require_once __DIR__ . '/VisualPresentation.php';

if (!function_exists('cra1_icon_url')) {





    /**
     * 归一化某页面/家族的模块顺序：白名单、去重、补缺；固定 Hero 不参与。
     * 共享 sortKey 的配置作用于同家族所有页面。
     */
    /** 读取原始配置值（未经 defaults 合并），用于 JSON 字段解析；runtime 优先于 legacy storage.json */
    /**
     * 按模块顺序渲染页面主体：include sections/<pageKey>/<moduleId>.html。
     * 模板文件名仅来自服务端 manifest 静态白名单；关闭开关的模块不输出空壳。
     * 完整 $data 上下文透传（core_* 模块消费 $data.config / 动态数据）。
     *
     * 模块模板查两个位置，页面目录优先：
     *   1. sections/<pageKey>/<moduleId>.html（页面专属）
     *   2. sections/_shared/<moduleId>.html（共享布局库：同一套布局供多页复用，
     *      内容按 rows 字段里的「页面」列过滤，避免 41 页各存一份重复模板）
     */
    function cra1_module_template_dir($pageKey, $mid)
    {
        $base = dirname(__DIR__) . "/sections/";
        if (is_file($base . $pageKey . "/" . $mid . ".html")) {
            return $base . $pageKey . "/";
        }
        if (is_file($base . "_shared/" . $mid . ".html")) {
            return $base . "_shared/";
        }
        return "";
    }

    function cra1_render_page_modules($pageKey, $cra1, $pageData = null)
{
    $cra1 = cra1_page_content_config((string)$pageKey, $cra1);
    $order = cra1_page_module_order($pageKey);
    if (!$order) {
        return "";
    }
    $cacheDir = (function_exists("runtime_path") ? runtime_path() : dirname(__DIR__, 4) . "/runtime/") . "temp/cra1_modules/";
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0750, true);
    }
    $tplData = ["data" => ["cra1" => $cra1]];
    if (is_array($pageData)) {
        foreach ($pageData as $k => $v) {
            if ($k !== "cra1") {
                $tplData["data"][$k] = $v;
            }
        }
    }
    // 共享模块按「页面」列过滤自身行，需要知道当前页 key
    $tplData["data"]["cra1"]["_page_key"] = $pageKey;
    // 产品页模块文案（overview/advantages/scenarios/service/faq/cta）：按当前页解析标题/描述/条目
    $tplData["data"]["cra1"] = cra1_product_module_copy($pageKey, $tplData["data"]["cra1"]);
    // 其余单页模块文案（企业信息/活动/表单/招聘方向…）：按模块解析「键|文本」
    $tplData["data"]["cra1"] = cra1_extra_module_copy($pageKey, $tplData["data"]["cra1"]);
    // 页面页首（page-hero）标题/描述/按钮/锚点导航：按当前页解析
    $tplData["data"]["cra1"] = cra1_page_hero_resolve($pageKey, $tplData["data"]["cra1"]);
    $tplData["data"]["cra1"] = cra1_prod_service_heads($pageKey, $tplData["data"]["cra1"]);
    $tplData["data"]["cra1"] = cra1_prod_cta_btn($pageKey, $tplData["data"]["cra1"]);
    // 首页三类可增删卡片（方案卡/功能卡/步骤）：rows 解析（v2.42）
    $tplData["data"]["cra1"] = cra1_home_cards_resolve($pageKey, $tplData["data"]["cra1"]);
    // 共享布局模块：把行数据按当前页过滤后注入（同一模板服务多页，各页只取自己的行）
    foreach (cra1_shared_module_keys() as $smId => $smType) {
        // 注入原始文本（供按页过滤）+ 过滤后的行数据（模板直接用）
        $tplData["data"]["cra1"][$smId . "_rows_text"] = isset($cra1[$smId . "_rows_text"]) ? $cra1[$smId . "_rows_text"] : "";
        $tplData["data"]["cra1"][$smId . "_rows"] = cra1_shared_rows_for_page($smId, $pageKey, $cra1);
        // 按页可见性：模板里的 {if $data.cra1.show_xxx == 1} 读到的是**本页决议结果**
        // （首页默认关、其他页默认开；用户显式设置始终优先）。见 cra1_shared_module_visible。
        $tplData["data"]["cra1"]["show_" . $smId] = cra1_shared_module_visible($smId, $pageKey, $cra1) ? "1" : "0";
        // 按页标题/链接覆盖（若有专属配置）——模板无需改动即可读到本页专属标题
        $pm = cra1_shared_page_meta($smId, $pageKey, $cra1);
        if ($pm !== null) {
            foreach ($pm as $suffix => $val) {
                if (!in_array($smId . '_' . $suffix, $cra1['_page_explicit_fields'] ?? [], true)) $tplData["data"]["cra1"][$smId . "_" . $suffix] = $val;
            }
        }
    }
    $tplData['data']['cra1'] = cra1_presentation_config((string)$pageKey, $tplData['data']['cra1']);
    $mergedTimeline = $tplData['data']['cra1']['_presentation_timeline_rows'] ?? null;
    $timelinePosition = null;
    if ($mergedTimeline !== null) {
        foreach ($order as $candidate) if (in_array($candidate, ['about_timeline','timeline_road'], true)) { $timelinePosition = $candidate; break; }
    }
    $html = "";
    $idx = 0;
    foreach ($order as $mid) {
        if (!cra1_module_visible($mid, $pageKey, $cra1)) continue;
        if ($mergedTimeline !== null && in_array($mid, ['about_timeline','timeline_road'], true) && $mid !== $timelinePosition) continue;
        $visibleKey = cra1_module_visibility_key($pageKey, $mid);
        if ($visibleKey !== null) $tplData['data']['cra1'][$visibleKey] = '1';
        $tplDir = cra1_module_template_dir($pageKey, $mid);
        $templateId = $mid;
        if ($mid === $timelinePosition) {
            $tplDir = dirname(__DIR__) . '/sections/_shared/';
            $templateId = 'timeline_road';
            $tplData['data']['cra1']['timeline_road_rows'] = $mergedTimeline;
            $tplData['data']['cra1']['show_timeline_road'] = '1';
            if (!cra1_presentation_custom($cra1, 'timeline_road_title')) $tplData['data']['cra1']['timeline_road_title'] = '发展历程';
            if (!cra1_presentation_custom($cra1, 'timeline_road_desc')) $tplData['data']['cra1']['timeline_road_desc'] = '';
        }
        if ($tplDir === "") {
            continue;
        }
        $idx++;
        $rendered = "";
        $bufferLevel=ob_get_level();
        try {
            // This hook is retained on rollback; an older selected backend may
            // predate the storage adapter and must still render its own pages.
            $cacheType = class_exists('think\\template\\driver\\File') && class_exists(\CRA1\Theme\Presentation\TemplateCache::class)
                ? \CRA1\Theme\Presentation\TemplateCache::class : 'file';
            $tpl = new \think\Template(['compile_type' => $cacheType]);
            $tpl->config([
                "view_path"    => $tplDir,
                "view_suffix"  => "html",
                "cache_path"   => $cacheDir,
                "tpl_cache"    => true,
                "taglib_build_in" => "cx",
                // 编译缓存以模板名 md5 为键：页面目录与 _shared 目录下同名模块
                // （如 _shared/faq.html 与 cloud/faq.html）会互相覆盖，
                // 故用所在目录名做前缀隔离（见 parseTemplateFile 的 cacheFile 组装）
                "cache_prefix" => str_replace("/", "_", $pageKey) . "_",
            ]);
            // 该版 think-template fetch() 直接 echo 而非返回，须用输出缓冲捕获
            ob_start();
            $tpl->fetch($templateId, $tplData);
            $rendered = ob_get_clean();
        } catch (Throwable $e) {
            while(ob_get_level()>$bufferLevel)ob_end_clean();
            cra1_layout_audit("render", "fail", $pageKey . "/" . $mid . ": " . $e->getMessage());
            if(cra1_admin_preview_document()!==null)throw $e;
            continue;
        }
        if (trim($rendered) === "") {
            continue; // 开关关闭等场景：不输出空壳
        }
        // data-enter：模块入场动画类型（按模块形态分配，见 cra1_module_enter_type）
        $enter = function_exists('cra1_module_enter_type') ? cra1_module_enter_type($mid) : '';
        $hasAnchor = preg_match('~\bid\s*=\s*(["\x27])'.preg_quote($mid,'~').'\1~i', $rendered);
        $anchor = $hasAnchor ? '' : ' id="'.htmlspecialchars($mid).'"';
        if ($mid === $timelinePosition) $rendered = '<span class="section-alias" id="'.($mid === 'about_timeline' ? 'timeline_road' : 'about_timeline').'"></span>' . $rendered;
        $html .= "<div" . $anchor . " data-cra1-module=\"" . htmlspecialchars($mid) . "\" data-cra1-page=\"" . htmlspecialchars($pageKey) . "\""
            . " data-cra1-order=\"" . $idx . "\""
            . ($enter !== '' ? " data-enter=\"" . htmlspecialchars($enter) . "\"" : "")
            . ">" . $rendered . "</div>";
    }
    return $html;
}

    /** 读取原始配置值（未经 defaults 合并），用于 JSON 字段解析 */
    function cra1_theme_config_raw($key)
    {
        $preview = cra1_admin_preview_config();
        if ($preview !== null) return $preview[$key] ?? '';
        static $raw = null;
        if ($raw === null) {
            $raw = [];
            $paths = [__DIR__ . '/storage.json'];
            if (function_exists('runtime_path')) {
                array_unshift($paths, runtime_path() . 'cra1_theme/config.json');
            } else {
                array_unshift($paths, dirname(__DIR__, 4) . '/runtime/cra1_theme/config.json');
            }
            foreach ($paths as $f) {
                if (is_file($f)) {
                    $d = json_decode((string) file_get_contents($f), true);
                    if (is_array($d)) {
                        $raw = array_merge($raw, $d);
                    }
                }
            }
        }
        return isset($raw[$key]) ? (string) $raw[$key] : '';
    }

    function cra1_icon_url($spec, $size = 48, $color = '')
    {
        return cra1_icons_url(trim((string)$spec),(int)$size,(string)$color);
    }

    /** 图标是否为 PNG（icons8）——模板据此决定用 <img> 还是可着色的 mask span */
    function cra1_icon_is_png($url)
    {
        if (!is_string($url)||$url==='')return false;
        $d=cra1_icons_resolve($url);return empty($d['colorable']);
    }
}


/**
 * 行业亮点 canonical rows 解析：优先新 rows，缺失时从旧 c1..c4 标量派生。
 * rows 存储为「标题|描述」多行文本，兼容 React serializer 的尾部空列与 ! 隐藏前缀。
 */
if (!function_exists('cra1_parse_industry_highlights')) {
    function cra1_parse_industry_highlights($industry, array $merged)
    {
        $canonicalKey = 'sol_ind_' . $industry . '_highlights_text';
        $rows = [];
        $rawRows = isset($merged[$canonicalKey]) ? trim((string) $merged[$canonicalKey]) : '';
        if ($rawRows !== '') {
            foreach (preg_split('/\r?\n/', $rawRows) as $line) {
                list($hidden, $line) = cra1_line_hidden($line);
                if ($line === '') continue;
                $parts = cra1_icon_row_parts($line)['parts'];
                $name = (string) ($parts[0] ?? '');
                if ($name === '') continue;
                $rows[] = ['name' => $name, 'desc' => (string) ($parts[1] ?? ''), 'hidden' => $hidden];
            }
            return $rows;
        }
        if (cra1_content_explicit($merged, $canonicalKey)) return [];
        // 旧字段回退：保留旧配置中每一组自定义值，空值已经由 defaults 合并兜底。
        for ($i = 1; $i <= 4; $i++) {
            $titleKey = 'sol_ind_' . $industry . '_c' . $i . '_title';
            $descKey = 'sol_ind_' . $industry . '_c' . $i . '_desc';
            $name = trim((string) ($merged[$titleKey] ?? ''));
            $desc = trim((string) ($merged[$descKey] ?? ''));
            if ($name !== '') {
                $rows[] = ['name' => $name, 'desc' => $desc, 'hidden' => false];
            }
        }
        return $rows;
    }
}

if (!function_exists('cra1_theme_config')) {

    function cra1_theme_config()
    {
        static $config = null;
        if ($config !== null) {
            return $config;
        }
        $defaults = cra1_theme_defaults();

        // 与 CRA1::readStorage 一致：优先 runtime 文件，旧 public 文件兼容读取
        $saved = null;
        if (class_exists(\template\cra1\controller\Cra1::class)) {
            $saved = (new \template\cra1\controller\Cra1())->getConfig();
        } else {
            foreach ([runtime_path() . 'cra1_theme/config.json', __DIR__ . '/storage.json'] as $file) {
                if (is_file($file)) {
                    $saved = json_decode((string) file_get_contents($file), true);
                    if (is_array($saved)) {
                        break;
                    }
                    $saved = null;
                }
            }
        }
        if (!is_array($saved)) {
            $saved = [];
        }

        // 仅接受已知字段，未知/历史字段不进入前台注入
        $merged = [];
        foreach ($defaults as $key => $default) {
            $value = isset($saved[$key]) ? $saved[$key] : '';
            $merged[$key] = ($value === '' || $value === null) ? $default : $value;
        }

        
        $merged['_theme_saved_fields'] = array_keys(array_filter($saved, static function($v){ return $v !== '' && $v !== null; }));
        $publicExplicit = json_decode((string)($saved['public_content_explicit_json'] ?? ''), true);
        $merged['_public_explicit_fields'] = is_array($publicExplicit) ? array_keys($publicExplicit) : [];
        foreach ($merged['_public_explicit_fields'] as $key) if(array_key_exists($key,$saved)) $merged[$key]=$saved[$key];
        $merged = cra1_theme_derived_config($merged);
        $config = $merged;
        return $config;
    }
}

/** Browser widgets use the same page content and visibility as PHP modules. */
function cra1_browser_config(array $config): array
{
    // Only data consumed by browser widgets. Editing documents, other pages,
    // disabled sections and custom code never enter this generic projection.
    $page=(string)($config['_page_key']??'home');
    $result=[];
    if ($page==='home') {
        foreach (['slides','slides_effect'] as $key) if(isset($config[$key]))$result[$key]=$config[$key];
        foreach (['pricing','news'] as $module) {
            $visible=cra1_module_visible($module,'home',$config);
            $result['show_'.$module]=$visible?'1':'0';
            if($module==='pricing' && $visible) foreach(['home_products','home_product_groups','home_products_limit','home_products_mobile_limit','home_products_group'] as $key) if(isset($config[$key]))$result[$key]=$config[$key];
        }
    }
    if ((string)($config['float_enable']??'0')==='1') $result['float_items']=$config['float_items']??[];
    return $result;
}

function cra1_browser_page_data(array $data): array
{
    $result=['config'=>array_intersect_key($data['config']??[],array_flip(['website_name']))];
    if (!empty($data['banner'])) $result['banner']=$data['banner'];
    return $result;
}

/** Rebuild derived arrays after page overrides using the same public parsers. */
function cra1_theme_derived_config(array $merged): array
{
        // 多行文本 → 结构化数组
        $merged['cloud_menu']      = cra1_resolve_menu($merged['cloud_menu_text'], null, $merged['cloud_menu_aside_text'] ?? '');
        $merged['cloud_menu_aside'] = cra1_parse_menu($merged['cloud_menu_aside_text'] ?? '');
        $merged['footer_menu']     = cra1_parse_menu($merged['footer_menu_text']);
        $merged['slides']          = cra1_parse_slides($merged['slides_text']);
        $merged['slides_effect'] = in_array($merged['slides_effect'] ?? '', ['fade', 'slide', 'cube', 'flip', 'none'], true) ? $merged['slides_effect'] : 'cube';
        $merged['nodes']           = cra1_parse_nodes($merged['nodes_text']);
        // 三项统计：来自多行字段「名称|数值」；数值留空则按地区行汇总
        $__nr = $merged['nodes'];
        $__sum = function ($key) use ($__nr) {
            $t = 0;
            foreach ($__nr as $__n) {
                if (isset($__n[$key]) && $__n[$key] !== null) {
                    $t += intval($__n[$key]);
                }
            }
            return $t;
        };
        // 自动汇总值按顺序对应：第 1 行=地区数、第 2 行=节点数、第 3 行=机房数
        $__auto = [count($__nr), $__sum('nodes'), $__sum('racks')];
        $merged['nodes_stat'] = [];
        foreach (preg_split('/\r?\n/', (string) $merged['nodes_stat_text']) as $__si => $__line) {
            list($__hidden, $__line) = cra1_line_hidden($__line);
            if ($__hidden || trim($__line) === '') {
                continue;
            }
            $__p = cra1_icon_row_parts($__line)['parts'];
            $__label = (string) ($__p[0] ?? '');
            if ($__label === '') {
                continue;
            }
            $__val = (string) ($__p[1] ?? '');
            $__idx = count($merged['nodes_stat']);
            $merged['nodes_stat'][] = [
                'key'   => $__idx,
                'label' => $__label,
                'value' => $__val !== '' ? $__val : (isset($__auto[$__idx]) ? $__auto[$__idx] : ''),
            ];
        }
        // 面板文案：每行「键|文案」。node/rack 是数量单位，其余键按顺序作为线路标签
        $__unitNode = '节点';
        $__unitRack = '机房';
        $__lines = [];
        foreach (preg_split('/\r?\n/', (string) $merged['nodes_panel_text']) as $__line) {
            list($__hidden, $__line) = cra1_line_hidden($__line);
            if ($__hidden || trim($__line) === '') {
                continue;
            }
            $__p = cra1_icon_row_parts($__line)['parts'];
            $__k = strtolower((string) ($__p[0] ?? ''));
            $__v = (string) ($__p[1] ?? '');
            if ($__v === '') {
                continue;
            }
            if ($__k === 'node') {
                $__unitNode = $__v;
            } elseif ($__k === 'rack') {
                $__unitRack = $__v;
            }
        }
        $merged['nodes_unit_node'] = $__unitNode;
        $merged['nodes_unit_rack'] = $__unitRack;
        // 全局标签来自独立字段（chips 控件写入的英文逗号分隔串）；兼容 /、, 混写
        $__lines = [];
        foreach (preg_split('/[,，、\/]/u', (string) $merged['nodes_lines_text']) as $__one) {
            $__one = trim($__one);
            if ($__one !== '') {
                $__lines[] = $__one;
            }
        }
        $merged['nodes_lines'] = $__lines;
        $merged['panel_links']     = cra1_parse_pairs($merged['panel_links_text']);
        $merged['float_items']     = cra1_parse_float_items($merged['float_items_text']);
        $merged['header_support']  = cra1_support_render_config($merged);
        $merged['solution_cards']  = cra1_parse_menu_lines($merged['sol_cards_text']);
        $merged['home_products']   = cra1_parse_home_products($merged['home_products_text']);
        // 分组顺序（前台筛选条用）；指定商品为空时该数组也为空，走「默认分组」自动展示
        $merged['home_product_groups'] = cra1_parse_home_products_groups($merged['home_products_text']);
        $merged['home_products_limit'] = min(12, max(1, intval($merged['home_products_limit']) ?: 8));
        $merged['home_products_mobile_limit'] = min(12, max(1, intval($merged['home_products_mobile_limit']) ?: 3));
        $merged['home_products_group'] = intval($merged['home_products_group']) ?: 0;

        // 图标库解析（Iconify/Icons8 → 本地缓存 URL；内置键返回 ''，模板回退内联 SVG）
        $merged['cap2_icon_url'] = cra1_icon_url($merged['cap2_icon'], 48, '#1769e0');
        $merged['cap3_icon_url'] = cra1_icon_url($merged['cap3_icon'], 48, '#0e9f6e');
        $merged['cap4_icon_url'] = cra1_icon_url($merged['cap4_icon'], 48, '#d97706');
        $merged['cap2_icon_png'] = cra1_icon_is_png($merged['cap2_icon_url']) ? 1 : 0;
        $merged['cap3_icon_png'] = cra1_icon_is_png($merged['cap3_icon_url']) ? 1 : 0;
        $merged['cap4_icon_png'] = cra1_icon_is_png($merged['cap4_icon_url']) ? 1 : 0;
        foreach ($merged['float_items'] as $fiKey => $fiItem) {
            $fiUrl = cra1_icon_url(isset($fiItem['icon']) ? $fiItem['icon'] : '', 40);
            $merged['float_items'][$fiKey]['icon_img'] = $fiUrl;
            $merged['float_items'][$fiKey]['icon_css'] = cra1_icon_style_vars($fiItem['icon_style']??null);
            $merged['float_items'][$fiKey]['icon_png'] = cra1_icon_is_png($fiUrl) ? 1 : 0;
        }
        unset($fiKey, $fiItem);

        /* 页脚视图预构建：所有条件在 PHP 侧解决，模板零 {if}/{foreach} 嵌套
           （think-template 闭合标签配对在深层嵌套下会出现替换偏移错乱） */
        $merged['footer_promise_html'] = '';
        if ($merged['show_footer_promise'] == 1) {
            // 每条承诺独立图标：footer_promise_items_text 每行 = 文案|图标
            $promiseHtml = '<div class="grid grid-cols-2 gap-4 border-b border-line py-7 md:grid-cols-4">';
            $count = 0;
            foreach (preg_split('/\r?\n/', (string) $merged['footer_promise_items_text']) as $line) {
                list($hidden, $line) = cra1_line_hidden($line);
                if ($hidden || $line === '') {
                    continue;
                }
                $p = cra1_icon_row_parts($line)['parts'];
                $promiseText = isset($p[0]) ? $p[0] : '';
                if ($promiseText === '') {
                    continue;
                }
                $iconUrl = cra1_icon_url(isset($p[1]) ? $p[1] : '', 36);
                if ($iconUrl !== '') {
                    $iconHtml = cra1_icon_is_png($iconUrl)
                        ? '<img src="' . htmlspecialchars($iconUrl) . '" alt="" class="h-4 w-4">'
                        : '<span class="icon-img h-4 w-4" style="--icon:url(\'' . htmlspecialchars($iconUrl) . '\')" aria-hidden="true"></span>';
                } else {
                    $iconHtml = '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z"></path><path d="m9 12 2 2 4-4"></path></svg>';
                }
                $promiseHtml .= '<div class="flex items-center gap-3"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" data-cra1-icon-label="' . htmlspecialchars($promiseText, ENT_QUOTES, 'UTF-8') . '"'.cra1_icon_row_attrs($line).' data-cra1-icon-fallback="security">' . $iconHtml . '</span><span class="text-sm font-medium text-ink">' . htmlspecialchars($promiseText) . '</span></div>';
                $count++;
            }
            $merged['footer_promise_html'] = $count > 0 ? $promiseHtml . '</div>' : '';
        }

        // 按钮组（footer_cta / sol_hero_btn / sol_cta：每行 = 按钮文字|链接；行首 ! 隐藏）
        $merged['footer_cta'] = cra1_parse_pairs($merged['footer_cta_text']);
        $merged['sol_hero_btn'] = cra1_parse_pairs($merged['sol_hero_btn_text']);
        $merged['sol_cta'] = cra1_parse_pairs($merged['sol_cta_text']);
        $btnHtmlFor = function ($rows) {
            $html = '';
            foreach ($rows as $bi => $btn) {
                $html .= '<a href="' . htmlspecialchars($btn['url'] ?: '#') . '" class="btn ' . ($bi === 0 ? 'btn-gradient' : 'btn-outline btn-primary') . '">' . htmlspecialchars($btn['name']) . '<span class="cui-arrow" data-cui-arrow aria-hidden="true">' . ($bi === 0 ? '→' : '↗') . '</span></a>';
            }
            return $html;
        };
        $merged['sol_hero_btn_html'] = $btnHtmlFor($merged['sol_hero_btn']);
        $merged['sol_cta_html'] = $btnHtmlFor($merged['sol_cta']);

        $merged['footer_cta_html'] = '';
        if ($merged['show_footer_cta'] == 1) {
            $btnHtml = '<div class="flex flex-wrap gap-2">';
            foreach ($merged['footer_cta'] as $bi => $btn) {
                $btnHtml .= '<a href="' . htmlspecialchars($btn['url'] ?: '/cart/goodsList.htm') . '" class="btn btn-sm ' . ($bi === 0 ? 'btn-gradient' : 'btn-outline') . ' px-4">' . htmlspecialchars($btn['name']) . '<span class="cui-arrow" data-cui-arrow aria-hidden="true">' . ($bi === 0 ? '→' : '↗') . '</span></a>';
            }
            $merged['footer_cta_html'] = $btnHtml . '</div>';
        }

        $merged['footer_menu_html'] = '';
        if ($merged['show_footer_menu'] == 1) {
            if (count($merged['footer_menu']) > 0) {
                $menuHtml = '';
                foreach ($merged['footer_menu'] as $group) {
                    $menuHtml .= '<details class="footer-menu-group" open><summary class="text-sm font-semibold text-ink">' . htmlspecialchars($group['name']) . '<span aria-hidden="true"></span></summary><ul class="space-y-2 text-sm text-body">';
                    foreach ($group['children'] as $item) {
                        $blank = !empty($item['blank']) ? ' target="_blank" rel="noopener"' : '';
                        $menuHtml .= '<li><a href="' . htmlspecialchars($item['file_address']) . '"' . $blank . ' class="transition-colors duration-150 hover:text-brand">' . htmlspecialchars($item['name']) . '</a></li>';
                    }
                    $menuHtml .= '</ul></details>';
                }
                $merged['footer_menu_html'] = $menuHtml;
            }
        }

        // 友情链接（footer_links_text 每行：名称|链接|新窗口1；留空回退 v10 friendly_link）
        $merged['footer_links_html'] = '';
        if ($merged['show_footer_links'] == 1) {
            $parts = [];
            foreach (preg_split('/\r?\n/', (string) $merged['footer_links_text']) as $line) {
                list($hidden, $line) = cra1_line_hidden($line);
                if ($hidden || $line === '') {
                    continue;
                }
                $p = cra1_icon_row_parts($line)['parts'];
                $linkUrl = isset($p[1]) ? $p[1] : '';
                if (!isset($p[0]) || $p[0] === '' || !cra1_url_ok($linkUrl)) {
                    continue;
                }
                $parts[] = '<a href="' . htmlspecialchars($linkUrl) . '"' . ((isset($p[2]) && $p[2] === '1') ? ' target="_blank" rel="noopener"' : '') . ' class="transition-colors duration-150 hover:text-brand">' . htmlspecialchars($p[0]) . '</a>';
            }
            if ($parts) {
                $merged['footer_links_html'] = implode('', $parts);
            }
        }

        // ICP 备案 / 版权（留空时模板回退 v10 原生配置）
        $merged['footer_icp_html'] = '';
        if ($merged['footer_icp_text'] !== '') {
            $merged['footer_icp_html'] = '<a href="' . htmlspecialchars($merged['footer_icp_url'] ?: 'https://beian.miit.gov.cn/') . '" target="_blank" rel="nofollow noopener" class="transition-colors duration-150 hover:text-brand">' . htmlspecialchars($merged['footer_icp_text']) . '</a>';
        }
        $merged['footer_copyright_html'] = htmlspecialchars(\CRA1\Theme\Presentation\Footer::copyrightText((string)$merged['footer_copyright_text']));

        // 内容页面模块（rows → 结构化数组；联系卡片 3 列 = 标题|描述|图标）
        $merged['contact_cards'] = cra1_parse_menu_lines($merged['contact_cards_text']);
        foreach ($merged['contact_cards'] as $ccKey => $ccItem) {
            $ccUrl = cra1_icon_url(isset($ccItem['url']) ? $ccItem['url'] : '', 44);
            $merged['contact_cards'][$ccKey]['icon_img'] = $ccUrl;
            $merged['contact_cards'][$ccKey]['icon_png'] = cra1_icon_is_png($ccUrl) ? 1 : 0;
        }
        unset($ccKey, $ccItem);
        foreach (['contact_service', 'doc_quick', 'doc_guide', 'news_nav', 'news_foot', 'announce_nav', 'announce_foot', 'recruit_benefits', 'recruit_flow', 'feedback_channels', 'feedback_flow', 'activity_rules'] as $rowsKey) {
            $merged[$rowsKey] = cra1_parse_menu_lines($merged[$rowsKey . '_text']);
        }
        // 引用语侧栏要点（共享布局 quote-stage 的纯文字行：页面|名称|描述）
        $merged['quote_stage_points'] = cra1_parse_shared_text_rows($merged['quote_stage_points_text'], '');
        // 招聘流程：注入步骤序号（模板表达式 {$ri + 1} 不会被编译，改为数据侧输出）
        foreach ($merged['recruit_flow'] as $rfKey => $rfRow) {
            $merged['recruit_flow'][$rfKey]['no'] = $rfKey + 1;
        }

        // 详情/分类/404 页面模块解析
        $merged['detail_rel'] = cra1_parse_menu_lines($merged['detail_rel_text']);
        $merged['page_cta'] = cra1_parse_menu_lines($merged['page_cta_text']);
        $merged['doc_result'] = cra1_parse_menu_lines($merged['doc_result_text']);
        $merged['news_classify_nav'] = cra1_parse_menu_lines($merged['news_classify_nav_text']);

        // 页面高度扩充模块解析（关于时间轴 / 行业方案更多服务 / 渠道页权益）
        $merged['about_timeline'] = cra1_parse_menu_lines($merged['about_timeline_text']);
        $merged['solution_extra'] = cra1_parse_menu_lines($merged['solution_extra_text']);
        $merged['partner_cps_extra'] = cra1_parse_menu_lines($merged['partner_cps_extra_text']);
        $merged['partner_agent_extra'] = cra1_parse_menu_lines($merged['partner_agent_extra_text']);

        // 关于页图片模块解析（名称|描述|图片链接）
        $merged['about_honor'] = cra1_parse_menu_lines($merged['about_honor_text']);
        $merged['about_partner'] = cra1_parse_menu_lines($merged['about_partner_text']);

        // 行业方案亮点：canonical rows 优先，旧 c1..c4 自动派生；同时回填 rows 文本供后台编辑器显示
        foreach (['ecommerce', 'finance', 'game', 'auto', 'travel', 'education', 'medical', 'agriculture'] as $industryKey) {
            $highlightRows = cra1_parse_industry_highlights($industryKey, $merged);
            $merged['sol_ind_' . $industryKey . '_highlights'] = $highlightRows;
            $canonicalKey = 'sol_ind_' . $industryKey . '_highlights_text';
            if (trim((string) ($merged[$canonicalKey] ?? '')) === '') {
                $merged[$canonicalKey] = implode("\n", array_map(function ($row) {
                    return str_replace(['|', "\r", "\n"], ' ', $row['name']) . '|' . str_replace(['|', "\r", "\n"], ' ', $row['desc']);
                }, $highlightRows));
            }
        }

        // 自定义 CSS 输出在 <style> 内：防闭合标签逃逸（管理员可信输入，仅防御性处理）
        $merged['custom_css']      = str_ireplace('</style', '<\\/style', (string) $merged['custom_css']);

        // 共享布局模块（sections/_shared/*）的行数据**不在配置解析阶段落地**：
        // 行内容需按当前页面过滤（页面 key 渲染时才可知），统一由渲染器调用
        // cra1_shared_rows_for_page() 处理（含图标缓存与 text/link 两种解析器分流），
        // 避免两处解析逻辑分叉（曾导致时间轴年份丢失）。

    return $merged;
}

if (!function_exists('cra1_shared_module_keys')) {

    /**
     * 共享布局模块清单：模块 ID → 行格式类型（'link' 带链接 / 'text' 纯文字）。
     * 唯一真相，供配置解析与「按页过滤」两处共用。
     */
    function cra1_shared_module_keys()
    {
        return [
            'figure_band'   => 'link',
            'timeline_road' => 'text',
            'compare_split' => 'text',
            'quote_stage'   => 'text',
            'rail_scroll'   => 'link',
            'icon_ribbon'   => 'link',
            'spec_matrix'   => 'text',
            'faq_board'     => 'text',
            'step_ribbon'   => 'text',
            'duo_feature'   => 'text',
            'choice_ladder' => 'link',
            'link_tiles'    => 'link',
            'price_slider'  => 'link',
            'stack_board'   => 'link',
            'doc_shelf'     => 'link',
            'region_ledger' => 'link',
            'proof_wall'    => 'text',
            'switch_deck'   => 'link',
        ];
    }
}

/** Common page targets for aggregated rows: exact page, multi-page, wildcard. */
function cra1_row_targets_page(string $target, string $page): bool
{
    $targets = array_values(array_filter(preg_split('/[,，\s]+/u', trim($target))));
    return !$targets || in_array('*', $targets, true) || in_array($page, $targets, true);
}

/** Single-value page copy prefers the page row over a shared fallback. */
function cra1_page_copy_lines(string $text, string $page): array
{
    $exact = []; $shared = [];
    foreach (preg_split('/\r?\n/', $text) as $line) {
        [$hidden, $content] = cra1_line_hidden($line);
        if ($hidden || trim($content) === '') continue;
        $target = trim(explode('|', $content, 2)[0]);
        if (!cra1_row_targets_page($target, $page)) continue;
        if ($target === $page) $exact[] = $line; else $shared[] = $line;
    }
    return array_merge($exact, $shared);
}

if (!function_exists('cra1_product_module_copy')) {

    /**
     * 产品页模块文案（overview/advantages/scenarios/service/faq/cta）按页解析。
     *
     * 背景：这 6 个模块在 13 个产品页各有**不同文案**（如 overview 标题「把计算资源交给业务节奏」…），
     * 原先全部硬编码在模板里，违反 §6「前台可见内容必须全部可在后台控制」。
     *
     * 存储：一条 rows 字段承载同组页面的全部文案，行格式「页面|标题|描述」，
     *       靠行首「页面」列区分归属——与共享布局模块库同一范式（§4 一条设置 + 不多建重复模板）。
     * 解析：此处按当前页把对应的标题/描述与条目注入 `prod_<mod>_title/_desc/_items`，
     *       模板以「配置优先、模板兜底」引用，配置缺失时保留原文案（不会白屏）。
     *
     * @param string $pageKey 当前页面 key
     * @param array  $merged  合并后的配置
     */
    function cra1_product_module_copy($pageKey, array $merged)
    {
        $mods = ['overview', 'advantages', 'scenarios', 'service', 'faq', 'cta'];
        foreach ($mods as $m) {
            $tKey = 'prod_' . $m . '_title_text';
            $iKey = 'prod_' . $m . '_items_text';
            $title = '';
            $desc = '';
            $items = [];
            // 标题行：页面|标题|描述
            foreach (cra1_page_copy_lines((string) ($merged[$tKey] ?? ''), $pageKey) as $line) {
                list($hidden, $line) = cra1_line_hidden($line);
                if ($hidden || trim($line) === '') {
                    continue;
                }
                $p = cra1_icon_row_parts($line)['parts'];
                $pg = (string) ($p[0] ?? '');
                if (!cra1_row_targets_page($pg, $pageKey)) {
                    continue;
                }
                $title = (string) ($p[1] ?? '');
                $desc = (string) ($p[2] ?? '');
                break;
            }
            // 条目行：页面|名称|描述
            foreach (preg_split('/\r?\n/', (string) ($merged[$iKey] ?? '')) as $line) {
                list($hidden, $line) = cra1_line_hidden($line);
                if ($hidden || trim($line) === '') {
                    continue;
                }
                $p = cra1_icon_row_parts($line)['parts'];
                $pg = (string) ($p[0] ?? '');
                if (!cra1_row_targets_page($pg, $pageKey)) {
                    continue;
                }
                // 行格式：页面|名称|描述  或（service 表格）页面|项目|适用方式|说明
                $items[] = [
                    'name' => (string) ($p[1] ?? ''),
                    'desc' => $m === 'service' && count($p) >= 4 ? (string) ($p[3] ?? '') : (string) ($p[2] ?? ''),
                    'tag'  => $m === 'service' && count($p) >= 4 ? (string) ($p[2] ?? '') : '',
                ];
            }
            $merged['prod_' . $m . '_title'] = $title;
            $merged['prod_' . $m . '_desc'] = $desc;
            $merged['prod_' . $m . '_items'] = $items;
        }
        return $merged;
    }
}

if (!function_exists('cra1_extra_module_copy')) {

    /**
     * 其余模块的标题/文案按模块配置（§6：前台可见内容全部可在后台控制）。
     *
     * 这些模块基本各占一页（about_company / core_activities / contact_form …），
     * 文案不像产品页那样成组复用，故用**一条 rows 字段管一个模块**：
     * 行格式「键|文本」，键是该模块里的文案标识（如 title / item1 / cta）——
     * 一条设置承载该模块全部可配文案，不散成 N 个标量键（§4）。
     *
     * 模板以「配置优先、模板兜底」引用 `$data.cra1.<模块>_copy.<键>`。
     *
     * @param string $pageKey 当前页面 key
     * @param array  $merged  合并后的配置
     */
    function cra1_extra_module_copy($pageKey, array $merged)
    {
        $ids = cra1_extra_copy_modules();
        foreach ($ids as $mid => $ignore) {
            $key = 'copy_' . $mid . '_text';
            $merged[$mid . '_copy'] = cra1_copy_effective_map((string)$pageKey, $mid, $merged);
        }
        return $merged;
    }
}

if (!function_exists('cra1_page_hero_resolve')) {

    /**
     * 页面页首（page-hero）按页解析：标题/描述/两个行动按钮/锚点导航。
     *
     * 背景：30 个页面的页首标题与描述原先硬编码在各页模板里（v2.41 可控率排查中
     * 占失控段约六成）。与 figure_band 等共享行同一范式：一条 rows 字段承载全部页面，
     * 行格式「页面|标题|描述|主按钮|主链接|副按钮|副链接」（列可留空）；
     * 锚点导航独立一条「页面|名称#锚点,名称#锚点」。
     * 模板引用为「配置优先、原文兜底」：对应列缺失时保留模板原文，不会白屏。
     *
     * @param string $pageKey 当前页 key（模板名，index → home）
     * @param array  $merged  合并后的配置
     */
    function cra1_page_hero_resolve($pageKey, array $merged)
    {
        $title = $desc = $b1 = $u1 = $b2 = $u2 = '';
        foreach (cra1_page_copy_lines((string) ($merged['page_hero_rows_text'] ?? ''), $pageKey) as $line) {
            list($hidden, $line) = cra1_line_hidden($line);
            if ($hidden || trim($line) === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            // An unfinished page selector must not become a site-wide title.
            // Deliberately shared heroes still use an explicit "*" selector.
            if (($p[0] ?? '') === '' || !cra1_row_targets_page((string) $p[0], $pageKey)) {
                continue;
            }
            $title = (string) ($p[1] ?? '');
            $desc  = (string) ($p[2] ?? '');
            $b1 = (string) ($p[3] ?? ''); $u1 = (string) ($p[4] ?? '');
            $b2 = (string) ($p[5] ?? ''); $u2 = (string) ($p[6] ?? '');
            break;
        }
        $heroDefaults = cra1_content_defaults_catalog()['hero'][$pageKey] ?? [];
        if (!cra1_content_explicit($merged, 'page_hero_rows_text')) {
            foreach (['title'=>'title','desc'=>'desc','btn1'=>'b1','url1'=>'u1','btn2'=>'b2','url2'=>'u2'] as $column=>$var) {
                if ($$var !== '') continue;
                $legacy = $heroDefaults['legacyKeys'][$column] ?? null;
                $$var = $legacy ? (string)($merged[$legacy] ?? $heroDefaults['defaults'][$column] ?? '') : (string)($heroDefaults['defaults'][$column] ?? '');
            }
        }
        $merged['page_hero_title'] = $title;
        $merged['page_hero_desc'] = $desc;
        $merged['page_hero_btn1_text'] = $b1;
        $merged['page_hero_btn1_url'] = cra1_url_ok($u1) ? $u1 : '';
        $merged['page_hero_btn2_text'] = $b2;
        $merged['page_hero_btn2_url'] = cra1_url_ok($u2) ? $u2 : '';

        $anchors = [];
        $manifest = cra1_page_module_manifest();$known = [];$current = [];
        foreach ($manifest as $page) foreach ($page['modules'] ?? [] as $module) $known[$module['id']] = true;
        foreach ($manifest[$pageKey]['modules'] ?? [] as $module) $current[$module['id']] = true;
        $visibilityRaw = isset($merged['_theme_saved_fields']) ? array_intersect_key($merged, array_fill_keys(array_merge($merged['_theme_saved_fields'], ['page_module_visibility_json']), true)) : null;
        foreach (cra1_page_copy_lines((string) ($merged['page_hero_anchor_text'] ?? ''), $pageKey) as $line) {
            list($hidden, $line) = cra1_line_hidden($line);
            if ($hidden || trim($line) === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            if (!cra1_row_targets_page((string) ($p[0] ?? ''), $pageKey)) {
                continue;
            }
            foreach (preg_split('/[,，]+/u', (string) ($p[1] ?? '')) as $pair) {
                $pair = trim($pair);
                if ($pair === '' || strpos($pair, '#') === false) {
                    continue;
                }
                list($name, $id) = explode('#', $pair, 2);
                $name = trim($name);
                $id = preg_replace('/[^a-zA-Z0-9_\-]/', '', trim($id));
                if ($name === '' || $id === '') {
                    continue;
                }
                // Public navigation only includes modules supported and shown here.
                // Unregistered historical anchors remain available for custom markup.
                if (isset($known[$id]) && (!isset($current[$id]) || !cra1_module_visible($id, $pageKey, $merged, $visibilityRaw))) continue;
                $anchors[] = ['name' => $name, 'anchor' => $id];
            }
            break;
        }

        $merged['page_hero_anchors'] = $anchors;
        $merged['page_hero_art'] = cra1_presentation_hero((string)$pageKey);
        return $merged;
    }
}

if (!function_exists('cra1_home_cards_resolve')) {

    /**
     * 首页三类「可增删卡片」的行解析（v2.42）。
     *
     * 背景：首页的方案卡片、能力功能卡、快速上手步骤原先用 cards 类型存储（固定张数，
     * 后台只能看不能增删改）。改为 rows 存储后，条目可自由增删；旧扁平键（sol1_* / cap2_* /
     * band_item1_*）保留为**回退**——新键为空时由模板的 else 分支读取旧键，避免历史配置失效。
     *
     * 行格式：
     *   sol_home_cards_text  名称|描述|链接
     *   cap_cards_text       名称|描述|链接|图标
     *   band_items_text      标题|描述
     *
     * @param string $pageKey 当前页 key（仅首页需要，其他页返回空数组）
     * @param array  $merged  合并后的配置
     */
    function cra1_home_cards_resolve($pageKey, array $merged)
    {
        $specs = [
            'sol_home_cards' => ['key' => 'sol_home_cards_text', 'cols' => ['name', 'desc', 'url']],
            'cap_cards'      => ['key' => 'cap_cards_text', 'cols' => ['name', 'desc', 'url', 'icon']],
            'band_items'     => ['key' => 'band_items_text', 'cols' => ['name', 'desc']],
        ];
        foreach ($specs as $id => $spec) {
            $rows = [];
            if ($pageKey === 'home') {
                foreach (preg_split('/\r?\n/', (string) ($merged[$spec['key']] ?? '')) as $line) {
                    list($hidden, $line) = cra1_line_hidden($line);
                    if ($hidden || trim($line) === '') {
                        continue;
                    }
                    $p = cra1_icon_row_parts($line)['parts'];
                    if ((string) ($p[0] ?? '') === '') {
                        continue;
                    }
                    $row = [];
                    foreach ($spec['cols'] as $i => $col) {
                        $row[$col] = (string) ($p[$i] ?? '');
                    }
                    // 链接白名单：非法链接回退为空（模板据此走旧键或默认值）
                    if (isset($row['url']) && $row['url'] !== '' && !cra1_url_ok($row['url'])) {
                        $row['url'] = '';
                    }
                    // 图标 → 本地缓存 URL（与共享模块同一套规则）
                    if (isset($row['icon']) && $row['icon'] !== '') {
                        $u = cra1_icon_url($row['icon'], 40, '#1769e0');
                        $row['icon_img'] = $u;
                        $row['icon_png'] = cra1_icon_is_png($u) ? 1 : 0;
                    } else {
                        $row['icon_img'] = '';
                        $row['icon_png'] = 0;
                    }
                    $row['icon_style_attrs']=cra1_icon_row_attrs($line);
                    $rows[] = $row;
                }
                // 能力卡配色：按序在品牌蓝/成功绿/警示橙间循环（设计语言内的三种既有语义色，
                // 不让后台自由填色值 —— §8.1 禁止硬编码/任意色值）
                if ($id === 'cap_cards') {
                    $tones = ['brand', 'success', 'warning'];
                    foreach ($rows as $i => $ignore) {
                        $rows[$i]['tone'] = $tones[$i % 3];
                    }
                }
            }
            $merged[$id] = $rows;
        }
        return $merged;
    }
}

if (!function_exists('cra1_prod_service_heads')) {

    /**
     * 产品页「计费与服务」表格的表头（13 个产品页列名各不相同，
     * 如 cloud=项目/适用方式/说明，domain=服务项/包含内容/注意事项）。
     * 行格式「页面|列1|列2|列3」；缺行时模板保留原文。
     */
    /**
     * 产品页底部行动区的主按钮（页面|按钮文字|链接）。
     * 副按钮走既有的 cta_copy['btn_*'] 机制；此处只补主按钮，缺行时模板保留原文。
     */
    function cra1_prod_cta_btn($pageKey, array $merged)
    {
        $merged['prod_cta_btn1'] = ['text' => '', 'url' => ''];
        foreach (cra1_page_copy_lines((string) ($merged['prod_cta_btn1_text'] ?? ''), $pageKey) as $line) {
            list($hidden, $line) = cra1_line_hidden($line);
            if ($hidden || trim($line) === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            if (!cra1_row_targets_page((string) ($p[0] ?? ''), $pageKey)) {
                continue;
            }
            $merged['prod_cta_btn1'] = [
                'text' => (string) ($p[1] ?? ''),
                'url'  => cra1_url_ok((string) ($p[2] ?? '')) ? (string) ($p[2] ?? '') : '',
            ];
            break;
        }
        return $merged;
    }

    function cra1_prod_service_heads($pageKey, array $merged)
    {
        $merged['prod_service_heads'] = [];
        foreach (cra1_page_copy_lines((string) ($merged['prod_service_heads_text'] ?? ''), $pageKey) as $line) {
            list($hidden, $line) = cra1_line_hidden($line);
            if ($hidden || trim($line) === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            if (!cra1_row_targets_page((string) ($p[0] ?? ''), $pageKey)) {
                continue;
            }
            $merged['prod_service_heads'] = [
                (string) ($p[1] ?? ''),
                (string) ($p[2] ?? ''),
                (string) ($p[3] ?? ''),
            ];
            break;
        }
        return $merged;
    }
}

if (!function_exists('cra1_extra_copy_modules')) {

    /**
     * 需要按模块配置文案的模块清单（唯一真相，供解析与验收共用）。
     *
     * 由 defaults 里的 `copy_<模块>_text` 字段**自动推导**——新增一个模块的文案配置时
     * 只需在 defaults 加字段，不必再来这里登记（避免两处清单不同步：
     * 曾因手工清单漏登记 news/solutions 等模块，导致后台改了不生效）。
     */
    function cra1_extra_copy_modules()
    {
        static $mods = null;
        if ($mods !== null) {
            return $mods;
        }
        $mods = [];
        $defaults = class_exists(\template\cra1\controller\Cra1::class)
            ? \template\cra1\controller\Cra1::defaults()
            : [];
        foreach (array_keys($defaults) as $k) {
            if (strpos((string) $k, 'copy_') === 0 && substr((string) $k, -5) === '_text') {
                $mid = substr((string) $k, 5, -5);
                if ($mid !== '') {
                    $mods[$mid] = $mid;
                }
            }
        }
        return $mods;
    }
}

if (!function_exists('cra1_shared_module_visible')) {
    /** 与后台共用决议：页面覆盖、公共默认、兼容旧显式值和旧规则。 */
    function cra1_shared_module_visible($moduleId, $pageKey, $cra1)
    {
        return cra1_module_visible($moduleId, $pageKey, $cra1);
    }
}

if (!function_exists('cra1_shared_page_meta')) {

    /**
     * 页面专属的模块标题/右上链接（v2.43）：`<模块>_<页面>_title` / `_more_text` / `_link`。
     * 与 cra1_shared_page_keys 同一白名单；三者都为空时返回 null（回退共用键）。
     */
    function cra1_shared_page_meta($moduleId, $pageKey, $cra1)
    {
        static $pageSplit = ['link_tiles' => 1, 'price_slider' => 1];
        if (!isset($pageSplit[$moduleId]) || $pageKey === '') {
            return null;
        }
        $base = $moduleId . '_' . str_replace(['/', '-'], '_', $pageKey);
        $out = [];
        foreach (['title', 'more_text', 'link'] as $suffix) {
            $k = $base . '_' . $suffix;
            $v = isset($cra1[$k]) ? trim((string) $cra1[$k]) : '';
            if ($v !== '') {
                $out[$suffix] = $v;
            }
        }
        return $out ?: null;
    }
}

if (!function_exists('cra1_shared_page_keys')) {

    /**
     * 页面专属 rows 键（v2.43）：某模块在某页是否有独立配置字段。
     *
     * 背景：`link_tiles`（磁贴墙）与 `price_slider`（价格条）的条目在各页**语义完全不同**
     * （首页是产品入口、资讯页是关联入口、产品页是各自的规格档位）。早期用一条
     * `*_rows_text` + 行首「页面」列承载，出现两个问题：① 后台入口位于「首页配置」，
     * 使用者以为只在首页生效；② `*`（全部页面）行会把首页专属内容渲染到其他页
     * （实测新闻页磁贴 15 项 = 12 个产品 + 3 个本页入口）。
     *
     * 现在这两类模块为每页提供独立字段 `<模块>_<页面>_text`（行内不再需要「页面」列）；
     * 本函数按当前页返回该字段的原始文本，未配置时返回 null 表示「回退共用键」。
     */
    function cra1_shared_page_keys($moduleId, $pageKey, $cra1)
    {
        if (in_array($moduleId . '_rows_text', $cra1['_page_explicit_fields'] ?? [], true)) return (string)($cra1[$moduleId . '_rows_text'] ?? '');
        // 白名单：只有「各页语义不同」的模块才按页拆字段
        static $pageSplit = ['link_tiles' => 1, 'price_slider' => 1];
        if (!isset($pageSplit[$moduleId]) || $pageKey === '') {
            return null;
        }
        $key = $moduleId . '_' . str_replace(['/', '-'], '_', $pageKey) . '_text';
        if (!isset($cra1[$key]) || trim((string) $cra1[$key]) === '') {
            return null;   // 无专属配置 → 回退共用键（历史配置仍可用）
        }
        // 页面归属列：专属键内联的行不含页面列，但解析器需要第 1 列即名称。
        // 这里给每行补上当前页标识，复用同一套解析器（避免两套解析逻辑分叉）。
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $cra1[$key]) as $line) {
            if (trim($line) === '') {
                continue;
            }
            // The hidden prefix belongs to the whole row, before its page.
            // Putting it after the page turns a hidden item into a visible name.
            list($hidden, $content) = cra1_line_hidden($line);
            $out[] = ($hidden ? '!' : '') . $pageKey . '|' . $content;
        }
        return implode("\n", $out);
    }
}

if (!function_exists('cra1_shared_rows_for_page')) {

    /**
     * 取某共享模块在指定页面下的行数据（按行首「页面」列过滤）。
     *
     * 为什么在渲染时过滤而不是配置解析时：配置是**全站一份**，
     * 同一布局要在不同页面呈现各自的内容，只有渲染时才知道当前页 key。
     * 过滤结果按「模块 ID + 页面」缓存在内存，同页多个模块不重复解析。
     */
    function cra1_shared_rows_for_page($moduleId, $pageKey, $cra1)
    {
        static $cache = [];
        $ck = $moduleId . '@' . $pageKey . '@' . md5(json_encode($cra1));
        if (isset($cache[$ck])) {
            return $cache[$ck];
        }
        $types = cra1_shared_module_keys();
        if (!isset($types[$moduleId])) {
            return $cache[$ck] = [];
        }
        // 原始 rows 文本优先：**按模块类型选解析器**再按页过滤。
        // 不能直接复用配置解析阶段的 $cra1[$id.'_rows']——那里统一走了 link 型解析器，
        // 纯文字型模块（时间轴/对照表）的第 4 列会被丢成空值（年份显示不出来的真实事故）。
        // 【v2.43 页面专属键优先】link_tiles / price_slider 这类「各页内容语义完全不同」的模块，
        // 每页有独立字段（如 link_tiles_news_text），读它可避免「首页专属行污染其他页」，
        // 也让后台能把入口放在对应页面的设置项里。专属键为空时回退共用的 *_rows_text（旧配置兼容）。
        $pageKeyed = cra1_shared_page_keys($moduleId, $pageKey, $cra1);
        $raw = '';
        if ($pageKeyed !== null) {
            $raw = $pageKeyed;
        } elseif (isset($cra1[$moduleId . '_rows_text'])) {
            $raw = (string) $cra1[$moduleId . '_rows_text'];
        }
        // 按页标题/右上链接：同样只在「有专属配置」时覆盖（否则沿用共用键）
        $pageMeta = cra1_shared_page_meta($moduleId, $pageKey, $cra1);
        if ($pageMeta !== null) {
            $GLOBALS['__cra1_page_meta'][$moduleId] = $pageMeta;
        }
        $raw = cra1_presentation_rows((string)$moduleId, (string)$pageKey, (string)$raw, $cra1);
        if ($types[$moduleId] === 'text') {
            $rows = cra1_parse_shared_text_rows($raw, $pageKey);
        } else {
            $rows = cra1_parse_shared_rows($raw, $pageKey);
        }
        // 图标 → 本地缓存 URL（与配置解析同一套规则）
        foreach ($rows as $i => $row) {
            if (isset($row['icon']) && $row['icon'] !== '') {
                $u = cra1_icon_url($row['icon'], 40, '#1769e0');
                $rows[$i]['icon_img'] = $u;
                $rows[$i]['icon_png'] = cra1_icon_is_png($u) ? 1 : 0;
            } else {
                $rows[$i]['icon_img'] = '';
                $rows[$i]['icon_png'] = 0;
            }
            $art=isset($row['icon'])?cra1_icon_art($row['icon']):'';
            $rows[$i]['icon_tile']=$art!==''?'<span class="cui-business-icon cui-business-icon--tile cui-configured-icon" data-cra1-icon-label="'.htmlspecialchars($row['name'],ENT_QUOTES,'UTF-8').'" '.($row['icon_style_attrs']??'').'>'.$art.'</span>':'';
            if (!isset($rows[$i]['text'])) {
                $rows[$i]['text'] = isset($row['value']) ? $row['value'] : '';
            }
        }
        return $cache[$ck] = $rows;
    }
}

if (!function_exists('cra1_parse_menu')) {

    /** 名称|链接|简介|新窗口|图标|数据来源|左侧内容；最后一列是 URI 编码的 JSON。 */
    function cra1_parse_menu($text)
    {
        $out = [];
        $path = [];
        foreach (preg_split('/\r?\n/', (string)$text) as $line) {
            list($hidden, $line) = cra1_line_hidden($line);
            if ($line === '') continue;
            $level = 1;
            while (isset($line[0]) && $line[0] === '>') {
                $level++;
                $line = trim(substr($line, 1));
            }
            // Reset the branch before validating: hidden/invalid parents must not attach
            // their descendants to the previous visible sibling. Do not flatten >4 levels.
            $path = array_slice($path, 0, $level - 1);
            $p = cra1_icon_row_parts($line)['parts'];
            $url = $p[1] ?? '';
            if ($hidden || $level > 4 || ($p[0] ?? '') === '' || !cra1_url_ok($url)) continue;
            if ($level > 1 && count($path) !== $level - 1) continue;
            $icon = $p[4] ?? '';
            $svg = isset(cra1_builtin_icons()[$icon]) ? cra1_builtin_icon_body($icon) : '';
            $item = [
                'name' => $p[0], 'file_address' => $url, 'description' => $p[2] ?? '',
                'blank' => ($p[3] ?? '') === '1' ? 1 : 0,
                'children' => [], 'level' => $level, 'icon' => $icon,
                'icon_svg' => $svg,
                'icon_art'=>cra1_icon_art($icon),
                'icon_style_attrs'=>cra1_icon_row_attrs($line),
                'icon_img' => $svg === '' && $icon !== '' ? cra1_icon_url($icon, 24) : '',
                'source' => $level === 1 && ($p[5] ?? '') === 'cart' ? 'cart' : '',
                'sidebar_raw' => $level === 1 ? ($p[6] ?? '') : '',
            ];
            $branch =& $out;
            foreach ($path as $index) $branch =& $branch[$index]['children'];
            $branch[] = $item;
            $path[] = count($branch) - 1;
            unset($branch);
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_nodes')) {

    /** 解析节点多行文本：名称|经度|纬度 或 名称|地区|经度|纬度|是否显示；换算等距投影百分比坐标 */
    /**
     * 解析节点行，支持新旧格式（向后兼容）：
     *   旧：名称|经度|纬度
     *   旧：名称|地区|经度|纬度
     *   新：地区|经度|纬度|详情|节点数|机房数|线路标签…（线路标签可多段，展示在面板底部）
     *
     * 识别策略：**首个「连续两个数字」的位置即经纬度**。
     *   经纬度必然是相邻的两个数字，而地区名/详情文案不会是纯数字，
     *   因此该策略对「地区可省略、详情可省略、新旧混用」都成立，无需按字段数猜测。
     * 行首加 `!` 表示隐藏（与全站其它多行字段一致）。
     */
    function cra1_parse_nodes($text)
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || $line === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            $count = count($p);
            if ($count < 3 || $p[0] === '') {
                continue;
            }
            // 找首个「连续两个数字」= 经纬度
            $at = -1;
            for ($i = 0; $i + 1 < $count; $i++) {
                if (is_numeric($p[$i]) && is_numeric($p[$i + 1])) {
                    $at = $i;
                    break;
                }
            }
            if ($at < 1) {
                continue;   // 未找到，或经纬度出现在首位（缺少地区名）
            }
            $lng = max(-180, min(180, floatval($p[$at])));
            $lat = max(-85, min(85, floatval($p[$at + 1])));
            // 经纬度之前：首段为地区名，其余并入地区（兼容旧的「名称|地区」双段写法）
            $name = $p[0];
            $region = $at > 1 ? implode(' · ', array_slice($p, 1, $at - 1)) : '';
            // 经纬度之后：详情、节点数、机房数（均可省略）
            $detail = ($at + 2 < $count) ? $p[$at + 2] : '';
            $nodesNum = ($at + 3 < $count && is_numeric($p[$at + 3])) ? intval($p[$at + 3]) : null;
            $racksNum = ($at + 4 < $count && is_numeric($p[$at + 4])) ? intval($p[$at + 4]) : null;
            // 第 7 段起：标签。chips 控件写入的是**英文逗号分隔**（如「CN2 线路,精品线路」），
            // 同时兼容历史上按 | 或 / 分隔的写法——三者都拆开，保证新旧数据都能正确读出多个标签。
            $linesRaw = ($at + 5 < $count) ? array_slice($p, $at + 5) : [];
            $lineTags = [];
            foreach ($linesRaw as $__lt) {
                foreach (preg_split('/[,，、\/]/u', (string) $__lt) as $__one) {
                    $__one = trim($__one);
                    if ($__one !== '') {
                        $lineTags[] = $__one;
                    }
                }
            }
            $out[] = [
                'name'    => $name,
                'region'  => $region,
                'lng'     => $lng,
                'lat'     => $lat,
                'left'    => round(($lng + 180) / 360 * 100, 3),
                'top'     => round((90 - $lat) / 180 * 100, 3),
                'detail'  => $detail,
                'nodes'   => $nodesNum,
                'racks'   => $racksNum,
                'lines'   => $lineTags,
                // 是否值得渲染悬停面板（任一段非空即可）
                'summary' => $detail !== '' || $nodesNum !== null || $racksNum !== null || count($lineTags) > 0,
            ];
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_home_products')) {

    /**
     * 解析「指定商品」（v2.33 起为树形：二级分组 + 商品）。
     *
     * 行格式（后台树形 rows 写入，`>` 前缀表达层级，与菜单导航同一约定）：
     *   分组名|              → 分组行（id 空）：仅作归类，前台用于分组筛选
     *   >商品名|商品ID|标签|描述 → 商品行：挂在上一个分组下
     *   商品名|商品ID|标签|描述  → 无分组前缀的商品（顶层，前台归入「全部产品」）
     *
     * 第 4 列「描述」是**本模块专用**的展示描述（留空则前台回退用 v10 商品描述），
     * 只随本模块配置存储，不会写回 v10 商品资料。
     *
     * 向后兼容旧格式 `商品ID|排序|标签`：第一段是纯数字即按旧格式解析，
     * 此时没有分组概念，行为与改造前完全一致；旧格式行不读第 4 列
     * （历史数据那里的 0/1 是标志位，不是描述）。
     *
     * 返回：[{ id, tag, group, desc }]，顺序即后台拖拽后的顺序。
     */
    function cra1_parse_home_products($text)
    {
        $out = [];
        $group = '';
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || trim($line) === '') {
                continue;
            }
            // 层级：前缀 > 的个数（本结构只用到 0/1，多写几个也容忍）
            $level = 0;
            while (isset($line[$level]) && $line[$level] === '>') {
                $level++;
            }
            $line = trim(substr($line, $level));
            $p = cra1_icon_row_parts($line)['parts'];
            $name = (string) ($p[0] ?? '');
            $second = (string) ($p[1] ?? '');
            $third = (string) ($p[2] ?? '');
            $fourth = (string) ($p[3] ?? '');

            // 商品 ID 出现在哪一列，决定新/旧格式：
            //   新格式（树形 rows）：名称|商品ID|标签   → ID 在第 2 列
            //   旧格式（历史遗留）：商品ID|排序|标签   → ID 在第 1 列、第 2 列是排序号
            //
            // 两列都可能是数字，不能只看「是不是数字」。区分依据：
            //   **第 2 列若大于第 1 列，说明第 2 列更像排序号**（旧格式的排序从 1 起，
            //   而商品 ID 通常大于排序号）——但这仍不够稳。
            // 因此这里改用更确定的规则：**旧格式必须第 2 列是 1..N 的连续序号**，
            // 且第 1 列是商品 ID。鉴于新格式的名称列通常是商品名（非纯数字），
            // 此处只在「第 2 列是纯数字 且 第 1 列也是纯数字」时按旧格式处理，
            // 否则按新格式。真实数据里新格式的名称列不会是纯数字（是商品名），
            // 唯一例外是用户手工把名称填成数字——这种情况按旧格式解释更安全。
            $bothNumeric = $name !== '' && $second !== '' && ctype_digit($name) && ctype_digit($second);
            $idCol = $bothNumeric ? 0 : ($second !== '' && ctype_digit($second) ? 1 : -1);

            if ($idCol === 0) {
                // 旧格式：没有分组概念，也没有描述列（第 4 位是历史标志位）
                $out[] = ['id' => intval($name), 'tag' => $third, 'group' => '', 'desc' => ''];
                continue;
            }
            if ($idCol === -1) {
                // 两列都不是数字 → 分组行（名称在第 1 列，第 2 列留空）
                if ($level === 0) {
                    $group = $name;
                }
                continue;
            }

            // 新格式的商品行：ID 在第 2 列
            $out[] = [
                'id'    => intval($second),
                'tag'   => $third,
                'group' => $level > 0 ? $group : '',
                'desc'  => $fourth,
            ];
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_home_products_groups')) {

    /** 从「指定商品」文本里提取分组顺序（前台筛选条按此渲染） */
    function cra1_parse_home_products_groups($text)
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || trim($line) === '') {
                continue;
            }
            if (isset($line[0]) && $line[0] === '>') {
                continue; // 商品行
            }
            $p = cra1_icon_row_parts($line)['parts'];
            $name = (string) ($p[0] ?? '');
            $second = (string) ($p[1] ?? '');
            // 分组行：两列都不是纯数字（与 cra1_parse_home_products 同一判据）
            if ($name !== '' && !ctype_digit($second) && !ctype_digit($name)) {
                $out[] = $name;
            }
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_pairs')) {

    /** 解析两段式多行文本：名称|链接 */
    function cra1_parse_pairs($text)
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || $line === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            if (!isset($p[0]) || $p[0] === '') {
                continue;
            }
            $url = isset($p[1]) ? $p[1] : '';
            if (!cra1_url_ok($url)) {
                continue;
            }
            $out[] = [
                'name' => $p[0],
                'url'  => $url,
            ];
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_slides')) {

    /** 解析轮播多行文本：图片或视频地址|链接|标题|描述|按钮文字|按钮链接（后四段可省略） */
    function cra1_parse_slides($text)
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || $line === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            if (!isset($p[0]) || $p[0] === '') {
                continue;
            }
            $url = isset($p[1]) ? $p[1] : '';
            $btnUrl = isset($p[5]) ? $p[5] : '';
            if (!cra1_url_ok($url) || !cra1_url_ok($btnUrl)) {
                continue;
            }
            $out[] = [
                'img'     => $p[0],
                'url'     => $url,
                'title'   => isset($p[2]) ? $p[2] : '',
                'desc'    => isset($p[3]) ? $p[3] : '',
                'btn'     => isset($p[4]) ? $p[4] : '',
                'btn_url' => $btnUrl,
            ];
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_float_items')) {

    /** 解析悬浮按钮多行文本：名称|链接|图标（图标可选：kefu/phone/qq/wechat，缺省为通用链接图标） */
    function cra1_parse_float_items($text)
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || $line === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            if (!isset($p[0]) || $p[0] === '') {
                continue;
            }
            $url = isset($p[1]) ? $p[1] : '';
            if (!cra1_url_ok($url)) {
                continue;
            }
            $out[] = [
                'name' => $p[0],
                'url'  => $url,
                'icon' => isset($p[2]) && $p[2] !== '' ? $p[2] : 'link',
                'icon_style'=>cra1_icon_row_style($line),
            ];
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_menu_lines')) {

    /** 解析多行菜单文本：名称|简介|链接 */
    function cra1_parse_menu_lines($text)
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || $line === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            $out[] = [
                'name' => isset($p[0]) ? $p[0] : '',
                'desc' => isset($p[1]) ? $p[1] : '',
                'url'  => isset($p[2]) ? $p[2] : '',
                'icon_style_attrs'=>cra1_icon_row_attrs($line),
            ];
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_shared_rows')) {

    /**
     * 共享布局模块的行数据解析（唯一入口，供 sections/_shared/* 的 18 个布局复用）。
     *
     * 行格式：`页面|名称|描述|链接|图标|标签|数值`
     *   - 页面：该行在哪些页面展示。`*` = 全部页面；多个页面用 `,` 分隔（如 `home,about`）
     *   - 名称：必填；其余可留空
     *   - 链接：可留空。**留空或不是合法链接时按空处理，不丢弃整行**——
     *     数据带 / 时间轴 / 对照表这类布局本就不需要链接，早期版本因强制校验导致整行被丢
     *   - 图标：内置键（shield/bolt/globe/…）或 iconify:/icons8: 代码，可留空
     *   - 标签：胶囊文字（如「推荐」「热门」），可留空
     *   - 数值：用于数据带/统计类布局的大号数字，可留空
     *
     * 一个布局模板服务多页时，各页只取自己的行——这是「同一套布局不重复建 41 份模板」
     * 的关键，同时内容仍全部可在后台按条维护（§4 融合为一条设置）。
     *
     * @param string $text    原始 rows 文本
     * @param string $pageKey 当前页面 key（空则不过滤，返回全部行）
     */
    function cra1_parse_shared_rows($text, $pageKey = '')
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || $line === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            if (!isset($p[1]) || $p[1] === '') {
                continue; // 第 0 列是页面归属，名称在第 1 列；无名称的行视为空行
            }
            $pages = array_values(array_filter(array_map('trim', preg_split('/[,，\s]+/u', (string) $p[0]))));
            // 页面过滤：'*' 命中全部；未填页面列视为命中全部（单页使用时不必写页面列）
            if ($pageKey !== '' && $pages && !in_array('*', $pages, true) && !in_array($pageKey, $pages, true)) {
                continue;
            }
            $url = isset($p[3]) ? trim((string) $p[3]) : '';
            if (!cra1_url_ok($url)) {
                $url = ''; // 非法链接按空处理，保留该行（布局侧无链接时渲染为纯文本）
            }
            $out[] = [
                'name'  => (string) $p[1],
                'desc'  => isset($p[2]) ? (string) $p[2] : '',
                'url'   => $url,
                'icon'  => isset($p[4]) ? (string) $p[4] : '',
                'icon_style_attrs'=>cra1_icon_row_attrs($line),
                'tag'   => isset($p[5]) ? (string) $p[5] : '',
                'value' => isset($p[6]) ? (string) $p[6] : '',
            ];
        }
        return $out;
    }
}

if (!function_exists('cra1_parse_shared_text_rows')) {

    /**
     * 共享布局里「纯文字型」模块的行解析：`页面|名称|描述|补充`
     * 用于时间轴（补充=年份）/ 对照表（补充=备注）/ 引用语等**不需要链接**的布局。
     * 第 4 列映射为 `value`（模板统一引用 value），`text` 作为同义别名保留。
     */
    function cra1_parse_shared_text_rows($text, $pageKey = '')
    {
        $out = [];
        foreach (preg_split('/\r?\n/', (string) $text) as $line) {
            list($__hidden, $line) = cra1_line_hidden($line);
            if ($__hidden || $line === '') {
                continue;
            }
            $p = cra1_icon_row_parts($line)['parts'];
            if (!isset($p[1]) || $p[1] === '') {
                continue;
            }
            $pages = array_values(array_filter(array_map('trim', preg_split('/[,，\s]+/u', (string) $p[0]))));
            if ($pageKey !== '' && $pages && !in_array('*', $pages, true) && !in_array($pageKey, $pages, true)) {
                continue;
            }
            $extra = isset($p[3]) ? (string) $p[3] : '';
            $out[] = [
                'name'  => (string) $p[1],
                'desc'  => isset($p[2]) ? (string) $p[2] : '',
                'value' => $extra,
                'text'  => $extra,
                'tag'   => isset($p[4]) ? (string) $p[4] : '',
                'url'   => '',
                'icon'  => '',
            ];
        }
        return $out;
    }
}

// A validated standalone preview consumes the resolvers above, without native
// hook registration or a native HTTP application/container.
if(defined('CRA1_THEME_PREVIEW_DISPLAY_ONLY')&&CRA1_THEME_PREVIEW_DISPLAY_ONLY===true)return;

// 前台官网页面注入主题配置（{$data.cra1.xxx}，defaults 已兜底）；
// 酷锐A1主题下同时用独立管理台菜单覆盖 header_nav，其他主题返回空不影响原生数据。

/**
 * SEO 标题/描述/关键词：覆盖系统默认（系统先用 SeoModel 查表，钩子在之后执行，因此本钩子优先）。
 * tpl_name 为模板名（index → home）；详情页标题由前端按动态数据覆盖，这里给出服务端兜底值。
 */
/* SEO files are generated only by a controlled save or CLI maintenance. */

add_hook('web_seo_custom', function ($param) {
    if (!\CRA1\Theme\Context::isCRA1((string)($param['theme'] ?? (function_exists('configuration') ? configuration('web_theme') : '')))) return [];
    $tplName = isset($param['tpl_name']) ? (string) $param['tpl_name'] : '';
    if ($tplName === '' || !function_exists('cra1_seo_resolve_page')) {
        return [];
    }
    $pageKey = $tplName === 'index' ? 'home' : $tplName;
    $reg = cra1_seo_registry();
    $config = cra1_theme_config();
    if (!isset($reg[$pageKey])) {
        /* 未登记页（如 /not-exist-page.html）：
           路由 Route::get('[:html]','home/view/index') 会兜住任意 *.html 路径，
           系统随后降级到 default 主题渲染 404 片段，而该片段不带 <title>，
           实测浏览器标签是空的。这里按 404 语义给出标题与描述，
           让不存在的地址也有正确标题（§12「页面未找到」）。
           注意不返回 noindex 之外的 robots 控制——robots 由 theme 侧统一输出。 */
        $seo = cra1_seo_resolve_page('404', $config);
        $out = [];
        if (!empty($seo['titleFull'])) {
            $out['title'] = $seo['titleFull'];
        }
        if (!empty($seo['description'])) {
            $out['description'] = $seo['description'];
        }
        if (!empty($seo['keywords'])) {
            $out['keywords'] = $seo['keywords'];
        }
        return $out;
    }
    $seo = cra1_seo_resolve_page($pageKey, $config);
    $out = [];
    if (!empty($seo['titleFull'])) {
        $out['title'] = $seo['titleFull'];
    }
    if (!empty($seo['description'])) {
        $out['description'] = $seo['description'];
    }
    if (!empty($seo['keywords'])) {
        $out['keywords'] = $seo['keywords'];
    }
    return $out;
});

add_hook('web_data_custom', function ($param) {
    // Native V10 passes tpl_name/url here, without a theme parameter.
    $theme = (string)($param['theme'] ?? (function_exists('configuration') ? configuration('web_theme') : ''));
    if (!\CRA1\Theme\Context::isCRA1(strtolower($theme))) {
        return [];
    }
    $config = cra1_theme_config();
    $data = ['cra1' => cra1_extra_module_copy('public', $config)];
    if (!empty($config['cloud_menu']) || cra1_content_explicit($config, 'cloud_menu_text')) {
        $data['header_nav'] = $config['cloud_menu'];
    }
    // 页面模块顺序：tplName → pageKey → 归一化顺序；统一注入 page_modules_html（始终存在，缺失即 Bug）
    $tplName = isset($param['tpl_name']) ? (string) $param['tpl_name'] : '';
    if ($tplName !== '') {
        $pageKey = $tplName === 'index' ? 'home' : $tplName;
        $config = cra1_page_content_config((string)$pageKey, $config);
        $data['cra1'] = cra1_extra_module_copy($pageKey, $config);
        $data['page_modules'] = cra1_page_module_order($pageKey);
        $data['page_key'] = $pageKey;
        // 完整 $data 上下文透传（core_* 模块消费 $data.config / $data.url 等）
        $moduleData=$data;
        $moduleData['config']=cra1_system_display_config();
        $moduleData['url']=$param['url']??'';
        $data['cra1']['page_modules_html'] = cra1_render_page_modules($pageKey, $config, $moduleData);
        // 页面页首（page-hero）：主模板（*.html 的 page-hero 区）也走配置驱动，
        // 必须注入到主模板的 $data.cra1（render_page_modules 里的解析只作用于模块子模板）
        $data['cra1'] = cra1_page_hero_resolve($pageKey, $data['cra1']);
        $data['cra1'] = cra1_home_cards_resolve($pageKey, $data['cra1']);
        // SEO 元信息：title/description/keywords/canonical/OG/JSON-LD 供 web_view_append 使用
        if (function_exists('cra1_seo_resolve_page')) {
            $data['cra1']['seo'] = cra1_seo_resolve_page($pageKey, $config);
            $data['cra1']['seo']['pageKey'] = $pageKey;
        }
    }
    return ['data' => $data];
});

/**
 * SEO 头部注入：canonical / robots / OG / Twitter / JSON-LD。
 * 通过 web_view_append 在 </head> 前插入（系统只允许追加，不改模板渲染）。
 * title/description/keywords 由模板 header.html 输出（系统已注入 $title/$keywords/$description）。
 */
add_hook('web_view_append', function ($param) {
    $theme = (string)($param['themes'] ?? '');
    if (!\CRA1\Theme\Context::isCRA1($theme)) {
        return [];
    }
    $config = cra1_theme_config();
    $tplName = isset($param['view_html']) ? (string) $param['view_html'] : '';
    $pageKey = $tplName === 'index' ? 'home' : $tplName;
    if (!function_exists('cra1_seo_resolve_page')) {
        return [];
    }
    $seo = cra1_seo_resolve_page($pageKey, $config);
    $esc = function ($s) {
        return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
    };
    // canonical：优先当前请求路径（去掉 query），详情页使用带 id 的完整地址
    $path = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    // canonical 只保留语义参数（详情页 id / 搜索 keyword / 分页 page），丢弃缓存与测试参数
    $pathOnly = strtok($path, '?');
    $keep = [];
    $qs = parse_url($path, PHP_URL_QUERY);
    if (is_string($qs) && $qs !== '') {
        parse_str($qs, $params);
        foreach (['id', 'keyword', 'page'] as $k) {
            if (isset($params[$k]) && $params[$k] !== '') {
                $keep[$k] = $params[$k];
            }
        }
    }
    $path = (string) $pathOnly . ($keep ? '?' . http_build_query($keep) : '');
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : '';
    $originFile=dirname(__DIR__,4).'/runtime/cra1_theme/site_origin.json';$originDoc=is_file($originFile)?json_decode((string)file_get_contents($originFile),true):[];
    $canonical = !empty($originDoc['canonical_url']) ? rtrim((string)$originDoc['canonical_url'],'/').$path : '';
    $head = '';
    $nl = "\n";
    if ($canonical !== '') {
        $head .= $nl . '<link rel="canonical" href="' . $esc($canonical) . '">';
    }
    // robots：404 页与后台显式 noindex 的页面不收录
    if (!empty($seo['noindex'])) {
        $head .= $nl . '<meta name="robots" content="noindex,follow">';
    } else {
        $head .= $nl . '<meta name="robots" content="index,follow">';
    }
    // OG / Twitter
    $titleFull = (string) ($seo['titleFull'] ?? '');
    $desc = (string) ($seo['description'] ?? '');
    $head .= $nl . '<meta property="og:type" content="website">';
    $head .= $nl . '<meta property="og:site_name" content="' . $esc($seo['siteName'] ?? '') . '">';
    $head .= $nl . '<meta property="og:title" content="' . $esc($titleFull) . '">';
    $head .= $nl . '<meta property="og:description" content="' . $esc($desc) . '">';
    if ($canonical !== '') {
        $head .= $nl . '<meta property="og:url" content="' . $esc($canonical) . '">';
    }
    $ogImage = trim((string) ($config['seo_og_image'] ?? ''));
    if ($ogImage === '') {
        $ogImage = function_exists('configuration') ? (string) configuration('website_logo') : '';
    }
    if ($ogImage !== '') {
        if (strpos($ogImage, 'http') !== 0 && $host !== '') {
            $ogImage = $scheme . '://' . $host . '/' . ltrim($ogImage, '/');
        }
        $head .= $nl . '<meta property="og:image" content="' . $esc($ogImage) . '">';
    }
    $head .= $nl . '<meta name="twitter:card" content="summary_large_image">';
    $head .= $nl . '<meta name="twitter:title" content="' . $esc($titleFull) . '">';
    $head .= $nl . '<meta name="twitter:description" content="' . $esc($desc) . '">';
    // JSON-LD：Organization（首页）+ WebPage（其他页）
    $siteName = (string) ($seo['siteName'] ?? '');
    $ld = ['@context' => 'https://schema.org'];
    if ($pageKey === 'home') {
        $ld['@type'] = 'Organization';
        $ld['name'] = $siteName;
        if ($canonical !== '') {
            $ld['url'] = $canonical;
        }
        if ($ogImage !== '') {
            $ld['logo'] = $ogImage;
        }
    } else {
        $ld['@type'] = 'WebPage';
        $ld['name'] = $titleFull;
        if ($canonical !== '') {
            $ld['url'] = $canonical;
        }
        if ($desc !== '') {
            $ld['description'] = $desc;
        }
        if ($siteName !== '') {
            $ld['isPartOf'] = ['@type' => 'WebSite', 'name' => $siteName];
        }
    }
    $head .= $nl . '<script type="application/ld+json">' . json_encode($ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>';
    return ['head' => $head];
});

/**
 * 会员中心页面标题修正。
 *
 * v10 系统对会员中心各页统一传 title='首页-智简魔方'
 * （app/home/controller/ViewClientController.php 的 index/plugin/module 三个入口），
 * 直接输出会让登录页、注册页、账户页的浏览器标签与搜索结果全都变成「首页」。
 * 该值由系统层给出、主题不得改系统（§9「v10 系统自身控制的设置项不得搬入主题后台」），
 * 因此主题在自己的钩子里按模板名改写 <title>。
 *
 * 钩子参数 view_html 即当前模板名（系统已传），用它查表；不在表内的模板保持系统标题不动，
 * 保证「修复已知页 + 不误伤未知页」。站点名取自系统配置，与前台其余页面一致。
 */
require_once __DIR__ . '/ThemeCode.php';
require_once __DIR__ . '/MemberSession.php';
add_hook('clientarea_view_append', function ($param) {
    return ['body' => cra1_member_session_fallback($param)];
});
add_hook('clientarea_view_append', function ($param) {
    $themes = cra1_member_shell_theme($param);
    // 仅接管 CRA1 主题（本条钩子对 default 等其它主题同样会被调用）
    if (!\CRA1\Theme\Context::isCRA1($themes)) {
        return [];
    }
    $tpl = isset($param['view_html']) ? (string) $param['view_html'] : '';
    if ($tpl === '') {
        return ['body'=>cra1_theme_code_html('member')];
    }
    $titles = [
        'home'           => '会员中心',
        'account'        => '账户信息',
        'finance'        => '财务信息',
        'recharge'       => '充值',
        'withdrawal'     => '申请提现',
        'transfer'       => '转账',
        'orderDetail'    => '订单详情',
        'cashier'        => '收银台',
        'product'        => '产品详情',
        'productList'    => '我的产品',
        'product_list'   => '我的产品',
        'productdetail'  => '产品详情',
        'security'       => '安全中心',
        'security_log'   => '操作日志',
        'security_ssh'   => 'SSH 密钥',
        'security_group' => '安全组',
        'newsView'       => '新闻详情',
        'agreement'      => '服务协议',
        'login'          => '登录',
        'regist'         => '注册',
        'forget'         => '找回密码',
        'oauth'          => '账号绑定',
        'template'       => '模板设置',
        'crossModule'    => '跳转中',
        '404'            => '页面未找到',
        'networkErro'    => '网络异常',
        'noPermissions'  => '无访问权限',
    ];
    if (!isset($titles[$tpl])) {
        return ['body'=>cra1_theme_code_html('member')];
    }
    $site = function_exists('configuration') ? trim((string) configuration('website_name')) : '';
    if ($site === '') {
        $site = '智简魔方v10业务系统';
    }
    $page = $titles[$tpl];
    $full = ($page === $site) ? $site : ($page . '-' . $site);

    // 用 JS 改写而不重新输出 <title>：正文里已经有一个 <title>，
    // 再插一个会形成两个标题标签（浏览器取第一个，且不符合规范）。
    //
    // 注入点选 body 而非 head —— 系统侧的实现是 str_replace('</head>', ...)，
    // 会把「所有」</head> 都替换掉；而会员中心的页面模板在 HTML 注释里写了
    // 「header.php 输出 <!DOCTYPE>/<head>，页面补 </head><body>」这类说明文字，
    // 注入到 head 会在注释里也塞进一份（实测页面出现两份该脚本）。body 无此问题。
    $js = '<script>(function(){try{var t=' . json_encode($full, JSON_UNESCAPED_UNICODE)
        . ';if(document.title!==t)document.title=t;}catch(e){}})();</script>';
    return ['body' => $js . cra1_theme_code_html('member')];
});

/**
 * 购物车页面标题修正（与会员中心同一问题、同一做法）。
 *
 * v10 对购物车各页同样统一传 title='首页-智简魔方'
 * （app/home/controller/ViewCartController.php 的 index），而购物车页复用
 * 会员中心的 header.php，于是「商品列表」「购物车」「结算」等页的浏览器标签
 * 全是「首页」。该值由系统层给出，主题不修改系统（§9），因此在本钩子里按模板名改写。
 *
 * 钩子参数 view_html 即当前模板名；未登记的模板保持系统标题不动。
 */
add_hook('cart_view_append', function ($param) {
    $theme = isset($param['cart_theme']) ? (string) $param['cart_theme'] : '';
    // 仅接管 CRA1 购物车主题（本钩子对其它购物车主题同样会被调用）
    if (!\CRA1\Theme\Context::isCRA1($theme)) {
        return [];
    }
    $tpl = isset($param['view_html']) ? (string) $param['view_html'] : '';
    if ($tpl === '') {
        return ['body'=>cra1_theme_code_html('cart')];
    }
    $titles = [
        'home'         => '订购产品',
        'goodsList'    => '商品列表',
        'goods'        => '产品详情',
        'goods_iframe' => '产品详情',
        'goods_embed'  => '产品详情',
        'shoppingCar'  => '购物车',
        'settlement'   => '订单结算',
        'orderResult'  => '订单结果',
        'index_iframe' => '订购产品',
    ];
    if (!isset($titles[$tpl])) {
        return ['body'=>cra1_theme_code_html('cart')];
    }
    $site = function_exists('configuration') ? trim((string) configuration('website_name')) : '';
    if ($site === '') {
        $site = '智简魔方v10业务系统';
    }
    $page = $titles[$tpl];
    $full = ($page === $site) ? $site : ($page . '-' . $site);
    // 注入点同样是 body：head 的 str_replace 会被模板注释里的 </head> 干扰（见上一条钩子说明）
    $js = '<script>(function(){try{var t=' . json_encode($full, JSON_UNESCAPED_UNICODE)
        . ';if(document.title!==t)document.title=t;}catch(e){}})();</script>';
    return ['body' => $js . cra1_theme_code_html('cart')];
});
