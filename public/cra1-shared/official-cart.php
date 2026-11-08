<?php
/** Theme include only; the native cart has no separate public configuration endpoint. */
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}
require_once __DIR__.'/assets.php';
