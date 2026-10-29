(function () {
  'use strict';
  const Axios = axios.create({ baseURL: '/console/v1', timeout: 60000 });
  Axios.defaults.withCredentials = true;
  const shared = window.CRA1Shared;
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('queryParam')) {
    localStorage.setItem('jwt', urlParams.get('queryParam'));
    urlParams.delete('queryParam');
    window.history.replaceState({}, '', window.location.pathname + (urlParams.toString() ? '?' + urlParams : ''));
  }
  // The native ticket detail consumer has no rejection handler and otherwise
  // leaves an empty reply form active when its first read fails. This adapter
  // handles only that page's own GET; writes keep their normal rejection path.
  let ticketLoaded = false;
  function certificationFlow(response) {
    // The native certification page consumes these business outcomes in its
    // success callback. They are navigation decisions, not successful writes.
    if (response.status !== 200 || Number(response.data?.status) !== 400
      || response.config?.method?.toLowerCase() !== 'get') return false;
    const match = /^\/plugin\/([1-9]\d*)\/authentication_thrid\.htm$/.exec(window.location.pathname);
    if (!match) return false;
    try {
      const plugins = JSON.parse(window.document.documentElement.getAttribute('addons_js') || '[]');
      if (!plugins.some(p => String(p.id) === match[1] && p.name === 'IdcsmartCertification')) return false;
    } catch (error) { return false; }
    const endpoint = String(response.config.url || '').split('?')[0].replace(/^(?:\/console\/v1)?\/?/, '/');
    return (endpoint === '/certification/auth' && [10000, 10001].includes(response.data.data?.code))
      || endpoint === '/certification/status';
  }
  function ticketRead(config) {
    if (!/^\/plugin\/[1-9]\d*\/ticketDetails\.htm$/.test(window.location.pathname)
      || String(config?.method || '').toLowerCase() !== 'get') return false;
    const id = new URLSearchParams(window.location.search).get('id');
    return /^[1-9]\d*$/.test(id || '')
      && new RegExp('^(?:/console/v1)?/ticket/' + id + '$').test(String(config.url || '').split('?')[0]);
  }
  function ticketFailure(error, config) {
    if (!ticketRead(config)) return false;
    // The current native Vue adapter owns inline retry and retains its form.
    // Older templates without that adapter still use the compatibility panel.
    if (shared.PluginPages?.handlesTicketRead) return false;
    if (ticketLoaded) return true; // A failed refresh keeps the last valid detail.
    const document = window.document;
    const card = document?.querySelector('.ticket-details .main-card');
    if (!card) return false;
    const panel = document.createElement('section');
    panel.className = 'cui-card';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'padding:24px;display:grid;gap:16px';
    const title = document.createElement('h2');
    title.textContent = '页面错误，请刷新重试';
    const detail = document.createElement('p');
    detail.textContent = '';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px';
    const back = document.createElement('a');
    back.className = 'cui-button cui-button--outline'; back.href = 'ticket.htm';
    back.textContent = '返回工单列表';
    actions.append(back); panel.append(title, detail, actions);
    card.replaceChildren(panel);
    return true;
  }
  function normalized(error, config, httpStatus) {
    const value = error.response ? error.response.data : error.data;
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const status = httpStatus >= 400 ? httpStatus : Number(data.status) || 503;
    const message = shared.Errors.message({ message: data.msg || data.message || error.message, status, code:error.code }, { method:config?.method });
    data.status = status;
    data.msg = message;
    if (Object.prototype.hasOwnProperty.call(data, 'message')) data.message = message;
    error.data = data; // Native callers use error.data.msg for both HTTP and business failures.
    if (error.response) error.response.data = data;
    error.message = message;
    error.msg = message;
    return error;
  }
  Axios.interceptors.request.use(config => {
    Object.assign(config.headers, shared.Request.headers());
    config.__cra1Token = shared.Request.getToken();
    return config;
  }, error => Promise.reject(normalized(error, error.config, 0)));
  Axios.interceptors.response.use(response => {
    // This native plugin deliberately returns a flat successful result. Keep its
    // exact contract; other missing-status envelopes still fail closed.
    const promotion = response.status === 200 && response.config?.method?.toLowerCase() === 'get'
      && /^(?:\/console\/v1)?\/event_promotion\/product\/[1-9]\d*\/event_promotion$/.test(String(response.config?.url || '').split('?')[0])
      && response.data && !Object.prototype.hasOwnProperty.call(response.data, 'status')
      && Array.isArray(response.data.list) && typeof response.data.addon_event_promotion_does_not_participate === 'string';
    const code = promotion ? 200 : Number(response.data?.status || 0);
    if (response.status === 401 || code === 401) {
      shared.Request.unauthorized({ policy:'redirect', token:response.config.__cra1Token });
      return Promise.reject(normalized(response, response.config, 401));
    }
    if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
      return Promise.reject(normalized(response, response.config, 503));
    }
    const security = shared.Security;
    if (!response.config.__securityHandled && security && security.setup(response.data)) return security.requireSetup(response.data, { signal:response.config.signal });
    if (!response.config.__securityHandled && security && security.challenge(response.data)) {
      return security.perform(response.data, proof => {
        const original = typeof response.config.data === 'string' ? JSON.parse(response.config.data || '{}') : response.config.data || {};
        return Axios.request({ ...response.config, __securityHandled:true, data:{ ...original, ...proof } });
      }, { signal:response.config.signal, token:response.config.__cra1Token });
    }
    if (code !== 200) {
      if (certificationFlow(response)) return response;
      const error = normalized(response, response.config, response.status);
      if (ticketFailure(error, response.config)) return response;
      return Promise.reject(error);
    }
    if (ticketRead(response.config)) ticketLoaded = true;
    if (response.data.rule) localStorage.setItem('menuList', JSON.stringify(response.data.rule));
    return response;
  }, error => {
    if (error.response?.status === 401 || Number(error.response?.data?.status) === 401) {
      shared.Request.unauthorized({ policy:'redirect', token:(error.config || error.response.config || {}).__cra1Token });
    }
    // An individual request must not navigate the whole page or create a global
    // toast. The consumer decides whether this was a background refresh, a first
    // load, or a customer action and retains its current context accordingly.
    const value = normalized(error, error.config, error.response?.status || 0);
    if (Number(value.data.status) !== 401 && ticketFailure(value, error.config)) return error.response || { data:value.data, config:error.config };
    return Promise.reject(value);
  });
  window.Axios = Axios;
})();
