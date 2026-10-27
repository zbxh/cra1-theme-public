<?php
/** Public compatibility include; no HTTP configuration endpoint. */
if(PHP_SAPI!=='cli' && realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Compatibility/runtime.php';

require_once __DIR__.'/assets.php';
