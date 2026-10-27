/* Generated from public/cra1-shared/src. Edit the source and rebuild. */
/* CRA1 shared request contract. Framework adapters keep their existing return shapes. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  shared.version = '1.0.0';
  if (shared.Request) return;
  var BASE = '/console/v1';
  var PUBLIC_PAGES = ['login.htm', 'userStatus.htm', 'goodsList.htm', 'source.htm', 'news_detail.htm', 'helpTotal.htm', 'goods.htm', 'goods_iframe.htm', 'agreement.htm', 'regist.htm', 'forget.htm', 'oauth.htm', '404.htm'];

  function readStorage(key) {
    try { return root.localStorage.getItem(key) || ''; } catch (error) { return ''; }
  }
  function getToken() {
    try {
      if (root.self !== root.top && /\/goods_iframe\.htm$/.test(root.location.pathname)) {
        var token = new URLSearchParams(root.location.search).get('iframe_token');
        if (token) return token;
      }
    } catch (error) { /* A sandboxed frame can still use its local token. */ }
    return readStorage('jwt');
  }
  function headers(options) {
    options = options || {};
    var result = { Accept: 'application/json', language: options.language || readStorage('lang') || 'zh-cn' };
    var token = options.token === undefined ? getToken() : options.token;
    if (token) result.Authorization = 'Bearer ' + token;
    return result;
  }
  function query(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      (Array.isArray(value) ? value : [value]).forEach(function (item) {
        if (item === undefined || item === null) return;
        parts.push(encodeURIComponent(key + (Array.isArray(value) && !/\[\]$/.test(key) ? '[]' : '')) + '=' + encodeURIComponent(String(item)));
      });
    });
    return parts.join('&');
  }
  function unauthorized(options) {
    options = options || {};
    if (options.policy === 'ignore') return;
    // A late response must not clear a newer login token.
    if (options.token !== undefined && options.token !== getToken()) return;
    try { root.localStorage.removeItem('jwt'); } catch (error) { /* Storage may be disabled. */ }
    if (root.document) root.document.dispatchEvent(new CustomEvent('api:unauthorized'));
    if (options.policy !== 'redirect' || !root.location) return;
    var page = root.location.pathname.split('/').pop();
    if (PUBLIC_PAGES.indexOf(page) !== -1) return;
    try { root.sessionStorage.setItem('redirectUrl', root.location.href); } catch (error) { /* Optional return URL. */ }
    root.location.href = '/login.htm';
  }
  function failure(message, code, status, data) {
    var error = new Error(message);
    error.msg = message;
    error.code = code;
    error.status = status || 0;
    if (data !== undefined) error.data = data;
    return error;
  }
  async function request(path, options) {
    options = options || {};
    path = String(path || '/');
    if (/^(?:[a-z]+:)?\/\//i.test(path) || /^[a-z]+:/i.test(path)) throw failure('请求地址无效', 'INVALID_URL');
    var method = String(options.method || 'GET').toUpperCase();
    var url = BASE + (path.charAt(0) === '/' ? path : '/' + path);
    var qs = query(options.params);
    if (qs) url += (url.indexOf('?') === -1 ? '?' : '&') + qs;
    var token = getToken();
    var requestHeaders = Object.assign(headers({ language: options.language, token: token }), options.headers || {});
    var body = options.body;
    var isForm = typeof root.FormData !== 'undefined' && body instanceof root.FormData;
    if (body !== undefined && method !== 'GET' && method !== 'HEAD' && !isForm) requestHeaders['Content-Type'] = 'application/json';
    var controller = new AbortController();
    var external = options.signal;
    var timedOut = false;
    var onAbort = function () { controller.abort(); };
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener('abort', onAbort, { once: true });
    }
    var timeout = options.timeout === undefined ? ((method === 'GET' || method === 'HEAD') ? 15000 : 30000) : Number(options.timeout);
    var timer = timeout > 0 ? root.setTimeout(function () { timedOut = true; controller.abort(); }, timeout) : null;
    try {
      var response = await root.fetch(url, {
        method: method, headers: requestHeaders, credentials: 'include', signal: controller.signal,
        body: body === undefined || method === 'GET' || method === 'HEAD' ? undefined : (isForm ? body : JSON.stringify(body)),
      });
      // Keep the timeout active while reading the response body.
      var text = await response.text();
      var envelope;
      try { envelope = text ? JSON.parse(text) : {}; }
      catch (error) { throw failure('服务响应异常，请稍后重试', 'BAD_RESPONSE', response.status); }
      var status = envelope && envelope.status !== undefined ? Number(envelope.status) : response.status;
      if (response.status === 401 || status === 401) {
        unauthorized({ policy: options.unauthorized || 'notify', token: token });
        throw failure(envelope && envelope.msg || '登录已失效，请重新登录', 'UNAUTHORIZED', 401, envelope);
      }
      if (!response.ok || (envelope && envelope.status !== undefined && status !== 200)) {
        throw failure(envelope && envelope.msg || '请求失败，请稍后重试', 'API_ERROR', response.ok ? status : response.status, envelope);
      }
      return envelope;
    } catch (error) {
      if (timedOut) throw failure('请求超时，请检查网络后重试', 'TIMEOUT');
      if (external && external.aborted) {
        var cancelled = failure('请求已取消', 'CANCELLED');
        cancelled.name = 'AbortError';
        throw cancelled;
      }
      if (error && error.code) throw error;
      throw failure('网络异常，请检查网络连接', 'NETWORK');
    } finally {
      if (timer !== null) root.clearTimeout(timer);
      if (external) external.removeEventListener('abort', onAbort);
    }
  }
  shared.Request = { request: request, headers: headers, getToken: getToken, query: query, unauthorized: unauthorized };
})(typeof window !== 'undefined' ? window : globalThis);

