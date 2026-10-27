<?php
/** Attach the CRA1 login guard when V10 falls back to a native page template. */
function cra1_member_session_fallback(array $param): string
{
    $theme = cra1_member_shell_theme($param);
    if (($param['page_type'] ?? '') === 'clientarea_index' && !\CRA1\Theme\Context::isCRA1($theme)) {
        $mobile = function_exists('use_mobile') && use_mobile();
        $key = $mobile ? 'clientarea_theme_mobile' : 'clientarea_theme';
        $explicit = function_exists('request') ? (string) request()->param('theme', '') : '';
        $selected = $explicit !== '' ? $explicit : (function_exists('cookie') ? (string) cookie($key) : '');
        if ($selected === '' && function_exists('configuration')) $selected = (string) configuration($key);
        $theme = $selected;
    }
    if (!\CRA1\Theme\Context::isCRA1($theme)) return '';
    // Current CRA1 pages already load the complete shared bundle. This branch
    // adds only a small guard/adapter to unmodified system fallback templates.
    require_once dirname(__DIR__,3).'/cra1-shared/assets.php';
    $base=json_encode(rtrim(cra1_theme_asset_url('shared','','/cra1-shared/releases/20261017-member-auth-v2'),'/').'/',JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_QUOT);
    return '<script>(function(){if(window.CRA1Shared&&CRA1Shared.Request&&CRA1Shared.Request.requiresLogin)return;'
        . 'var base='.$base.',script=document.createElement("script");'
        . 'script.src=base+"member-session.js";script.onload=function(){if(window.axios){var adapter=document.createElement("script");adapter.src=base+"v10-axios.js";document.head.appendChild(adapter)}};'
        . 'document.head.appendChild(script)})();</script>';
}
