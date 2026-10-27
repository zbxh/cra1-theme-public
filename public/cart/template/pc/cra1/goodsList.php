{php}require_once IDCSMART_ROOT.'public/cra1-shared/assets.php';{/php}
<!-- 页面独有样式 -->
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261011-titanium-v1/css/goodsList.css', '/cart/template/pc/cra1/releases/20261011-titanium-v1/css/goodsList.css')}">
<link rel="stylesheet" href="{:cra1_theme_asset_url('cart', '20261012-icon-suite-v1/css/cart-theme.css', '/cart/template/pc/cra1/releases/20261012-icon-suite-v1/css/cart-theme.css')}">
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
  <div class="template cart-page cart-page--flat">
    <!-- v8 手机端吸底价格操作栏（≤1024 显示；main-card 外层防 backdrop-filter 劫持 fixed） -->
    <div class="cl-rail-dock" v-if="isNormal && first_group_list.length && selectedProduct && railState === 'bridged'">
      <!-- v17 手机档：时长/数量/优惠码并入底栏 + 配置费用明细下拉（PC 不渲染） -->
      <div class="cl-dock-m" v-if="isMobileCart">
        <div class="cl-dock-m-detail" v-show="dockDetailOpen">
          <div class="cl-dock-m-detail-item" v-for="(it, pi) in railPreview" :key="'dp' + pi">
            <span class="n">{{ it.value ? it.name + '：' + it.value : it.name }}</span>
            <span class="p" v-if="it.price">{{ it.price }}</span>
          </div>
          <div class="cl-dock-m-detail-item" v-if="railPrice.originText && railPrice.originText !== railPrice.calcText">
            <span class="n">{{lang.shoppingCar_tip_text4 || '优惠'}}</span>
            <span class="p">-{{railPrice.currency}}{{railPrice.originText}}{{railPrice.suffix}}</span>
          </div>
          <div class="cl-dock-m-detail-empty" v-if="!railPreview.length">{{lang.goods_loading || '加载中…'}}</div>
        </div>
        <div class="cl-dock-m-row">
          <div class="cl-dock-m-field">
            <span class="cl-dock-m-lbl">{{lang.cycle || '订购时长'}}</span>
            <el-select v-model="railDurationId" size="small" @change="railSetDuration" :loading="railLoading">
              <el-option v-for="d in railDurations" :key="d.id" :value="d.id" :label="d.name"></el-option>
            </el-select>
          </div>
          <div class="cl-dock-m-field" v-if="railQty.allow">
            <span class="cl-dock-m-lbl">{{lang.quantity || '订购数量'}}</span>
            <el-input-number v-model="railQty.cur" size="small" :min="railQty.min" :max="railQty.max"
              @change="railSetQty"></el-input-number>
          </div>
        </div>
        <div class="cl-dock-m-coupon-toggle" v-if="railPrice.hasDiscount"
          @click="toggleCoupon" :aria-expanded="couponOpen ? 'true' : 'false'">
          <span>{{lang.coupon_code || '优惠码'}}</span>
          <span class="cl-dock-m-coupon-hint">{{couponOpen ? '收起' : (railCoupon ? railCoupon : (lang.coupon_input || '输入优惠码'))}}</span>
          <i :class="couponOpen ? 'el-icon-arrow-up' : 'el-icon-arrow-down'"></i>
        </div>
        <div class="cl-dock-m-row cl-dock-m-coupon" v-show="couponOpen && railPrice.hasDiscount">
          <el-input v-model="railCoupon" size="small" :placeholder="lang.coupon_input || '请输入优惠码'"
            @keyup.enter.native="railApplyCoupon"></el-input>
          <el-button size="small" class="cl-dock-m-exchange" @click="railApplyCoupon">{{lang.exchange || '兑换'}}</el-button>
        </div>
      </div>
      <div class="cl-rail-dock-price">
        <span class="cl-rail-dock-label" :class="{ 'cl-dock-m-toggle': isMobileCart }"
          @click="isMobileCart && (dockDetailOpen = !dockDetailOpen)">
          {{lang.config_free || '配置费用'}}
          <i v-if="isMobileCart" :class="dockDetailOpen ? 'el-icon-arrow-down' : 'el-icon-arrow-up'"></i>
        </span>
        <span class="cl-rail-dock-now">
          <span class="cl-rail-cur">{{railPrice.currency}}</span><span class="cl-rail-dock-num">{{railPrice.calcText}}{{railPrice.suffix}}</span>
        </span>
        <span class="cl-rail-price-origin" v-if="railPrice.originText && railPrice.originText !== railPrice.calcText">
          <span>{{railPrice.currency}}</span>{{railPrice.originText}}{{railPrice.suffix}}
        </span>
      </div>
      <div class="cl-rail-dock-actions">
        <button type="button" class="cl-rail-addcart" v-if="!isEditingCartItem" :title="lang.add_cart || '加入购物车'"
          :disabled="railLoading" @click="railAddCart">
          <i class="el-icon-shopping-cart-2"></i>
        </button>
        <el-button type="primary" class="cl-rail-buy" :disabled="railLoading"
          @click="railPrimaryAction">{{isEditingCartItem ? '保存修改' : (lang.product_buy_now || '立即购买')}}</el-button>
      </div>
    </div>
    <el-container>
      <aside-menu @getruleslist="getRule"></aside-menu>
      <el-container>
        <top-menu ref="topMenu"></top-menu>
        <el-main>
          <!-- 自己的东西 -->
          <div class="main-card">
            <div v-if="commonData.cart_instruction == 1 && commonData.cart_instruction_content" class="cart-des"
              v-html="commonData.cart_instruction_content">
            </div>
            <div class="main-title" v-else>{{ pageTitle || lang.new_goods }}</div>
            <div class="main-subtitle" v-if="pageSubtitle">{{ pageSubtitle }}</div>
            <div class="main-content-box" :class="{'has-rail': isNormal && first_group_list.length}">
              <div class="cl-shop">
                <div class="cl-shop-main">
                  <div v-if="catalogError" class="cui-alert cui-alert--error cra1-cart-read-error" role="alert">
                    <span>{{ catalogError }}</span>
                    <button type="button" class="cui-button cui-button--secondary" @click="retryCatalog">重新加载</button>
                  </div>
                  <!-- 顶部横排导航：搜索 + 一级/二级（层级标题读 v10 first/second_navigation，v6 统一蓝条标题样式） -->
                  <div class="cl-shop-nav" v-if="isNormal && first_group_list.length" role="tablist" :aria-label="navFirstLabel || '商品分组导航'">
                    <div class="cl-nav-search">
                      <el-input :placeholder="lang.goods_search_placeholder" clearable
                        v-model="goodsParmas.keywords" @keyup.enter.native="searchGoods"></el-input>
                      <el-button type="primary" class="cl-nav-search-btn" @click="searchGoods"
                        :loading="searchLoading">{{lang.search}}</el-button>
                    </div>
                    <div class="cl-nav-group">
                      <div class="cl-sec-tit cl-nav-title" v-if="navFirstLabel">
                        <cra1-cart-heading-icon label="一级产品分类" icon-id="category_primary"></cra1-cart-heading-icon><span class="cl-sec-tit-text">{{ navFirstLabel }}</span>
                      </div>
                      <nav class="cl-nav-list" role="tablist" :aria-label="navFirstLabel || '一级分组'">
                        <button type="button" class="cl-nav-item cl-nav-item-first" role="tab"
                          v-for="item in first_group_list" :key="'f'+item.id"
                          :class="{'is-active': select_first_obj.id === item.id}"
                          :aria-current="select_first_obj.id === item.id ? 'true' : false"
                          @click="selectFirstType(item.id)">{{ item.name }}</button>
                      </nav>
                    </div>
                    <template v-if="second_group_list.length">
                      <div class="cl-nav-group">
                        <div class="cl-sec-tit cl-nav-title" v-if="navSecondLabel">
                          <cra1-cart-heading-icon label="二级产品分类" icon-id="category_secondary"></cra1-cart-heading-icon><span class="cl-sec-tit-text">{{ navSecondLabel }}</span>
                        </div>
                        <nav class="cl-nav-list" role="tablist" :aria-label="navSecondLabel || '二级分组'">
                          <button type="button" class="cl-nav-item cl-nav-item-sub" role="tab"
                            v-for="item in second_group_list" :key="'s'+item.id"
                            :class="{'is-active': select_second_obj.id === item.id}"
                            :aria-current="select_second_obj.id === item.id ? 'true' : false"
                            @click="selectSecondType(item.id)">{{ item.name }}</button>
                        </nav>
                      </div>
                    </template>
                  </div>
                  <div class="second-desc" v-if="showGroupDesc && select_second_obj.description">
                <scroll-text mode="loop">
                  {{select_second_obj.description}}
                </scroll-text>
              </div>
              <div class="shopping-box" v-if="isNormal" v-loading="goodSLoading && goodsList.length > 0">
                <!-- 普通商品列表 -->
                <template v-if="isNormal">
                  <section class="cl-products-section" :aria-label="cardTitle || '产品型号'">
                  <!-- 卡片区标题（后台可设，默认：产品型号） -->
                  <div class="cl-sec-tit" v-if="cardTitle">
                    <cra1-cart-heading-icon label="产品型号" icon-id="product_model"></cra1-cart-heading-icon><span class="cl-sec-tit-text">{{ cardTitle }}</span>
                  </div>
                  <!-- 首屏加载骨架屏 -->
                  <div class="cl-skeleton" v-if="goodSLoading && goodsList.length === 0" aria-hidden="true">
                    <div class="cl-skel-card" v-for="n in 8" :key="'sk'+n">
                      <div class="cl-skel-media"></div>
                      <div class="cl-skel-line cl-skel-title"></div>
                      <div class="cl-skel-line cl-skel-price"></div>
                    </div>
                  </div>
                  <div class="no-goods" v-else-if="goodsList.length === 0 && !goodSLoading && !catalogError">
                    <el-empty :description="lang.no_goods"></el-empty>
                  </div>
                  <div v-else class="cl-goods-grid" :style="gridStyle">
                    <template v-for="(item,index) in goodsList">
                      <div class="cl-goods-card"
                        :class="{'is-sold-out': item.stock_control === 1 && item.qty <= 0, 'is-selected': selectedProductId === item.id}"
                        role="button" tabindex="0"
                        :aria-selected="selectedProductId === item.id ? 'true' : 'false'"
                        :aria-disabled="item.stock_control === 1 && item.qty <= 0 ? 'true' : 'false'"
                        @click="selectProduct(item)"
                        @keydown.enter.prevent="selectProduct(item)"
                        @keydown.space.prevent="selectProduct(item)"><div class="cui-card__clip">
                        <div class="cl-card-ribbon" v-if="item.recommend === 1"
                          :style="{background: item.recommend_color ? item.recommend_color : 'var(--primary)'}">
                          <span>{{item.recommend_text}}</span>
                        </div>
                        <div class="cl-card-head">
                          <span class="cl-card-head-name" :title="item.name">{{ item.name }}</span>
                          <span class="cl-card-head-check" aria-hidden="true"><i class="el-icon-check"></i></span>
                        </div>
                        <!-- 描述区块：后台上「商品卡展示区块」里 desc 停用时隐藏（此前无条件渲染，开关点了没反应） -->
                        <div class="cl-card-body">
                          <template v-for="sec in orderedSections">
                        <div class="cl-card-desc" v-if="sec === 'desc'">
                          <div class="cl-card-desc-inner" :class="{'desc-expanded': item.descExpanded}"
                            :style="item.descExpanded ? {} : { '-webkit-line-clamp': item.descLines || 2 }"
                            v-html="item.safeDescription"></div>
                          <button type="button" class="cl-desc-toggle"
                            v-if="item.descOverflow" @click.stop="toggleDesc(item, index)">{{ item.descExpanded ? lang.template_text119 : lang.template_text120 }}</button>
                        </div>
                          <div class="cl-card-tags"
                            v-else-if="sec === 'tags' && ((item.pay_ontrial && item.pay_ontrial?.status === 1) || item.aodun_firewall_product || (item.client_level_name && item.client_level_name !== ''))">
                            <span class="cl-tag" v-if="item.client_level_name && item.client_level_name !== ''">
                              {{lang.shoppingCar_tip_text15}}
                            </span>
                            <span class="cl-tag" v-if="item.pay_ontrial && item.pay_ontrial?.status === 1">
                              {{lang.support_trial}}
                            </span>
                            <span class="cl-tag" v-if="item.aodun_firewall_product">
                              {{lang.firewall_text1}}
                            </span>
                          </div>
                          <div class="cl-card-name" v-else-if="sec === 'stock'" :title="item.name">
                            <span class="cl-card-qty" v-if="item.stock_control === 1 && item.qty > 0">{{lang.stock}} {{item.qty}}</span>
                            <span class="cl-card-soldout" v-if="item.stock_control === 1 && item.qty <= 0">
                              <img src="/{$template_catalog_cart}/template/{$themes_cart}/img/sold_out.svg" alt="">
                            </span>
                          </div>
                          <div class="cl-card-active" v-else-if="sec === 'promo'">
                            <template v-if="item.activeList.length > 0 || item.addon_coin === 1">
                              <span class="cl-active-name" v-if="item.addon_coin === 1">
                                {{lang.coin_text10}}{{item.addon_coin_name}}
                              </span>
                              <template v-for="active in item.activeList">
                                <el-popover placement="top-start" trigger="hover" :key="'ac'+index+active.name">
                                  <div class="active-item">
                                    <span v-if="active.type === 'percent'">{{lang.goods_text1}} {{active.value}}%</span>
                                    <span v-if="active.type === 'reduce'"> {{lang.goods_text2}} {{active.full}}
                                      {{lang.goods_text3}} {{active.value}}</span>
                                  </div>
                                  <span class="cl-active-name" slot="reference">
                                    {{active.name}}
                                  </span>
                                </el-popover>
                              </template>
                            </template>
                          </div>
                          <div class="cl-card-foot" v-if="sec === 'price'">
                            <div class="cl-card-price">
                              <span class="cl-price">
                                <span class="cl-price-prefix">{{commonData.currency_prefix}}</span><span
                                  class="cl-price-num">{{item.price_discounted || item.price}}{{commonData.currency_suffix}}</span><span
                                  class="cl-price-cycle" v-if="item.cycle">/{{item.cycle}}</span>
                              </span>
                              <span class="cl-price-origin"
                                v-if="item.price_discounted && item.price != item.price_discounted">
                                <span class="cl-price-prefix">{{commonData.currency_prefix}}</span>{{item.price}}{{commonData.currency_suffix}}
                              </span>
                            </div>
                          </div>
                          </template>
                        </div>
                      </div></div>
                    </template>
                  </div>
                  <!-- 底部加载提示 -->
                  <p v-if="isNormal && !catalogError && !scrollDisabled && goodsList.length !== 0" class="cl-loadtip">{{lang.goods_loading}}</p>
                  </section>
                  <!-- 选配区与导航、产品型号同级；保留模块原有选择控件、卡片与计价逻辑 -->
                  <div class="cl-config-panel" v-if="selectedProduct" ref="configPanel">
                    <div class="cl-config-body">
                      <div class="cl-config-skeleton" v-if="configState === 'loading'" aria-hidden="true">
                        <div class="cl-skel-line" style="width: 30%"></div>
                        <div class="cl-skel-buttons"><span class="cl-skel-btn" v-for="n in 4" :key="'cb'+n"></span></div>
                        <div class="cl-skel-line" style="width: 24%"></div>
                        <div class="cl-skel-buttons"><span class="cl-skel-btn" v-for="n in 5" :key="'cs'+n"></span></div>
                      </div>
                      <div class="cl-config-error" v-else-if="configState === 'error'">
                        <el-empty :description="configErrorText || '配置加载失败'">
                          <el-button type="primary" @click="reloadConfig">重试</el-button>
                          <el-button @click="openStandalone">在独立页打开</el-button>
                        </el-empty>
                      </div>
                      <div v-if="isMobileCart" v-show="configState === 'ready'" class="cl-config-direct"
                        ref="mobileConfigBody"></div>
                      <iframe v-if="!isMobileCart" :key="embedSrc" :src="embedSrc" class="cl-config-frame"
                        :class="{'is-loading': configState === 'loading'}"
                        :style="configState === 'ready' && frameHeight ? { height: frameHeight + 'px' } : {}"
                        :title="selectedProduct.name + ' 配置'"
                        referrerpolicy="same-origin" @load="onFrameLoad"></iframe>
                    </div>
                  </div>
                </template>
                </div>
              </div>
            </div>
