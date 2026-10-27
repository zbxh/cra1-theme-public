var orignalSetItem = localStorage.setItem;
localStorage.setItem = function (key, newValue) {
  var setItemEvent = new Event("setItemEvent");
  setItemEvent.newValue = newValue;
  window.dispatchEvent(setItemEvent);
  orignalSetItem.apply(this, arguments);
};

/*
 * 商品详情页标题顺序纠正（立即启动，不等到 onload / Vue 挂载）。
 *
 * 产品类型插件（如 mf_cloud）会把标题设成「站点名-商品名」，与本主题其余页面
 * 「页名-站点名」的约定相反；配置未就绪时还会先写出「undefined-商品名」。
 * 插件不在本主题目录内、不改（系统/插件层保持原样），因此在主题自己的脚本里纠正。
 *
 * 必须在此处（脚本解析时）就起轮询：实测插件在 ~250ms 就把标题写成
 * 「站点名-商品名」，而 Vue 的 $mount 与 window.onload 都晚于此，
 * 放在 onload 里会错过首次写入、又因商品名已就绪而不再有第二次机会。
 */
(function () {
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var site = "";
    try {
      var c = JSON.parse(localStorage.getItem("common_set_before") || "null");
      site = (c && c.website_name) || "";
    } catch (e) { /* 忽略：配置未就绪 */ }
    if (!site && window.__CRA1_SITE_NAME__) site = window.__CRA1_SITE_NAME__;
    var t = document.title || "";
    var prefix = null;
    if (site && t.indexOf(site + "-") === 0) prefix = site + "-";
    else if (t.indexOf("undefined-") === 0) prefix = "undefined-";
    if (prefix) {
      var rest = t.slice(prefix.length).trim();
      // 中段非空才改写：中间态「站点名-」（商品名还没拿到）留给插件补全
      if (rest && rest.indexOf("undefined") !== 0 && site) {
        document.title = rest + "-" + site;
        clearInterval(timer);
      }
    }
    if (tries >= 40) clearInterval(timer);
  }, 100);
})();

