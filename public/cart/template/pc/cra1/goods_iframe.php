{php}require_once IDCSMART_ROOT.'public/cra1-shared/assets.php';{/php}
<script src="/{$template_catalog}/template/{$themes}/js/common/jquery.mini.js"></script>
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261011-titanium-v1/css/goods_iframe.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/goods_iframe.css')}">
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261012-icon-suite-v1/css/cart-theme.css', '/cart/template/pc/cra1/releases/20261012-icon-suite-v1/css/cart-theme.css')}">
<script src="{:cra1_theme_asset_url('native', 'js/module-deps.js', '/clientarea/template/pc/cra1/js/module-deps.js')}"></script>
</head>

<body>
  <!-- mounted之前显示 -->
  <div id="mainLoading">
    <div class="ddr ddr1"></div>
    <div class="ddr ddr2"></div>
    <div class="ddr ddr3"></div>
    <div class="ddr ddr4"></div>
    <div class="ddr ddr5"></div>
  </div>
  <div class="goods cart-page">
    <el-container>
      <aside-menu v-show="false"></aside-menu>
      <el-container>
        <top-menu :num="shoppingCarNum" v-show="false"></top-menu>
        <!-- 自己的东西 -->
        <!-- 后端渲染出来的配置页面 -->
        <div class="config-box">
          <div class="content"></div>
        </div>
      </el-container>
    </el-container>
  </div>
  <!-- =======页面独有======= -->
  <script src="{:cra1_theme_asset_url('native', 'components/payDialog/payDialog.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/components/payDialog/payDialog.js')}"></script>
  <script src="/{$template_catalog_cart}/template/{$themes_cart}/api/product.js"></script>
  <script src="{:cra1_theme_asset_url('cart', '20261013-security-snapshot-v1/js/cart-config.js', '/cart/template/pc/cra1/releases/20261013-security-snapshot-v1/js/cart-config.js')}"></script>
<script src="{:cra1_theme_asset_url('cart', '20261012-icon-suite-v1/js/cart-controls.js', '/cart/template/pc/cra1/releases/20261012-icon-suite-v1/js/cart-controls.js')}"></script>
<script src="{:cra1_theme_asset_url('cart', '20261012-cart-entry-v1/js/goods.js', '/cart/template/pc/cra1/releases/20261012-cart-entry-v1/js/goods.js')}"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/pagination/pagination.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/discountCode/discountCode.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/eventCode/eventCode.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/customGoods/customGoods.js"></script>
