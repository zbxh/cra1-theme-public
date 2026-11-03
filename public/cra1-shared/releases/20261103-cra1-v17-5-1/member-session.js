/* Generated from public/cra1-shared/src. Edit the source and rebuild. */
/* Customer-visible failures only. Keep business validation useful without exposing diagnostics. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  var fallback = '操作暂时无法完成，请稍后重试或联系客服';
  function message(error, options) {
    options = options || {};
    var response = error && error.response && error.response.data;
    var data = response || error && error.data;
    var value = typeof error === 'string' ? error : data && (data.msg || data.message) || error && (error.msg || error.message);
    var status = Number(options.status || data && data.status || error && error.status || 0);
    var code = error && error.code;
    if (status === 401) return '登录已失效，请重新登录';
    if (status === 429) return '操作过于频繁，请稍后重试';
    if (code === 'CANCELLED' || code === 'ERR_CANCELED' || error && error.name === 'AbortError') return '请求已取消';
    if (code === 'TIMEOUT' || code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      var method = options.method || error && (error.method || error.config && error.config.method);
      return method && !/^(GET|HEAD|OPTIONS)$/i.test(method)
        ? '暂未收到操作结果，请先查看当前状态，避免重复提交'
        : '等待响应超时，请稍后重试';
    }
    if (code === 'NETWORK' || code === 'ERR_NETWORK') return '网络连接暂时中断，请检查网络后重试';
    if (status >= 500) return '服务暂时不可用，请稍后重试或联系客服';
    if (typeof value !== 'string') return options.fallback || fallback;
    value = value.trim();
    // Inspect before removing control characters, so split diagnostics cannot become public text.
    if (!value || value.length > 240 || /[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value)) return options.fallback || fallback;
    var internal = /魔方云|智简魔方|idcsmart|\b(?:re)?mf_(?:cloud|dcim|finance)\b|SQLSTATE|SQL syntax|PDOException|mysqli|数据库|数据表|\b(?:table|column)\b.{0,80}(?:exist|unknown)|stack\s*trace|traceback|fatal\s*error|parse\s*error|\b(?:TypeError|ReferenceError|SyntaxError|Exception|ThinkPHP|Guzzle|Symfony)\b|cannot (?:read|set) propert|is not (?:defined|a function)|unexpected token|failed to fetch|network\s*error|load failed|request failed with status|timeout of \d|curl(?:\s*error)?|upstream|provider|供应商|上游服务|下游服务|ECONN\w*|ENOTFOUND|EAI_AGAIN|CORS|检查兼容性|主题脚本|模块计价接口|配置接口返回异常/i;
    var privateValue = /https?:\/\/|(?:\b\d{1,3}\.){3}\d{1,3}\b|(?:\/(?:www|root|etc|usr|var|home|srv|opt|tmp)\/)|[a-z]:\\|[\w/.-]+\.(?:php|sql|jsx?|tsx?)(?::\d+|\s+on\s+line\b)|(?:authorization|bearer|(?:access[_-]?|refresh[_-]?)?token|cookie|client[_-]?secret|api[_-]?(?:key|secret)|secret[_-]?key|password|密码|令牌|密钥)\s*[:=：]\s*\S+|\beyJ[A-Za-z0-9_-]{12,}|<[^>]+>|[{}]/i;
    if (internal.test(value) || privateValue.test(value) || !/[\u3400-\u9fff]/.test(value)) return options.fallback || fallback;
    return value;
  }
  shared.Errors = { message: message };
})(typeof window !== 'undefined' ? window : globalThis);

/* CRA1 shared request contract. Framework adapters keep their existing return shapes. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  shared.version = '1.0.0';
  if (shared.Request && shared.Request.requiresLogin) return;
  var BASE = '/console/v1';
  var PUBLIC_PAGES = ['login.htm', 'userStatus.htm', 'goodsList.htm', 'source.htm', 'news_detail.htm', 'helpTotal.htm', 'newsView.htm', 'goods.htm', 'goods_iframe.htm', 'goods_embed.htm', 'index_iframe.htm', 'agreement.htm', 'regist.htm', 'forget.htm', 'oauth.htm', '404.htm'];
  var redirecting = false;

  function requiresLogin() {
    var html = root.document && root.document.documentElement;
    var theme = html && html.getAttribute('data-cra1-theme') || shared.theme;
    if (theme === 'website' || !root.location) return false;
    var path = root.location.pathname;
    if (!/\.htm$/.test(path)) return false;
    var page = path.split('/').pop();
    if (/^\/[^/]+\.htm$/.test(path)) return PUBLIC_PAGES.indexOf(page) === -1;
    if (/^\/cart\/[^/]+\.htm$/.test(path)) return ['goodsList.htm', 'goods.htm', 'goods_iframe.htm', 'goods_embed.htm', 'index_iframe.htm'].indexOf(page) === -1;
    // Public article/help/download views belong only to their actual plugins.
    // A similarly named module or account-plugin page still requires a login.
    var plugin = /^\/plugin\/([1-9]\d*)\/([^/]+)\.htm$/.exec(path);
    if (plugin && html) {
      try {
        var views = { idcsmartnews: ['source', 'news_detail'], idcsmartannouncement: ['source', 'news_detail'], idcsmarthelp: ['source', 'helpTotal'] };
        var plugins = JSON.parse(html.getAttribute('addons_js') || '[]');
        if (plugins.some(function (item) { return String(item.id) === plugin[1] && (views[String(item.name).toLowerCase()] || []).indexOf(plugin[2]) !== -1; })) return false;
      } catch (error) { /* Unrecognized pages remain protected. */ }
    }
    return true;
  }

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
    // Preserve a newer login, but still redirect if a parallel 401 already
    // cleared the expired token before this protected-page request completed.
    var currentToken = getToken();
    if (options.token !== undefined && options.token !== currentToken &&
        (currentToken || options.policy !== 'redirect')) return;
    try { root.localStorage.removeItem('jwt'); } catch (error) { /* Storage may be disabled. */ }
    if (root.document) root.document.dispatchEvent(new CustomEvent('api:unauthorized'));
    if (options.policy !== 'redirect' || !requiresLogin() || redirecting) return;
    redirecting = true;
    try { root.sessionStorage.setItem('redirectUrl', root.location.href); } catch (error) { /* Optional return URL. */ }
    if (typeof root.location.replace === 'function') root.location.replace('/login.htm');
    else root.location.href = '/login.htm';
  }
  function failure(message, code, status, data, options) {
    if(shared.Errors)message=shared.Errors.message({message:message,code:code,status:status}, options);
    var error = new Error(message);
    error.msg = message;
    error.code = code;
    error.status = status || 0;
    if (options && options.method) error.method = options.method;
    if (data !== undefined) error.data = data;
    return error;
  }
  async function request(path, options) {
    options = options || {};
    path = String(path || '/');
    if (/^(?:[a-z]+:)?\/\//i.test(path) || /^[a-z]+:/i.test(path)) throw failure('请求地址无效', 'INVALID_URL');
    var method = String(options.method || 'GET').toUpperCase();
    var url = BASE + (path.charAt(0) === '/' ? path : '/' + path);
    // Explicit theme projections only; never accepts an arbitrary external URL.
    if (/^\/theme\/(?:access|host\/[1-9]\d*(?:\/field\/[1-9]\d*|\/app-preset-task\/[1-9]\d*\/log)?)$/.test(path)) url = '/cra1-shared/compat.php?target=' + encodeURIComponent(path.slice(6));
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
      catch (error) {
        if (response.status === 401) envelope = {};
        else throw failure('服务响应异常，请稍后重试', 'BAD_RESPONSE', response.status);
      }
      if (response.status === 401) envelope = envelope && typeof envelope === 'object' && !Array.isArray(envelope) ? envelope : {};
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
          || (response.ok && envelope.status === undefined)) {
        throw failure('服务响应异常，请稍后重试', 'BAD_RESPONSE', response.status);
      }
      var status = envelope && envelope.status !== undefined ? Number(envelope.status) : response.status;
      if (response.status === 401 || status === 401) {
        unauthorized({ policy: options.unauthorized || (requiresLogin() ? 'redirect' : 'notify'), token: token });
        envelope.msg = '登录已失效，请重新登录';
        if (Object.prototype.hasOwnProperty.call(envelope, 'message')) envelope.message = envelope.msg;
        throw failure(envelope && envelope.msg || '登录已失效，请重新登录', 'UNAUTHORIZED', 401, envelope);
      }
      if (!response.ok || (envelope && envelope.status !== undefined && status !== 200)) {
        if (!options.securityHandled && shared.Security && shared.Security.setup(envelope)) {
          if (timer !== null) { root.clearTimeout(timer); timer = null; }
          return await shared.Security.requireSetup(envelope, { signal: external });
        }
        if (!options.securityHandled && shared.Security && shared.Security.challenge(envelope)) {
          if (timer !== null) { root.clearTimeout(timer); timer = null; }
          return await shared.Security.perform(envelope, function (proof) {
            var retried = Object.assign({}, options, { securityHandled: true });
            if (Object.keys(proof).length) retried.body = Object.assign({}, body || {}, proof);
            return request(path, retried);
          }, { signal: external, token: token });
        }
        var errorStatus = response.ok ? status : response.status;
        if (shared.Errors) {
          envelope.msg = shared.Errors.message(envelope, {status:errorStatus});
          if (Object.prototype.hasOwnProperty.call(envelope, 'message')) envelope.message = envelope.msg;
        }
        throw failure(envelope.msg || '请求失败，请稍后重试', 'API_ERROR', errorStatus, envelope);
      }
      if (shared.Security && envelope.data && envelope.data.verification_expires_at) shared.Security.remember(envelope.data.verification_expires_at);
      return envelope;
    } catch (error) {
      if (timedOut) error = failure('等待响应超时，请稍后重试', 'TIMEOUT', 0, undefined, {method:method});
      if (external && external.aborted) {
        var cancelled = failure('请求已取消', 'CANCELLED');
        cancelled.name = 'AbortError';
        error = cancelled;
      }
      if (!error || !error.code) error = failure('网络异常，请检查网络连接', 'NETWORK');
      error.method = method;
      if (options.orderCreation && method === 'POST') {
        var rejected = (error.code === 'UNAUTHORIZED' && error.status === 401) || error.code === 'SECURITY_CANCELLED' ||
          (error.code === 'API_ERROR' && [400,401,403,404,409,422,429].indexOf(Number(error.data && error.data.status)) >= 0 && Number(error.status) === Number(error.data.status));
        if (!rejected) error.uncertain = true;
      }
      throw error;
    } finally {
      if (timer !== null) root.clearTimeout(timer);
      if (external) external.removeEventListener('abort', onAbort);
    }
  }
  shared.Request = { request: request, headers: headers, getToken: getToken, query: query, unauthorized: unauthorized, requiresLogin: requiresLogin };
})(typeof window !== 'undefined' ? window : globalThis);

