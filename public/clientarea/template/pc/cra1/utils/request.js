/* Generated from public/cra1-shared/src. Edit the source and rebuild. */
(function () {
  const baseURL = `/console/v1`;
  const Axios = axios.create({ baseURL, timeout: 1000 * 60 * 10 });
  Axios.defaults.withCredentials = true;
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("queryParam")) {
    const jwt = urlParams.get("queryParam");
    localStorage.setItem("jwt", jwt);
    // 替换当前url，删除queryParam参数 保留其它参数
    urlParams.delete("queryParam");
    const newUrl =
      window.location.pathname +
      (urlParams.toString() ? "?" + urlParams.toString() : "");
    window.history.replaceState({}, "", newUrl);
  }
  // 请求拦截器
  Axios.interceptors.request.use(
    (config) => {
      // Read auth and language through the common layer for each request.
      // Keep Axios and V10's response shape for official plugin components.
      Object.assign(config.headers, window.CRA1Shared.Request.headers());
      config.__cra1Token = window.CRA1Shared.Request.getToken();
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  Axios.interceptors.response.use(
    (response) => {
      if(response.data && Number(response.data.status)!==200 && window.CRA1Shared.Runtime) response.data.msg=window.CRA1Shared.Runtime.error({message:response.data.msg});
      const code = Number(response.data?.status || 0);
      // Session expiry must be handled even when this is a security retry.
      if (response.status === 401 || code === 401) {
        window.CRA1Shared.Request.unauthorized({ policy: 'redirect', token: response.config.__cra1Token });
        return Promise.reject(response);
      }
      const security = window.CRA1Shared.Security;
      if (!response.config.__securityHandled && security && security.setup(response.data)) return security.requireSetup(response.data, { signal: response.config.signal });
      if (!response.config.__securityHandled && security && security.challenge(response.data)) {
        return security.perform(response.data, proof => {
          const original = typeof response.config.data === 'string' ? JSON.parse(response.config.data || '{}') : (response.config.data || {});
          return Axios.request({ ...response.config, __securityHandled: true, data: { ...original, ...proof } });
        }, { signal: response.config.signal, token: response.config.__cra1Token });
      }
      if (response.config.__securityHandled && Number(code) !== 200) {
        const error = new Error(response.data.msg || '安全验证未通过，请重试');
        error.status = Number(code); error.data = response.data;
        return Promise.reject(error);
      }
      if (response.data.rule) {
        // 返回有rule的时候, 才执行缓存操作
        localStorage.setItem("menuList", JSON.stringify(response.data.rule)); // 权限菜单
      }
      if (code) {
        switch (code) {
          case 200:
            break;
          case 302:
            location.href = `${baseURL}/install`;
            break;
          case 307:
            break;
          case 400:
            if (response.data.data) {
              const { client_operate_methods, operate_password } =
                response.data.data;
              if (client_operate_methods && operate_password) {
                window.clientOperateVue?.$refs?.safeRef.openDialog(
                  client_operate_methods
                );
              }
            }
            return Promise.reject(response);
          case 403:
            break;
          case 404:
            // 判断当前页面是否为 noPermissions.htm, 如果是, 则不跳转, 否则跳转到 noPermissions.htm
            // if (pageRouter !== "noPermissions.htm") {
            //   location.replace("/noPermissions.htm");
            // }
            return Promise.reject(response);
          case 405:
            location.href = "/login.htm";
            break;
          case 406:
            return Promise.reject(response);
            break;
          case 409: // 该管理没有该客户, 跳转首页
            location.href = "";
            break;
          case 410:
            break;
          case 422:
            break;
          case 500:
            Vue.prototype.$message.error("访问失败, 请重试!");
            break;
          case 501:
            break;
          case 502:
            break;
          case 503:
            location.href = "/503.htm";
            break;
          case 504:
            break;
          case 505:
            break;
        }
      }

      // V10 uses business status inside HTTP 200 too. Failed operations must
      // reject so callers cannot display success or submit dependent steps.
      if (code && code !== 200) return Promise.reject(response);
      return response;
    },
    (error) => {
      
      if (error.code === "ERR_NETWORK") {
        location.href = `/networkErro.htm`;
      }
      if (error.config) {
        if (error.config.url.indexOf("system/autoupdate") !== -1) {
          // 系统更新接口
          if (error.message === "Network Error") {
            setTimeout(() => {
              location.reload();
            }, 2000);
          }
        }
      }
      if (error.response) {
        if (error.response.data && window.CRA1Shared.Runtime) {
          error.response.data.msg = window.CRA1Shared.Runtime.error({message:error.response.data.msg || error.response.data.message});
          error.response.data.message = error.response.data.msg;
          error.message = error.response.data.msg;
        }
        if (error.response.status === 401) {
          window.CRA1Shared.Request.unauthorized({ policy: 'redirect', token: (error.config || error.response.config || {}).__cra1Token });
          return Promise.reject(error);
        }
        if (error.response.status === 302) {
          location.href = `${baseURL}/install`;
          return Promise.reject(error);
        }
        if (error.response.status === 500 && error.response.data.message) {
          Vue.prototype.$message.error(window.CRA1Shared.Runtime ? window.CRA1Shared.Runtime.error(error.response.data) : '服务暂时不可用，请稍后重试');
        }
      }
      return Promise.reject(error);
    }
  );
  window.Axios = Axios;
})();
