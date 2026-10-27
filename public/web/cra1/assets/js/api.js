/* Website adapter for the three-theme shared request layer. */
(function () {
  'use strict';
  function call(method, path, data, params) {
    return CRA1Shared.Request.request(path, { method: method, body: data, params: params, unauthorized: 'notify' })
      .then(function (body) { return body && body.status !== undefined && body.data !== undefined ? body.data : body; });
  }
  window.API = {
    get: function (path, params) { return call('GET', path, undefined, params); },
    post: function (path, data) { return call('POST', path, data); },
    put: function (path, data) { return call('PUT', path, data); },
    delete: function (path, data) { return call('DELETE', path, data); }
  };
})();
