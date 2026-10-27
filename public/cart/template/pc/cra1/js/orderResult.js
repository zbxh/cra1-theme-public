(function (window, undefined) {
  var old_onload = window.onload;
  window.onload = function () {
    const template = document.getElementsByClassName("template")[0];
    Vue.prototype.lang = window.lang;
    new Vue({
      components: {
        asideMenu,
        topMenu,
      },
      created() {
        this.getCommonData();
        // 购物车主题后台文案（cra1admin cart 配置域公开快照；拉取失败走多语言默认）
        if (window.__CRA1_CART_SNAPSHOT_PROMISE__) {
          window.__CRA1_CART_SNAPSHOT_PROMISE__.then((snap) => {
            // v2 嵌套结构：文案在 orderresult.copy 下（与 goodsList 的 gl.copy 同一约定）
            const or = snap?.content?.orderresult?.copy || {};
            if (or.success_title) this.successTitle = or.success_title;
            if (or.cancel_title) this.cancelTitle = or.cancel_title;
            if (or.pending_title) this.pendingTitle = or.pending_title;
          });
        }
        // status: success=支付成功 cancel=取消支付 默认=订单已提交
        const params = this.getQuery(location.search);
        this.urlStatus = params.status || "";
        this.orderId = params.order_id ? Number(params.order_id) : null;
        // 订单号以支付回调传入的 URL 参数为准；订单状态/金额由接口核实（拿不到则不展示，不虚构）
        if (this.orderId) {
          this.getOrder();
        } else {
          this.orderLoaded = true;
        }
      },
      mounted() {},
      updated() {
        document.getElementById("mainLoading").style.display = "none";
        document.getElementsByClassName("template")[0].style.display = "block";
      },
      data() {
        return {
          commonData: {},
          // 购物车主题后台文案（快照合并；空 = 多语言默认）
          successTitle: "",
          cancelTitle: "",
          pendingTitle: "",
          urlStatus: "",
          orderId: null,
          order: null,
          orderLoaded: false,
          orderStatus: "",
        };
      },
      computed: {
        view() {
          // 有真实订单状态时以接口为准，否则按跳转来源推断
          const paid = this.orderStatus === "Paid";
          const success = paid;
          const cancel = this.urlStatus === "cancel" && !paid && !["WaitReview","WaitUpload","ReviewFail"].includes(this.orderStatus);
          // 后台自定义标题优先（cra1admin cart 配置域），空值回退多语言
          if (success) {
            return {
              status: "success",
              icon: "el-icon-success",
              title: this.successTitle || lang.coin_text63 || "",
            };
          }
          if (cancel) {
            return {
              status: "cancel",
              icon: "el-icon-remove-outline",
              title: this.cancelTitle || lang.pay_text13 || "",
            };
          }
          return {
            status: "pending",
            icon: "el-icon-time",
            title: this.pendingTitle || lang.pay_text1 || "",
          };
        },
      },
      methods: {
        getCommonData() {
          getCommon().then((res) => {
            this.commonData = res.data.data;
            document.title =
              (lang.order_text1 || "订单详情") + "-" + this.commonData.website_name;
          });
        },
        getOrder() {
          orderDetails(this.orderId)
            .then((res) => {
              if (res.data.status === 200) {
                this.order = res.data.data.order;
                this.orderStatus = this.order.status;
              }
            })
            .catch(() => {})
            .finally(() => {
              // 接口不可达（未携带 jwt 等）时仍以 URL 参数回显订单号
              this.order = this.order || { id: this.orderId };
              this.orderLoaded = true;
            });
        },
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
        go(url) {
          location.href = url;
        },
      },
    }).$mount(template);
    typeof old_onload == "function" && old_onload();
  };
})(window);
