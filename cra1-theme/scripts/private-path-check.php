#!/usr/bin/env php
<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Release\PrivatePaths;
$options=getopt('',['root:','origin:','ca-file:']);$root=rtrim($options['root']??CRA1_THEME_ROOT,'/');$origin=rtrim($options['origin']??'','/');
$url=parse_url($origin);
if(!$url||($url['scheme']??'')!=='https'||isset($url['user'])||isset($url['query'])||isset($url['fragment'])||!empty($url['path'])||!is_dir($root.'/public')){fwrite(STDERR,"Use --root=/path/to/v10 --origin=https://your-own-site\n");exit(2);}
if(!extension_loaded('curl')){fwrite(STDERR,"curl extension required\n");exit(2);}
$ca=$options['ca-file']??'';
if($ca!==''&&(!is_string($ca)||$ca[0]!=='/'||!is_file($ca)||!is_readable($ca))){fwrite(STDERR,"Use an existing absolute CA certificate bundle path\n");exit(2);}
try{
 $proof=PrivatePaths::check($root,$origin,$ca);$passed=$proof['passed'];
 echo json_encode($proof,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n";
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
exit($passed?0:1);
