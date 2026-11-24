/* Public header appearance must also load on anonymous native product pages.
   Reuse the sidebar's request and memory cache; never persist a configuration. */
(function (root) {
  // Native modules retain all controls and scripts. Only the theme-owned
  // navigation receives shared decorative effects in this standalone bundle.
  function effects(){if(root.CRA1Shared&&root.CRA1Shared.UIEffects)root.CRA1Shared.UIEffects.start();}
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',effects,{once:true});else effects();
  function panelTicket() {
    if (!root.document.documentElement.hasAttribute('data-cra1-native-panel')) return;
    var id = new URLSearchParams(root.location.search).get('id');
    if (!/^[1-9]\d*$/.test(id || '')) return;
    root.CRA1Shared.Request.request('/cra1-theme/member/host/' + id + '/ticket-entry', { unauthorized: 'silent' }).then(function (result) {
      var url = result.data && result.data.url;
      if (!url) return;
      var action = root.document.createElement('div');
      action.className = 'cra1-native-panel-support';
      var link = root.document.createElement('a');
      link.href = url;
      link.textContent = '提交工单';
      action.appendChild(link);
      var observer;
      var attach = function () {
        if (action.isConnected) return true;
        var main = root.document.querySelector('.product_detail .el-main, .product-detail .el-main, .product_detail main, .product-detail main, .product_detail .main-content, .product-detail .main-content, .template .el-main, .template main');
        if (!main || main.closest('[v-cloak]')) return false;
        main.prepend(action);
        if (observer) observer.disconnect();
        return true;
      };
      if (!attach()) {
        observer = new MutationObserver(attach);
        observer.observe(root.document.body, { attributes: true, attributeFilter: ['v-cloak'], childList: true, subtree: true });
        root.setTimeout(function () { observer.disconnect(); }, 12000);
      }
    }).catch(function () {});
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', panelTicket, { once:true });
  else panelTicket();
  if (root.__CRA1_MEMBER_SNAPSHOT_PROMISE__) return;
  root.__CRA1_MEMBER_SNAPSHOT_PROMISE__ = root.fetch('/cra1-shared/snapshot.php?domain=member', { credentials: 'omit' })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (response) {
      if (!response || response.status !== 200 || !response.data) return null;
      root.__CRA1_MEMBER_SNAPSHOT__ = response.data;
      root.dispatchEvent(new CustomEvent('cra1:member-content', { detail: response.data }));
      return response.data;
    }).catch(function () { return null; });
})(window);
