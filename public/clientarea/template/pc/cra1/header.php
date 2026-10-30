{php}
require_once IDCSMART_ROOT . 'public/cra1-shared/runtime.php';
$__cra1Page = basename((string)parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '.htm');
$__cra1Runtime = CRA1ThemeRuntime::load($__cra1Page);
{/php}
<!DOCTYPE html>
<html lang="zh-cn" data-cra1-theme="member" theme="{$clientarea_theme_color}" id="addons_js" addons_js='{:json_encode($addons)}'>

{php}
// 共享系统资产（vue/element/axios/common.css 等）与主题无关，且【不参与主题降级】：
// 系统只对 .php 模板做按文件降级，静态资源必须由主题目录自身提供。
$__shared = 'pc/default';
if (is_file(IDCSMART_ROOT . 'public/clientarea/template/' . $public_themes . '/utils/request.js')) {
    $__shared = $public_themes;
}
{/php}

<head>
    <script>window.__CRA1_PAYMENT_BASE__="{:cra1_theme_asset_url('native', '', '/clientarea/template/pc/cra1/releases/20261017-compat-v3')}";</script>
    <script>window.__CRA1_RUNTIME__ = {:json_encode($__cra1Runtime, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE)};</script>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no">
    <!-- 页面标题：v10 系统对会员中心与购物车各页统一传 '首页-智简魔方'
         （ViewClientController / ViewCartController），直接输出会导致「登录页也叫首页」。
         该值由系统层决定、主题不得改系统（§9），因此由主题的
         clientarea_view_append / cart_view_append 钩子按模板名改写成准确标题
         （见 web/cra1/controller/hooks.php）。 -->
    <title>{$title|default=''}</title>
    <meta name="description" content="{$description|default=''}智简魔方v10业务系统会员中心">
    <link rel="icon" href="/favicon.ico">
    <script>
    // 页面标题: 侧栏当前项 / 顶部面包屑 + 站点名(动态兜底)
    (function () {
      // 站点名提到闭包作用域：applyTitle() 与下面的 setInterval 都要读它。
      // 原先写在 applyTitle() 内部，而 setInterval 回调在函数外引用 site，
      // 每秒抛一次 ReferenceError（r68/r69 的「零 pageerror」断言据此暴露）。
      var site = '智简魔方v10业务系统';
      function applyTitle() {
        var name = '';
        var active = document.querySelector('.el-menu-item.is-active, [class*="menu-item"][class*="active"], .cra1-shell .aside-menu .is-active');
        if (active) {
          name = (active.getAttribute('title') || active.innerText || '').trim().split('\n')[0];
        }
        if (!name) {
          var crumbs = document.querySelectorAll('[class*="breadcrumb"] span, [class*="breadcrumb"] a, [class*="breadcrumb"] div');
          for (var i = crumbs.length - 1; i >= 0; i--) {
            var t = (crumbs[i].innerText || '').trim();
            if (t && t !== '/' && t !== '控制台') { name = t; break; }
          }
        }
        document.title = (name ? name + ' - ' : '') + site;
      }
      var timer = setInterval(function () {
        if (!document.title || document.title === site) applyTitle();
      }, 1000);
      setTimeout(function () { clearInterval(timer); }, 8000);
    })();
  </script>
    <!-- 公共 -->
    <script>
        // 全局 url 被 theme/index.js（配色主题 CSS）与 lang/index.js（语言包）用于拼接资源路径，
        // 这两个文件都属于共享系统资产、不在本主题目录内，因此 url 必须指向共享目录。
        const url = "/{$template_catalog}/template/{$__shared}/"
        const system_version = "{$system_version}"
        window.__LANG_CONFIG__ = {
            lang_home: "{$lang_home}",
            lang_home_follow_browser: {$lang_home_follow_browser},
            lang_home_open: {$lang_home_open}
        };
    </script>

    <!-- 模板样式 -->
    <link rel="stylesheet" href="/{$template_catalog}/template/{$__shared}/css/common/reset.css?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/css/common/reset.css')}">

    <script src="/{$template_catalog}/template/{$__shared}/theme/index.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/theme/index.js')}"></script>

    <link rel="stylesheet" href="/{$template_catalog}/template/{$__shared}/css/common/common.css?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/css/common/common.css')}">
    <link rel="stylesheet" href="/upload/common/iconfont/iconfont.css">

    <!-- 酷锐A1主题外壳样式（主题自有资源，必须用 $public_themes：
         插件页会把 $themes 降级为 pc/default，而主题壳始终由 $public_themes 指向本主题） -->
    <link rel="stylesheet" href="{:cra1_theme_asset_url('member', '20261012-nav-auth-v1/css/cra1-shell.css', '/clientarea/template/pc/cra1/releases/20261012-nav-auth-v1/css/cra1-shell.css')}">
    <!-- 顶栏用户块/用户面板：官网与会员中心共用的一套样式（web/cra1 主题内单点维护） -->

    <!-- 三端共用组件：只加载一次，位于独立主题代码之前。 -->
    <link rel="stylesheet" href="{:cra1_theme_asset_url('shared', 'cra1-shared.css', '/cra1-shared/releases/20261017-member-auth-v2/cra1-shared.css')}">
    <script src="{:cra1_theme_asset_url('shared', 'cra1-shared.js', '/cra1-shared/releases/20261017-member-auth-v2/cra1-shared.js')}"></script>
    <script src="/{$template_catalog}/template/{$__shared}/js/common/vue.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/js/common/vue.js')}"></script>
    <script src="/{$template_catalog}/template/{$__shared}/js/common/element.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/js/common/element.js')}"></script>


    <script src="/{$template_catalog}/template/{$__shared}/utils/util.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/utils/util.js')}"></script>
    <script src="/{$template_catalog}/template/{$__shared}/lang/index.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/lang/index.js')}"></script>
    <script src="/{$template_catalog}/template/{$__shared}/js/common/common.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/js/common/common.js')}"></script>

