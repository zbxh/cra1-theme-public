{php}require_once IDCSMART_ROOT.'public/cra1-shared/cart-runtime.php';cra1_cart_runtime((string)($themes??''));{/php}
<!-- 页面独有样式 -->
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261011-titanium-v1/css/cart-theme.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/cart-theme.css')}">
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
  <div class="template cart-page">
    <el-container>
      <aside-menu></aside-menu>
      <el-container>
        <top-menu></top-menu>
        <el-main>
          <!-- 订单结果页（新增）：支付成功 / 未完成支付 / 订单已提交 三态，文案走多语言 -->
          <div class="main-card cl-result-card">
            <div class="cl-result" v-cloak>
              <div class="cl-result-icon" :class="'is-' + view.status" aria-hidden="true">
                <i :class="view.icon"></i>
              </div>
              <h2 class="cl-result-title">{{ view.title }}</h2>
              <p class="cl-result-description" v-if="view.description">{{ view.description }}</p>
              <div class="cl-result-meta" v-if="orderLoaded && order">
                <span class="cl-meta-item">{{lang.pay_text15}}<b>{{ order.id }}</b></span>
                <span class="cl-meta-item" v-if="order.amount !== undefined && order.amount !== null">
                  {{lang.settlement_tip2}}<b class="cl-meta-price">{{commonData.currency_prefix}}{{ order.amount }}{{commonData.currency_suffix}}</b>
                </span>
              </div>
              <div class="cl-result-actions">
                <el-button v-if="orderLoaded && order" type="primary" @click="go('/orderDetail.htm?id=' + orderId)">{{lang.order_text1}}</el-button>
                <el-button v-else type="primary" @click="go('/finance.htm')">财务中心</el-button>
                <el-button @click="go('/cart/goodsList.htm')">{{lang.new_goods}}</el-button>
                <el-button v-if="view.status !== 'success'" @click="go('/cart/shoppingCar.htm')">{{lang.shoppingCar_title}}</el-button>
              </div>
            </div>
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
  <!-- =======页面独有======= -->
  <script src="{:cra1_theme_asset_url('cart', '20261013-security-snapshot-v1/js/cart-config.js', '/cart/template/pc/cra1/releases/20261013-security-snapshot-v1/js/cart-config.js')}"></script>
<script src="{:cra1_theme_asset_url('cart', '20261017-compat-v3/js/orderResult.js', '/cart/template/pc/cra1/releases/20261017-compat-v3/js/orderResult.js')}"></script>
