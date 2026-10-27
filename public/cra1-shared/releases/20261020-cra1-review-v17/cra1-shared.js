/* Generated from public/cra1-shared/src. Edit the source and rebuild. */
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
        var views = { idcsmartnews: ['source', 'news_detail'], idcsmartannouncement: ['source', 'news_detail'], idcsmarthelp: ['source', 'helpTotal'], idcsmartfiledownload: ['source', 'file_download'] };
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
  function failure(message, code, status, data) {
    if(shared.Runtime)message=shared.Runtime.error({message:message});
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
      var status = envelope && envelope.status !== undefined ? Number(envelope.status) : response.status;
      if (response.status === 401 || status === 401) {
        unauthorized({ policy: options.unauthorized || (requiresLogin() ? 'redirect' : 'notify'), token: token });
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
        throw failure(envelope && envelope.msg || '请求失败，请稍后重试', 'API_ERROR', response.ok ? status : response.status, envelope);
      }
      if (shared.Security && envelope.data && envelope.data.verification_expires_at) shared.Security.remember(envelope.data.verification_expires_at);
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
  shared.Request = { request: request, headers: headers, getToken: getToken, query: query, unauthorized: unauthorized, requiresLogin: requiresLogin };
})(typeof window !== 'undefined' ? window : globalThis);

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
    error: function (error) {
      var message = error && (error.message || error.msg) || '操作暂时失败，请稍后重试';
      return /魔方云|idcsmart|mf_cloud|mf_dcim|SQLSTATE|stack trace|\/www\/|\.php:\d|upstream|provider|curl error/i.test(message) ? '服务暂时不可用，请稍后重试或联系客服' : message;
    }
  };
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
  if(access)return Promise.resolve(access);
  // The website may probe a saved login while remaining publicly accessible.
  // Member pages require a login; public cart/auth pages are exempted by Request.
  if(!pending){var ticket=generation;pending=shared.Request.request('/theme/access',{unauthorized:shared.theme==='website'?'notify':'redirect'}).then(function(r){if(savedToken!==token||ticket!==generation)throw new Error('账户状态已改变，请重新加载');access=r.data;root.__CRA1_ACCESS__=access;return access}).catch(function(e){if(ticket===generation)pending=null;throw e});}
  return pending;
 }};
 root.document.addEventListener('api:unauthorized',function(){invalidate();savedToken=''});
})(window);

