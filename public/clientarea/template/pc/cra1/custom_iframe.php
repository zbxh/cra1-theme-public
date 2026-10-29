{include file="header"}
</head>
<body>
  <div id="mainLoading"><div class="ddr ddr1"></div><div class="ddr ddr2"></div><div class="ddr ddr3"></div><div class="ddr ddr4"></div><div class="ddr ddr5"></div></div>
  <div class="cra1-page">
    <div class="cra1-shell">
      <aside-menu @getruleslist="getRule"></aside-menu>
      <div class="cra1-shell__body">
        <top-menu ref="topMenuRef"></top-menu>
        <main class="cra1-shell__content" id="cra1-content-slot" style="font-size:14px;line-height:1.6">
          <p role="status" id="cra1-embedded-status">正在加载…</p>
        </main>
      </div>
    </div>
  </div>
  <script src="{:cra1_theme_asset_url('native', 'js/shell.js', '/clientarea/template/pc/cra1/js/shell.js')}"></script>
  <script src="{:cra1_theme_asset_url('native', 'js/embedded.js', '/clientarea/template/pc/cra1/js/embedded.js')}"></script>
  {include file="footer"}
