<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

/** Only the active rendering domain chooses code, never its shared shell. */
function cra1_member_shell_theme(array $param): string
{
    $theme=(string)($param['public_themes']??$param['themes']??'');
    // Plugin/module content can fall back to default while the member shell
    // still uses CRA1. The system does not pass public_themes to this hook.
    if(in_array($param['page_type']??'', ['clientarea_plugin','clientarea_module'],true)){
        $mobile=function_exists('use_mobile')&&use_mobile();$key=$mobile?'clientarea_theme_mobile':'clientarea_theme';
        $selected=function_exists('cookie')?(string)cookie($key):'';
        if($selected===''&&function_exists('configuration'))$selected=(string)configuration($key);
        if($selected!=='')$theme=$selected;
    }
    return $theme;
}
function cra1_theme_code_html(string $domain): string
{
    $runtime=function_exists('runtime_path')?runtime_path():dirname(__DIR__,4).'/runtime/';
    $filename=$domain==='member'?'member_center.json':'cart_theme.json';
    $raw=is_file($runtime.'cra1_theme/'.$filename)?json_decode((string)file_get_contents($runtime.'cra1_theme/'.$filename),true):[];
    $code=$raw['custom_code']??[];$html='';
    if(($code['css_enabled']??true)&&!empty($code['css']))$html.='<style data-theme-code="'. $domain .'">'.str_ireplace('</style','<\\/style',(string)$code['css']).'</style>';
    if(($code['js_enabled']??true)&&!empty($code['js'])){
        $html.='<script data-theme-code="'.$domain.'">(function(){var key="__CRA1_CODE_'.$domain.'";if(window[key])return;window[key]=true;function run(){try{(0,eval)('.json_encode((string)$code['js'],15).');}catch(e){console.error("主题自定义脚本运行失败",e)}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run()})();</script>';
    }
    return $html;
}