(function(root){
 var shared=root.CRA1Shared=root.CRA1Shared||{},dictionary={"保存":{"en-us":"Save","zh-hk":"儲存"},"提交":{"en-us":"Submit","zh-hk":"提交"},"取消":{"en-us":"Cancel","zh-hk":"取消"},"验证":{"en-us":"Verification","zh-hk":"驗證"},"姓名":{"en-us":"Name","zh-hk":"姓名"},"语言":{"en-us":"Language","zh-hk":"語言"},"公司":{"en-us":"Company","zh-hk":"公司"},"国家":{"en-us":"Country","zh-hk":"國家"},"地址":{"en-us":"Address","zh-hk":"地址"},"手机":{"en-us":"Mobile Phone","zh-hk":"手機"},"邮箱":{"en-us":"Email","zh-hk":"郵箱"},"密码":{"en-us":"Password","zh-hk":"密碼"},"描述":{"en-us":"Description","zh-hk":"描述"},"创建时间":{"en-us":"Created Time","zh-hk":"創建時間"},"新密码":{"en-us":"New Password","zh-hk":"新密碼"},"确认密码":{"en-us":"Confirm password","zh-hk":"確認密碼"},"验证码":{"en-us":"Verification code","zh-hk":"驗證碼"},"概要":{"en-us":"Summary","zh-hk":"概要"},"操作日志":{"en-us":"Activity logs","zh-hk":"操作日誌"},"账户信息":{"en-us":"Account","zh-hk":"帳號資訊"},"请输入操作密码":{"en-us":"Please enter operation password","zh-hk":"請輸入操作密碼"},"操作密码":{"en-us":"Operation Password","zh-hk":"操作密碼"},"设置操作密码":{"en-us":"Set operation password","zh-hk":"設定操作密碼"},"短信":{"en-us":"SMS","zh-hk":"簡訊"},"邮件":{"en-us":"Email","zh-hk":"郵件"},"全部":{"en-us":"All","zh-hk":"全部"},"忘记密码":{"en-us":"Forgot password","zh-hk":"忘記密碼"},"邮箱验证码":{"en-us":"Email Verification Code","zh-hk":"郵箱驗證碼"},"手机验证码":{"en-us":"Mobile Verification Code","zh-hk":"手機驗證碼"},"请输入新手机号":{"en-us":"Please enter your new phone number","zh-hk":"請輸入新手機號碼"},"使用邮箱":{"en-us":"Use email","zh-hk":"使用郵件"},"请输入新邮箱":{"en-us":"Please enter your new email address","zh-hk":"請輸入新信箱"},"实名认证":{"en-us":"Real-name authentication","zh-hk":"實名認證"},"请输入验证码":{"en-us":"Please enter the verification code","zh-hk":"請輸入驗證碼"},"请输入密码":{"en-us":"Please enter your password","zh-hk":"請輸入密碼"},"账户":{"en-us":"Account","zh-hk":"帳戶"},"绑定手机号":{"en-us":"Bind mobile phone number","zh-hk":"綁定手機號碼"},"绑定邮箱":{"en-us":"Bind Email","zh-hk":"綁定信箱"},"关键字":{"en-us":"Keyword","zh-hk":"關鍵字"},"附件":{"en-us":"Attachment","zh-hk":"附件"},"请输入邮箱":{"en-us":"Please enter your email address","zh-hk":"請輸入信箱"},"自动续费":{"en-us":"Auto renewal","zh-hk":"自動續費"},"区域":{"en-us":"Area","zh-hk":"區域"},"到期时间":{"en-us":"Expire Time","zh-hk":"到期時間"},"产品名称":{"en-us":"Product Name","zh-hk":"產品名稱"},"确定":{"en-us":"Confirm","zh-hk":"確定"},"购买":{"en-us":"purchase","zh-hk":"購買"},"购买流量包":{"en-us":"Buy data package","zh-hk":"購買流量包"},"操作":{"en-us":"operation","zh-hk":"操作"},"商品名称":{"en-us":"商品名称","zh-hk":"商品名称"},"批量续费":{"en-us":"Batch Renewal","zh-hk":"大量續約"},"确认":{"en-us":"Confirm","zh-hk":"確認"},"周期":{"en-us":"Cycle","zh-hk":"週期"},"金额":{"en-us":"Amount","zh-hk":"金額"},"结果":{"en-us":"Results","zh-hk":"結果"},"实例":{"en-us":"Instances","zh-hk":"實例"},"计费方式":{"en-us":"Billing cycle","zh-hk":"計費方式"},"按需计费":{"en-us":"Charge on demand","zh-hk":"按需計費"},"包年包月":{"en-us":"Monthly or annual","zh-hk":"包年包月"},"基础信息":{"en-us":"Instance details","zh-hk":"基礎信息"},"数据中心筛选":{"en-us":"Data center filter","zh-hk":"數據中心篩選"},"端口":{"en-us":"Port","zh-hk":"連接埠"},"年":{"en-us":"Year","zh-hk":"年"},"必填":{"en-us":"Required","zh-hk":"必填"},"格式错误":{"en-us":"Format error","zh-hk":"格式錯誤"},"删除安全组":{"en-us":"Delete security group","zh-hk":"刪除安全群組"},"小时":{"en-us":"hours","zh-hk":"小時"},"流量":{"en-us":"Flow","zh-hk":"流量"},"按需续费":{"en-us":"Renew on demand","zh-hk":"按需續費"},"按需转包年包月":{"en-us":"On-demand transfer to annual or monthly subscription","zh-hk":"按需轉包年包月"},"编辑":{"en-us":"Edit","zh-hk":"編輯"},"编辑安全组":{"en-us":"Edit Security Group","zh-hk":"編輯安全群組"},"充值":{"en-us":"Top-up","zh-hk":"儲值"},"提现":{"en-us":"Withdraw","zh-hk":"提現"},"去支付":{"en-us":"Go to pay","zh-hk":"去付款"},"删除订单":{"en-us":"Delete order","zh-hk":"刪除訂單"},"提现记录":{"en-us":"Withdrawal Record","zh-hk":"提現記錄"},"待上传":{"en-us":"To be uploaded","zh-hk":"待上傳"},"待审核":{"en-us":"Pending Review","zh-hk":"待審核"},"未通过":{"en-us":"Failed","zh-hk":"未通過"},"上传凭证":{"en-us":"Upload credentials","zh-hk":"上傳憑證"},"重新上传":{"en-us":"Re-upload","zh-hk":"重新上傳"},"提交申请":{"en-us":"Submit request","zh-hk":"提交申請"},"点击上传":{"en-us":"Click to upload","zh-hk":"點擊上傳"},"查看凭证":{"en-us":"View Credentials","zh-hk":"查看憑證"},"产品标识":{"en-us":"Product Identification","zh-hk":"產品識別"},"交易记录":{"en-us":"Transactions","zh-hk":"交易記錄"},"复制":{"en-us":"Copy","zh-hk":"複製"},"产品信息":{"en-us":"Product Information","zh-hk":"產品資訊"},"时间":{"en-us":"Time","zh-hk":"時間"},"状态":{"en-us":"Status","zh-hk":"狀態"},"支付方式":{"en-us":"Payment method","zh-hk":"付款方式"},"交易流水号":{"en-us":"Transaction Serial Number","zh-hk":"交易流水號"},"备注":{"en-us":"Notes","zh-hk":"備註"},"类型":{"en-us":"Type","zh-hk":"類型"},"标识":{"en-us":"Logo","zh-hk":"標識"},"提现方式":{"en-us":"Withdrawal method","zh-hk":"提現方式"},"账号":{"en-us":"Account","zh-hk":"帳號"},"银行卡号":{"en-us":"Bank account number","zh-hk":"銀行卡號"},"提现金额":{"en-us":"Withdrawal amount","zh-hk":"提現金金額"},"充值金额":{"en-us":"Amount","zh-hk":"儲值金額"},"订单类型":{"en-us":"Order Type","zh-hk":"訂單類型"},"合并订单":{"en-us":"Merge Orders","zh-hk":"合併訂單"},"还款订单":{"en-us":"Repayment Order","zh-hk":"還款訂單"},"订单记录":{"en-us":"Orders","zh-hk":"訂單記錄"},"余额记录":{"en-us":"Balance history","zh-hk":"餘額記錄"},"当前余额":{"en-us":"Current balance","zh-hk":"當前餘額"},"未付款":{"en-us":"Unpaid","zh-hk":"未付款"},"已付款":{"en-us":"Paid","zh-hk":"已付款"},"余额":{"en-us":"Account Credit","zh-hk":"餘額"},"退款":{"en-us":"Refund","zh-hk":"退款"},"新订单":{"en-us":"New Order","zh-hk":"新訂單"},"续费订单":{"en-us":"Renewal Order","zh-hk":"續費訂單"},"人工订单":{"en-us":"Manual Order","zh-hk":"手動訂單"},"充值订单":{"en-us":"Recharge Order","zh-hk":"儲值訂單"},"已退款":{"en-us":"Refunded","zh-hk":"已退款"},"至":{"en-us":"To","zh-hk":"至"},"搜索":{"en-us":"Search","zh-hk":"搜尋"},"查看":{"en-us":"View","zh-hk":"查看"},"下载":{"en-us":"Download","zh-hk":"下載"},"到期":{"en-us":"Expiration","zh-hk":"到期"},"消费记录":{"en-us":"Consumption Record","zh-hk":"消費記錄"},"还款":{"en-us":"Repayment","zh-hk":"還款"},"单号":{"en-us":"Order Number","zh-hk":"單號"},"关闭":{"en-us":"Close","zh-hk":"關閉"},"请输入":{"en-us":"Please enter","zh-hk":"請輸入"},"支付时间":{"en-us":"Payment Time","zh-hk":"付款時間"},"开通中":{"en-us":"Opening","zh-hk":"開通中"},"使用中":{"en-us":"In Use","zh-hk":"使用中"},"暂停":{"en-us":"Pause","zh-hk":"暫停"},"删除":{"en-us":"Delete","zh-hk":"刪除"},"开通失败":{"en-us":"Activation failed","zh-hk":"開通失敗"},"已失效":{"en-us":"Expired","zh-hk":"已失效"},"已逾期":{"en-us":"Expired","zh-hk":"已逾期"},"已暂停":{"en-us":"Suspended","zh-hk":"已暫停"},"待打款":{"en-us":"Waiting for payment","zh-hk":"待打款"},"审核驳回":{"en-us":"Review Rejected","zh-hk":"審核駁回"},"已打款":{"en-us":"Payment has been transferred","zh-hk":"已打款"},"审核中":{"en-us":"Under review","zh-hk":"審核中"},"银行卡":{"en-us":"Bank Card","zh-hk":"銀行卡"},"等":{"en-us":"Wait","zh-hk":"等"},"冻结记录":{"en-us":"Frozen balance","zh-hk":"凍結記錄"},"冻结":{"en-us":"Freeze","zh-hk":"凍結"},"解冻":{"en-us":"Thaw","zh-hk":"解凍"},"财务":{"en-us":"Finance","zh-hk":"財務"},"订单详情":{"en-us":"Order Details","zh-hk":"訂單詳情"},"申请提现":{"en-us":"Request withdrawal","zh-hk":"申請提現"},"免费":{"en-us":"Free","zh-hk":"免費"},"满":{"en-us":"Full","zh-hk":"滿"},"减":{"en-us":"reduction","zh-hk":"減"},"统计":{"en-us":"Statistics","zh-hk":"統計"},"未支付订单":{"en-us":"Unpaid orders","zh-hk":"未繳單"},"产品列表":{"en-us":"Product List","zh-hk":"產品清單"},"产品名":{"en-us":"Product Name","zh-hk":"產品名稱"},"首页":{"en-us":"Home","zh-hk":"首頁"},"详情":{"en-us":"Details","zh-hk":"詳情"},"预览":{"en-us":"Preview","zh-hk":"預覽"},"正常":{"en-us":"Normal","zh-hk":"正常"},"防御":{"en-us":"Defense","zh-hk":"防禦"},"当前防御":{"en-us":"Current Defense","zh-hk":"目前防禦"},"即将离开":{"en-us":"About to leave","zh-hk":"即將離開"},"继续访问":{"en-us":"Continue to visit","zh-hk":"繼續訪問"},"登录":{"en-us":"Sign in","zh-hk":"登入"},"验证码登录":{"en-us":"Code login","zh-hk":"驗證碼登入"},"密码登录":{"en-us":"Password login","zh-hk":"密碼登入"},"阅读并同意":{"en-us":"Read and agree","zh-hk":"閱讀並同意"},"注册":{"en-us":"Sign up","zh-hk":"註冊"},"会员中心":{"en-us":"Member Center","zh-hk":"會員中心"},"订购产品":{"en-us":"Ordered Products","zh-hk":"訂購產品"},"暂无商品":{"en-us":"No goods","zh-hk":"暫無商品"},"返回":{"en-us":"Return","zh-hk":"返回"},"关联账户":{"en-us":"Link account","zh-hk":"關聯帳號"},"三方登录":{"en-us":"Three-party login","zh-hk":"三方登入"},"关联":{"en-us":"Association","zh-hk":"關聯"},"一次性":{"en-us":"one-time","zh-hk":"一次性"},"已支付":{"en-us":"Paid","zh-hk":"已支付"},"余额支付":{"en-us":"Balance Payment","zh-hk":"餘額支付"},"总额":{"en-us":"Total amount","zh-hk":"總額"},"交易流水":{"en-us":"Transaction flow","zh-hk":"交易流水"},"暂无数据":{"en-us":"No data","zh-hk":"暫無資料"},"人工":{"en-us":"Manual","zh-hk":"人工"},"应付金额":{"en-us":"Amount due","zh-hk":"應付金額"},"线下支付":{"en-us":"Offline payment","zh-hk":"線下付款"},"应付":{"en-us":"Payable","zh-hk":"應付"},"订单号":{"en-us":"Order Number","zh-hk":"訂單號碼"},"请选择":{"en-us":"Please select","zh-hk":"請選擇"},"端口范围":{"en-us":"Port range","zh-hk":"連接埠範圍"},"即将到期":{"en-us":"Expiring Soon","zh-hk":"即將到期"},"已删除":{"en-us":"Deleted","zh-hk":"已刪除"},"宽限":{"en-us":"Grace","zh-hk":"寬限"},"保留":{"en-us":"Reserved","zh-hk":"保留"},"协议":{"en-us":"Protocol","zh-hk":"協議"},"和":{"en-us":"和","zh-hk":"和"},"开启":{"en-us":"Enable","zh-hk":"開啟"},"关联实例":{"en-us":"Relation Instance","zh-hk":"關聯實例"},"规则":{"en-us":"rules","zh-hk":"規則"},"查询":{"en-us":"Query","zh-hk":"查詢"},"创建密钥":{"en-us":"Create key","zh-hk":"建立金鑰"},"设置":{"en-us":"Settings","zh-hk":"設定"},"我已保存":{"en-us":"I have saved","zh-hk":"我已儲存"},"确认删除":{"en-us":"Confirm deletion","zh-hk":"確認刪除"},"全部复制":{"en-us":"Copy all","zh-hk":"全部複製"},"安全组":{"en-us":"Security groups","zh-hk":"安全群組"},"名称":{"en-us":"Name","zh-hk":"名稱"},"开启状态":{"en-us":"Open Status","zh-hk":"開啟狀態"},"公钥":{"en-us":"Public Key","zh-hk":"公鑰"},"私钥":{"en-us":"Private Key","zh-hk":"私鑰"},"指纹":{"en-us":"Fingerprint","zh-hk":"指紋"},"已开启":{"en-us":"Enabled","zh-hk":"已開啟"},"未开启":{"en-us":"Not enabled","zh-hk":"未開啟"},"开":{"en-us":"Open","zh-hk":"開"},"正确的":{"en-us":"Correct","zh-hk":"正確的"},"安全":{"en-us":"Security","zh-hk":"安全"},"获取验证码":{"en-us":"Send code","zh-hk":"取得驗證碼"},"数量":{"en-us":"Quantity","zh-hk":"數量"},"单价":{"en-us":"Unit price","zh-hk":"單價"},"请选择支付方式":{"en-us":"Please select payment method","zh-hk":"請選擇付款方式"},"合计":{"en-us":"Total","zh-hk":"合計"},"提交订单":{"en-us":"Submit order","zh-hk":"提交訂單"},"已阅读并同意":{"en-us":"Read and agree","zh-hk":"已閱讀並同意"},"结算":{"en-us":"Settlement","zh-hk":"結算"},"购物车":{"en-us":"Shopping Cart","zh-hk":"購物車"},"重试":{"en-us":"Retry","zh-hk":"重試"},"站内信":{"en-us":"Internal Message","zh-hk":"站內信"},"未读":{"en-us":"Unread","zh-hk":"未讀"},"请输入手机号":{"en-us":"Please enter your mobile number","zh-hk":"請輸入手機號碼"},"新购":{"en-us":"New purchase","zh-hk":"新購"},"续费":{"en-us":"Renew","zh-hk":"續費"},"添加":{"en-us":"Add","zh-hk":"新增"},"展开":{"en-us":"Expand","zh-hk":"展開"},"清空":{"en-us":"Clear","zh-hk":"清空"},"请先":{"en-us":"Please first","zh-hk":"請先"},"移除":{"en-us":"Remove","zh-hk":"移除"},"选择文件":{"en-us":"Select file","zh-hk":"選擇檔案"},"登录/注册":{"en-us":"Login/Register","zh-hk":"登入/註冊"},"提示":{"en-us":"Tips","zh-hk":"提示"},"共":{"en-us":"Total","zh-hk":"共"},"解绑":{"en-us":"Unbind","zh-hk":"解綁"},"长期有效":{"en-us":"Long-Term Validity","zh-hk":"長期有效"},"请选择提现方式":{"en-us":"Please select the withdrawal method","zh-hk":"請選擇提現方式"},"可提现":{"en-us":"Withdrawable","zh-hk":"可提現"},"不能低于":{"en-us":"cannot be lower than","zh-hk":"不能低於"},"不能超过":{"en-us":"cannot exceed","zh-hk":"不能超過"},"最低":{"en-us":"minimum","zh-hk":"最低"},"提现规则":{"en-us":"Withdrawal Rules","zh-hk":"提現規則"},"用户":{"en-us":"User","zh-hk":"用戶"},"去实名":{"en-us":"Remove real name","zh-hk":"去實名"},"有":{"en-us":"Yes","zh-hk":"有"},"查看全部":{"en-us":"View all","zh-hk":"看全部"},"永不":{"en-us":"Never","zh-hk":"永不"},"已使用":{"en-us":"Used","zh-hk":"已使用"},"已过期":{"en-us":"Expired","zh-hk":"已過期"},"支持":{"en-us":"Support","zh-hk":"支援"},"抵扣":{"en-us":"Deduction","zh-hk":"抵扣"},"赠送":{"en-us":"Gift","zh-hk":"贈送"},"最低充值":{"en-us":"Minimum recharge","zh-hk":"最低充值"},"选择支付方式":{"en-us":"Select payment method","zh-hk":"選擇付款方式"},"订单金额":{"en-us":"Order amount","zh-hk":"訂單金額"},"在线支付":{"en-us":"Online payment","zh-hk":"線上付款"},"选择":{"en-us":"Select","zh-hk":"選擇"},"使用":{"en-us":"Use","zh-hk":"使用"},"已选":{"en-us":"Selected","zh-hk":"已選"},"张":{"en-us":"Zhang","zh-hk":"張"},"可使用":{"en-us":"Available","zh-hk":"可使用"},"自动选择":{"en-us":"Auto select","zh-hk":"自動選擇"},"暂无可用":{"en-us":"Not available","zh-hk":"暫無可用"},"余额提醒":{"en-us":"Balance alert","zh-hk":"餘額提醒"},"时提醒":{"en-us":"Reminder when","zh-hk":"時提醒"},"获取":{"en-us":"Get","zh-hk":"獲取"},"立即开始":{"en-us":"Start now","zh-hk":"立即開始"},"当前商品":{"en-us":"Current Product","zh-hk":"目前商品"},"每":{"en-us":"Every","zh-hk":"每"},"天":{"en-us":"Daily","zh-hk":"天"},"个月":{"en-us":"Monthly","zh-hk":"個月"},"的":{"en-us":"of","zh-hk":"的"},"消费":{"en-us":"Consumption","zh-hk":"消費"},"累计消费":{"en-us":"Cumulative consumption","zh-hk":"累積消費"},"订购":{"en-us":"Order","zh-hk":"訂購"},"升降级":{"en-us":"Upgrade / Downgrade","zh-hk":"升降級"},"不限":{"en-us":"Unlimited","zh-hk":"不限"},"生效":{"en-us":"Effective","zh-hk":"生效"},"月":{"en-us":"Month","zh-hk":"月"},"日":{"en-us":"Day","zh-hk":"日"},"时":{"en-us":"Hour","zh-hk":"時"},"分":{"en-us":"Minute","zh-hk":"分"},"秒":{"en-us":"Second","zh-hk":"秒"},"上一页":{"en-us":"Previous","zh-hk":"上一頁"},"下一页":{"en-us":"Next","zh-hk":"下一頁"},"安全验证":{"en-us":"Security Verification","zh-hk":"安全驗證"},"限时流量":{"en-us":"Limited Traffic","zh-hk":"限時流量"},"不限时流量":{"en-us":"Unlimited Traffic","zh-hk":"不限時流量"},"有效":{"en-us":"Valid","zh-hk":"有效"},"失效":{"en-us":"Invalid","zh-hk":"失效"},"不限次数":{"en-us":"Unlimited","zh-hk":"不限次數"},"本月已达上限":{"en-us":"Monthly limit reached","zh-hk":"本月已達上限"},"本月可购":{"en-us":"Available this month: ","zh-hk":"本月可購"},"次":{"en-us":" times","zh-hk":"次"},"元":{"en-us":"元","zh-hk":"元"},"已取消":{"en-us":"Cancelled","zh-hk":"已取消"},"取消退订":{"en-us":"Cancel Unsubscription","zh-hk":"取消退訂"},"确认退订":{"en-us":"Confirm Unsubscription","zh-hk":"確認退訂"},"申请":{"en-us":"Applied","zh-hk":"申請"},"到期后":{"en-us":"After Expiry","zh-hk":"到期後"},"于":{"en-us":"At","zh-hk":"於"},"失败":{"en-us":"Failed","zh-hk":"失敗"},"退订":{"en-us":"Cancel service","zh-hk":"退訂"},"立即":{"en-us":"Immediately","zh-hk":"立即"},"手续费":{"en-us":"Service Fee","zh-hk":"手續費"},"退款方式":{"en-us":"Refund method","zh-hk":"退款方式"},"注意":{"en-us":"Notice","zh-hk":"注意"},"优惠码":{"en-us":"Promo Code","zh-hk":"優惠碼"},"是":{"en-us":"Yes","zh-hk":"是"},"否":{"en-us":"No","zh-hk":"否"},"已重置":{"en-us":"Used","zh-hk":"已重置"},"可用":{"en-us":"Available","zh-hk":"可用"},"已购":{"en-us":"Purchased","zh-hk":"已購"},"购买次数":{"en-us":"Quantity","zh-hk":"購買次數"},"产品管理":{"en-us":"Products"},"财务中心":{"en-us":"Billing"},"安全中心":{"en-us":"Security"},"我的产品":{"en-us":"My products"},"管理":{"en-us":"Manage"},"续费待办":{"en-us":"Renewals"},"最近访问":{"en-us":"Recently visited"},"提交工单":{"en-us":"Open a ticket"},"浏览产品":{"en-us":"Browse products"},"基本资料":{"en-us":"Profile"},"安全设置":{"en-us":"Security settings"},"我的订单":{"en-us":"My orders"},"保存资料":{"en-us":"Save profile"},"国家或地区":{"en-us":"Country or region"},"显示语言":{"en-us":"Language"},"通知偏好":{"en-us":"Notifications"},"接收通知":{"en-us":"Receive notifications"},"关闭通知":{"en-us":"Disable notifications"},"通知方式":{"en-us":"Notification channel"},"邮件和短信":{"en-us":"Email and SMS"},"余额与流量提醒":{"en-us":"Balance and traffic alerts"},"重新读取":{"en-us":"Retry"},"手机号":{"en-us":"Phone number"},"邮箱登录":{"en-us":"Email login"},"手机登录":{"en-us":"Phone login"},"注册账户":{"en-us":"Create an account"},"重置密码":{"en-us":"Reset password"},"返回登录":{"en-us":"Back to sign in"},"服务条款":{"en-us":"Terms of service"},"隐私政策":{"en-us":"Privacy policy"},"用户名":{"en-us":"Username"},"默认":{"en-us":"Default"},"查看日志":{"en-us":"View logs"},"应用管理":{"en-us":"Applications"},"安装应用":{"en-us":"Install application"},"暂无安装任务":{"en-us":"No installation tasks"},"查看凭据":{"en-us":"View credentials"},"安装日志":{"en-us":"Installation logs"},"应用凭据":{"en-us":"Application credentials"},"卸载应用":{"en-us":"Uninstall application"},"重新安装":{"en-us":"Reinstall"},"重装系统":{"en-us":"Reinstall OS"},"开机":{"en-us":"Power on"},"关机":{"en-us":"Power off"},"重启":{"en-us":"Restart"},"实例操作":{"en-us":"Instance actions"},"登录信息":{"en-us":"Login details"},"概览":{"en-us":"Overview"},"监控":{"en-us":"Monitoring"},"网络":{"en-us":"Network"},"磁盘":{"en-us":"Disks"},"编辑备注":{"en-us":"Edit notes"},"余额充值":{"en-us":"Add funds"},"充值信息":{"en-us":"Payment summary"},"立即充值":{"en-us":"Add funds"},"收款人姓名":{"en-us":"Account holder"},"收款账号":{"en-us":"Recipient account"},"页面暂时无法加载，请刷新重试":{"en-us":"Unable to load this page. Please refresh and try again."},"已开通":{"en-us":"Active"},"到期停用":{"en-us":"Cancel at expiry"},"立即停用":{"en-us":"Cancel immediately"},"配置管理":{"en-us":"Configuration"},"所有分类":{"en-us":"All categories"},"重新加载":{"en-us":"Reload","zh-hk":"重新載入"}};
 shared.I18n={t:function(text){if(typeof text!=='string')return text;var lang;try{lang=root.localStorage.getItem('lang')}catch(e){}lang=lang||root.__CRA1_RUNTIME__?.locale?.current||'zh-cn';return dictionary[text]?.[lang]||text;}};
})(window);

