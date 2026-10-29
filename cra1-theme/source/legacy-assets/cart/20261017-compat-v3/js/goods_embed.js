/**
 * goods_embed 桥接与加载器（融合页配置薄壳）
 *
 * 职责：
 *   1. 以「前台模式」加载商品配置（flag 恒为 false，不因处于 iframe 而放宽隐藏商品）；
 *   2. 加载完成后向父页上报 ready/resize/error，消息带 embed_nonce + product_id，
 *      父页负责校验 origin/source/nonce；
 *   3. 高度自适应：ResizeObserver + 兜底定时器；
 *   4. 模块在 iframe 内导航到结算/购物车时，由父页提升为顶层跳转（父页监听 iframe load）。
 *
 * 模块内容仍由系统 header 注入的 jQuery `.html()` 机制加载（CSS/JS 顺序执行），
 * 本文件不改模块模板与计价逻辑。
 */
(function (window) {
  var params = new URLSearchParams(window.location.search);
  var productId = params.get('id') || params.get('product_id') || '';
  var nonce = params.get('embed_nonce') || '';
  var EMBED_FLAG = params.get('embed') === '1';

  // 原生商品模块仍从地址读取 id。先统一别名，再装载模块，避免只有
  // 外层加载器识别 product_id、内层却请求 undefined 商品的情况。
  // 保留原参数、父页校验用的 nonce、锚点和历史状态，不新增历史记录。
  if (!params.has('id') && /^[1-9]\d*$/.test(productId)) {
    params.set('id', productId);
    window.history.replaceState(window.history.state, '',
      window.location.pathname + '?' + params.toString() + window.location.hash);
  }

  function post(type, extra) {
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage(Object.assign({
        type: type,
        productId: productId,
        nonce: nonce,
        v: 1,
      }, extra || {}), window.location.origin);
    } catch (e) { /* 父页不存在或被销毁：静默 */ }
  }

  function postHeight() {
    var h = Math.max(
      document.documentElement.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    post('config-resize', { height: h });
  }

  window.__CART_EMBED__ = {
    productId: productId,
    nonce: nonce,
    embed: EMBED_FLAG,
    ready: false,
    /**
     * 配置内容装载完成后由 loader 调用：通知父页就绪并启动高度观察。
     */
    markReady: function () {
      if (this.ready) return;
      this.ready = true;
      var loading = document.getElementById('mainLoading');
      if (loading) loading.style.display = 'none';
      var root = document.querySelector('.cart-embed');
      if (root) root.style.display = 'block';
      postHeight();
      post('config-ready', {});
      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function () { postHeight(); });
        ro.observe(document.documentElement);
        var content = document.querySelector('.config-box .content');
        if (content) ro.observe(content);
      }
      setInterval(postHeight, 1200); // 兜底：模块内部异步渲染后高度变化
    },
    /**
     * 配置加载失败：父页展示重试与独立页出口。
     */
    fail: function (msg) {
      var message = window.CRA1Shared?.Errors?.message(msg, { fallback:'商品配置暂时无法加载，请稍后重试' }) || '商品配置暂时无法加载，请稍后重试';
      post('config-error', { message: message });
      var box = document.querySelector('.config-box .content');
      if (box) {
        var state = document.createElement('div');
        state.className = 'embed-error';
        state.textContent = message;
        box.replaceChildren(state);
      }
      var loading = document.getElementById('mainLoading');
      if (loading) loading.style.display = 'none';
      var root = document.querySelector('.cart-embed');
      if (root) root.style.display = 'block';
    },
  };

  // 加购数量变化时通知父页（模块写 localStorage.cartNum，本壳转发）
  window.addEventListener('storage', function (e) {
    if (e.key === 'cartNum') {
      post('cart-count', { count: String(e.newValue || '').split('-')[1] * 1 || 0 });
    }
  });

  /* ======================================================================
   * v6 价格计算器桥接：父页侧栏 ↔ 模块 Vue 实例
   * 模块根实例挂载于 .template（cloud/dcim 与 common 同理），
   * 同源可直接读写 data / 调用方法（changeDuration/changQty/changeCycle）。
   * VM 不可达（超时）时 post rail-fallback，父栏降级提示、iframe 保留原生侧栏。
   * ==================================================================== */
  var RAIL_POLL_MS = 800;
  var railVM = null;
  var railKind = ''; // 'f-order' | 'order-right'
  var railLastSnap = '';
  var railWatchTimer = null;
  var railAwaitSince = 0;
  var railUnavailable = false;

  function railFindVM() {
    var els = document.querySelectorAll('.template');
    for (var i = 0; i < els.length; i++) {
      if (els[i].__vue__) return els[i].__vue__;
    }
    return null;
  }

  function railFmt(n) {
    var v = Number(n);
    if (!isFinite(v)) return '';
    return v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function railIsFiniteNum(v) { return v !== undefined && v !== null && v !== '' && isFinite(Number(v)); }

  /** 采集当前模块的侧栏数据快照（cloud/dcim 与 common 两套结构） */
  function railCollect() {
    var vm = railVM;
    if (!vm) return null;
    var snap = null;
    if (railKind === 'f-order') {
      // cloud / dcim：周期 cycleList + params.duration_id，数量 qty，服务端计价 calcTotalPrice/totalPrice
      var durations = (vm.cycleList || []).map(function (d, i) {
        var name = d && (d.name || ((d.num || '') + (d.unit || '')));
        return { id: d && d.id !== undefined ? d.id : i, name: String(name || ('周期' + (i + 1))) };
      }).filter(function (d) { return d.name; });
      if (!durations.length) return null;
      var calc = railIsFiniteNum(vm.calcTotalPrice) ? Number(vm.calcTotalPrice) : null;
      var total = railIsFiniteNum(vm.totalPrice) ? Number(vm.totalPrice) : null;
      // 当前配置明细（f-order「配置费用」popover 的数据源）
      var items = [];
      var pv = vm.preview;
      if (pv) {
        if (Array.isArray(pv)) {
          items = pv.map(function (it) {
            return { name: String(it && it.name || ''), value: String(it && it.value || ''), price: it && it.price ? String(it.price) : '' };
          }).filter(function (it) { return it.name || it.value; });
        } else if (typeof pv === 'object') {
          Object.keys(pv).forEach(function (k) {
            var it = pv[k];
            items.push({ name: String(it && it.name || k), value: String(it && it.value || ''), price: it && it.price ? String(it.price) : '' });
          });
        }
      }
      snap = {
        kind: railKind,
        durations: durations,
        current: vm.params && vm.params.duration_id !== undefined ? vm.params.duration_id : (durations[0] && durations[0].id),
        qty: {
          allow: vm.qty !== undefined,
          min: 1,
          max: Number(vm.calcQtyMax) > 0 ? Number(vm.calcQtyMax) : 999,
          cur: Number(vm.qty) || 1,
        },
        price: {
          currency: String(window.CRA1Shared.Runtime.common().currency_prefix ?? vm.currency_prefix ?? '¥'),
          suffix: String(window.CRA1Shared.Runtime.common().currency_suffix ?? vm.currency_suffix ?? ''),
          calcText: calc !== null ? railFmt(calc) : '',
          originText: total !== null && calc !== null && total > calc ? railFmt(total) : '',
          hasDiscount: !!vm.hasDiscount,
        },
        preview: items,
      };
    } else if (railKind === 'order-right') {
      // common：周期卡 custom_cycles + curCycle 索引；数量受 allow_qty 控制；totalPrice 应付
      var cycles = (vm.custom_cycles || []).map(function (c, i) {
        return { id: i, name: String((c && (c.name || c.cycle_name)) || '周期' + (i + 1)) };
      });
      if (!cycles.length) return null;
      var pay = railIsFiniteNum(vm.totalPrice) ? Number(vm.totalPrice) : null;
      var orig = railIsFiniteNum(vm.original_price) ? Number(vm.original_price) : null;
      // 配置预览行在 .order-right .info .des（name/price 同行文本），从 DOM 提取
      var cItems = [];
      try {
        document.querySelectorAll('.order-right .info .des').forEach(function (r) {
          var name = r.querySelector('.name');
          var price = r.querySelector('.price');
          var text = (name ? name.textContent : r.textContent).trim();
          if (text) cItems.push({ name: text, value: '', price: price ? price.textContent.trim() : '' });
        });
      } catch (e) { }
      snap = {
        kind: railKind,
        durations: cycles,
        current: Number(vm.curCycle) || 0,
        qty: {
          allow: !!(vm.basicInfo && vm.basicInfo.allow_qty && vm.orderData),
          min: 1,
          max: 999,
          cur: vm.orderData ? Number(vm.orderData.qty) || 1 : 1,
        },
        price: {
          currency: String(window.CRA1Shared.Runtime.common().currency_prefix ?? vm.currency_prefix ?? '¥'),
          suffix: String(window.CRA1Shared.Runtime.common().currency_suffix ?? vm.currency_suffix ?? ''),
          calcText: pay !== null ? railFmt(pay) : '',
          originText: orig !== null && pay !== null && orig > pay ? railFmt(orig) : '',
          hasDiscount: false,
        },
        preview: cItems,
      };
    }
    return snap;
  }

  function railPush(force) {
    var snap = railCollect();
    if (!snap) {
      // A native VM may exist before it has billing periods, or the product may
      // have none. Do not hide its controls or leave the parent loading forever.
      if (!railUnavailable && Date.now() - railAwaitSince >= 12000) {
        railUnavailable = true;
        document.body.classList.remove('rail-bridged');
        document.body.classList.add('rail-fallback');
        post('rail-fallback', { message: '暂时无法获取可用付款周期，请检查商品配置、重试或选择其他商品。' });
        postHeight();
      }
      return;
    }
    document.body.classList.remove('rail-fallback');
    document.body.classList.add('rail-bridged');
    if (railUnavailable) force = true;
    railUnavailable = false;
    var sig = JSON.stringify([snap.current, snap.qty.cur, snap.price.calcText, snap.price.originText]);
    if (!force && sig === railLastSnap) return;
    railLastSnap = sig;
    post(force ? 'rail-data' : 'rail-updated', { payload: snap });
  }

  function railStartBridge() {
    railAwaitSince = Date.now();
    railUnavailable = false;
    railPush(true);
    if (railWatchTimer) clearInterval(railWatchTimer);
    railWatchTimer = setInterval(function () { railPush(false); }, RAIL_POLL_MS);
  }

  function railExec(action) {
    var vm = railVM;
    if (!vm || !action) return;
    var field = action.field, value = action.value;
    try {
      if (field === 'duration') {
        if (railKind === 'f-order') {
          if (vm.params) vm.params.duration_id = value;
          if (typeof vm.changeDuration === 'function') vm.changeDuration();
        } else {
          var idx = Number(value) || 0;
          var item = (vm.custom_cycles || [])[idx];
          if (item && typeof vm.changeCycle === 'function') vm.changeCycle(item, idx);
        }
      } else if (field === 'qty') {
        var q = Math.max(1, Math.min(Number(value) || 1, Number(vm.calcQtyMax) > 0 ? Number(vm.calcQtyMax) : 999));
        if (railKind === 'f-order') {
          vm.qty = q;
          if (typeof vm.changQty === 'function') vm.changQty();
        } else if (vm.orderData) {
          vm.orderData.qty = q;
          if (typeof vm.changeConfig === 'function') vm.changeConfig();
        }
      } else if (field === 'coupon') {
        var inp = document.querySelector('.discount-code input, .discount-box input');
        if (inp) {
          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(inp, String(value || ''));
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          var btn = inp.closest('.discount-code, .discount-box');
          btn = btn && btn.querySelector('button, .btn, [class*="confirm"], [class*="exchange"]');
          if (btn) btn.click();
          else inp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    } catch (e) { /* 模块方法异常：轮询会把实际状态回传父页 */ }
    setTimeout(function () { railPush(false); }, 900);
  }

  function railClick(selector) {
    var el = document.querySelector(selector);
    if (el) { el.click(); return true; }
    return false;
  }

  function railDoAdd() {
    var ok = railKind === 'order-right'
      ? railClick('.order-right .f-btn .cart')
      : railClick('.f-order .right .add-cart');
    if (!ok) { // 兜底：直接调模块方法
      try {
        if (railKind === 'order-right' && typeof railVM.addCart === 'function') railVM.addCart();
        else if (typeof railVM.handlerCart === 'function') railVM.handlerCart();
      } catch (e) { }
    }
    // 监听模块加购成功对话框（渲染在 iframe 文档内）：出现即关闭——
    // 模块对话框+全屏遮罩会罩住配置区（看起来像独立深色模块），父页确认框独占交互
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var dlg = document.querySelector('.cartDialog');
      var visible = dlg && dlg.offsetHeight > 0;
      if (visible) {
        clearInterval(t);
        try {
          if (railVM && railVM.cartDialog === true) railVM.cartDialog = false;
          else {
            var btn = dlg.querySelector('.dialog-footer button');
            if (btn) btn.click();
          }
        } catch (e) { }
        post('rail-added', {});
      } else if (tries > 60) { // ~3.6s 无对话框视为失败，解除父页等待
        clearInterval(t);
        post('rail-added', { failed: true });
      }
    }, 60);
  }

  function railDoCloseDialog() {
    try {
      if (railVM && railVM.cartDialog === true) { railVM.cartDialog = false; return; }
      var btn = document.querySelector('.cartDialog .dialog-footer button');
      if (btn) btn.click();
    } catch (e) { }
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { return; } }
    if (!data || data.v !== 1 || data.source !== 'cart-parent') return;
    if (String(data.productId) !== String(productId) || data.nonce !== nonce) return;
    if (data.type === 'rail-init') railBoot(true);
    else if (data.type === 'shell-config') {
      // 父页下发壳层配置（v6.5：选配方式标题文本，后台可自定义）
      if (data.tabsTitle) {
        // 以合法 CSS 字符串注入（带 JSON 引号）：content: var(--tabs-title) 裸文本会在
        // 计算值阶段非法（IACVT → content: none，标题消失）；带引号则正常渲染文本本身。
        document.documentElement.style.setProperty('--tabs-title', JSON.stringify(String(data.tabsTitle).slice(0, 20)));
      }
    }
    else if (data.type === 'rail-set') railExec(data);
    else if (data.type === 'rail-add') railDoAdd();
    else if (data.type === 'rail-save') {
      // Editing updates the existing cart position through the module's own
      // validation and update API; it must never add another item or check out.
      if (railVM && typeof railVM.changeCart === 'function') railVM.changeCart();
    }
    else if (data.type === 'rail-close') railDoCloseDialog();
    else if (data.type === 'rail-buy') {
      var ok = railKind === 'order-right'
        ? railClick('.order-right .f-btn .buy-btn')
        : railClick('.f-order .right .buy');
      if (!ok) {
        try {
          if (railKind === 'order-right' && typeof railVM.buyNow === 'function') railVM.buyNow();
          else if (typeof railVM.submitOrder === 'function') railVM.submitOrder();
        } catch (e) { }
      }
    }
  });

  function railContract(vm) {
    if (document.querySelector('.f-order') && Array.isArray(vm.cycleList) && vm.params
        && vm.calcTotalPrice !== undefined && typeof vm.handlerCart==='function' && typeof vm.submitOrder==='function') return 'f-order';
    if (document.querySelector('.order-right') && Array.isArray(vm.custom_cycles)
        && vm.totalPrice !== undefined && typeof vm.addCart==='function' && typeof vm.buyNow==='function') return 'order-right';
    return '';
  }
  function nativeControls() {
    document.body.classList.remove('rail-bridged');
    document.body.classList.add('rail-native');
    postHeight();
    post('rail-fallback', { message: '请在下方查看价格并完成订购。' });
  }
  function railBoot(force) {
    if (new URLSearchParams(location.search).get('native_controls')==='1') { nativeControls(); return; }
    if (railVM && !force) { railStartBridge(); return; }
    var waited = 0;
    var t = setInterval(function () {
      var vm = railFindVM();
      if (vm) {
        clearInterval(t);
        railKind = railContract(vm);
        if (!railKind) { nativeControls(); return; }
        railVM = vm;
        railStartBridge();
      } else if ((waited += 400) >= 12000) {
        clearInterval(t);
        // 桥接超时降级：显示模块原生侧栏（v5 卡片形态），父栏同步提示
        document.body.classList.add('rail-fallback');
        postHeight();
        post('rail-fallback', { message: '请在下方查看价格并完成订购。' });
      }
    }, 400);
  }

  // markReady 后启动桥接探测（模块 JS 由系统 header jQuery 机制异步装载）
  var origMarkReady = window.__CART_EMBED__.markReady;
  window.__CART_EMBED__.markReady = function () {
    origMarkReady.call(window.__CART_EMBED__);
    railBoot(false);
  };
})(window);
