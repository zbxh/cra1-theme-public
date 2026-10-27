<?php
/** Stable compatibility entry; implementation follows the private release pointer. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}
require_once dirname(__DIR__).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_seo.php';
