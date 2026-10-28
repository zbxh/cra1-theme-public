(function (window, undefined) {
  var old_onload = window.onload;
  window.onload = function () {
    const template = document.getElementsByClassName("template")[0];
    Vue.prototype.lang = window.lang;
    new Vue({
      components: {
        asideMenu,
        topMenu,
        scrollText,
        discountCode,
        eventCode,
      },
      created() {
        window.addEventListener("scroll", this.scrollBottom);
        // 监听 页面点击事件 用于关闭 isShowSuffixBox
        document.addEventListener("click", (e) => {
          const classNameArr = [
            "suffix-list",
            "suffix-box",
            "suffix-item",
            "suffix-item suffix-active",
            "el-icon-arrow-down select-btn",
          ];
          if (!classNameArr.includes(e.target.className)) {
            this.isShowSuffixBox = false;
          }
        });

        this.getCommonData();
        this.getCarList();
        // 购物车主题后台文案（cra1admin cart 配置域公开快照；拉取失败走多语言默认）
        if (window.__CRA1_CART_SNAPSHOT_PROMISE__) {
          window.__CRA1_CART_SNAPSHOT_PROMISE__.then((snap) => {
            const gl = snap?.content?.goodslist;
            if (gl) {
            // v2 嵌套结构
            const copy = gl.copy || {};
            if (copy.title) this.pageTitle = copy.title;
            if (copy.subtitle) this.pageSubtitle = copy.subtitle;
            if (Object.prototype.hasOwnProperty.call(copy, 'card_title')) this.cardTitle = copy.card_title;
            if (copy.tabs_title) this.railTabsTitle = copy.tabs_title;
            if (copy.show_desc === false) this.showGroupDesc = false;
            // 受控网格（列数/每批行数）与卡片展示规则
            if (gl.grid && typeof gl.grid === "object") this.gridConf = gl.grid;
            if (Array.isArray(gl.card_sections)) {
              const enabled = gl.card_sections.filter((s) => s && s.enabled !== false).map((s) => s.key);
              this.cardSections = enabled;
            }
            if (gl.config_panel && typeof gl.config_panel === "object") {
              this.configPanel = gl.config_panel;
              if (!this.selectedProductId) this.configOpen = gl.config_panel.default_open !== false;
            }
            this.defaultProductId = Number(gl.default_selection?.product_id) || 0;
            // 受控分页：行数×当前列数推导每批条数（上限 24）
            this.goodsParmas.limit = this.limitFromGrid || this.goodsParmas.limit;
            }
            this.cartConfigReady = true;
            if (!this.goodSLoading && !this.selectedProductId) this.applyDefaultSelection(this.goodsList);
          });
        }

        this.fpg_id = this.getQuery("fpg_id") * 1;
        this.spg_id = this.getQuery("spg_id") * 1;
        this.urlProductId = this.getQuery("product_id") * 1 || 0;
        this.initializeProductEntry();
        this.host_id = this.getQuery("host_id") * 1;
        this.domainInput = this.getQuery("domain");
      },
      mounted() {
        // 融合页：消息桥 / 历史状态 / 视口监听
        this.__embedHandler = (e) => this.handleEmbedMessage(e);
        this.__popHandler = () => this.handlePopState();
        this.__viewportHandler = () => this.handleViewportChange();
        // v6.6：其他标签页加购时（storage 跨页广播）同步顶栏角标
        this.__cartStorageHandler = (e) => {
          if (e.key === "cartNum") this.refreshTopCart();
        };
        window.addEventListener("message", this.__embedHandler);
        window.addEventListener("popstate", this.__popHandler);
        window.addEventListener("resize", this.__viewportHandler);
        window.addEventListener("storage", this.__cartStorageHandler);
        this.$data.__viewportW = window.innerWidth;
        const addons_js_arr = JSON.parse(
          document.querySelector("#addons_js").getAttribute("addons_js")
        ); // 插件列表
        const arr = addons_js_arr.map((item) => {
          return item.name;
        });
        if (arr.includes("EventPromotion")) {
          // 开启活动满减
          this.isShowFull = true;
        }
        // 是否开启优惠码
        this.hasDiscount = arr.includes("PromoCode");
        // 是否开启用户等级
        this.isShowLevel = arr.includes("IdcsmartClientLevel");
        this.initData();
      },
      updated() {
        // 关闭loading
        document.getElementById("mainLoading").style.display = "none";
        document.getElementsByClassName("template")[0].style.display = "block";
      },
      destroyed() {
        window.removeEventListener("scroll", this.scrollBottom);
        window.removeEventListener("message", this.__embedHandler);
        window.removeEventListener("popstate", this.__popHandler);
        window.removeEventListener("resize", this.__viewportHandler);
        window.removeEventListener("storage", this.__cartStorageHandler);
        clearTimeout(this.embedTimer);
      },
      data() {
        return {
          isShowView: false,
          // 购物车主题后台文案（快照合并；空 = 多语言默认）
          pageTitle: "",
          pageSubtitle: "",
          cardTitle: "产品型号", // 卡片区标题（快照 card_title，后台可设；空串隐藏）
          railTabsTitle: "选配方式", // 选配方式标题（快照 tabs_title，后台可设）
          showGroupDesc: true,
          // ---- 融合页：商品选择 + 下方配置区 ----
          navFirstLabel: "",   // v10 一级导航名称（/console/v1/common）
          navSecondLabel: "",  // v10 二级导航名称
          selectedProductId: 0,
          selectedProduct: null,
          entryProductId: 0, // URL 配置及购物车编辑数据只属于进入时的商品
          entryCartEdit: false,
          configState: "idle", // idle | loading | ready | error
          configErrorText: "",
          embedNonce: "",
          embedSeq: 0,         // 每次创建 iframe 自增，校验迟到消息
          frameHeight: 320,
          // ---- 价格计算器（v6）：桥接状态与数据 ----
          railTitle: "价格计算器",
          railState: "idle",
        /* v12 手机档：配置直渲染进父页（无 iframe），抽屉/弹层全页覆盖 */
        isMobileCart: /android|iphone|ipod|mobile/i.test(navigator.userAgent) && !/ipad/i.test(navigator.userAgent),
        mobileRailTimer: null,
        mobileLoadSeq: 0,
        dockDetailOpen: false,
        couponOpen: false,   // idle | bridged | fallback
          railLoading: false,
          railDurations: [],
          railDurationId: 0,
          railQty: { allow: false, min: 1, max: 999, cur: 1 },
          railPrice: { currency: "", suffix: "", calcText: "", originText: "", hasDiscount: false },
          railPreview: [], // 当前配置明细（桥接 preview）
          railCoupon: "",
          railFallbackText: "",
          gridConf: null,      // 快照 v2：{desktop_columns, tablet_columns, mobile_columns, rows_per_load, desc_max_lines}
          cardSections: null, // 快照 v2：卡片展示区块（顺序+显隐）
          cartConfigReady: !window.__CRA1_CART_SNAPSHOT_PROMISE__,
          defaultProductId: 0,
          configOpen: true,
          configPanel: null,   // 快照 v2：{default_open, sticky_summary}
          urlProductId: 0,
          searchValue: "", // 搜索内容
          searchLoading: false,
          select_first_obj: {
            id: "", // 一级分组ID
            type: "", // 一级分组类型
          }, // 选中的一级分类对象
          select_second_obj: {
            id: "", // 二级分组ID
            type: "", // 二级分组类型
            description: "", // 二级分组描述
          }, // 选中的一级分类对象
          first_group_list: [], // 一级分类数组
          second_group_list: [], // 二级分类数组
          commonData: {},
          scrollDisabled: false,
          secondLoading: false, // 二级分类加载
          goodSLoading: false,
          catalogError: "",
          catalogRetry: "initial",
          goodsListRequestId: 0, // 商品列表请求序号,用于忽略过期响应
          secondGroupRequestId: 0, // 二级分组请求序号,用于忽略过期响应
          goodsParmas: {
            keywords: "", // 关键字,搜索范围:商品ID,商品名,描述
            id: "", // 二级分组ID
            page: 1, // 页数
            limit: 12, // 每页条数（快照 v2 rows_per_load×列数 会覆盖）
          },
          goodsList: [], // 商品列表数组
          regType: "1",
          domainInput: "",
          selectSuffix: "",
          isAllCheck: false,
          isShowFull: false,
          suffixList: [],
          domainList: [],
          isSearching: false,
          isShowSuffixBox: false,
          carList: [],
          checkList: [],
          product_id: "",
          isCarLoading: false,
          isIndeterminate: false,
          isBatchIndeterminate: false,
          isBatchAllCheck: false,
          batchLoading: false,
          addAllLoading: false,
          textarea2: "",
          batchCheckGroup: [],
          availList: [],
          unavailList: [],
          faillList: [],
          activeNames: [],
          domainConfig: {},
          isShowUpload: false,
          fileName: "",
          fileContent: "",
          originalPrice: 0.0,
          /* 传参搜索 */
          fpg_id: "",
          spg_id: "",
          host_id: "",
          isShowFilrer: false,
          selectFilterSuffix: [],
          // #region SSL 证书相关数据
          sslLoading: false,             // 产品列表加载状态
          sslBrands: [],                 // 品牌列表
          sslCertTypes: [],              // 可用证书类型列表
          sslProducts: [],               // 产品列表
          sslSelectedProduct: null,      // 当前选中的产品
          sslSelectedProductId: null,    // 当前选中的产品ID（用于radio）
          sslDomainType: 'single',       // 域名类型: single/multi/wildcard/ip
          sslCertType: 'DV',             // 证书类型: DV/OV/EV
          sslBrandId: null,              // 品牌ID
          sslSanCount: 0,                // 多域名数量
          sslWildcardCount: 0,           // 通配符数量
          sslYears: 1,                   // 订购年限
          sslQty: 1,                     // 订购数量
          // SSL 价格相关
          sslTotalPrice: 0,              // 原价
          sslCalcTotalPrice: 0,          // 折后总价
          sslDiscount: 0,                // 优惠码折扣
          sslLevelNum: 0,                // 等级折扣
          sslEventDiscount: 0,           // 活动折扣
          sslLoadingPrice: false,        // 价格计算加载状态
          sslPromo: {                    // 优惠参数
            scene: "new",
            promo_code: "",
            billing_cycle_time: "",
            event_promotion: "",
          },
          sslEventData: {                // 活动数据
            id: "",
            discount: 0,
          },
          sslPreview: [],                // 配置费用明细
          hasDiscount: false,            // 是否开启优惠码插件
          isShowLevel: false,            // 是否开启用户等级插件
          isShowFull: false,             // 是否开启活动插件
          // 固定选项
          domainTypeOptions: [
            { label: lang.ssl_text_single, value: 'single' },
            { label: lang.ssl_text_multi, value: 'multi' },
            { label: lang.ssl_text_wildcard, value: 'wildcard' },
            { label: 'IP', value: 'ip' }
          ],
          certTypeOptions: [
            { label: 'DV', value: 'DV' },
            { label: 'OV', value: 'OV' },
            { label: 'EV', value: 'EV' }
          ],
          disabledJump: false, // 禁用跳转
          // #endregion
        };
      },
      filters: {
        formateTime(time) {
          if (time && time !== 0) {
            return formateDate(time * 1000);
          } else {
            return "--";
          }
        },
      },
      computed: {
        // 当前类型：'normal' | 'domain' | 'ssl'
        currentType() {
          const type = this.select_second_obj.type;
          return type || 'normal';
        },
        // 是否为普通商品类型
        isNormal() {
          return this.currentType === 'normal';
        },
        // 是否为域名类型
        isDomain() {
          return this.currentType === 'domain';
        },
        // 是否为SSL类型
        isSsl() {
          return this.currentType === 'ssl';
        },
        // ---- 融合页：受控响应式网格（快照 v2；缺省回落自适应规则） ----
        viewportW() {
          return this.$data.__viewportW || (typeof window !== "undefined" ? window.innerWidth : 1440);
        },
        currentColumns() {
          const g = this.gridConf || {};
          const w = this.viewportW;
          if (w < 768) return g.mobile_columns || 1;
          if (w < 1280) return g.tablet_columns || 2;
          return g.desktop_columns || 3;
        },
        gridStyle() {
          const n = this.currentColumns;
          if (!n || n < 1) return "";
          return { "--cart-cols": String(n) };
        },
        limitFromGrid() {
          const g = this.gridConf || {};
          const rows = Math.min(Math.max(parseInt(g.rows_per_load, 10) || 3, 1), 6);
          return Math.min(rows * this.currentColumns, 24);
        },
        embedSrc() {
          if (this.isMobileCart) return "";
          if (!this.selectedProductId || this.configState === "error") return "";
          if(window.__THEME_PREVIEW__){const u=new URL(window.location.href);u.searchParams.set('part','goods');u.searchParams.set('id','1');u.searchParams.set('embed','1');u.searchParams.set('embed_nonce',this.embedNonce);return u.pathname+u.search;}
          const url = this.productConfigUrl("/cart/goods_embed.htm", this.selectedProductId);
          url.searchParams.set("embed", "1");
          url.searchParams.set("embed_nonce", this.embedNonce);
          // V10 module parsers decode percent escapes, but do not decode '+' spaces.
          return url.pathname + url.search.replace(/\+/g, "%20");
        },
        isEditingCartItem() {
          return this.entryCartEdit && Number(this.selectedProductId) === this.entryProductId;
        },
        // 卡片展示区块顺序（快照 card_sections；desc 恒在卡头位；v4 卡片无购买按钮）
        orderedSections() {
          // desc 不再强制置顶：它在模板里是独立区块（卡头下方），
          // 是否显示由后台上该区块的启停决定（此前硬插 desc 导致该开关点了没反应）
          if (Array.isArray(this.cardSections)) {
            return this.cardSections.slice();
          }
          return ['desc', 'tags', 'stock', 'promo', 'price'];
        },
        // ---- 商品描述安全预览：仅保留白名单标签与协议 ----
        sanitizeDescription() {
          return (html) => this.sanitizeHtml(html);
        },
        // 计算购物车选中的商品的总价
        totalMoneyCalc() {
          let total = 0;
          this.carList.forEach((item) => {
            if (this.checkList.includes(item.positions)) {
              total += this.priceCalc(item) * 1000;
            }
          });
          const firstDiscount = this.carList.filter(
            (item) => this.checkList[0] === item.positions
          );
          let domainDiscount = 0;
          if (firstDiscount.length > 0) {
            domainDiscount = firstDiscount[0]?.priceArr[0]?.discount;
          }
          this.originalPrice = (total / 1000).toFixed(2);
          let temp = (total - domainDiscount * 1000) / 1000;
          if (isNaN(temp)) {
            temp = 0.0;
          }
          return temp;
        },
        showDomainList() {
          return (
            this.domainList.filter((item) => {
              return (
                item.avail === 0 ||
                (item.avail === 1 && item.priceArr.length > 0)
              );
            }) || []
          );
        },
        // 是否登录
        isLogin() {
          return window.localStorage.jwt ? true : false;
        },
        calcDomainList() {
          if (this.selectFilterSuffix.length === 0) {
            return this.showDomainList;
          } else {
            return this.showDomainList.filter((item) => {
              return this.selectFilterSuffix.includes(
                this.getDomainSuffix(item.name).suffix
              );
            });
          }
        },
        fillterDomainSuffix() {
          // 根据域名后缀分类
          return [
            ...new Set(
              this.showDomainList.map((item) => {
                return this.getDomainSuffix(item.name).suffix;
              })
            ),
          ];
        },
        showOriginal() {
          const firstDiscount = this.carList.filter(
            (item) => this.checkList[0] === item.positions
          );
          const domainDiscount = firstDiscount[0]?.priceArr[0]?.discount;
          if (this.checkList.length > 0 && domainDiscount > 0) {
            return true;
          } else {
            return false;
          }
        },
      },
      methods: {
        // #region SSL 证书相关方法
        // 获取 SSL 品牌列表
        async getSslBrands() {
          try {
            const res = await brandList();
            this.sslBrands = res.data.data.list || [];
            // 默认选中第一个品牌
            if (this.sslBrands.length > 0) {
              this.sslBrandId = this.sslBrands[0].id;
            }
            // 获取产品列表
            this.getSslProducts();
          } catch (error) {
            this.$message.error(error.data?.msg || lang.ssl_get_brands_failed || '获取品牌列表失败');
          }
        },
        // 获取 SSL 产品列表
        async getSslProducts() {
          this.sslLoading = true;
          try {
            const params = {
              cert_type: this.sslCertType,
              brand_id: this.sslBrandId,
              domain_type: this.sslDomainType,
            };
            const res = await sslProductList(params);
            const data = res.data.data;
            this.sslProducts = data.products || [];
            this.sslCertTypes = data.cert_types || [];
            this.sslBrands = data.brands || this.sslBrands;
            // 默认选中第一个产品
            if (this.sslProducts.length > 0) {
              this.selectSslProduct(this.sslProducts[0]);
            } else {
              this.sslSelectedProduct = null;
              this.sslSelectedProductId = null;
            }
          } catch (error) {
            this.$message.error(error.data?.msg || lang.ssl_get_products_failed || '获取产品列表失败');
          } finally {
            this.sslLoading = false;
          }
        },
        // 选择 SSL 产品
        selectSslProduct(product) {
          this.sslSelectedProduct = product;
          this.sslSelectedProductId = product?.id || null;
          // 初始化计数器
          const minSan = product?.min_san_count || 0;
          const showSan = product?.support_standard === 1 && product?.support_san === 1;
          const showWildcard = product?.support_wildcard === 1;
          if (showSan) {
            // 显示多域名时，min_san_count 赋给 sslSanCount
            this.sslSanCount = minSan;
            this.sslWildcardCount = 0;
          } else if (showWildcard) {
            // 不显示多域名但显示通配符时，min_san_count 赋给 sslWildcardCount
            this.sslSanCount = 0;
            this.sslWildcardCount = minSan;
          } else {
            // 都不显示时，都设为0
            this.sslSanCount = 0;
            this.sslWildcardCount = 0;
          }
          // 默认选中第一个年限
          if (product?.prices && product.prices.length > 0) {
            this.sslYears = product.prices[0].years;
          }
          // 重置优惠码和活动
          this.sslPromo.promo_code = "";
          this.sslPromo.event_promotion = "";
          this.sslEventData.id = "";
          this.sslDiscount = 0;
          this.sslEventDiscount = 0;
          // 重置价格，避免旧价格影响活动插件计算
          this.sslTotalPrice = 0;
          this.sslCalcTotalPrice = 0;
          // 延迟计算价格，避免和 event-code 组件的 billing_cycle_time 变化冲突
          this.$nextTick(() => {
            this.calcSslPrice();
          });
        },
        // 通配符数量变化
        handleWildcardChange(val) {
          const product = this.sslSelectedProduct;
          if (!product) return;
          const minSanCount = product.min_san_count || 0;
          const maxDomain = product.max_domain || 0;
          const showSan = product.support_standard === 1 && product.support_san === 1;
          const total = val + this.sslSanCount;
          if (showSan) {
            // san 支持时，此消彼长
            if (total < minSanCount) {
              const need = minSanCount - val;
              this.sslSanCount = Math.min(need, maxDomain);
            }
          } else {
            // san 不支持时，wildcard 不能低于 min_san_count
            if (val < minSanCount) {
              this.sslWildcardCount = minSanCount;
            }
          }
          // 重置价格后重新计算，避免活动插件使用旧价格
          this.sslTotalPrice = 0;
          this.$nextTick(() => {
            this.calcSslPrice();
          });
        },
        // 多域名数量变化
        handleSanChange(val) {
          const product = this.sslSelectedProduct;
          if (!product) return;
          const minSanCount = product.min_san_count || 0;
          const maxDomain = product.max_domain || 0;
          const showWildcard = product.support_wildcard === 1;
          const total = val + this.sslWildcardCount;
          if (showWildcard) {
            // wildcard 支持时，此消彼长
            if (total < minSanCount) {
              const need = minSanCount - val;
              this.sslWildcardCount = Math.min(need, maxDomain);
            }
          } else {
            // wildcard 不支持时，san 不能低于 min_san_count
            if (val < minSanCount) {
              this.sslSanCount = minSanCount;
            }
          }
          // 重置价格后重新计算，避免活动插件使用旧价格
          this.sslTotalPrice = 0;
          this.$nextTick(() => {
            this.calcSslPrice();
          });
        },
        // 订购年限变化
        handleSslYearsChange() {
          // 重置价格后重新计算，避免活动插件使用旧价格
          this.sslTotalPrice = 0;
          this.$nextTick(() => {
            this.calcSslPrice();
          });
        },
        // 订购数量变化
        handleSslQtyChange() {
          // 重置价格后重新计算，避免活动插件使用旧价格
          this.sslTotalPrice = 0;
          this.$nextTick(() => {
            this.calcSslPrice();
          });
        },

        // 计算 SSL 价格
        async calcSslPrice() {
          if (!this.sslSelectedProduct) return;
          this.sslLoadingPrice = true;
          try {
            let params = {
              id: this.product_id,
              config_options: {
                ssl_product_id: this.sslSelectedProduct.id,
                wildcard_count: this.sslWildcardCount,
                san_count: this.sslSanCount,
                years: this.sslYears,
                event_promotion: this.sslPromo.event_promotion,
                promo_code: this.sslPromo.promo_code,
              },
              qty: this.sslQty,
            };
            // 处理 max_domain === 0 的情况
            if (this.sslSelectedProduct?.max_domain === 0) {
              params.config_options.wildcard_count = 0;
              params.config_options.san_count = 0;
            }
            const res = await calcPrice(params);
            const newPrice = res.data.data.price * 1;
            // 只有当价格真正变化时才更新，避免触发不必要的 watcher
            if (Math.abs(this.sslTotalPrice - newPrice) > 0.01) {
              this.sslTotalPrice = newPrice;
            }
            this.disabledJump = Number(res.data.data?.price || 0) === 0 ? true : false;
            this.sslCalcTotalPrice = res.data.data.price_total * 1;
            this.sslDiscount = res.data.data.price_promo_code_discount * 1 || 0;
            this.sslLevelNum = res.data.data.price_client_level_discount * 1 || 0;
            this.sslEventDiscount = res.data.data.price_event_promotion_discount * 1 || 0;
            // 配置费用明细
            this.sslPreview = res.data.data.preview || [];
          } catch (error) {
            this.$message.error(error.data.msg);
          } finally {
            this.sslLoadingPrice = false;
          }
        },
        // SSL 活动变更
        sslEventChange(eventObj) {
          if (this.sslEventData.id !== eventObj.id) {
            this.sslEventData.id = eventObj.id || "";
            this.sslPromo.event_promotion = this.sslEventData.id;
            this.calcSslPrice();
          }
        },
        // SSL 使用优惠码
        sslGetDiscount(data) {
          this.sslPromo.promo_code = data[1];
          this.calcSslPrice();
        },
        // SSL 移除优惠码
        sslRemoveDiscountCode() {
          this.sslPromo.promo_code = "";
          this.sslDiscount = 0;
          this.calcSslPrice();
        },
        // SSL 立即购买
        goBuySsl() {
          if (!this.sslSelectedProduct) return;
          let params = {
            id: this.product_id,
            config_options: {
              ssl_product_id: this.sslSelectedProduct.id,
              wildcard_count: this.sslWildcardCount,
              san_count: this.sslSanCount,
              years: this.sslYears,
            },
            qty: this.sslQty,
            customfield: this.sslPromo,
          };
          // 处理 max_domain === 0 的情况
          if (this.sslSelectedProduct?.max_domain === 0) {
            params.config_options.wildcard_count = 0;
            params.config_options.san_count = 0;
          }
          // 存储购买信息并跳转到结算页面
          sessionStorage.setItem('product_information', JSON.stringify(params));
          location.href = '/cart/settlement.htm';
        },
        // #endregion

        openFilter() {
          this.isShowFilrer = !this.isShowFilrer;
          this.selectFilterSuffix = [];
        },
        handelFilterSuffix(item) {
          const index = this.selectFilterSuffix.indexOf(item);
          if (index !== -1) {
            this.selectFilterSuffix.splice(index, 1);
          } else {
            this.selectFilterSuffix.push(item);
          }
        },
        calcEvent(eventList) { },
        getQuery(name) {
          return new URLSearchParams(window.location.search).get(name);
        },
        initializeProductEntry() {
          this.entryProductId = this.urlProductId;
          let info = null;
          try { info = JSON.parse(sessionStorage.getItem("product_information") || "null"); } catch (_) { }
          const wantsEdit = ["true", "1"].includes(this.getQuery("change"));
          this.entryCartEdit = !!(wantsEdit && this.entryProductId && info &&
            typeof info === "object" && !Array.isArray(info) && info.config_options &&
            (info.product_id == null || Number(info.product_id) === this.entryProductId));
          if (!this.entryCartEdit) {
            sessionStorage.removeItem("product_information");
            // An expired/copied edit link without its tab's cart data is ordinary browsing.
            if (this.getQuery("change") !== null) {
              this.updateUrlParam("change", null, "replace");
              this.updateUrlParam("name", null, "replace");
            }
          }
        },
        clearProductEntry() {
          this.entryProductId = 0;
          this.entryCartEdit = false;
          sessionStorage.removeItem("product_information");
          for (const key of ["config", "change", "name"]) this.updateUrlParam(key, null, "replace");
        },
        productConfigUrl(path, productId) {
          const url = new URL(path, window.location.origin);
          const source = new URLSearchParams(window.location.search);
          const routing = ["id", "product_id", "fpg_id", "spg_id", "view_html", "embed", "embed_nonce", "standalone"];
          source.forEach((value, key) => {
            if (routing.includes(key)) return;
            if (["config", "change", "name"].includes(key) && Number(productId) !== this.entryProductId) return;
            url.searchParams.append(key, value);
          });
          url.searchParams.set("id", productId);
          return url;
        },
        goLogin() {
          sessionStorage.redirectUrl = "/cart/goodsList.htm";
          location.href = "/login.htm";
        },
        // 选择文件
        selectFile() {
          document.getElementById("upFile").click();
          // 监听文件上传
          document.getElementById("upFile").addEventListener("change", (e) => {
            // 获取文件
            const file = e.target.files[0];
            // 判断文件类型
            if (file.type !== "text/plain") {
              this.$message.warning(lang.template_text137);
              return;
            }
            // 读取文件名
            this.fileName = file.name;
            // 读取文件
            const reader = new FileReader();
            // 判断txt文件编码格式
            reader.readAsText(file, "utf-8");
            reader.onload = (e) => {
              const txtString = e.target.result;
              // utf-8 的 中文编码 正则表达式
              const patrn = /[\u4E00-\u9FA5]/gi;
              // 检测当前文本是否含有中文（如果没有，则当乱码处理）
              // 两个格式的英文编码一样，所以纯英文文件也当成乱码再处理一次
              if (!patrn.exec(txtString)) {
                let reader_gb2312 = new FileReader();
                // 再拿一次纯文本，这一次拿到的文本一定不会乱码
                reader_gb2312.readAsText(file, "gb2312");
                reader_gb2312.onload = (e2) => {
                  this.fileContent = e2.target.result;
                };
              } else {
                this.fileContent = txtString;
              }
            };
          });
        },
        confirmUpload() {
          // 解析输入框中的换行 把换行替换成\n 传字符串
          let params = this.fileContent
            .replace(/[\r\n]/g, ",")
            .split(",")
            .filter((item) => {
              return item !== "";
            });
          const maxLimt = this.domainConfig.number_limit || 500;
          if (params.length > maxLimt) {
            // 截取前500个
            params = params.slice(0, maxLimt);
          }
          this.textarea2 = params.join("\n");
          this.cancelUpload();
        },
        cancelUpload() {
          document.getElementById("upFile").value = "";
          document
            .getElementById("upFile")
            .removeEventListener("change", () => { });
          this.fileName = "";
          this.fileContent = "";
          this.isShowUpload = false;
        },
        // 获取域名设置
        getDomainSet() {
          domainSetting().then((res) => {
            // 域名插件未配置时 data 可能为 undefined（示例站无该插件）：守卫后走默认值，不让分支崩
            const cfg = res.data.data || {};
            this.domainConfig = cfg;
            this.selectSuffix = cfg.default_search_domain || "";
            const suffixArr = this.suffixList.reduce((all, cur) => {
              all.push(cur.suffix);
              return all;
            }, []);
            if (
              suffixArr.length > 0 &&
              !suffixArr.includes(this.selectSuffix)
            ) {
              this.selectSuffix = this.suffixList[0].suffix;
            }
            // 官网跳转查询
            if (location.href.indexOf("suffix") !== -1) {
              this.selectSuffix = this.getQuery("suffix");
              this.handelDomainSearch();
            }
          });
        },
        // 是否已经加入购物车
        isAddCart(item) {
          const isHave = this.carList.find((cartItem) => {
            return cartItem.config_options.domain === item.name;
          });
          return Boolean(isHave);
        },
        // 价格计算
        priceCalc(item) {
          if (item.priceArr.length === 0) {
            return 0;
          }
          const price =
            item.priceArr.find((priceItem) => {
              return priceItem.buyyear === item.selectYear;
            }) || [];
          return price.buyprice;
        },
        goBuyDomain() {
          if (this.checkList.length === 0) {
            this.$message.warning(lang.template_text138);
            return;
          }
          if (!this.isLogin) {
            this.$message.warning(lang.template_text139);
            sessionStorage.redirectUrl = "/cart/goodsList.htm";
            this.goLogin();
            return;
          }
          sessionStorage.setItem(
            "buyDomainPosition",
            JSON.stringify(this.checkList)
          );
          if (this.host_id) {
            location.href = `/plugin/${getPluginId(
              "IdcsmartDomain"
            )}/buyDomain.htm?host_id=${this.host_id}`;
          } else {
            location.href = `/plugin/${getPluginId(
              "IdcsmartDomain"
            )}/buyDomain.htm`;
          }
        },
        // 批量查询域名
        batchSearchDomain() {
          if (!this.textarea2) {
            this.$message.warning(lang.template_text140);
            return;
          }
          // 解析输入框中的换行 把换行替换成\n 传字符串
          const params = this.textarea2
            .replace(/[\r\n]/g, ",")
            .split(",")
            .filter((item) => {
              return item !== "";
            })
            .join(",");
          const maxLimt = this.domainConfig.number_limit || 500;
          if (params.split(",").length - 1 >= maxLimt) {
            this.$message.warning(
              `${lang.template_text141}${maxLimt}${lang.template_text142}`
            );
            return;
          }
          this.batchLoading = true;
          domainBatch({ domains: params })
            .then((res) => {
              this.availList = res.data.data.avail.map((item) => {
                item.priceArr = [];
                item.showPrice = 0;
                item.priceLoading = true;
                return item;
              });
              // 查询可注册的域名价格
              this.availList.forEach((item) => {
                domainPrice({ name: item.name, host_id: this.host_id })
                  .then((res) => {
                    item.priceArr = res.data.data || [];
                    item.showPrice = res.data.data[0]?.buyprice || 0;
                  })
                  .finally(() => {
                    item.priceLoading = false;
                  });
              });
              this.unavailList = res.data.data.unavail;
              this.faillList = res.data.data.fail;
            })
            .catch((err) => { })
            .finally(() => {
              this.batchLoading = false;
            });
        },
        handleBatchChange(val) {
          let checkedCount = val.length;
          this.isBatchAllCheck = checkedCount === this.availList.length;
          this.isBatchIndeterminate =
            checkedCount > 0 && checkedCount < this.availList.length;
        },
        handleBatchCheckAllChange(val) {
          this.batchCheckGroup = val
            ? this.availList.map((item) => {
              return item.name;
            })
            : [];
          this.isBatchIndeterminate = false;
        },
        // 购物车列表
        getCarList() {
          this.isCarLoading = true;
          cartList().then((res) => {
            const arr = res.data.data.list
              .map((item, index) => {
                return {
                  ...item,
                  positions: index,
                  selectYear: item.config_options.year,
                  priceArr: [],
                  showPrice: 0,
                  priceLoading: true,
                };
              })
              .filter((item) => {
                return item.customfield.is_domain === 1;
              });
            // 拉取价格
            this.carList = arr;
            this.isCarLoading = false;
            this.carList.forEach((item) => {
              domainPrice({
                name: item.config_options.domain,
                host_id: this.host_id,
              })
                .then((res) => {
                  item.priceArr = res.data.data || [];
                  item.showPrice = res.data.data[0]?.buyprice || 0;
                })
                .catch((err) => { })
                .finally(() => {
                  item.priceLoading = false;
                });
            });
          }).catch(() => { this.isCarLoading = false; });
        },
        handleCheckAllChange(val) {
          this.checkList = val
            ? this.carList.map((item) => {
              return item.positions;
            })
            : [];
          this.isIndeterminate = false;
        },
        handleCheckedCitiesChange(value) {
          let checkedCount = value.length;
          this.isAllCheck = checkedCount === this.carList.length;
          this.isIndeterminate =
            checkedCount > 0 && checkedCount < this.carList.length;
        },
        // 加入购物车
        addCart(item) {
          if (this.isAddCart(item)) {
            return;
          }
          this.isCarLoading = true;
          const params = {
            product_id: this.product_id,
            config_options: {
              domain: item.name,
              year: 1,
            },
            qty: 1,
            customfield: {
              is_domain: 1, // 是否域名商品
            },
          };
          addToCart(params)
            .then((res) => {
              if (res.data.status === 200) {
                this.getCarList();
              }
            })
            .catch((err) => {
              this.$message.error(err.data.msg);
            })
            .finally(() => {
              this.isCarLoading = false;
            });
        },
        // 批量加入购物车
        addAllCart() {
          // 判断是否有选中的域名
          if (this.batchCheckGroup.length === 0) {
            this.$message.warning(lang.template_text138);
            return;
          }
          if (this.addAllLoading) {
            return;
          }
          this.addAllLoading = true;
          // 筛选出选中的域名
          const arr = this.availList.filter((item) => {
            return this.batchCheckGroup.includes(item.name);
          });
          // 循环调用加入购物车接口
          const productsArr = [];
          arr.forEach((item) => {
            const params = {
              product_id: this.product_id,
              config_options: {
                domain: item.name,
                year: 1,
              },
              qty: 1,
              customfield: {
                is_domain: 1, // 是否域名商品
              },
            };
            productsArr.push(params);
          });
          addToCart({ products: productsArr })
            .then((res) => {
              if (res.data.status === 200) {
                this.getCarList();
              }
            })
            .catch((err) => {
              this.$message.error(err.data.msg);
            })
            .finally(() => {
              this.addAllLoading = false;
            });
        },

        // 修改购物车
        changeCart(val, item) {
          const params = {
            position: item.positions,
            product_id: item.product_id,
            qty: 1,
            config_options: {
              domain: item.config_options.domain,
              year: val,
            },
            customfield: {
              is_domain: 1, // 是否域名商品
            },
          };
          updateCart(params)
            .then((res) => {
              if (res.data.status === 200) {
                // this.getCarList()
              }
            })
            .catch((err) => {
              this.$message.error(err.data.msg);
            });
        },

        // 删除购物车
        async deleteCart(item) {
          this.isCarLoading = true;
          const params = {
            position: item.positions,
          };
          const res = await deleteCart(params);
          if (res.data.status === 200) {
            this.isCarLoading = false;
            this.getCarList();
          }
        },
        // 批量删除购物车
        async deleteClearCart() {
          if (this.carList.length === 0) {
            return;
          }
          this.isCarLoading = true;
          const params = {
            positions: this.carList.map((item) => {
              return item.positions;
            }),
          };
          const res = await deleteCartBatch(params);
          if (res.data.status === 200) {
            this.isCarLoading = false;
            this.getCarList();
          }
        },
        // 获取后缀
        async getSuffix() {
          // DA购买域名需要传入产品ID筛选对于的后缀
          try {
            const res = await domainSuffix(this.host_id);
            this.suffixList = res.data.data || [];
            this.getDomainSet();
          } catch (error) {
            this.getDomainSet();
          }
        },
        // 选择后缀
        handelSelectSuffix(item) {
          this.selectSuffix = item;
        },
        // 域名截断 return domain suffix baidu.com => baidu .com
        getDomainSuffix(str) {
          const domainStr = str.trim();
          const domainRegex = /^[^.]+(\.[^.]+)+$/;
          const domainData = {
            domain: domainStr,
            suffix: "",
          };
          if (domainRegex.test(domainStr)) {
            const parts = domainStr.split(".");
            domainData.domain = parts[0];
            domainData.suffix =
              parts.length >= 2 ? "." + parts.slice(1).join(".") : "";
          }
          return domainData;
        },
        handelDomainSearch() {
          // 去除前后空格
          this.domainInput = this.domainInput.trim();
          if (!this.domainInput) {
            this.$message.warning(lang.template_text140);
            return;
          }
          const suffix = this.getDomainSuffix(this.domainInput).suffix;
          if (
            suffix &&
            this.suffixList.find((item) => item.suffix === suffix)
          ) {
            this.selectSuffix = suffix;
          }
          this.isShowSuffixBox = false;
          this.isSearching = true;
          this.domainList = [];
          this.domainInput = this.getDomainSuffix(this.domainInput).domain;
          domainSearch({
            domain: this.domainInput,
            suffix: this.selectSuffix,
            host_id: this.host_id,
          })
            .then((res) => {
              if (res.data.status === 200) {
                const list = res.data.data;
                this.domainList = list.map((item) => {
                  item.priceArr = [];
                  item.showPrice = 0;
                  item.priceLoading = true;

                  return item;
                });
                this.isSearching = false;
                this.domainList.forEach((item) => {
                  if (item.avail === 1) {
                    domainPrice({ name: item.name, host_id: this.host_id })
                      .then((res) => {
                        item.priceArr = res.data.data || [];
                        item.showPrice = res.data.data[0]?.buyprice || 0;
                      })
                      .finally(() => {
                        item.priceLoading = false;
                      });
                  }
                });
                // 判断当前选中的域名后缀是否支持中文
                const isChinese =
                  this.suffixList.find((item) => {
                    return item.suffix === this.selectSuffix;
                  }).allow_zh === 0;
                // 判断输入的是否是中文
                const chineseReg = /[\u4e00-\u9fa5]/g;
                if (isChinese && chineseReg.test(this.domainInput)) {
                  this.domainList.unshift({
                    // 添加一条不支持中文的提示
                    name: this.domainInput + this.selectSuffix,
                    avail: -2,
                    description: lang.template_text143,
                  });
                }
              }
            })
            .catch((err) => {
              this.isSearching = false;
            });
        },
        // 获取域名价格
        getDomainPrice() { },
        goWhois(item) {
          window.open(
            `/plugin/${getPluginId("IdcsmartDomain")}/whois.htm?domain=${item.name
            }`
          );
        },
        getRule(arr) {
          let isHave = this.showFun(arr, "CartController::index");
          if (isHave) {
            this.isShowView = true;
          }
          if (!this.isShowView) {
            // 没有权限
            location.href = "/noPermissions.htm";
          }
        },
        showFun(arr, str) {
          if (typeof arr == "string") {
            return true;
          } else {
            let isShow = "";
            isShow = arr.find((item) => {
              let isHave = item.includes(str);
              if (isHave) {
                return isHave;
              }
            });
            return isShow;
          }
        },
        // 获取一级分类
        getProductGroup_first() {
          return productGroupFirst().then((res) => {
            this.first_group_list = res.data.data.list;
          }).catch(() => this.catalogFailure("initial"));
        },
        catalogFailure(phase) {
          this.catalogRetry = phase;
          this.catalogError = phase === "products" ? "暂时无法读取商品，请稍后重试" : "暂时无法读取商品分类，请稍后重试";
          this.goodSLoading = false;
          this.secondLoading = false;
          this.searchLoading = false;
          this.scrollDisabled = true;
        },
        retryCatalog() {
          const phase = this.catalogRetry;
          this.catalogError = "";
          if (phase === "products") return this.getProductGoodList();
          if (phase === "groups") return this.getProductGroup_second(this.select_first_obj.id);
          return this.initData();
        },
        // 重置商品列表状态并作废旧请求
        resetGoodsListState() {
          this.goodsListRequestId++;
          this.catalogError = "";
          this.goodsList = [];
          this.goodSLoading = true;
          this.scrollDisabled = false;
        },
        // 重置二级分组状态并作废旧请求
        resetSecondGroupState() {
          this.secondGroupRequestId++;
          this.second_group_list = [];
          this.select_second_obj = {
            id: "",
            type: "",
            description: "",
          };
          this.secondLoading = true;
        },
        // 搜索商品
        searchGoods() {
          this.searchLoading = true;
          this.goodsParmas.id = "";
          this.goodsParmas.page = 1;
          this.resetGoodsListState();
          this.getProductGoodList();
        },
        // 获取二级分类
        getProductGroup_second(id) {
          this.catalogError = "";
          this.secondLoading = true;
          const requestId = ++this.secondGroupRequestId;
          return productGroupSecond(id).then((res) => {
            if (
              requestId !== this.secondGroupRequestId ||
              id !== this.select_first_obj.id
            ) {
              return;
            }
            this.secondLoading = false;
            this.second_group_list = res.data.data.list;
            if (res.data.data.list[0]) {
              this.select_second_obj.id = res.data.data.list[0].id;
              this.select_second_obj.type = res.data.data.list[0].type;
              this.select_second_obj.description =
                res.data.data.list[0]?.description;
              this.goodsParmas.id = this.select_second_obj.id;
              if (this.isDomain) {
                this.getSuffix();
              }
              if (this.isSsl) {
                this.getSslBrands();
              }
              this.getProductGoodList();
            } else {
              this.resetGoodsListState();
              this.goodSLoading = false;
            }
          }).catch(() => {
            if (requestId === this.secondGroupRequestId && id === this.select_first_obj.id) this.catalogFailure("groups");
          });
        },
        // 获取商品列表
        getProductGoodList() {
          this.catalogError = "";
          this.goodSLoading = true;
          const requestId = ++this.goodsListRequestId;
          const goodsParmas = { ...this.goodsParmas };
          return productGoods(goodsParmas).then((res) => {
            if (requestId !== this.goodsListRequestId) {
              return;
            }
            if (
             (this.select_second_obj.type === "domain" || this.select_second_obj.type === "ssl") &&
              res.data.data.list[0]
            ) {
              this.product_id = res.data.data.list[0].id;
            }
            this.searchLoading = false;
            const list = res.data.data.list.map((item) => {
              item.activeList = [];
              return item;
            });
            if (this.isShowFull) {
              list.forEach((item) => {
                eventPromotion({ id: item.id }).then((res) => {
                  item.activeList = res.data.list;
                }).catch(() => { item.activeList = []; });
              });
            }
            // 融合页：描述安全预览 + 折叠测量
            list.forEach((item) => {
              item.__plainDesc = String(item.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
              item.safeDescription = this.sanitizeHtml(item.description);
              this.applyDescMeta(item);
            });
            this.goodsList = this.goodsList.concat(list);
            this.goodSLoading = false;
            this.scrollDisabled =
              res.data.data.list.length < goodsParmas.limit;
            // 首批返回后执行默认选择（URL 深链优先，否则首个可售）
            if (this.goodsListRequestId === requestId && this.selectedProductId === 0 && this.cartConfigReady) {
              this.applyDefaultSelection(this.goodsList);
            }
            this.$nextTick(() => {
              // 判断当前列表是否达到滚动加载的条件
              this.needScroll();
            });
          }).catch(() => {
            if (requestId === this.goodsListRequestId) this.catalogFailure("products");
          });
        },
        needScroll() {
          const scrollTop =
            document.documentElement.scrollTop || document.body.scrollTop;
          const clientHeight = document.documentElement.clientHeight;
          const scrollHeight = document.documentElement.scrollHeight;
          if (
            scrollTop + clientHeight >= scrollHeight &&
            !this.goodSLoading &&
            !this.catalogError &&
            !this.scrollDisabled
          ) {
            this.goodsParmas.page++;
            this.getProductGoodList();
          }
        },
        // 初始化
        async initData() {
          this.catalogError = "";
          this.goodSLoading = true;
          const requestId = ++this.secondGroupRequestId;
          try {
          // 商品深链：先经公开商品详情定位其所属一二级分组（跨组深链），无效则回退默认
          if (this.urlProductId) {
            try {
              const d = await apiProductDetail({ id: this.urlProductId });
              const pd = d.data?.data?.product;
              if (pd && pd.hidden != 1 && pd.product_group_id) {
                this.fpg_id = pd.product_group_id_first || this.fpg_id;
                this.spg_id = pd.product_group_id;
              } else {
                this.urlProductId = 0;
              }
            } catch (e) {
              this.urlProductId = 0;
            }
          }
          // 获取一级分类
          await productGroupFirst().then((res) => {
            this.first_group_list = res.data.data.list;
          });
          if (requestId !== this.secondGroupRequestId) return;
          if (this.first_group_list[0]) {
            this.select_first_obj.id =
              this.fpg_id || this.first_group_list[0].id;
            this.secondLoading = true;
            // 获取二级分类
            await productGroupSecond(this.select_first_obj.id).then((ress) => {
              if (requestId === this.secondGroupRequestId) this.second_group_list = ress.data.data.list;
            });
            if (requestId !== this.secondGroupRequestId) return;
            if (this.second_group_list[0]) {
              // spg_id 必须确属当前一级组；不匹配回退首个二级组并修正 URL
              const spgValid = this.second_group_list.find(
                (item) => item.id === this.spg_id
              );
              const secondId = spgValid
                ? this.spg_id
                : this.second_group_list[0].id;
              this.select_second_obj.id = secondId;
              const selectItem = this.second_group_list.find(
                (item) => item.id === secondId
              );
              this.select_second_obj.type = selectItem?.type;
              this.select_second_obj.description = selectItem?.description;
              this.goodsParmas.page = 1;
              this.goodsParmas.id = secondId;
              this.secondLoading = false;
              if (!spgValid) {
                this.spg_id = secondId;
                this.updateUrlParam("spg_id", secondId, "replace");
              }
              if (this.isDomain) {
                this.getSuffix();
              }
              if (this.isSsl) {
                this.getSslBrands();
              }
              this.getProductGoodList();
            } else {
              this.resetGoodsListState();
              this.goodSLoading = false;
            }
          } else {
            this.resetGoodsListState();
            this.goodSLoading = false;
          }
          } catch (_) {
            if (requestId === this.secondGroupRequestId) this.catalogFailure("initial");
          }
        },
        // 点击一级分类
        selectFirstType(val) {
          if (val !== this.select_first_obj.id) this.clearProductEntry();
          this.select_first_obj.id = val;
          this.resetSecondGroupState();
          this.resetGoodsListState();
          this.goodsParmas.page = 1;
          this.getProductGroup_second(val);
        },
        // 点击二级分类
        selectSecondType(val) {
          if (val !== this.select_second_obj.id) this.clearProductEntry();
          this.select_second_obj.id = val;
          const clickItem = this.second_group_list.find((item) => {
            return item.id === val;
          });
          this.select_second_obj.type = clickItem?.type;
          this.select_second_obj.description = clickItem?.description;
          this.resetGoodsListState();
          this.goodsParmas.page = 1;
          this.goodsParmas.id = val;
          if (this.isDomain) {
            this.getSuffix();
          }
          if (this.isSsl) {
            this.getSslBrands();
          }
          this.getProductGoodList();
        },
        // 获取通用配置
        getCommonData() {
          getCommon().then((res) => {
            this.commonData = res.data.data;
            // v10 一级/二级导航名称（系统设置，单一真相；不进主题后台）
            this.navFirstLabel = this.commonData.first_navigation || "";
            this.navSecondLabel = this.commonData.second_navigation || "";
            localStorage.setItem(
              "common_set_before",
              JSON.stringify(res.data.data)
            );
            // 页面标题：优先用购物车主题后台配置的列表页标题，未配置时回退多语言默认。
            // 顺序统一为「页名-站点名」，与会员中心、官网一致（此前是站点名在前）。
            document.title =
              (this.pageTitle || lang.common_cloud_text301 || "商品列表") + "-" + this.commonData.website_name;
          });
        },
        // 点击购买
        goOrder(item) {
          if (
            Boolean(
              (JSON.parse(localStorage.getItem("common_set_before")) || {})
                .custom_fields?.before_settle === 1
            )
          ) {
            window.open("/account.htm");
            return;
          }
          // 新窗口打开
          window.open(`/cart/goodsList.htm?product_id=${encodeURIComponent(item.id)}`);
        },
        /* ================= 融合页：商品选择与配置嵌入 ================= */
        // 商品描述安全净化：白名单标签 + 去事件属性 + 仅本地/HTTPS 协议
        sanitizeHtml(html) {
          const allowed = new Set(["P", "BR", "STRONG", "EM", "B", "I", "U", "UL", "OL", "LI", "SPAN", "IMG", "A", "H3", "H4", "DIV"]);
          const tpl = document.createElement("template");
          tpl.innerHTML = String(html || "");
          const walk = (node) => {
            [...node.children].forEach((el) => {
              walk(el);
              if (!allowed.has(el.tagName)) {
                el.replaceWith(...el.childNodes);
                return;
              }
              [...el.attributes].forEach((attr) => {
                const name = attr.name.toLowerCase();
                const val = String(attr.value || "");
                if (name.startsWith("on")) { el.removeAttribute(attr.name); return; }
                if ((el.tagName === "A" || el.tagName === "IMG") && (name === "href" || name === "src")) {
                  const ok = val.startsWith("/") || /^https:/i.test(val);
                  if (!ok) { el.removeAttribute(attr.name); return; }
                  if (el.tagName === "A") el.setAttribute("rel", "noopener noreferrer");
                  if (el.tagName === "IMG") { el.setAttribute("loading", "lazy"); el.removeAttribute("srcset"); }
                }
                if (name === "style") {
                  // 仅允许颜色/字重类内联样式，剔除定位/尺寸类以防破版
                  const cleaned = val.replace(/(position|top|left|right|bottom|width|height|margin|padding)\s*:[^;"]*;?/gi, "");
                  if (cleaned.trim()) el.setAttribute("style", cleaned); else el.removeAttribute("style");
                }
              });
            });
          };
          walk(tpl.content);
          const wrap = document.createElement("div");
          wrap.appendChild(tpl.content);
          return wrap.innerHTML;
        },
        // 卡片描述折叠测量：按后台行数截断（CSS line-clamp），超出给展开按钮
        applyDescMeta(item) {
          const lines = Math.min(Math.max(parseInt((this.gridConf || {}).desc_max_lines, 10) || 2, 1), 12);
          item.descLines = lines;
          item.descExpanded = false;
          const text = String(item.__plainDesc || "").trim();
          item.descOverflow = text.length > 60 * lines; // 近似：按字符量估算，CSS 负责视觉截断
        },
        toggleDesc(item) {
          item.descExpanded = !item.descExpanded;
          this.$forceUpdate();
        },
        isSellable(item) {
          return !(item.stock_control === 1 && item.qty <= 0);
        },
        selectProduct(item) {
          if (!this.isSellable(item)) {
            this.$message.warning(lang.inventory_shortage || lang.no_goods || "该商品暂时无法选购");
            return;
          }
          if (this.selectedProductId === item.id) return;
          // 配置区有未提交修改时先确认（子页通过 config-dirty 上报）
          if (this.configState === "ready" && (this.embedDirty || this.isEditingCartItem)) {
            this.$confirm("当前配置尚未提交，切换商品将丢弃已填内容。是否继续？", "提示", {
              confirmButtonText: lang.settlement_tip3 || "继续",
              cancelButtonText: lang.finance_text58 || "取消",
              type: "warning",
            }).then(() => {
              this.embedDirty = false;
              this.doSelectProduct(item);
            }).catch(() => {});
            return;
          }
          this.doSelectProduct(item);
        },
        doSelectProduct(item, historyMode = "push") {
          if (Number(item.id) !== this.entryProductId) this.clearProductEntry();
          this.configOpen = this.configPanel?.default_open !== false;
          this.selectedProductId = item.id;
          this.selectedProduct = item;
          this.embedSeq++;
          this.embedNonce = `n${Date.now().toString(36)}${this.embedSeq}`;
          this.embedDirty = false;
          this.configState = "loading";
          this.configErrorText = "";
          // v6：重置价格计算器桥接状态（等壳侧 rail-data）
          this.railState = "idle";
          this.railLoading = false;
          this.railCoupon = "";
          this.railDurations = [];
          this.railDurationId = 0;
          this.railPreview = [];
          // URL 深链（pushState：后退可回上一商品）
          this.updateUrlParam("product_id", item.id, historyMode);
          this.$nextTick(() => {
            const panel = this.$refs.configPanel;
            if (panel && typeof panel.scrollIntoView === "function") {
              panel.scrollIntoView({ block: "start", behavior: "smooth" });
            }
          });
        },
        reloadConfig() {
          if (this.isMobileCart && this.selectedProductId) {
            this.loadMobileConfig();
            return;
          }
          if (!this.selectedProduct) return;
          this.configState = "loading";
          this.embedSeq++;
          this.embedNonce = `n${Date.now().toString(36)}${this.embedSeq}`;
          this.configErrorText = "";
          this.$nextTick(() => { this.configState = "loading"; });
        },
        openStandalone() {
          if (!this.selectedProductId) return;
          const url = this.productConfigUrl("/cart/goods.htm", this.selectedProductId);
          url.searchParams.set("standalone", "1");
          window.open(url.pathname + url.search.replace(/\+/g, "%20"));
        },
        onFrameLoad() {
          // 模块在 iframe 内导航离开配置页（立即购买→结算 / 加购→购物车 / 会话失效→登录）：
          // 统一提升为顶层跳转。settlement 需要沿用子页 URL（含 id 参数）。
          try {
            const f = this.$refs.configPanel && this.$refs.configPanel.querySelector("iframe");
            const path = f && f.contentWindow ? f.contentWindow.location.pathname : "";
            if (/^\/cart\/(settlement|shoppingCar)\.htm/.test(path)) {
              // 子页导航是同步的：直接把顶层 URL 换成同一路径（sessionStorage 同源共享）
              const full = f.contentWindow.location.href;
              // 用 replace 避免子页记录留在历史里（后退回到配置页时无需二次子导航）
              window.location.replace(full);
              return;
            }
            if (path === "/login.htm" || path === "/noPermissions.htm") {
              this.configState = "error";
              this.configErrorText = "登录状态已失效，请刷新页面后重新进入";
              return;
            }
          } catch (e) { /* 同源读取失败：继续走 ready 流程 */ }
          // iframe load 早于模块 ready：维持 loading 直到 config-ready 或超时
          if (this.configState === "loading") {
            clearTimeout(this.embedTimer);
            this.embedTimer = setTimeout(() => {
              if (this.configState === "loading") {
                this.configState = "error";
                this.configErrorText = "配置加载超时";
              }
            }, 15000);
          }
          // v6.5：壳层配置下发（选配方式标题文本，后台可自定义）
          try {
            const sf = this.$refs.configPanel && this.$refs.configPanel.querySelector("iframe");
            if (sf && sf.contentWindow) {
              sf.contentWindow.postMessage({
                v: 1, source: "cart-parent", type: "shell-config",
                productId: this.selectedProductId, nonce: this.embedNonce,
                tabsTitle: this.railTabsTitle || "选配方式",
              }, window.location.origin);
            }
          } catch (e) { }
        },
        updateUrlParam(key, val, mode) {
          const url = new URL(window.location.href);
          if (val === 0 || val === "" || val === null) url.searchParams.delete(key);
          else url.searchParams.set(key, val);
          const newUrl = url.pathname + url.search.replace(/\+/g, "%20") + url.hash;
          if (newUrl === window.location.pathname + window.location.search + window.location.hash) return;
          window.history[mode === "push" ? "pushState" : "replaceState"]({ cartSel: true }, "", newUrl);
        },
        syncUrlSelection() {
          this.updateUrlParam("fpg_id", this.select_first_obj.id, "replace");
          this.updateUrlParam("spg_id", this.select_second_obj.id, "replace");
        },
        // 商品列表返回后：默认选中（URL product_id 优先，否则首个可售）
        async applyDefaultSelection(list) {
          if (!this.cartConfigReady || this.selectedProductId) return;
          if (!this.isNormal || !list.length) {
            this.selectedProductId = 0;
            this.selectedProduct = null;
            return;
          }
          const requestId = this.goodsListRequestId;
          const preferred = this.urlProductId || this.defaultProductId;
          let target = preferred ? list.find(x => Number(x.id) === Number(preferred) && this.isSellable(x)) : null;
          // The chosen product may be beyond the first list page. Read it through
          // the same group-filtered list API, so another group never leaks in.
          if (!target && preferred) {
            try {
              const res = await productGoods({ ...this.goodsParmas, page: 1, limit: 1, 'product_ids[0]': preferred });
              target = (res.data?.data?.list || []).find(x => Number(x.id) === Number(preferred) && this.isSellable(x)) || null;
              if (target) {
                target.activeList = [];
                target.__plainDesc = String(target.description || '').replace(/<[^>]*>/g, ' ').trim();
                target.safeDescription = this.sanitizeHtml(target.description);
                this.applyDescMeta(target);
              }
            } catch (_) { /* unavailable preferences fall back to a sellable card */ }
          }
          if (requestId !== this.goodsListRequestId || this.selectedProductId) return;
          this.urlProductId = 0;
          if (!target) target = list.find(x => this.isSellable(x));
          if (target) this.doSelectProduct(target, "replace");
          else {
            this.selectedProductId = 0;
            this.selectedProduct = null;
            this.configState = "idle";
          }
        },
        handleEmbedMessage(event) {
          if (event.origin !== window.location.origin) return;
          if (!event.source || !this.$refs.configPanel) return;
          const frame = this.$refs.configPanel.querySelector("iframe");
          if (!frame || event.source !== frame.contentWindow) return;
          let data = event.data;
          if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { return; } }
          if (!data || data.v !== 1) return;
          if (Number(data.productId) !== Number(this.selectedProductId)) return;
          if (data.nonce !== this.embedNonce) return;
          switch (data.type) {
            case "config-ready":
              clearTimeout(this.embedTimer);
              this.configState = "ready";
              if (data.height) this.frameHeight = Math.max(240, Math.min(data.height, 8000));
              break;
            case "config-resize":
              if (this.configState === "ready" && data.height) {
                this.frameHeight = Math.max(240, Math.min(data.height, 8000));
              }
              break;
            case "config-error":
              clearTimeout(this.embedTimer);
              this.configState = "error";
              this.configErrorText = window.CRA1Shared.Errors.message(data.message, { fallback:'商品配置暂时无法加载，请稍后重试' });
              break;
            case "config-dirty":
              this.embedDirty = !!data.dirty;
              break;
            case "cart-count":
              try {
                localStorage.setItem("cartNum", `cartNum-${data.count || 0}`);
              } catch (e) { }
              // v6.6：加购后即时刷新顶栏购物车角标
              this.refreshTopCart();
              break;
            case "checkout-navigation":
              if (data.url && /^\/cart\/(settlement|shoppingCar)\.htm/.test(String(data.url))) {
                window.location.href = data.url;
              }
              break;
            case "rail-data":
            case "rail-updated":
              // 价格计算器数据（v6）：桥接成功
              this.railState = "bridged";
              this.railLoading = false;
              this.applyRailData(data.payload || {});
              break;            case "rail-fallback":
              // 壳侧 VM 不可达：降级提示（iframe 内保留 v5 侧栏卡片）
              this.railState = "fallback";
              this.railLoading = false;
              this.railFallbackText = window.CRA1Shared.Errors.message(data.message, { fallback:'请在下方查看价格并完成订购' });
              break;
            case "rail-added":
              // 模块加购成功（cartDialog 已弹出）：父页确认框
              this.railLoading = false;
              this.railConfirmAfterAdd();
              break;
            default:
              break;
          }
        },
        /* ---- 价格计算器（v6）：父侧状态与方法 ---- */
        applyRailData(p) {
          if (Array.isArray(p.durations) && p.durations.length) this.railDurations = p.durations;
          if (p.current !== undefined && p.current !== null) {
            this.railDurationId = Number(p.current) || (this.railDurations[0] && this.railDurations[0].id) || 0;
          }
          if (p.qty) this.railQty = {
            allow: !!p.qty.allow,
            min: Number(p.qty.min) || 1,
            max: Number(p.qty.max) || 999,
            cur: Number(p.qty.cur) || 1,
          };
          if (p.price) {
            this.railPrice = {
              currency: String(this.commonData.currency_prefix ?? p.price.currency ?? "¥"),
              suffix: String(this.commonData.currency_suffix ?? p.price.suffix ?? ""),
              calcText: String(p.price.calcText ?? ""),
              originText: String(p.price.originText ?? ""),
              hasDiscount: !!p.price.hasDiscount,
            };
          }
          // 当前配置明细（模块 preview / order-right 预览行）
          if (Array.isArray(p.preview)) {
            this.railPreview = p.preview.filter((it) => it && (it.name || it.value)).slice(0, 12);
          }
        },
        railPost(type, extra) {
          if (!this.$refs.configPanel) return;
          const frame = this.$refs.configPanel.querySelector("iframe");
          if (!frame || !frame.contentWindow) return;
          try {
            frame.contentWindow.postMessage(Object.assign({
              v: 1, source: "cart-parent", type,
              productId: this.selectedProductId, nonce: this.embedNonce,
            }, extra || {}), window.location.origin);
          } catch (e) { }
        },
        railSetDuration(id) {
          if (this.isMobileCart) {
            if (this.railVM && this.railVM.params) {
              this.railVM.params.duration_id = id;
              if (typeof this.railVM.changeDuration === "function") this.railVM.changeDuration();
              this.mobileRailPush();
            }
            return;
          }
          this.railLoading = true;
          this.railPost("rail-set", { field: "duration", value: id });
        },
        railSetQty(val) {
          if (this.isMobileCart) {
            if (this.railVM) {
              this.railVM.qty = val;
              if (typeof this.railVM.changQty === "function") this.railVM.changQty();
              this.mobileRailPush();
            }
            return;
          }
          this.railLoading = true;
          this.railPost("rail-set", { field: "qty", value: val });
        },
        railApplyCoupon() {
          const code = String(this.railCoupon || "").trim();
          if (!code) return;
          if (this.isMobileCart) {
            // 手机档：直填组件内优惠码输入框并触发（与桥接同路径）
            const inp = document.querySelector(".m-cloud-m .discount-code input, .m-dcim-m .discount-code input, .discount-box input");
            if (inp) {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
              setter.call(inp, code);
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              const btn = inp.closest(".discount-code, .discount-box");
              btn = btn && btn.querySelector('button, .btn, [class*="confirm"], [class*="exchange"]');
              if (btn) btn.click();
            }
            return;
          }
          this.railLoading = true;
          this.railPost("rail-set", { field: "coupon", value: code });
        },
        railAddCart() {
          if (this.isMobileCart) {
            this.railLoading = true;
            try { this.railVM.handlerCart(); } catch (e) { }
            // 轮询模块购物车弹窗：出现即关闭并走父页确认（与桥接同语义）
            let tries = 0;
            const t = setInterval(() => {
              tries++;
              const dlg = document.querySelector(".cartDialog");
              if (dlg && dlg.offsetHeight > 0) {
                clearInterval(t);
                try { if (this.railVM.cartDialog === true) this.railVM.cartDialog = false; } catch (e) { }
                this.railLoading = false;
                this.railConfirmAfterAdd();
                this.refreshTopCart();
              } else if (tries > 100) {
                clearInterval(t);
                this.railLoading = false;
              }
            }, 60);
            return;
          }
          this.railLoading = true;
          this.railPost("rail-add");
          clearTimeout(this.railAddTimer);
          this.railAddTimer = setTimeout(() => { this.railLoading = false; }, 6000);
        },
        railBuyNow() {
          if (this.isMobileCart) {
            this.railLoading = true;
            try {
              this.railVM.submitOrder({ data: { type: "iframeBuy" } });
            } catch (e) { }
            clearTimeout(this.railBuyTimer);
            this.railBuyTimer = setTimeout(() => { this.railLoading = false; }, 6000);
            return;
          }
          this.railLoading = true;
          this.railPost("rail-buy");
          clearTimeout(this.railBuyTimer);
          this.railBuyTimer = setTimeout(() => { this.railLoading = false; }, 6000);
        },
        railPrimaryAction() {
          if (!this.isEditingCartItem) { this.railBuyNow(); return; }
          this.railLoading = true;
          if (this.isMobileCart) {
            try { this.railVM.changeCart(); } catch (_) { this.railLoading = false; }
          } else {
            this.railPost("rail-save");
          }
          clearTimeout(this.railBuyTimer);
          this.railBuyTimer = setTimeout(() => { this.railLoading = false; }, 6000);
        },

        /* ==== v12 手机档：配置直渲染（无 iframe）==== */
        async loadMobileConfig() {
          const pid = this.selectedProductId;
          if (!pid) return;
          const seq = ++this.mobileLoadSeq;
          this.configState = "loading";
          this.configErrorText = "";
          this.railState = "idle";
          clearInterval(this.mobileRailTimer);
          try {
            const res = await getOrederConfig({ id: pid, flag: false });
            if (seq !== this.mobileLoadSeq) return; // 过期响应丢弃
            const content =
              res.data && res.data.data && typeof res.data.data.content === "string"
                ? res.data.data.content
                : null;
            if (!content) {
              throw new Error((res.data && res.data.msg) || "商品配置暂时无法加载，请稍后重试");
            }
            this.$nextTick(() => {
              const body = this.$refs.mobileConfigBody;
              if (!body) return;
              /* 原生注入（goodsList 页无 jQuery）：innerHTML 不执行 script，
                 需按序手动加载——外链 api/lang 首次加载复用全局（去重），
                 mobile/cloud/js 的 fork 每次执行（IIFE 闭包隔离，可重复挂载） */
              this.__mobileScriptsLoaded = this.__mobileScriptsLoaded || new Set();
              body.innerHTML = window.CRA1CartControls ? window.CRA1CartControls.transform(content) : content;
              const scripts = [...body.querySelectorAll("script")];
              let chain = Promise.resolve();
              scripts.forEach((old) => {
                const src = old.getAttribute("src") || "";
                const inline = old.textContent;
                old.remove();
                const isFork = /mobile\/cloud\/js\//.test(src);
                if (src && !isFork && this.__mobileScriptsLoaded.has(src)) return;
                if (src) this.__mobileScriptsLoaded.add(src);
                chain = chain.then(() => new Promise((res2) => {
                  const el = document.createElement("script");
                  if (src) {
                    el.src = src;
                    el.onload = () => res2();
                    el.onerror = () => res2();
                    document.head.appendChild(el);
                  } else {
                    el.textContent = inline;
                    document.head.appendChild(el);
                    res2();
                  }
                }));
              });
              chain.then(() => {
                this.configState = "ready";
                this.$nextTick(() => this.initMobileRail(seq));
              });
            });
          } catch (e) {
            if (seq !== this.mobileLoadSeq) return;
            this.configState = "error";
            this.configErrorText = (e && e.message) || "配置加载失败";
          }
        },
        initMobileRail(seq) {
          clearInterval(this.mobileRailTimer);
          let tries = 0;
          this.mobileRailTimer = setInterval(() => {
            if (seq !== this.mobileLoadSeq) { clearInterval(this.mobileRailTimer); return; }
            tries++;
            const root = document.querySelector(".m-cloud-m, .m-dcim-m, .m-common-m");
            const vm = root && root.__vue__;
            if (vm && vm.calcTotalPrice !== undefined) {
              clearInterval(this.mobileRailTimer);
              this.railVM = vm;
              this.railState = "bridged";
              this.mobileRailPush();
              this.syncDockPadding();
              this.mobileRailTimer = setInterval(() => {
                if (seq !== this.mobileLoadSeq) { clearInterval(this.mobileRailTimer); return; }
                this.mobileRailPush();
              }, 800);
            } else if (tries > 50) {
              clearInterval(this.mobileRailTimer);
              this.railState = "fallback";
            }
          }, 300);
        },
        /* dock 实高 → 主体底部垫高（防遮挡主体内容），展开/收起均同步 */
        syncDockPadding() {
          this.$nextTick(() => {
            const dock = document.querySelector('.cl-rail-dock');
            if (dock) {
              document.documentElement.style.setProperty('--dock-h', Math.round(dock.offsetHeight + 16) + 'px');
            }
          });
        },
        toggleCoupon() {
          this.couponOpen = !this.couponOpen;
          this.$nextTick(() => this.syncDockPadding());
        },
        mobileRailPush() {
          const vm = this.railVM;
          if (!vm || this.railState !== "bridged") return;
          this.applyRailData({
            durations: vm.cycleList || [],
            current: vm.params ? vm.params.duration_id : "",
            qty: {
              allow: true,
              min: 1,
              max: Number(vm.calcQtyMax) > 0 ? Number(vm.calcQtyMax) : 999,
              cur: vm.qty,
            },
            price: {
              currency: this.commonData.currency_prefix ?? vm.currency_prefix ?? "¥",
              suffix: this.commonData.currency_suffix ?? vm.currency_suffix ?? "",
              calcText: vm.calcTotalPrice,
              originText: vm.totalPrice,
              hasDiscount: !!vm.hasDiscount,
            },
            preview: vm.preview || [],
          });
        },
        railRetryBridge() {
          this.railLoading = true;
          this.railPost("rail-init");
        },
        railConfirmAfterAdd() {
          this.$confirm(
            this.lang.product_add_success || "已加入购物车",
            this.lang.tip || "提示",
            {
              confirmButtonText: this.lang.product_settlement || "去购物车结算",
              cancelButtonText: this.lang.product_continue || "继续配置",
              type: "success",
            }
          ).then(() => {
            window.location.href = "/cart/shoppingCar.htm";
          }).catch(() => { });
        },
        /* v6.6：即时刷新顶栏购物车角标（模块 iframe 同源，storage/桥接双通道触发） */
        refreshTopCart() {
          const tm = this.$refs.topMenu;
          if (tm && typeof tm.getCartList === "function") {
            try { tm.getCartList(); } catch (e) { }
          }
        },
        handlePopState() {
          const pid = this.getQuery("product_id") * 1 || 0;
          const fpg = this.getQuery("fpg_id") * 1 || 0;
          const spg = this.getQuery("spg_id") * 1 || 0;
          if (pid && pid !== this.selectedProductId) {
            const target = this.goodsList.find((x) => x.id === pid);
            if (target && (!spg || spg === this.select_second_obj.id)) {
              this.doSelectProduct(target, "replace"); return;
            }
            // A history entry can refer to another category or a later list page.
            // Resolve its product again without pushing a new history entry.
            this.urlProductId = pid;
            this.fpg_id = fpg;
            this.spg_id = spg;
            this.selectedProductId = 0;
            this.selectedProduct = null;
            this.configState = "idle";
            this.resetGoodsListState();
            this.initData();
            return;
          }
          if (!pid && this.selectedProductId) {
            // 后退到未选中状态：关闭配置区
            this.selectedProductId = 0;
            this.selectedProduct = null;
            this.configState = "idle";
          }
          if (fpg && fpg !== this.select_first_obj.id) {
            this.selectFirstType(fpg);
          } else if (spg && spg !== this.select_second_obj.id) {
            this.selectSecondType(spg);
          }
        },
        handleViewportChange() {
          this.$data.__viewportW = window.innerWidth;
        },
        /* ================= 融合页结束 ================= */
        // 滚动计算
        scrollBottom() {
          if (!this.isNormal) {
            return;
          }
          const scrollTop =
            document.documentElement.scrollTop || document.body.scrollTop;
          const clientHeight = document.documentElement.clientHeight;
          const scrollHeight = document.documentElement.scrollHeight;
          if (
            scrollTop + clientHeight >= scrollHeight &&
            !this.goodSLoading &&
            !this.scrollDisabled
          ) {
            this.goodsParmas.page++;
            this.getProductGoodList();
          }
        },
      },
      watch: {
        selectedProductId(pid) {
          /* v12 手机档：选中商品即直渲染进父页（含深链默认选中与卡片切换） */
          if (this.isMobileCart && pid) this.loadMobileConfig();
        },
        "select_first_obj.id": function (val) {
          // 切分组：作废上一组的商品选择，URL 移除 product_id（分组规范化用 replace）
          this.selectedProductId = 0;
          this.selectedProduct = null;
          this.configState = "idle";
          this.embedDirty = false;
          this.updateUrlParam("fpg_id", val, "replace");
          this.updateUrlParam("product_id", null, "replace");
        },
        "select_second_obj.id": function (val) {
          this.selectedProductId = 0;
          this.selectedProduct = null;
          this.configState = "idle";
          this.embedDirty = false;
          this.updateUrlParam("spg_id", val, "replace");
          this.updateUrlParam("product_id", null, "replace");
        },
      },
    }).$mount(template);
    typeof old_onload == "function" && old_onload();
  };
})(window);
