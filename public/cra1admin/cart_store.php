<?php
/** Compatibility entry. Implementation lives outside the document root. */
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Storage/cart_store.php';
if (!class_exists('CartThemeStore',false)) class_alias(\CRA1\Theme\Storage\CartThemeStore::class,'CartThemeStore');
