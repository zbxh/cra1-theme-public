/* Add navigation around a native module without remounting its business view. */
(function (root) {
  'use strict';
  function groupPluginAction(content) {
    if (!/^\/module\/(?:mf_cloud|mf_dcim)\/product_detail\.htm$/.test(root.location.pathname)) return;
    var doc = root.document;
    var business = content.querySelector('#product_detail_cloud');
    var action = content.querySelector(':scope > a.sch-ip-change-btn');
    if (!business || !action) return;
    var origin = doc.createComment('CRA1 plugin action fallback');
    content.insertBefore(origin, action);
    var column = doc.createElement('div');
    column.className = 'el-col el-col-8 cra1-native-action';
    var card = doc.createElement('div');
    card.className = 'manage-item cra1-native-action-card';
    var description = doc.createElement('div');
    description.className = 'item-bottom';
    description.textContent = /[\u3400-\u9fff]/.test(action.textContent)
      ? '查看更换规则，按需申请更换 IP。'
      : 'View replacement rules and request an IP change.';
    card.appendChild(description);
    column.appendChild(card);
    function place() {
      var row = business.querySelector('.main-card .manage-content > .el-row');
      if (row && row.querySelector('.manage-item')) {
        // Move the actual hook link: keep its URL, permission decision and listeners.
        if (action.parentNode !== card) card.insertBefore(action, description);
        if (column.parentNode !== row) row.appendChild(column);
      } else {
        // A newer module may replace its management view. Keep the entry reachable.
        if (action.parentNode !== content) content.insertBefore(action, origin.nextSibling);
        if (column.parentNode) column.remove();
      }
    }
    place();
    // Native Vue may create the management tab later or replace its children.
    var observer = new MutationObserver(place);
    observer.observe(business, {childList: true, subtree: true});
    root.addEventListener('pagehide', function () { observer.disconnect(); }, {once: true});
    root.addEventListener('pageshow', function (event) { if (event.persisted) { place(); observer.observe(business, {childList: true, subtree: true}); } });
  }
  function mount() {
    var doc = root.document;
    if (root.__CRA1_NATIVE_PAGE__ || !/^\/module\/[A-Za-z][A-Za-z0-9_]*\/product_(?:list|detail)\.htm$/.test(root.location.pathname)) return;
    if (!doc.body || doc.querySelector('.cra1-shell,aside-menu,.cra1-aside') || !root.Vue) return;
    root.__CRA1_NATIVE_PAGE__ = true;
    var shell = doc.createElement('div');
    shell.id = 'cra1-native-page';
    shell.className = 'cra1-shell';
    shell.innerHTML = '<div class="cra1-native-page__navigation"><aside-menu :menu-active-id="5" @getruleslist="getRule"></aside-menu></div><div class="cra1-shell__body"><div class="cra1-native-page__navigation"><top-menu ref="topMenuRef"></top-menu></div><main class="cra1-shell__content cra1-native-page__content"></main></div>';
    var content = shell.querySelector('main');
    Array.from(doc.body.childNodes).forEach(function (node) {
      if (node.nodeType === 1 && (/^(SCRIPT|STYLE|LINK)$/.test(node.tagName) || node.matches('.el-dialog__wrapper,.v-modal,.el-popper,[role="tooltip"]'))) return;
      content.appendChild(node);
    });
    doc.body.appendChild(shell);
    // Only the two navigation roots are compiled. Moving the existing content
    // preserves its Vue instance, input values, listeners and pending requests.
    new root.Vue({
      components: {asideMenu: asideMenu},
      methods: {getRule: function (rules) {
        root.__CRA1_RULES__ = rules;
        root.dispatchEvent(new CustomEvent('cra1:rules', {detail: rules}));
      }}
    }).$mount(shell.firstElementChild);
    new root.Vue({components: {topMenu: topMenu}}).$mount(shell.querySelector('.cra1-shell__body').firstElementChild);
    groupPluginAction(content);
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})(window);
