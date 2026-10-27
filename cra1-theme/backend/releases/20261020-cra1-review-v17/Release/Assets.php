<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** A single private release pointer chooses resources for all three themes. */
final class Assets
{
    public static function manifest(?string $root=null): array
    {
        $root=$root??CRA1_THEME_ROOT;
        static $memo=[];
        if(array_key_exists($root,$memo))return $memo[$root];
        $current=Files::json($root.'/runtime/cra1_theme/distribution/current.json',true);
        return $memo[$root]=isset($current['manifest'])&&is_array($current['manifest']) ? $current['manifest'] : Files::json($root.'/cra1-theme/release.json',true);
    }
    public static function url(string $domain,string $file,string $fallback='',?string $root=null): string
    {
        self::maintenance($root);
        if(!in_array($domain,['member','native','cart','shared','website'],true)||($file!==''&&!preg_match('~^[A-Za-z0-9_./-]+$~D',$file))||strpos($file,'..')!==false)throw new \InvalidArgumentException('主题资源标识无效');
        $root=$root??CRA1_THEME_ROOT;$doc=self::manifest($root);$base=(string)($doc['asset_bases'][$domain]??'');
        if($base==='')return $fallback;
        $prefix=['member'=>'/clientarea/template/pc/cra1/releases/','native'=>'/clientarea/template/pc/cra1/releases/','cart'=>'/cart/template/pc/cra1/releases/','shared'=>'/cra1-shared/releases/','website'=>'/web/cra1/releases/'][$domain];
        if(strncmp($base,$prefix,strlen($prefix))!==0||!preg_match('~^[a-z0-9-]+(?:/assets)?$~D',substr($base,strlen($prefix))))throw new \RuntimeException('生效资源清单损坏');
        return rtrim($base,'/').($file!==''?'/'.$file:'');
    }
    public static function admin(string $fallback,?string $root=null): string
    {
        $doc=self::manifest($root);$release=$doc['release']??'';
        if(empty($doc['asset_bases']['admin']))return $fallback;
        if(!preg_match('/^[a-z0-9][a-z0-9-]{3,80}$/D',$release)||$doc['asset_bases']['admin']!=='assets/releases/'.$release)throw new \RuntimeException('后台资源清单无效');
        return $doc['asset_bases']['admin'];
    }
    public static function maintenance(?string $root=null): void
    {
        if(PHP_SAPI==='cli'||!is_file(($root??CRA1_THEME_ROOT).'/runtime/cra1_theme/distribution/pending.json'))return;
        http_response_code(503);header('Retry-After: 30');header('Cache-Control: no-store');
        echo '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>主题维护中</title><p>页面正在更新，请稍后刷新。</p></html>';exit;
    }
}
