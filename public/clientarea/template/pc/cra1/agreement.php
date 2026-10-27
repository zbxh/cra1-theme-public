{include file="header"}
<link rel="stylesheet" href="{:cra1_theme_asset_url('member', 'assets/css/app.css', '/clientarea/template/pc/cra1/releases/20261017-member-auth-v2/assets/css/app.css')}">
<script>window.__CRA1_PAGE__ = {:json_encode([
    'website_name' => configuration('website_name') ?: '智简魔方',
    'lang'         => $lang_home ?? 'zh-cn',
], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE)};</script>
</head>

<body>
  <div id="root"></div>
  <script type="module" src="{:cra1_theme_asset_url('member', 'assets/js/agreement.js', '/clientarea/template/pc/cra1/releases/20261017-member-auth-v2/assets/js/agreement.js')}"></script>
  {include file="footer"}
