/* Generated from public/cra1-shared/src. Edit the source and rebuild. */
/* Customer-visible failures only. Keep business validation useful without exposing diagnostics. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  var fallback = '操作暂时无法完成，请稍后重试或联系客服';
  function context(error, options) {
    options = options || {};
    var config = error && error.config || {};
    var method = String(options.method || error && error.method || config.method || 'GET').toUpperCase();
    var path = String(options.path || options.url || config.url || '').split('?')[0];
    return { method: method, path: path, write: !/^(GET|HEAD|OPTIONS)$/.test(method), orderCreation: options.orderCreation };
  }
  function unavailable(error, options, uncertain) {
    var c = context(error, options), path = c.path;
    if (/\/pay(?:\/|$)|\/gateway(?:\/|$)/.test(path)) return uncertain || /\/status$/.test(path)
      ? '尚未确认付款结果，请先查看订单状态，避免重复付款'
      : '付款信息暂时无法加载，请稍后重试或联系客服';
    if (/\/renew(?:\/|$)|\/renewal(?:\/|$)/.test(path)) return c.write && uncertain
      ? '尚未确认续费是否提交成功，请先到订单列表查看，避免重复提交'
      : '续费信息暂时无法获取，请稍后重试或联系客服';
    if (c.write && (c.orderCreation || /\/(?:product|cart)\/settle(?:\/|$)/.test(path))) return uncertain
      ? '尚未确认订单是否创建成功，请先到订单列表查看，避免重复下单'
      : '订单暂时无法提交，请稍后重试或联系客服';
    if (c.write && uncertain) return '暂未收到操作结果，请先查看当前状态，避免重复提交';
    if (/\/(?:quote|price|calculate)(?:\/|$)|\/(?:configoption|config_option)\/price/.test(path)) return '暂时无法获取价格，请重新报价；确认金额后再提交';
    if (/\/(?:module|configoption|config_option)(?:\/|$)/.test(path)) return '商品配置暂时无法打开，请重新加载；仍无法打开时请联系客服';
    if (/\/ticket(?:\/|$)/.test(path)) return '工单内容暂时无法加载，请刷新重试或联系客服';
    if (options && options.fallback) return options.fallback;
    if (path) return '内容暂时无法加载，请刷新重试或联系客服';
    return '服务暂时不可用，请稍后重试或联系客服';
  }
  function message(error, options) {
    options = options || {};
    var response = error && error.response && error.response.data;
    var data = response || error && error.data;
    var value = typeof error === 'string' ? error : data && (data.msg || data.message) || error && (error.msg || error.message);
    var status = Number(options.status || data && data.status || error && error.status || 0);
    var code = error && error.code, c = context(error, options);
    if (status === 401) return '登录已失效，请重新登录';
    if (status === 429) return '操作过于频繁，请稍后重试';
    if (/\/order\/[1-9]\d*(?:\/|$)/.test(c.path) && (status === 403 || status === 404)) return '订单不存在或你无权查看，请到订单列表确认';
    if (code === 'CANCELLED' || code === 'ERR_CANCELED' || error && error.name === 'AbortError') return '请求已取消';
    if (code === 'TIMEOUT' || code === 'ECONNABORTED' || code === 'ETIMEDOUT') return c.write || /\/pay\/.*\/status$/.test(c.path)
      ? unavailable(error, options, true) : '等待响应超时，请稍后重试';
    if (code === 'NETWORK' || code === 'ERR_NETWORK') return c.write
      ? '网络连接中断，'+unavailable(error, options, true) : '网络连接暂时中断，请检查网络后重试';
    if (status >= 500) return unavailable(error, options, c.write || /\/pay\/.*\/status$/.test(c.path));
    if (typeof value !== 'string') return options.fallback || fallback;
    value = value.trim();
    // Inspect before removing control characters, so split diagnostics cannot become public text.
    if (!value || value.length > 240 || /[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(value)) return options.fallback || fallback;
    var internal = /魔方云|智简魔方|idcsmart|\b(?:re)?mf_(?:cloud|dcim|finance)\b|SQLSTATE|SQL syntax|PDOException|mysqli|数据库|数据表|\b(?:table|column)\b.{0,80}(?:exist|unknown)|stack\s*trace|traceback|fatal\s*error|parse\s*error|\b(?:TypeError|ReferenceError|SyntaxError|Exception|ThinkPHP|Guzzle|Symfony)\b|cannot (?:read|set) propert|is not (?:defined|a function)|unexpected token|failed to fetch|network\s*error|load failed|request failed with status|timeout of \d|curl(?:\s*error)?|upstream|provider|供应商|上游服务|下游服务|ECONN\w*|ENOTFOUND|EAI_AGAIN|CORS|检查兼容性|主题脚本|模块计价接口|配置接口返回异常/i;
    var privateValue = /(?:^|[\s/])(?:runtime|config|vendor|app|storage|private)\/|[\w/.-]+\.(?:php|sql|sqlite|key|pem|env)(?:\b|$)|https?:\/\/|(?:\b\d{1,3}\.){3}\d{1,3}\b|(?:\/(?:www|root|etc|usr|var|home|srv|opt|tmp|runtime|config|vendor|app|storage|private)\/)|[a-z]:\\|[\w/.-]+\.(?:php|sql|sqlite|key|pem|env|jsx?|tsx?)(?::\d+|\s+on\s+line\b|\b)|(?:authorization|bearer|(?:access[_-]?|refresh[_-]?)?token|cookie|client[_-]?secret|api[_-]?(?:key|secret)|secret[_-]?key|password|密码|令牌|密钥)\s*[:=：]\s*\S+|\beyJ[A-Za-z0-9_-]{12,}|<[^>]+>|[{}]/i;
    if (internal.test(value) || privateValue.test(value) || !/[\u3400-\u9fff]/.test(value)) return options.fallback || fallback;
    return value;
  }
  function payload(data, options) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { msg: message(data, options) };
    function clean(value) {
      if (Array.isArray(value)) return value.map(clean);
      if (!value || typeof value !== 'object') return value;
      var output = {};
      Object.keys(value).forEach(function (key) {
        var item = value[key];
        if (key === 'operate_password' && [0,1,'0','1',false,true].indexOf(item) !== -1) output[key] = item;
        else if (/^(?:trace|stack|stack_trace|exception|file|line|sql|debug|error_info|previous|provider_error|error_detail|diagnostics|raw|headers|request|config|authorization|cookie|password|passwd|secret|token|access_token|refresh_token|api_key|api_secret|api_token|secret_key|client_secret|private_key|filepath|server_path|upstream_url|provider_url|operate_password)$/i.test(key)) return;
        else if (item && typeof item === 'object') output[key] = clean(item);
        else if (/^(?:msg|message|error|reason|tip|detail|description)$/i.test(key) && typeof item === 'string') output[key] = message(item);
        else if (typeof item === 'string' && (/(?:^|[\s/])(?:runtime|config|vendor|app|storage|private)\/|[\w/.-]+\.(?:php|sql|sqlite|key|pem|env)(?:\b|$)|https?:\/\/|(?:\b\d{1,3}\.){3}\d{1,3}\b|SQLSTATE|PDOException|stack trace|(?:\/(?:www|root|etc|usr|var|home|srv|opt|tmp|runtime|config|vendor|app|storage|private)\/)|[a-z]:\\|(?:Bearer|password|token|secret)\s*[:=]/i.test(item))) return;
        else output[key] = item;
      });
      return output;
    }
    var result = clean(data);
    result.msg = message(data, options);
    if (Object.prototype.hasOwnProperty.call(result, 'message')) result.message = result.msg;
    return result;
  }
  shared.Errors = { message: message, payload: payload };
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
    if (data !== undefined) error.data = shared.Errors ? shared.Errors.payload(data, Object.assign({},options,{status:status})) : data;
    return error;
  }
  async function request(path, options) {
    options = options || {};
    path = String(path || '/');
    if (/^(?:[a-z]+:)?\/\//i.test(path) || /^[a-z]+:/i.test(path)) throw failure('请求地址无效', 'INVALID_URL');
    var method = String(options.method || 'GET').toUpperCase();
    var errorOptions = { method:method, path:path, orderCreation:options.orderCreation };
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
        else throw failure('服务响应异常，请稍后重试', 'BAD_RESPONSE', response.status >= 400 ? response.status : 503, undefined, errorOptions);
      }
      if (response.status === 401) envelope = envelope && typeof envelope === 'object' && !Array.isArray(envelope) ? envelope : {};
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
          || (response.ok && envelope.status === undefined)) {
        throw failure('服务响应异常，请稍后重试', 'BAD_RESPONSE', response.status >= 400 ? response.status : 503, undefined, errorOptions);
      }
      var status = envelope && envelope.status !== undefined ? Number(envelope.status) : response.status;
      if (response.status === 401 || status === 401) {
        unauthorized({ policy: options.unauthorized || (requiresLogin() ? 'redirect' : 'notify'), token: token });
        envelope.msg = '登录已失效，请重新登录';
        if (Object.prototype.hasOwnProperty.call(envelope, 'message')) envelope.message = envelope.msg;
        throw failure(envelope && envelope.msg || '登录已失效，请重新登录', 'UNAUTHORIZED', 401, envelope, errorOptions);
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
        if (shared.Errors) envelope = shared.Errors.payload(envelope, Object.assign({},errorOptions,{status:errorStatus}));
        throw failure(envelope.msg || '请求失败，请稍后重试', 'API_ERROR', errorStatus, envelope, errorOptions);
      }
      if (shared.Security && envelope.data && envelope.data.verification_expires_at) shared.Security.remember(envelope.data.verification_expires_at);
      return envelope;
    } catch (error) {
      if (timedOut) error = failure('等待响应超时，请稍后重试', 'TIMEOUT', 0, undefined, errorOptions);
      if (external && external.aborted) {
        var cancelled = failure('请求已取消', 'CANCELLED');
        cancelled.name = 'AbortError';
        error = cancelled;
      }
      if (!error || !error.code) error = failure('网络异常，请检查网络连接', 'NETWORK',0,undefined,errorOptions);
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

(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  var context = root.__CRA1_RUNTIME__ || {};
  var publicKeys = ['copyright_info','enterprise_address','enterprise_mailbox','enterprise_name','enterprise_telephone','feedback_type','website_name','website_url','terms_service_url','terms_privacy_url','currency_code','currency_prefix','currency_suffix','system_logo','clientarea_logo_url','clientarea_logo_url_blank','lang_home','lang_list','lang_home_open','lang_home_follow_browser','theme_header_support','recharge_open','recharge_min','recharge_max','recharge_money_notice_content','recharge_pay_notice_content','cart_instruction','cart_instruction_content','cart_change_product','first_navigation','second_navigation','prohibit_user_information_changes','login_email_password','login_phone_password','login_phone_verify','register_email','register_phone','code_client_email_register','code_client_phone_register','client_strong_password_rule','balance_notice_show','donot_save_client_product_password','captcha_client_verify','captcha_client_update','captcha_client_security_verify','captcha_client_login','captcha_client_register','captcha_client_password_reset','captcha_client_oauth','captcha_client_login_error'];
  function filterCommon(value) {
    var clean = {};
    publicKeys.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(value || {}, key)) clean[key] = value[key]; });
    if (Number(clean.recharge_open)!==1) ['recharge_min','recharge_max','recharge_money_notice_content','recharge_pay_notice_content'].forEach(function (key) { delete clean[key]; });
    if (Number(clean.cart_instruction)!==1) delete clean.cart_instruction_content;
    return clean;
  }
  shared.Navigation = {
    href: function (item) {
      var raw=String(typeof item==='string'?item:(item && item.url)||'').trim();
      if(!raw)return '';
      var type=item && (item.type||item.source_type);
      if(type!=='embedded' && /^(?:mailto:|tel:|#)/i.test(raw))return raw;
      var u;try{u=new URL(raw,root.location.origin+'/')}catch(e){return ''}
      if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return '';
      if(u.origin===root.location.origin && u.pathname==='/custom_iframe.htm'){
        var tail=raw.split(/[?&]iframe_url=/)[1]||'';
        var target=/^https?:\/\//i.test(tail)?tail:u.searchParams.get('iframe_url');
        if(target)return '/custom_iframe.htm?iframe_url='+encodeURIComponent(target);
      }
      if(type==='embedded' && !(u.origin===root.location.origin && u.pathname==='/custom_iframe.htm'))
        return '/custom_iframe.htm?iframe_url='+encodeURIComponent(u.href);
      return u.origin===root.location.origin?u.pathname+u.search+u.hash:u.href;
    }
  };
  shared.Runtime = {
    context: function () { return root.__CRA1_RUNTIME__ || context; },
    common: function () { return filterCommon(this.context().common || {}); },
    money: function (value, digits) {
      if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
      var currency = this.common();
      var precision = Number.isInteger(digits) ? Math.max(0, Math.min(4, digits)) : 2;
      return String(currency.currency_prefix ?? '¥') + Number(value).toFixed(precision) + String(currency.currency_suffix ?? '');
    },
    filterCommon: filterCommon,
    link: function (name) { return (this.context().links || {})[name] || ''; },
    error: function (error, options) { return shared.Errors.message(error, options); }
  };
  // The native cart owns /common and its cache, including third-party fields.
  // Navigation can use the theme projection without changing that contract.
  if (!root.document.documentElement.hasAttribute('data-cra1-native-cart')) {
  try {
    var old = JSON.parse(root.localStorage.getItem('common_set_before') || '{}');
    root.localStorage.setItem('common_set_before', JSON.stringify(context.common ? filterCommon(context.common) : filterCommon(old)));
  } catch (error) { /* Storage is optional. */ }
  var originalSet;
  // Native Vue components still write this cache; enforce the same field contract.
  if (root.Storage && !root.Storage.prototype.__cra1Filtered) {
    originalSet = root.Storage.prototype.setItem;
    root.Storage.prototype.setItem = function (key, value) {
      if (key === 'common_set_before') { try { value = JSON.stringify(filterCommon(JSON.parse(value))); } catch (error) { value = '{}'; } }
      return originalSet.call(this, key, value);
    };
    root.Storage.prototype.__cra1Filtered = true;
  }
  }
  if (context.features) {
    root.__CRA1_FEAT__ = Object.assign({ready: !context.error}, context.features);
    root.__cra1FeatureFlags = function () { return Promise.resolve(root.__CRA1_FEAT__); };
  }
})(window);
(function(root){
 var shared=root.CRA1Shared, pending=null, access=null, savedToken='', generation=0;
 function can(data,rule){
  if(!data)return false;if(data.all===true)return true;
  if(rule.indexOf('action:')===0)return data.actions?.[rule.slice(7)]===true;
  var name=rule.replace(/\\+/g,'\\');if(name.indexOf('\\')<0)name='app\\home\\controller\\'+name.replace('::','Controller::');
  var normalize=function(v){return String(v).replace(/\\+/g,'\\')};
  return !(data.known||[]).some(function(v){return normalize(v)===name}) || (data.rules||[]).some(function(v){return normalize(v)===name});
 }
 function forUrl(url){
  var u;try{u=new URL(url,root.location.origin)}catch(e){return false}
  if(u.origin!==root.location.origin)return true;
  if(!access)return false;
  if(u.pathname==='/custom_iframe.htm'){
    var embedded=u.searchParams.get('iframe_url'),target;
    try{target=new URL(embedded,root.location.origin)}catch(e){return false}
    if(!embedded||target.pathname==='/custom_iframe.htm'||!['http:','https:'].includes(target.protocol)||!forUrl(target.href))return false;
  }
  // Apply the native page registry first, preferring a more specific query route.
  // Additional parameters (record IDs, pagination) do not bypass a page grant.
  var matches=(access.pages||[]).filter(function(page){
    var target;try{target=new URL(page.url,root.location.origin)}catch(e){return false}
    if(target.origin!==u.origin||target.pathname!==u.pathname)return false;
    return Array.from(target.searchParams).every(function(pair){return u.searchParams.getAll(pair[0]).includes(pair[1])});
  });
  if(access.all!==true && matches.length){
    var specificity=Math.max.apply(null,matches.map(function(p){return Array.from(new URL(p.url,root.location.origin).searchParams).length}));
    if(!matches.some(function(p){return Array.from(new URL(p.url,root.location.origin).searchParams).length===specificity&&p.allowed===true}))return false;
  }
  var file=u.pathname.split('/').pop(),tab=u.searchParams.get('tab'),rule='';
  if(file==='account.htm'&&!tab)return ['Account::update','Account::updatePassword','Account::creditList'].some(function(r){return can(access,r)});
  if(file==='account.htm')rule=({profile:'Account::update',security:'Account::updatePassword',credit:'Account::creditList'})[tab]||'';
  if(file==='finance.htm')rule=({orders:'Order::list',credit:'Account::creditList',transactions:'Transaction::list'})[tab||'orders']||'';
  if(file==='security_ssh.htm'){if(!shared.Runtime.context().features?.ssh)return false;}
  if(file==='security_group.htm'||file==='group_rules.htm'){if(!shared.Runtime.context().features?.security_group)return false;}
  if(file==='security.htm'||/^security_/.test(file))rule=({api:'Api::list',log:'Log::list'})[tab||'']||'';
  if(file==='recharge.htm'){if(shared.Runtime.context().features?.recharge_open!==1)return false;rule='Pay::recharge';}
  if(file==='withdrawal.htm'&&shared.Runtime.context().features?.withdraw_open!==1)return false;
  if(file==='orderDetail.htm')rule='Order::index';
  if(file==='cashier.htm')return can(access,'Order::index')&&can(access,'Pay::pay');
  if(file==='cart.htm'||u.pathname.indexOf('/cart/')===0)rule='Cart::index';
  if(file==='addTicket.htm')rule='addon\\idcsmart_ticket\\controller\\clientarea\\TicketController::create';
  if(file==='ticket.htm'||file==='ticketDetails.htm')rule='addon\\idcsmart_ticket\\controller\\clientarea\\TicketController::ticketList';
  if(file==='security.htm'&&tab==='ssh'&&!shared.Runtime.context().features?.ssh)return false;
  if(file==='security.htm'&&tab==='group'&&!shared.Runtime.context().features?.security_group)return false;
  return !rule||can(access,rule);
 }
 function invalidate(){generation++;access=null;pending=null;delete root.__CRA1_ACCESS__}
 shared.Access={can:can,canUrl:forUrl,invalidate:invalidate,read:function(){
  var token=shared.Request.getToken();if(savedToken!==token){savedToken=token;invalidate()}
  // Guests have no account permissions to load. Do not turn a public page into
  // a failed authenticated probe, or invent an authorized guest permission set.
  if(!token)return Promise.reject(new Error('当前未登录'));
  if(access)return Promise.resolve(access);
  // The website may probe a saved login while remaining publicly accessible.
  // Member pages require a login; public cart/auth pages are exempted by Request.
  if(!pending){var ticket=generation;pending=shared.Request.request('/theme/access',{unauthorized:shared.theme==='website'?'notify':'redirect'}).then(function(r){if(savedToken!==token||ticket!==generation)throw new Error('账户状态已改变，请重新加载');access=r.data;root.__CRA1_ACCESS__=access;return access}).catch(function(e){if(ticket===generation)pending=null;throw e});}
  return pending;
 }};
 root.document.addEventListener('api:unauthorized',function(){invalidate();savedToken=''});
})(window);

