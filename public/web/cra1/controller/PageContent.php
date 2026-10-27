<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

require_once __DIR__ . "/ContentDefaults.php";
/** One page resolver shared by the site, editor and draft preview. */
function cra1_page_content_config(string $page, array $config): array
{
    $config['_page_key'] = $page;
    $doc = json_decode((string) ($config['page_content_overrides_json'] ?? ''), true);
    $values = is_array($doc) ? ($doc['pages'][$page]['values'] ?? []) : [];
    if (!is_array($values)) return $config;
    $config['_page_explicit_fields'] = array_keys($values);
    foreach ($values as $key => $value) {
        if (is_scalar($value) || $value === null) $config[$key] = $value;
    }
    if ($values && function_exists('cra1_theme_derived_config')) $config = cra1_theme_derived_config($config);
    return $config;
}

/** Valid preview tokens carry display configuration only, never live accounts. */
function cra1_admin_preview_document(?string $root = null): ?array
{
    $doc=$GLOBALS['THEME_VERIFIED_PREVIEW']??null;
    return is_array($doc)&&($doc['expires']??0)>=time() ? $doc : null;
}
function cra1_admin_preview_config(): ?array
{
    $doc=cra1_admin_preview_document();
    return $doc && ($doc['domain']??'')==='website' ? $doc['config'] : null;
}

/** Template defaults only apply when the corresponding logical value is absent. */
function cra1_content_explicit(array $config,string $key): bool
{
    $explicit=array_merge($config['_page_explicit_fields']??[], $config['_public_explicit_fields']??[]);
    if(in_array($key,$explicit,true))return true;
    if(preg_match('/^(\w+)_copy\.(\w+)$/',$key,$m))return in_array('copy_'.$m[1].'_text',$explicit,true)&&array_key_exists($m[2],$config[$m[1].'_copy']??[]);
    if(preg_match('/^(\w+)_copy$/',$key,$m))return in_array('copy_'.$m[1].'_text',$explicit,true);
    if(preg_match('/^prod_(overview|advantages|scenarios|service|faq|cta)_(title|desc|items)$/',$key,$m))return in_array('prod_'.$m[1].($m[2]==='items'?'_items_text':'_title_text'),$explicit,true);
    if($key==='prod_service_heads')return in_array('prod_service_heads_text',$explicit,true);
    if(strpos($key,'prod_cta_btn1.')===0)return in_array('prod_cta_btn1_text',$explicit,true);
    if(strpos($key,'page_hero_')===0)return in_array($key==='page_hero_anchors'?'page_hero_anchor_text':'page_hero_rows_text',$explicit,true);
    if (preg_match('/^sol_ind_(\w+)_highlights$/',$key,$m)) return in_array('sol_ind_'.$m[1].'_highlights_text',$explicit,true);
    if (in_array($key,['sol_hero_btn_html','sol_cta_html'],true)) return in_array(str_replace('_html','_text',$key),$explicit,true);
    if (array_key_exists($key.'_text',$config)) return in_array($key.'_text',$explicit,true);
    $parsed=['sol_home_cards'=>'sol_home_cards_text','cap_cards'=>'cap_cards_text','band_items'=>'band_items_text','slides'=>'slides_text','nodes'=>'nodes_text'];
    return isset($parsed[$key])&&in_array($parsed[$key],$explicit,true);
}
function cra1_content_value(array $config,string $key,string $fallback)
{
    $v=$config;foreach(explode('.',$key)as$part)$v=is_array($v)?($v[$part]??null):null;
    return cra1_content_explicit($config,$key)?($v??''):($v?:$fallback);
}
