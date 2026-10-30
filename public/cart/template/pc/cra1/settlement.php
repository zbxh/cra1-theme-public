{php}require_once IDCSMART_ROOT.'public/cra1-shared/cart-runtime.php';cra1_cart_runtime((string)($themes??''));{/php}
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261011-titanium-v1/css/settlement.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/settlement.css')}">
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261017-compat-v3/css/purchase-theme.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/cart-theme.css')}">
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
  <div class="template cart-page cra1-confirm-page">
    <el-container>
      <aside-menu @getruleslist="getRule"></aside-menu>
      <el-container>
        <top-menu></top-menu>
        <el-main>
          <!-- 自己的东西 -->
          <div class="main-card">
            <div class="main-title">
              {{ pageTitle || lang.settlement_title }}
              <p class="dont-save-password" v-if="commonData.donot_save_client_product_password === 1">
                {{lang.dont_save_password_tip}}
              </p>
            </div>
            <div class="cra1-confirm-layout">
            <div class="goods-box">
              <div class="goods-item" v-loading="listLoading">
                <!-- 直达空态：无商品上下文时给出口提示，不虚构内容 -->
                <div class="cl-settle-empty"
                  v-if="!listLoading && (contextError || loadError || showGoodsList.length === 0)">
                  <el-empty :description="contextError || loadError || lang.shoppingCar_no_goods_text">
                    <el-button v-if="loadError && !contextError" @click="getCartList">重新读取</el-button>
                    <a :href="isFormShoppingCart ? '/cart/shoppingCar.htm' : '/cart/goodsList.htm'" class="el-button el-button--primary">{{isFormShoppingCart ? '返回购物车' : '浏览商品'}}</a>
                  </el-empty>
                </div>
                <el-alert v-if="quoteError" :title="quoteError" type="error" :closable="false" show-icon><el-button size="small" :loading="listLoading" @click="getCartList">重新计算价格</el-button></el-alert>
                <el-alert v-if="submissionUncertain" title="下单结果还未确认" type="warning" :closable="false" show-icon>请先查看订单列表，确认是否已经生成订单，避免重复购买。<a href="/finance.htm" class="el-button el-button--small">查看订单</a></el-alert>
                <div class="cl-pc-cart">
                <div v-for="(item,index) in showGoodsList" :key="index" class="shopping-goods"
                  v-loading="item.isLoading">
                  <div class="table-name">
                    <span class="goods-name">{{item.name}}</span>
                  </div>
                  <div class="table-content">
                    <table class="goods-table">
                      <thead>
                        <th class="description-box">{{lang.settlement_goodsInfo}}</th>
                        <th class="price-box">{{lang.settlement_goodsPrice}}</th>
                        <th class="num-box">{{lang.settlement_goodsNums}}</th>
                        <th class="total-box">{{lang.settlement_goodsTotalPrice}}</th>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <div class="info-box" v-if="item.info">
                              <div class="goods-info" v-if="false">
                                <span class="goodsInfo-type">
                                  <span class="goodsInfo-name">{{item.name}}</span>
                                  <span class="goodsInfo-val"></span>
                                </span>
                                <span
                                  class="goodsInfo-price">{{commonData.currency_prefix}}{{item.info.base_price}}{{commonData.currency_suffix}}</span>
                              </div>
                              <div v-for="(infoItem,value,index) in item.preview" :key="index" class="goods-info">
                                <span class="goodsInfo-type">
                                  <span v-if="infoItem.name">{{infoItem.name}}：</span>
                                  <span class="goodsInfo-val">{{infoItem.value}}</span>
                                </span>
                                <span class="goodsInfo-price" v-if="infoItem.price !== undefined && infoItem.price !== null && infoItem.price !== ''">{{commonData.currency_prefix}}{{infoItem.price}}{{commonData.currency_suffix}}</span>
                              </div>
                            </div>
                            <div v-else></div>
                          </td>
                          <td class="item-price">
                            <template v-if="item.info?.host_billing_cycle === 'on_demand'">
                              {{commonData.currency_prefix}}<span
                                class="price">{{(item.info.base_price * 1).toFixed(2)}}{{commonData.currency_suffix}}</span>&nbsp;<span
                                class="default-color">{{lang.demand_text1}}</span><br>
                              {{commonData.currency_prefix}}<span
                                class="price">{{(item.info.base_renew_price * 1).toFixed(4)}}{{commonData.currency_suffix}}</span>&nbsp;<span
                                class="default-color">/{{lang.demand_text2}}</span><br>
                              <template v-if="item.info.base_on_demand_flow_price * 1">
                                {{commonData.currency_prefix}}<span
                                  class="price">{{(item.info.base_on_demand_flow_price * 1).toFixed(4)}}{{commonData.currency_suffix}}</span>&nbsp;<span
                                  class="default-color">/GB</span>
                              </template>
                            </template>
                            <template v-else>
                              {{commonData.currency_prefix}}{{Number(item.price * 1 / item.qty).toFixed(2)}}{{commonData.currency_suffix}}
                              <span v-if="item.info && item.info.billing_cycle">/
                                {{item.info.customfield?.multi_language?.billing_cycle || item.info.billing_cycle}}</span>
                            </template>
                          </td>
                          <td>
                            {{item.qty}}
                          </td>
                          <td class="item-total">
                            <span>{{commonData.currency_prefix}} {{item.calcItemPrice | filterMoney}}{{commonData.currency_suffix}}</span>
                            <el-popover placement="top-start" width="200" trigger="hover"
                              v-if="item.price != item.calcItemPrice">
                              <div class="show-config-list">
                                <p v-if="item.level_discount">
                                  {{lang.shoppingCar_tip_text2}}：{{commonData.currency_prefix}} {{
                                  item.level_discount | filterMoney }}{{commonData.currency_suffix}}
                                </p>
                                <p v-if="item.code_discount">
                                  {{lang.shoppingCar_tip_text4}}：{{commonData.currency_prefix}} {{ item.code_discount |
                                  filterMoney }}{{commonData.currency_suffix}}
                                </p>
                                <p v-if="item.eventDiscount">{{lang.goods_text4}}：{{commonData.currency_prefix}} {{
                                  item.eventDiscount | filterMoney }}{{commonData.currency_suffix}}</p>
                              </div>
                              <i class="el-icon-warning-outline total-icon" slot="reference"></i>
                            </el-popover>
                            <event-code v-if="item.info && item.info.duration !=='' && item.eventDiscount"
                              :level_tip="false" :id="item.customfield.event_promotion" :product_id="item.product_id"
                              :qty="item.qty" :amount="item.price" :billing_cycle_time="item.info.duration" disabled>
                            </event-code>
                            <p class="original-price" v-if="item.price != item.calcItemPrice">
                              {{commonData.currency_prefix}} {{item.price | filterMoney}}{{commonData.currency_suffix}}
                            </p>
                            <div v-show="item.customfield.promo_code" class="discount-codeNumber">
                              {{ item.customfield.promo_code }}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                </div>

                <!-- 移动端核对卡（≤768 显示，PC 隐藏）：与 PC 表格共用同一份数据 -->
                <div class="cl-mobile-cart cl-mobile-settle">
                  <div v-for="(item,index) in showGoodsList" :key="'m' + index" class="cl-m-settle-card"
                    v-loading="item.isLoading">
                    <div class="cl-m-settle-head">
                      <span class="cl-m-cart-name">{{item.name}}</span>
                    </div>
                    <div class="cl-m-settle-body">
                      <div class="cl-m-cart-info">
                        <div v-for="(infoItem,value,idx) in item.preview" :key="idx" class="cl-m-cart-line">
                          <span class="cl-m-cart-line-name">
                            <span v-if="infoItem.name">{{infoItem.name}}：</span>
                            <span>{{infoItem.value}}</span>
                          </span>
                          <span class="cl-m-cart-line-price" v-if="infoItem.price !== undefined && infoItem.price !== null && infoItem.price !== ''">{{commonData.currency_prefix}}{{infoItem.price}}{{commonData.currency_suffix}}</span>
                        </div>
                      </div>
                      <div class="cl-m-settle-meta">
                        <span class="cl-m-settle-price">
                          <template v-if="item.info && item.info.host_billing_cycle === 'on_demand'">
                            {{commonData.currency_prefix}}{{item.info.base_price}}{{commonData.currency_suffix}}
                          </template>
                          <template v-else>
                            {{commonData.currency_prefix}}{{Number(item.price * 1 / item.qty).toFixed(2)}}{{commonData.currency_suffix}}
                          </template>
                        </span>
                        <span class="cl-m-settle-qty">×{{item.qty}}</span>
                        <span class="cl-m-settle-sub">
                          {{lang.settlement_goodsTotalPrice}}：{{commonData.currency_prefix}} {{item.calcItemPrice | filterMoney}}{{commonData.currency_suffix}}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        <aside class="cra1-confirm-summary" v-if="!contextError && !loadError && showGoodsList.length > 0" aria-label="费用摘要">
          <h2>费用摘要</h2>
          <div class="footer-box">
            <div class="footer-left" v-if="false">
              <span class="pay-text">{{lang.settlement_tip1}}</span>
              <el-radio-group v-model="payType" class="radio-box" v-if="payTypeList.length!==0">
                <el-radio :label="item.name" v-for="item in payTypeList" :key="item.id">{{item.title}}</el-radio>
              </el-radio-group>
            </div>
            <div class="footer-right">
              <div class="totalprice-box" v-loading="totalPriceLoading">
                <div>
                  {{lang.settlement_tip2}}：
                  <span class="total-price">{{commonData.currency_prefix}}{{finallyPrice | filterMoney}}{{commonData.currency_suffix}}</span>
                  <el-popover placement="top-start" width="200" trigger="hover"
                    v-if="orginPrice*1 != totalPrice*1 || finallyPrice*1 != totalPrice*1">
                    <div class="show-config-list">
                      <p v-if="totalLevelDiscount * 1 > 0">{{lang.shoppingCar_tip_text2}}：{{commonData.currency_prefix}}
                        {{
                        totalLevelDiscount | filterMoney }}{{commonData.currency_suffix}}
                      </p>
                      <p v-if="totalCodelDiscount * 1 > 0">
                        {{lang.shoppingCar_tip_text4}}：{{commonData.currency_prefix}} {{ totalCodelDiscount |
                        filterMoney }}{{commonData.currency_suffix}}
                      </p>
                      <p v-if="totalFullDiscount * 1 > 0">{{lang.goods_text4}}：{{commonData.currency_prefix}}
                        {{ totalFullDiscount | filterMoney }}{{commonData.currency_suffix}}
                      </p>
                    </div>
                    <i class="el-icon-warning-outline total-icon" slot="reference"></i>
                  </el-popover>

                </div>

              </div>
              <div class="btn-box" v-if="showPayBtn">
                <el-button type="primary" class="buy-btn" @click="goPay"
                  :disabled="!createdOrderId && !canSettle" :loading="subBtnLoading">{{createdOrderId ? '继续支付当前订单' : lang.settlement_tip3}}</el-button>
                <div class="check-box">
                  <el-checkbox v-model="checked"></el-checkbox>
                  {{ agreeText || lang.settlement_tip4 }}
                  <span class="bule-text" @click="goHelpUrl('terms_service_url')">{{lang.read_service}}</span>
                  {{lang.settlement_tip6}}
                  <span class="bule-text" @click="goHelpUrl('terms_privacy_url')">{{lang.read_privacy}}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
        </div>
        </div>
        </el-main>
        <!-- 支付弹窗 -->
        <pay-dialog ref="payDialog" @payok="paySuccess" @paycancel="payCancel" @paypending="payPending"></pay-dialog>
      </el-container>
    </el-container>
  </div>
  <!-- =======页面独有======= -->
  <script src="/{$template_catalog_cart}/template/{$themes_cart}/api/shopping.js"></script>
  <script src="{:cra1_theme_asset_url('native', 'components/payDialog/payDialog.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/components/payDialog/payDialog.js')}"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/eventCode/eventCode.js"></script>
  <script src="{:cra1_theme_asset_url('cart', '20261013-security-snapshot-v1/js/cart-config.js', '/cart/template/pc/cra1/releases/20261013-security-snapshot-v1/js/cart-config.js')}"></script>
<script src="{:cra1_theme_asset_url('cart', '20261017-compat-v3/js/settlement.js', '/cart/template/pc/cra1/releases/20261017-compat-v3/js/settlement.js')}"></script>
