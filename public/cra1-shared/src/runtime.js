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
    error: function (error, options) { return shared.Errors.message(error, options); }
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
