(function (window, undefined) {
  function readJSON(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function product(value) {
    if (!object(value)) return null;
    const id = Number(value.product_id || value.id), qty = Number(value.qty);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(qty) || qty < 1 || !object(value.config_options)) return null;
    return { ...value, product_id: id, qty, customfield: object(value.customfield) ? value.customfield : {} };
  }
  function checkedData(res) {
    if (Number(res?.data?.status) !== 200 || !object(res.data.data)) throw new Error(res?.data?.msg || '商品信息读取失败，请重试');
    return res.data.data;
  }
  var old_onload = window.onload;
  window.onload = function () {
    const template = document.getElementsByClassName("template")[0];
    Vue.prototype.lang = window.lang;
    const host = location.host;
    const fir = location.pathname.split("/")[1];
    const str = `${host}/${fir}/`;
    new Vue({
      components: {
        asideMenu,
        topMenu,
        payDialog,
        eventCode,
      },
      created() {
        localStorage.frontMenusActiveId = "";
        // 购物车主题后台文案（cra1admin cart 配置域公开快照；拉取失败走多语言默认）
        if (window.__CRA1_CART_SNAPSHOT_PROMISE__) {
          window.__CRA1_CART_SNAPSHOT_PROMISE__.then((snap) => {
            // v2 嵌套结构：文案在 settlement.copy 下（与 goodsList 的 gl.copy 同一约定）
            const st = snap?.content?.settlement?.copy || {};
            if (st.title) this.pageTitle = st.title;
            if (st.agree_text) this.agreeText = st.agree_text;
          });
        }
        const temp = this.getQuery(location.search);
        if (temp.cart) {
          // 购物车过来
          const selected = readJSON(sessionStorage.shoppingCartList, null);
          if (!Array.isArray(selected) || !selected.length || selected.some(i => !/^\d+$/.test(String(i)) || !Number.isSafeInteger(Number(i)))) {
            this.contextError = '未找到有效的结算商品，请返回购物车重新选择。';
          } else this.selectGoodsList = [...new Set(selected.map(Number))];
          this.isFormShoppingCart = true;
        } else {
          const fresh = sessionStorage.product_information;
          const obj = product(readJSON(fresh || sessionStorage.settleItem, null));
          this.isFormShoppingCart = false;
          if (!obj || (temp.id && Number(temp.id) !== obj.product_id)) {
            this.contextError = '结算信息已失效，请返回商品页面重新选择配置。';
          } else {
            this.productObj = obj;
            if (fresh) {
              sessionStorage.settleItem = JSON.stringify(obj);
              sessionStorage.removeItem('product_information');
            }
          }
        }
        this.getCommonData();
        // this.getPayLisy();
      },
      mounted() {
        const addons = readJSON(document.querySelector('#addons_js')?.getAttribute('addons_js'), []);
        this.addons_js_arr = Array.isArray(addons) ? addons : [];
        const arr = this.addons_js_arr.map((item) => {
          return item.name;
        });
        if (arr.includes("PromoCode")) {
          // 开启了优惠码插件
          this.isShowPromo = true;
        }
        if (arr.includes("IdcsmartClientLevel")) {
          // 开启了等级优惠
          this.isShowLevel = true;
        }
        if (arr.includes("EventPromotion")) {
          // 开启活动满减
          this.isShowFull = true;
        }
        this.getRule();
        this.getCartList();
      },
      updated() {
        // 关闭loading
        document.getElementById("mainLoading").style.display = "none";
        document.getElementsByClassName("template")[0].style.display = "block";
      },
      data() {
        return {
          initArr: [],
          contextError: '',
          loadError: '',
          quoteError: '',
          // 购物车主题后台文案（快照合并；空 = 多语言默认）
          pageTitle: "",
          agreeText: "",
          commonData: {}, // 公告接口数据
          addons_js_arr: [],
          showPayBtn: false,

          totalPriceLoading: false,

          goodIdList: [],
          isUseDiscountCode: false,
          productObj: {
            customfield: {},
          }, // 单独结算的商品对象
          shoppingList: [], // 所有购物车列表
          listLoading: false,
          selectGoodsList: [],
          isFormShoppingCart: true, // 是否从购物车页面结算
          showGoodsList: [], // 展示的列表
          payTypeList: [], // 支付渠道数组
          payType: "", // 选择的支付渠道
          checked: false, // 勾选隐私协议
          isShowPromo: false, // 是否开启优惠码
          isShowLevel: false, // 是否开启等级优惠
          isShowFull: false,
          subBtnLoading: false, // 提交按钮loading
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
        filterMoney(money) {
          if (isNaN(money) || money * 1 < 0) {
            return "0.00";
          } else {
            return formatNuberFiexd(money);
          }
        },
      },
      computed: {
        canSettle() {
          return !this.contextError && !this.loadError && !this.quoteError && !this.listLoading && !this.totalPriceLoading && !this.subBtnLoading && this.showGoodsList.length > 0 && this.showGoodsList.every(item => item.quoteReady && !item.priceLoading);
        },
        finallyPrice() {
          return this.totalPrice;
        },
        totalLevelDiscount() {
          return formatNuberFiexd(
            this.showGoodsList.reduce((pre, cur) => {
              return pre + cur.level_discount * 1;
            }, 0)
          );
        },
        totalPrice() {
          return formatNuberFiexd(
            this.showGoodsList.reduce((pre, cur) => {
              return pre + cur.calcItemPrice * 1;
            }, 0)
          );
        },
        orginPrice() {
          return formatNuberFiexd(
            this.showGoodsList.reduce((pre, cur) => {
              return pre + cur.price * 1;
            }, 0)
          );
        },
        totalCodelDiscount() {
          return formatNuberFiexd(
            this.showGoodsList.reduce((pre, cur) => {
              return pre + cur.code_discount * 1;
            }, 0)
          );
        },
        totalFullDiscount() {
          return formatNuberFiexd(
            this.showGoodsList.reduce((pre, cur) => {
              return pre + cur.eventDiscount * 1;
            }, 0)
          );
        },
      },
      methods: {
        getRule() {
          const access=window.CRA1Shared?.Access;
          if(!access){this.showPayBtn=false;return;}
          access.read().then(data=>{this.showPayBtn=access.can(data,this.isFormShoppingCart?'Cart::settle':'Product::settle')&&access.can(data,'Pay::pay')}).catch(()=>{this.showPayBtn=false});
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
        // 获取购物车列表
        async getCartList() {
          if (this.listLoading || this.contextError) return;
          this.listLoading = true;
          this.loadError = ''; this.quoteError = '';
          this.initArr = [];
          this.showGoodsList = []; this.goodIdList = [];
          try {
          if (this.isFormShoppingCart) {
            // 从购物车结算
            const data = checkedData(await cartList());
            if (!Array.isArray(data.list)) throw new Error('购物车读取失败，请重试');
            this.shoppingList = data.list;
            for (const position of this.selectGoodsList) {
              const item = product(this.shoppingList[position]);
              if (!item) { this.contextError = '购物车商品已变更，请返回购物车重新选择。'; return; }
              this.initArr.push(item);
            }
          } else {
            // 从商品详情结算
            const data = checkedData(await productDetail(this.productObj.product_id));
            if (!data.product) throw new Error('商品已失效，请返回商品页面重新选择');
            this.productObj.name = data.product.name;
            this.initArr.push({ ...this.productObj });
          }

          this.initArr.forEach((item) => {
            item.isLoading = true;
            item.priceLoading = false;
            item.price = 0; // 商品单价
            item.code_discount = 0; // 商品优惠码抵扣金额
            item.isUseDiscountCode = false;
            item.level_discount = 0; // 商品等级优惠折扣金额
            item.eventDiscount = 0;
            item.calcItemPrice = 0;
            item.quoteReady = false;
            item.quoteError = '';
            this.goodIdList.push(item.product_id);
          });
          this.showGoodsList = [...this.initArr];
          this.totalPriceLoading = true;
          await Promise.all(this.initArr.map(item => this.getConfigOption(item)));
          } catch (err) {
            this.loadError = err?.data?.msg || err.message || '商品读取失败，请重试';
            this.initArr = []; this.showGoodsList = [];
          } finally { this.listLoading = false; this.totalPriceLoading = false; }
        },
        // 获取商品配置项价格
        getConfigOption(item) {
          const params = {
            config_options: {
              ...item.config_options,
              promo_code: item.customfield.promo_code,
              event_promotion: item.customfield.event_promotion,
            },
            qty: item.qty,
          };
          item.priceLoading = true;
          return configOption(item.product_id, params)
            .then(async (res) => {
              const data = checkedData(res);
              if (!Array.isArray(data.preview) || !Number.isFinite(Number(data.price)) || !Number.isFinite(Number(data.price_total)) || Number(data.price_total) < 0) throw new Error('价格信息不完整，请重试');
              item.info = data;
              const son_previews = [];
              if (res.data.data.other && res.data.data.other.son_previews) {
                res.data.data.other.son_previews.forEach((i) => {
                  i.forEach((items) => {
                    son_previews.push(items);
                  });
                });
              }
              if (res.data.data.sub_host && res.data.data.sub_host.length > 0) {
                res.data.data.sub_host.forEach((i) => {
                  i.preview.forEach((items) => {
                    son_previews.push(items);
                  });
                });
              }
              item.preview = res.data.data.preview.concat(son_previews);
              item.price = res.data.data.price * 1;
              item.calcItemPrice = res.data.data.price_total * 1;
              item.level_discount =
                res.data.data.price_client_level_discount * 1 || 0;
              item.code_discount =
                res.data.data.price_promo_code_discount * 1 || 0;
              item.eventDiscount =
                res.data.data.price_event_promotion_discount * 1 || 0;
              item.quoteReady = true;
            })
            .catch((err) => {
              item.preview = [];
              item.quoteReady = false;
              item.quoteError = err?.data?.msg || err.message || '价格计算失败';
              this.quoteError = '商品价格暂时无法确认，请重新计算后再结算。';
            })
            .finally(() => {
              item.priceLoading = false;
              item.isLoading = false;
              this.showGoodsList = [...this.initArr];
              this.$forceUpdate();
            });
        },

        async goPay() {
          if(this.subBtnLoading)return;
          if (!this.canSettle) return;
          if (!this.checked) {
            this.$message.warning(lang.shoppingCar_tip_text6);
            return;
          }
          this.subBtnLoading = true;
          try {
            const access=await window.CRA1Shared.Request.request('/theme/access');
            if(access.data?.required_profile){
              sessionStorage.setItem('cra1:checkout-return',location.pathname+location.search+location.hash);
              location.href='/account.htm?complete_checkout=1';return;
            }
          } catch(error) {this.subBtnLoading=false;this.$message.error(error.message || '暂时无法核对账户资料，请重试');return;}
          this.subBtnLoading = true;
          const settleApi = this.isFormShoppingCart
            ? cart_settle
            : product_settle;
          const params = this.isFormShoppingCart
            ? {
                positions: this.selectGoodsList,
              }
            : {
                product_id: this.productObj.product_id,
                config_options: this.productObj.config_options,
                customfield: this.productObj.customfield,
                self_defined_field: this.productObj.self_defined_field,
                qty: this.productObj.qty,
              };
          settleApi(params)
            .then((res) => {
              checkedData(res);
              this.$refs.payDialog.showPayDialog(
                res.data.data.order_id,
                res.data.data.amount,
                this.payType
              );
            })
            .catch((err) => {
              if (err.data?.data?.certification === 0) {
                this.$message.error({
                  duration: 0,
                  showClose: true,
                  dangerouslyUseHTMLString: true,
                  message: `${err.data.msg} 
                   <a style="margin-left:5px;" target="_blank" href="/plugin/${getPluginId(
                     "IdcsmartCertification"
                   )}/authentication_select.htm">${lang.wx_tip7}</a>
                  `,
                  type: "error",
                });
              } else {
                this.$message.error(err?.data?.msg || err.message || '订单提交失败，请重试');
              }
            })
            .finally(() => {
              this.subBtnLoading = false;
            });
        },

        // 支付成功回调 → 订单结果页（主题新增闭环页）
        paySuccess(e) {
          location.href = "/cart/orderResult.htm?status=success&order_id=" + e;
        },
        // Offline proof submission is pending, never a paid result.
        payPending(id) { location.href = "/cart/orderResult.htm?status=pending&order_id=" + id; },
        // 取消支付回调 → 订单结果页
        payCancel(e) {
          location.href = "/cart/orderResult.htm?status=cancel&order_id=" + e;
        },
        getPayLisy() {
          payLisy().then((res) => {
            this.payTypeList = res.data.data.list;
            this.payType = res.data.data.list[0]?.name || '';
          });
        },
        // 解析url
        getQuery(url) {
          const str = url.substr(url.indexOf("?") + 1);
          const arr = str.split("&");
          const res = {};
          for (let i = 0; i < arr.length; i++) {
            const item = arr[i].split("=");
            res[item[0]] = item[1];
          }
          return res;
        },
        goTermsServiceUrl() {
          window.open(this.commonData.terms_service_url);
        },
        goTermsPrivacUrl() {
          window.open(this.commonData.terms_privacy_url);
        },
        goHelpUrl(url) {
          window.open(this.commonData[url]);
        },

        // 获取通用配置
        getCommonData() {
          if(window.__CRA1_RUNTIME__?.error){this.contextError='页面暂时无法加载，请刷新重试';return;}
          const data = readJSON(localStorage.getItem('common_set_before'), {});
          this.commonData = object(data) ? data : {};
          document.title =
            (lang.shoppingCar_tip_text7 || "订单结算") + (this.commonData.website_name ? '-' + this.commonData.website_name : '');
        },
      },
    }).$mount(template);
    typeof old_onload == "function" && old_onload();
  };
})(window);