/* Bridge React and Vue to the existing theme-owned native V10 cashier. */
(function (root) {
  'use strict';
  var shared=root.CRA1Shared=root.CRA1Shared||{}, loads=root.__CRA1_SCRIPT_LOADS__=root.__CRA1_SCRIPT_LOADS__||{}, current=null;
  function load(src) {
    if (loads[src]) return loads[src];
    loads[src]=new Promise(function(resolve,reject){
      var script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=function(){delete loads[src];script.remove();reject(new Error('支付组件加载失败，请重试'));};document.head.appendChild(script);
    });return loads[src];
  }
  shared.Payments={open:function(options){
    if(!/^[1-9]\d*$/.test(String(options.orderId)))throw new Error('订单信息无效');
    if(current)current.close();
    var vm=null,holder=null,closed=false;
    var returnFocus=document.activeElement;
    function cleanup(){if(vm){vm.$destroy();vm=null}if(holder){holder.remove();holder=null}document.removeEventListener('api:unauthorized',cancel);if(current===handle)current=null;if(returnFocus&&returnFocus.isConnected&&returnFocus.focus)returnFocus.focus()}
    function cancel(){if(closed)return;closed=true;try{if(vm&&vm.$refs.cashier)vm.$refs.cashier.zfClose()}finally{cleanup();options.onCancel&&options.onCancel()}}
    var handle={close:cancel,ready:null};current=handle;
    handle.ready=(async function(){
      try {
        if(!root.Vue)throw new Error('支付组件未就绪，请刷新后重试');
        var base=root.__CRA1_PAYMENT_BASE__||'/clientarea/template/pc/cra1';
        var cssHref=base+'/css/finance.css';if(!document.querySelector('link[data-cra1-cashier-style]')){var link=document.createElement('link');link.rel='stylesheet';link.href=cssHref;link.setAttribute('data-cra1-cashier-style','');document.head.appendChild(link)}
        if(!root.jQuery)await load('/clientarea/template/pc/default/js/common/jquery.mini.js');
        if(typeof orderDetails==='undefined'||typeof pay==='undefined')await load(base+'/api/finance.js');
        if(typeof payDialog==='undefined')await load(base+'/components/payDialog/payDialog.js');
        if(closed)return;
        holder=document.createElement('div');holder.setAttribute('data-cra1-cashier','');document.body.appendChild(holder);
        vm=new root.Vue({render:function(h){return h(payDialog,{ref:'cashier',on:{payok:function(id){if(closed||String(id)!==String(options.orderId))return;closed=true;cleanup();options.onPaid&&options.onPaid(id)},paypending:function(id){if(closed)return;closed=true;cleanup();options.onUpdated&&options.onUpdated(id);options.onCancel&&options.onCancel()},paycancel:cancel}})}}).$mount(holder);
        holder=vm.$el;
        document.addEventListener('api:unauthorized',cancel);
        await vm.$nextTick();
        if(!closed)await vm.$refs.cashier.showPayDialog(Number(options.orderId));
      }catch(error){if(!closed){closed=true;cleanup();throw error}}
    })();
    return handle;
  }};
})(window);

