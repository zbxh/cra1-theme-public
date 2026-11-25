/* Error recovery around the installed cart loader and the integrated DCIM module. */
(function () {
  'use strict';

  function feedback(anchor, title, detail, retry, catalog) {
    const panel = document.createElement('section');
    panel.className = 'cra1-cart-read-feedback';
    panel.setAttribute('role', 'status');
    const heading = document.createElement('h2');
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = detail;
    const actions = document.createElement('div');
    if (retry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '重新加载';
      button.addEventListener('click', retry);
      actions.append(button);
    }
    if (catalog) {
      const link = document.createElement('a');
      link.href = '/cart/goodsList.htm';
      link.textContent = '返回商品目录';
      actions.append(link);
    }
    panel.append(heading, copy, actions);
    anchor.before(panel);
    return panel;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const id = new URLSearchParams(location.search).get('id') || '';
    const validId = /^[1-9]\d*$/.test(id);
    const Vue = window.Vue;
    let dcim;
    let quoteRevision = 0;
    let quoteFailure = '';
    let quoteLoading = false;
    let quotePanel;
    let unavailable = false;

    const quoteTitles = {
      setup: '商品选配暂时无法读取',
      'empty-setup': '商品当前无可选配置',
      period: '计费周期暂时无法读取',
      price: '暂时无法获取报价',
    };

    function quoteState(kind, result) {
      if (!dcim || dcim._isDestroyed) return;
      quoteLoading = result === 'loading';
      const anchor = dcim.$el.querySelector('.mf-dcim');
      if (result === 'error') {
        quoteFailure = kind;
        dcim.loadingPrice = false;
        dcim.isInit = false;
        dcim.$el.setAttribute('data-cra1-dcim-read-failed', '');
        if (quotePanel?.dataset.kind !== kind && anchor) {
          quotePanel?.remove();
          const setup = kind === 'setup' || kind === 'empty-setup';
          quotePanel = feedback(anchor, quoteTitles[kind], setup ? '可以重新加载，或返回商品目录。'
            : '当前配置已保留，请重新加载后确认价格。', () => {
              if (quoteLoading) return;
              if (setup) dcim.getConfig();
              else if (quoteFailure === 'period') dcim.getCycleList();
              else dcim.changeConfig();
            }, setup);
          quotePanel.dataset.kind = kind;
        }
      } else if (result === 'ready') {
        quoteFailure = '';
        dcim.$el.removeAttribute('data-cra1-dcim-read-failed');
        quotePanel?.remove();
        quotePanel = null;
      }
      const retry = quotePanel?.querySelector('button');
      if (retry) retry.disabled = quoteLoading;
    }

    const Axios = window.Axios;
    if (validId && Axios?.interceptors?.request) {
      // Limit the transport adaptation to the current product's reads. Native
      // request headers, configuration methods, and purchase handlers stay in use.
      Axios.interceptors.request.use(config => {
        const url = String(config.url || '').split('?')[0].replace(/^\/console\/v1\//, '/');
        const httpMethod = String(config.method || '').toLowerCase();
        const option = url === '/product/' + id + '/config_option';
        const kind = httpMethod === 'get' && option ? 'config'
          : httpMethod === 'get' && dcim && url === '/product/' + id + '/mf_dcim/order_page' ? 'setup'
          : httpMethod === 'post' && dcim && option ? 'price'
          : httpMethod === 'post' && dcim && url === '/product/' + id + '/mf_dcim/duration' ? 'period' : '';
        if (!kind) return config;
        const adapter = typeof config.adapter === 'function' ? config.adapter : window.axios?.getAdapter?.(config.adapter);
        if (!adapter) return config;
        let revision;
        if (kind !== 'config') {
          revision = ++quoteRevision;
          quoteState(kind, 'loading');
        }
        config.timeout = Math.min(Number(config.timeout) || 30000, 30000);
        config.adapter = async nativeConfig => {
          let status;
          let showAs = kind;
          try {
            const response = await adapter(nativeConfig);
            const envelope = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            status = Number(envelope?.status);
            const data = envelope?.data;
            if (kind === 'setup' && status === 200 &&
                [data?.model_config, data?.data_center].some(values => Array.isArray(values) && !values.length)) {
              showAs = 'empty-setup';
            }
            const usable = kind === 'config' ? typeof data?.content === 'string' && data.content.trim()
              : kind === 'setup' ? showAs !== 'empty-setup' && Array.isArray(data?.model_config) && Array.isArray(data?.data_center)
              : kind === 'period' ? Array.isArray(data) && data.length > 0
              : data?.price_total != null && data.price_total !== '' && Number.isFinite(Number(data.price_total))
                && Number(data.price_total) >= 0 && Array.isArray(data.sub_host);
            if (status !== 200 || !usable) throw new Error('Cart read unavailable');
            if (revision === quoteRevision) quoteState(kind, 'ready');
            return response;
          } catch (error) {
            if (kind === 'config') {
              const code = Number(error.response?.data?.status || error.response?.status || status);
              unavailable = [403, 404].includes(code);
            } else if (revision === quoteRevision) {
              quoteState(showAs, 'error');
            }
            const message = quoteTitles[showAs] || '商品配置暂时无法读取';
            // The native client redirects on raw network failures and reads error.data.msg
            // for a quote. Report this scoped failure using its normal error contract.
            throw Object.assign(new Error(message), { config: nativeConfig, data: { msg: message } });
          }
        };
        return config;
      });
    }

    Vue?.mixin({
      beforeCreate() {
        const methods = this.$options.methods;
        if (!methods || this.$parent) return;
        if (typeof methods.getList === 'function' && typeof methods.getGoodDetail === 'function'
            && typeof methods.handleCommand === 'function' && document.querySelector('.goods .config-box')) {
          let panel;
          let busy = false;
          this.$options.methods = { ...methods,
            getGoodDetail(...args) {
              if (this.content) return methods.getGoodDetail.apply(this, args);
            },
            async getList(...args) {
              if (busy) return;
              busy = true;
              this.commonData = this.commonData || {};
              const button = panel?.querySelector('button');
              if (button) button.disabled = true;
              unavailable = false;
              try {
                if (validId) await methods.getList.apply(this, args);
                await this.$nextTick();
              } catch (error) {
                this.content = '';
              } finally {
                busy = false;
              }
              if (this.content && this.content.trim()) {
                panel?.remove();
                panel = null;
                return;
              }
              const loader = document.getElementById('mainLoading');
              if (loader) loader.style.display = 'none';
              this.$el.style.display = 'block';
              const anchor = this.$el.querySelector('.config-box .content');
              if (!anchor) return;
              if (panel) panel.remove();
              const retry = validId && !unavailable ? async () => {
                await this.getList();
                if (this.content && Number(this.commonData.cart_change_product) === 1) this.getGoodDetail(this.id);
              } : null;
              panel = feedback(anchor, !validId ? '请选择需要配置的商品' : unavailable ? '商品当前不可用' : '商品配置暂时无法读取',
                !validId || unavailable ? '可返回商品目录选择其他商品。' : '商品可能已下架，也可能是临时读取失败。',
                retry, true);
            },
          };
        }
        if (typeof methods.getConfig !== 'function' || typeof methods.getCycleList !== 'function' || typeof methods.formatConfig !== 'function'
            || typeof methods.changeConfig !== 'function' || !document.querySelector('.config-box .content .mf-dcim')) return;
        dcim = this;
        const guarded = { ...methods };
        ['handlerCart', 'submitOrder'].forEach(action => {
          if (typeof methods[action] !== 'function') return;
          guarded[action] = function (...args) {
            if (quoteFailure || quoteLoading || this.loadingPrice) return;
            return methods[action].apply(this, args);
          };
        });
        this.$options.methods = guarded;
      },
    });
  }, { once: true });
})();
