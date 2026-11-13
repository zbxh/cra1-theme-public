/* A login-scoped search directory of the member's real menu and linked tabs. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.MemberSearchPages) return;
  var cached = null, pending = null, session = '', generation = 0, watching = false;
  var tabs = {
    'account.htm': [['profile', '基本资料'], ['security', '安全设置'], ['credit', '余额记录']],
    'finance.htm': [['orders', '我的订单'], ['credit', '余额记录'], ['freeze', '冻结记录'], ['transactions', '交易记录']],
    'security.htm': [['overview', '安全概览'], ['api', 'API 密钥'], ['ssh', 'SSH 密钥'], ['log', '操作日志'], ['group', '安全组']],
    'productList.htm': [['using', '使用中'], ['expiring', '即将到期'], ['overdue', '已逾期'], ['deleted', '已删除']],
  };
  function token() { return shared.Request && shared.Request.getToken ? shared.Request.getToken() : ''; }
  function invalidate() { generation++; cached = null; pending = null; session = ''; }
  function watch() {
    if (watching) return;
    watching = true;
    if (shared.NotificationSession) shared.NotificationSession.watch(invalidate);
    else root.document.addEventListener('api:unauthorized', invalidate);
  }
  function language(options) {
    if (options.language) return options.language;
    try { return root.localStorage.getItem('lang') || 'zh-cn'; } catch (error) { return 'zh-cn'; }
  }
  function route(value) {
    var raw = String(value || '').trim(), url;
    if (!raw || raw === '#' || /[\\\u0000-\u001f]/.test(raw)) return null;
    try { url = new URL(raw, root.location.origin + '/'); } catch (error) { return null; }
    if (url.origin !== root.location.origin || !/\.htm$/.test(url.pathname)) return null;
    var privateQuery = false;
    url.searchParams.forEach(function (value, key) { if (/token|password|passwd|secret|authorization|^jwt$/i.test(key)) privateQuery = true; });
    if (privateQuery || /\/(?:login|regist|forget|oauth|transfer|404|noPermissions|networkErro)\.htm$/.test(url.pathname)) return null;
    // Detail and checkout pages need a concrete record/context. They are indexed
    // by their own search source rather than by a menu placeholder.
    if (/\/(?:productdetail|orderDetail|cashier|newsView|news_detail|ticketDetails|contractDetail|msgDetail)\.htm$/.test(url.pathname)
        && !url.searchParams.get('id')) return null;
    return url;
  }
  function href(url) { return url.pathname + url.search + url.hash; }
  function enabled(value) { return value === true || Number(value) === 1; }
  function pluginIds(context) {
    var ids = new Set(), plugins = [];
    try {
      var node = root.document.getElementById('addons_js');
      plugins = JSON.parse((node && node.getAttribute('addons_js')) || root.document.documentElement.getAttribute('addons_js') || '[]');
    } catch (error) { /* The website provides links instead of the native DOM. */ }
    (Array.isArray(plugins) ? plugins : []).forEach(function (plugin) {
      if (plugin && (plugin.status === undefined || enabled(plugin.status)) && (plugin.enabled === undefined || enabled(plugin.enabled))) ids.add(String(plugin.id));
    });
    Object.values(context.links || {}).forEach(function (value) {
      var url = route(value), match = url && /^\/plugin\/([1-9]\d*)\//.exec(url.pathname);
      if (match) ids.add(match[1]);
    });
    return ids;
  }
  function project(menu, options) {
    options = options || {};
    var features = options.features || {}, locale = options.language || 'zh-cn', result = [], seen = Object.create(null);
    function allowed(url) {
      var file = url.pathname.split('/').pop(), tab = url.searchParams.get('tab');
      var plugin = /^\/plugin\/([1-9]\d*)\//.exec(url.pathname);
      if (plugin && !options.projected && !(options.pluginIds && options.pluginIds.has(plugin[1]))) return false;
      if (file === 'recharge.htm' && !enabled(features.recharge_open)) return false;
      if (file === 'withdrawal.htm' && !enabled(features.withdraw_open)) return false;
      if ((file === 'security_ssh.htm' || (file === 'security.htm' && tab === 'ssh')) && !enabled(features.ssh)) return false;
      if ((file === 'security_group.htm' || file === 'group_rules.htm' || (file === 'security.htm' && tab === 'group')) && !enabled(features.security_group)) return false;
      return shared.Access && shared.Access.canUrl(href(url));
    }
    function add(title, url, parents, kind) {
      title = String(title || '').trim();
      if (!title || !url || !allowed(url)) return;
      var canonical = new URL(url.href); canonical.searchParams.sort();
      var key = href(canonical);
      if (seen[key]) return;
      seen[key] = true;
      result.push({ key: 'pages:' + key, title: title, description: (kind === 'tab' ? '标签页' : '会员页面') + (parents.length ? ' · ' + parents.join(' / ') : ''), url: href(url) });
    }
    function walk(nodes, parents) {
      (Array.isArray(nodes) ? nodes : []).forEach(function (node) {
        if (!node || enabled(node.hidden) || node.type === 'separator' || (node.enabled !== undefined && !enabled(node.enabled))) return;
        var name = String((node.language && node.language[locale]) || node.name || '').trim();
        var raw = shared.Navigation ? shared.Navigation.href(node) : node.url;
        var url = route(raw), children = node.children || node.child || node.items || [];
        // Product category projections use this stable menu ID to retain their
        // product selection and content settings on the destination page.
        if (url && url.pathname === '/productList.htm' && node.id && !url.searchParams.has('cloud_menu')) url.searchParams.set('cloud_menu', node.id);
        // A module container's fallback productList URL is not its own page.
        var container = children.length && ['module', 'res_module'].indexOf(node.type) !== -1;
        if (url && !container) {
          add(name, url, parents, 'page');
          var definitions = tabs[url.pathname.slice(1)];
          if (definitions && !url.searchParams.has('tab')) definitions.forEach(function (tab) {
            var target = new URL(url.href); target.searchParams.set('tab', tab[0]);
            add(tab[1], target, parents.concat(name ? [name] : []), 'tab');
          });
        }
        walk(children, parents.concat(name ? [name] : []));
      });
    }
    add('控制台首页', route('/home.htm'), [], 'page');
    walk(menu, []);
    return result;
  }
  async function snapshot() {
    if (root.__CRA1_MEMBER_SNAPSHOT__ && Array.isArray(root.__CRA1_MEMBER_SNAPSHOT__.sidebar)) return root.__CRA1_MEMBER_SNAPSHOT__;
    var response;
    if (root.__CRA1_MEMBER_SNAPSHOT_PROMISE__) {
      var timer;
      try {
        response = await Promise.race([root.__CRA1_MEMBER_SNAPSHOT_PROMISE__, new Promise(function (resolve, reject) {
          timer = root.setTimeout(function () { reject(new Error('会员页面读取超时')); }, 10000);
        })]);
      } finally { root.clearTimeout(timer); }
    }
    else {
      var controller = new AbortController(), timer = root.setTimeout(function () { controller.abort(); }, 10000);
      try {
        var json = await root.fetch('/cra1-shared/snapshot.php?domain=member', { credentials: 'omit', cache: 'no-store', signal: controller.signal });
        if (json.ok) { var payload = await json.json(); if (payload && payload.status === 200) response = payload.data; }
      } finally { root.clearTimeout(timer); }
    }
    return response && Array.isArray(response.sidebar) ? response : null;
  }
  async function read(options) {
    var current = token();
    if (!current) { invalidate(); return []; }
    watch();
    if (session !== current) { invalidate(); session = current; }
    var locale = language(options), stamp = generation;
    await shared.Access.read();
    if (current !== token() || stamp !== generation) return [];
    if (cached && cached.language === locale && Date.now() - cached.time < 30000) return cached.items;
    if (pending && pending.language === locale) return pending.promise;
    var active = function () { return current === token() && stamp === generation; };
    var promise = (async function () {
      var data = null;
      try { data = await snapshot(); } catch (error) { /* Match the navigation's native-menu fallback. */ }
      if (!active()) return [];
      var context = shared.Runtime ? shared.Runtime.context() : {}, menu;
      if (data) menu = data.sidebar; // An explicitly empty tree stays empty.
      else {
        var response = await shared.Request.request('/menu', { timeout: 10000, language: locale });
        if (!response.data || !Array.isArray(response.data.menu)) throw new Error('会员页面暂时无法读取');
        menu = response.data.menu;
      }
      if (!active()) return [];
      var items = project(menu, { language: locale, projected: !!data, pluginIds: pluginIds(context), features: Object.assign({}, context.features || {}, data && data.features || {}) });
      cached = { language: locale, time: Date.now(), items: items };
      return items;
    })();
    pending = { language: locale, promise: promise };
    try { return await promise; } finally { if (active() && pending && pending.promise === promise) pending = null; }
  }
  function rank(item, value) {
    var url = route(item.url), aliases = [];
    if (url && url.pathname === '/security.htm') {
      if (url.searchParams.get('tab') === 'ssh') aliases = ['SSH key', 'SSH keys', 'SSH公钥'];
      if (url.searchParams.get('tab') === 'api') aliases = ['API key', 'API keys', 'apikey'];
    }
    return shared.SearchMatch.score(item.title, value, { aliases: aliases, description: item.description });
  }
  shared.MemberSearchPages = {
    invalidate: invalidate,
    search: async function (keywords, options) {
      options = options || {};
      var term = String(keywords || '').trim(), current = token();
      if (!current || !term || (options.signal && options.signal.aborted)) { if (!current) invalidate(); return []; }
      var rows = await read(options);
      if (current !== token() || (options.signal && options.signal.aborted)) return [];
      return rows.map(function (item, index) { return { item: item, rank: rank(item, term), index: index }; })
        .filter(function (entry) { return entry.rank > 0 && shared.Access.canUrl(entry.item.url); })
        .sort(function (a, b) { return b.rank - a.rank || a.index - b.index; })
        .slice(0, 8).map(function (entry) { return Object.assign({}, entry.item); });
    },
  };
})(window);