/* One verification dialog for React, Vue and the public/cart login surfaces. */
(function (root) {
  'use strict';
  var shared = root.CRA1Shared = root.CRA1Shared || {};
  if (shared.Security) return;
  var current = null, expiry = 0, expiryToken = '', captchaPromise = null;
  function cancelled() { var error = new Error('已取消安全验证，操作未执行'); error.code = 'SECURITY_CANCELLED'; return error; }
  function token() { return shared.Request.getToken(); }
  function sessionChanged() { var error = new Error('登录状态已变化，请重新发起操作'); error.code = 'SECURITY_SESSION_CHANGED'; return error; }
  function guard(expected, signal) { if (token() !== expected) throw sessionChanged(); if (signal && signal.aborted) throw cancelled(); }
  function dialogHost() {
    var parents = root.document.querySelectorAll('.cui-dialog[data-state="open"], [role="menu"][data-state="open"]');
    return parents[parents.length - 1] || root.document.body;
  }
  function challenge(envelope) {
    var data = envelope && envelope.data || {};
    if (data.security_verification) return data.security_verification;
    if (data.need_security_verify && Array.isArray(data.available_methods)) return { kind: 'identity', methods: data.available_methods };
    if (Number(data.operate_password) === 1) return { kind: 'operation', scene: 'operation', methods: [{ value: 'operate_password', label: '操作密码' }] };
    return null;
  }
  function remember(value) {
    expiry = Number(value) || 0;
    expiryToken = token();
    root.document.dispatchEvent(new CustomEvent('cra1:verification', { detail: { expiresAt: expiry } }));
  }
  function el(tag, text, attrs) {
    var node = root.document.createElement(tag);
    if (text) node.textContent = text;
    Object.keys(attrs || {}).forEach(function (name) { node.setAttribute(name, attrs[name]); });
    return node;
  }
  // Radix listens for Escape on document capture. Handle our native top-layer
  // dialog at window capture first so the underlying form/menu stays open.
  root.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var dialog = event.target && event.target.closest && event.target.closest('.cra1-security-dialog[open]');
    if (!dialog) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (dialog.querySelector('[data-cra1-captcha]') && typeof root.captchaCheckCancel === 'function') root.captchaCheckCancel();
    else dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  }, true);
  function openCaptcha(options) {
    options = options || {};
    if (captchaPromise) return captchaPromise;
    captchaPromise = (async function () {
      if (!root.jQuery) await new Promise(function (resolve, reject) {
        var script = el('script', '', { src: '/clientarea/template/pc/default/js/common/jquery.mini.js' });
        script.onload = resolve; script.onerror = function () { script.remove(); reject(new Error('验证组件加载失败，请重试')); }; root.document.head.appendChild(script);
      });
      if (options.signal && options.signal.aborted) return null;
      var response = await shared.Request.request('/captcha', { securityHandled: true });
      if (options.signal && options.signal.aborted) return null;
      if (!response.data || !response.data.html) throw new Error('未获取到图形验证码，请重试');
      return new Promise(function (resolve, reject) {
        var host = root.document.querySelector('.cra1-security-dialog[open]') || dialogHost();
        var holder = el('div', '', { 'data-cra1-captcha': '' });
        var previousSuccess = root.captchaCheckSuccsss, previousCancel = root.captchaCheckCancel;
        var timeout, settled = false, pendingScript = null;
        function finish(result, error) {
          if (settled) return; settled = true;
          root.clearTimeout(timeout); holder.remove();
          if (options.signal) options.signal.removeEventListener('abort', cancelCaptcha);
          if (pendingScript) { pendingScript.onload = pendingScript.onerror = null; pendingScript.remove(); }
          if (root.captchaCheckSuccsss === succeedCaptcha) root.captchaCheckSuccsss = previousSuccess;
          if (root.captchaCheckCancel === cancelCaptcha) root.captchaCheckCancel = previousCancel;
          if (error) reject(error); else resolve(result);
        }
        function succeedCaptcha(ok, code, token) { if (ok) finish({ code: code, token: token }); }
        function cancelCaptcha() { finish(null); }
        root.captchaCheckSuccsss = succeedCaptcha;
        root.captchaCheckCancel = cancelCaptcha;
        host.appendChild(holder); holder.innerHTML = response.data.html;
        timeout = root.setTimeout(function () { finish(null); }, 300000);
        if (options.signal) options.signal.addEventListener('abort', cancelCaptcha, { once: true });
        // Native CAPTCHA HTML can depend on several external scripts. Execute
        // them in document order and reuse only the already-loaded jQuery.
        (async function () {
          var scripts = Array.from(holder.querySelectorAll('script'));
          for (var original of scripts) {
            if (settled || !holder.isConnected) return;
            if (original.src && /\/jquery(?:[./-]|$)/i.test(original.src) && root.jQuery) { original.remove(); continue; }
            var script = root.document.createElement('script');
            if (original.src) {
              await new Promise(function (loaded, failed) {
                pendingScript = script; script.async = false; script.src = original.src;
                script.onload = function () { pendingScript = null; loaded(); };
                script.onerror = function () { pendingScript = null; failed(new Error('验证组件加载失败，请重试')); };
                original.replaceWith(script);
              });
            } else { script.textContent = original.textContent; original.replaceWith(script); }
          }
        })().catch(function () { finish(null, new Error('验证组件加载失败，请重试')); });
      });
    })();
    captchaPromise.finally(function () { captchaPromise = null; }).catch(function () {});
    return captchaPromise;
  }
  function perform(envelope, submit, options) {
    var config = challenge(envelope);
    if (!config) return Promise.reject(new Error('未收到有效的验证要求'));
    options = options || {};
    var expectedToken = options.token === undefined ? token() : options.token;
    try { guard(expectedToken, options.signal); } catch (error) { return Promise.reject(error); }
    // Serialize prompts. A later request retries after the first grant; OTP proofs are never shared.
    if (current) return current.then(function () { guard(expectedToken, options.signal); return submit({}); }).catch(function (error) {
      if (challenge(error.data)) return perform(error.data, submit, options);
      throw error;
    });
    var task = new Promise(function (resolve, reject) {
      var previous = root.document.activeElement, active = true, busy = false, sending = false;
      var timer = null, polling = null, cert = '', methodGeneration = 0, captchaAbort = new AbortController();
      var dialog = el('dialog', '', { 'class': 'cra1-security-dialog', 'aria-labelledby': 'cra1-security-title', 'aria-describedby': 'cra1-security-description' });
      var form = el('form'), title = el('h2', '安全验证', { id: 'cra1-security-title' });
      var description = el('p', config.kind === 'operation' ? '验证成功后，当前登录十五分钟内无需重复输入操作密码。' : '请完成当前操作要求的身份验证，无需重复输入操作密码。', { id: 'cra1-security-description' });
      var methodLabel = el('label', '验证方式', { 'for': 'cra1-security-method' });
      var select = el('select', '', { id: 'cra1-security-method' });
      var methods = (config.methods || []).filter(function (item) { return ['operate_password', 'phone_code', 'email_code', 'certification'].indexOf(item.value) >= 0; });
      methods.forEach(function (method) { select.appendChild(el('option', method.label || ({ operate_password: '操作密码', phone_code: '短信验证码', email_code: '邮箱验证码', certification: '实名验证' })[method.value], { value: method.value })); });
      var tip = el('p', '', { 'class': 'cra1-security-tip' });
      var fieldLabel = el('label', '', { 'for': 'cra1-security-value' });
      var row = el('div', '', { 'class': 'cra1-security-code' });
      var input = el('input', '', { id: 'cra1-security-value', autocomplete: 'off', required: 'required' });
      var send = el('button', '发送验证码', { type: 'button' });
      var certification = el('div', '', { 'class': 'cra1-security-certification' });
      var errorBox = el('p', '', { role: 'alert', 'class': 'cra1-security-error' });
      var footer = el('div', '', { 'class': 'cra1-security-footer' });
      var cancel = el('button', '取消', { type: 'button' }), confirm = el('button', '验证并继续', { type: 'submit', 'class': 'cra1-security-primary' });
      row.append(input, send); footer.append(cancel, confirm);
      form.append(title, description, methodLabel, select, tip, fieldLabel, row, certification, errorBox, footer); dialog.appendChild(form);
      // Inside an existing Radix dialog keeps its focus scope and aria tree intact.
      dialogHost().appendChild(dialog);
      dialog.style.pointerEvents = 'auto';
      root.document.dispatchEvent(new CustomEvent('cra1:security-dialog', { detail: { open: true } }));
      function method() { return methods.find(function (item) { return item.value === select.value; }) || {}; }
      function cleanup() {
        active = false; methodGeneration++; root.clearInterval(timer); root.clearTimeout(polling);
        captchaAbort.abort();
        if (dialog.querySelector('[data-cra1-captcha]') && typeof root.captchaCheckCancel === 'function') root.captchaCheckCancel();
        if (options.signal) options.signal.removeEventListener('abort', abort);
        input.value = ''; cert = ''; dialog.close(); dialog.remove();
        root.document.dispatchEvent(new CustomEvent('cra1:security-dialog', { detail: { open: false } }));
        if (previous && previous.isConnected) previous.focus();
      }
      function abort() { if (!active || busy) return; cleanup(); reject(cancelled()); }
      // Follow the current page policy: expired member sessions go to login;
      // verification on public login/register pages stays on that page.
      function raw(path, body, methodName) { guard(expectedToken, options.signal); return shared.Request.request(path, { method: methodName || 'POST', body: body, securityHandled: true, signal: options.signal }); }
      function currentScene() { return config.scene || options.scene || 'exception_login'; }
      function setError(error) { errorBox.textContent = error && error.message || '验证失败，请重试'; }
      function refreshMethod() {
        methodGeneration++; root.clearInterval(timer); root.clearTimeout(polling); cert = ''; input.value = ''; errorBox.textContent = ''; certification.replaceChildren();
        var value = select.value, code = value === 'phone_code' || value === 'email_code';
        tip.textContent = method().tip || '';
        fieldLabel.textContent = code ? '验证码' : '操作密码';
        input.type = code ? 'text' : 'password'; input.inputMode = code ? 'numeric' : 'text'; input.maxLength = code ? 12 : 256;
        input.autocomplete = code ? 'one-time-code' : 'current-password'; input.placeholder = code ? '请输入验证码' : '请输入操作密码';
        row.hidden = value === 'certification'; fieldLabel.hidden = value === 'certification'; input.required = value !== 'certification';
        send.hidden = !code; send.disabled = false; send.textContent = '发送验证码';
        if (value === 'certification') startCertification();
        else root.setTimeout(function () { if (active) input.focus(); }, 0);
      }
      async function startCertification() {
        var generation = methodGeneration, item = method(); certification.textContent = '正在准备身份验证…';
        try {
          var isLogin = currentScene() === 'exception_login' || currentScene() === 'login';
          var certificationPath = isLogin ? '/login/exception/certification' : '/security/certification';
          var response = await raw(certificationPath + '/create', { account: item.account, phone_code: item.phone_code, security_verify_token: item.security_verify_token });
          if (!active || generation !== methodGeneration) return;
          var url = new URL(response.data.certify_url, root.location.origin);
          if (url.protocol !== 'https:' || url.username || url.password) throw new Error('身份验证地址无效，请联系客服');
          cert = response.data.certify_id;
          certification.replaceChildren(el('a', '打开身份验证页面', { href: url.href, target: '_blank', rel: 'noopener noreferrer' }), el('p', '请在新窗口完成验证后返回本窗口。'));
          async function poll() {
            try {
              guard(expectedToken, options.signal);
              var result = await shared.Request.request(certificationPath + '/status', { params: { account: item.account, phone_code: item.phone_code, security_verify_token: item.security_verify_token, certify_id: cert }, securityHandled: true, signal: options.signal });
              if (!active || generation !== methodGeneration) return;
              if (Number(result.data.verify_status) === 1) { certification.appendChild(el('p', '身份验证已通过，请点击“验证并继续”。')); return; }
              polling = root.setTimeout(poll, 3000);
            } catch (error) { if (active && generation === methodGeneration) setError(error); }
          }
          poll();
        } catch (error) { if (active && generation === methodGeneration) setError(error); }
      }
      send.addEventListener('click', async function () {
        if (sending || busy) return;
        sending = true; send.disabled = true; errorBox.textContent = '';
        var item = method(), isPhone = item.value === 'phone_code', generation = methodGeneration;
        var payload = { action: currentScene() };
        if (payload.action === 'exception_login') {
          if (isPhone) { payload.phone = item.account; payload.phone_code = item.phone_code; } else payload.email = item.account;
          payload.security_verify_token = item.security_verify_token;
        }
        try {
          if (config.captcha_required) {
            var graphical = await openCaptcha({ signal: captchaAbort.signal });
            if (!graphical) { send.disabled = false; return; }
            payload.captcha = graphical.code; payload.token = graphical.token;
          }
          if (!active || generation !== methodGeneration) return;
          guard(expectedToken, options.signal);
          await raw(isPhone ? '/phone/code' : '/email/code', payload);
          if (!active || generation !== methodGeneration) return;
          var seconds = 60; send.textContent = seconds + ' 秒后重发';
          timer = root.setInterval(function () { if (--seconds <= 0) { root.clearInterval(timer); send.disabled = false; send.textContent = '重新发送'; } else send.textContent = seconds + ' 秒后重发'; }, 1000);
        } catch (error) { if (active && generation === methodGeneration) { send.disabled = false; setError(error); } }
        finally { sending = false; }
      });
      form.addEventListener('submit', async function (event) {
        event.preventDefault(); if (busy || !methods.length) return;
        busy = true; confirm.disabled = true; cancel.disabled = true; select.disabled = true; input.disabled = true; errorBox.textContent = ''; confirm.textContent = '正在验证…';
        try {
          var proof = {};
          if (config.kind === 'operation') {
            var verified = await raw('/cra1-theme/security/operation/verify', { password: input.value, scene: currentScene() });
            guard(expectedToken, options.signal);
            remember(verified.data.expires_at);
          } else if (config.kind === 'native_code') proof.code = input.value;
          else proof = { security_verify_method: select.value, security_verify_value: input.value, security_verify_token: method().security_verify_token || '', certify_id: cert };
          guard(expectedToken, options.signal);
          var result = await submit(proof);
          guard(expectedToken, options.signal);
          cleanup(); resolve(result);
        } catch (error) {
          if (active) {
            setError(error);
            if (error.status === 401 || ['CANCELLED','SECURITY_CANCELLED','SECURITY_SESSION_CHANGED'].indexOf(error.code) >= 0) { cleanup(); reject(error); }
          }
        } finally {
          busy = false;
          if (active) { confirm.disabled = false; cancel.disabled = false; select.disabled = false; input.disabled = false; confirm.textContent = '验证并继续'; input.focus(); }
        }
      });
      cancel.addEventListener('click', abort); select.addEventListener('change', refreshMethod);
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); abort(); });
      dialog.addEventListener('keydown', function (event) { event.stopPropagation(); });
      if (options.signal) options.signal.addEventListener('abort', abort, { once: true });
      if (options.signal && options.signal.aborted) { abort(); return; }
      dialog.showModal(); refreshMethod();
      if (!methods.length) { confirm.disabled = true; errorBox.textContent = '没有可用的验证方式，请完善账户安全设置或联系客服'; }
    });
    current = task;
    task.finally(function () { if (current === task) current = null; }).catch(function () {});
    return task;
  }
  function setup(envelope) {
    var data = envelope && envelope.data;
    return data && data.setup_required ? { url: '/account.htm?tab=security&section=operate_password' } : null;
  }
  function requireSetup(envelope, options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      var previous = root.document.activeElement;
      var dialog = el('dialog', '', { 'class': 'cra1-security-dialog', 'aria-label': '设置操作密码' });
      var title = el('h2', '请先设置操作密码'), text = el('p', '当前操作需要操作密码。请前往账户安全设置完成设置，再返回继续。');
      var footer = el('div', '', { 'class': 'cra1-security-footer' }), close = el('button', '返回', { type: 'button' });
      footer.append(close, el('a', '前往安全设置', { href: '/account.htm?tab=security&section=operate_password', target: '_blank', rel: 'noopener noreferrer', 'class': 'cra1-security-setup' }));
      dialog.append(title, text, footer); dialogHost().appendChild(dialog); dialog.style.pointerEvents = 'auto';
      function finish() { if (options.signal) options.signal.removeEventListener('abort', finish); dialog.close(); dialog.remove(); if (previous && previous.isConnected) previous.focus(); reject(cancelled()); }
      close.onclick = finish; dialog.addEventListener('cancel', function (event) { event.preventDefault(); finish(); });
      dialog.addEventListener('keydown', function (event) { event.stopPropagation(); }); dialog.showModal(); close.focus();
      if (options.signal) { if (options.signal.aborted) finish(); else options.signal.addEventListener('abort', finish, { once: true }); }
    });
  }
  // Legacy module templates get an on-demand credential viewer without editing
  // their bundled business scripts or preloading passwords with ordinary detail.
  async function viewCredentials(path, params, options) {
    options = options || {};
    var expected = token(), response = await shared.Request.request(path, { params: params, signal: options.signal });
    guard(expected, options.signal); var data = response.data || {}, until = Number(data.verification_expires_at) * 1000;
    var rows = [['用户名', data.username], ['密码', data.password], ['端口', data.port], ['面板密码', data.panel_pass]]
      .filter(function (row) { return row[1] !== undefined && row[1] !== null && row[1] !== ''; });
    var dialog = el('dialog', '', { 'class': 'cra1-security-dialog', 'aria-label': '登录信息' }), shown = false, timeout;
    dialog.append(el('h2', '登录信息'), el('p', '点击信息可复制，关闭窗口后清除本次读取的内容。'));
    var list = el('div'), note = el('p', '', { role: 'status' });
    function valid() { return token() === expected && (!until || Date.now() < until); }
    function clear() { rows = []; data = {}; response = null; root.clearTimeout(timeout); if (options.signal) options.signal.removeEventListener('abort', clear); dialog.close(); dialog.remove(); }
    function expire() { clear(); shared.UI.toast('安全验证已过期，请重新读取登录信息', 'info'); }
    async function copy(value) { if (!valid()) return expire(); var ok = await shared.UI.copy(value); note.textContent = ok ? '已复制' : '复制失败，请重试'; }
    function render() {
      list.replaceChildren(); rows.forEach(function (row) {
        var line = el('button', row[0] + '：' + (row[0].indexOf('密码') >= 0 && !shown ? '••••••••' : row[1]), { type: 'button', 'class': 'cra1-security-credential' });
        line.onclick = function () { copy(String(row[1])); }; list.appendChild(line);
      });
      if (!rows.length) list.append(el('p', '暂无登录信息'));
    }
    var footer = el('div', '', { 'class': 'cra1-security-footer' }), toggle = el('button', '显示密码', { type: 'button' }), close = el('button', '关闭', { type: 'button' });
    toggle.onclick = function () { if (!valid()) return expire(); shown = !shown; toggle.textContent = shown ? '隐藏密码' : '显示密码'; render(); };
    close.onclick = clear; footer.append(toggle, close); dialog.append(list, note, footer); dialogHost().appendChild(dialog); dialog.style.pointerEvents = 'auto';
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); clear(); }); dialog.addEventListener('keydown', function (event) { event.stopPropagation(); });
    render(); dialog.showModal(); if (until) timeout = root.setTimeout(expire, Math.max(0, until - Date.now()));
    if (options.signal) options.signal.addEventListener('abort', clear, { once: true });
  }
  shared.Security = { challenge: challenge, perform: perform, remember: remember, openCaptcha: openCaptcha, setup: setup, requireSetup: requireSetup, viewCredentials: viewCredentials, expiresAt: function () { return expiryToken === token() && expiry > Date.now() / 1000 ? expiry : 0; } };
})(window);

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
    var links=el('div','cra1-upanel__links');[['安全概览','overview'],['API 密钥','api'],['SSH 密钥','ssh']].forEach(function(x){link(links,x[0],'/security.htm?tab='+x[1],'cra1-upanel__link',options);});security.appendChild(links);
    var finance=el('div','cra1-upanel__section'),fhead=link(finance,'','/finance.htm','cra1-upanel__head',options);fhead.append(glyph('finance'),el('span','',label(options,'finance','财务信息')),glyph('arrow','cra1-upanel__chev'));
    var balanceRow=el('div','cra1-upanel__kv'),balance=el('span','cra1-upanel__kv-value'),amount=el('span','cra1-upanel__balance');balance.appendChild(amount);link(balance,'余额记录','/finance.htm?tab=credit','cra1-upanel__link',options);balanceRow.append(el('span','cra1-upanel__kv-label','可用余额'),balance);
    var orderRow=el('div','cra1-upanel__kv'),order=el('span','cra1-upanel__kv-value');link(order,'查看订单','/finance.htm?tab=orders','cra1-upanel__link',options);orderRow.append(el('span','cra1-upanel__kv-label','我的订单'),order);finance.append(balanceRow,orderRow);
    panel.append(first,security,finance);host.replaceChildren(trigger,panel);
    var popover=shared.UI.createPopover({root:host,trigger:trigger,panel:panel,hover:true,beforeOpen:options.beforeOpen,onOpenChange:options.onOpenChange});
    function update() {
      var u=options.getUser?options.getUser():options.user||{};if(!u)return;
      shared.Avatar.register(u);var style=shared.Avatar.style(u),text=shared.Avatar.letter(u);
      [avatar,large].forEach(function(n){n.style.backgroundImage=style.backgroundImage||'';n.style.backgroundSize='cover';n.style.backgroundPosition='center';n.textContent=text;});
      username.textContent=u.username||u.name||u.email||u.phone||'会员';username.title=username.textContent;
      id.textContent='账号 ID：'+(u.id||u.accountId||'—');amount.textContent=shared.Runtime.money(u.credit||0);
    }
    function avatarChanged(e){var u=options.getUser?options.getUser():options.user;if(u&&String(u.id||u.accountId)===String(e.detail.id))update();}
    root.addEventListener('cra1:avatar-updated',avatarChanged);update();
    return {update:update,setOpen:popover.setOpen,close:popover.close,toggle:popover.toggle,openWithFocus:popover.openWithFocus,destroy:function(){popover.destroy();root.removeEventListener('cra1:avatar-updated',avatarChanged);host.replaceChildren();}};
  }
  function safeUrl(url,image) { return typeof url==='string'&&!/[\x00-\x20\\]/.test(url)&& (image?/^(?:https?:\/\/|\/(?!\/))/i:/^(?:https?:\/\/|\/(?!\/)|#|tel:|mailto:)/i).test(url); }
  function mountSupport(host,options) {
    options=options||{};host.classList.add('cra1-header-support');
    var trigger=el('button','cra1-header-support__trigger');trigger.type='button';trigger.setAttribute('aria-label','客服');trigger.setAttribute('aria-haspopup','true');trigger.innerHTML=icon('support');
    var panel=el('div','cra1-header-support__panel cra1-shared-panel');panel.hidden=true;panel.id='cra1-support-'+(++sequence);panel.setAttribute('role','region');panel.setAttribute('aria-label','客服与联系');
    host.replaceChildren(trigger,panel);var popover=shared.UI.createPopover({root:host,trigger:trigger,panel:panel,hover:true,beforeOpen:options.beforeOpen});
    function update(config) {
      config=config||(options.getConfig?options.getConfig():options.config)||{};panel.replaceChildren();
      host.hidden=!config.enabled||!config.groups||!config.groups.length;if(host.hidden){popover.close();return;}
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
      });
      var status=el('p','cra1-header-support__status');status.hidden=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.appendChild(status);
    }
    update();return {update:update,close:popover.close,toggle:popover.toggle,destroy:function(){popover.destroy();host.replaceChildren();}};
  }
  shared.HeaderActions={icon:icon,mountAccount:mountAccount,mountSupport:mountSupport};
})(typeof window!=='undefined'?window:globalThis);

