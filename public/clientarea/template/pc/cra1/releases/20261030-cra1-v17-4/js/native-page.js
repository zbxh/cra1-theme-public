/* Add navigation around a native module without remounting its business view. */
(function (root) {
  'use strict';
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
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})(window);
