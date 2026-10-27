{php}
if (!isset($__cra1Runtime)) { require_once IDCSMART_ROOT.'public/cra1-shared/runtime.php'; $__cra1Runtime=CRA1ThemeRuntime::load('home'); }
{/php}
<script>window.__CRA1_RUNTIME__ = {:json_encode($__cra1Runtime, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE)};</script>
<!-- 页面独有样式 -->
<link rel="stylesheet" href="{:cra1_theme_asset_url('member', 'assets/css/app.css', '/clientarea/template/pc/cra1/releases/20261017-member-auth-v2/assets/css/app.css')}">
{if $themes != 'pc/cra1' && $themes != 'mobile/cra1'}
<!-- Independent CRA1 home also uses the current business-icon palette. -->
<link rel="stylesheet" href="{:cra1_theme_asset_url('shared', 'cra1-shared.css', '/cra1-shared/releases/20261017-member-auth-v2/cra1-shared.css')}">
<script src="{:cra1_theme_asset_url('shared', 'cra1-shared.js', '/cra1-shared/releases/20261017-member-auth-v2/cra1-shared.js')}"></script>
{/if}
</head>

<body>
  <!--
    会员中心首页（/home.htm）

    ⚠️ 本文件是「纯片段」，不要再 include header / footer：
        ViewController::viewHome 已经把
            clientarea/header.php  +  本文件  +  clientarea/footer.php
        三段拼接后输出。header/footer 取自 $themes（会员中心主题），
        本文件取自 $themes_home（首页主题 home_theme），两者可独立配置。
        若写了 include，会因 view_path 指向 home 目录而报 header.php 不存在，
        异常被 catch 后整页退化成 404。
        （同理：本注释里也不能出现模板标签原文，ThinkPHP 连 HTML 注释内的标签一起解析。）

    可用变量（来自 viewHome 的 $data）：
        $template_catalog       = 'clientarea'
        $template_catalog_home  = 'home'
        $themes                 = 会员中心主题，如 pc/cra1
        $themes_home            = 首页主题，如 pc/cra1
        $public_themes 在本文件作用域内【不存在】。

    资源由 CRA1 发行清单统一选择
    ----------------------------
    本模板属于 CRA1 首页主题，外壳（asideMenu/topMenu/shell.js/cra1-shell.css）
    也只存在于 clientarea/template/pc/cra1/。首页主题与会员中心主题是两套独立配置，
    若用 $themes 拼接，当 clientarea_theme=default 时会指向不存在的文件。
    因此资源独立于 $themes，保证首页与会员中心可分别选择主题。
    （会员中心主题不是 CRA1 时，下面跳过 CRA1 外壳并直接挂载独立内容。）

    包裹层用 .cra1-page，不能叫 .template —— 第三方模块会用
    getElementsByClassName("template")[0] 取自己的根节点，占用该类名会导致误挂。
  -->
{if $themes == 'pc/cra1' || $themes == 'mobile/cra1'}
  <div id="mainLoading"><div class="ddr ddr1"></div><div class="ddr ddr2"></div><div class="ddr ddr3"></div><div class="ddr ddr4"></div><div class="ddr ddr5"></div></div>
  <!-- mobile/cra1 是指向 pc/cra1 的符号链接（手机 UA 与 PC 同用一套响应式主题），
       两种取值都要渲染外壳，否则手机端会退化为无导航的 #root 独立页 -->
  <div id="home" class="cra1-page">
    <div class="cra1-shell">
      <aside-menu :menu-active-id="1" @getruleslist="getRule"></aside-menu>
      <div class="cra1-shell__body">
        <top-menu ref="topMenuRef"></top-menu>
        <main class="cra1-shell__content" id="cra1-content-slot"></main>
      </div>
    </div>
  </div>
  <script src="{:cra1_theme_asset_url('native', 'js/shell.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/js/shell.js')}"></script>
{else /}
  <!-- 会员中心主题不是 CRA1：React 直接挂 #root，不创建依赖外壳关闭的加载遮罩。 -->
  <div id="root"></div>
{/if}

  <script type="module" src="{:cra1_theme_asset_url('member', 'assets/js/home.js', '/clientarea/template/pc/cra1/releases/20261017-member-auth-v2/assets/js/home.js')}"></script>
