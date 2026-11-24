<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;

/** Editable menu choices based on V10 navigation and installed plugin pages. */
final class MemberNavigationOptions
{
    private const EXTRA_PAGES = [
        'IdcsmartTicket' => ['addTicket' => '新建工单'],
        'TicketPremium' => ['addTicket' => '新建工单'],
        'IdcsmartSubAccount' => ['addChildAccount' => '添加子账户'],
        'IdcsmartHelp' => ['helpTotal' => '文档中心'],
    ];
    private const OLD_LIST_VIEWS = [
        'IdcsmartNews' => 'news',
        'IdcsmartHelp' => 'help',
        'IdcsmartAnnouncement' => 'announcement',
    ];

    public static function build(string $root, array $navs, array $plugins): array
    {
        $systemLanguage = self::language($root.'/public/clientarea/language/zh-cn.php');
        $systemLanguage += ['nav_ordered' => '产品列表'];
        $languages = $options = $sources = $registered = [];
        $navs = array_map(static function(array $nav): array {
            return $nav + ['name'=>'', 'url'=>'', 'plugin'=>'', 'module'=>'', 'is_plugin'=>!empty($nav['plugin'])];
        }, $navs);
        foreach ($navs as $nav) {
            if ($nav['url'] !== '') $registered[$nav['plugin']][ltrim($nav['url'], '/')] = true;
        }
        foreach ($navs as $nav) {
            $key = $nav['name'];
            $plugin = $nav['plugin'];
            $url = $nav['url'];
            $title = '';
            $lang = $systemLanguage;
            if ($plugin !== '') {
                $info = $plugins[$plugin] ?? [];
                if (($info['module'] ?? '') !== $nav['module'] || $url === '') continue;
                $base = self::pluginDirectory($root, $nav['module'], $plugin);
                if ($base === '') continue;
                $title = $info['title'];
                $lang = $languages[$base] ?? ($languages[$base] = self::language($base.'/lang/zh-cn.php'));
                $view = self::OLD_LIST_VIEWS[$plugin] ?? null;
                $prefix = 'plugin/'.$info['id'].'/';
                // Some native registrations still list a removed page alongside its replacement.
                if ($view && ltrim($url, '/') === $prefix.$view.'.htm' && !self::hasView($base, $view)
                    && isset($registered[$plugin][$prefix.'source.htm'])
                    && ($plugin === 'IdcsmartAnnouncement' || self::hasView($base, 'source'))) continue;
                $sources[$plugin] = $sources[$plugin] ?? $nav;
            }
            $translated = $lang[$key] ?? null;
            $name = is_string($translated) && trim($translated) !== '' ? $translated : $key;
            if ($name === '' || ($name === $key && preg_match('/^(?:clientarea_)?nav_/', $key))) {
                $name = $title !== '' ? $title : ($url !== '' ? $url : '系统分组');
            }
            $options[] = self::option($nav, $name, $title, $key);
        }
        foreach ($sources as $plugin => $nav) {
            $info = $plugins[$plugin];
            if ($nav['module'] !== 'addon' || (int)$info['id'] < 1) continue;
            $base = self::pluginDirectory($root, 'addon', $plugin);
            foreach (self::EXTRA_PAGES[$plugin] ?? [] as $view => $name) {
                $url = 'plugin/'.$info['id'].'/'.$view.'.htm';
                if (isset($registered[$plugin][$url]) || !self::hasView($base, $view)) continue;
                $options[] = self::option(array_replace($nav, ['url' => $url]), $name, $info['title'], '');
            }
        }
        return $options;
    }

    private static function option(array $nav, string $name, string $title, string $key): array
    {
        return array_intersect_key($nav, array_flip(['id','url','icon','is_plugin']))
            + ['name'=>$name, 'plugin_title'=>$title, 'translation_key'=>$key];
    }

    private static function pluginDirectory(string $root, string $module, string $plugin): string
    {
        if (!in_array($module, ['addon','server','reserver'], true) || !preg_match('/^[A-Za-z][A-Za-z0-9_]*$/D', $plugin)) return '';
        $folder = strtolower(trim(preg_replace('/[A-Z]/', '_$0', $plugin), '_'));
        return $root.'/public/plugins/'.$module.'/'.$folder;
    }

    private static function hasView(string $base, string $view): bool
    {
        $templates = $base.'/template/clientarea/';
        foreach (['pc/cra1','pc/default','mobile/cra1','mobile/default'] as $theme) {
            if (is_file($templates.$theme.'/'.$view.'.html')) return true;
        }
        return false;
    }

    private static function language(string $file): array
    {
        if (!is_readable($file)) return [];
        try {
            $language = require $file;
            return is_array($language) ? $language : [];
        } catch (\Throwable $e) {
            return [];
        }
    }
}
