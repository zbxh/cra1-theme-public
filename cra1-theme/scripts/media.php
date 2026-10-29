<?php
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_media.php';
$root=dirname(__DIR__,2);
if (($argv[1]??'')!=='index') { fwrite(STDERR,"用法：php cra1-theme/scripts/media.php index\n");exit(1); }
$store=new CRA1ThemeMediaStore($root,true);
echo '已建立附件索引，新增 '.$store->indexExisting()." 项。\n";
