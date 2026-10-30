<!-- =======公共======= -->
{php}
// 共享资产不参与主题降级，缺失时回退 pc/default（同 header.php）。
$__shared = 'pc/default';
if (is_file(IDCSMART_ROOT . 'public/clientarea/template/' . $public_themes . '/utils/request.js')) {
    $__shared = $public_themes;
}
$__themeComps = 'pc/default';
if (is_file(IDCSMART_ROOT . 'public/clientarea/template/' . $themes . '/components/coinActive/coinActive.js')) {
    $__themeComps = $themes;
}
{/php}
<script>
  // 优先使用 CRA1 自有的业务适配组件；其余只读系统组件仍由相对链接复用。
  window.__CRA1_SHARED_BASE__ = "/{$template_catalog}/template/{$__shared}/";
</script>
<script src="/{$template_catalog}/template/{$__shared}/components/preSalesService/preSalesService.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__shared . '/components/preSalesService/preSalesService.js')}"></script>
<script src="/{$template_catalog}/template/{$__themeComps}/components/coinActive/coinActive.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__themeComps . '/components/coinActive/coinActive.js')}"></script>
<script src="/{$template_catalog}/template/{$__themeComps}/components/clientLevelDialog/clientLevelDialog.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/' . $__themeComps . '/components/clientLevelDialog/clientLevelDialog.js')}"></script>
<!-- 搜索、头像及通用交互已由 header.php 的共用组件包加载。 -->
<!-- 酷锐A1主题外壳组件（本主题自有实现，覆盖 default 的 asideMenu/topMenu）
     路径用 $public_themes：插件页会把 $themes 降级为 pc/default，而外壳始终由本主题提供 -->
<!-- 第三方模块模板的依赖装载器：按需加载 CRA1 目录的 pagination/payDialog 等组件，
     使产品内页、自定义导航列表等模块渲染内容在新外壳下也能正常挂载。
     见 js/module-deps.js 顶部说明。 -->
<!-- 工单提交助手（主题层增强，仅 addTicket 页生效；依赖快照由 asideMenu 加载） -->
<script src="{:cra1_theme_asset_url('member', 'js/ticket-assist.js', '/clientarea/template/pc/cra1/releases/20261017-member-auth-v2/js/ticket-assist.js')}"></script>
{php}if (\CRA1\Theme\Compatibility\NativeComponents::forPath((string)($_SERVER['REQUEST_URI']??''))) {{/php}
<script src="{:cra1_theme_asset_url('native', 'js/native-page.js', '/clientarea/template/pc/cra1/js/native-page.js')}"></script>
{php}}{/php}
</body>

</html>
