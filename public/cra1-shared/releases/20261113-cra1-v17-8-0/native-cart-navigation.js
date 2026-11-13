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
  var publicKeys = ['copyright_info','enterprise_address','enterprise_mailbox','enterprise_name','enterprise_telephone','feedback_type','website_name','website_url','terms_service_url','terms_privacy_url','currency_code','currency_prefix','currency_suffix','system_logo','official_website_logo','clientarea_logo_url','clientarea_logo_url_blank','lang_home','lang_list','lang_home_open','lang_home_follow_browser','theme_header_support','recharge_open','recharge_min','recharge_max','recharge_money_notice_content','recharge_pay_notice_content','cart_instruction','cart_instruction_content','cart_change_product','first_navigation','second_navigation','prohibit_user_information_changes','login_email_password','login_phone_password','login_phone_verify','register_email','register_phone','code_client_email_register','code_client_phone_register','client_strong_password_rule','balance_notice_show','donot_save_client_product_password','captcha_client_verify','captcha_client_update','captcha_client_security_verify','captcha_client_login','captcha_client_register','captcha_client_password_reset','captcha_client_oauth','captcha_client_login_error'];
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
  var openPanels = new Map();
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
      if (open) {
        openPanels.set(group, { id: id, panel: panel });
        root.dispatchEvent(new CustomEvent('cra1:popover-open', { detail: { id: id, group: group } }));
      } else if (openPanels.get(group) && openPanels.get(group).id === id) openPanels.delete(group);
      if (options.onOpenChange) options.onOpenChange(open);
      if (!open && restoreFocus) focus(trigger);
    }
    function openWithFocus() {
      setOpen(true);
      root.setTimeout(function () {
        if (!open || destroyed) return;
        var first = options.initialFocus || Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')).find(function (item) { return item.getClientRects().length && !item.closest('[hidden]'); });
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
    function onEnter(event) {
      if (!options.hover || event.pointerType !== 'mouse') return;
      // A late header layout change can move a hover trigger under the mouse.
      // Do not let it interrupt editing in another panel in this group; click
      // and keyboard activation still perform an explicit panel switch.
      var current = openPanels.get(group), active = doc.activeElement;
      if (current && current.id !== id && current.panel.contains(active) && active &&
          (active.matches('input, textarea, select') || active.isContentEditable)) return;
      setOpen(true);
    }
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

/* Shared text matching for public search titles and the permitted member menu. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.SearchMatch) return;
  var invisible = /[\u180e\u200b-\u200d\u2060\ufeff]/g;
  var hanLatin = /(\p{Script=Han})([a-z0-9])/gu;
  var latinHan = /([a-z0-9])(\p{Script=Han})/gu;
  var segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  function text(value) { return value === null || value === undefined ? '' : String(value); }
  function normalize(value) { return text(value).normalize('NFKC').toLowerCase().replace(invisible, '').replace(/\s+/g, ' ').trim(); }
  function compact(value) { return value.replace(/\s/g, ''); }
  function tokens(value) {
    var normalized = normalize(value);
    return normalized ? normalized.replace(hanLatin, '$1 $2').replace(latinHan, '$1 $2').split(/\s+/) : [];
  }
  function titleScore(title, term) {
    if (!title || !term) return 0;
    if (title === term) return 980;
    var tightTitle = compact(title), tightTerm = compact(term);
    if (tightTitle === tightTerm) return 960;
    if (title.indexOf(term) === 0) return 850;
    if (tightTitle.indexOf(tightTerm) === 0) return 830;
    if (title.indexOf(term) !== -1) return 750;
    if (tightTitle.indexOf(tightTerm) !== -1) return 730;
    var words = tokens(term);
    return words.length > 1 && words.every(function (word) { return tightTitle.indexOf(compact(word)) !== -1; }) ? 600 : 0;
  }
  function score(title, query, options) {
    options = options || {};
    var original = text(title), rawTerm = text(query).trim(), term = normalize(rawTerm);
    if (!term) return 0;
    if (original === rawTerm) return 1000;
    var normalizedTitle = normalize(original), rank = titleScore(normalizedTitle, term);
    if (rank) return rank;
    var aliases = Array.isArray(options.aliases) ? options.aliases : [];
    if (aliases.some(function (alias) { return titleScore(normalize(alias), term) > 0; })) return 450;
    var description = normalize(options.description);
    if (titleScore(description, term)) return 300;
    var words = tokens(term), combined = compact(normalizedTitle + ' ' + description);
    return words.length > 1 && words.every(function (word) { return combined.indexOf(compact(word)) !== -1; }) ? 300 : 0;
  }
  function graphemes(value) {
    if (segmenter) return Array.from(segmenter.segment(value), function (entry) { return { text: entry.segment, start: entry.index, end: entry.index + entry.segment.length }; });
    var result = [], offset = 0, regional = 0;
    Array.from(value).forEach(function (character) {
      var code = character.codePointAt(0), previous = result[result.length - 1];
      var isRegional = code >= 0x1f1e6 && code <= 0x1f1ff;
      var attached = previous && (/\p{Mark}/u.test(character) || code === 0x200d || /\u200d$/.test(previous.text) ||
        (code >= 0xfe00 && code <= 0xfe0f) || (code >= 0x1f3fb && code <= 0x1f3ff) || (isRegional && regional % 2 === 1));
      if (attached) { previous.text += character; previous.end += character.length; }
      else result.push({ text: character, start: offset, end: offset + character.length });
      offset += character.length; regional = isRegional ? regional + 1 : 0;
    });
    return result;
  }
  // Each normalized UTF-16 unit points back to a complete original grapheme.
  // NFKC ligatures, case expansions and emoji therefore keep safe text slices.
  function mapped(value) {
    var compatible = '', originalMap = [];
    graphemes(value).forEach(function (entry) {
      var normalized = entry.text.normalize('NFKC'); compatible += normalized;
      for (var index = 0; index < normalized.length; index++) originalMap.push({ start: entry.start, end: entry.end });
    });
    var lower = compatible.toLowerCase(), lowerMap = [], offset = 0;
    Array.from(compatible).forEach(function (character) {
      var source = originalMap[offset], length = character.toLowerCase().length;
      for (var index = 0; index < length; index++) lowerMap.push(source);
      offset += character.length;
    });
    var result = '', map = [];
    for (var index = 0; index < lower.length; index++) {
      var character = lower[index], source = lowerMap[index];
      if (/[\u180e\u200b-\u200d\u2060\ufeff]/.test(character)) continue;
      if (/\s/.test(character)) {
        if (!result || result[result.length - 1] === ' ') {
          if (map.length) map[map.length - 1] = { start: map[map.length - 1].start, end: source.end };
          continue;
        }
        character = ' ';
      }
      result += character; map.push(source);
    }
    if (result[result.length - 1] === ' ') { result = result.slice(0, -1); map.pop(); }
    return { text: result, map: map };
  }
  function parts(title, query) {
    var original = text(title), term = normalize(query), normalized = mapped(original), ranges = [];
    if (!term || !normalized.text) return [{ text: original, match: false }];
    var tight = { text: '', map: [] };
    for (var index = 0; index < normalized.text.length; index++) {
      if (normalized.text[index] !== ' ') { tight.text += normalized.text[index]; tight.map.push(normalized.map[index]); }
    }
    function find(view, word) {
      if (!word) return;
      for (var start = view.text.indexOf(word); start !== -1; start = view.text.indexOf(word, start + 1)) {
        ranges.push({ start: view.map[start].start, end: view.map[start + word.length - 1].end });
      }
    }
    find(normalized, term); find(tight, compact(term));
    tokens(term).forEach(function (word) { find(normalized, word); find(tight, compact(word)); });
    ranges.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    var merged = [];
    ranges.forEach(function (range) {
      var last = merged[merged.length - 1];
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
      else merged.push({ start: range.start, end: range.end });
    });
    var result = [], offset = 0;
    merged.forEach(function (range) {
      if (range.start > offset) result.push({ text: original.slice(offset, range.start), match: false });
      result.push({ text: original.slice(range.start, range.end), match: true }); offset = range.end;
    });
    if (offset < original.length || !result.length) result.push({ text: original.slice(offset), match: false });
    return result;
  }
  function variants(query) {
    var original = text(query).trim();
    if (!original || original === '0') return [];
    var result = [original], normalized = normalize(original), compatible = original.normalize('NFKC');
    if (!normalized || normalized === '0') return [];
    // Only words and whitespace can produce SQL-LIKE alternatives. Keep
    // identifiers, URLs and user-supplied search syntax as one literal query.
    if (/[^\p{Letter}\p{Number}\p{Mark}\s]/u.test(original + compatible)) return result;
    var words = tokens(normalized);
    if (words.length < 2 && compatible === original) return result;
    [normalized, words.join('%'), words.slice().reverse().join('%')].forEach(function (value) {
      if (value && result.indexOf(value) === -1 && result.length < 4) result.push(value);
    });
    return result;
  }
  shared.SearchMatch = { normalize: normalize, tokens: tokens, score: score, parts: parts, variants: variants };
})(typeof window !== 'undefined' ? window : globalThis);

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

/* One search data source and one mounted UI for all three CRA1 themes. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.HeaderSearch) { root.CRA1HeaderSearch = shared.HeaderSearch; return; }
  function titleRank(title, keywords) {
    return shared.SearchMatch.score(title, keywords);
  }
  function titleParts(title, keywords) {
    return shared.SearchMatch.parts(title, keywords);
  }
  function summaryText(value) {
    if (typeof value !== 'string') return '';
    var text = value.slice(0, 12000).replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
      .replace(/<(?:br\s*\/?|\/(?:p|div|li|h[1-6]|tr))\s*>/gi, ' ');
    // Template contents are inert: public HTML descriptions become text without
    // executing scripts, loading images or inserting markup into the results.
    if (root.document && typeof root.document.createElement === 'function') {
      var template = root.document.createElement('template'); template.innerHTML = text;
      text = template.content.textContent || '';
    } else {
      text = text.replace(/<[^>]*>/g, ' ').replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|lt|gt|quot|apos|nbsp);/gi, function (entity, code) {
        if (code.charAt(0) !== '#') return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[code.toLowerCase()];
        var value = code.charAt(1).toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : '';
      });
    }
    var characters = Array.from(text.replace(/\s+/g, ' ').trim());
    return characters.slice(0, 240).join('') + (characters.length > 240 ? '…' : '');
  }
  function articleDate(value) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return '';
    var date = new Date(Number(value) * 1000);
    return Number.isNaN(date.getTime()) ? '' : date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function pluginSources(options) {
    options = options || {};
    var sources = [{ key: 'products', label: '订购商品', path: 'product' }];
    if (options.includeHosts) sources.unshift({ key: 'hosts', label: '我的产品', path: 'cra1-theme/member/search' });
    if ((options.includePages === true || (options.includePages !== false && options.includeHosts)) && shared.MemberSearchPages) sources.unshift({ key: 'pages', label: '会员页面与标签' });
    var plugins = options.plugins;
    if (!plugins && !options.capabilities) {
      try {
        var doc = root.document, node = doc && doc.getElementById('addons_js');
        var value = node && node.getAttribute('addons_js');
        if (!value && doc && doc.documentElement) value = doc.documentElement.getAttribute('addons_js');
        plugins = JSON.parse(value || '[]');
      } catch (error) { plugins = []; }
    }
    if (!Array.isArray(plugins)) plugins = [];
    var capabilities = options.capabilities;
    [['IdcsmartNews', 'news', '新闻文章'], ['IdcsmartAnnouncement', 'announcement', '官方公告'], ['IdcsmartHelp', 'help', '帮助文档']].forEach(function (definition) {
      var plugin = plugins.find(function (item) {
        return item && String(item.name).toLocaleLowerCase() === definition[0].toLocaleLowerCase() && Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0 &&
          (item.status === undefined || Number(item.status) === 1) && (item.enabled === undefined || item.enabled === true || Number(item.enabled) === 1);
      });
      var available = capabilities ? capabilities[definition[1]] === true || capabilities[definition[1]] === 1 : !!plugin;
      if (available) {
        var source = { key: definition[1], path: definition[1], label: definition[2] };
        if (plugin) source.pluginId = Number(plugin.id);
        sources.push(source);
      }
    });
    return sources;
  }
  // Keep the homepage's lifecycle rules: an expired product appears only
  // after the native renewal endpoint confirms that it can still be renewed.
  function hostState(host, now) {
    if (Number(host.is_delete) === 1) return 'hidden';
    var status = host.status, cycle = host.billing_cycle;
    if (status === 'Grace') return cycle === 'on_demand' && Number(host.end_grace_time) > now ? 'grace' : 'hidden';
    // Paid pending/failed and manually suspended products still need their
    // management entry; search is broader than the homepage's using cards.
    if (['Pending', 'Failed', 'Active', 'Suspended'].indexOf(status) === -1) return 'hidden';
    if (['free', 'onetime', 'on_demand'].indexOf(cycle) !== -1) return 'using';
    var due = host.due_time;
    if (due === null || due === undefined || due === '' || !Number.isFinite(Number(due)) || Number(due) < 0) return 'hidden';
    if (Number(due) === 0 || Number(due) > now) return 'using';
    if (Number(host.renew_forbidden) === 1 || Number(host.change_billing_cycle_id) > 0) return 'hidden';
    var deadline = host.renew_recovery_deadline;
    if (deadline === null || deadline === undefined || deadline === '' || !Number.isFinite(Number(deadline))) return 'hidden';
    if (Number(deadline) !== 0 && Number(deadline) <= now) return 'hidden';
    return 'expired';
  }
  async function availableHosts(rows, data, options, currentSession) {
    var now = Number(data.overview && data.overview.server_time) || Date.now() / 1000;
    var renewal = data.overview && (data.overview.renewal_enabled === true || Number(data.overview.renewal_enabled) === 1);
    var visible = new Set(), expired = [], incomplete = false;
    rows.forEach(function (host) {
      var state = hostState(host, now);
      if (state === 'using' || state === 'grace') visible.add(Number(host.id));
      else if (state === 'expired' && renewal) expired.push(host);
    });
    for (var start = 0; start < expired.length; start += 20) {
      if (!currentSession() || (options.signal && options.signal.aborted)) return { rows: [], incomplete: false };
      var batch = expired.slice(start, start + 20), params = {};
      batch.forEach(function (host, index) { params['ids[' + index + ']'] = Number(host.id); });
      try {
        var response = await shared.Request.request('/host/renew/batch', { params: params, signal: options.signal, language: options.language, timeout: 10000 });
        if (!response.data || !Array.isArray(response.data.list)) throw new Error('续费资格读取失败');
        batch.forEach(function (host) {
          var current = response.data.list.find(function (item) { return item && Number(item.id) === Number(host.id); });
          if (!current) return;
          var fresh = Object.assign({}, host);
          ['status', 'due_time', 'suspend_type', 'billing_cycle', 'renew_forbidden', 'change_billing_cycle_id', 'is_delete'].forEach(function (field) {
            if (Object.prototype.hasOwnProperty.call(current, field)) fresh[field] = current[field];
          });
          var state = hostState(fresh, now);
          if (state === 'using' || (state === 'expired' && Array.isArray(current.billing_cycles) && current.billing_cycles.length)) visible.add(Number(host.id));
        });
      } catch (error) { incomplete = true; }
    }
    return { rows: currentSession() ? rows.filter(function (host) { return visible.has(Number(host.id)); }) : [], incomplete: incomplete };
  }
  async function search(options) {
    options = options || {};
    var keywords = String(options.keywords || '').trim();
    // The native global search treats "0" as empty; list APIs may otherwise
    // turn it into an unfiltered query rather than a matching search.
    if (!keywords || keywords === '0') return { groups: [], errors: [], pending: 0 };
    var token = shared.Request.getToken ? shared.Request.getToken() : null;
    var sources = (options.sources ? options.sources.slice() : pluginSources(options)).filter(function (source) {
      // Old consumers may still explicitly include member products. Keep the
      // public search usable without issuing a protected read as a guest.
      return (source.key !== 'hosts' && source.key !== 'pages') || !!token;
    });
    var slots = sources.map(function () { return null; }), pending = sources.length;
    function currentSession() { return token === null || !shared.Request.getToken || token === shared.Request.getToken(); }
    function snapshot() {
      var groups = [], errors = [], index = 0;
      slots.forEach(function (slot, position) {
        if (!slot) return;
        if ((sources[position].key === 'hosts' || sources[position].key === 'pages') && !currentSession()) return;
        if (slot.error) errors.push(sources[position].label);
        if (!slot.group) return;
        var group = Object.assign({}, slot.group, { items: slot.group.items.map(function (item) { return Object.assign({}, item, { index: index++ }); }) });
        groups.push(group);
      });
      return { groups: groups, errors: errors, pending: pending, partialFailure: errors.length > 0 && (groups.length > 0 || errors.length < sources.length || slots.some(function (slot) { return slot && slot.succeeded; })) };
    }
    function publish() {
      if (options.onUpdate && !(options.signal && options.signal.aborted) && currentSession()) options.onUpdate(snapshot());
    }
    // The native list contracts remain unchanged. Bound supplementary public
    // queries across all sources, and do not start queued work after cancellation.
    var publicActive = 0, publicQueue = [];
    function publicRead(path, params) {
      return new Promise(function (resolve, reject) {
        publicQueue.push({ path: path, params: params, resolve: resolve, reject: reject });
        drain();
      });
    }
    function drain() {
      while (publicActive < 3 && publicQueue.length) {
        (function (job) {
          if ((options.signal && options.signal.aborted) || !currentSession()) { job.reject(new Error('搜索已取消')); return; }
          publicActive++;
          Promise.resolve().then(function () {
            if ((options.signal && options.signal.aborted) || !currentSession()) throw new Error('搜索已取消');
            return shared.Request.request(job.path, { params: job.params, signal: options.signal, language: options.language, timeout: 10000, unauthorized: 'ignore' });
          }).then(job.resolve, job.reject).finally(function () { publicActive--; drain(); });
        })(publicQueue.shift());
      }
    }
    await Promise.all(sources.map(async function (source, position) {
      try {
        if (source.key === 'pages') {
          var pageItems = await shared.MemberSearchPages.search(keywords, { signal: options.signal, language: options.language });
          if (!Array.isArray(pageItems)) throw new Error('页面搜索结果格式错误');
          var pageSeen = new Set();
          pageItems = pageItems.filter(function (item) {
            if (!item || typeof item.title !== 'string' || typeof item.url !== 'string' || pageSeen.has(item.url)) return false;
            pageSeen.add(item.url); return true;
          }); // The directory has already ranked titles, aliases and hierarchy.
          slots[position] = { group: pageItems.length ? { key: source.key, label: source.label, items: pageItems.slice(0, 6), more: pageItems.length > 6 } : null };
          return;
        }
        var rows = [], data = {}, incomplete = false, succeeded = false, seenCandidates = new Set(), nativeMore = false;
        function rankRow(row) {
          return shared.SearchMatch.score(row.title || row.product_name || row.name, keywords,
            { description: source.key === 'products' ? row.description : '' }) || (source.key === 'help' && row.search === true ? 100 : 0);
        }
        function commit() {
          var orderedRows = rows.map(function (row, order) { return { row: row, order: order, rank: rankRow(row) }; })
          .sort(function (a, b) { return b.rank - a.rank || a.order - b.order; }).map(function (entry) { return entry.row; });
        var seen = new Set();
        orderedRows = orderedRows.filter(function (row) { var id = Number(row.id); if (seen.has(id)) return false; seen.add(id); return true; });
        var items = orderedRows.slice(0, 6).map(function (row) {
          var id = Number(row.id);
          var item = { key: source.key + ':' + id, title: row.title || row.name || '内容 #' + id, description: '' };
          if (source.key === 'hosts') {
            item.title = row.product_name || row.name || '产品 #' + id;
            item.description = [row.name, row.match_ip, '编号 ' + id].filter(Boolean).join(' · ');
            item.url = '/productdetail.htm?id=' + id;
          } else if (source.key === 'products') {
            item.description = [row.product_group_name_first, row.product_group_name_second].filter(Boolean).join(' / ');
            var productSummary = summaryText(row.description); if (productSummary) item.summary = productSummary;
            item.url = '/cart/goodsList.htm?product_id=' + id;
          } else if (options.context !== 'website' && Number.isSafeInteger(Number(source.pluginId)) && Number(source.pluginId) > 0) {
            item.description = [row.category || source.label, articleDate(row.create_time)].filter(Boolean).join(' · ');
            item.url = '/plugin/' + Number(source.pluginId) + '/' + (source.key === 'help' ? 'helpTotal' : 'news_detail') + '.htm?id=' + id;
          } else {
            item.description = [row.category || source.label, articleDate(row.create_time)].filter(Boolean).join(' · ');
            item.url = (source.key === 'news' ? '/news-details.html' : source.key === 'announcement' ? '/announce-details.html' : '/document-details.html') + '?id=' + id;
          }
          if (['news', 'announcement', 'help'].indexOf(source.key) !== -1) {
            var articleSummary = summaryText(row.excerpt || row.summary || row.description); if (articleSummary) item.summary = articleSummary;
          }
          return item;
        });
        slots[position] = { error: incomplete, succeeded: succeeded, group: items.length ? { key: source.key, label: source.label, items: items, more: orderedRows.length > 6 || nativeMore } : null };
        }
        if (source.key === 'hosts') {
          // IPs and host identifiers retain the exact existing native contract.
          var json = await shared.Request.request('/cra1-theme/member/search', { params: { keywords: keywords, page: 1, limit: 6 }, signal: options.signal, language: options.language, timeout: 10000 });
          if (!json.data || !Array.isArray(json.data.list)) throw new Error('搜索结果格式错误');
          data = json.data; succeeded = true;
          var availability = await availableHosts(data.list.filter(function (row) { return row && Number.isSafeInteger(Number(row.id)) && Number(row.id) > 0; }), data, options, currentSession);
          rows = availability.rows; incomplete = availability.incomplete; commit();
        } else {
          var variants = ['products', 'news', 'announcement'].indexOf(source.key) !== -1 ? shared.SearchMatch.variants(keywords) : [keywords];
          if (source.key === 'news' || source.key === 'announcement') variants = variants.filter(function (value, index) {
            // Native article searches accept at most 150 characters. Keep the
            // user's original query, but omit expanded alternatives that cannot
            // satisfy that contract instead of truncating their meaning.
            return index === 0 || Array.from(value).length <= 150;
          });
          // Read the original first so native/plugin matches and fast results
          // survive a failure in any optional supplementary query.
          for (var variant = 0; variant < variants.length; variant++) {
            if ((options.signal && options.signal.aborted) || !currentSession()) break;
            try {
              var response = await publicRead('/' + source.path, { keywords: variants[variant], page: 1, limit: 18 });
              if (!response.data || !Array.isArray(response.data.list)) throw new Error('搜索结果格式错误');
              data = response.data; succeeded = true;
              var received = data.list;
              if (source.key === 'help') received = received.reduce(function (all, group) {
                if (!group) return all;
                return all.concat((Array.isArray(group.helps) ? group.helps : []).filter(function (row) {
                  return row && (row.search === true || rankRow(row) > 0);
                }).map(function (row) { return Object.assign({}, row, { category: group.name }); }));
              }, []);
              received.forEach(function (row) {
                if (!row || !Number.isSafeInteger(Number(row.id)) || Number(row.id) <= 0 || seenCandidates.has(Number(row.id))) return;
                // An exact native result can match native-only fields/hooks.
                // Supplementary patterns must match the visible search fields.
                if (variant > 0 && rankRow(row) === 0) return;
                seenCandidates.add(Number(row.id)); rows.push(row);
              });
              if (source.key !== 'help' && Number(data.count) > 6) nativeMore = true;
            } catch (error) { incomplete = true; }
            commit(); publish();
          }
          commit();
        }
      } catch (error) {
        slots[position] = { error: true };
      }
      finally { pending -= 1; publish(); }
    }));
    return snapshot();
  }
  // Store only queries on this browser, never result titles, URLs or credentials.
  // Public history survives browser restarts; member history stays in this tab
  // and is isolated by the same native account/subaccount identity as checkout.
  var historyMemory = new Map(), historyUnstored = new Set();
  function historyScope(token) {
    if (!token) return { key: 'cra1-search-history:guest', storage: 'localStorage' };
    try {
      var info = JSON.parse(root.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).info;
      var account = String(info.id), subaccount = String(info.sub_account_id || info.sub_id || 0);
      if (/^[1-9]\d*$/.test(account) && /^(?:0|[1-9]\d*)$/.test(subaccount)) return { key: 'cra1-search-history:member:' + account + ':' + subaccount, storage: 'sessionStorage' };
    } catch (error) { /* Opaque tokens use memory only, separated from guests. */ }
    return { key: token, storage: '' };
  }
  function historyKey(value) { return shared.SearchMatch.normalize(value).replace(/\s/g, ''); }
  function historyRows(value) {
    var seen = new Set();
    return (Array.isArray(value) ? value : []).filter(function (term) {
      if (typeof term !== 'string' || term.length > 100 || !term.trim() || term.trim() === '0') return false;
      var key = historyKey(term); if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).map(function (term) { return term.trim(); }).slice(0, 7);
  }
  function readHistory(scope) {
    var rows = historyMemory.get(scope.key) || [];
    if (scope.storage && !historyUnstored.has(scope.key)) {
      try { var saved = root[scope.storage].getItem(scope.key); rows = saved === null ? [] : historyRows(JSON.parse(saved)); }
      catch (error) { /* Disabled or damaged storage must not interrupt search. */ }
    }
    rows = historyRows(rows); historyMemory.set(scope.key, rows); return rows;
  }
  function writeHistory(scope, rows) {
    rows = historyRows(rows); historyMemory.set(scope.key, rows);
    if (scope.storage) {
      try { if (rows.length) root[scope.storage].setItem(scope.key, JSON.stringify(rows)); else root[scope.storage].removeItem(scope.key); }
      catch (error) { historyUnstored.add(scope.key); /* Keep memory authoritative when writes are unavailable or full. */ }
    }
  }
  var sequence = 0;
  function mount(host, options) {
    options = options || {};
    if (host.__cra1HeaderSearch) return host.__cra1HeaderSearch;
    var UI = shared.UI, doc = host.ownerDocument;
    var desktopMedia = root.matchMedia('(min-width: 1024px)'), mobileMedia = root.matchMedia('(max-width: 767px)');
    var desktop = desktopMedia.matches, restoringFocus = false, geometryFrame = null, geometryObserver = null;
    var context = options.context || 'website';
    var prefix = options.idPrefix || ('cra1-header-search-' + (++sequence));
    var copy = { placeholder: '搜索产品、新闻、公告、文档', memberPlaceholder: '搜索页面、产品、主机标识或 IP', searching: '正在搜索…', noresult: '没有找到相关内容，请换个关键词' };
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
    var resultsNode = null, listNode = null, destroyed = false, composing = false, unwatchSession = null, completedQuery = null;
    var state = { groups: [], errors: [], loading: false, activeIndex: -1, partialFailure: false }, generation = 0, timer = null, abort = null, identityToken = sessionToken();
    panel.id = prefix + '-panel'; input.id = prefix;
    function placeholder() {
      var memberSearch = !!sessionToken() && !!shared.MemberSearchPages;
      if (!desktop) return memberSearch ? copy.memberPlaceholder : copy.placeholder;
      var customPlaceholder = typeof copy.placeholder === 'string' && copy.placeholder !== '搜索产品、新闻、公告、文档';
      var customMemberPlaceholder = typeof copy.memberPlaceholder === 'string' && copy.memberPlaceholder !== '搜索页面、产品、主机标识或 IP';
      if (context === 'website') {
        // Migrate the old stock copy only while rendering. Merchant overrides
        // and the saved theme configuration are left intact.
        return customPlaceholder ? copy.placeholder : '搜索文档、商品等内容';
      }
      if (sessionToken() && customMemberPlaceholder) return copy.memberPlaceholder;
      if (customPlaceholder) return copy.placeholder;
      return sessionToken() ? '搜索商品、服务器 IP、管理页面等' : '搜索商品、文档等公开内容';
    }
    function syncSurface() {
      host.classList.toggle('is-persistent', desktop);
      trigger.hidden = desktop;
      panel.hidden = !desktop && !popover.isOpen;
      positionResults();
    }
    function historyItems() {
      return readHistory(historyScope(sessionToken())).map(function (term, index) { return { history: true, title: term, index: index }; });
    }
    function items() {
      return popover.isOpen && !input.value.trim() && !composing ? historyItems() : state.groups.reduce(function (all, group) { return all.concat(group.items); }, []);
    }
    function remember(keywords, token) {
      if (identityToken !== token || token !== sessionToken() || composing) return;
      var term = String(keywords || '').trim();
      if (!term || term === '0' || term.length > 100 || !historyKey(term)) return;
      var scope = historyScope(token), key = historyKey(term);
      writeHistory(scope, [term].concat(readHistory(scope).filter(function (value) { return historyKey(value) !== key; })));
    }
    function invalidate() { generation += 1; root.clearTimeout(timer); timer = null; if (abort) { abort.abort(); abort = null; } }
    function sessionToken() { return shared.Request && shared.Request.getToken ? shared.Request.getToken() : ''; }
    function clearSession() {
      if (destroyed) return;
      identityToken = sessionToken(); composing = false; completedQuery = null; invalidate(); input.value = '';
      state.groups = []; state.errors = []; state.activeIndex = -1; state.partialFailure = false; state.loading = false;
      close(host.contains(doc.activeElement)); render();
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
      if (identityToken !== sessionToken()) { if (event) event.preventDefault(); clearSession(); return; }
      if (item.history) {
        if (event) event.preventDefault();
        input.value = item.title; state.activeIndex = -1; UI.focus(input); remember(item.title, sessionToken()); perform(); return;
      }
      remember(input.value, sessionToken());
      if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button)) return;
      if (event) event.preventDefault();
      popover.close(false);
      if (options.onNavigate) options.onNavigate(item.url);
      else root.location.href = item.url;
    }
    function render() {
      if (identityToken !== sessionToken()) { clearSession(); return; }
      var memberSearch = !!sessionToken() && !!shared.MemberSearchPages;
      input.placeholder = placeholder();
      var accessibleName = context === 'website' ? '搜索文档、商品等公开内容' : sessionToken() ? '搜索商品、服务器 IP、管理页面等' : '搜索商品、文档等公开内容';
      input.setAttribute('aria-label', desktop ? (input.placeholder.trim() ? input.placeholder : accessibleName) : memberSearch ? '搜索会员页面、标签、产品、主机标识和 IP' : '搜索产品、新闻、公告和帮助文档');
      clearButton.hidden = !input.value;
      var showingHistory = !input.value.trim() && !composing, recent = showingHistory ? historyItems() : [];
      var visible = popover.isOpen && (!!input.value.trim() || recent.length > 0);
      input.setAttribute('aria-expanded', String(visible));
      if (!visible) {
        if (resultsNode) resultsNode.remove(); resultsNode = null; listNode = null;
        input.removeAttribute('aria-controls'); input.removeAttribute('aria-activedescendant'); return;
      }
      if (!resultsNode) { resultsNode = doc.createElement('div'); resultsNode.className = 'cra1-header-search__results'; panel.appendChild(resultsNode); }
      resultsNode.replaceChildren();
      if (showingHistory) {
        var history = doc.createElement('div'); history.className = 'cra1-header-search__history';
        var historyHeading = doc.createElement('div'); historyHeading.className = 'cra1-header-search__history-title';
        var historyLabel = doc.createElement('span'); historyLabel.textContent = '搜索历史';
        var erase = doc.createElement('button'); erase.type = 'button'; erase.className = 'cra1-header-search__history-clear cui-button cui-button--ghost'; erase.textContent = '清空'; erase.setAttribute('aria-label', '清空搜索历史');
        erase.addEventListener('click', function () { if (identityToken !== sessionToken()) { clearSession(); return; } writeHistory(historyScope(sessionToken()), []); state.activeIndex = -1; render(); UI.focus(input); });
        historyHeading.append(historyLabel, erase); history.appendChild(historyHeading);
        listNode = doc.createElement('div'); listNode.id = prefix + '-results'; listNode.className = 'cra1-header-search__history-list'; listNode.setAttribute('role', 'listbox'); listNode.setAttribute('aria-label', '搜索历史');
        input.setAttribute('aria-controls', listNode.id);
        recent.forEach(function (item) {
          var button = doc.createElement('button'); button.type = 'button'; button.id = prefix + '-results-' + item.index; button.dataset.index = item.index; button.className = 'cra1-header-search__history-item'; button.setAttribute('role', 'option');
          var icon = doc.createElement('span'); icon.setAttribute('aria-hidden', 'true'); icon.innerHTML = UI.icon('search');
          var label = doc.createElement('span'); label.className = 'cra1-header-search__history-text'; label.textContent = item.title;
          button.append(icon, label); button.addEventListener('mouseenter', function () { state.activeIndex = item.index; setActive(); });
          button.addEventListener('click', function (event) { navigate(item, event); }); listNode.appendChild(button);
        });
        history.appendChild(listNode); resultsNode.appendChild(history); setActive(); positionResults(); return;
      }
      var count = items().length;
      var status = doc.createElement('p'); status.className = 'cra1-header-search__status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      status.textContent = composing || (state.loading && !count) ? copy.searching : count ? '找到 ' + count + ' 条结果' + (state.loading ? '，正在继续搜索…' : '') : state.errors.length ? state.partialFailure ? '部分内容暂时无法搜索，请重试' : '暂时无法搜索，请点击重试' : copy.noresult;
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
          if (item.summary) {
            var summary = doc.createElement('span'); summary.className = 'cra1-header-search__item-summary';
            titleParts(item.summary, input.value).forEach(function (part) { var node = doc.createElement(part.match ? 'mark' : 'span'); node.textContent = part.text; summary.appendChild(node); });
            link.appendChild(summary);
          }
          link.addEventListener('mouseenter', function () { state.activeIndex = item.index; setActive(); });
          link.addEventListener('click', function (event) { navigate(item, event); }); section.appendChild(link);
        });
        listNode.appendChild(section);
      });
      if (state.errors.length) {
        var error = doc.createElement('div'); error.className = 'cra1-header-search__error'; error.setAttribute('role', 'status');
        var message = doc.createElement('span'); message.textContent = count || state.partialFailure ? '部分内容暂时无法搜索' : state.loading ? '部分内容暂时无法搜索，正在继续查询' : '搜索暂时不可用，请重试';
        var retry = doc.createElement('button'); retry.type = 'button'; retry.className = 'cui-button cui-button--ghost'; retry.textContent = '重试'; retry.setAttribute('aria-label', '重试搜索');
        retry.addEventListener('click', function () { perform(); UI.focus(input); });
        error.append(message, retry); resultsNode.appendChild(error);
      }
      setActive(); positionResults();
    }
    async function perform() {
      if (identityToken !== sessionToken()) { clearSession(); return; }
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1; state.partialFailure = false;
      var keywords = input.value.trim();
      if (!popover.isOpen || !keywords || composing || destroyed) { state.loading = false; render(); return; }
      state.loading = true; render();
      var current = generation, token = sessionToken(), controller = abort = new AbortController();
      try {
        var configuration = options.getSearchOptions ? options.getSearchOptions() : options;
        var result = await search(Object.assign({}, configuration, { keywords: keywords, signal: controller.signal, onUpdate: function (partial) {
          if (current !== generation || destroyed || !popover.isOpen) return;
          if (token !== sessionToken()) { clearSession(); return; }
          var selected = items()[state.activeIndex], selectedKey = selected && selected.key;
          state.groups = partial.groups; state.errors = partial.errors; state.partialFailure = partial.partialFailure; state.loading = partial.pending > 0;
          state.activeIndex = selectedKey ? items().findIndex(function (item) { return item.key === selectedKey; }) : -1;
          render();
        } }));
        if (current !== generation || destroyed || !popover.isOpen) return;
        if (token !== sessionToken()) { clearSession(); return; }
        state.groups = result.groups; state.errors = result.errors; state.partialFailure = result.partialFailure;
        completedQuery = { keywords: keywords, token: token };
      } catch (error) {
        if (current !== generation || destroyed || !popover.isOpen) return;
        if (token !== sessionToken()) { clearSession(); return; }
        state.errors = ['搜索服务']; state.partialFailure = false;
      }
      if (current !== generation || destroyed || !popover.isOpen) return;
      abort = null; state.loading = false; render();
    }
    function schedule() {
      if (identityToken !== sessionToken()) { clearSession(); return; }
      invalidate(); state.groups = []; state.errors = []; state.activeIndex = -1; state.partialFailure = false;
      state.loading = popover.isOpen && !!input.value.trim() && !composing;
      render(); if (state.loading) timer = root.setTimeout(perform, 280);
    }
    var popover = UI.createPopover({
      root: host, trigger: trigger, panel: panel, group: 'header', initialFocus: input, beforeOpen: options.beforeOpen,
      manageVisibility: false, bindTrigger: false,
      onOpenChange: function (open) {
        if (!open) {
          if (completedQuery && completedQuery.keywords === input.value.trim()) remember(completedQuery.keywords, completedQuery.token);
          completedQuery = null; composing = false; invalidate(); state.loading = false;
        }
        syncSurface();
        if (options.onOpenChange) options.onOpenChange(open);
        render();
        if (open) { UI.focus(input); if (input.value.trim()) perform(); }
      },
    });
    function positionResults() {
      if (destroyed) return;
      var expanded = desktop && (popover.isOpen || panel.contains(doc.activeElement));
      if (desktop) {
        // Grow over the existing navigation, keeping its layout and the right
        // action controls in place. Use this header's bounds, not a site width.
        var header = host.closest('.cra1-site-header__row') || host.closest('header') || doc.documentElement;
        var area = header.getBoundingClientRect(), anchor = host.getBoundingClientRect();
        var viewport = doc.documentElement.clientWidth || root.innerWidth;
        var available = Math.max(anchor.width, Math.min(anchor.right, viewport - 12) - Math.max(12, area.left + 12));
        var width = Math.min(available, Math.max(anchor.width, area.width * 0.68));
        var value = Math.round(width * 100) / 100 + 'px';
        if (host.style.getPropertyValue('--cra1-search-expanded-width') !== value) host.style.setProperty('--cra1-search-expanded-width', value);
      } else host.style.removeProperty('--cra1-search-expanded-width');
      host.classList.toggle('is-expanded', expanded);
      // Both surfaces inherit the same panel width during the whole transition.
      if (resultsNode) { resultsNode.style.removeProperty('width'); resultsNode.style.removeProperty('right'); }
    }
    function queueGeometry() {
      if (geometryFrame !== null || destroyed) return;
      geometryFrame = root.requestAnimationFrame(function () { geometryFrame = null; positionResults(); });
    }
    function close(restore) {
      popover.close(false);
      if (restore) {
        restoringFocus = true; UI.focus(desktop ? input : trigger); restoringFocus = false;
      }
    }
    function onTrigger(event) { event.preventDefault(); if (popover.isOpen) close(false); else popover.show(); }
    function onFocus() { if (desktop && !restoringFocus && !popover.isOpen) popover.show(); }
    function onInputClick() { if (desktop && !popover.isOpen) popover.show(); }
    function onInput() { if (desktop && !popover.isOpen) { popover.show(); return; } schedule(); }
    function onCompositionStart() { composing = true; invalidate(); state.loading = false; render(); }
    function onCompositionEnd() { composing = false; schedule(); }
    function onKey(event) {
      if (event.isComposing || composing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      if (desktop && !popover.isOpen) { event.preventDefault(); popover.show(); return; }
      var count = items().length; if (!count) return;
      event.preventDefault(); state.activeIndex = event.key === 'ArrowDown' ? (state.activeIndex + 1) % count : state.activeIndex < 0 ? count - 1 : (state.activeIndex + count - 1) % count;
      setActive(); var item = doc.getElementById(prefix + '-results-' + state.activeIndex); if (item) item.scrollIntoView({ block: 'nearest' });
    }
    function onSubmit(event) { event.preventDefault(); if (composing) return; if (desktop && !popover.isOpen) { popover.show(); return; } var selected = items()[state.activeIndex]; if (selected) navigate(selected); else { remember(input.value, sessionToken()); perform(); } }
    function onClear() { input.value = ''; schedule(); UI.focus(input); }
    function onClose() { close(true); }
    function onHostKey(event) {
      if (desktop && event.key === 'Escape' && !event.isComposing && popover.isOpen) {
        event.preventDefault(); event.stopPropagation(); close(true);
      }
    }
    function preventFocus(event) { event.preventDefault(); }
    function stopClick(event) { event.stopPropagation(); }
    function onHistoryStorage(event) {
      if (event.key === 'cra1-search-history:guest' || event.key === null) {
        historyMemory.delete('cra1-search-history:guest'); historyUnstored.delete('cra1-search-history:guest');
        if (!sessionToken() && popover.isOpen && !input.value.trim()) { state.activeIndex = -1; render(); }
      }
    }
    function onBreakpoint() {
      close(false); desktop = desktopMedia.matches; syncSurface(); render();
      if (panel.hidden && panel.contains(doc.activeElement)) doc.activeElement.blur();
    }
    input.addEventListener('focus', onFocus); input.addEventListener('click', onInputClick); trigger.addEventListener('click', onTrigger);
    input.addEventListener('input', onInput); input.addEventListener('compositionstart', onCompositionStart); input.addEventListener('compositionend', onCompositionEnd); input.addEventListener('keydown', onKey);
    form.addEventListener('submit', onSubmit); clearButton.addEventListener('mousedown', preventFocus); clearButton.addEventListener('click', onClear); closeButton.addEventListener('click', onClose); host.addEventListener('click', stopClick); host.addEventListener('keydown', onHostKey);
    desktopMedia.addEventListener('change', onBreakpoint); mobileMedia.addEventListener('change', onBreakpoint);
    root.addEventListener('resize', queueGeometry); root.addEventListener('storage', onHistoryStorage);
    host.addEventListener('focusin', positionResults); host.addEventListener('focusout', queueGeometry);
    if (root.ResizeObserver) {
      geometryObserver = new root.ResizeObserver(queueGeometry);
      [host, host.parentElement, host.closest('header')].filter(Boolean).forEach(function (node) { geometryObserver.observe(node); });
    }
    // Search can include member products. Purge them on identity changes and
    // before a hidden/BFCache page retains the old account's DOM.
    if (shared.NotificationSession) unwatchSession = shared.NotificationSession.watch(clearSession);
    else doc.addEventListener('api:unauthorized', clearSession);
    doc.addEventListener('visibilitychange', onVisibility); root.addEventListener('pagehide', clearSession);
    var component = {
      open: function () { popover.show(); }, close: close, refresh: schedule,
      get isOpen() { return popover.isOpen; },
      destroy: function () {
        if (destroyed) return;
        popover.destroy(); destroyed = true; invalidate();
        input.removeEventListener('focus', onFocus); input.removeEventListener('click', onInputClick); trigger.removeEventListener('click', onTrigger);
        input.removeEventListener('input', onInput); input.removeEventListener('compositionstart', onCompositionStart); input.removeEventListener('compositionend', onCompositionEnd); input.removeEventListener('keydown', onKey);
        form.removeEventListener('submit', onSubmit); clearButton.removeEventListener('mousedown', preventFocus); clearButton.removeEventListener('click', onClear); closeButton.removeEventListener('click', onClose); host.removeEventListener('click', stopClick); host.removeEventListener('keydown', onHostKey);
        desktopMedia.removeEventListener('change', onBreakpoint); mobileMedia.removeEventListener('change', onBreakpoint); root.removeEventListener('resize', queueGeometry); root.removeEventListener('storage', onHistoryStorage);
        host.removeEventListener('focusin', positionResults); host.removeEventListener('focusout', queueGeometry);
        if (geometryObserver) geometryObserver.disconnect();
        if (geometryFrame !== null) root.cancelAnimationFrame(geometryFrame);
        host.style.removeProperty('--cra1-search-expanded-width');
        host.classList.remove('is-persistent', 'is-expanded'); host.replaceChildren(); delete host.__cra1HeaderSearch;
        if (unwatchSession) unwatchSession(); else doc.removeEventListener('api:unauthorized', clearSession);
        doc.removeEventListener('visibilitychange', onVisibility); root.removeEventListener('pagehide', clearSession);
      },
    };
    syncSurface(); render();
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
    var tags=el('div','cra1-upanel__tags'),consoleLink=link(tags,'','/home.htm','cra1-upanel__tag cra1-upanel__tag--console',options); consoleLink.setAttribute('data-cui-effects','none'); var fog=el('span','cra1-upanel__tag-fog'); fog.setAttribute('aria-hidden','true'); consoleLink.append(fog,el('span','cra1-upanel__tag-txt','控制台'));
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

/* Shared enhancement lifecycle; no business events or component values change.
   Frameworks may render the decorative spans explicitly. Legacy hosts receive
   the same spans through Styles' existing observer; standalone admin owns one
   small observer. With JS/CSS unavailable every control remains usable. */
(function (root) {
 'use strict';
 var shared=root.CRA1Shared=root.CRA1Shared||{};
 if(shared.UIEffects)return;
 var doc=root.document, started=false, managed=false, observer=null, intersection=null, raf=0;
 var preference=root.matchMedia?root.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 var tracked=new Set(), records=new WeakMap(), animations=new Map(), pointer=null, mouseTarget=null;
 var selector='.cui-button,.btn-aurora,.cra1-header__login,.cra1-upanel__tag--console,.cui-tabs__trigger,.cui-choice,.cui-select-option,.admin-menu-select__option,.cui-menu-item,.el-select-dropdown__item,[data-cui-edge],.cui-edge,.cra1-primary-item,.cra1-nav-l2,.cra1-nav-l3,.cra1-nav-recent,.el-tabs__item,.el-radio-button__inner,.el-checkbox-button__inner,[data-cui-interactive],[data-cui-reveal],.ring-sheen,.cui-card,.lift-card,.cui-input,.cui-select-trigger,.cui-date-trigger,.admin-menu-select,.cra1-ta-msel__trigger,.node-region-trigger,.el-input__inner,.el-textarea__inner,a.product-card,a.feature-item,a.glass-card,a.article-card,a.choice-card,a.link-card,a.rail-link,a.hairline-card';
 var actionSelector='button,input,select,textarea,[role="button"],[role="tab"],[role="option"],[role="menuitem"],.cui-button,.btn-aurora,.cra1-header__login,.cra1-upanel__tag--console,.cui-tabs__trigger,.cui-choice,.cui-select-option,.admin-menu-select__option,.cui-menu-item,.el-select-dropdown__item,.cra1-primary-item,.cra1-nav-l2,.cra1-nav-l3,.cra1-nav-recent,.el-tabs__item,.el-radio-button__inner,.el-checkbox-button__inner';
 var clickableCardSelector='[data-cui-interactive="card"],a.product-card,a.feature-item,a.glass-card,a.article-card,a.choice-card,a.link-card,a.hairline-card,a.cui-card';
 var cardSelector=clickableCardSelector+',.cui-card,.lift-card,[data-cui-edge="hover"],.ring-sheen';
 var forbidden='.cl-rail-card,.cl-rail-dock,.cl-config-panel,.f-order,.order-right,.el-table,.cui-table,.el-table__fixed,.main-card,.cra1-native-page__content';
 function allowed(){return doc&&doc.documentElement.matches('[data-cra1-theme],[data-cra1-ui]');}
 function disabled(el){return el.matches(':disabled,[aria-disabled="true"],[aria-busy="true"],[aria-invalid="true"],[data-disabled],.is-disabled,.is-loading,.cui-button--danger,.el-button--danger')||!!el.closest('.is-error');}
 function nativeContent(el){return doc.documentElement.matches('[data-cra1-native-module],[data-cra1-native-cart]')&&!!el.closest('.config-box .content,.el-dialog__wrapper,.el-message-box__wrapper,.el-select-dropdown,.el-cascader__dropdown,.el-picker-panel,.el-popper');}
 function optedOut(el){return !!el.closest('[data-cui-effects="none"],.cra1-upanel__tag--console');}
 function direct(el,name){return Array.from(el.children).find(function(child){return child.classList.contains(name);});}
 function decoration(el,name,record){var found=direct(el,name);if(found)return found;var node=doc.createElement('span');node.className=name;node.setAttribute('aria-hidden','true');node.dataset.cuiOwned='effects';el.appendChild(node);record.nodes.push(node);return node;}
 function ownClass(el,name,on,record){if(on&&!el.classList.contains(name)){el.classList.add(name);record.classes.add(name);}else if(!on&&record.classes.has(name)){el.classList.remove(name);record.classes.delete(name);}}
 function safeLift(el){if(nativeContent(el)||el.matches(forbidden)||el.closest('table,.el-table,.cui-table,.cl-rail-dock,.f-order,.order-right'))return false;if(el.querySelector(forbidden+',table,.el-dialog__wrapper,.el-message-box__wrapper,[role="dialog"],.cui-dialog,.cui-sheet,.fixed,[style*="position: fixed"],[style*="position:fixed"]'))return false;var s=root.getComputedStyle(el);if(s.position==='fixed'||s.position==='sticky')return false;return !Array.from(el.querySelectorAll('*')).some(function(child){var position=root.getComputedStyle(child).position;return position==='fixed'||position==='sticky';});}
 // Decoration opt-ins identify a card, never its business selection. A featured
 // information card may opt into hover without acquiring a click handler.
 function selected(el){return el.matches('[aria-selected="true"],[aria-pressed="true"],[data-selected="true"],[data-state="active"],[data-state="checked"],.is-selected,.selected,.is-active');}
 function edgeCandidate(el){if(optedOut(el)||nativeContent(el)||el.matches(actionSelector+','+forbidden)||!el.matches(cardSelector)||el.closest('table,.el-table,.cui-table,.cl-rail-dock,.f-order,.order-right'))return false;var position=root.getComputedStyle(el).position;return position!=='fixed'&&position!=='sticky';}
 // Only actual card candidates participate. Page shells, field wrappers and
 // plain containers never suppress a card. The outermost eligible card owns
 // decoration; an inner selected card keeps its business state unchanged.
 function edgeCard(el){if(!edgeCandidate(el))return false;var ancestor=el.parentElement&&el.parentElement.closest(cardSelector);while(ancestor){if(edgeCandidate(ancestor))return false;ancestor=ancestor.parentElement&&ancestor.parentElement.closest(cardSelector);}return true;}
 function updateEdge(el,rec,eligible){
  var edge=eligible&&!disabled(el)&&(rec.hover||selected(el));
  ownClass(el,'cui-edge-host',edge,rec);ownClass(el,'cui-edge-active',edge,rec);
  if(edge)decoration(el,'cui-edge-segment',rec);
  else rec.nodes=rec.nodes.filter(function(node){if(node.classList.contains('cui-edge-segment')){node.remove();return false;}return true;});
 }
 function clean(el){var rec=records.get(el);if(!rec)return;if(intersection)intersection.unobserve(el);rec.nodes.forEach(function(node){node.remove();});rec.classes.forEach(function(name){el.classList.remove(name);});el.style.removeProperty('--cui-pointer-x');el.style.removeProperty('--cui-pointer-y');tracked.delete(el);records.delete(el);}
 function apply(el){
  if(!el||el.nodeType!==1||el.closest('[data-cui-owned="effects"]')||(!records.has(el)&&!el.matches(selector)))return;
  if(nativeContent(el)||optedOut(el)){clean(el);return;}
  var rec=records.get(el);if(!rec){rec={nodes:[],classes:new Set(),visible:false,reveal:false,hover:false};records.set(el,rec);tracked.add(el);if(intersection)intersection.observe(el);}
  var ordinary=el.matches('.cui-button,.btn-aurora,.cra1-header__login')&&!el.matches('.cui-button--ghost,.cui-button--icon,.cui-button--link,.cui-button--danger,.el-button--text')&&!disabled(el);
  ownClass(el,'cui-rainbow',ordinary,rec);if(ordinary)decoration(el,'cui-button-glow',rec);
  var eligible=edgeCard(el),card=eligible&&el.matches(clickableCardSelector)&&safeLift(el);
  ownClass(el,'cui-edge-card',eligible,rec);rec.hover=!!(eligible&&!preference.matches&&!doc.hidden&&mouseTarget&&mouseTarget.isConnected&&el.contains(mouseTarget));
  updateEdge(el,rec,eligible);
  ownClass(el,'cui-pointer-card',card,rec);
  if(!card)ownClass(el,'cui-pointer-active',false,rec);
 }
 function cleanupDisconnected(){tracked.forEach(function(el){if(!el.isConnected)clean(el);});animations.forEach(function(el,animation){if(!el.isConnected){animation.cancel();animations.delete(animation);}});}
 function scan(node){if(!started||!node||node.nodeType!==1&&node.nodeType!==9)return;if(node.nodeType===1)apply(node);node.querySelectorAll(selector).forEach(apply);cleanupDisconnected();}
 function update(changes){if(!started)return;changes.forEach(function(change){if(change.target.nodeType!==1)return;if(change.type==='childList'||change.type==='attributes'){apply(change.target);change.target.querySelectorAll(selector).forEach(apply);}if(change.type==='childList'){var card=change.target.closest('.cui-pointer-card');if(card&&card!==change.target)apply(card);}if(change.type==='attributes'){var parent=change.target.closest('.el-radio-button,.el-checkbox-button');if(parent)parent.querySelectorAll('.el-radio-button__inner,.el-checkbox-button__inner').forEach(apply);}});cleanupDisconnected();}
 function animate(el,frames,options){if(preference.matches||doc.hidden||!el.animate)return;animations.forEach(function(target,previous){if(target===el){previous.cancel();animations.delete(previous);}});var anim=el.animate(frames,options);animations.set(anim,el);var done=function(){animations.delete(anim);};anim.onfinish=done;anim.oncancel=done;return anim;}
 function reveal(el,rec,inView,entry){
  if(!el.hasAttribute('data-cui-reveal')||el.closest('[data-enter],[data-reveal],dialog,[role="dialog"],.cui-popover,.el-popover')||(el.parentElement&&el.parentElement.closest('[data-cui-reveal]'))||!safeLift(el)||preference.matches||doc.hidden)return;
  if(!inView||entry.intersectionRatio<.12){if(rec.reveal){rec.reveal=false;if(!el.contains(doc.activeElement)){var exit=entry.boundingClientRect.top<0?-8:8;animate(el,[{opacity:1,translate:'0 0'},{opacity:.35,translate:'0 '+exit+'px'}],{duration:140,easing:'ease-out'});}}return;}
  if(rec.reveal)return;rec.reveal=true;
  var dy=entry.boundingClientRect.top<0?-8:8;
  animate(el,[{opacity:.15,translate:'0 '+dy+'px'},{opacity:1,translate:'0 0'}],{duration:340,easing:'cubic-bezier(.23,1,.32,1)'});
 }
 function settle(){animations.forEach(function(el,anim){anim.cancel();});animations.clear();doc.querySelectorAll('.cui-ripple-clip[data-cui-owned="effects"]').forEach(function(node){node.remove();});}
 function sync(){var paused=preference.matches||doc.hidden;doc.documentElement.toggleAttribute('data-cui-effects-paused',paused);if(paused){settle();pointer=null;mouseTarget=null;tracked.forEach(function(el){var rec=records.get(el);if(rec){rec.hover=false;ownClass(el,'cui-pointer-active',false,rec);updateEdge(el,rec,el.classList.contains('cui-edge-card'));}});}}
 function ripple(event){
  if(preference.matches||doc.hidden||event.button>0||!event.target.closest)return;
  var el=event.target.closest('.cui-button,.cui-choice,.cui-tabs__trigger');if(!el||optedOut(el)||nativeContent(el)||disabled(el)||el.matches('.cui-button--ghost,.cui-button--icon,.cui-button--link')||!el.animate)return;
  var rect=el.getBoundingClientRect(),size=Math.max(rect.width,rect.height)*2,clip=doc.createElement('span'),wave=doc.createElement('span');clip.className='cui-ripple-clip';clip.dataset.cuiOwned='effects';clip.setAttribute('aria-hidden','true');wave.className='cui-ripple';var x=event.clientX-rect.left,y=event.clientY-rect.top;
  wave.style.cssText='width:'+size+'px;height:'+size+'px;left:'+(x-size/2)+'px;top:'+(y-size/2)+'px;';clip.appendChild(wave);el.appendChild(clip);
  var anim=animate(wave,[{transform:'scale(0)',opacity:1},{transform:'scale(1)',opacity:0}],{duration:460,easing:'cubic-bezier(.23,1,.32,1)'});
  if(anim){var done=function(){animations.delete(anim);clip.remove();};anim.onfinish=done;anim.oncancel=done;}else clip.remove();
 }
 function pointerOver(event){if(preference.matches||doc.hidden||event.pointerType!=='mouse'||!event.target.closest)return;mouseTarget=event.target;var el=event.target.closest('.cui-edge-card');if(!el||el.contains(event.relatedTarget)||disabled(el))return;var rec=records.get(el);if(rec){rec.hover=true;updateEdge(el,rec,true);}}
 function pointerMove(event){if(preference.matches||doc.hidden||event.pointerType!=='mouse'||!event.target.closest)return;mouseTarget=event.target;var el=event.target.closest('.cui-pointer-card');if(!el||disabled(el))return;pointer={el:el,x:event.clientX,y:event.clientY};if(raf)return;raf=root.requestAnimationFrame(function(){raf=0;var data=pointer;if(!data||!data.el.isConnected)return;var rect=data.el.getBoundingClientRect(),rec=records.get(data.el);if(!rec||!rec.hover)return;data.el.style.setProperty('--cui-pointer-x',(data.x-rect.left)+'px');data.el.style.setProperty('--cui-pointer-y',(data.y-rect.top)+'px');ownClass(data.el,'cui-pointer-active',true,rec);});}
 function pointerOut(event){if(event.pointerType==='mouse')mouseTarget=event.relatedTarget&&event.relatedTarget.nodeType===1?event.relatedTarget:null;var el=event.target.closest&&event.target.closest('.cui-edge-card');if(!el||el.contains(event.relatedTarget))return;if(pointer&&pointer.el===el)pointer=null;var rec=records.get(el);if(rec){rec.hover=false;ownClass(el,'cui-pointer-active',false,rec);updateEdge(el,rec,true);}}
 function focusIn(event){animations.forEach(function(el,anim){if(el.contains(event.target)){anim.cancel();animations.delete(anim);}});}
 function start(options){
  if(started||!allowed())return;started=true;managed=!!(options&&options.managed);
  if(root.IntersectionObserver)intersection=new root.IntersectionObserver(function(entries){entries.forEach(function(entry){var el=entry.target,rec=records.get(el);if(!rec)return;rec.visible=entry.isIntersecting;ownClass(el,'cui-effect-offscreen',!entry.isIntersecting,rec);reveal(el,rec,entry.isIntersecting,entry);});},{threshold:[0,.12]});
  if(!managed&&root.MutationObserver){observer=new root.MutationObserver(function(changes){var nodes=new Set();changes.forEach(function(change){if(change.type==='childList')change.addedNodes.forEach(function(node){if(node.nodeType===1&&!(node.dataset&&node.dataset.cuiOwned==='effects'))nodes.add(node);});});nodes.forEach(scan);update(changes);});observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-selected','aria-pressed','aria-disabled','aria-busy','aria-invalid','disabled','data-disabled','data-selected','data-state','data-cui-edge','data-cui-interactive','data-cui-effects']});}
  doc.addEventListener('pointerdown',ripple,true);doc.addEventListener('pointerover',pointerOver,{passive:true});doc.addEventListener('pointermove',pointerMove,{passive:true});doc.addEventListener('pointerout',pointerOut,{passive:true});doc.addEventListener('focusin',focusIn);doc.addEventListener('visibilitychange',sync);
  if(preference.addEventListener)preference.addEventListener('change',sync);else if(preference.addListener)preference.addListener(sync);
  sync();scan(doc);
 }
 function destroy(){if(!started)return;started=false;if(observer)observer.disconnect();if(intersection)intersection.disconnect();observer=intersection=null;if(raf)root.cancelAnimationFrame(raf);raf=0;pointer=mouseTarget=null;settle();tracked.forEach(clean);doc.documentElement.removeAttribute('data-cui-effects-paused');doc.removeEventListener('pointerdown',ripple,true);doc.removeEventListener('pointerover',pointerOver);doc.removeEventListener('pointermove',pointerMove);doc.removeEventListener('pointerout',pointerOut);doc.removeEventListener('focusin',focusIn);doc.removeEventListener('visibilitychange',sync);if(preference.removeEventListener)preference.removeEventListener('change',sync);else if(preference.removeListener)preference.removeListener(sync);}
 shared.UIEffects={start:start,scan:scan,update:update,destroy:destroy};
})(typeof window!=='undefined'?window:globalThis);

/* Public header appearance must also load on anonymous native product pages.
   Reuse the sidebar's request and memory cache; never persist a configuration. */
(function (root) {
  // Native modules retain all controls and scripts. Only the theme-owned
  // navigation receives shared decorative effects in this standalone bundle.
  function effects(){if(root.CRA1Shared&&root.CRA1Shared.UIEffects)root.CRA1Shared.UIEffects.start();}
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',effects,{once:true});else effects();
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
