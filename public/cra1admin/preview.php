<?php
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

/** CSS masks need an in-document image in an opaque sandbox, even for local SVGs. */
function cra1_preview_icon_data(string $root,string $url,string $origin): string
{
    $url=html_entity_decode($url,ENT_QUOTES,'UTF-8');$u=parse_url($url);$site=parse_url($origin);
    if(!$u||isset($u['host'])&&strtolower($u['host'])!==strtolower($site['host']??''))return '';
    $path=$u['path']??'';
    if(!preg_match('~^/cra1-shared/icons/[a-zA-Z0-9_./-]+\.svg$~D',$path)||strpos($path,'..')!==false)return '';
    $base=realpath($root.'/public/cra1-shared/icons');$file=realpath($root.'/public'.$path);
    if($base===false||$file===false||strpos($file,$base.'/')!==0||!is_file($file)||filesize($file)>131072)return '';
    return 'data:image/svg+xml;base64,'.base64_encode((string)file_get_contents($file));
}

/** Include icons used later by Alpine from JSON, as well as server-rendered masks. */
function cra1_preview_inline_icons(string $root,string $html,array $values,string $origin): string
{
    $map=[];$walk=static function($value)use(&$walk,&$map,$root,$origin){
        if(is_array($value)){foreach($value as$v)$walk($v);return;}
        if(!is_string($value))return;
        preg_match_all('~/cra1-shared/icons/[A-Za-z0-9_./-]+\.svg~',$value,$matches);
        foreach($matches[0]as$path){$data=cra1_preview_icon_data($root,$path,$origin);if($data==='')continue;
            foreach([$path,$origin.$path]as$url){$map[$url]=$data;$map[str_replace('/','\\/',$url)]=$data;}
        }
    };
    $walk($values);return $map?strtr($html,$map):$html;
}

/** Inline public styles for an opaque sandbox; fonts cannot rely on site-wide CORS. */
function cra1_preview_stylesheet(string $root,string $url,string $origin,int $depth=0): string
{
    $path=(string)parse_url(html_entity_decode($url,ENT_QUOTES,'UTF-8'),PHP_URL_PATH);
    if(!preg_match('~^/(?:web/cra1/|(?:clientarea|cart|home)/template/|plugins/[^/]+/[^/]+/template/|cra1-shared/|upload/common/|common/ticketContent\.css$)~D',$path)||strpos($path,'..')!==false||!is_file($root.'/public'.$path))return '';
    if($depth>4)return '';
    $css=(string)file_get_contents($root.'/public'.$path);
    $css=preg_replace_callback('~@import\s+(?:url\(\s*)?[\'\"]([^\'\"]+)[\'\"]\s*\)?\s*;~i',static function($m)use($root,$path,$origin,$depth){
        if(preg_match('~^(?:https?:|//)~i',$m[1]))return '';
        $parts=[];foreach(explode('/',dirname($path).'/'.$m[1])as$part){if($part==='..')array_pop($parts);elseif($part!==''&&$part!=='.')$parts[]=$part;}
        return cra1_preview_stylesheet($root,'/'.implode('/',$parts),$origin,$depth+1);
    },$css);
    return preg_replace_callback('~url\(\s*([\'\"]?)([^)\'\"]+)\1\s*\)~i',static function($m)use($root,$path,$origin){
        $value=trim($m[2]);$icon=cra1_preview_icon_data($root,$value,$origin);if($icon!=='')return 'url("'.$icon.'")';if(preg_match('~^(?:data:|blob:|https?:|//|\#)~i',$value))return $m[0];
        $parts=[];$relative=$value[0]==='/'?$value:dirname($path).'/'.$value;
        foreach(explode('/',(string)parse_url($relative,PHP_URL_PATH))as$part){if($part==='..')array_pop($parts);elseif($part!==''&&$part!=='.')$parts[]=$part;}
        $asset='/'.implode('/',$parts);$file=$root.'/public'.$asset;
        if(preg_match('/\.(woff2?|ttf|otf)$/i',$asset)&&is_file($file)&&filesize($file)<1048576){$ext=strtolower(pathinfo($file,PATHINFO_EXTENSION));return 'url("data:font/'.$ext.';base64,'.base64_encode((string)file_get_contents($file)).'")';}
        return 'url("'.$origin.$asset.(parse_url($relative,PHP_URL_QUERY)!==null?'?'.parse_url($relative,PHP_URL_QUERY):'').'")';
    },$css);
}