/* Framework independent interactions used by Alpine, Vue and React adapters. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.UI) return;
  var doc = root.document;
  var sequence = 0;
  var icons = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4.5 4.5"></path>',
    close: '<path d="m8 8 8 8m0-8-8 8"></path>',
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6m0-10v.01"></path>',
    success: '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path>',
    error: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v6m0 4v.01"></path>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.info) + '</svg>';
  }
  function focus(element) {
    if (element && element.isConnected && element.focus) {
      try { element.focus({ preventScroll: true }); } catch (error) { element.focus(); }
    }
  }
  function createPopover(options) {
    var host = options.root, trigger = options.trigger, panel = options.panel;
    var id = panel.id || ('cra1-popover-' + (++sequence));
    panel.id = id;
    var open = false, destroyed = false, focusTimer = null, closeTimer = null;
    var group = options.group || 'header';
    trigger.setAttribute('aria-controls', id);
    trigger.setAttribute('aria-expanded', 'false');
    if (options.manageVisibility !== false) panel.hidden = true;
    function cancelClose() {
      root.clearTimeout(closeTimer); closeTimer = null;
    }
    function setOpen(value, restoreFocus) {
      cancelClose();
      value = !!value;
      if (destroyed || value === open) return;
      if (value && options.beforeOpen) options.beforeOpen();
      open = value;
      trigger.setAttribute('aria-expanded', String(open));
      host.classList.toggle('is-open', open);
      if (options.manageVisibility !== false) panel.hidden = !open;
      if (open) root.dispatchEvent(new CustomEvent('cra1:popover-open', { detail: { id: id, group: group } }));
      if (options.onOpenChange) options.onOpenChange(open);
      if (!open && restoreFocus) focus(trigger);
    }
    function openWithFocus() {
      setOpen(true);
      root.setTimeout(function () {
        if (!open || destroyed) return;
        var first = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')).find(function (item) { return item.getClientRects().length && !item.closest('[hidden]'); });
        focus(first);
      }, 0);
    }
    function toggle(event) { if (event) event.preventDefault(); setOpen(!open); }
    function onOutside(event) { if (open && !host.contains(event.target)) setOpen(false); }
    function onKey(event) {
      if (event.key === 'Escape' && open && !event.isComposing) {
        event.preventDefault(); setOpen(false, host.contains(doc.activeElement));
      }
    }
    function onTriggerKey(event) { if (event.key === 'ArrowDown' && !event.isComposing) { event.preventDefault(); openWithFocus(); } }
    function onFocusout(event) {
      root.clearTimeout(focusTimer);
      if (host.contains(event.relatedTarget)) return;
      focusTimer = root.setTimeout(function () { if (open && !host.contains(doc.activeElement)) setOpen(false); }, 0);
    }
    function onOther(event) { if (open && event.detail && event.detail.group === group && event.detail.id !== id) setOpen(false); }
    function onEnter(event) { if (options.hover && event.pointerType === 'mouse') setOpen(true); }
    function onLeave(event) {
      if (!options.hover || event.pointerType !== 'mouse') return;
      var active = doc.activeElement;
      if (host.contains(active) && active.matches(':focus-visible')) return;
      cancelClose(); closeTimer = root.setTimeout(function () { setOpen(false); }, 160);
    }
    if (options.bindTrigger !== false) trigger.addEventListener('click', toggle);
    trigger.addEventListener('keydown', onTriggerKey);
    host.addEventListener('focusout', onFocusout);
    host.addEventListener('pointerenter', onEnter);
    host.addEventListener('pointerleave', onLeave);
    doc.addEventListener('click', onOutside);
    doc.addEventListener('keydown', onKey);
    root.addEventListener('cra1:popover-open', onOther);
    return {
      get isOpen() { return open; },
      setOpen: setOpen, show: function () { setOpen(true); }, close: function (restore) { setOpen(false, restore); },
      toggle: toggle, openWithFocus: openWithFocus,
      destroy: function () {
        if (destroyed) return;
        setOpen(false); destroyed = true; cancelClose(); root.clearTimeout(focusTimer);
        trigger.removeEventListener('click', toggle); trigger.removeEventListener('keydown', onTriggerKey);
        host.removeEventListener('focusout', onFocusout); host.removeEventListener('pointerenter', onEnter); host.removeEventListener('pointerleave', onLeave);
        doc.removeEventListener('click', onOutside); doc.removeEventListener('keydown', onKey); root.removeEventListener('cra1:popover-open', onOther);
      },
    };
  }
  async function copy(text) {
    var value = String(text == null ? '' : text);
    if (!value) return false;
    try {
      if (root.navigator.clipboard && root.isSecureContext) { await root.navigator.clipboard.writeText(value); return true; }
    } catch (error) { /* HTTP and denied clipboard permissions use the same fallback. */ }
    var previous = doc.activeElement, input = null, wrote = false;
    function onCopy(event) {
      try { event.clipboardData.setData('text/plain', value); event.preventDefault(); wrote = true; } catch (error) { /* Native selection remains available. */ }
    }
    try {
      input = doc.createElement('textarea'); input.value = value; input.readOnly = true; input.tabIndex = -1;
      input.setAttribute('aria-hidden', 'true');
      input.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;';
      var dialog = previous && previous.closest ? previous.closest('dialog[open], [role="dialog"]') : null;
      (dialog || doc.body).appendChild(input);
      doc.addEventListener('copy', onCopy, true);
      focus(input); input.select(); input.setSelectionRange(0, value.length);
      return doc.execCommand('copy') || wrote;
    } catch (error) { return wrote; }
    finally { doc.removeEventListener('copy', onCopy, true); if (input) input.remove(); focus(previous); }
  }
  var toastHost = null;
  function toast(text, tone) {
    text = String(text == null ? '' : text);
    if (!text || !doc || !doc.body) return function () {};
    if (!toastHost || !toastHost.isConnected) {
      toastHost = doc.createElement('div'); toastHost.className = 'cui-toasts';
      toastHost.setAttribute('aria-live', 'polite'); toastHost.setAttribute('aria-atomic', 'false');
      toastHost.dataset.cra1Component = 'toast'; doc.body.appendChild(toastHost);
    }
    tone = ['success', 'error', 'warning', 'info'].indexOf(tone) === -1 ? 'info' : tone;
    var item = doc.createElement('div'); item.className = 'cui-toast cui-toast--' + tone;
    var symbol = doc.createElement('span'); symbol.className = 'cui-toast__icon'; symbol.innerHTML = icon(tone === 'warning' ? 'error' : tone);
    var message = doc.createElement('p'); message.className = 'cui-toast__text'; message.textContent = text;
    var button = doc.createElement('button'); button.type = 'button'; button.className = 'cui-toast__close'; button.setAttribute('aria-label', '关闭提示'); button.innerHTML = icon('close');
    item.append(symbol, message, button); toastHost.appendChild(item);
    var timer;
    function dismiss() { root.clearTimeout(timer); item.remove(); }
    button.addEventListener('click', dismiss);
    item.addEventListener('pointerenter', function () { root.clearTimeout(timer); });
    item.addEventListener('pointerleave', function () { timer = root.setTimeout(dismiss, 3200); });
    item.addEventListener('focusin', function () { root.clearTimeout(timer); });
    item.addEventListener('focusout', function () { timer = root.setTimeout(dismiss, 3200); });
    timer = root.setTimeout(dismiss, 3200);
    return dismiss;
  }
  shared.UI = { createPopover: createPopover, copy: copy, toast: toast, icon: icon, focus: focus };
  if (root.addEventListener) root.addEventListener('cra1:toast', function (event) { var detail = event.detail || {}; toast(detail.text, detail.tone); });
})(typeof window !== 'undefined' ? window : globalThis);

