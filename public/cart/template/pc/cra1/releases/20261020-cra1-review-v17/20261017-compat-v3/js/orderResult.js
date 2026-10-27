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
        this.orderId = /^[1-9]\d*$/.test(params.order_id || '') && Number.isSafeInteger(Number(params.order_id)) ? Number(params.order_id) : null;
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
          // URL is not proof that an order exists or that payment succeeded.
          if (!this.orderLoaded) return { status: 'pending', icon: 'el-icon-loading', title: '正在读取订单状态' };
          if (!this.order || !this.orderStatus) return {
            status: 'unknown', icon: 'el-icon-info', title: this.orderId ? '暂时无法确认订单状态' : '暂无可显示的订单',
            description: '请从财务中心查看订单，或继续浏览商品。'
          };
          const paid = this.orderStatus === "Paid";
          const success = paid;
          const cancel = this.orderStatus === 'Cancelled' || (this.urlStatus === "cancel" && this.orderStatus === 'Unpaid');
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
              title: this.orderStatus === 'Cancelled' ? '订单已取消' : this.cancelTitle || lang.pay_text13 || "",
            };
          }
          const states = {
            Refunded: { status: 'unknown', icon: 'el-icon-info', title: '订单已退款', description: '可在订单详情中查看退款记录。' },
            WaitUpload: { status: 'pending', icon: 'el-icon-document', title: '等待上传付款凭证', description: '请到订单详情中上传付款凭证。' },
            WaitReview: { status: 'pending', icon: 'el-icon-time', title: '付款审核中', description: '付款凭证已提交，请在订单详情中查看审核进度。' },
            ReviewFail: { status: 'pending', icon: 'el-icon-warning-outline', title: '付款审核未通过', description: '请到订单详情查看原因并重新提交付款凭证。' },
          };
          if (Object.prototype.hasOwnProperty.call(states, this.orderStatus)) return states[this.orderStatus];
          if (this.orderStatus !== 'Unpaid') return {
            status: 'unknown', icon: 'el-icon-info', title: '请查看订单详情', description: '请到订单详情中确认当前进度。'
          };
          return {
            status: "pending",
            icon: "el-icon-time",
            title: this.pendingTitle || String(lang.pay_text1 || '订单已提交，请完成付款').replace(/\s*订单号\s*[:：]?\s*$/, ''),
          };
        },
      },
      methods: {
        getCommonData() {
          return getCommon().then((res) => {
            this.commonData = res?.data?.data || {};
            document.title =
              (lang.order_text1 || "订单详情") + "-" + this.commonData.website_name;
          }).catch(() => { /* Order lookup remains available if display settings fail. */ });
        },
        getOrder() {
          orderDetails(this.orderId)
            .then((res) => {
              if (res?.data?.status === 200 && res.data.data?.order && Number(res.data.data.order.id) === this.orderId) {
                this.order = res.data.data.order;
                this.orderStatus = this.order.status;
              }
            })
            .catch(() => {})
            .finally(() => {
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
