{include file="header"}
</head>
<body>
  <div id="mainLoading"><div class="ddr ddr1"></div><div class="ddr ddr2"></div><div class="ddr ddr3"></div><div class="ddr ddr4"></div><div class="ddr ddr5"></div></div>
  <div id="cashier" class="cra1-page"><div class="cra1-shell">
    <aside-menu :menu-active-id="3" @getruleslist="getRule"></aside-menu>
    <div class="cra1-shell__body"><top-menu ref="topMenuRef"></top-menu><main class="cra1-shell__content" id="cra1-content-slot"></main></div>
  </div></div>
  <link rel="stylesheet" href="{:cra1_theme_asset_url('member', 'assets/css/app.css', '/clientarea/template/pc/cra1/assets/css/app.css')}">
  <link rel="stylesheet" href="{:cra1_theme_asset_url('member', 'assets/css/cashier.css', '/clientarea/template/pc/cra1/assets/css/cashier.css')}">
  <script src="{:cra1_theme_asset_url('native', 'js/shell.js', '/clientarea/template/pc/cra1/js/shell.js')}"></script>
  <script type="module" src="{:cra1_theme_asset_url('member', 'assets/js/cashier.js', '/clientarea/template/pc/cra1/assets/js/cashier.js')}"></script>
  {include file="footer"}