/**
 * 本地生成的头像 —— 官网与会员中心共用的唯一实现
 *
 * 为什么需要一个共享文件：
 *   系统没有头像字段（idcsmart_client 无相关列，/console/v1/account 也不返回头像），
 *   因此头像由前端本地生成（零外部请求，不依赖 Gravatar 等服务）。
 *   官网是 Alpine、会员中心是 Vue/React，若各自实现一份必然漂移，
 *   所以算法只此一份，两端都加载本文件。
 *
 * 用法（三种上下文都一样）：
 *   CRA1Avatar.uri(user)      → "url('data:image/svg+xml,...')"  供 CSS background-image
 *   CRA1Avatar.style(user)    → { backgroundImage, backgroundSize, backgroundPosition }
 *   CRA1Avatar.letter(user)   → 'Z'  首字母（叠在渐变之上）
 *
 * 设计（改动前请读）：
 *   1. 确定性：种子 = 账号ID + '|' + 用户名，做 FNV-1a 哈希 —— 同一账号恒得同一张，
 *      刷新页面不会换脸。取数前再混一次（xorshift 风格），避免相邻取值相关。
 *   2. 色板为 12 组同色系深浅过渡、整体中深色调 —— 任意两组都协调，且白字对比度足够。
 *   3. 只叠加「提亮方向」的柔光，**不可加深色光斑**：64px 看着有层次，但 28px 下会糊成污渍。
 *   4. 首字母不嵌进 SVG，由 CSS 文本渲染叠在背景上：小尺寸更清晰，也能直接复用两端字体样式。
 *   5. url() 必须用**单引号**包裹：该值会被写进 HTML 的 style 属性，双引号会截断属性。
 *   6. 缓存放在模块级对象（非响应式）：两端框架若在 getter 里写响应式状态会触发依赖循环。
 */
