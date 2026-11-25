<?php
declare(strict_types=1);
namespace CRA1\Theme\Presentation;

/** Installed V10 module documents with optional CRA1 navigation. */
final class OfficialCart
{
    private static bool $nativePanel = false;
    private static bool $nativeNavigation = false;
    private static bool $fullOfficialCart = false;

    public static function handlesPanel(): bool { return self::$nativePanel; }
    public static function panelUsesCRA1(): bool { return self::$nativeNavigation; }
    public static function fullOfficialCart(): bool { return self::$fullOfficialCart; }

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
        if ($part === 'goods') return self::cartBody($html, true);
        if ($part === 'header') $html = self::allowZoom($html);
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
        return self::navigationHead($html, $assets, 'goods');
    }

    /** Render the installed cart document, resolving its body and shell independently. */
    public static function cartDocument(array $variables, bool $mobile, bool $useCRA1): ?string
    {
        $shell = self::defaultShell($mobile);
        $cart = $mobile && is_file(CRA1_THEME_ROOT.'/public/cart/template/mobile/default/goods.php')
            ? 'mobile/default' : 'pc/default';
        $body = CRA1_THEME_ROOT.'/public/cart/template/'.$cart.'/goods.php';
        if ($shell === null || !is_file($body)) return null;
        $data = self::shellData($variables, $shell) + ['template_catalog_cart'=>'cart', 'themes_cart'=>$cart];
        $html = self::cartBody(self::template($body, $data), $useCRA1);
        $html = self::allowZoom(self::template($shell['header'], $data).$html.self::template($shell['footer'], $data));
        $result = $useCRA1 ? self::withNavigation($html, 'goods') : null;
        self::$fullOfficialCart = $result === null;
        return $result ?? $html;
    }

    private static function cartBody(string $html, bool $withFeedback): string
    {
        // Normalize older links before any of the native scripts read the ID.
        $alias = '<script>(function(){var u=new URL(location.href),id=u.searchParams.get("product_id");'
            .'if(!u.searchParams.has("id")&&/^[1-9]\\d*$/.test(id||"")){u.searchParams.set("id",id);'
            .'history.replaceState(history.state,"",u.pathname+u.search.replace(/\\+/g,"%20")+u.hash);}})();</script>';
        if (!$withFeedback) return $alias.$html;
        $css = \CRA1\Theme\Release\Assets::url('shared', 'native-cart-feedback.css');
        $js = \CRA1\Theme\Release\Assets::url('shared', 'native-cart-feedback.js');
        if ($css === '' || $js === '') return $alias.$html;
        return $alias.'<link rel="stylesheet" href="'.htmlspecialchars($css, ENT_QUOTES, 'UTF-8').'">'
            .'<script src="'.htmlspecialchars($js, ENT_QUOTES, 'UTF-8').'"></script>'.$html;
    }

    /** Both modes use V10's real productdetail entry and host view loader. */
    public static function panelDocument(array $variables, bool $mobile, bool $useCRA1): ?string
    {
        $shell = self::defaultShell($mobile, 'productdetail.php');
        if ($shell === null) return null;
        $data = self::shellData($variables, $shell) + $variables;
        $html = self::template($shell['base'].'productdetail.php', $data);
        // Some installed versions give the product root the generic hidden
        // first-child class, then never show it after Vue removes v-cloak.
        $html = str_ireplace('</head>', '<style>.product_detail.template:first-child:not([v-cloak]){display:block}</style></head>', $html);
        return self::finishPanel($html, $useCRA1);
    }

    /** Modules with their own detail URL keep the installed module page and scripts. */
    public static function directPanel(array $variables, string $module, bool $mobile, bool $useCRA1): ?string
    {
        $shell = self::defaultShell($mobile);
        $business = (new ClientareaTemplates())->resolveBusinessTemplate('server', $module, 'product_detail', $mobile, 'default', 'default');
        if ($shell === null || !$business) return null;
        $data = self::shellData($variables, $shell);
        $data['themes'] = $business['themes'];
        $head = self::template($shell['header'], $data);
        $html = $head . self::template($business['template_file'], $data, 'html') . self::template($shell['footer'], $data);
        return self::finishPanel($html, $useCRA1, strlen($head));
    }

    private static function finishPanel(string $html, bool $useCRA1, ?int $headEnd = null): string
    {
        $result = $useCRA1 ? self::withNavigation($html, 'productdetail', $headEnd) : null;
        self::$nativePanel = true;
        self::$nativeNavigation = $result !== null;
        return self::allowZoom($result ?? $html);
    }

    /** Leave the installed templates intact while allowing zoom in their rendered shell. */
    private static function allowZoom(string $html): string
    {
        if (!preg_match('~<head\b[^>]*>~i', $html, $opening, PREG_OFFSET_CAPTURE)) return $html;
        $start = $opening[0][1] + strlen($opening[0][0]);
        $end = stripos($html, '</head>', $start) ?: strlen($html);

        $head = preg_replace_callback(
            '~<meta\b(?=[^>]*\sname\s*=\s*(?:"viewport"|\x27viewport\x27|viewport(?=\s|/?>)))[^>]*>~i',
            static function (array $tag): string {
                return preg_replace_callback('~(\scontent\s*=\s*)(["\x27])(.*?)\2~is', static function (array $attribute): string {
                    $content = preg_replace('~(?:^|[,;])\s*(?:maximum-scale|minimum-scale|user-scalable)\s*=[^,;]*~i', '', $attribute[3]);
                    return $attribute[1].$attribute[2].ltrim($content, ',;').$attribute[2];
                }, $tag[0], 1);
            },
            substr($html, $start, $end - $start)
        );
        return substr($html, 0, $start).$head.substr($html, $end);
    }

    private static function defaultShell(bool $mobile, ?string $page = null): ?array
    {
        foreach ($mobile ? ['mobile/default', 'pc/default'] : ['pc/default'] as $theme) {
            $base = CRA1_THEME_ROOT.'/public/clientarea/template/'.$theme.'/';
            $header = $base.'header.php';
            $footer = $base.'footer.php';
            if (is_file($header) && is_file($footer) && ($page === null || is_file($base.$page))) {
                return compact('theme', 'base', 'header', 'footer');
            }
        }
        return null;
    }

    private static function shellData(array $variables, array $shell): array
    {
        return ['template_catalog'=>'clientarea', 'themes'=>$shell['theme'], 'public_themes'=>$shell['theme']]
            + array_intersect_key($variables, array_flip([
                'title', 'description', 'addons', 'system_version', 'clientarea_theme_color',
                'lang_home', 'lang_home_follow_browser', 'lang_home_open',
            ]));
    }

    private static function withNavigation(string $html, string $page, ?int $headEnd = null): ?string
    {
        $assets = self::navigationAssets();
        if (!$assets || ($headEnd === null && stripos($html, '</head>') === false)) return null;
        $adapted = self::navigationFooter($html, $assets);
        return $adapted === null ? null : self::navigationHead($adapted, $assets, $page, $headEnd);
    }

    private static function navigationHead(string $html, array $assets, string $page, ?int $headEnd = null): string
    {
        require_once CRA1_THEME_ROOT.'/public/cra1-shared/runtime.php';
        $runtime = \CRA1ThemeRuntime::load($page);
        $json = json_encode($runtime, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
        $scope = $page === 'goods' ? 'data-cra1-theme="cart" data-cra1-native-cart' : 'data-cra1-theme="member" data-cra1-native-panel';
        $extra = '<script>window.__CRA1_RUNTIME__='.$json.';</script>'
            .'<link rel="stylesheet" href="'.htmlspecialchars($assets['css'], ENT_QUOTES, 'UTF-8').'">'
            .'<script src="'.htmlspecialchars($assets['js'], ENT_QUOTES, 'UTF-8').'"></script>';
        $end = stripos($html, '</head>');
        $html = substr_replace($html, $extra, $end !== false ? $end : ($headEnd ?? strlen($html)), 0);
        return preg_replace('~<html\b~i', '<html '.$scope, $html, 1);
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
        return self::template(CRA1_THEME_ROOT.'/'.$files[$part], $data);
    }

    private static function template(string $file, array $data, string $suffix = 'php'): string
    {
        $template = new \think\Template([
            'view_path' => dirname($file).'/', 'view_suffix' => $suffix,
            'cache_path' => runtime_path().'temp/', 'cache_prefix' => 'cra1_official_cart_',
        ]);
        $level = ob_get_level();
        ob_start();
        try {
            $template->fetch($file, $data);
            return (string)ob_get_clean();
        } catch (\Throwable $error) {
            while (ob_get_level() > $level) ob_end_clean();
            throw $error;
        }
    }
}