(function (window, undefined) {
  var old_onload = window.onload;
  window.onload = function () {
    const template = document.getElementsByClassName("goods")[0];
    Vue.prototype.lang = window.lang;
    window.addEventListener("setItemEvent", function (e) {
      if (e.newValue && String(e.newValue).indexOf("cartNum") !== -1) {
        vm._data.shoppingCarNum = e.newValue.split("-")[1] * 1;
      }
    });
    const vm = new Vue({
      components: {
        asideMenu,
        topMenu,
        pagination,
      },
      created() {
        const params = getUrlParams();
        this.id = params.id || params.product_id || "";
        // 只获取 commonData 配置，不触发 getGoodDetail
        try { this.commonData = JSON.parse(localStorage.getItem("common_set_before")) || {}; }
        catch (e) { this.commonData = {}; }
      },
      mounted() {
        // goods_embed（融合页嵌入壳）固定前台模式：flag 不因处于 iframe 而放宽隐藏商品
        const embedParam = new URLSearchParams(window.location.search).get("embed");
        this.isEmbed = embedParam === "1" || /\/goods_embed\.htm$/.test(window.location.pathname);
        if (window.self !== window.top && !this.isEmbed) {
          this.isIfram = true;
        }
        // 先加载 content，完成后再加载 popover 数据，避免并发请求过多
        this.getList().then((loaded) => {
          if (loaded && this.commonData.cart_change_product == 1) {
            this.getGoodDetail(this.id);
          }
        });
      },
      updated() {
        // // 关闭loading
        const loading = document.getElementById("mainLoading");
        if (loading) loading.style.display = "none";
        const root = document.getElementsByClassName("goods")[0];
        if (root) root.style.display = "block";
      },
      computed: {
        calcProductGroup() {
          // fillterKey 过滤关键字 secProductGroupList
          const fillterKey = this.fillterKey.trim().toLowerCase();
          const originList = JSON.parse(
            JSON.stringify(this.secProductGroupList)
          );
          const arr = originList
            .filter((item) => {
              return (
                item.goodsList.filter((i) => {
                  return i.name.toLowerCase().indexOf(fillterKey) !== -1;
                }).length > 0
              );
            })
            .map((item) => {
              item.goodsList = item.goodsList.filter((i) => {
                return i.name.toLowerCase().indexOf(fillterKey) !== -1;
              });
              return item;
            });
          return arr;
        },
      },
      data() {
        return {
          id: "",
          isIfram: false,
          isEmbed: false, // goods_embed 嵌入壳：固定前台模式，不上报 flag
          shoppingCarNum: 0,
          fillterKey: "",
          params: {
            page: 1,
            limit: 20,
            pageSizes: [20, 50, 100],
            total: 200,
            orderby: "id",
            sort: "desc",
            keywords: "",
          },
          commonData: {},
          content: "",
          productInfo: {},
          secProductGroupList: [],
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
      methods: {
        configError(message) {
          if (window.__CART_EMBED__) {
            window.__CART_EMBED__.fail(message);
          } else {
            this.$message.error(message);
            const loading = document.getElementById("mainLoading");
            if (loading) loading.style.display = "none";
          }
        },
        async getList() {
          if (!/^[1-9]\d*$/.test(String(this.id))) {
            this.configError("请选择需要配置的商品。");
            return false;
          }
          try {
            const params = { id: this.id, flag: this.isIfram };
            const res = await getOrederConfig(params);
            if (!res.data || res.data.status !== 200 || !res.data.data || typeof res.data.data.content !== "string") {
              this.configError("商品配置暂不可用，请重试或选择其他商品。");
              return false;
            }
            this.$nextTick(() => {
              // 解决Jquery加载JS会在文件末尾添加时间戳的问题
              $.ajaxSetup({
                cache: true,
              });
              const content = window.CRA1CartControls ? window.CRA1CartControls.transform(res.data.data.content) : res.data.data.content;
              $(".config-box .content").html(content);
              // 嵌入壳：内容注入后通知父页（模块脚本由 jQuery 异步执行，高度由桥接层兜底轮询）
              if (window.__CART_EMBED__ && this.isEmbed) {
                window.__CART_EMBED__.markReady();
              }
            });
            this.content = res.data.data.content;
            return true;
          } catch (error) {
            this.configError("商品配置加载失败，请稍后重试。");
            return false;
          }
        },
        handleCommand(id) {
          // 打开新页面 替换id
          location.href = `/cart/goodsList.htm?product_id=${encodeURIComponent(id)}`;
        },
        getGoodDetail(id) {
          return apiProductDetail({ id }).then((res) => {
            const data = res && res.data;
            if (!data || data.status !== 200 || !data.data || !data.data.product) return;
            this.productInfo = data.data.product;
            this.getProductGroup_second(
              this.productInfo.product_group_id_first
            );
          }).catch(() => { /* Optional product switcher must not break loaded configuration. */ });
        },
        // 获取二级分类
        getProductGroup_second(id) {
          productGroupSecond(id).then((res) => {
            this.secProductGroupList = res.data.data.list.map((item) => {
              item.goodsList = [];
              return item;
            });
            this.getProductGoodList();
          });
        },
        // 获取商品列表
        getProductGoodList() {
          this.secProductGroupList.forEach((item) => {
            const params = {
              page: 1,
              limit: 999999,
              id: item.id,
            };
            productGoods(params).then((res) => {
              item.goodsList = res.data.data.list;
            });
          });
        },
        // 每页展示数改变
        sizeChange(e) {
          this.params.limit = e;
          this.params.page = 1;
          // 获取列表
        },
        // 当前页改变
        currentChange(e) {
          this.params.page = e;
        },

        // 获取通用配置
        getCommonData() {
          try { this.commonData = JSON.parse(localStorage.getItem("common_set_before")) || {}; }
          catch (e) { this.commonData = {}; }
          if (/^[1-9]\d*$/.test(String(this.id)) && this.commonData.cart_change_product == 1) {
            this.getGoodDetail(this.id);
          }
        },
      },
    }).$mount(template);

    typeof old_onload == "function" && old_onload();
  };
})(window);