/** Render real theme templates against a temporary display-only configuration. */
function cra1_render_editor_preview(string $root): void
{
    $origin=rtrim((string)$GLOBALS['THEME_SETTINGS']['canonical_url'],'/');
    header_remove('X-Frame-Options');
    $paths=['/web/cra1/releases/','/web/cra1/assets/','/clientarea/template/','/cart/template/','/home/template/','/upload/common/','/upload/cra1-theme/','/cra1-shared/releases/','/cra1-shared/icons/','/cra1-shared/preview-runtime.js'];foreach(glob($root.'/public/plugins/*/*/template',GLOB_ONLYDIR)?:[]as$dir)$paths[]=substr($dir,strlen($root.'/public')).'/';$sources=implode(' ',array_map(static function($p)use($origin){return $origin.$p;},$paths));
    // Some installed ticket versions use these exact native public helpers.
    // Do not allow the entire /common path, which also serves business APIs.
    foreach(['/common/ticketContent.js','/common/ticketContent.css']as$helper)if(is_file($root.'/public'.$helper))$sources.=' '.$origin.$helper;
    $previewCsp="sandbox allow-scripts; default-src 'none'; script-src ".$sources." 'unsafe-inline' 'unsafe-eval'; style-src ".$sources." 'unsafe-inline'; img-src ".$sources." data: blob: IMAGE_SOURCES; font-src ".$sources." data:; connect-src ".$sources."; frame-src 'none'; frame-ancestors ".$origin."; object-src 'none'; base-uri 'none'; form-action 'none'";
    header('Content-Security-Policy: '.str_replace('IMAGE_SOURCES','',$previewCsp));
    require_once $root.'/public/web/cra1/controller/PageContent.php';
    $doc=cra1_admin_preview_document($root);
    if(!$doc){http_response_code(410);echo '<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><body><p data-theme-preview-error>预览已过期，请重新生成预览。</p></body></html>';return;}
    require_once $root.'/vendor/autoload.php';
    if(!defined('IDCSMART_ROOT'))define('IDCSMART_ROOT',$root.'/');
    if(!function_exists('runtime_path')){function runtime_path(){return IDCSMART_ROOT.'runtime/';}}
    if(!function_exists('view_tpl_replace')){function view_tpl_replace($content,$data,$name=''){return $content;}}
    if(!function_exists('add_hook')){function add_hook($name,$callback){}}
    // The standalone editor has no native HTTP container. Only load display
    // resolvers; registering middleware or native hooks here is unnecessary.
    if(!defined('CRA1_THEME_PREVIEW_DISPLAY_ONLY'))define('CRA1_THEME_PREVIEW_DISPLAY_ONLY',true);
    require_once $root.'/public/web/cra1/controller/hooks.php';
    $domain=$doc['domain'];$raw=$doc['config'];$tpl=new \think\Template();
    $cache=$root.'/runtime/temp/cra1_preview/';if(!is_dir($cache))mkdir($cache,0750,true);
    $tpl->config(['view_suffix'=>'php','cache_path'=>$cache,'tpl_cache'=>false,'taglib_build_in'=>'cx']);
    $common=['website_name'=>'演示站点','currency_prefix'=>'¥','currency_suffix'=>'','clientarea_logo'=>'','official_website_logo'=>'','clientarea_name'=>'演示会员中心'];
    if($doc['domain']==='website')$common=array_replace($common,cra1_system_display_config($root));
    $snapshot=['version'=>$raw['version']??1,'content'=>$raw['content']??[],'appearance'=>$raw['appearance']??[],
        'sidebar'=>$raw['sidebar']['nodes']??[],'recent'=>$raw['sidebar']['recent']??[],'nav_shape'=>$raw['sidebar']['shape']??3,'custom_code'=>$raw['custom_code']??[]];
    // Use the same public projection as real pages, including normalized menu
    // names/types and disabled-row filtering. Raw editor nodes are not UI nodes.
    require_once __DIR__.'/member_store.php';
    require_once __DIR__.'/cart_store.php';
    if($domain==='member'){
        $store=new MemberCenterStore($root.'/runtime');
        $snapshot=$store->snapshotProjection($raw);
    }elseif($domain==='cart'){
        $store=new CartThemeStore($root.'/runtime');
        $snapshot['content']=$store->publicContent($raw);
    }
    $name=$doc['editorId'];
    $data=['title'=>'主题效果预览','description'=>'','template_catalog'=>'clientarea','themes'=>'pc/cra1','public_themes'=>'pc/cra1',
        'template_catalog_cart'=>'cart','themes_cart'=>'pc/cra1','system_version'=>'10','clientarea_theme_color'=>'default','lang_home'=>'zh-cn','lang_home_follow_browser'=>0,'lang_home_open'=>1,'addons'=>[],
        'keywords'=>'','config'=>$common,'data'=>['config'=>$common], 'url'=>[], '__schUrl'=>'','__schUrlJson'=>'""'];
    if($domain==='website'){
        $page=$doc['pageKey']?:'home';$theme=$root.'/public/web/cra1/';
        $cfg=cra1_theme_config();$cfg=cra1_page_content_config($page,$cfg);$cfg=cra1_page_hero_resolve($page,$cfg);$cfg=cra1_home_cards_resolve($page,$cfg);$cfg=cra1_extra_module_copy($page,$cfg);
        $cfg['seo']=cra1_seo_resolve_page($page,$cfg,null,$common['website_name']);
        $data['title']=$cfg['seo']['titleFull']??'主题效果预览';$data['description']=$cfg['seo']['description']??'';$data['keywords']=$cfg['seo']['keywords']??'';
        $cfg['page_modules_html']=cra1_render_page_modules($page,$cfg,['config'=>$common]);
        $data['data']['page_key']=$page;
        $data['data']['cra1']=$cfg;$data['data']['header_nav']=$cfg['cloud_menu']??[];$data['themes']='cra1';$data['template_catalog']='web';
        $file=$theme.($page==='home'?'index':$page).'.html';$tpl->config(['view_path'=>$theme,'view_suffix'=>'html']);
        $source=file_get_contents($file);$source=preg_replace_callback('/\{include file="([^"]+)"\s*\/\}/',static function($m)use($theme){return is_file($theme.$m[1].'.html')?file_get_contents($theme.$m[1].'.html'):'';},$source);
    }else{
        $base=$root.'/public/clientarea/template/pc/cra1/';
        $maps=['home'=>$root.'/public/home/template/pc/cra1/home.php','products'=>$base.'productList.php','server'=>$base.'productdetail.php','login'=>$base.'login.php','regist'=>$base.'regist.php',
            'ticket'=>$root.'/public/plugins/addon/idcsmart_ticket/template/clientarea/pc/default/addTicket.html','goodslist'=>$root.'/public/cart/template/pc/cra1/goodsList.php',
            'shoppingcar'=>$root.'/public/cart/template/pc/cra1/shoppingCar.php','settlement'=>$root.'/public/cart/template/pc/cra1/settlement.php','orderresult'=>$root.'/public/cart/template/pc/cra1/orderResult.php'];
        $selected=isset($maps[$name])?$name:($domain==='member'?'home':'goodslist');$file=$maps[$selected];
        if($domain==='cart'&&$name==='goodslist'&&($_GET['part']??'')==='goods')$file=$root.'/public/cart/template/pc/cra1/goods_embed.php';
        $fragment=file_get_contents($file);$fragment=preg_replace('/<\?php.*?\?>/s','',$fragment);
        $fragment=preg_replace('/\{include file=["\'](?:header|footer)["\']\s*\/??\}/','',$fragment);
        $footer=file_get_contents($base.'footer.php');
        if($selected==='ticket'){$fragment='</head><body>'.$fragment;$scripts='';$fragment=preg_replace_callback('/<script\b[^>]*>.*?<\/script>/s',static function($m)use(&$scripts){$scripts.=$m[0];return '';},$fragment);$footer=str_replace('</body>',$scripts.'</body>',$footer);}
        $source=file_get_contents($base.'header.php').$fragment.$footer;
        if (in_array($selected,['login','regist'],true)) $source=str_replace("configuration('website_name')", "(\$config['website_name'] ?? '')", $source);
        $tpl->config(['view_path'=>$base,'view_suffix'=>'php']);
    }
    if($domain==='cart'&&$name==='goodslist'){
        $example='<div class="cl-preview-config" v-if="!isMobileCart" style="padding:22px"><h3 style="margin:0 0 20px">实例配置</h3><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px"><label>CPU 与内存<select aria-label="示例 CPU 与内存" style="display:block;width:100%;margin-top:8px;padding:10px;border:1px solid #dfe3e9;border-radius:8px"><option>2 核 CPU · 4GB 内存</option><option>4 核 CPU · 8GB 内存</option></select></label><label>系统盘<select aria-label="示例系统盘" style="display:block;width:100%;margin-top:8px;padding:10px;border:1px solid #dfe3e9;border-radius:8px"><option>50GB SSD</option><option>100GB SSD</option></select></label></div><p style="margin-top:20px;color:#858b97;font-size:12px">示例配置</p></div>';
        $source=preg_replace('/<iframe\b[^>]*class="cl-config-frame"[^>]*>.*?<\/iframe>/s',$example,$source);
    }
    if(!$source)throw new RuntimeException('对应主题模板缺失');
    $boot=['domain'=>$domain,'editorId'=>$name,'snapshot'=>$snapshot,'common'=>$common,'nonce'=>$doc['message_nonce'],'parent_origin'=>$origin,'resource_origin'=>$origin];
    if($domain==='member'&&in_array($name,['login','regist'],true)) $boot['authAppearance']=\CRA1\Theme\Storage\AuthAppearance::project($raw['content']['auth_'.$name]??[],$name);
    if($domain==='cart'&&$name==='goodslist')$boot['moduleHtml']=file_get_contents($root.'/public/plugins/server/idcsmart_common/template/cart/pc/default/goods.html');
    $runtimeUrl=\CRA1\Theme\Release\Assets::url('shared','preview-runtime.js','/cra1-shared/preview-runtime.js',$root);
    $bootstrap='<script>window.__THEME_PREVIEW__='.json_encode($boot,15).';</script><script src="'.htmlspecialchars($runtimeUrl,ENT_QUOTES,'UTF-8').'"></script>';
    // Template PHP might use an uninitialized optional value; errors remain local
    // to the preview and never redirect the editing page.
    ob_start();try{$tpl->display($source,$data);$html=ob_get_clean();}catch(Throwable$e){ob_end_clean();throw $e;}
    if($domain==='member'&&in_array($name,['login','regist'],true)){
        // Standalone auth previews need the real React entry and shared controls,
        // not the native shell or plugin boot scripts. Their business APIs remain
        // blocked by the sandbox and the preview request adapter.
        $html=preg_replace_callback('~<script\b([^>]*)src=["\']([^"\']+)["\']([^>]*)>\s*</script>~i',static function($m){
            $path=(string)parse_url(html_entity_decode($m[2],ENT_QUOTES,'UTF-8'),PHP_URL_PATH);
            return strpos($path,'/cra1-shared/')===0&&basename($path)==='cra1-shared.js'||preg_match('~type=["\']module["\']~i',$m[1].$m[3])?$m[0]:'';
        },$html);
    }
    $html=cra1_preview_inline_icons($root,$html,$data,$origin);
    $html=preg_replace_callback('~url\(\s*([\'\"]?)([^)\'\"]+)\1\s*\)~i',static function($m)use($root,$origin){$data=cra1_preview_icon_data($root,trim($m[2]),$origin);return $data!==''?'url('.$data.')':$m[0];},$html);
    $html=preg_replace('~<link\b[^>]*rel=[\"\']icon[\"\'][^>]*>~i','',$html);
    $html=preg_replace_callback('~<link\b[^>]*rel=[\"\']stylesheet[\"\'][^>]*href=[\"\']([^\"\']+)[\"\'][^>]*>~i',static function($m)use($root,$origin){$css=cra1_preview_stylesheet($root,$m[1],$origin);return $css!==''?'<style>'.$css.'</style>':$m[0];},$html);
    $html=preg_replace_callback('~<script\b[^>]*src=[\"\']([^\"\']*/theme/)index\.js[^\"\']*[\"\'][^>]*>\s*</script>~i',static function($m)use($root,$origin){return '<style>'.cra1_preview_stylesheet($root,$m[1].'default/index.css',$origin).'</style>';},$html);
    // Preview React entries are bundled as classic scripts at build time so an opaque sandbox needs no CORS exceptions.
    $html=preg_replace_callback('~<script\b[^>]*type=[\"\']module[\"\'][^>]*src=[\"\']([^\"\']+)[\"\'][^>]*>\s*</script>~i',static function($m)use($root){
        $path=(string)parse_url(html_entity_decode($m[1],ENT_QUOTES,'UTF-8'),PHP_URL_PATH);$entry=pathinfo($path,PATHINFO_FILENAME);
        if(!in_array($entry,['home','productList','productdetail','login','regist'],true))throw new RuntimeException('Preview entry unavailable');
        $src=\CRA1\Theme\Release\Assets::url('shared','preview/member/'.$entry.'.js','',$root);
        return '<script src="'.htmlspecialchars($src,ENT_QUOTES,'UTF-8').'"></script>';
    },$html);
    $html=preg_replace('/<head(?:\s[^>]*)?>/i', '$0'.$bootstrap,$html,1);
    $banner='<div data-theme-preview-status="ready" style="position:fixed;bottom:8px;right:8px;z-index:2147483647;padding:6px 10px;border-radius:6px;background:#18181b;color:white;font:12px system-ui">草稿预览'.($domain==='website'?'':' · 示例数据').' · 不执行业务操作</div>';
    // Image requests must not provide a side channel to real business endpoints.
    // Permit exact external image paths already present in this draft; same-site
    // resources remain restricted to the public static prefixes above.
    $images=[];$site=parse_url($origin);$collect=static function($url)use(&$images,$site){$url=html_entity_decode((string)$url,ENT_QUOTES,'UTF-8');$u=parse_url($url);if(!$u||($u['scheme']??'')!=='https'||empty($u['host'])||isset($u['user'])||isset($u['pass'])||strtolower($u['host'])===strtolower($site['host']??'')||preg_match('/[\s;\x00-\x1f]/',$url))return;$path=$u['path']??'/';if($path==='/'||substr($path,-1)==='/')return;$images[]='https://'.$u['host'].(isset($u['port'])?':'.$u['port']:'').$path;};
    preg_match_all('~<img\b[^>]*\bsrc=["\'](https://[^"\']+)["\']~i',$html,$imageTags);foreach($imageTags[1]as$url)$collect($url);
    $walk=static function($value)use(&$walk,$collect){if(is_array($value)){foreach($value as$v)$walk($v);}elseif(is_string($value)){preg_match_all('~https://[^\s"\'<>|)]+\.(?:png|jpe?g|svg|gif|webp|avif|ico)(?:\?[^\s"\'<>|)]*)?~i',$value,$urls);foreach($urls[0]as$url)$collect($url);}};$walk($raw);
    header('Content-Security-Policy: '.str_replace('IMAGE_SOURCES',implode(' ',array_slice(array_unique($images),0,128)),$previewCsp));
    echo preg_replace('/<\/body>/i',$banner.'</body>',$html,1);
}

/** Invalid/unsupported preview resources never disclose PHP paths or exception details. */
function theme_editor_preview(string $root): void
{
    header('Cache-Control: no-store, private');
    header('Referrer-Policy: no-referrer');
    try { cra1_render_editor_preview($root); }
    catch (Throwable $error) {
        error_log('CRA1 draft preview failed: '.get_class($error));
        http_response_code(500);
        $nonce=bin2hex(random_bytes(16));
        $doc=$GLOBALS['THEME_VERIFIED_PREVIEW']??[];
        $origin=rtrim((string)($GLOBALS['THEME_SETTINGS']['canonical_url']??''),'/');
        header("Content-Security-Policy: default-src 'none'; script-src 'nonce-".$nonce."'; frame-ancestors ".$origin."; form-action 'none'; base-uri 'none'");
        echo '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><body><p>预览暂时无法显示，请返回重试。</p><script nonce="'.$nonce.'">parent.postMessage('.json_encode(['type'=>'theme-preview','state'=>'error','nonce'=>$doc['message_nonce']??''],15).','.json_encode($origin,15).');</script></body></html>';
    }
}