/* Framework independent interactions used by Alpine, Vue and React adapters. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.UI) return;
  var doc = root.document;
  var sequence = 0;
  var icons = {
    up: '<path d="m7 14 5-5 5 5"></path>',
    down: '<path d="m7 10 5 5 5-5"></path>',
    right: '<path d="M5 12h14m-5-5 5 5-5 5"></path>',
    megaphone: '<path d="m3 10 16-6v16L3 14v-4Zm5 6 1 5h4l-2-4M3 10v4"></path>',
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
    if ((tone === 'error' || tone === 'warning') && shared.Errors) text = shared.Errors.message(text);
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

/* Share one lightweight login watcher; notification content is never persisted. */
(function(root){
 'use strict';
 var shared=root.CRA1Shared=root.CRA1Shared||{},doc=root.document,listeners=[],timer=null;
 if(shared.NotificationSession)return;
 function token(){return shared.Request&&shared.Request.getToken?shared.Request.getToken():'';}
 var current=token();
 function sync(force){var next=token();if(next===current&&!force)return;current=next;listeners.slice().forEach(function(fn){fn();});}
 function tick(){if(!doc.hidden)sync(false);}
 function storage(event){if(event.key==='jwt'||event.key===null)sync(false);}
 function unauthorized(){sync(true);}
 function watch(fn){
  if(!listeners.length){current=token();timer=root.setInterval(tick,500);root.addEventListener('storage',storage);root.addEventListener('focus',tick);doc.addEventListener('api:unauthorized',unauthorized);}
  listeners.push(fn);
  return function(){listeners=listeners.filter(function(item){return item!==fn;});if(!listeners.length){root.clearInterval(timer);timer=null;root.removeEventListener('storage',storage);root.removeEventListener('focus',tick);doc.removeEventListener('api:unauthorized',unauthorized);}};
 }
 function headers(){return Object.assign({},shared.Request?shared.Request.headers():{},{'Content-Type':'application/json'});}
 shared.NotificationSession={token:token,headers:headers,watch:watch};
})(window);

