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
