<?php
/** CRA1 theme cart entry URLs. No configuration or business data is written. */
declare(strict_types=1);

function cra1_cart_product_url($productId, array $query = []): string
{
    unset($query['id'], $query['product_id'], $query['view_html'], $query['embed'], $query['embed_nonce'], $query['standalone']);
    $id = is_scalar($productId) && preg_match('/^[0-9]+$/D', (string)$productId) ? (int)$productId : 0;
    if ($id > 0) $query = ['product_id' => $id] + $query;
    return '/cart/goodsList.htm' . ($query ? '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986) : '');
}

/**
 * Only the old CRA1 product page redirects. Embedded pages and the explicit
 * standalone recovery entry retain their original rendering and module APIs.
 * Keep non-routing query bytes intact (including repeated tracking parameters).
 */
function cra1_cart_legacy_goods_target(string $requestUri, string $method = 'GET'): ?string
{
    if (!in_array(strtoupper($method), ['GET', 'HEAD'], true)) return null;
    if (preg_match('/[\x00-\x1f\x7f]/', $requestUri)) return null;
    $parts = parse_url($requestUri);
    if (!is_array($parts) || ($parts['path'] ?? '') !== '/cart/goods.htm') return null;
    $id = null;
    $productId = null;
    $extra = [];
    foreach (explode('&', $parts['query'] ?? '') as $pair) {
        if ($pair === '') continue;
        $entry = explode('=', $pair, 2);
        $key = urldecode($entry[0]);
        $value = urldecode($entry[1] ?? '');
        if ($key === 'standalone' && $value === '1') return null;
        if ($key === 'id') $id = $value;
        elseif ($key === 'product_id') $productId = $value;
        if (preg_match('/^(?:id|product_id|view_html|embed|embed_nonce|standalone)(?:\[|$)/D', $key)) continue;
        // Raw CR/LF must never enter a Location header; encoded values stay encoded.
        if (!preg_match('/[\x00-\x1f\x7f]/', $pair)) $extra[] = $pair;
    }
    $target = cra1_cart_product_url($id === null ? $productId : $id);
    if ($extra) $target .= (strpos($target, '?') === false ? '?' : '&') . implode('&', $extra);
    return $target;
}

function cra1_cart_redirect_legacy_goods(): void
{
    $target = cra1_cart_legacy_goods_target($_SERVER['REQUEST_URI'] ?? '', $_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($target === null) return;
    // Temporary and uncached so a theme rollback never leaves a cached redirect.
    header('Cache-Control: private, no-store');
    header('Location: ' . $target, true, 302);
    exit;
}
