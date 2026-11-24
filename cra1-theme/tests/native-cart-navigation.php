<?php
declare(strict_types=1);
// Installed files are inputs only. All rendering/cache writes use a private temp directory.
$root = dirname(__DIR__, 2);
$cache = sys_get_temp_dir().'/cra1-native-nav-'.bin2hex(random_bytes(6));
define('CRA1_THEME_ROOT', $root);
function runtime_path() { return $GLOBALS['cache'].'/'; }
function view_tpl_replace($content, $data, $name = '') { return $content; }
require $root.'/vendor/autoload.php';
require $root.'/cra1-theme/backend/Presentation/OfficialCart.php';
use CRA1\Theme\Presentation\OfficialCart;
$checks = 0;
function navCheck($ok, string $message): void { if (!$ok) throw new RuntimeException($message); $GLOBALS['checks']++; }
function nativePart(string $part, array $data): string {
    $method = new ReflectionMethod(OfficialCart::class, 'nativePart'); $method->setAccessible(true);
    return $method->invoke(null, $part, $data);
}
function navFooter(string $html): ?string {
    $method = new ReflectionMethod(OfficialCart::class, 'navigationFooter'); $method->setAccessible(true);
    return $method->invoke(null, $html, ['asideMenu'=>'/fixture/asideMenu.js?v=1', 'topMenu'=>'/fixture/topMenu.js?v=2']);
}
$data = ['template_catalog'=>'clientarea','themes'=>'pc/default','public_themes'=>'pc/default','template_catalog_cart'=>'cart','themes_cart'=>'pc/default','addons'=>[],'clientarea_theme_color'=>'default','system_version'=>'10.7.4','lang_home'=>'zh-cn','lang_home_follow_browser'=>0,'lang_home_open'=>0];
try {
    navCheck(OfficialCart::render('goods', $data) === nativePart('goods', $data), 'native business template remains identical');
    $original = nativePart('footer', $data); $adapted = navFooter($original);
    navCheck($adapted !== null, 'installed footer accepts CRA1 navigation');
    navCheck(substr_count($adapted, '/fixture/') === 2, 'exactly two components replaced');
    $nativeSources = [];
    foreach (['asideMenu', 'topMenu'] as $name) {
        preg_match('~src=[\x22\x27]([^\x22\x27]*/components/'.$name.'/'.$name.'\.js[^\x22\x27]*)[\x22\x27]~', $original, $source);
        $nativeSources[] = $source[1];
    }
    $restored = str_replace(['/fixture/asideMenu.js?v=1', '/fixture/topMenu.js?v=2'], $nativeSources, $adapted);
    navCheck($restored === $original, 'all native APIs, request client, payment and plugin scripts untouched');
    // Future native scripts may use single quotes, attributes and query strings.
    $single = "<script nonce='x' src='/components/asideMenu/asideMenu.js?v=3&amp;x=1'></script>\n<script defer src='/components/topMenu/topMenu.js?x=2'></script>";
    navCheck(navFooter($single) !== null, 'single quotes, attributes and cache keys supported');
    navCheck(strpos(navFooter($single), "nonce='x'") !== false, 'native attributes retained');
    navCheck(navFooter(str_replace('topMenu.js', 'unknown.js', $original)) === null, 'unrecognized footer keeps complete native navigation');
    navCheck(navFooter($original."<script src='/components/topMenu/topMenu.js'></script>") === null, 'duplicate declarations do not produce mixed navigation');
    $cart=OfficialCart::cartDocument($data, true, false);
    navCheck(strpos($cart, '/cart/template/pc/default/js/goods.js') !== false, 'native mobile cascade keeps the installed cart loader');
    navCheck(strpos($cart, 'native-cart-navigation') === false && OfficialCart::fullOfficialCart(), 'complete cart does not load CRA1 navigation');
    navCheck(strpos($cart, 'product_id') < strpos($cart, '/cart/template/pc/default/js/goods.js'), 'legacy product ID normalized before the native loader');
    $panel=OfficialCart::panelDocument($data, true, false);
    navCheck(strpos($panel, '/clientarea/template/pc/default/js/productdetail.js') !== false, 'official panel loads the installed host view loader');
    navCheck(strpos($panel, 'native-cart-navigation') === false && OfficialCart::handlesPanel() && !OfficialCart::panelUsesCRA1(), 'complete panel does not load CRA1 navigation');
    navCheck(strpos($panel, '.product_detail.template:first-child:not([v-cloak])') !== false, 'the mounted native panel stays visible');
    $adaptedPanel=navFooter($panel);
    navCheck($adaptedPanel !== null && substr_count($adaptedPanel, '/fixture/') === 2 && strpos($adaptedPanel, '/clientarea/template/pc/default/js/productdetail.js') !== false, 'panel navigation replacement preserves native module scripts');
    echo json_encode(['status'=>'passed','checks'=>$checks,'php'=>PHP_VERSION,'business_writes'=>0]).PHP_EOL;
} finally {
    if (is_dir($cache)) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($cache, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($cache);
    }
}
