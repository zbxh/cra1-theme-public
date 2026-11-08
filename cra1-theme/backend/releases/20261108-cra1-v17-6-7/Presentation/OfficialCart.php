<?php
declare(strict_types=1);
namespace CRA1\Theme\Presentation;

/** Delegate standalone module configuration to the V10 files installed on this site. */
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
        $files = [
            'header' => 'public/clientarea/template/pc/default/header.php',
            'goods' => 'public/cart/template/pc/default/goods.php',
            'footer' => 'public/clientarea/template/pc/default/footer.php',
        ];
        if (!isset($files[$part])) throw new \InvalidArgumentException('未知的商品页面片段');
        $data = array_intersect_key($variables, array_flip([
            'title', 'description', 'addons', 'system_version', 'clientarea_theme_color',
            'lang_home', 'lang_home_follow_browser', 'lang_home_open',
        ]));
        // Use the native script, API, component, language and CSS paths together.
        // No CRA1 request client, fragment loader, component map or control styles
        // enter this document. Upgrading V10 also updates these native consumers.
        $data += [
            'template_catalog' => 'clientarea', 'themes' => 'pc/default',
            'public_themes' => 'pc/default', 'template_catalog_cart' => 'cart',
            'themes_cart' => 'pc/default',
        ];
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
