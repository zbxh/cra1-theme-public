<?php
require_once __DIR__.'/../cra1-shared/icons.php';
require_once __DIR__.'/../web/cra1/controller/BuiltinIcons.php';
function cra1admin_icon_local_url(string $spec): string { return cra1_icons_url($spec); }
function cra1admin_icon_preview_url(string $spec): string { return cra1_icons_url($spec); }
