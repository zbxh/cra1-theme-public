/** Fixed public display snapshot, shared by frames through one Promise. */
(function (window) {
  if (window.__CRA1_CART_SNAPSHOT_PROMISE__) return;
  var parentPromise=null;
  try { if(window.parent!==window&&window.parent.location.origin===window.location.origin)parentPromise=window.parent.__CRA1_CART_SNAPSHOT_PROMISE__||null; }catch(error){}
  var url='/cra1-shared/snapshot.php?domain=cart';

  window.__CRA1_CART_SNAPSHOT_PROMISE__ = parentPromise || fetch(url, { credentials: 'omit' })
    .then(function (r) {
      if (!r.ok) throw new Error('snapshot http ' + r.status);
      return r.json();
    })
    .then(function (j) {
      return j && j.status === 200 && j.data && j.data.content ? j.data : null;
    })
    .catch(function () {
      return null; // 失败走默认值：页面不得因快照不可用而白屏
    });

  window.__CRA1_CART_SNAPSHOT_PROMISE__.then(function (snap) {
    window.__CRA1_CART_SNAPSHOT__ = snap;
    /* 选配方式标题（后台可自定义）：注入 CSS 变量供 tabs 标题显示。
       仅页面内确实存在消费元素（.top-tab，由融合页 goods 模板产出）时才注入 ——
       本文件被 7 个购物车模板共用，早前无条件注入会让「产品详情页」等
       拿到一个永不使用的页面级变量（埋着的跨页污染：一旦该页出现 .top-tab 就会冒出标题）。 */
    var __tabs = snap && snap.content && snap.content.goodslist && snap.content.goodslist.copy
      ? snap.content.goodslist.copy.tabs_title
      : "";
    if (__tabs && document.querySelector(".top-tab")) {
      document.documentElement.style.setProperty("--tabs-title", JSON.stringify(String(__tabs).slice(0, 20)));
    }
  });
})(window);