/* The carousel fog stops offscreen and in hidden tabs; no rendering loop. */
(function (root) {
  var document = root.document;
  if (document.documentElement.getAttribute('data-cra1-theme') !== 'website') return;
  var motion = root.matchMedia('(prefers-reduced-motion: reduce)');
  function start() {
    var elements = Array.from(document.querySelectorAll('.marketing-hero'));
    if (!elements.length) return;
    var visible = new WeakMap();
    function sync() {
      elements.forEach(function (element) {
        element.setAttribute('data-ambient-running', String(!document.hidden && !motion.matches && visible.get(element)));
      });
    }
    elements.forEach(function (element) { visible.set(element, false); });
    if ('IntersectionObserver' in root) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { visible.set(entry.target, entry.isIntersecting); });
        sync();
      });
      elements.forEach(function (element) { observer.observe(element); });
    }
    document.addEventListener('visibilitychange', sync);
    if (motion.addEventListener) motion.addEventListener('change', sync);
    else motion.addListener(sync);
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);

/* Decorative business icons share a palette. Operational controls keep their
 * original foreground; uploaded raster artwork is never filtered/recoloured. */
(function (root) {
  var themes = ['website', 'member', 'cart'];
  var tones = ['compute', 'security', 'finance', 'gold'];
  var names = {
    compute: 'cloud cloud-cog cloud-upload server server-cog server-crash network cpu database globe layers package boxes box monitor hard-drive layout-grid shopping-cart',
    security: 'shield shield-check shield-alert lock lock-keyhole key key-round life-buoy headphones headset ticket mail newspaper file-text book book-open messages-square message-circle',
    finance: 'wallet credit-card banknote coins receipt receipt-text calendar-clock',
    gold: 'gift sparkles star badge-check users handshake award trophy'
  };
  var iconTones = {};
  Object.keys(names).forEach(function (tone) {
    names[tone].split(' ').forEach(function (name) { iconTones['lucide-' + name] = tone; });
  });
  var selector = '[data-cui-icon-style],[data-cra1-icon-label],.promo-icon,.cra1-primary-item__icon,.cl-result-icon,svg.lucide';
  function toneFor(label, fallback) {
    var text = String(label || '').toLowerCase();
    if (/价格|财务|余额|充值|支付|账单|订单|续费|计费|优惠|费用|退款|免费|wallet|credit-card|billing|finance|price/.test(text)) return 'finance';
    if (/合作|伙伴|推荐|奖励|推广|礼品|partner|gift|award/.test(text)) return 'gold';
    if (/安全|防护|保障|证书|备份|支持|客服|工单|咨询|联系|公告|新闻|文档|邮件|账户|账号|认证|身份|security|shield|support|ticket|ssl|headphones|life-buoy|mail|file-text|newspaper/.test(text)) return 'security';
    if (/云|计算|服务器|网络|域名|存储|数据|资源|产品|基础设施|cloud|server|compute|network|domain|database|package|cpu/.test(text)) return 'compute';
    return tones.indexOf(fallback) >= 0 ? fallback : 'compute';
  }
  function clearSurface(element) {
    // Icon wells alone own these decorative utilities. Keep text/status colours,
    // dimensions, rounding, focus outlines and every surrounding control intact.
    Array.from(element.classList).forEach(function (name) {
      var utility=name.replace(/^.*:/,'').replace(/^!|!$/g,'');
      if (/^(?:bg-(?:brand|primary|muted|muted-bg|surface|surface-alt|white|black|success|warning|danger)(?:\/[\d.]+)?|border(?:-.*)?|shadow(?:-.*)?)$/.test(utility)) element.classList.remove(name);
    });
  }
  function markWell(element) {
    clearSurface(element);
    if (!element.classList.contains('cui-icon-well')) element.classList.add('cui-icon-well');
  }
  function mark(element, tone, tile) {
    // Legacy React utilities are emitted with !important. Remove only colour
    // utilities on identified decorative icons/wells, rather than escalating
    // shared CSS specificity or changing label/button/status colours.
    Array.from(element.classList).forEach(function (name) {
      if (/^(?:(?:group-hover|hover):)*!?(?:text|bg)-(?:brand|primary|muted|muted-bg|muted-foreground|ink|body|white|black)(?:\/[\d.]+)?!?$/.test(name)) element.classList.remove(name);
    });
    if (tile) clearSurface(element);
    if(element.hasAttribute('data-cui-icon-style')) tone=element.getAttribute('data-cui-icon-tone') || tone;
    if (!element.classList.contains('cui-business-icon')) element.classList.add('cui-business-icon');
    if (tile && !element.classList.contains('cui-business-icon--tile')) element.classList.add('cui-business-icon--tile');
    if (element.getAttribute('data-cui-icon-tone') !== tone) element.setAttribute('data-cui-icon-tone', tone);
  }
  function apply(element) {
    if (!element || element.nodeType !== 1 || !element.matches(selector)) return;
    if (themes.indexOf(root.document.documentElement.getAttribute('data-cra1-theme')) < 0) return;
    if (element.classList.contains('cl-result-icon')) { markWell(element); return; }
    // A supplied label explicitly identifies a decorative icon, even inside a
    // tile link. Ordinary button/menu icons and status warnings remain neutral.
    if (element.hasAttribute('data-cra1-icon-label') || element.classList.contains('promo-icon')) {
      var box = element.closest('.promo-entry,li,.feature-item');
      var label = element.getAttribute('data-cra1-icon-label') || (box && box.textContent.slice(0,180));
      var fallback = element.getAttribute('data-cra1-icon-fallback') || (element.classList.contains('promo-icon-success') ? 'security' : element.classList.contains('promo-icon-warning') ? 'gold' : 'compute');
      mark(element,toneFor(label,fallback),true); return;
    }
    if (element.classList.contains('cra1-primary-item__icon')) {
      var item=element.closest('.cra1-primary-item');
      if (item) mark(element,toneFor(item.getAttribute('title') || item.textContent),false);
      return;
    }
    if (!element.closest('main,#root,.cra1-shell__content')) return;
    if (element.closest('button,.cui-button,[role="button"],[role="menu"],.cra1-header,.cra1-upanel,.cra1-header-search,.cra1-header-support')) return;
    if (element.closest('[data-cra1-icon-label],.promo-icon')) return;
    var tone;
    Array.from(element.classList).some(function (name) { tone=iconTones[name]; return !!tone; });
    var parent=element.parentElement;
    // An existing single-icon well may contain an empty/status icon outside the
    // business palette. Feather its backing too, preserving its original ink.
    var well=parent && parent.tagName==='SPAN' && parent.childElementCount===1 && !parent.textContent.trim() && /(?:^|\s)size-(?:7|8|9|10|11|12|14|16)(?:\s|$)/.test(parent.className);
    if (!tone) { if (well) markWell(parent); return; }
    // Status colours carry meaning and are independent of decorative palettes.
    if (Array.from(element.classList).some(function (name) { return /^text-(?:success|warning|danger)(?:\/|$)/.test(name); })) { if (well) markWell(parent); return; }
    // React decorative icon wells contain one SVG and no label. Keep their
    // existing size, layout and hit area; only replace the surface and ink.
    if (well) mark(parent,tone,true);
    else mark(element,tone,false);
  }
  root.CRA1Shared = root.CRA1Shared || {};
  root.CRA1Shared.BusinessIcons = {selector:selector,apply:apply,toneFor:toneFor};
})(window);

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

