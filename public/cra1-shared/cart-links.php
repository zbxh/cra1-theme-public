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

