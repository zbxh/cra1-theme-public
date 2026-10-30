{php}require_once IDCSMART_ROOT.'public/cra1-shared/cart-runtime.php';cra1_cart_runtime((string)($themes??''));{/php}
<!-- 页面独有样式 -->
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261011-titanium-v1/css/shoppingCar.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/shoppingCar.css')}">
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
  <div class="template cart-page cra1-basket-page">
    <el-container>
      <aside-menu></aside-menu>
      <el-container>
        <top-menu ref="topMenu"></top-menu>
        <el-main>
          <!-- 自己的东西 -->
          <div class="main-card">
            <div class="main-title">{{lang.shoppingCar_title}}</div>
            <div class="search-box">
              <el-input :placeholder="lang.shoppingCar_tip_text" suffix-icon="el-icon-search" @change="searchValChange"
                v-model="searchVal">
              </el-input>
            </div>
            <div class="goods-box" v-loading="listLoding">
              <div v-if="listError" class="cui-alert cui-alert--error cra1-cart-read-error" role="alert"><p>页面错误，请刷新重试</p></div>
              <template v-else-if="showList.length !== 0 || listLoding">
              <div class="goods-item cl-pc-cart">
                <el-checkbox-group v-model="checkedCities" @change="handleCheckedCitiesChange">
                  <div v-for="item in nowList" :key="item.position" class="shopping-goods" v-loading="item.isLoading">
                    <div class="table-name">
                      <el-checkbox :label="item.position" v-if="item.info" :disabled="item.priceLoading || !!item.priceError">
                        <span class="goods-name">{{item.name}}</span>
                      </el-checkbox>
                      <span class="goods-name mar-left-24" v-else>{{item.name}}</span>
                      <el-link type="primary" class="edit-goods" v-if="item.info"
                        @click="goGoods(item)">{{lang.shoppingCar_editGoods}}</el-link>
                    </div>
                    <div class="table-content">
                      <table class="goods-table">
                        <thead>
                          <th class="description-box">{{lang.shoppingCar_goodsInfo}}</th>
                          <th class="price-box">{{lang.shoppingCar_goodsPrice}}</th>
                          <th class="num-box">{{lang.shoppingCar_goodsNums}}</th>
                          <th class="total-box">{{lang.shoppingCar_goodsTotalPrice}}</th>
                          <th class="action-box">{{lang.shoppingCar_goodsAction}}</th>
                        </thead>
                        <tbody>
                          <tr v-if="item.info">
                            <td>
                              <div class="info-box">
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
                                  <span
                                    class="goodsInfo-price">{{commonData.currency_prefix}}{{infoItem.price || '0.00'}}{{commonData.currency_suffix}}</span>
                                </div>
                              </div>
                            </td>
                            <td class="item-price">
                              <template v-if="item.info.host_billing_cycle === 'on_demand'">
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
                                <span v-if="item.info.billing_cycle">/
                                  {{ item.info.customfield?.multi_language?.billing_cycle || item.info.billing_cycle}}</span>
                              </template>
                            </td>
                            <td>
                              <el-input-number v-model="item.qty" size="small"
                                @change="(currentValue,oldValue)=>handleChange(currentValue,oldValue,item)" :min="1"
                                :max="item.stock_control === 1 ? item.stock_qty : 99999"></el-input-number>
                              <p v-if="item.stock_control === 1" :class="item.stock_qty === 0 ? 'red-text':''"
                                class="qty-num">{{lang.shoppingCar_goods_tock_qty}}：{{ item.stock_qty }}</p>
                              <p v-if="item.isShowTips" class="qty-tips">{{lang.shoppingCar_tock_qty_tip}}</p>
                            </td>
                            <td class="item-total" v-loading="item.priceLoading">
                              <span>{{commonData.currency_prefix}} {{item.calcItemPrice | filterMoney}}{{commonData.currency_suffix}}</span>
                              <el-popover placement="top-start" width="200" trigger="hover"
                                v-if="item.calcItemPrice != item.price">
                                <div class="show-config-list">
                                  <p v-if="item.level_discount">
                                    {{lang.shoppingCar_tip_text2}}：{{commonData.currency_prefix}} {{
                                    item.level_discount  | filterMoney }}{{commonData.currency_suffix}}
                                  </p>
                                  <p v-if="item.code_discount">
                                    {{lang.shoppingCar_tip_text4}}：{{commonData.currency_prefix}} {{ item.code_discount
                                    | filterMoney }}{{commonData.currency_suffix}}
                                  </p>
                                  <p v-if="item.eventDiscount">{{lang.goods_text4}}：{{commonData.currency_prefix}} {{
                                    item.eventDiscount | filterMoney }}{{commonData.currency_suffix}}</p>
                                </div>
                                <i class="el-icon-warning-outline total-icon" slot="reference"></i>
                              </el-popover>
                              <p class="original-price" v-if="item.calcItemPrice != item.price">
                                {{commonData.currency_prefix}} {{item.price | filterMoney}}{{commonData.currency_suffix}}
                              </p>
                              <div class="discount-box">
                                <!-- && !item.customfield.promo_code -->
                                <discount-code v-if="item.customfield && isShowPromo"
                                  @get-discount="getDiscount(arguments)" @remove-discount="removeDiscountCode(item)"
                                  scene="new" :product_id="item.product_id" :qty="item.qty" :amount="item.price"
                                  :billing_cycle_time="item.info.duration" :shopping_index="item.position">
                                </discount-code>
                                <!-- <div v-if="item.customfield && item.customfield.promo_code" class="discount-codeNumber">
                                  {{ item.customfield.promo_code }}
                                  <i class="el-icon-circle-close remove-discountCode"
                                    @click="removeDiscountCode(item)"></i>
                                </div> -->
                                <event-code v-if="item.info && item.info.duration !=='' && isShowFull"
                                  :level_tip="false" :id="item.customfield.event_promotion"
                                  :product_id='item.product_id' :qty="item.qty" :amount="item.price"
                                  :billing_cycle_time="item.info.duration"
                                  @change="(price) => changeEventCode(price,item)">
                                </event-code>
                              </div>

                            </td>
                            <td class="delete-btn">
                              <i class="el-icon-delete" @click="handelDeleteGoods(item)"></i>
                            </td>
                          </tr>
                          <tr v-else>
                            <td></td>
                            <td class="no-goods-td">
                              <span class="no-goods-tips" :class="{'cra1-cart-read-error-text': !!item.priceError}">{{item.priceError ? '页面错误，请刷新重试' : lang.shoppingCar_no_goods_tip}}</span>
                              <el-button v-if="!item.priceError" class="buy-again-btn"
                                @click="goGoods(item)">{{lang.shoppingCar_buy_again}}</el-button>
                            </td>
                            <td></td>
                            <td></td>
                            <td class="delete-btn">
                              <i class="el-icon-delete" @click="handelDeleteGoods(item)"></i>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </el-checkbox-group>
              </div>

              <!-- 移动端卡片式购物车（≤768 显示，PC 隐藏）：与 PC 表格共用同一份数据与方法 -->
              <div class="goods-item cl-mobile-cart">
                <el-checkbox-group v-model="checkedCities" @change="handleCheckedCitiesChange">
                  <div v-for="item in nowList" :key="'m' + item.position" class="cl-m-cart-card" v-loading="item.isLoading">
                    <div class="cl-m-cart-head">
                      <el-checkbox :label="item.position" v-if="item.info" :disabled="item.priceLoading || !!item.priceError">
                        <span class="cl-m-cart-name">{{item.name}}</span>
                      </el-checkbox>
                      <span class="cl-m-cart-name cl-m-cart-name-plain" v-else>{{item.name}}</span>
                      <el-link type="primary" class="cl-m-cart-edit" v-if="item.info"
                        @click="goGoods(item)">{{lang.shoppingCar_editGoods}}</el-link>
                    </div>

                    <template v-if="item.info">
                      <div class="cl-m-cart-body">
                        <div class="cl-m-cart-info">
                          <div v-for="(infoItem,value,index) in item.preview" :key="index" class="cl-m-cart-line">
                            <span class="cl-m-cart-line-name">
                              <span v-if="infoItem.name">{{infoItem.name}}：</span>
                              <span>{{infoItem.value}}</span>
                            </span>
                            <span class="cl-m-cart-line-price">{{commonData.currency_prefix}}{{infoItem.price || '0.00'}}{{commonData.currency_suffix}}</span>
                          </div>
                        </div>

                        <div class="cl-m-cart-row">
                          <span class="cl-m-cart-label">{{lang.shoppingCar_goodsPrice}}</span>
                          <span class="cl-m-cart-price">
                            <template v-if="item.info.host_billing_cycle === 'on_demand'">
                              {{commonData.currency_prefix}}<span class="price">{{(item.info.base_price * 1).toFixed(2)}}{{commonData.currency_suffix}}</span>&nbsp;<span class="default-color">{{lang.demand_text1}}</span>
                              <span class="default-color">/{{lang.demand_text2}}</span>
                            </template>
                            <template v-else>
                              {{commonData.currency_prefix}}{{Number(item.price * 1 / item.qty).toFixed(2)}}{{commonData.currency_suffix}}
                              <span v-if="item.info.billing_cycle">/{{ item.info.customfield?.multi_language?.billing_cycle || item.info.billing_cycle}}</span>
                            </template>
                          </span>
                        </div>

                        <div class="cl-m-cart-row">
                          <span class="cl-m-cart-label">{{lang.shoppingCar_goodsNums}}</span>
                          <el-input-number v-model="item.qty" size="small"
                            @change="(currentValue,oldValue)=>handleChange(currentValue,oldValue,item)" :min="1"
                            :max="item.stock_control === 1 ? item.stock_qty : 99999"></el-input-number>
                        </div>
                        <p v-if="item.stock_control === 1" :class="item.stock_qty === 0 ? 'red-text':''"
                          class="qty-num cl-m-cart-stock">{{lang.shoppingCar_goods_tock_qty}}：{{ item.stock_qty }}</p>
                        <p v-if="item.isShowTips" class="qty-tips">{{lang.shoppingCar_tock_qty_tip}}</p>

                        <div class="cl-m-cart-row" v-if="item.customfield && (isShowPromo || isShowFull)">
                          <span class="cl-m-cart-label">{{lang.shoppingCar_tip_text4}}</span>
                          <div class="cl-m-cart-coupon">
                            <discount-code v-if="isShowPromo"
                              @get-discount="getDiscount(arguments)" @remove-discount="removeDiscountCode(item)"
                              scene="new" :product_id="item.product_id" :qty="item.qty" :amount="item.price"
                              :billing_cycle_time="item.info.duration" :shopping_index="item.position">
                            </discount-code>
                            <event-code v-if="item.info && item.info.duration !=='' && isShowFull"
                              :level_tip="false" :id="item.customfield.event_promotion"
                              :product_id='item.product_id' :qty="item.qty" :amount="item.price"
                              :billing_cycle_time="item.info.duration"
                              @change="(price) => changeEventCode(price,item)">
                            </event-code>
                          </div>
                        </div>
                      </div>

                      <div class="cl-m-cart-foot">
                        <span class="cl-m-cart-total" v-loading="item.priceLoading">
                          <span class="cl-m-cart-total-label">{{lang.shoppingCar_goodsTotalPrice}}</span>
                          <span class="cl-m-cart-total-num">{{commonData.currency_prefix}} {{item.calcItemPrice | filterMoney}}{{commonData.currency_suffix}}</span>
                          <el-popover placement="top-start" width="200" trigger="hover"
                            v-if="item.calcItemPrice != item.price">
                            <div class="show-config-list">
                              <p v-if="item.level_discount">{{lang.shoppingCar_tip_text2}}：{{commonData.currency_prefix}} {{ item.level_discount | filterMoney }}{{commonData.currency_suffix}}</p>
                              <p v-if="item.code_discount">{{lang.shoppingCar_tip_text4}}：{{commonData.currency_prefix}} {{ item.code_discount | filterMoney }}{{commonData.currency_suffix}}</p>
                              <p v-if="item.eventDiscount">{{lang.goods_text4}}：{{commonData.currency_prefix}} {{ item.eventDiscount | filterMoney }}{{commonData.currency_suffix}}</p>
                            </div>
                            <i class="el-icon-warning-outline total-icon" slot="reference"></i>
                          </el-popover>
                          <p class="original-price cl-m-cart-origin" v-if="item.calcItemPrice != item.price">
                            {{commonData.currency_prefix}} {{item.price | filterMoney}}{{commonData.currency_suffix}}
                          </p>
                        </span>
                        <i class="el-icon-delete cl-m-cart-del" @click="handelDeleteGoods(item)"></i>
                      </div>
                    </template>

                    <template v-else>
                      <div class="cl-m-cart-invalid">
                        <span class="no-goods-tips" :class="{'cra1-cart-read-error-text': !!item.priceError}">{{item.priceError ? '页面错误，请刷新重试' : lang.shoppingCar_no_goods_tip}}</span>
                        <el-button v-if="!item.priceError" class="buy-again-btn" @click="goGoods(item)">{{lang.shoppingCar_buy_again}}</el-button>
                        <i class="el-icon-delete cl-m-cart-del" @click="handelDeleteGoods(item)"></i>
                      </div>
                    </template>
                  </div>
                </el-checkbox-group>
              </div>
              </template>

              <div v-else>
                <div class="cl-empty-box">
                  <el-empty :description="emptyTitle || lang.shoppingCar_no_goods_text">
                    <template v-if="emptyDesc">
                      <p class="cl-empty-desc">{{ emptyDesc }}</p>
                    </template>
                    <template v-if="emptyBtn">
                      <el-button type="primary" @click="go(emptyTarget || '/cart/goodsList.htm')">{{ emptyBtn }}</el-button>
                    </template>
                  </el-empty>
                </div>
                <!-- 空态推荐位（后台 rows：真实商品，不可重复；接口取不到的商品跳过，不虚构） -->
                <div class="cl-hot" v-if="hotEnabled">
                  <div class="cl-hot-title" v-if="hotTitle">{{ hotTitle }}</div>
                  <div class="cl-hot-grid">
                    <a v-for="item in hotVisible" :key="item.pid" class="cl-hot-card"
                       :href="emptyTarget && emptyTarget !== '/cart/goodsList.htm' ? emptyTarget : '/cart/goodsList.htm?product_id=' + item.pid">
                      <div class="cl-hot-name">{{ item.title }}</div>
                      <div class="cl-hot-desc" v-if="item.desc">{{ item.desc }}</div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-main>
        <el-footer>
          <div class="footer-box">
            <div class="footer-left">
              <el-checkbox class="all-check" v-model="checkAll"
                @change="handleCheckAllChange">{{lang.shoppingCar_select_all}}</el-checkbox>
              <span class="delect-btn">
                <el-link type="danger" class="delect-goods"
                  @click="deleteCheckGoods">{{lang.shoppingCar_delete_select}}</el-link>
              </span>
              <span>{{lang.shoppingCar_selected}}<span
                  class="text-red">{{checkedCities.length}}</span>{{lang.shoppingCar_goods_text}}</span>
            </div>
            <div class="footer-right">
              <p>{{lang.shoppingCar_tip_text3}}：<span
                  class="total-price">{{commonData.currency_prefix}}{{totalPrice | filterMoney}}{{commonData.currency_suffix}}</span></p>
              <el-button type="primary" class="buy-btn" @click="goSettle"
                :loading="settleLoading" :disabled="checkoutBlocked">{{lang.shoppingCar_buy_text}}</el-button>
            </div>
          </div>
        </el-footer>
      </el-container>
    </el-container>
  </div>
  <!-- =======页面独有======= -->
  <script src="/{$template_catalog_cart}/template/{$themes_cart}/api/shopping.js"></script>
  <script src="/{$template_catalog_cart}/template/{$themes_cart}/api/product.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/discountCode/discountCode.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/eventCode/eventCode.js"></script>
  <script src="{:cra1_theme_asset_url('cart', '20261013-security-snapshot-v1/js/cart-config.js', '/cart/template/pc/cra1/releases/20261013-security-snapshot-v1/js/cart-config.js')}"></script>
<script src="{:cra1_theme_asset_url('cart', '20261012-cart-entry-v1/js/shoppingCar.js', '/cart/template/pc/cra1/releases/20261012-cart-entry-v1/js/shoppingCar.js')}"></script>