/* Short, one-time page entrances. Frameworks keep visibility, focus and state;
 * the existing Styles observer supplies DOM changes without another observer. */
(function (root) {
  var document = root.document;
  var preference = root.matchMedia('(prefers-reduced-motion: reduce)');
  var pages = new WeakSet();
  var active = new Map();
  var pending = new Set();
  var frame = 0;
  var started = false;
  var rootSelector = '#main-content,#cra1-content-slot,#root,main.el-main';
  var layerSelector = '.cui-dialog,.cui-dialog-overlay,.cui-sheet';
  var ease = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var canTranslate = root.CSS && root.CSS.supports('translate', '0 8px');

  function stop() {
    active.forEach(function (element, animation) { animation.cancel(); });
    active.clear();
  }
  function visible(element) {
    if (!element.isConnected || !element.getClientRects().length) return false;
    var rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < root.innerHeight && rect.width > 0 && rect.height > 0;
  }
  function play(element, kind, delay, lift) {
    if (preference.matches || document.hidden || !element.animate || !visible(element)) return;
    // A translated ancestor changes the containing block of fixed overlays.
    // Broad plugin/form containers therefore fade only when they contain one.
    var floating = element.querySelector('.el-dialog__wrapper,.el-message-box__wrapper,.cl-rail-dock,[role="dialog"],.cui-sheet,.cra1-notice-dialog__overlay');
    var from = { opacity: 0 }, to = { opacity: 1 };
    if (canTranslate && lift && !floating && getComputedStyle(element).position !== 'fixed') {
      from.translate = '0 ' + lift + 'px';
      to.translate = '0 0';
    }
    active.forEach(function (target, animation) { if (target === element) animation.cancel(); });
    var animation = element.animate([from, to], {
      duration: kind === 'page' ? 250 : 180, delay: delay || 0, easing: ease, fill: 'backwards'
    });
    animation.id = 'cui-' + kind + '-enter';
    active.set(animation, element);
    function clear() { active.delete(animation); }
    animation.onfinish = clear;
    animation.oncancel = clear;
  }
  function blocks(page) {
    if (page.id === 'main-content') {
      // Carousel copies animate separately during slide changes. Use their
      // wrappers at initial entry; existing scroll reveal sections stay owned.
      var hero = page.querySelector('.marketing-hero,.page-hero');
      if (!hero) return [];
      if (hero.matches('.marketing-hero')) {
        return Array.from(hero.querySelectorAll('.marketing-hero-title-slot,.marketing-hero-description-slot,.marketing-hero-action'));
      }
      var title = hero.querySelector('h1');
      if (!title) return [];
      return [title].concat(Array.from(title.parentElement.children).filter(function (node) {
        return node !== title && (node.tagName === 'P' || node.querySelector('.cui-button,.btn'));
      })).filter(function (node) { return !node.closest('[data-reveal],[data-cra1-module]'); });
    }
    var container = page;
    if (page.childElementCount === 1 && page.firstElementChild.childElementCount > 0 && !page.firstElementChild.matches('form,.cui-card')) container = page.firstElementChild;
    if (page.matches('main.el-main')) {
      var content = page.querySelector('.main-content-box');
      if (content) container = content;
    }
    var items = [];
    Array.from(container.children).forEach(function (node) {
      if (node.matches('script,style,link,template,.up-dialog') || !visible(node)) return;
      // Expand just one grid level so adjacent cards receive the 40ms rhythm.
      if (node.classList.contains('grid') && !node.matches('.cui-card') && node.childElementCount > 1) {
        Array.from(node.children).forEach(function (child) { if (visible(child)) items.push(child); });
      } else items.push(node);
    });
    return items;
  }
  function enter(page) {
    if (pages.has(page) || !page.isConnected) return;
    if (page.id === 'cra1-content-slot' && !root.__CRA1_SHELL_READY__) return;
    // Do not consume the entrance while an empty React slot or a skeleton-only
    // account page is waiting for its first real content. Refreshes reuse the
    // page root, whose entrance is already consumed.
    if (!page.textContent.trim() && !page.querySelector('input,textarea')) return;
    var items = blocks(page).filter(visible).slice(0, 6);
    if (!items.length) return;
    pages.add(page);
    items.forEach(function (element, index) { play(element, 'page', index * 40, page.id === 'root' ? 0 : 8); });
  }
  function flush() {
    frame = 0;
    pending.forEach(enter);
    pending.clear();
  }
  function queue(page) {
    if (!page || pages.has(page)) return;
    pending.add(page);
    if (!frame) frame = root.requestAnimationFrame(flush);
  }
  function scan(node) {
    if (!started || !node || node.nodeType !== 1 && node.nodeType !== 9) return;
    function layer(element) {
      // Legacy Tailwind animation utilities are important, so they otherwise
      // override shared motion and add a second centering translation. Remove
      // only those old animation utilities on our own floating components.
      Array.from(element.classList).forEach(function (name) {
        if (/^data-\[state=(?:open|closed)\]:animate-\[/.test(name)) element.classList.remove(name);
      });
    }
    if (node.nodeType === 1 && node.matches(layerSelector)) layer(node);
    node.querySelectorAll(layerSelector).forEach(layer);
    if (node.nodeType === 1) queue(node.closest(rootSelector));
    node.querySelectorAll(rootSelector).forEach(queue);
  }
  function tabContent(trigger) {
    var id = trigger.getAttribute('aria-controls');
    var panel = id && document.getElementById(id);
    // Semantic Radix / Element panels already receive CSS transitions.
    if (panel && panel.matches('[role="tabpanel"],.el-tab-pane')) return;
    if (panel) { play(panel, 'panel', 0, 4); return; }
    var list = trigger.closest('[role="tablist"]');
    if (!list || list.closest('.el-tabs')) return;
    // Some current React screens render their panel next to the Tabs root
    // instead of TabsContent. Limit the fallback to that local content group.
    var group = list;
    if (!group.nextElementSibling && group.parentElement && group.parentElement.matches('[data-orientation]')) group = group.parentElement;
    var sibling = group.nextElementSibling;
    var count = 0;
    while (sibling && count < 6) {
      if (!sibling.matches('script,style,[role="tablist"]')) { play(sibling, 'panel', count * 30, 4); count++; }
      sibling = sibling.nextElementSibling;
    }
  }
  function update(records) {
    records.forEach(function (record) {
      if (record.type !== 'attributes') return;
      if (record.attributeName === 'aria-selected' && record.oldValue === 'false' && record.target.getAttribute('aria-selected') === 'true') {
        tabContent(record.target);
      }
    });
  }
  function settle(event) {
    active.forEach(function (element, animation) { if (element.contains(event.target)) animation.cancel(); });
  }
  function sync() { if (preference.matches || document.hidden) stop(); }
  function restored(event) { if (event.persisted) stop(); }
  function start() {
    if (started) return;
    started = true;
    document.documentElement.setAttribute('data-cra1-motion', 'ready');
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('focusin', settle);
    document.addEventListener('pointerdown', settle, true);
    root.addEventListener('pageshow', restored);
    if (preference.addEventListener) preference.addEventListener('change', sync);
    else preference.addListener(sync);
    scan(document);
  }
  function destroy() {
    started = false;
    stop();
    if (frame) root.cancelAnimationFrame(frame);
    frame = 0;
    pending.clear();
    document.documentElement.removeAttribute('data-cra1-motion');
    document.removeEventListener('visibilitychange', sync);
    document.removeEventListener('focusin', settle);
    document.removeEventListener('pointerdown', settle, true);
    root.removeEventListener('pageshow', restored);
    if (preference.removeEventListener) preference.removeEventListener('change', sync);
    else preference.removeListener(sync);
  }
  root.CRA1Shared = root.CRA1Shared || {};
  root.CRA1Shared.Motion = { start: start, scan: scan, update: update, destroy: destroy };
})(window);

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
  function check(force) {
    if (!shared.Request.requiresLogin()) return Promise.resolve();
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
    if (!root.document.hidden && (!shared.Request.getToken() || Date.now() - lastCheck > 60000)) check(true);
  });
})(window);

