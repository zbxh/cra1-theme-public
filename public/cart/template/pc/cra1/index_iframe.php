{php}require_once IDCSMART_ROOT.'public/cra1-shared/cart-runtime.php';cra1_cart_runtime((string)($themes??''));{/php}
<!-- 页面引入样式位置 -->
<script src="/{$template_catalog}/template/{$themes}/js/common/jquery.mini.js"></script>
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261011-titanium-v1/css/goods.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/goods.css')}">
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261011-titanium-v1/css/cart-theme.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/cart-theme.css')}">


</head>

<body>
    <div class="goods cart-page" v-cloak>
        <el-container>
            <aside-menu></aside-menu>
            <el-container>
                <el-header>
                    <top-menu :num="shoppingCarNum"></top-menu>
                </el-header>
                <el-main>
                    <el-card>
                        <!-- 后端渲染出来的配置页面 -->
                        <div class="config-box">
                            <div class="content"></div>
                        </div>
                    </el-card>
                </el-main>
            </el-container>
        </el-container>
    </div>
    <!-- =======页面引入js和相关组件位置======= -->
    <!-- 系统组件 -->
    <script src="{:cra1_theme_asset_url('native', 'components/payDialog/payDialog.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/components/payDialog/payDialog.js')}"></script>
    <script src="/{$template_catalog}/template/{$themes}/components/pagination/pagination.js"></script>
    <script src="/{$template_catalog}/template/{$themes}/components/discountCode/discountCode.js"></script>
    <script src="/{$template_catalog}/template/{$themes}/components/customGoods/customGoods.js"></script>
    <script src="/{$template_catalog}/template/{$themes}/components/eventCode/eventCode.js"></script>

    <!-- 购物车文件 -->
    <script src="/{$template_catalog_cart}/template/{$themes_cart}/api/product.js"></script>
    <script src="{:cra1_theme_asset_url('cart', '20261013-security-snapshot-v1/js/cart-config.js', '/cart/template/pc/cra1/releases/20261013-security-snapshot-v1/js/cart-config.js')}"></script>
<script src="/{$template_catalog_cart}/template/{$themes_cart}/js/goods.js"></script>
