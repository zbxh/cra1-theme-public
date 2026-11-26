<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

/** Project native page grants without publishing groups or plugin configuration. */
final class MenuAccess
{
    public static function project(array $pages, array $granted, array $plugins): array
    {
        $out = [];
        foreach ($pages as $page) {
            $url = trim((string)($page['url'] ?? ''));
            if ($url === '' || preg_match('~^(?:[a-z][a-z0-9+.-]*:|//)~i', $url)) continue;
            $url = '/'.ltrim($url, '/');
            $key = (string)($page['plugin'] ?? '');
            $module = (string)($page['module'] ?? '');
            $enabled = $key === '' || isset($plugins[$module.':'.$key]);
            $allowed = $enabled && in_array((int)$page['id'], $granted, true);
            // Native installations may register multiple grant groups for one page.
            $out[$url] = ($out[$url] ?? false) || $allowed;
        }
        $result = [];
        foreach ($out as $url => $allowed) $result[] = ['url'=>$url, 'allowed'=>$allowed];
        return $result;
    }
}
