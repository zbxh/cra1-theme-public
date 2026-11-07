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
