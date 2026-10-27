#!/usr/bin/env php
<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Files;
$options=getopt('',['root:','origin:','ca-file:']);$root=rtrim($options['root']??CRA1_THEME_ROOT,'/');$origin=rtrim($options['origin']??'','/');
$url=parse_url($origin);
if(!$url||($url['scheme']??'')!=='https'||isset($url['user'])||isset($url['query'])||isset($url['fragment'])||!empty($url['path'])||!is_dir($root.'/public')){fwrite(STDERR,"Use --root=/path/to/v10 --origin=https://your-own-site\n");exit(2);}
if(!extension_loaded('curl')){fwrite(STDERR,"curl extension required\n");exit(2);}
$ca=$options['ca-file']??'';
if($ca!==''&&(!is_string($ca)||$ca[0]!=='/'||!is_file($ca)||!is_readable($ca))){fwrite(STDERR,"Use an existing absolute CA certificate bundle path\n");exit(2);}
$id=bin2hex(random_bytes(12));$token='cra1-private-canary-'.bin2hex(random_bytes(24));$paths=[];$rows=[];
try{
 foreach(['runtime/cra1_theme','config','cra1-theme/backend']as$dir){
  $rel=$dir.'/cra1-check-'.$id.'.txt';$path=$root.'/'.$rel;Files::atomic($path,$token,0644);$paths[]=$path;
  foreach(['/'.$rel,'/public/'.$rel]as$route){
   $ch=curl_init($origin.$route);
   curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>10,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_MAXFILESIZE=>1048576]);
   if($ca!=='')curl_setopt($ch,CURLOPT_CAINFO,$ca);
   $body=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$error=curl_errno($ch);curl_close($ch);
   $rows[]=['path'=>$route,'status'=>$status,'passed'=>$error===0&&in_array($status,[403,404],true)&&strpos((string)$body,$token)===false];
  }
 }
 $passed=!in_array(false,array_column($rows,'passed'),true);
 $proof=['format'=>1,'origin'=>$origin,'root_hash'=>hash('sha256',realpath($root)?:$root),'checked_at'=>time(),'passed'=>$passed,'checks'=>$rows];
 Files::putJson($root.'/runtime/cra1_theme/private-path-check.json',$proof,0600);
 echo json_encode($proof,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)."\n";
}finally{foreach($paths as$path)if(is_file($path))unlink($path);}
exit($passed?0:1);
