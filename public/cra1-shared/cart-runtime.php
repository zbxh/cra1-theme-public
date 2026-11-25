<?php
/** CRA1 cart pages can use a separately selected native member shell. */
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}
require_once __DIR__.'/assets.php';
require_once __DIR__.'/runtime.php';
function cra1_cart_allow_zoom(): void
{
    // Some V10 versions render the independent member shell before theme code
    // runs. Update that existing viewport while the cart document is parsed.
    echo '<script>(function(){var viewport=document.querySelector("head meta[name=viewport]");'
        .'if(!viewport)return;var content=viewport.content;'
        .'var allowed=content.replace(/(?:^|[,;])\s*(?:maximum-scale|minimum-scale|user-scalable)\s*=[^,;]*/gi,"").replace(/^[,;]+/,"");'
        .'if(allowed!==content)viewport.content=allowed;})();</script>';
}
function cra1_cart_runtime(string $shell): void
{
    if(\CRA1\Theme\Context::isCRA1($shell))return;
    cra1_cart_allow_zoom();
    $json=static function($value){return json_encode($value,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE);};
    $asset=static function($domain,$file){return htmlspecialchars(cra1_theme_asset_url($domain,$file),ENT_QUOTES,'UTF-8');};
    $page=basename((string)parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH),'.htm');
    $nativeShell=in_array($shell,['default','pc/default','mobile/default'],true)?'default':'';
    echo '<script>document.documentElement.setAttribute("data-cra1-theme","cart");document.documentElement.setAttribute("data-cra1-cart-native-shell",'.$json($nativeShell).');window.__CRA1_SHARED_BASE__="/clientarea/template/pc/default/";window.__CRA1_PAYMENT_BASE__='.$json(cra1_theme_asset_url('native','')).';window.__CRA1_RUNTIME__='.$json(CRA1ThemeRuntime::load($page)).';</script>';
    echo '<link rel="stylesheet" href="'.$asset('shared','cra1-shared.css').'">';
    echo '<script src="'.$asset('shared','cra1-shared.js').'"></script>';
    echo '<script src="/clientarea/template/pc/default/js/common/axios.min.js"></script>';
    echo '<script src="'.$asset('shared','v10-axios.js').'"></script>';
}