/* Framework-independent, page-scoped announcements. No configuration is cached in storage. */
(function(root){
 'use strict';
 var shared=root.CRA1Shared=root.CRA1Shared||{};
 if(shared.Notices)return;
 var doc=root.document,sequence=0;
 function node(tag,className,text){var n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
 function glyph(name){return shared.UI.icon(name);}
 function button(className,label,icon){var b=node('button',className);b.type='button';b.setAttribute('aria-label',label);if(icon)b.innerHTML=glyph(icon);return b;}
 function summaryText(item){
  if(String(item.summary||'').trim())return String(item.summary).trim();
  var template=doc.createElement('template');template.innerHTML=item.detail||'';
  template.content.querySelectorAll('script,style,noscript').forEach(function(el){el.remove();});
  template.content.querySelectorAll('br,p,div,li,h1,h2,h3,h4,h5,h6,tr,blockquote').forEach(function(el){el.append(doc.createTextNode(' '));});
  return(template.content.textContent||'').replace(/[\s\u00a0\u200b]+/g,' ').trim().slice(0,400);
 }
 function tokenId(){var token=shared.Request&&shared.Request.getToken?shared.Request.getToken():'';if(!token)return'visitor';var h=2166136261;for(var i=0;i<token.length;i++){h^=token.charCodeAt(i);h=Math.imul(h,16777619);}return'member-'+(h>>>0).toString(36);}
 function mount(host,options){
  options=options||{};if(!host)return null;if(host.__cra1Notices)return host.__cra1Notices;
  var theme=options.theme||shared.theme||doc.documentElement.getAttribute('data-cra1-theme'),path=options.path||root.location.pathname;
  var embedded=false;try{embedded=root.self!==root.top;}catch(e){embedded=true;}
  if(embedded&&!options.preview)return null;
  var destroyed=false,payload={items:[],interval:6},list=[],index=0,hover=false,focused=false,dialog=null,returnFocus=null,readerAll=false,readerList=false,readerAnimation=null,animations=[],rotation=null,refreshTimer=null,expiryTimer=null,due=0,remaining=6000,generation=0,flight=null,identity=tokenId(),memory={},receivedAt=0;
  var reduced=root.matchMedia('(prefers-reduced-motion: reduce)'),scope='cra1-notices-v1:',listeners=[];
  host.classList.add('cra1-notices-host');host.hidden=true;
  var bar=node('section','cra1-notices');bar.setAttribute('aria-label','页面通知');
  var controls=node('div','cra1-notices__index');controls.setAttribute('role','group');controls.setAttribute('aria-label','通知索引');
  var previous=button('cra1-notices__icon cra1-notices__previous','上一条通知','up'),count=button('cra1-notices__count','查看本页通知'),next=button('cra1-notices__icon cra1-notices__next','下一条通知','down');
  controls.append(previous,count,next);
  var body=node('div','cra1-notices__body'),mark=node('span','cra1-notices__mark'),copy=node('div','cra1-notices__copy'),headline=node('div','cra1-notices__headline'),label=node('span','cra1-notices__label'),title=button('cra1-notices__title','阅读完整通知'),summary=node('p','cra1-notices__summary'),action=node('a','cra1-notices__action'),actionText=node('span'),arrow=node('span');arrow.innerHTML=glyph('right');action.append(actionText,arrow);headline.append(label,title,summary);copy.append(headline);body.append(mark,copy,action);
  var dismiss=button('cra1-notices__icon cra1-notices__dismiss','关闭当前通知','close'),live=node('span','cra1-notices__sr');live.setAttribute('role','status');live.setAttribute('aria-live','polite');bar.append(body,controls,dismiss,live);host.replaceChildren(bar);
  function listen(target,event,fn,opts){target.addEventListener(event,fn,opts);listeners.push(function(){target.removeEventListener(event,fn,opts);});}
  function key(){return scope+identity;}
  function remembered(item){var map={};if(!options.preview){try{map=JSON.parse(root[item.dismiss_for==='visit'?'sessionStorage':'localStorage'].getItem(key())||'{}');}catch(e){}}var record=memory[item.id]||map[item.id];if(!record||record.revision!==item.revision)return false;return item.dismiss_for==='day'?record.day===payload.day:record.mode===item.dismiss_for;}
  function closeDialog(){if(!dialog)return;var el=dialog;dialog=null;if(readerAnimation){readerAnimation.cancel();readerAnimation=null;}try{el.close();}catch(e){}el.remove();if(returnFocus&&returnFocus.isConnected)shared.UI.focus(returnFocus);returnFocus=null;schedule(false);}
  function refreshList(){var now=performance.now();list=(payload.items||[]).filter(function(it){return(it.expires_in==null||now-receivedAt<it.expires_in*1000)&&!remembered(it);});}
  function paused(){return hover||focused||!!dialog||doc.hidden||reduced.matches||list.length<2;}
  function schedule(reset){if(rotation!==null){remaining=Math.max(0,due-performance.now());root.clearTimeout(rotation);rotation=null;}if(reset)remaining=payload.interval*1000;if(!destroyed&&!paused()){due=performance.now()+remaining;rotation=root.setTimeout(function(){rotation=null;advance(1,false);},Math.max(0,remaining));}}
  function stopAnimations(){animations.forEach(function(a){a.cancel();});animations=[];}
  function animate(direction){stopAnimations();if(reduced.matches||!body.animate)return;[mark,copy,action].forEach(function(el,i){animations.push(el.animate([{opacity:0,transform:'translateY('+(direction*(i===1?7:5))+'px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,delay:i===2?35:0,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'}));});var current=count.querySelector('strong');if(current)animations.push(current.animate([{opacity:.25},{opacity:1}],{duration:180}));}
  function render(reset){
   refreshList();index=list.length?index%list.length:0;host.hidden=!list.length;
   if(!list.length){label.textContent=title.textContent=summary.textContent=actionText.textContent=live.textContent='';title.removeAttribute('title');title.setAttribute('aria-label','阅读完整通知');mark.replaceChildren();count.replaceChildren();action.removeAttribute('href');}
   if(list.length){var item=list[index],description=summaryText(item);label.textContent=item.label||'';label.hidden=!item.label;title.textContent=item.title;title.setAttribute('aria-label','阅读完整通知：'+item.title);title.setAttribute('title',item.title);summary.textContent=description;summary.hidden=!description;headline.classList.toggle('cra1-notices__headline--summary',!!description);mark.innerHTML=item.icon_html||glyph('megaphone');
    count.innerHTML='<strong>'+String(index+1).padStart(2,'0')+'</strong> / '+String(list.length).padStart(2,'0');count.setAttribute('aria-label','第 '+(index+1)+' 条，共 '+list.length+' 条，查看本页通知');
    previous.disabled=next.disabled=list.length<2;dismiss.hidden=!item.dismissible;bar.classList.toggle('cra1-notices--dismissible',!!item.dismissible);
    actionText.textContent=item.action_label;action.hidden=item.action==='none';action.href=item.action==='link'?item.url:'#';action.target=item.new_tab?'_blank':'_self';action.rel=item.new_tab?'noopener noreferrer':'';
   }
   schedule(!!reset);
  }
  function advance(direction,manual){if(!list.length)return;index=(index+direction+list.length)%list.length;render(true);animate(direction);if(manual&&list[index])live.textContent='第 '+(index+1)+' 条。'+list[index].title;}
  function renderReader(focusKey,animateContent){
   if(!dialog||!list.length)return;var item=list[index],mobileList=readerAll&&readerList;
   dialog.classList.toggle('cra1-notice-reader--all',readerAll);dialog.setAttribute('data-view',mobileList?'list':'detail');
   var header=node('header','cra1-notice-reader__head'),headingGroup=node('div','cra1-notice-reader__heading'),tag=node('span','cra1-notice-reader__label',item.label||''),heading=node('h2',null,item.title),listHeading=node('h2','cra1-notice-reader__list-heading','本页通知');
   heading.id='cra1-notice-reader-'+sequence;listHeading.id=heading.id+'-list';dialog.setAttribute('aria-labelledby',mobileList&&root.matchMedia('(max-width:640px)').matches?listHeading.id:heading.id);
   tag.hidden=!item.label;headingGroup.append(tag,heading);header.append(headingGroup,listHeading);
   var close=button('cra1-notices__icon cra1-notice-reader__close','关闭通知详情','close');close.dataset.readerFocus='close';close.onclick=closeDialog;header.append(close);
   var main=node('div','cra1-notice-reader__main'),navigation=node('nav','cra1-notice-reader__list');navigation.setAttribute('aria-label','当前页面全部通知');navigation.hidden=!readerAll;
   list.forEach(function(entry,position){var select=button('cra1-notice-reader__entry','阅读通知：'+entry.title),meta=node('span','cra1-notice-reader__entry-label',entry.label||'通知'),name=node('span','cra1-notice-reader__entry-title',entry.title),excerpt=node('span','cra1-notice-reader__entry-summary',summaryText(entry));select.append(meta,name,excerpt);select.dataset.readerFocus='item-'+position;select.setAttribute('aria-current',position===index?'true':'false');select.onclick=function(){index=position;readerList=false;render(true);renderReader('title',true);};navigation.append(select);});
   var content=node('div','cra1-notice-reader__body');content.setAttribute('aria-label','通知正文');content.tabIndex=0;var article=node('article');article.innerHTML=item.detail||'';if(!item.detail)article.textContent=item.summary||'';content.append(article);main.append(navigation,content);
   var footer=node('footer','cra1-notice-reader__footer'),paging=node('div','cra1-notice-reader__paging'),prev=button('cra1-notices__icon','上一条通知（详情）','up'),number=node('span','cra1-notices__count',String(index+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0')),nextReader=button('cra1-notices__icon','下一条通知（详情）','down');
   function switchReader(direction,key){index=(index+direction+list.length)%list.length;readerList=false;render(true);renderReader(key,true);}
   prev.dataset.readerFocus='previous';nextReader.dataset.readerFocus='next';prev.disabled=nextReader.disabled=list.length<2;prev.onclick=function(){switchReader(-1,'previous');};nextReader.onclick=function(){switchReader(1,'next');};paging.append(prev,number,nextReader);
   var allButton=button('cra1-notice-reader__all','查看本页通知');allButton.textContent='本页通知';allButton.dataset.readerFocus='all';allButton.onclick=function(){readerAll=true;readerList=true;renderReader('item-'+index,false);};paging.append(allButton);
   if(readerAll&&!options.preview){var center=node('a','cra1-notice-reader__all cra1-notice-reader__center','查看所有通知');center.href='/notifications.html';paging.append(center);}
   var links=node('div','cra1-notice-reader__actions'),extras=(item.extra_actions||[]).slice();if(item.url)extras.unshift({label:item.action_label||'了解更多',url:item.url,new_tab:item.new_tab});extras.forEach(function(extra){var a=node('a',null,extra.label);a.href=extra.url;if(extra.new_tab){a.target='_blank';a.rel='noopener noreferrer';}links.append(a);});links.hidden=!extras.length;footer.append(paging,links);
   var status=node('span','cra1-notices__sr','第 '+(index+1)+' 条，共 '+list.length+' 条。'+item.title);status.setAttribute('role','status');heading.tabIndex=-1;heading.dataset.readerFocus='title';
   dialog.replaceChildren(header,main,footer,status);content.scrollTop=0;
   if(readerAnimation)readerAnimation.cancel();if(animateContent&&!reduced.matches&&content.animate)readerAnimation=content.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
   if(focusKey){var target=dialog.querySelector('[data-reader-focus="'+focusKey+'"]');if(target)shared.UI.focus(target);}
  }
  function openReader(all,source){
   if(!list.length)return;if(!dialog){returnFocus=source;dialog=node('dialog','cra1-notice-reader');dialog.setAttribute('aria-labelledby','cra1-notice-reader-'+(++sequence));doc.body.append(dialog);
    dialog.addEventListener('cancel',function(e){e.preventDefault();closeDialog();});dialog.addEventListener('click',function(e){if(e.target!==dialog)return;var r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();});
   }
   readerAll=!!all;readerList=!!all;renderReader(null,false);if(!dialog.open&&dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');shared.UI.focus(dialog.querySelector('[data-reader-focus="close"]'));schedule(false);
  }
  function setData(data){if(destroyed)return;var current=list[index]&&(list[index].id+':'+list[index].revision),oldInterval=payload.interval;var oldSignature=(payload.items||[]).map(function(it){return it.id+':'+it.revision;}).join('|');payload=Object.assign({items:[],interval:6,refresh_after:30,day:''},data);payload.interval=Math.max(3,Math.min(300,Number(payload.interval)||6));receivedAt=performance.now();refreshList();var found=list.findIndex(function(item){return item.id+':'+item.revision===current;});index=found>=0?found:0;if(dialog&&oldSignature!==(payload.items||[]).map(function(it){return it.id+':'+it.revision;}).join('|'))closeDialog();render(found<0||oldInterval!==payload.interval);
   queueExpiry();
  }
  function queueExpiry(){root.clearTimeout(expiryTimer);var elapsed=performance.now()-receivedAt,expires=(payload.items||[]).filter(function(it){return it.expires_in!=null&&it.expires_in*1000>elapsed;}).map(function(it){return it.expires_in*1000-elapsed;});if(expires.length)expiryTimer=root.setTimeout(function(){render(false);if(dialog)closeDialog();queueExpiry();},Math.min(2147483647,Math.max(1,Math.ceil(Math.min.apply(null,expires))+1)));}

  function queueRefresh(delay){root.clearTimeout(refreshTimer);if(!destroyed&&!options.preview&&!doc.hidden)refreshTimer=root.setTimeout(refresh,delay||Math.max(1,Math.min(30,Number(payload.refresh_after)||30))*1000);}
  function clearSession(){if(options.preview)return;generation++;if(flight)flight.abort();flight=null;root.clearTimeout(refreshTimer);identity=tokenId();memory={};if(dialog)closeDialog();setData({items:[]});}
  function refresh(){
   if(destroyed||options.preview)return Promise.resolve();if(doc.hidden){root.clearTimeout(refreshTimer);return Promise.resolve();}if(identity!==tokenId())clearSession();if(flight)flight.abort();var session=shared.NotificationSession,token=session?session.token():'',ticket=++generation,controller=new AbortController();flight=controller;var deadline=root.setTimeout(function(){if(ticket===generation){controller.abort();setData({items:[]});}},8000);return root.fetch('/cra1-shared/announcements.php',{method:'POST',credentials:'same-origin',cache:'no-store',headers:session?session.headers():{'Content-Type':'application/json'},body:JSON.stringify({theme:theme,path:path}),signal:controller.signal}).then(function(r){if(!r.ok)throw new Error('unavailable');return r.json();}).then(function(r){if(destroyed||ticket!==generation)return;if(session&&token!==session.token()){clearSession();refresh();return;}if(r.status!==200)throw new Error('announcement unavailable');setData(r.data);}).catch(function(e){if(destroyed||ticket!==generation||e.name==='AbortError')return;setData({items:[]});}).finally(function(){root.clearTimeout(deadline);if(ticket===generation){flight=null;queueRefresh();}});
  }
  listen(previous,'click',function(){advance(-1,true);});listen(next,'click',function(){advance(1,true);});listen(count,'click',function(){openReader(true,count);});listen(title,'click',function(){openReader(false,title);});listen(action,'click',function(e){if(list[index]&&list[index].action==='detail'){e.preventDefault();openReader(false,action);}});
  listen(dismiss,'click',function(){var item=list[index];if(!item||!item.dismissible)return;var record={revision:item.revision,day:payload.day,mode:item.dismiss_for};memory[item.id]=record;if(!options.preview){try{var storage=root[item.dismiss_for==='visit'?'sessionStorage':'localStorage'],map=JSON.parse(storage.getItem(key())||'{}');map[item.id]=record;var ids=Object.keys(map);if(ids.length>200)ids.slice(0,ids.length-200).forEach(function(id){delete map[id];});storage.setItem(key(),JSON.stringify(map));}catch(e){}}render(true);animate(1);live.textContent='已关闭当前通知';if(!host.hidden)shared.UI.focus(title);});
  listen(bar,'pointerenter',function(e){hover=e.pointerType==='mouse';schedule(false);});listen(bar,'pointerleave',function(){hover=false;schedule(false);});
  listen(bar,'focusin',function(){focused=true;schedule(false);});listen(bar,'focusout',function(e){focused=bar.contains(e.relatedTarget);schedule(false);});
  listen(doc,'visibilitychange',function(){if(doc.hidden){clearSession();schedule(false);}else refresh();});
  listen(root,'pagehide',function(){clearSession();root.clearTimeout(rotation);rotation=null;});listen(root,'pageshow',function(e){if(e.persisted){clearSession();refresh();}});listen(reduced,'change',function(){stopAnimations();schedule(false);});
  listen(root,'storage',function(e){if(e.key===key())render(false);});
  if(!options.preview&&shared.NotificationSession)listeners.push(shared.NotificationSession.watch(function(){clearSession();refresh();}));
  var api={refresh:refresh,setData:setData,destroy:function(){destroyed=true;generation++;if(flight)flight.abort();[rotation,refreshTimer,expiryTimer].forEach(function(timer){root.clearTimeout(timer);});listeners.forEach(function(fn){fn();});stopAnimations();if(dialog)closeDialog();host.replaceChildren();host.hidden=true;delete host.__cra1Notices;}};host.__cra1Notices=api;
  if(options.payload)setData(options.payload);else refresh();return api;
 }
 function start(){doc.querySelectorAll('[data-cra1-notices]').forEach(function(host){mount(host,{theme:host.getAttribute('data-notice-theme')||shared.theme});});}
 shared.Notices={mount:mount,start:start};
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else root.setTimeout(start,0);
})(window);

/** One theme-owned avatar renderer for all three headers and the member profile.
 * Existing accounts keep their generated avatar until they save a selection.
 * No third-party avatar service, polling or startup avatar config request.
 */
;(function (root, factory) {
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  var api = shared.Avatar || factory(root);
  shared.Avatar = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CRA1Avatar = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  /* 12 组精选色板：同色系深浅过渡，整体中深色调（保证白色首字母对比度） */
  var PALETTES = [
    ['#1D5FD0', '#4FA8FF'], ['#0F56BE', '#1FA2DC'], ['#4F46E5', '#8B7CFF'],
    ['#7C3AED', '#A78BFA'], ['#0E9F6E', '#34C77B'], ['#0D9488', '#2DD4BF'],
    ['#0369A1', '#38BDF8'], ['#C2410C', '#F59E0B'], ['#BE185D', '#EC4899'],
    ['#B91C1C', '#F97316'], ['#1E3A8A', '#2563EB'], ['#047857', '#65A30D']
  ];

  /* 种子 → data URI。放模块级是刻意的：避免在响应式 getter 中写状态 */
  var cache = {}, accounts = {};
  var presets = [
    { id:'titanium', label:'钛灰银', colors:['#555e6b','#c0c6ce'] },
    { id:'graphite', label:'石墨暖灰', colors:['#605b55','#b6ada3'] },
    { id:'champagne', label:'香槟金', colors:['#88734f','#d8c6a2'] },
    { id:'sage', label:'鼠尾草绿', colors:['#547169','#b0c7bd'] },
    { id:'ocean', label:'雾海蓝', colors:['#516a7b','#a8c0cf'] },
    { id:'lavender', label:'烟紫灰', colors:['#70647e','#c4b7d0'] }
  ];
  function idOf(user) { return user && String(user.id != null ? user.id : user.accountId || ''); }
  function selection(user) {
    if (!user) return {mode:'default'};
    var saved=accounts[idOf(user)], own=user.theme_avatar;
    if(user.avatar_preview)return own||{mode:'default'};
    if(saved && (!own || Number(saved.revision)>Number(own.revision||0)))return saved;
    return own||saved||{mode:'default'};
  }
  function register(user) {
    var id=idOf(user), value=user&&user.theme_avatar;
    if(id&&value&&(!accounts[id]||Number(value.revision||0)>=Number(accounts[id].revision||0))) accounts[id]=Object.assign({},value);
  }
  function commit(user, broadcast) {
    register(user);var id=idOf(user);if(!id||!root.dispatchEvent)return;
    root.dispatchEvent(new root.CustomEvent('cra1:avatar-updated',{detail:{id:id,theme_avatar:selection(user)}}));
    if(broadcast===false)return;
    try{root.localStorage.setItem('cra1-avatar-updated',JSON.stringify({id:id,revision:selection(user).revision,time:Date.now()}));}catch(e){}
  }
  if(root.addEventListener)root.addEventListener('storage',function(e){
    if(e.key!=='cra1-avatar-updated'||!e.newValue)return;
    try{var data=JSON.parse(e.newValue);if(/^\d+$/.test(String(data.id)))root.dispatchEvent(new root.CustomEvent('cra1:avatar-refresh',{detail:{id:String(data.id),revision:data.revision}}));}catch(error){}
  });
  function presetUri(id) {
    var p=presets.find(function(x){return x.id===id;});if(!p)return '';
    var key='preset:'+id;if(cache[key])return cache[key];
    var art='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="'+p.colors[0]+'"/><stop offset="1" stop-color="'+p.colors[1]+'"/></linearGradient><radialGradient id="h" cx=".2" cy=".15" r=".9"><stop stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="128" height="128" fill="url(#g)"/><rect width="128" height="128" fill="url(#h)"/><circle cx="64" cy="50" r="21" fill="#fff" fill-opacity=".9"/><path d="M25 117c0-28 15-45 39-45s39 17 39 45" fill="#fff" fill-opacity=".82"/><circle cx="104" cy="22" r="35" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="12"/><path d="M0 23C32-9 70-3 86 0" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/></svg>';
    return cache[key]="url('data:image/svg+xml,"+encodeURIComponent(art)+"')";
  }

  function seedOf(user) {
    if (!user) return '';
    var id = user.id != null ? user.id : (user.accountId != null ? user.accountId : '');
    var name = user.username || user.name || user.email || user.phone || '';
    return String(id) + '|' + name;
  }

  function uri(user) {
    var selected=selection(user);
    if(selected.mode==='preset'&&presetUri(selected.preset))return presetUri(selected.preset);
    if(selected.mode==='upload'&&/^\/upload\/cra1-theme\/avatars\/[a-f0-9]{32}\.webp$/.test(selected.url||''))return "url('"+selected.url+"')";
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
    var chosen=selection(user);
    if(chosen.mode==='preset'&&presetUri(chosen.preset)||chosen.mode==='upload'&&/^\/upload\/cra1-theme\/avatars\/[a-f0-9]{32}\.webp$/.test(chosen.url||''))return '';
    var name = user ? (user.username || user.name || user.email || user.phone || '') : '';
    return String(name || '?').slice(0, 1).toUpperCase();
  }

  return { uri: uri, style: style, letter: letter, presets: presets, register: register, commit: commit };
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
  function titleRank(title, keywords) {
    var text = String(title || '').toLocaleLowerCase(), term = String(keywords || '').trim().toLocaleLowerCase();
    if (!term) return 0;
    if (text === term) return 1000;
    if (text.indexOf(term) === 0) return 800;
    var position = text.indexOf(term);
    if (position >= 0) return 600 - Math.min(position, 100);
    var words = term.split(/\s+/).filter(Boolean);
    return words.length > 1 && words.every(function (word) { return text.includes(word); }) ? 300 : 0;
  }
  function titleParts(title, keywords) {
    var text = String(title || ''), lower = text.toLocaleLowerCase();
    var words = String(keywords || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    var parts = [], offset = 0;
    while (offset < text.length && words.length) {
      var start = -1, length = 0;
      words.forEach(function (word) {
        var index = lower.indexOf(word, offset);
        if (index >= 0 && (start < 0 || index < start || (index === start && word.length > length))) { start = index; length = word.length; }
      });
      if (start < 0) break;
      if (start > offset) parts.push({ text: text.slice(offset, start), match: false });
      parts.push({ text: text.slice(start, start + length), match: true }); offset = start + length;
    }
    if (offset < text.length || !parts.length) parts.push({ text: text.slice(offset), match: false });
    return parts;
  }
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
      rows = rows.map(function (row, order) { return { row: row, order: order, rank: titleRank(row.title || row.product_name || row.name, keywords) }; })
        .sort(function (a, b) { return b.rank - a.rank || a.order - b.order; }).map(function (entry) { return entry.row; });
      var seen = new Set();
      rows = rows.filter(function (row) { var id = Number(row.id); if (seen.has(id)) return false; seen.add(id); return true; });
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
    var resultsNode = null, listNode = null, destroyed = false, composing = false, unwatchSession = null;
    var state = { groups: [], errors: [], loading: false, activeIndex: -1 }, generation = 0, timer = null, abort = null;
    panel.id = prefix + '-panel'; input.id = prefix;
    input.placeholder = copy.placeholder;
    function items() { return state.groups.reduce(function (all, group) { return all.concat(group.items); }, []); }
    function invalidate() { generation += 1; root.clearTimeout(timer); timer = null; if (abort) { abort.abort(); abort = null; } }
    function sessionToken() { return shared.Request && shared.Request.getToken ? shared.Request.getToken() : ''; }
    function clearSession() {
      if (destroyed) return;
      composing = false; invalidate(); input.value = '';
      state.groups = []; state.errors = []; state.activeIndex = -1; state.loading = false;
      popover.close(host.contains(doc.activeElement)); render();
    }
    function onVisibility() { if (doc.hidden) clearSession(); }
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
          var title = doc.createElement('span'); title.className = 'cra1-header-search__item-title';
          titleParts(item.title, input.value).forEach(function (part) {
            var node = doc.createElement(part.match ? 'mark' : 'span'); node.textContent = part.text; title.appendChild(node);
          }); link.appendChild(title);
          if (item.description) { var description = doc.createElement('span'); description.className = 'cra1-header-search__item-description'; description.textContent = item.description; link.appendChild(description); }
          link.addEventListener('mouseenter', function () { state.activeIndex = item.index; setActive(); });
          link.addEventListener('click', function (event) { navigate(item, event); }); section.appendChild(link);
        });
        listNode.appendChild(section);
      });
      if (state.errors.length) {
        var error = doc.createElement('div'); error.className = 'cra1-header-search__error'; error.setAttribute('role', 'status');
        var message = doc.createElement('span'); message.textContent = '页面错误，请刷新重试';
        error.append(message); resultsNode.appendChild(error);
      }
      setActive();
    }
    async function perform() {
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1;
      var keywords = input.value.trim();
      if (!popover.isOpen || !keywords || composing || destroyed) { state.loading = false; render(); return; }
      state.loading = true; render();
      var current = generation, token = sessionToken(), controller = abort = new AbortController();
      try {
        var configuration = options.getSearchOptions ? options.getSearchOptions() : options;
        var result = await search(Object.assign({}, configuration, { keywords: keywords, signal: controller.signal }));
        if (current !== generation || destroyed || !popover.isOpen) return;
        if (token !== sessionToken()) { clearSession(); return; }
        state.groups = result.groups; state.errors = result.errors;
      } catch (error) {
        if (current !== generation || destroyed || !popover.isOpen) return;
        if (token !== sessionToken()) { clearSession(); return; }
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
    // Search can include member products. Purge them on identity changes and
    // before a hidden/BFCache page retains the old account's DOM.
    if (shared.NotificationSession) unwatchSession = shared.NotificationSession.watch(clearSession);
    else doc.addEventListener('api:unauthorized', clearSession);
    doc.addEventListener('visibilitychange', onVisibility); root.addEventListener('pagehide', clearSession);
    var component = {
      open: function () { popover.show(); }, close: function (restore) { popover.close(restore); }, refresh: schedule,
      get isOpen() { return popover.isOpen; },
      destroy: function () {
        if (destroyed) return;
        popover.destroy(); destroyed = true; invalidate();
        input.removeEventListener('input', onInput); input.removeEventListener('compositionstart', onCompositionStart); input.removeEventListener('compositionend', onCompositionEnd); input.removeEventListener('keydown', onKey);
        form.removeEventListener('submit', onSubmit); clearButton.removeEventListener('mousedown', preventFocus); clearButton.removeEventListener('click', onClear); closeButton.removeEventListener('click', onClose); host.removeEventListener('click', stopClick);
        media.removeEventListener('change', onBreakpoint); host.replaceChildren(); delete host.__cra1HeaderSearch;
        if (unwatchSession) unwatchSession(); else doc.removeEventListener('api:unauthorized', clearSession);
        doc.removeEventListener('visibilitychange', onVisibility); root.removeEventListener('pagehide', clearSession);
      },
    };
    host.__cra1HeaderSearch = component;
    return component;
  }
  shared.HeaderSearch = { search: search, mount: mount, pluginSources: pluginSources, titleRank: titleRank, titleParts: titleParts };
  root.CRA1HeaderSearch = shared.HeaderSearch;
})(typeof window !== 'undefined' ? window : globalThis);

/* Framework-neutral header primitives. Alpine and Vue only supply data/actions. */
(function (root) {
  'use strict';
  var shared=root.CRA1Shared=root.CRA1Shared||{}, sequence=0;
  if (shared.HeaderActions) return;
  var paths={
    support:'<path d="M4 13v-3a8 8 0 0 1 16 0v3"/><rect x="2.5" y="10" width="4" height="8" rx="2"/><rect x="17.5" y="10" width="4" height="8" rx="2"/><path d="M19.5 18v1a2 2 0 0 1-2 2H14"/><rect x="10" y="19.5" width="4" height="3" rx="1.5"/>',
    cart:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L20 7H6"/>',
    message:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    language:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a16 16 0 0 1 0 18 16 16 0 0 1 0-18Z"/>',
    edit:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    security:'<path d="M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z"/>',
    finance:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>',
    book:'<path d="M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',
    back:'<path d="m15 6-6 6 6 6"/>',
    arrow:'<path d="m9 6 6 6-6 6"/>',
    link:'<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.link)+'</svg>'; }
  function el(tag,cls,text) { var n=root.document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=String(text); return n; }
  function glyph(name,cls) { var n=el('span',cls||'cra1-header-glyph'); n.innerHTML=icon(name); n.setAttribute('aria-hidden','true'); return n; }
  function link(parent,text,url,cls,options) {
    var a=el('a',cls,text); a.href=url;
    if(options&&options.onNavigate)a.addEventListener('click',function(e){if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.button===0){e.preventDefault();options.onNavigate(url);}});
    parent.appendChild(a); return a;
  }
  function label(options,key,fallback) { return options.labels&&options.labels[key]!==undefined?options.labels[key]:fallback; }
  function mountAccount(host,options) {
    options=options||{}; host.classList.add('cra1-account','cra1-account--header');
    var trigger=el('button','cra1-account__trigger'); trigger.type='button'; trigger.setAttribute('aria-label','账户菜单'); trigger.setAttribute('aria-haspopup','true');
    var avatar=el('span','cra1-account__avatar'); trigger.appendChild(avatar);
    var panel=el('div','cra1-account__menu cra1-account__menu--rich cra1-shared-panel'); panel.hidden=true; panel.setAttribute('role','region'); panel.setAttribute('aria-label','账户信息与常用功能');
    var first=el('div','cra1-upanel__section'),row=el('div','cra1-upanel__row'),large=el('span','cra1-account__avatar cra1-upanel__avatar'),identity=el('div','cra1-upanel__id'),name=el('span','cra1-upanel__name'),username=el('span','cra1-upanel__username');
    name.appendChild(username); var edit=link(name,'','/account.htm','cra1-upanel__mini-btn',options); edit.setAttribute('aria-label','进入账户信息'); edit.appendChild(glyph('edit'));
    var id=el('span','cra1-upanel__sub'); identity.append(name,id); row.append(large,identity); first.appendChild(row);
    var tags=el('div','cra1-upanel__tags'),consoleLink=link(tags,'','/home.htm','cra1-upanel__tag cra1-upanel__tag--console',options),fog=el('span','cra1-upanel__tag-fog'); fog.setAttribute('aria-hidden','true'); consoleLink.append(fog,el('span','cra1-upanel__tag-txt','控制台'));
    link(tags,label(options,'basic','基本资料'),'/account.htm','cra1-upanel__tag',options);
    link(tags,label(options,'accountSecurity','安全设置'),'/account.htm?tab=security','cra1-upanel__tag',options); first.appendChild(tags);
    var logout=el('button','cra1-upanel__logout'); logout.type='button';logout.append(glyph('logout'),root.document.createTextNode('退出登录')); var loggingOut=false;
    logout.addEventListener('click',async function(){if(loggingOut)return;loggingOut=true;logout.disabled=true;try{if(options.onLogout)await options.onLogout();}finally{loggingOut=false;logout.disabled=false;}});first.appendChild(logout);
    var security=el('div','cra1-upanel__section'),head=link(security,'','/security.htm','cra1-upanel__head',options);head.append(glyph('security'),el('span','',label(options,'security','安全中心')),glyph('arrow','cra1-upanel__chev'));
    var links=el('div','cra1-upanel__links'),securityState;security.appendChild(links);
    var finance=el('div','cra1-upanel__section'),fhead=link(finance,'','/finance.htm','cra1-upanel__head',options);fhead.append(glyph('finance'),el('span','',label(options,'finance','财务信息')),glyph('arrow','cra1-upanel__chev'));
    var balanceRow=el('div','cra1-upanel__kv'),balance=el('span','cra1-upanel__kv-value'),amount=el('span','cra1-upanel__balance');balance.appendChild(amount);link(balance,'余额记录','/finance.htm?tab=credit','cra1-upanel__link',options);balanceRow.append(el('span','cra1-upanel__kv-label','可用余额'),balance);
    var orderRow=el('div','cra1-upanel__kv'),order=el('span','cra1-upanel__kv-value');link(order,'查看订单','/finance.htm?tab=orders','cra1-upanel__link',options);orderRow.append(el('span','cra1-upanel__kv-label','我的订单'),order);finance.append(balanceRow,orderRow);
    var desktop=el('div','cra1-account__desktop');desktop.append(first,security,finance);panel.appendChild(desktop);
    var mobile=options.getMobileActions?mountMobileAccount(panel,trigger,options):null;
    if(mobile)host.classList.add('cra1-account--mobile-actions');
    host.replaceChildren(trigger,panel);
    var popover=shared.UI.createPopover({root:host,trigger:trigger,panel:panel,hover:true,beforeOpen:options.beforeOpen,onOpenChange:function(open){if(!open&&mobile)mobile.reset();if(options.onOpenChange)options.onOpenChange(open);}});
    function update() {
      var ssh=!!shared.Runtime.context().features?.ssh;
      if(securityState!==ssh){
        securityState=ssh;links.replaceChildren();
        [['安全概览','overview'],['API 密钥','api'],['SSH 密钥','ssh']].filter(function(x){return x[1]!=='ssh'||ssh;}).forEach(function(x){link(links,x[0],'/security.htm?tab='+x[1],'cra1-upanel__link',options);});
      }
      var u=options.getUser?options.getUser():options.user||{};
      if(u)shared.Avatar.register(u);
      if(mobile)mobile.update(u);
      if(!u){large.style.backgroundImage='';large.textContent='';username.textContent='';username.removeAttribute('title');id.textContent='';amount.textContent='';return;}
      var style=shared.Avatar.style(u),text=shared.Avatar.letter(u);
      [avatar,large].forEach(function(n){n.style.backgroundImage=style.backgroundImage||'';n.style.backgroundSize='cover';n.style.backgroundPosition='center';n.textContent=text;});
      username.textContent=u.username||u.name||u.email||u.phone||'会员';username.title=username.textContent;
      id.textContent='账号 ID：'+(u.id||u.accountId||'—');amount.textContent=shared.Runtime.money(u.credit||0);
    }
    function avatarChanged(e){var u=options.getUser?options.getUser():options.user;if(u&&String(u.id||u.accountId)===String(e.detail.id))update();}
    root.addEventListener('cra1:avatar-updated',avatarChanged);root.addEventListener('cra1:feature-flags',update);update();
    return {update:update,setOpen:popover.setOpen,close:popover.close,toggle:popover.toggle,openWithFocus:popover.openWithFocus,destroy:function(){popover.destroy();root.removeEventListener('cra1:avatar-updated',avatarChanged);root.removeEventListener('cra1:feature-flags',update);host.classList.remove('cra1-account--mobile-actions');host.replaceChildren();}};
  }
  function safeUrl(url,image) { return typeof url==='string'&&!/[\x00-\x20\\]/.test(url)&& (image?/^(?:https?:\/\/|\/(?!\/))/i:/^(?:https?:\/\/|\/(?!\/)|#|tel:|mailto:)/i).test(url); }
  function hasSupport(config) { return !!(config&&config.enabled&&Array.isArray(config.groups)&&config.groups.length); }
  function renderSupport(panel,config) {
    panel.replaceChildren();
    if(!hasSupport(config))return;
    var status=el('p','cra1-header-support__status');status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    config.groups.forEach(function(group){
      var section=el('div','cra1-header-support__section');if(group.title)section.appendChild(el('p','cra1-header-support__title',group.title));
      (group.items||[]).forEach(function(item){
        var action=item.action==='link'&&safeUrl(item.href,false)?'link':item.action==='copy'?'copy':'text';
        var n=el(action==='link'?'a':action==='copy'?'button':'div','cra1-header-support__item'+(action==='text'?' cra1-header-support__item--text':''));n.setAttribute('aria-label',(action==='copy'?'复制':'')+(item.label||'联系信息'));
        if(action==='link'){n.href=item.href;if(item.external&&item.newWindow){n.target='_blank';n.rel='noopener noreferrer';}}
        if(item.showIcon){
          var art=el('span','cra1-header-support__icon');art.setAttribute('aria-hidden','true');
          if(item.icon_svg){art.innerHTML=item.icon_svg;}else if(item.icon_img&&safeUrl(item.icon_img,true)){var img=el('img');img.src=item.icon_img;img.alt='';img.loading='lazy';art.appendChild(img);}else art.innerHTML=icon('link');
          var vars=shared.IconStyle?shared.IconStyle.vars(item.icon_style,false):{};Object.keys(vars).forEach(function(k){art.style.setProperty(k,vars[k]);});n.appendChild(art);
        }
        if(item.showText)n.appendChild(el('span','',item.label||''));
        if(action==='copy'){n.type='button';n.addEventListener('click',async function(){var ok=await shared.UI.copy(item.copy||'');status.hidden=false;status.textContent=ok?'账号已复制':'复制失败，请手动复制：'+(item.copy||'');});}section.appendChild(n);
      });panel.appendChild(section);
    });panel.appendChild(status);
  }
  // Only the member/cart adapter opts into this view. Website account menus keep
  // their existing layout, while both views use the same identity and support data.
  function mountMobileAccount(panel,trigger,options) {
    var mobile=el('div','cra1-account-mobile'),main=el('div','cra1-account-mobile__main'),detail=el('div','cra1-account-mobile__detail');detail.hidden=true;
    var identity=el('div','cra1-account-mobile__identity'),avatar=el('span','cra1-account__avatar'),copy=el('div','cra1-account-mobile__identity-copy'),name=el('span','cra1-account-mobile__name'),sub=el('span','cra1-account-mobile__sub');copy.append(name,sub);identity.append(avatar,copy);main.appendChild(identity);
    var shortcuts=el('div','cra1-account-mobile__group'),account=el('div','cra1-account-mobile__group');main.append(shortcuts,account);
    function item(parent,text,art,url) {
      var n=url?link(parent,'',url,'cra1-account-mobile__item'):el('button','cra1-account-mobile__item');
      if(!url){n.type='button';parent.appendChild(n);}
      if(url&&options.onNavigate)n.addEventListener('click',function(e){if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.button===0){e.preventDefault();options.onNavigate(n.getAttribute('href'));}});
      n.append(glyph(art),el('span','cra1-account-mobile__label',text));return n;
    }
    var messages=item(shortcuts,'站内信','message','#'),messageCount=el('span','cra1-account-mobile__count cra1-account-mobile__count--unread'),cart=item(shortcuts,'购物车','cart','#'),cartCount=el('span','cra1-account-mobile__count'),support=item(shortcuts,'客户服务','support');messages.appendChild(messageCount);cart.appendChild(cartCount);
    var profile=item(account,'账户资料','user','/account.htm'),security=item(account,'安全设置','security','/security.htm'),finance=item(account,'财务中心','finance','/finance.htm');
    item(account,'文档中心','book','/document.html');var language=item(account,'切换语言','language'),login=item(account,'登录 / 注册','user','/login.htm'),logout=item(account,'退出登录','logout');
    var loggingOut=false;logout.addEventListener('click',async function(){if(loggingOut)return;loggingOut=true;logout.disabled=true;try{if(options.onLogout)await options.onLogout();}finally{loggingOut=false;logout.disabled=false;}});
    var back=el('button','cra1-account-mobile__back');back.type='button';back.append(glyph('back'),el('span','','返回账户菜单'));var heading=el('p','cra1-account-mobile__heading'),content=el('div','cra1-account-mobile__content');detail.append(back,heading,content);mobile.append(main,detail);panel.appendChild(mobile);
    var dot=el('span','cra1-account__unread');dot.hidden=true;dot.setAttribute('aria-hidden','true');trigger.appendChild(dot);
    var view='',state={},supportKey='',languageKey='',source=null;
    function reset(restore){view='';main.hidden=false;detail.hidden=true;content.replaceChildren();if(restore)shared.UI.focus(source&&!source.hidden?source:trigger);}
    function renderDetail(){
      if(view==='support'){heading.textContent='客户服务';renderSupport(content,state.support);}
      if(view==='language'){
        heading.textContent='切换语言';content.replaceChildren();
        (state.languages||[]).forEach(function(lang){var n=item(content,lang.display_name||lang.display_lang,'language');n.dataset.cra1Language=lang.display_lang;n.setAttribute('aria-pressed',String(lang.display_lang===state.language));n.addEventListener('click',function(){if(options.onLanguage)options.onLanguage(lang.display_lang);});});
      }
    }
    function openDetail(next,from){source=from;view=next;main.hidden=true;detail.hidden=false;renderDetail();shared.UI.focus(back);}
    support.setAttribute('aria-expanded','false');language.setAttribute('aria-expanded','false');
    function expanded(){support.setAttribute('aria-expanded',String(view==='support'));language.setAttribute('aria-expanded',String(view==='language'));}
    support.addEventListener('click',function(){openDetail('support',support);expanded();});language.addEventListener('click',function(){openDetail('language',language);expanded();});back.addEventListener('click',function(){reset(true);expanded();});
    function count(n,value){var total=Math.max(0,Number(value)||0);n.hidden=!total;n.textContent=total>999?'999+':String(total);}
    function shortcut(n,badge,value){var enabled=!!(value&&safeUrl(value.href,false));n.hidden=!enabled;if(enabled)n.href=value.href;else n.removeAttribute('href');count(badge,enabled?value.count:0);}
    function update(user){
      state=options.getMobileActions()||{};
      var guest=!user;
      name.textContent=guest?'尚未登录':user.username||user.name||user.email||user.phone||'会员';name.title=name.textContent;
      sub.textContent=guest?'登录后管理账户':'账号 ID：'+(user.id||user.accountId||'—');
      var style=guest?{}:shared.Avatar.style(user),letter=guest?'':shared.Avatar.letter(user);
      avatar.style.backgroundImage=style.backgroundImage||'';avatar.style.backgroundSize='cover';avatar.style.backgroundPosition='center';avatar.textContent=letter;if(guest)avatar.innerHTML=icon('user');
      if(guest){var triggerAvatar=trigger.querySelector('.cra1-account__avatar');triggerAvatar.style.backgroundImage='';triggerAvatar.innerHTML=icon('user');}
      [profile,security,finance,logout].forEach(function(n){n.hidden=guest;});login.hidden=!guest;
      shortcut(messages,messageCount,guest?null:state.message);shortcut(cart,cartCount,state.cart);
      dot.hidden=messages.hidden||!(Number(state.message&&state.message.count)>0);
      trigger.setAttribute('aria-label',dot.hidden?'账户菜单':'账户菜单，有'+String(state.message.count)+'条未读站内信');
      support.hidden=!hasSupport(state.support);language.hidden=!Array.isArray(state.languages)||!state.languages.length;shortcuts.hidden=messages.hidden&&cart.hidden&&support.hidden;
      var sk=JSON.stringify(state.support||{}),lk=JSON.stringify(state.languages||[]);
      if((view==='support'&&support.hidden)||(view==='language'&&language.hidden)){reset(true);content.replaceChildren();expanded();}
      if((view==='support'&&sk!==supportKey)||(view==='language'&&lk!==languageKey))renderDetail();
      if(view==='language')content.querySelectorAll('[data-cra1-language]').forEach(function(n){n.setAttribute('aria-pressed',String(n.dataset.cra1Language===state.language));});
      supportKey=sk;languageKey=lk;
    }
    return {update:update,reset:function(){reset(false);expanded();}};
  }
  function mountSupport(host,options) {
    options=options||{};host.classList.add('cra1-header-support');
    var trigger=el('button','cra1-header-support__trigger');trigger.type='button';trigger.setAttribute('aria-label','客服');trigger.setAttribute('aria-haspopup','true');trigger.innerHTML=icon('support');
    var panel=el('div','cra1-header-support__panel cra1-shared-panel');panel.hidden=true;panel.id='cra1-support-'+(++sequence);panel.setAttribute('role','region');panel.setAttribute('aria-label','客服与联系');
    host.replaceChildren(trigger,panel);var popover=shared.UI.createPopover({root:host,trigger:trigger,panel:panel,hover:true,beforeOpen:options.beforeOpen});
    function update(config) {
      config=config||(options.getConfig?options.getConfig():options.config)||{};
      host.hidden=!hasSupport(config);if(host.hidden)popover.close();renderSupport(panel,config);
    }
    update();return {update:update,close:popover.close,toggle:popover.toggle,destroy:function(){popover.destroy();host.replaceChildren();}};
  }
  shared.HeaderActions={icon:icon,mountAccount:mountAccount,mountSupport:mountSupport};
})(typeof window!=='undefined'?window:globalThis);

(function(root){
const ICON_PRESETS = {
  titanium: { label: '钛灰银', foreground: '#555d67', from: '#edf0f3', to: '#c9ced4' },
  graphite: { label: '石墨暖灰', foreground: '#625c55', from: '#eeeae5', to: '#d1c9bf' },
  champagne: { label: '香槟金', foreground: '#896d46', from: '#f5efe4', to: '#dacfbb' },
  compute: { label: '计算蓝', foreground: '#3562a4', from: '#ffffff', to: '#e5eefb' },
  security: { label: '安全绿', foreground: '#19786b', from: '#ffffff', to: '#e2f3ed' },
  finance: { label: '财务金', foreground: '#986221', from: '#ffffff', to: '#faf0d9' },
  gold: { label: '业务金', foreground: '#896437', from: '#ffffff', to: '#f4ebdb' },
}
const customStyle = (preset = 'titanium') => {
  const p = ICON_PRESETS[preset] || ICON_PRESETS.titanium
  return { v: 1, mode: 'custom', foreground: p.foreground, background: { kind: 'gradient', from: p.from, to: p.to, opacity: 100, angle: 145 } }
}
function iconStyleVars(style, tile = true) {
  if (!style || style.mode === 'theme') return {}
  const p = ICON_PRESETS[style.preset]
  const s = style.mode === 'preset' && p ? customStyle(style.preset) : style
  if (!/^#[0-9a-f]{6}$/i.test(s.foreground || '')) return {}
  const ink = style.mode === 'preset' ? `var(--cui-icon-${style.preset},${s.foreground})` : s.foreground
  const vars = { '--cui-icon-ink': ink, '--cui-icon-manual-ink': ink }
  const bg = s.background || { kind: 'transparent' }
  if (tile) {
    vars['--cui-icon-background'] = style.mode === 'preset' ? `linear-gradient(145deg,var(--cui-icon-surface,${p.from}),var(--cui-icon-${style.preset}-fill,${p.to}))` : bg.kind === 'transparent' ? 'transparent' : bg.kind === 'solid' ? bg.from : `linear-gradient(${bg.angle}deg,${bg.from},${bg.to})`
    vars['--cui-icon-background-opacity'] = (bg.opacity ?? 100) / 100
    if (bg.kind === 'transparent') vars['--cui-icon-halo-opacity'] = 0
  }
  return vars
}

root.CRA1Shared=root.CRA1Shared||{};root.CRA1Shared.IconStyle={vars:iconStyleVars,presets:ICON_PRESETS};
})(window);

/* Public header appearance must also load on anonymous native product pages.
   Reuse the sidebar's request and memory cache; never persist a configuration. */
(function (root) {
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
