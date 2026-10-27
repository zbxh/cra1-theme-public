<?php
/** Compatibility entry. Implementation lives outside the document root. */
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Storage/editor_store.php';
trait ThemeEditorStore { use \CRA1\Theme\Storage\ThemeEditorStore; }