;(function (root, factory) {
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  var api = shared.Avatar || factory();
  shared.Avatar = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CRA1Avatar = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* 12 组精选色板：同色系深浅过渡，整体中深色调（保证白色首字母对比度） */
  var PALETTES = [
    ['#1D5FD0', '#4FA8FF'], ['#0F56BE', '#1FA2DC'], ['#4F46E5', '#8B7CFF'],
    ['#7C3AED', '#A78BFA'], ['#0E9F6E', '#34C77B'], ['#0D9488', '#2DD4BF'],
    ['#0369A1', '#38BDF8'], ['#C2410C', '#F59E0B'], ['#BE185D', '#EC4899'],
    ['#B91C1C', '#F97316'], ['#1E3A8A', '#2563EB'], ['#047857', '#65A30D']
  ];

  /* 种子 → data URI。放模块级是刻意的：避免在响应式 getter 中写状态 */
  var cache = {};

  function seedOf(user) {
    if (!user) return '';
    var id = user.id != null ? user.id : (user.accountId != null ? user.accountId : '');
    var name = user.username || user.name || user.email || user.phone || '';
    return String(id) + '|' + name;
  }

  function uri(user) {
    var seed = seedOf(user);
    if (!seed || seed === '|') return '';
    if (cache[seed]) return cache[seed];

    /* FNV-1a：短字符串上分布均匀，实现只有几行 */
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
    }
    /* 取数前再混一次，避免相邻取值相关 */
    var next = function (n) {
      h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
      h = (h ^ (h >>> 13)) >>> 0;
      return h % n;
    };

    var p = PALETTES[next(PALETTES.length)];

    /* 斜向渐变角度随哈希在 35°~145° 之间变化，让每张的光感朝向不同 */
    var ang = ((35 + next(110)) * Math.PI) / 180;
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var f = function (v) { return v.toFixed(3); };

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
      + '<defs>'
      + '<linearGradient id="g" x1="' + f(0.5 - dx / 2) + '" y1="' + f(0.5 - dy / 2) + '"'
      + ' x2="' + f(0.5 + dx / 2) + '" y2="' + f(0.5 + dy / 2) + '">'
      + '<stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient>'
      /* 左上柔光：只提亮、不变暗，小尺寸下保持干净 */
      + '<radialGradient id="hl" cx=".26" cy=".2" r=".85">'
      + '<stop offset="0" stop-color="#fff" stop-opacity=".3"/>'
      + '<stop offset="55%" stop-color="#fff" stop-opacity=".08"/>'
      + '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
      + '</defs>'
      + '<rect width="64" height="64" fill="url(#g)"/>'
      + '<rect width="64" height="64" fill="url(#hl)"/>'
      + '</svg>';

    /* 单引号包裹：该值会写进 HTML 的 style 属性，双引号会截断属性 */
    cache[seed] = "url('data:image/svg+xml," + encodeURIComponent(svg) + "')";
    return cache[seed];
  }

  /** CSS background 样式（同一张 64×64 经 cover 适配任意尺寸） */
  function style(user) {
    var u = uri(user);
    return u
      ? { backgroundImage: u, backgroundSize: 'cover', backgroundPosition: 'center' }
      : {};
  }

  /** 首字母：始终显示，叠在生成头像的渐变之上（渐变只作底，字母是识别主体） */
  function letter(user) {
    var name = user ? (user.username || user.name || user.email || user.phone || '') : '';
    return String(name || '?').slice(0, 1).toUpperCase();
  }

  return { uri: uri, style: style, letter: letter };
});