<aside class="cl-rail" v-if="isNormal && first_group_list.length && !isMobileCart" aria-label="价格计算器">
                <div class="cl-rail-card">
                  <div class="cl-sec-tit">
                    <cra1-cart-heading-icon label="配置费用" icon-id="price"></cra1-cart-heading-icon>
                    <span class="cl-sec-tit-text">{{ railTitle }}</span>
                  </div>
                  <template v-if="selectedProduct && railState === 'bridged'">
                    <!-- 当前配置明细（置于时长/数量上方，v6.2） -->
                    <div class="cl-rail-field" v-if="railPreview.length">
                      <div class="cl-rail-label">{{lang.cur_config || '当前配置'}}</div>
                      <div class="cl-rail-preview">
                        <div class="cl-rail-preview-item" v-for="(it, pi) in railPreview" :key="'pv'+pi">
                          <span class="cl-rail-preview-name">{{ it.value ? it.name + '：' + it.value : it.name }}</span>
                          <span class="cl-rail-preview-price" v-if="it.price">{{ it.price }}</span>
                        </div>
                      </div>
                    </div>
                    <!-- 订购时长 + 订购数量（同行，v6.7；模块无数量能力时时长独占整行） -->
                    <div class="cl-rail-row">
                      <div class="cl-rail-field">
                        <div class="cl-rail-label">{{lang.cycle || '订购时长'}}</div>
                        <el-select v-model="railDurationId" size="small" @change="railSetDuration" :loading="railLoading">
                          <el-option v-for="d in railDurations" :key="d.id" :value="d.id" :label="d.name"></el-option>
                        </el-select>
                      </div>
                      <div class="cl-rail-field" v-if="railQty.allow">
                        <div class="cl-rail-label">{{lang.quantity || '订购数量'}}</div>
                        <el-input-number v-model="railQty.cur" size="small" :min="railQty.min" :max="railQty.max"
                          @change="railSetQty"></el-input-number>
                      </div>
                    </div>
                    <!-- 配置费用（有优惠时右侧灰字原价，v6.7） -->
                    <div class="cl-rail-price">
                      <div class="cl-rail-label">{{lang.config_free || '配置费用'}}</div>
                      <div class="cl-rail-price-now">
                        <span class="cl-rail-cur">{{railPrice.currency}}</span><span class="cl-rail-num">{{railPrice.calcText}}{{railPrice.suffix}}</span>
                        <span class="cl-rail-price-origin" v-if="railPrice.originText && railPrice.originText !== railPrice.calcText">
                          <span>{{railPrice.currency}}</span>{{railPrice.originText}}{{railPrice.suffix}}
                        </span>
                      </div>
                    </div>
                    <!-- 优惠码（模块提供时显示） -->
                    <div class="cl-rail-field" v-if="railPrice.hasDiscount">
                      <div class="cl-rail-label">{{lang.coupon_code || '优惠码'}}</div>
                      <div class="cl-rail-coupon">
                        <el-input v-model="railCoupon" size="small" :placeholder="lang.coupon_input || '请输入优惠码'"
                          @keyup.enter.native="railApplyCoupon"></el-input>
                        <el-button size="small" @click="railApplyCoupon">{{lang.exchange || '兑换'}}</el-button>
                      </div>
                    </div>
                    <!-- 操作按钮 -->
                    <div class="cl-rail-actions">
                      <button type="button" class="cl-rail-addcart" v-if="!isEditingCartItem" :title="lang.add_cart || '加入购物车'"
                        :disabled="railLoading" @click="railAddCart">
                        <i class="el-icon-shopping-cart-2"></i>
                      </button>
                      <el-button type="primary" class="cl-rail-buy" :disabled="railLoading"
                        @click="railPrimaryAction">{{isEditingCartItem ? '保存修改' : (lang.product_buy_now || '立即购买')}}</el-button>
                    </div>
                  </template>
                  <div class="cl-rail-empty" v-else-if="selectedProduct && railState === 'fallback'">
                    <p>{{railFallbackText || '请在左侧配置商品参数，价格将在此实时计算。'}}</p>
                    <el-button size="small" type="primary" plain @click="railRetryBridge">{{lang.rerun || '重试'}}</el-button>
                  </div>
                  <div class="cl-rail-empty" v-else>
                    <p>{{ selectedProduct ? (lang.goods_loading || '加载中…') : (lang.goodsList_select_first || '请先在上方选择商品型号，价格将在此实时计算。') }}</p>
                  </div>
                </div>
              </aside>
                <!-- 域名展示 -->
                <template v-if="isDomain">
                  <div class="domain-box">
                    <div class="register-type">
                      <span class="reg-ridio" :class="regType === '1' ? 'isActice' : ''"
                        @click="regType = '1'">{{lang.template_text93}}</span>
                      <template v-if="domainConfig.batch_search_domain === 1">
                        <el-divider direction="vertical"></el-divider>
                        <span class="reg-ridio" :class="regType === '2' ? 'isActice' : ''"
                          @click="regType = '2'">{{lang.template_text94}}</span>
                      </template>
                    </div>
                    <div class="domain-search" v-if="regType === '1'">
                      <el-input :placeholder="lang.template_text92" v-model="domainInput" clearable
                        @keyup.enter.native="handelDomainSearch">
                        <div class="suffix-box" slot="append" @click="isShowSuffixBox = !isShowSuffixBox">
                          {{selectSuffix}}
                          <i class="el-icon-arrow-down select-btn"></i>
                        </div>
                      </el-input>
                      <el-button class="search-button" @click="handelDomainSearch"
                        :loading="isSearching">{{lang.template_text95}}</el-button>
                      <div class="suffix-list" v-show="isShowSuffixBox">
                        <div class="suffix-item" @click="handelSelectSuffix(item.suffix)"
                          :class="selectSuffix === item.suffix ? 'suffix-active' : ''" v-for="item in suffixList"
                          :key="item.suffix">{{item.suffix}}</div>
                      </div>
                    </div>
                    <div class="batch-search-box" v-if="regType === '2'">
                      <div class="batch-tips" v-loading="batchLoading">
                        <el-input v-model="textarea2" resize="none" class="input-batch" type="textarea"
                          :placeholder="`${lang.template_text106}\n${lang.template_text107}${domainConfig.number_limit}${lang.template_text108}${domainConfig.number_limit}${lang.template_text109}\n${lang.template_text110}\n${lang.template_text111}`">
                        </el-input>
                      </div>
                      <div class="batch-btn">
                        <div class="upload-btn" @click="isShowUpload = true">
                          <svg t="1750672276335" class="icon" viewBox="0 0 1024 1024" version="1.1"
                            xmlns="http://www.w3.org/2000/svg" p-id="10857" width="16" height="16">
                            <path
                              d="M938.855808 638.776382l0 270.299169c0 27.41028-22.210861 49.634444-49.621141 49.634444l-754.442728 0c-27.41028 0-49.647747-22.224164-49.647747-49.634444L85.144192 638.776382c0-27.41028 22.224164-49.634444 49.634444-49.634444s49.634444 22.224164 49.634444 49.634444l0 220.664725 655.17384 0L839.58692 638.776382c0-27.41028 22.224164-49.634444 49.634444-49.634444S938.855808 611.366102 938.855808 638.776382zM349.445764 351.817788l112.918769-115.288746 0 429.77837c0 27.411303 22.224164 49.634444 49.634444 49.634444 27.41028 0 49.634444-22.223141 49.634444-49.634444L561.633421 236.534158 674.547073 351.812671c9.722432 9.927093 22.591531 14.904455 35.470863 14.904455 12.524245 0 25.071002-4.716418 34.725896-14.172791 19.583011-19.184945 19.913539-50.608631 0.733711-70.190619L547.478026 80.195483c-9.335622-9.535167-22.116717-14.905478-35.46063-14.905478-13.338796 0-26.120914 5.370311-35.456536 14.900362L278.542924 282.3486c-19.184945 19.588127-18.86465 51.010791 0.722454 70.190619C298.847365 371.724163 330.271052 371.394658 349.445764 351.817788z"
                              p-id="10858" fill="var(--color-primary)"></path>
                          </svg>
                          {{lang.template_text132}}
                        </div>
                        <el-button @click="batchSearchDomain" type="primary"
                          :loading="batchLoading">{{lang.template_text112}}</el-button>
                      </div>
                    </div>
                    <div class="domain-content">
                      <div class="domain-left">
                        <div class="domain-one" v-if="regType === '1'">
                          <div class="domain-one-list" v-if="domainList.length !==0" v-loading="isSearching">
                            <div class="search-title">
                              <span>{{lang.template_text96}}</span>
                              <span class="search-fillter is_select" @click="openFilter"><i
                                  class="el-icon-search"></i>{{isShowFilrer ? lang.wx_tip15: lang.wx_tip14}}</span>
                            </div>
                            <div class="fillter-list" v-if="isShowFilrer && fillterDomainSuffix.length > 0">
                              <div class="fillter-item" :class="{'is_select':selectFilterSuffix.includes(item)}"
                                v-for="item in fillterDomainSuffix" :key="item" @click="handelFilterSuffix(item)">
                                {{item}}
                              </div>
                            </div>
                            <div class="domain-list">
                              <div class="domain-item" v-for="(item,index) in calcDomainList" :key="index">
                                <div class="item-left">
                                  <span class="domain-name">{{item.name}}</span>
                                  <span class="domain-status" v-if="item.avail === 0">{{lang.template_text97}}</span>
                                  <span class="domain-status"
                                    v-if="(item.avail === 1 || item.avail === -2) && item.description">{{item.description}}</span>
                                </div>
                                <div class="item-right">
                                  <div class="premium-type" v-if="item.type && item.type === 'premium'">
                                    {{lang.template_text98}}
                                  </div>
                                  <el-popover placement="bottom" trigger="hover" v-if="item.avail === 1">
                                    <div class="pirce-box" slot="reference" v-loading="item.priceLoading">
                                      <span class="now-price">{{commonData.currency_prefix}}<span
                                          style="font-size: 0.18rem;  color: var(--color-price-text);">{{item.showPrice}}{{commonData.currency_suffix}}
                                        </span><span style="color: #485169;">/{{lang.common_cloud_text112}}</span>
                                      </span>
                                      <i style="margin-left: 0.1rem;color: #F6F7FB;" class="el-icon-arrow-down"></i>
                                    </div>
                                    <div class="price-list">
                                      <div class="price-item">
                                        <div class="price-year"></div>
                                        <div class="price-new">{{lang.template_text99}}</div>
                                        <div class="price-renew">{{lang.template_text100}}</div>
                                      </div>
                                      <div class="price-item" v-for="items in item.priceArr" :key="items.buyyear">
                                        <div class="price-year">{{items.buyyear}}{{lang.template_text101}}</div>
                                        <div class="price-new">{{commonData.currency_prefix}}{{items.buyprice}}{{commonData.currency_suffix}}</div>
                                        <div class="price-renew">{{commonData.currency_prefix}}{{items.renewprice}}{{commonData.currency_suffix}}
                                        </div>
                                      </div>
                                    </div>
                                  </el-popover>
                                  <el-button class="add-btn" type="primary" :plain="isAddCart(item)"
                                    :disabled="isAddCart(item)" v-if="item.avail === 1 "
                                    @click="addCart(item)">{{lang.template_text102}}
                                  </el-button>
                                  <div class="whois-box" v-if="item.avail === 0" @click="goWhois(item)">
                                    {{lang.template_text103}}
                                  </div>
                                  <div v-if="item.avail === -1">{{lang.template_text104}}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <template v-else>
                            <div class="search-title">{{lang.template_text93}}</div>
                            <div class="start-search" v-loading="isSearching">
                              <img src="/{$template_catalog}/template/{$themes}/img/goodsList/search_domain.png" alt="">
                              <p>{{lang.template_text105}}</p>
                            </div>
                          </template>
                        </div>
                        <div class="batch-box" v-else>
                          <div class="batch-main">
                            <template
                              v-if="availList.length !== 0 || unavailList.length !==0 || faillList.length !== 0">
                              <div class="search-title">{{lang.template_text113}}({{availList.length}})</div>
                              <div class="avail-list" v-loading="batchLoading">
                                <!-- 可注册域名 -->
                                <el-checkbox-group v-model="batchCheckGroup" @change="handleBatchChange">
                                  <div class="batch-item" v-for="(item,index) in availList" :key="index">
                                    <div class="item-left">
                                      <el-checkbox :label="item.name">
                                        <span class="domain-name">{{item.name}}</span>
                                      </el-checkbox>
                                      <span class="domain-status"
                                        v-if="item.avail === 0">{{lang.template_text114}}</span>
                                      <span class="domain-status"
                                        v-if="(item.avail === 1 || item.avail === -2) && item.description">{{item.description}}</span>
                                    </div>
                                    <div class="item-right">
                                      <div class="premium-type" v-if="item.type && item.type === 'premium'">
                                        {{lang.template_text115}}
                                      </div>
                                      <el-popover placement="bottom" trigger="hover" v-if="item.avail === 1">
                                        <div class="pirce-box" slot="reference" v-loading="item.priceLoading">
                                          <span class="now-price">{{commonData.currency_prefix}}<span
                                              style="font-size: 0.18rem;  color: var(--color-price-text);">{{item.showPrice}}{{commonData.currency_suffix}}
                                            </span><span style="color: #485169;">/{{lang.common_cloud_text112}}</span>
                                          </span>
                                          <i style="margin-left: 0.1rem;color: #F6F7FB;" class="el-icon-arrow-down"></i>
                                        </div>
                                        <div class="price-list">
                                          <div class="price-item">
                                            <div class="price-year"></div>
                                            <div class="price-new">{{lang.template_text99}}</div>
                                            <div class="price-renew">{{lang.template_text100}}</div>
                                          </div>
                                          <div class="price-item" v-for="items in item.priceArr" :key="items.buyyear">
                                            <div class="price-year">{{items.buyyear}}{{lang.template_text101}}</div>
                                            <div class="price-new">{{commonData.currency_prefix}}{{items.buyprice}}{{commonData.currency_suffix}}
                                            </div>
                                            <div class="price-renew">
                                              {{commonData.currency_prefix}}{{items.renewprice}}{{commonData.currency_suffix}}
                                            </div>
                                          </div>
                                        </div>
                                      </el-popover>
                                      <el-button class="add-btn" type="primary" :plain="isAddCart(item)"
                                        :disabled="isAddCart(item)" v-if="item.avail === 1 "
                                        @click="addCart(item)">{{lang.template_text102}}</el-button>
                                    </div>
                                  </div>
                                </el-checkbox-group>
                              </div>
                              <div class="all-check" v-if="availList.length > 0">
                                <el-checkbox :indeterminate="isBatchIndeterminate" v-model="isBatchAllCheck"
                                  @change="handleBatchCheckAllChange">{{lang.template_text116}}</el-checkbox>
                                <el-button @click="addAllCart" type="primary"
                                  :loading="addAllLoading">{{lang.template_text117}}
                                </el-button>
                              </div>
                              <el-collapse v-model="activeNames" v-loading="batchLoading">
                                <el-collapse-item name="1" style="margin-top: 0.6rem;" v-show="unavailList.length > 0">
                                  <template slot="title">
                                    <div class="unavail-title">
                                      <span>{{lang.template_text118}}({{unavailList.length}})</span>
                                      <span class="open-text"
                                        v-if="activeNames.includes('1')">{{lang.template_text119}}</span>
                                      <span class="open-text" v-else>{{lang.template_text120}}</span>
                                    </div>
                                  </template>
                                  <div class="unavail-list">
                                    <div class="unavail-item" v-for="(item,index) in unavailList" :key="index">
                                      <span class="unavail-name">{{item.name}}</span>
                                      <span class="unavail-reason">{{item.reason}}</span>
                                    </div>
                                  </div>
                                </el-collapse-item>
                                <el-collapse-item name="2" style="margin-top: 0.4rem;" v-show="faillList.length > 0">
                                  <template slot="title">
                                    <div class="unavail-title">
                                      <span>{{lang.template_text121}}({{faillList.length}})</span>
                                      <span class="open-text"
                                        v-if="activeNames.includes('2')">{{lang.template_text119}}</span>
                                      <span class="open-text" v-else>{{lang.template_text120}}</span>
                                    </div>
                                  </template>
                                  <div class="unavail-list">
                                    <div class="unavail-item" v-for="(item,index) in faillList" :key="index">
                                      <span class="unavail-name">{{item.name}}</span>
                                      <span class="unavail-reason">{{item.reason}}</span>
                                    </div>
                                  </div>
                                </el-collapse-item>
                              </el-collapse>
                            </template>
                            <template v-else>
                              <div class="search-title">{{lang.template_text94}}</div>
                              <div class="batch-search" v-loading="batchLoading">
                                <img src="/{$template_catalog}/template/{$themes}/img/goodsList/search_domain.png"
                                  alt="">
                                <p>{{lang.template_text122}}</p>
                              </div>
                            </template>
                          </div>
                        </div>
                      </div>
                      <div class="domain-right">
                        <div class="car-top">
                          <span>
                            {{lang.template_text123}}
                          </span>
                          <span class="clear-car" @click="deleteClearCart()">
                            <svg t="1750669572885" class="icon" viewBox="0 0 1024 1024" version="1.1"
                              xmlns="http://www.w3.org/2000/svg" p-id="9781" width="16" height="16">
                              <path
                                d="M895.398771 267.822944 671.950695 267.822944 671.950695 100.238145c0-46.261745-37.501958-83.792903-83.790889-83.792903l-167.583792 0c-46.287924 0-83.79391 37.531157-83.79391 83.792903l0 167.584799-223.445056 0c-61.698102 0-111.723535 50.024426-111.723535 111.723535l0 55.860257c0 41.398553 22.522722 77.540227 55.981082 96.841965 0.190299 56.371748-0.120825 280.654522-0.120825 377.979786 3.818059 112.787799 111.723535 111.723535 111.723535 111.723535l307.238966 0 0-0.872958 20.968111 0c2.225187 0.568883 4.557103 0.872958 6.961514 0.872958s4.736326-0.304075 6.961514-0.872958l181.59341 0c2.225187 0.568883 4.557103 0.872958 6.961514 0.872958s4.735319-0.304075 6.960507-0.872958l132.69366 0c0 0 107.902455 1.066278 111.721521-111.532229 0-97.144027-0.310117-320.985791-0.119818-377.298133 33.45836-19.301738 55.983096-55.443412 55.983096-96.842972L1007.1213 379.546479C1007.122306 317.84737 957.096873 267.822944 895.398771 267.822944zM811.604862 965.328556l-83.790889 0L727.813973 742.644695c0-15.43837-12.494276-27.929625-27.930632-27.929625-15.43837 0-27.932646 12.491255-27.932646 27.929625l0 222.683861-139.65316 0L532.297535 742.644695c0-15.43837-12.491255-27.929625-27.930632-27.929625-15.43837 0-27.929625 12.491255-27.929625 27.929625l0 223.44707c0 0-69.151976 0-139.654167 0L336.783111 742.644695c0-15.43837-12.491255-27.929625-27.930632-27.929625-15.43837 0-27.929625 12.491255-27.929625 27.929625l0 223.44707-83.79391 0c-47.459923 0-84.064758-31.259351-83.790889-83.792903 0.351398-71.180823 0.136935-263.033253 0.040275-335.168591l781.981174 0c-0.097667 72.050761-0.311123 263.506483 0.040275 334.540303C895.670627 934.122569 859.066799 965.328556 811.604862 965.328556zM951.260036 435.406736c0 30.849554-25.01171 55.860257-55.860257 55.860257L113.337047 491.266993c-30.849554 0-55.862271-25.01171-55.862271-55.860257L57.474777 379.546479c0-30.849554 25.013724-55.863278 55.862271-55.863278l279.308334 0 0-167.583792c0-46.259732 37.502965-83.792903 83.790889-83.792903l55.860257 0c46.287924 0 83.792903 37.533171 83.792903 83.792903l0 167.583792 279.308334 0c30.849554 0 55.860257 25.013724 55.860257 55.863278L951.258022 435.406736z"
                                p-id="9782"></path>
                            </svg>
                            {{lang.template_text124}}</span>
                        </div>
                        <div class="car-box" v-loading="isCarLoading">
                          <div class="car-no" v-if="carList.length === 0">
                            {{lang.template_text125}}
                            <span v-show="carList.length === 0">{{lang.template_text126}}</span>
                            <span v-if="!isLogin" class="blue-a-text" @click="goLogin"> {{lang.template_text127}}</span>
                          </div>
                          <div class="car-list" v-else>
                            <el-checkbox-group v-model="checkList" @change="handleCheckedCitiesChange">
                              <div class="car-item" v-for="(item,index) in carList" :key="index">
                                <div class="caritem-top">
                                  <div class="car-name">
                                    <el-checkbox :label="item.positions">
                                      <span class="shop-name">{{item.config_options.domain}}</span>
                                    </el-checkbox>
                                    <div class="car-del" @click="deleteCart(item)">
                                      <svg t="1750669572885" class="icon" viewBox="0 0 1024 1024" version="1.1"
                                        xmlns="http://www.w3.org/2000/svg" p-id="9781" width="16" height="16">
                                        <path
                                          d="M895.398771 267.822944 671.950695 267.822944 671.950695 100.238145c0-46.261745-37.501958-83.792903-83.790889-83.792903l-167.583792 0c-46.287924 0-83.79391 37.531157-83.79391 83.792903l0 167.584799-223.445056 0c-61.698102 0-111.723535 50.024426-111.723535 111.723535l0 55.860257c0 41.398553 22.522722 77.540227 55.981082 96.841965 0.190299 56.371748-0.120825 280.654522-0.120825 377.979786 3.818059 112.787799 111.723535 111.723535 111.723535 111.723535l307.238966 0 0-0.872958 20.968111 0c2.225187 0.568883 4.557103 0.872958 6.961514 0.872958s4.736326-0.304075 6.961514-0.872958l181.59341 0c2.225187 0.568883 4.557103 0.872958 6.961514 0.872958s4.735319-0.304075 6.960507-0.872958l132.69366 0c0 0 107.902455 1.066278 111.721521-111.532229 0-97.144027-0.310117-320.985791-0.119818-377.298133 33.45836-19.301738 55.983096-55.443412 55.983096-96.842972L1007.1213 379.546479C1007.122306 317.84737 957.096873 267.822944 895.398771 267.822944zM811.604862 965.328556l-83.790889 0L727.813973 742.644695c0-15.43837-12.494276-27.929625-27.930632-27.929625-15.43837 0-27.932646 12.491255-27.932646 27.929625l0 222.683861-139.65316 0L532.297535 742.644695c0-15.43837-12.491255-27.929625-27.930632-27.929625-15.43837 0-27.929625 12.491255-27.929625 27.929625l0 223.44707c0 0-69.151976 0-139.654167 0L336.783111 742.644695c0-15.43837-12.491255-27.929625-27.930632-27.929625-15.43837 0-27.929625 12.491255-27.929625 27.929625l0 223.44707-83.79391 0c-47.459923 0-84.064758-31.259351-83.790889-83.792903 0.351398-71.180823 0.136935-263.033253 0.040275-335.168591l781.981174 0c-0.097667 72.050761-0.311123 263.506483 0.040275 334.540303C895.670627 934.122569 859.066799 965.328556 811.604862 965.328556zM951.260036 435.406736c0 30.849554-25.01171 55.860257-55.860257 55.860257L113.337047 491.266993c-30.849554 0-55.862271-25.01171-55.862271-55.860257L57.474777 379.546479c0-30.849554 25.013724-55.863278 55.862271-55.863278l279.308334 0 0-167.583792c0-46.259732 37.502965-83.792903 83.790889-83.792903l55.860257 0c46.287924 0 83.792903 37.533171 83.792903 83.792903l0 167.583792 279.308334 0c30.849554 0 55.860257 25.013724 55.860257 55.863278L951.258022 435.406736z"
                                          p-id="9782"></path>
                                      </svg>
                                      {{lang.template_text128}}
                                    </div>
                                  </div>
                                  <div class="car-year">
                                    <el-select v-model="item.selectYear" @change="(val)=>changeCart(val,item)">
                                      <el-option v-for="items in item.priceArr" :key="items.buyyear"
                                        :label="items.buyyear + lang.template_text101" :value="items.buyyear">
                                      </el-option>
                                    </el-select>
                                  </div>
                                </div>
                                <div class="car-bottom">
                                  <span>{{lang.template_text87}}：</span>
                                  <div v-loading="item.priceLoading" class="car-price">
                                    {{commonData.currency_prefix}}<span
                                      style="font-size: 0.18rem; margin-right: 0.02rem;">{{priceCalc(item)}}{{commonData.currency_suffix}} </span>
                                  </div>
                                </div>
                              </div>
                            </el-checkbox-group>
                          </div>
                        </div>
                        <div class="car-money">
                          <el-checkbox :indeterminate="isIndeterminate" v-model="isAllCheck"
                            @change="handleCheckAllChange">{{lang.template_text129}}</el-checkbox>
                          <div class="mon-right">
                            <p class="now-price">
                              {{lang.template_text87}}:
                              <span class="money-text">{{commonData.currency_prefix}}<span
                                  style="font-size: 0.24rem;">{{totalMoneyCalc.toFixed(2)}}{{commonData.currency_suffix}}</span>
                              </span>
                            </p>
                            <p class="original-price" v-if="showOriginal">
                              <span class="hide">{{lang.template_text87}}:{{commonData.currency_prefix}}</span>
                              {{originalPrice}}{{commonData.currency_suffix}}
                            </p>
                          </div>
                        </div>
                        <div class="car-settle">
                          <el-button type="primary" class="settle-btn"
                            @click="goBuyDomain">{{lang.template_text130}}</el-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <!-- SSL展示 -->
                <template v-else-if="isSsl">
                  <div class="ssl-box">
                    <!-- 左右布局 -->
                    <div class="ssl-content">
                      <!-- 左侧：产品列表 -->
                      <div class="ssl-left">
                        <!-- 筛选区 -->
                        <div class="ssl-filter">
                          <!-- 域名类型 -->
                          <div class="filter-item">
                            <span class="filter-label">{{lang.ssl_domain_type}}</span>
                            <el-radio-group v-model="sslDomainType" @input="getSslProducts">
                              <el-radio-button :label="item.value" v-for="(item,index) in domainTypeOptions"
                                :key="index">
                                {{item.label}}
                              </el-radio-button>
                            </el-radio-group>
                          </div>
                          <!-- 证书类型 -->
                          <div class="filter-item">
                            <span class="filter-label">{{lang.ssl_cert_type}}</span>
                            <el-radio-group v-model="sslCertType" @input="getSslProducts">
                              <el-radio-button :label="item.value" v-for="(item,index) in certTypeOptions" :key="index">
                                {{item.label}}
                              </el-radio-button>
                            </el-radio-group>
                          </div>
                          <!-- 证书品牌 -->
                          <div class="filter-item">
                            <span class="filter-label">{{lang.ssl_brand}}</span>
                            <el-radio-group v-model="sslBrandId" @input="getSslProducts">
                              <el-radio-button :label="item.id" v-for="(item,index) in sslBrands" :key="index">
                                {{item.name}}
                              </el-radio-button>
                            </el-radio-group>
                          </div>
                        </div>
                        <el-table :data="sslProducts" v-loading="sslLoading" highlight-current-row
                          @row-click="selectSslProduct" style="width: 100%">
                          <el-table-column width="55">
                            <template slot-scope="scope">
                              <el-radio v-model="sslSelectedProductId" :label="scope.row.id">&nbsp;</el-radio>
                            </template>
                          </el-table-column>
                          <el-table-column prop="name" :label="lang.ssl_product_name" min-width="150"></el-table-column>
                          <el-table-column :label="lang.ssl_product_info" min-width="200">
                            <template slot-scope="scope">
                              <span>{{scope.row.brand_name}} {{scope.row.cert_type}} {{lang.ssl_cert}}</span>
                            </template>
                          </el-table-column>
                          <el-table-column :label="lang.ssl_price" width="180">
                            <template slot-scope="scope">
                              <span>{{commonData.currency_prefix}}{{scope.row.prices && scope.row.prices[0]?.base_price}}{{commonData.currency_suffix}}</span>
                            </template>
                          </el-table-column>
                          <el-table-column :label="lang.ssl_wildcard_multi" width="200">
                            <template slot-scope="scope">
                              <span>{{scope.row.support_wildcard === 1 ? lang.ssl_wildcard_multi_yes : lang.ssl_wildcard_multi_no}}/{{scope.row.support_san
                                === 1 ? lang.ssl_wildcard_multi_yes : lang.ssl_wildcard_multi_no}}</span>
                            </template>
                          </el-table-column>
                        </el-table>
                      </div>
                      <!-- 右侧：配置区 -->
                      <div class="ssl-right" v-if="sslSelectedProduct">
                        <div class="right-title">{{lang.ssl_config_preview}}</div>
                        <div class="right-content">
                          <!-- 多域名数量 -->
                          <div class="config-item"
                            v-if="sslSelectedProduct.support_standard === 1 && sslSelectedProduct?.support_san === 1 && sslSelectedProduct?.max_domain > 0">
                            <span class="config-label">{{lang.ssl_san_count}}</span>
                            <el-input-number v-model="sslSanCount"
                              :min="sslSelectedProduct?.support_wildcard === 1 ? 0 : (sslSelectedProduct?.min_san_count || 0)"
                              :max="sslSelectedProduct?.max_domain || 0" size="small" @change="handleSanChange">
                            </el-input-number>
                          </div>
                          <!-- 通配符数量 -->
                          <div class="config-item"
                            v-if="sslSelectedProduct?.support_wildcard === 1 && sslSelectedProduct?.max_domain > 0">
                            <span class="config-label">{{lang.ssl_wildcard_count}}</span>
                            <el-input-number v-model="sslWildcardCount"
                              :min="sslSelectedProduct?.support_standard === 1 && sslSelectedProduct?.support_san === 1 ? 0 : (sslSelectedProduct?.min_san_count || 0)"
                              :max="sslSelectedProduct?.max_domain || 0" size="small" @change="handleWildcardChange">
                            </el-input-number>
                          </div>
                          <!-- 标准|通配符域名数 -->
                          <div class="config-item" v-if="sslSelectedProduct?.domain_num > 0">
                            <span
                              class="config-label">{{sslSelectedProduct.default_type === 'wildcard' ? lang.ssl_wildcard_domain_count : lang.ssl_standard_count}}</span>
                            <el-input-number :value="sslSelectedProduct?.domain_num" size="small" :controls="false"
                              disabled>
                            </el-input-number>
                          </div>
                          <!-- 订购时长 -->
                          <div class="config-item">
                            <span class="config-label">{{lang.ssl_years}}</span>
                            <el-select v-model="sslYears" size="small" style="width: 120px;"
                              @change="handleSslYearsChange">
                              <el-option v-for="item in (sslSelectedProduct?.prices || [])" :key="item.years"
                                :label="item.years + '年'" :value="item.years"></el-option>
                            </el-select>
                          </div>
                          <!-- 订购数量 -->
                          <div class="config-item">
                            <span class="config-label">{{lang.ssl_qty}}</span>
                            <el-input-number v-model="sslQty" :min="1" :max="999" size="small"
                              @change="handleSslQtyChange">
                            </el-input-number>
                          </div>
                        </div>
                        <div class="right-footer" v-loading="sslLoadingPrice">
                          <!-- 配置信息 -->
                          <el-popover placement="top" width="400" trigger="hover"
                            popper-class="ssl-config-detail-popover" v-if="sslPreview.length > 0">
                            <div class="content">
                              <div class="tit">{{lang.ssl_config_detail}}</div>
                              <div class="con">
                                <p class="c-item" v-for="(item, index) in sslPreview" :key="index">
                                  <span class="l-txt">{{item.name}}：{{item.value}}</span>
                                  <span class="price">{{commonData.currency_prefix}}{{item.price}}{{commonData.currency_suffix}}</span>
                                </p>
                              </div>
                            </div>
                            <a class="config-info-link" slot="reference">{{lang.ssl_config_detail}}</a>
                          </el-popover>
                          <!-- 价格区域 -->
                          <div class="config-item price-area">
                            <span class="config-label" style="width: auto;min-width: auto;">{{lang.ssl_total}}</span>
                            <div class="price-display">
                              <div class="price-main">
                                <template v-if="sslDiscount > 0 || sslLevelNum > 0 || sslEventDiscount > 0">
                                  <span class="currency">{{commonData.currency_prefix}}</span>
                                  <span class="amount">{{sslCalcTotalPrice.toFixed(2)}}{{commonData.currency_suffix}}</span>
                                  <span class="discount-info">
                                    <el-popover placement="top" width="200" trigger="hover" popper-class="level-pup">
                                      <div class="show-config-list">
                                        <p v-if="sslLevelNum > 0">
                                          {{lang.shoppingCar_tip_text2}}：{{commonData.currency_prefix}}{{(sslLevelNum *
                                          1).toFixed(2)}}{{commonData.currency_suffix}}
                                        </p>
                                        <p v-if="sslDiscount > 0">
                                          {{lang.shoppingCar_tip_text4}}：{{commonData.currency_prefix}}{{(sslDiscount *
                                          1).toFixed(2)}}{{commonData.currency_suffix}}
                                        </p>
                                        <p v-if="sslEventDiscount > 0">
                                          {{lang.goods_text4}}：{{commonData.currency_prefix}}{{(sslEventDiscount *
                                          1).toFixed(2)}}{{commonData.currency_suffix}}
                                        </p>
                                      </div>
                                      <i class="el-icon-warning-outline total-icon" slot="reference"></i>
                                    </el-popover>
                                  </span>
                                </template>
                                <template v-else>
                                  <span class="currency">{{commonData.currency_prefix}}</span>
                                  <span class="amount">{{sslTotalPrice.toFixed(2)}}{{commonData.currency_suffix}}</span>
                                </template>
                              </div>
                              <div class="promo-actions">
                                <span v-if="sslDiscount > 0 || sslLevelNum > 0 || sslEventDiscount > 0"
                                  class="original-price">
                                  {{commonData.currency_prefix}}{{sslTotalPrice.toFixed(2)}}{{commonData.currency_suffix}}
                                </span>
                                <!-- 优惠码组件 -->
                                <discount-code v-if="hasDiscount" @get-discount="sslGetDiscount(arguments)"
                                  @remove-discount="sslRemoveDiscountCode" scene='new' :qty="sslQty"
                                  :product_id="product_id" :amount="sslTotalPrice" :billing_cycle_time="sslYears">
                                </discount-code>
                                <!-- 活动插件 -->
                                <event-code v-if="isShowFull" :product_id="product_id" :qty="sslQty"
                                  :amount="sslTotalPrice" :billing_cycle_time="sslYears" @change="sslEventChange">
                                </event-code>
                              </div>
                            </div>
                          </div>
                          <!-- 购买按钮 -->
                          <div class="config-item buy-area">
                            <el-button type="primary" class="buy-btn" :disabled="disabledJump"
                              @click="goBuySsl">{{lang.buy_now}}</el-button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
        <div class="up-dialog">
          <el-dialog width="6.8rem" :visible.sync="isShowUpload" :show-close=false>
            <div class="dia-title">{{lang.template_text131}}</div>
            <div class="dia-concent">
              <p class="up-tips">{{lang.template_text132}}</p>
              <div class="file-box">
                <input accept="text/plain" type="file" id="upFile" autocomplete="off" tabindex="-1"
                  style="display: none;">
                <input class="file-name" :placeholder="lang.template_text133" readonly :value="fileName">
                <!-- 选择文件按钮 -->
                <div class="file-btn" @click="selectFile">{{lang.template_text134}}</div>
              </div>
            </div>
            <div class="dia-foter">
              <el-button class="confim-btn" @click="confirmUpload">{{lang.template_text135}}</el-button>
              <el-button class="cancel-btn" @click="cancelUpload">{{lang.template_text136}}</el-button>
            </div>
          </el-dialog>
        </div>
              <!-- 价格计算器（父页级右侧栏；数据经同源 iframe 桥接自模块计价，v6） -->
            </div>
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
  <!-- =======页面独有======= -->
  <script src="/{$template_catalog}/template/{$themes}/components/scrollText/scrollText.js"></script>
  <script src="{:cra1_theme_asset_url('native', 'components/payDialog/payDialog.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/components/payDialog/payDialog.js')}"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/customGoods/customGoods.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/discountCode/discountCode.js"></script>
  <script src="/{$template_catalog}/template/{$themes}/components/eventCode/eventCode.js"></script>
  <script src="/{$template_catalog_cart}/template/{$themes_cart}/api/goodsList.js?v={:filemtime(IDCSMART_ROOT . 'public/cart/template/pc/cra1/api/goodsList.js')}"></script>
  <script src="{:cra1_theme_asset_url('cart', '20261013-security-snapshot-v1/js/cart-config.js', '/cart/template/pc/cra1/releases/20261013-security-snapshot-v1/js/cart-config.js')}"></script>
<script src="{:cra1_theme_asset_url('cart', '20261012-icon-suite-v1/js/cart-controls.js', '/cart/template/pc/cra1/releases/20261012-icon-suite-v1/js/cart-controls.js')}"></script>
<script src="{:cra1_theme_asset_url('cart', '20261017-compat-v3/js/goodsList.js', '/cart/template/pc/cra1/releases/20261017-compat-v3/js/goodsList.js')}"></script>
  <script src="/{$template_catalog_cart}/template/{$themes_cart}/api/product.js?v={:filemtime(IDCSMART_ROOT . 'public/cart/template/pc/cra1/api/product.js')}"></script>
