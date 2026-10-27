<?php
/** Template compatibility helper. No configuration is exposed as an HTTP response. */
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
if(!function_exists('cra1_theme_asset_url')){
    function cra1_theme_asset_url(string $domain,string $file,string $fallback=''): string
    {return \CRA1\Theme\Release\Assets::url($domain,$file,$fallback);}
}