/* One search data source and one mounted UI for all three CRA1 themes. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.HeaderSearch) { root.CRA1HeaderSearch = shared.HeaderSearch; return; }
  var sourcesDefault = [
    { key: 'products', label: '订购商品', path: 'product' },
    { key: 'news', label: '新闻文章', path: 'news' },
    { key: 'announcement', label: '官方公告', path: 'announcement' },
    { key: 'help', label: '帮助文档', path: 'help' },
  ];
  function pluginSources(options) {
    options = options || {};
    var sources = [{ key: 'products', label: '订购商品', path: 'product' }];
    if (options.includeHosts) sources.unshift({ key: 'hosts', label: '我的产品', path: 'host' });
    var plugins = options.plugins;
    if (!plugins) {
      try {
        var node = root.document.getElementById('addons_js');
        plugins = JSON.parse(node ? node.getAttribute('addons_js') || '[]' : '[]');
      } catch (error) { plugins = []; }
    }
    if (!Array.isArray(plugins)) plugins = [];
    [['IdcsmartNews', 'news', '新闻文章'], ['IdcsmartAnnouncement', 'announcement', '官方公告'], ['IdcsmartHelp', 'help', '帮助文档']].forEach(function (definition) {
      var plugin = plugins.find(function (item) { return item && item.name === definition[0] && Number(item.id) > 0; });
      if (plugin) sources.push({ key: definition[1], path: definition[1], label: definition[2], pluginId: Number(plugin.id) });
    });
    return sources;
  }
  async function search(options) {
    options = options || {};
    var keywords = String(options.keywords || '').trim();
    if (!keywords) return { groups: [], errors: [] };
    var sources = options.sources ? options.sources.slice() : sourcesDefault.slice();
    if (!options.sources && options.includeHosts) sources.unshift({ key: 'hosts', label: '我的产品', path: 'host' });
    var responses = await Promise.allSettled(sources.map(async function (source) {
      var json = await shared.Request.request('/' + source.path, {
        params: { keywords: keywords, page: 1, limit: 6 }, signal: options.signal,
        language: options.language, unauthorized: 'ignore', timeout: 10000,
      });
      if (!json.data || !Array.isArray(json.data.list)) throw new Error('搜索结果格式错误');
      return json.data;
    }));
    var index = 0, groups = [], errors = [];
    responses.forEach(function (response, sourceIndex) {
      var source = sources[sourceIndex];
      if (response.status !== 'fulfilled') { errors.push(source.label); return; }
      var data = response.value, rows = data.list;
      if (source.key === 'help') {
        var term = keywords.toLocaleLowerCase();
        rows = rows.reduce(function (all, group) {
          if (!group) return all;
          return all.concat((Array.isArray(group.helps) ? group.helps : []).filter(function (row) {
            return row && (row.search === true || String(row.title || '').toLocaleLowerCase().includes(term));
          }).map(function (row) { return Object.assign({}, row, { category: group.name }); }));
        }, []);
      }
      rows = rows.filter(function (row) { return row && Number.isInteger(Number(row.id)) && Number(row.id) > 0; });
      var items = rows.slice(0, 6).map(function (row) {
        var id = Number(row.id);
        var item = { key: source.key + ':' + id, index: index++, title: row.title || row.name || '内容 #' + id, description: '' };
        if (source.key === 'hosts') {
          item.title = row.product_name || row.name || '产品 #' + id;
          item.description = [row.name, '编号 ' + id].filter(Boolean).join(' · ');
          item.url = '/productdetail.htm?id=' + id;
        } else if (source.key === 'products') {
          item.description = [row.product_group_name_first, row.product_group_name_second].filter(Boolean).join(' / ');
          item.url = '/cart/goodsList.htm?product_id=' + id;
        } else if (source.key === 'announcement') {
          item.description = '官方公告'; item.url = '/announce-details.html?id=' + id;
        } else if (options.context === 'website' || !Number.isInteger(Number(source.pluginId)) || Number(source.pluginId) <= 0) {
          item.description = row.category || source.label;
          item.url = (source.key === 'news' ? '/news-details.html' : '/document-details.html') + '?id=' + id;
        } else {
          item.description = row.category || source.label;
          item.url = '/plugin/' + Number(source.pluginId) + '/' + (source.key === 'news' ? 'news_detail' : 'helpTotal') + '.htm?id=' + id;
        }
        return item;
      });
      if (items.length) groups.push({ key: source.key, label: source.label, items: items, more: rows.length > 6 || (source.key !== 'help' && Number(data.count) > 6) });
    });
    return { groups: groups, errors: errors };
  }
  var sequence = 0;
  function mount(host, options) {
    options = options || {};
    if (host.__cra1HeaderSearch) return host.__cra1HeaderSearch;
    var UI = shared.UI, doc = host.ownerDocument;
    var prefix = options.idPrefix || ('cra1-header-search-' + (++sequence));
    var copy = { placeholder: '搜索产品、新闻、公告、文档', searching: '正在搜索…', noresult: '没有找到相关内容，请换个关键词' };
    Object.keys(options.copy || {}).forEach(function (key) { if (options.copy[key] !== undefined) copy[key] = options.copy[key]; });
    host.dataset.cra1Component = 'header-search';
    host.innerHTML = '<button type="button" class="cra1-header__icon-btn cui-button cui-button--ghost cui-button--icon" aria-label="搜索产品与文章">' + UI.icon('search') + '</button>' +
      '<div class="cra1-header-search__panel" hidden><form class="cra1-header-search__form" role="search">' +
      '<button type="submit" class="cra1-header-search__search-btn cui-button cui-button--ghost cui-button--icon" aria-label="开始搜索">' + UI.icon('search') + '</button>' +
      '<input type="search" maxlength="100" autocomplete="off" class="cra1-header-search__input cui-input" aria-label="搜索产品、新闻、公告和帮助文档" role="combobox" aria-autocomplete="list" aria-expanded="false">' +
      '<button type="button" class="cra1-header-search__small-btn cui-button cui-button--ghost cui-button--icon" aria-label="清空搜索" hidden>' + UI.icon('close') + '</button>' +
      '<button type="button" class="cra1-header-search__close cui-button cui-button--ghost" aria-label="关闭搜索"><span>Esc</span><span class="cra1-header-search__close-label">收起</span></button></form></div>';
    var trigger = host.querySelector('.cra1-header__icon-btn'), panel = host.querySelector('.cra1-header-search__panel');
    var input = host.querySelector('input'), form = host.querySelector('form');
    var clearButton = host.querySelector('.cra1-header-search__small-btn'), closeButton = host.querySelector('.cra1-header-search__close');
    var resultsNode = null, listNode = null, destroyed = false, composing = false;
    var state = { groups: [], errors: [], loading: false, activeIndex: -1 }, generation = 0, timer = null, abort = null;
    panel.id = prefix + '-panel'; input.id = prefix;
    input.placeholder = copy.placeholder;
    function items() { return state.groups.reduce(function (all, group) { return all.concat(group.items); }, []); }
    function invalidate() { generation += 1; root.clearTimeout(timer); timer = null; if (abort) { abort.abort(); abort = null; } }
    function setActive() {
      if (!listNode) return;
      Array.from(listNode.querySelectorAll('[role="option"]')).forEach(function (item) {
        var active = Number(item.dataset.index) === state.activeIndex;
        item.classList.toggle('is-active', active); item.setAttribute('aria-selected', String(active));
      });
      if (state.activeIndex >= 0) input.setAttribute('aria-activedescendant', prefix + '-results-' + state.activeIndex);
      else input.removeAttribute('aria-activedescendant');
    }
    function navigate(item, event) {
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)) return;
      if (event) event.preventDefault();
      popover.close(false);
      if (options.onNavigate) options.onNavigate(item.url);
      else root.location.href = item.url;
    }
    function render() {
      clearButton.hidden = !input.value;
      var visible = popover.isOpen && !!input.value.trim();
      input.setAttribute('aria-expanded', String(visible));
      if (!visible) {
        if (resultsNode) resultsNode.remove(); resultsNode = null; listNode = null;
        input.removeAttribute('aria-controls'); input.removeAttribute('aria-activedescendant'); return;
      }
      if (!resultsNode) { resultsNode = doc.createElement('div'); resultsNode.className = 'cra1-header-search__results'; panel.appendChild(resultsNode); }
      resultsNode.replaceChildren();
      var count = items().length;
      var status = doc.createElement('p'); status.className = 'cra1-header-search__status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      status.textContent = state.loading || composing ? copy.searching : count ? '找到 ' + count + ' 条结果' : state.errors.length ? '暂时无法加载搜索结果' : copy.noresult;
      listNode = doc.createElement('div'); listNode.id = prefix + '-results'; listNode.setAttribute('role', 'listbox'); listNode.setAttribute('aria-label', '搜索结果'); listNode.setAttribute('aria-busy', String(state.loading));
      input.setAttribute('aria-controls', listNode.id);
      resultsNode.append(status, listNode);
      state.groups.forEach(function (group) {
        var section = doc.createElement('div'); section.className = 'cra1-header-search__group'; section.setAttribute('role', 'group'); section.setAttribute('aria-label', group.label);
        var heading = doc.createElement('p'); heading.className = 'cra1-header-search__group-title';
        var label = doc.createElement('span'); label.className = 'cra1-header-search__group-label'; label.textContent = group.label; heading.appendChild(label);
        if (group.more) { var more = doc.createElement('span'); more.textContent = '仅显示前 6 条，可细化关键词'; heading.appendChild(more); }
        section.appendChild(heading);
        group.items.forEach(function (item) {
          var link = doc.createElement('a'); link.id = prefix + '-results-' + item.index; link.href = item.url;
          link.dataset.index = item.index; link.className = 'cra1-header-search__item'; link.setAttribute('role', 'option');
          var title = doc.createElement('span'); title.className = 'cra1-header-search__item-title'; title.textContent = item.title; link.appendChild(title);
          if (item.description) { var description = doc.createElement('span'); description.className = 'cra1-header-search__item-description'; description.textContent = item.description; link.appendChild(description); }
          link.addEventListener('mouseenter', function () { state.activeIndex = item.index; setActive(); });
          link.addEventListener('click', function (event) { navigate(item, event); }); section.appendChild(link);
        });
        listNode.appendChild(section);
      });
      if (state.errors.length) {
        var error = doc.createElement('div'); error.className = 'cra1-header-search__error'; error.setAttribute('role', 'status');
        var message = doc.createElement('span'); message.textContent = state.errors.join('、') + '暂时无法搜索';
        var retry = doc.createElement('button'); retry.type = 'button'; retry.textContent = '重试'; retry.addEventListener('mousedown', function (event) { event.preventDefault(); });
        retry.addEventListener('click', function () { UI.focus(input); perform(); }); error.append(message, retry); resultsNode.appendChild(error);
      }
      setActive();
    }
    async function perform() {
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1;
      var keywords = input.value.trim();
      if (!popover.isOpen || !keywords || composing || destroyed) { state.loading = false; render(); return; }
      state.loading = true; render();
      var current = generation, controller = abort = new AbortController();
      try {
        var configuration = options.getSearchOptions ? options.getSearchOptions() : options;
        var result = await search(Object.assign({}, configuration, { keywords: keywords, signal: controller.signal }));
        if (current !== generation || destroyed || !popover.isOpen) return;
        state.groups = result.groups; state.errors = result.errors;
      } catch (error) {
        if (current !== generation || destroyed || !popover.isOpen) return;
        state.errors = ['搜索服务'];
      }
      if (current !== generation || destroyed || !popover.isOpen) return;
      abort = null; state.loading = false; render();
    }
    function schedule() {
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1;
      state.loading = popover.isOpen && !!input.value.trim() && !composing;
      render(); if (state.loading) timer = root.setTimeout(perform, 280);
    }
    var popover = UI.createPopover({
      root: host, trigger: trigger, panel: panel, group: 'header', beforeOpen: options.beforeOpen,
      onOpenChange: function (open) {
        if (!open) { composing = false; invalidate(); state.loading = false; }
        if (options.onOpenChange) options.onOpenChange(open);
        render();
        if (open) { UI.focus(input); if (input.value.trim()) perform(); }
      },
    });
    function onInput() { schedule(); }
    function onCompositionStart() { composing = true; invalidate(); state.loading = false; render(); }
    function onCompositionEnd() { composing = false; schedule(); }
    function onKey(event) {
      if (event.isComposing || composing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); popover.close(true); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var count = items().length; if (!count) return;
      event.preventDefault(); state.activeIndex = event.key === 'ArrowDown' ? (state.activeIndex + 1) % count : state.activeIndex < 0 ? count - 1 : (state.activeIndex + count - 1) % count;
      setActive(); var item = doc.getElementById(prefix + '-results-' + state.activeIndex); if (item) item.scrollIntoView({ block: 'nearest' });
    }
    function onSubmit(event) { event.preventDefault(); if (composing) return; var selected = items()[state.activeIndex]; if (selected) navigate(selected); else perform(); }
    function onClear() { input.value = ''; schedule(); UI.focus(input); }
    function onClose() { popover.close(true); }
    function preventFocus(event) { event.preventDefault(); }
    function stopClick(event) { event.stopPropagation(); }
    var media = root.matchMedia('(max-width: 767px)');
    function onBreakpoint() { popover.close(false); }
    input.addEventListener('input', onInput); input.addEventListener('compositionstart', onCompositionStart); input.addEventListener('compositionend', onCompositionEnd); input.addEventListener('keydown', onKey);
    form.addEventListener('submit', onSubmit); clearButton.addEventListener('mousedown', preventFocus); clearButton.addEventListener('click', onClear); closeButton.addEventListener('click', onClose); host.addEventListener('click', stopClick);
    media.addEventListener('change', onBreakpoint);
    var component = {
      open: function () { popover.show(); }, close: function (restore) { popover.close(restore); }, refresh: schedule,
      get isOpen() { return popover.isOpen; },
      destroy: function () {
        if (destroyed) return;
        popover.destroy(); destroyed = true; invalidate();
        input.removeEventListener('input', onInput); input.removeEventListener('compositionstart', onCompositionStart); input.removeEventListener('compositionend', onCompositionEnd); input.removeEventListener('keydown', onKey);
        form.removeEventListener('submit', onSubmit); clearButton.removeEventListener('mousedown', preventFocus); clearButton.removeEventListener('click', onClear); closeButton.removeEventListener('click', onClose); host.removeEventListener('click', stopClick);
        media.removeEventListener('change', onBreakpoint); host.replaceChildren(); delete host.__cra1HeaderSearch;
      },
    };
    host.__cra1HeaderSearch = component;
    return component;
  }
  shared.HeaderSearch = { search: search, mount: mount, pluginSources: pluginSources };
  root.CRA1HeaderSearch = shared.HeaderSearch;
})(typeof window !== 'undefined' ? window : globalThis);
