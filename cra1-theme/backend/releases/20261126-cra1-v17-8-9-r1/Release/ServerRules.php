<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
final class ServerRules
{
    public static function nginx(string $entry): string
    {
        if(!preg_match('/^[a-z][a-z0-9]{5,31}$/D',$entry))throw new \InvalidArgumentException('后台路径无效');
        $file=CRA1_THEME_ROOT.'/cra1-theme/docs/nginx.example.conf';
        if(!is_file($file))throw new \RuntimeException('缺少 Nginx 配套说明');
        return str_replace('<theme-admin-entry>',$entry,(string)file_get_contents($file));
    }
}
