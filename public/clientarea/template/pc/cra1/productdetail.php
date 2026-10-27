<?php
$__schUrl = '';
try {
    $__schPid = \think\facade\Db::name('plugin')->where('name', 'SelfChangeIp')->where('module', 'addon')->where('status', 1)->value('id');
    $__schHostId = request()->param('id', 0);
    if ($__schPid && \addon\self_change_ip\logic\RuleInputValidator::integer($__schHostId, 1)) {
        $__schUrl = (new \addon\self_change_ip\logic\SelfChangeIpLogic())->clientEntryUrl(intval($__schHostId), get_client_id(), get_client_id(false));
    }
} catch (\Throwable $e) {
    // 无法确认当前商品/主机支持时保持入口隐藏。
}
$__schUrlJson = json_encode($__schUrl, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
?>
{include file="header"}
</head>

<body>
  <div id="mainLoading"><div class="ddr ddr1"></div><div class="ddr ddr2"></div><div class="ddr ddr3"></div><div class="ddr ddr4"></div><div class="ddr ddr5"></div></div>

  <!-- Vue 外壳（侧边栏 + 顶栏）+ React 内容槽 -->
  <div id="productdetail" class="cra1-page">
    <div class="cra1-shell">
      <aside-menu :menu-active-id="5" @getruleslist="getRule"></aside-menu>
      <div class="cra1-shell__body">
        <top-menu ref="topMenuRef"></top-menu>
        <main class="cra1-shell__content" id="cra1-content-slot"></main>
      </div>
    </div>
  </div>

  <link rel="stylesheet" href="{:cra1_theme_asset_url('member', 'assets/css/app.css', '/clientarea/template/pc/cra1/releases/20261017-member-auth-v2/assets/css/app.css')}">
  <script src="{:cra1_theme_asset_url('native', 'js/shell.js', '/clientarea/template/pc/cra1/releases/20261017-compat-v3/js/shell.js')}"></script>
  <script type="module" src="{:cra1_theme_asset_url('member', 'assets/js/productdetail.js', '/clientarea/template/pc/cra1/releases/20261017-member-auth-v2/assets/js/productdetail.js')}"></script>
  <!-- SelfChangeIp: 产品详情页"更换IP"入口(模块界面渲染后注入按钮) -->
  <script>
    /* 服务器控制面板只显示当前使用中且已开放更换的产品入口。 */
    window.__CRA1_SELF_CHANGE_IP_URL__ = {$__schUrlJson|raw};
  </script>
  <script>
  (function () {
    var hostId = new URLSearchParams(location.search).get('id') || '';
    var inserted = false;
    var pluginUrl = window.__CRA1_SELF_CHANGE_IP_URL__ || '';
    function tryInsert() {
      if (inserted) return;
      // React 服务器控制面板接管时不再注入（面板内有原生「更换IP」入口）
      if (document.querySelector('.server-panel')) return;
      var url = pluginUrl;
      if (!url || !hostId) return;
      // 找操作区"退订"按钮(模块头部操作区), 找不到则等下一轮
      var target = null;
      var cands = Array.prototype.filter.call(document.querySelectorAll('button, a, span'), function (b) {
        return b.offsetParent !== null && /退\s*订/.test(b.innerText || '') && b.children.length === 0;
      });
      for (var i = 0; i < cands.length; i++) {
        if (cands[i].closest('.row2-right, [class*="operation"], [class*="header"]')) { target = cands[i]; break; }
      }
      if (!target && cands.length) target = cands[0];
      if (!target) {
        // 兜底: 插到模块界面标题区(含产品IP的行)右侧
        var ipEl = Array.prototype.find.call(document.querySelectorAll('span,div'), function (e) {
          return e.children.length === 0 && e.offsetParent !== null && /103\.|^\d{1,3}(\.\d{1,3}){3}$/.test((e.innerText || '').trim());
        });
        if (!ipEl) return;
        target = ipEl.parentElement;
      }
      if (!target) return;
      var btn = document.createElement('button');
      btn.className = 'sch-pd-change-ip';
      btn.setAttribute('title', '前往自助更换IP');
      btn.innerHTML = '<svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor" style="margin-right:5px;vertical-align:-2px"><path d="M512 85.333333c235.648 0 426.666667 191.018667 426.666667 426.666667s-191.018667 426.666667-426.666667 426.666667S85.333333 747.648 85.333333 512 276.352 85.333333 512 85.333333z m0 85.333334a341.333333 341.333333 0 1 0 0 682.666666 341.333333 341.333333 0 0 0 0-682.666666z m0 469.333333a42.666667 42.666667 0 1 1 0 85.333333 42.666667 42.666667 0 0 1 0-85.333333z m0-341.333333c64.8 0 117.333333 52.533333 117.333333 117.333333 0 38.528-19.648 72.490667-49.450666 92.330667a42.666667 42.666667 0 0 0-25.216 38.954667V469.333333a42.666667 42.666667 0 1 1-85.333334 0c0-38.528 19.648-72.490667 49.450667-92.330666A42.666667 42.666667 0 0 0 512 341.333333z"/></svg>更换IP';
      btn.addEventListener('click', function () {
        window.location.href = url + '?host_id=' + hostId;
      });
      target.parentNode.insertBefore(btn, target);
      inserted = true;
    }
    var n = 0;
    var timer = setInterval(function () {
      tryInsert();
      if (inserted || ++n > 40) clearInterval(timer);
    }, 500);
  })();
  </script>
  {include file="footer"}
