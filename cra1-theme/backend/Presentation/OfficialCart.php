<?php
declare(strict_types=1);
namespace CRA1\Theme\Presentation;

/** Installed V10 business document, with CRA1 navigation as its only component substitution. */
final class OfficialCart
{
    public static function ownsDocument(array $variables): bool
    {
        if (!\CRA1\Theme\Context::isCRA1((string)($variables['themes_cart'] ?? ''))) return false;
        $path = (string)parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
        $page = basename($path, '.htm');
        return $page === 'goods' || ($page === 'cart' && ($_GET['view_html'] ?? '') === 'goods');
    }

    public static function render(string $part, array $variables): string
    {
        $data = array_intersect_key($variables, array_flip([
            'title', 'description', 'addons', 'system_version', 'clientarea_theme_color',
            'lang_home', 'lang_home_follow_browser', 'lang_home_open',
        ]));
        $data += [
            'template_catalog' => 'clientarea', 'themes' => 'pc/default',
            'public_themes' => 'pc/default', 'template_catalog_cart' => 'cart',
            'themes_cart' => 'pc/default',
        ];
        $html = self::nativePart($part, $data);
        // The goods template, its fragment loader and module dependencies are
        // always the installed native implementation, byte for byte.
        if ($part === 'goods') return $html;
        $assets = self::navigationAssets();
        if (!$assets) return $html;
        $footer = self::navigationFooter($part === 'footer' ? $html : self::nativePart('footer', $data), $assets);
        // An unfamiliar future footer can still run its complete native page.
        // Never render half of one navigation and half of another.
        if ($footer === null) {
            error_log('CRA1 native cart navigation: installed footer not recognized; native navigation retained');
            return $html;
        }
        if ($part === 'footer') return $footer;
        require_once CRA1_THEME_ROOT.'/public/cra1-shared/runtime.php';
        $runtime = \CRA1ThemeRuntime::load('goods');
        $json = json_encode($runtime, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
        $html = preg_replace('~<html\b~i', '<html data-cra1-theme="cart" data-cra1-native-cart', $html, 1);
        $extra = '<script>window.__CRA1_RUNTIME__='.$json.';</script>'
            .'<link rel="stylesheet" href="'.htmlspecialchars($assets['css'], ENT_QUOTES, 'UTF-8').'">'
            .'<script src="'.htmlspecialchars($assets['js'], ENT_QUOTES, 'UTF-8').'"></script>';
        return stripos($html, '</head>') !== false ? str_ireplace('</head>', $extra.'</head>', $html) : $html.$extra;
    }

    private static function navigationAssets(): array
    {
        $files = [
            'css' => ['shared', 'native-cart-navigation.css'],
            'js' => ['shared', 'native-cart-navigation.js'],
            'asideMenu' => ['native', 'components/asideMenu/asideMenu.js'],
            'topMenu' => ['native', 'components/topMenu/topMenu.js'],
        ];
        $assets = [];
        foreach ($files as $name => [$domain, $file]) {
            $url = \CRA1\Theme\Release\Assets::url($domain, $file);
            if ($url === '' || !is_file(CRA1_THEME_ROOT.'/public'.parse_url($url, PHP_URL_PATH))) return [];
            $assets[$name] = $url;
        }
        return $assets;
    }

    /** Replace parser-ordered component sources before their const bindings execute. */
    private static function navigationFooter(string $html, array $assets): ?string
    {
        $counts = ['asideMenu' => 0, 'topMenu' => 0];
        $result = preg_replace_callback('~<script\b[^>]*>\s*</script\s*>~i', static function ($match) use ($assets, &$counts) {
            if (!preg_match('~\bsrc\s*=\s*([\x22\x27])(.*?)\1~is', $match[0], $source)) return $match[0];
            $path = (string)parse_url(html_entity_decode($source[2], ENT_QUOTES, 'UTF-8'), PHP_URL_PATH);
            if (!preg_match('~(?:^|/)components/(asideMenu|topMenu)/\1\.js$~D', $path, $component)) return $match[0];
            $name = $component[1];
            $counts[$name]++;
            return str_replace($source[0], 'src="'.htmlspecialchars($assets[$name], ENT_QUOTES, 'UTF-8').'"', $match[0]);
        }, $html);
        return $counts === ['asideMenu' => 1, 'topMenu' => 1] ? $result : null;
    }

    private static function nativePart(string $part, array $data): string
    {
        $files = [
            'header' => 'public/clientarea/template/pc/default/header.php',
            'goods' => 'public/cart/template/pc/default/goods.php',
            'footer' => 'public/clientarea/template/pc/default/footer.php',
        ];
        if (!isset($files[$part])) throw new \InvalidArgumentException('未知的商品页面片段');
        $template = new \think\Template([
            'view_path' => CRA1_THEME_ROOT.'/', 'view_suffix' => 'php',
            'cache_path' => runtime_path().'temp/', 'cache_prefix' => 'cra1_official_cart_',
        ]);
        $level = ob_get_level();
        ob_start();
        try {
            $template->fetch(CRA1_THEME_ROOT.'/'.$files[$part], $data);
            return (string)ob_get_clean();
        } catch (\Throwable $error) {
            while (ob_get_level() > $level) ob_end_clean();
            throw $error;
        }
    }
}
