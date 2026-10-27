<?php
/** Compatibility entry. Implementation lives outside the document root. */
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Storage/member_store.php';
if (!class_exists('MemberCenterStore',false)) class_alias(\CRA1\Theme\Storage\MemberCenterStore::class,'MemberCenterStore');
