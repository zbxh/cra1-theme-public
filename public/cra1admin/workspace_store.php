<?php
/** Compatibility entry. Implementation lives outside the document root. */
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Storage/workspace_store.php';
if (!class_exists('ThemeWorkspaceStore',false)) class_alias(\CRA1\Theme\Storage\ThemeWorkspaceStore::class,'ThemeWorkspaceStore');
function theme_workspace_revision(array $values): string { return \CRA1\Theme\Storage\theme_workspace_revision($values); }
