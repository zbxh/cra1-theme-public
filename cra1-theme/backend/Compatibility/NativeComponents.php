<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

/** Native module pages expect their original shell components before business JS. */
final class NativeComponents
{
    public static function registry(): array
    {
        return \CRA1\Theme\Files::json(CRA1_THEME_BACKEND.'/Compatibility/native-components.json');
    }

    public static function forPath(string $request): array
    {
        $path=parse_url($request,PHP_URL_PATH);
        if (!is_string($path) || !preg_match('~^/module/([A-Za-z][A-Za-z0-9_]*)/(product_list|product_detail)\.htm$~D',$path,$match)) return [];
        $registry=self::registry();
        $group=$match[2]==='product_list'?'list':(in_array($match[1],['mf_cloud','mf_dcim'],true)?'detail':'detailCommon');
        $scripts=[];$visiting=[];
        $visit=static function(string $name) use (&$visit,&$scripts,&$visiting,$registry): void {
            if (isset($scripts[$name])) return;
            if (isset($visiting[$name]) || !isset($registry['paths'][$name])) throw new \RuntimeException('Invalid native component dependencies');
            $visiting[$name]=true;
            foreach ($registry['dependencies'][$name]??[] as $dependency) $visit($dependency);
            $relative=$registry['paths'][$name];
            if (!is_string($relative)||!preg_match('~^components/([A-Za-z][A-Za-z0-9_]*)/\1\.js$~D',$relative)) throw new \RuntimeException('Invalid native component path');
            $scripts[$name]=$relative;unset($visiting[$name]);
        };
        foreach ($registry['groups'][$group] as $name) $visit($name);
        return $scripts;
    }
}
