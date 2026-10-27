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
    var config = data.security_verification;
    if (!config && data.need_security_verify && Array.isArray(data.available_methods)) config = { kind: 'identity', methods: data.available_methods };
    if (config) {
      // Native V10 replies carry available_methods, but no captcha_required.
      // Use the page's server projection just like the native security dialog.
      var runtime = root.__CRA1_RUNTIME__ || {}, common = runtime.common || {};
      var required = Number(config.captcha_required) === 1 || Number(common.captcha_client_security_verify) === 1 || Number(runtime.auth && runtime.auth.captcha && runtime.auth.captcha.security_verify) === 1;
      return Object.assign({}, config, { captcha_required: required });
    }
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
      function setError(error) { errorBox.textContent = shared.Errors ? shared.Errors.message(error) : '验证失败，请重试'; }
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
            // A lost order response must leave this verification form. Repeating
            // "验证并继续" could otherwise create a second order inside the dialog.
            if (error.uncertain || error.status === 401 || ['CANCELLED','SECURITY_CANCELLED','SECURITY_SESSION_CHANGED'].indexOf(error.code) >= 0) { cleanup(); reject(error); }
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