/* Legacy hosts keep their DOM, framework and business events. Class markers
 * let them use the same component declarations instead of copied CSS skins. */
(function (root) {
  var document=root.document;
  var definitions={"website":{"cui-dark":":is(.footer-night,.night-section)","cui-card":":is(.glass-card,.hairline-card,.feature-item,.product-card,.bento-card,.bento-featured,.article-card,.pricing-card,.price-card,.solution-card,.proof-card,.doc-card,.link-tile,.choice-card,.quote-card,.compare-card,.cascade-item):not(:where(.cra1-marketing--product #overview *, .cra1-marketing--product #advantages *))","cui-card--featured":":is(.bento-featured,.product-card-featured)","cui-button":".btn:not(.btn-aurora)","cui-button--primary":".btn-primary:not(.btn-aurora)","cui-button--outline":".btn-outline:not(.btn-aurora)","cui-button--ghost":".btn-ghost:not(.btn-aurora)","cui-button--danger":".btn-error:not(.btn-aurora)","cui-button--sm":":is(.btn-sm,.btn-xs):not(.btn-aurora)","cui-input":":is(.input,.textarea,.select)","cui-input--success":".input-success","cui-textarea":".textarea","cui-checkbox":".checkbox","cui-radio":".radio","cui-switch":".toggle","cui-range":".range","cui-button--link":".btn-link:not(.btn-aurora)","cui-arrow":"[data-cui-arrow]","cui-badge":".badge","cui-badge--accent":".badge-primary","cui-badge--success":".badge-success","cui-badge--warning":".badge-warning","cui-badge--danger":".badge-error","cui-badge--silver":".badge-neutral","cui-badge--graphite":".badge-ghost"},"system":{"cui-button":":is(.el-button,.cl-rail-buy,.cl-btn,.f-order .buy,.cra1-notice-dialog__btn)","cui-button--primary":":is(.el-button--primary,.cl-rail-buy,.cl-btn--primary,.f-order .buy,.cra1-notice-dialog__btn:not(.cra1-notice-dialog__btn--ghost))","cui-button--outline":":is(.el-button:not(.el-button--primary):not(.el-button--danger):not(.el-button--text),.cl-btn--ghost,.cra1-notice-dialog__btn--ghost)","cui-button--ghost":".el-button--text","cui-button--danger":".el-button--danger","cui-button--sm":".el-button--small","cui-input":":is(.el-input__inner,.el-textarea__inner)","cui-textarea":".el-textarea__inner","cui-input--success":".is-success .el-input__inner","cui-card":":is(.main-card,.el-card,.cl-goods-card,.cl-rail-card,.cl-product-info,.cl-config-panel,.shopping-item)","cui-table":".el-table__body","cui-pagination":".el-pagination","cui-button--link":".el-link"}};
  var theme=document.documentElement.getAttribute('data-cra1-theme');
  if(theme!=='website'&&theme!=='member'&&theme!=='cart')return;
  var entries=Object.entries(definitions[theme==='website'?'website':'system']);
  var business=root.CRA1Shared.BusinessIcons;
  var motion=root.CRA1Shared.Motion;
  var selector=entries.map(function(entry){return entry[1];}).join(',')+(business?','+business.selector:'');
  var owned=new WeakMap();
  function apply(element){
    if(!element||element.nodeType!==1)return;
    if(business)business.apply(element);
    var previous=owned.get(element);
    // Existing React/Alpine components already declare their semantic variants.
    if(!previous&&Array.from(element.classList).some(function(name){return /^cui-/.test(name);}))return;
    var next=new Set();
    entries.forEach(function(entry){if(element.matches(entry[1]))next.add(entry[0]);});
    if(!previous&&!next.size)return;
    if(previous)previous.tokens.forEach(function(name){if(!next.has(name)&&element.classList.contains(name))element.classList.remove(name);});
    next.forEach(function(name){if(!element.classList.contains(name))element.classList.add(name);});
    owned.set(element,{tokens:next,signature:element.getAttribute('class')});
  }
  function scan(node){
    if(!node||node.nodeType!==1&&node.nodeType!==9)return;
    if(node.nodeType===1)apply(node);
    node.querySelectorAll(selector).forEach(apply);
    if(motion)motion.scan(node);
  }
  var observer=new MutationObserver(function(records){
    var pending=new Set();
    records.forEach(function(record){
      if(record.type==='childList')record.addedNodes.forEach(function(node){if(node.nodeType===1)pending.add(node);});
      else if(record.type==='attributes'){
        var previous=owned.get(record.target);
        if(!previous||previous.signature!==record.target.getAttribute('class'))pending.add(record.target);
      }
    });
    pending.forEach(function(node){
      if(!node.isConnected)return;
      for(var parent=node.parentElement;parent;parent=parent.parentElement)if(pending.has(parent))return;
      scan(node);
    });
    if(motion)motion.update(records);
  });
  // Avoid repeatedly walking the parser's incomplete subtrees. Existing theme
  // markup already declares cui classes for above-the-fold content; the legacy
  // pass runs before deferred framework page modules and async plugin content.
  function start(){
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['class','data-cra1-icon-label','data-cui-icon-style','title','aria-selected']});
    if(motion)motion.start();
    scan(document);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  root.CRA1Shared.Styles={refresh:scan,disconnect:function(){observer.disconnect();if(motion)motion.destroy();}};
})(window);