<!-- Shell dependencies must precede native module business scripts. -->
<script>window.__CRA1_SHARED_BASE__="/{$template_catalog}/template/{$__shared}/";</script>
<script src="/{$template_catalog}/template/{$__shared}/utils/directive.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/utils/directive.js')}"></script>
<script src="/{$template_catalog}/template/{$__shared}/js/common/axios.min.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/js/common/axios.min.js')}"></script>
<script src="{:cra1_theme_asset_url('shared', 'v10-axios.js', '/cra1-shared/releases/20261017-member-auth-v2/v10-axios.js')}"></script>
<script src="{:cra1_theme_asset_url('native', 'js/plugin-pages.js', '/clientarea/template/pc/cra1/js/plugin-pages.js')}"></script>
<script src="{:cra1_theme_asset_url('native', 'api/common.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/api/common.js')}"></script>
<script src="{:cra1_theme_asset_url('native', 'components/asideMenu/asideMenu.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/components/asideMenu/asideMenu.js')}"></script>
<script src="{:cra1_theme_asset_url('native', 'components/topMenu/topMenu.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/components/topMenu/topMenu.js')}"></script>
<!-- Retained releases receive the same navigation state contract as new builds. -->
<script>{php}readfile(IDCSMART_ROOT.'public/cra1-shared/navigation-compat.js');{/php}</script>
<script src="{:cra1_theme_asset_url('native', 'js/module-deps.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/js/module-deps.js')}"></script>
{php}
// These routes render native module templates directly, before any fragment loader.
// Parser-ordered tags preserve native top-level const bindings and initialization.
$__cra1NativeComponents=\CRA1\Theme\Compatibility\NativeComponents::forPath((string)($_SERVER['REQUEST_URI']??''));
if ($__cra1NativeComponents) echo '<script src="'.htmlspecialchars(cra1_theme_asset_url('native','js/native-capabilities.js','/clientarea/template/pc/cra1/js/native-capabilities.js'),ENT_QUOTES,'UTF-8').'"></script>';
foreach ($__cra1NativeComponents as $__cra1Name=>$__cra1Relative) {
    $__cra1Source=$__cra1Name==='payDialog'
        ?cra1_theme_asset_url('native',$__cra1Relative,'/clientarea/template/pc/cra1/'.$__cra1Relative)
        :'/clientarea/template/'.$__shared.'/'.$__cra1Relative;
    echo '<script src="'.htmlspecialchars($__cra1Source,ENT_QUOTES,'UTF-8').'"></script>';
}
{/php}