(function (root) {
  var html = root.document.documentElement;
  var theme = html.getAttribute('data-cra1-theme') || 'member';
  if (theme !== 'website' && /^\/cart\//.test(root.location.pathname)) theme = 'cart';
  html.setAttribute('data-cra1-theme', theme);
  root.CRA1Shared.theme = theme;
})(window);

/* Page-level login checks also cover standalone, native and plugin views. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared;
  if (shared.Session || !shared.Request.requiresLogin()) return;
  var pending = null, pendingToken = '', lastCheck = 0;
  var pageToken = null, replacing = false;
  function changed() {
    var token = shared.Request.getToken();
    if (pageToken === null) { pageToken = token; return false; }
    if (pageToken === token || replacing) return replacing;
    replacing = true;
    // Every page owns account-specific data and action handlers. Replace the
    // document together so an old view cannot submit with the new identity.
    root.document.documentElement.style.visibility = 'hidden';
    if (!token) shared.Request.unauthorized({ policy: 'redirect', token: token });
    else root.location.reload();
    return true;
  }
  function check(force) {
    if (!shared.Request.requiresLogin()) return Promise.resolve();
    if (changed()) return Promise.resolve();
    var token = shared.Request.getToken();
    if (!token) {
      shared.Request.unauthorized({ policy: 'redirect', token: token });
      return Promise.resolve();
    }
    if (pending && pendingToken === token) return pending;
    if (force && shared.Access) shared.Access.invalidate();
    lastCheck = Date.now();
    var read = shared.Access ? shared.Access.read() : shared.Request.request('/theme/access', { unauthorized: 'redirect' });
    // Only 401 means logged out. Existing page UI keeps handling other errors.
    pendingToken = token;
    var current = read.catch(function () {}).then(function () { if (pending === current) pending = null; });
    pending = current;
    return pending;
  }
  shared.Session = { check: check };
  // queryParam handoffs are adopted by the theme Axios adapter in the footer.
  // Waiting for DOM ready avoids discarding an otherwise valid handoff token.
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { check(false); }, { once: true });
  else check(false);
  root.addEventListener('storage', function (event) {
    if (event.key === 'jwt' || event.key === null) check(true);
  });
  root.addEventListener('pageshow', function (event) { if (event.persisted) check(true); });
  root.document.addEventListener('visibilitychange', function () {
    if (!root.document.hidden && (pageToken !== shared.Request.getToken() || !shared.Request.getToken() || Date.now() - lastCheck > 60000)) check(true);
  });
})(window);
