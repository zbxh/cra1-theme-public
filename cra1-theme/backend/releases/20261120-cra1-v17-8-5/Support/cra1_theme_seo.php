<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}
/** Own only the marked robots region and CRA1's independent sitemap. */
function theme_generate_seo(string $root,string $canonical): void
{
    $base=rtrim($canonical,'/');$parts=parse_url($base);
    if(!$parts||!in_array($parts['scheme']??'',['http','https'],true)||!filter_var($base,FILTER_VALIDATE_URL)||isset($parts['user'])||isset($parts['query'])||isset($parts['fragment']))throw new RuntimeException('规范站点地址无效');
    require_once $root.'/public/web/cra1/controller/SeoRegistry.php';
    require_once $root.'/public/web/cra1/controller/PageModuleRegistry.php';
    \CRA1\Theme\Files::locked($root.'/runtime/cra1_theme/seo.lock',static function()use($root,$base){
        $saved=\CRA1\Theme\Files::json($root.'/runtime/cra1_theme/config.json',true);
        $meta=(string)($saved['seo_page_meta_json']??'');$doc=trim($meta)===''?[]:json_decode($meta,true);
        if(!is_array($doc))throw new RuntimeException('页面搜索设置损坏，原文件保留');
        $manifest=cra1_page_module_manifest();
        $xml='<?xml version="1.0" encoding="UTF-8"?>'."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        foreach(cra1_seo_registry()as$key=>$row){
            if(!empty($row['aliasOf'])||!empty($row['noindex'])||!empty($doc['pages'][$key]['noindex']))continue;
            $route=$manifest[$key]['route']??($key==='home'?'/':'');
            if($route!=='')$xml.='  <url><loc>'.htmlspecialchars($base.$route,ENT_XML1|ENT_QUOTES,'UTF-8').'</loc></url>'."\n";
        }
        $xml.='</urlset>'."\n";
        $path=$root.'/public/robots.txt';
        $before=is_file($path)?file_get_contents($path):'';
        if($before===false||is_link($path))throw new RuntimeException('robots.txt 无法读取或归属异常');
        $start='# BEGIN CRA1 THEME';$end='# END CRA1 THEME';
        if(substr_count($before,$start)!==substr_count($before,$end)||substr_count($before,$start)>1||(strpos($before,$start)!==false&&strpos($before,$end)<strpos($before,$start)))throw new RuntimeException('robots.txt 受管标记异常，请保留文件并人工检查');
        $block=$start."\nSitemap: ".$base."/cra1-sitemap.xml\n".$end;
        if(strpos($before,$start)!==false)$next=preg_replace('~'.preg_quote($start,'~').'.*?'.preg_quote($end,'~').'~s',$block,$before,1);
        else $next=($before!==''?rtrim($before)."\n\n":'').$block."\n";
        $sitemap=$root.'/public/cra1-sitemap.xml';$owned=$root.'/runtime/cra1_theme/seo-files.json';
        $ownership=\CRA1\Theme\Files::json($owned,true);
        if(is_file($sitemap)&&(!isset($ownership['sitemap_sha256'])||!hash_equals($ownership['sitemap_sha256'],hash_file('sha256',$sitemap))))throw new RuntimeException('同名站点地图不属于主题或已被外部修改，请先备份并处理归属');
        if($next!==$before&&is_file($path)){
            $backup=$root.'/runtime/cra1_theme/seo-backups/robots-'.hash('sha256',$before).'.txt';
            if(!is_file($backup))\CRA1\Theme\Files::atomic($backup,$before,0600);
        }
        $oldMap=is_file($sitemap)?file_get_contents($sitemap):null;
        $origin=$root.'/runtime/cra1_theme/site_origin.json';
        $oldOwned=is_file($owned)?file_get_contents($owned):null;$oldOrigin=is_file($origin)?file_get_contents($origin):null;
        try{
            if($oldMap!==$xml)\CRA1\Theme\Files::atomic($sitemap,$xml,0644);
            if($before!==$next)\CRA1\Theme\Files::atomic($path,$next,0644);
            \CRA1\Theme\Files::putJson($owned,['sitemap_sha256'=>hash('sha256',$xml),'robots_managed_region'=>[$start,$end]]);
            \CRA1\Theme\Files::putJson($origin,['canonical_url'=>$base]);
        }catch(Throwable $e){
            if($oldMap===null){if(is_file($sitemap))unlink($sitemap);}else \CRA1\Theme\Files::atomic($sitemap,$oldMap,0644);
            if($before!==$next)\CRA1\Theme\Files::atomic($path,$before,0644);
            foreach([$owned=>$oldOwned,$origin=>$oldOrigin]as$file=>$bytes){if($bytes===null){if(is_file($file))unlink($file);}else \CRA1\Theme\Files::atomic($file,$bytes);}
            throw $e;
        }
    });
}
