<?php
/** Unauthenticated projection of the effective description for one visible cart selection. */
declare(strict_types=1);

use CRA1\Theme\Compatibility\CartCatalog;
use CRA1\Theme\Content\CartDescriptions;
use CRA1\Theme\Storage\CartThemeStore;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');

try {
    $root = dirname(__DIR__, 2);
    if (is_file($root.'/runtime/cra1_theme/distribution/pending.json')) throw new RuntimeException();
    require_once $root.'/cra1-theme/backend/bootstrap.php';
    require_once CRA1_THEME_BACKEND.'/Storage/cart_store.php';
    $rules = (new CartThemeStore($root.'/runtime'))->topDescriptionRules();
    $now = time();
    $selection = [];
    $input = ['product'=>CartDescriptions::id($_GET['product_id'] ?? 0),
        'second'=>CartDescriptions::id($_GET['spg_id'] ?? 0), 'first'=>CartDescriptions::id($_GET['fpg_id'] ?? 0)];
    if (array_filter($input) && CartDescriptions::hasScopedRules($rules)) {
        $selection = (new CartCatalog())->selection($input);
    }
    echo json_encode(['status'=>200, 'data'=>CartDescriptions::storefront($rules, $selection, $now)],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    http_response_code(503);
    echo '{"status":503}';
}
