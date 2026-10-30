{php}require_once IDCSMART_ROOT.'public/cra1-shared/cart-runtime.php';cra1_cart_runtime((string)($themes??''));{/php}
<!-- goods_embed：融合页的配置承载薄壳（CRA1 主题）。
     与 goods_iframe 的区别：
       1. 不加载 goods_iframe.css（那里 .ifram-hiden 会隐藏模块原生加购/立即购买控件，
          且 loader 的 isIfram 会把 flag=true 上报，可访问隐藏商品——嵌入页不放宽）；
       2. 父页桥接：ready/resize/error/cart-count/checkout 协议，消息带 nonce+product_id，
          父页校验 origin+source；父页仅负责选择与导航提升，模块仍负责配置、计价与购买。
-->
<script src="/{$template_catalog}/template/{$themes}/js/common/jquery.mini.js?v={:filemtime(IDCSMART_ROOT . 'public/clientarea/template/pc/default/js/common/jquery.mini.js')}"></script>
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261012-icon-suite-v1/css/cart-theme.css', '/cart/template/pc/cra1/releases/20261012-icon-suite-v1/css/cart-theme.css')}">
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261011-titanium-v1/css/goods_embed.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/goods_embed.css')}">
<script src="{:cra1_theme_asset_url('native', 'js/module-deps.js', '/clientarea/template/pc/cra1/js/module-deps.js')}"></script>
</head>

<body>
  <div id="mainLoading">
    <div class="ddr ddr1"></div>
    <div class="ddr ddr2"></div>
    <div class="ddr ddr3"></div>
    <div class="ddr ddr4"></div>
    <div class="ddr ddr5"></div>
  </div>
  <div class="goods cart-page cart-embed cart-embed--flat">
    <!-- 不渲染 aside/top：嵌入壳只承载配置内容 -->
    <div class="config-box">
      <div class="content"></div>
    </div>
  </div>
  <!-- =======页面独有======= -->
  <script src="{:cra1_theme_asset_url('native', 'components/payDialog/payDialog.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/components/payDialog/payDialog.js')}"></script>
  <script src="/{$template_catalog_cart}/template/{$themes_cart}/api/product.js?v={:filemtime(IDCSMART_ROOT . 'public/cart/template/pc/cra1/api/product.js')}"></script>
  <script src="{:cra1_theme_asset_url('cart', '20261017-compat-v3/js/goods_embed.js', '/cart/template/pc/cra1/releases/20261017-compat-v3/js/goods_embed.js')}"></script>
  <script src="{:cra1_theme_asset_url('cart', '20261013-security-snapshot-v1/js/cart-config.js', '/cart/template/pc/cra1/releases/20261013-security-snapshot-v1/js/cart-config.js')}"></script>
  <script src="{:cra1_theme_asset_url('cart', '20261012-icon-suite-v1/js/cart-controls.js', '/cart/template/pc/cra1/releases/20261012-icon-suite-v1/js/cart-controls.js')}"></script>
  <script src="{:cra1_theme_asset_url('cart', '20261012-cart-entry-v1/js/goods.js', '/cart/template/pc/cra1/releases/20261012-cart-entry-v1/js/goods.js')}"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/pagination/pagination.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/discountCode/discountCode.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/eventCode/eventCode.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/customGoods/customGoods.js"></script>
