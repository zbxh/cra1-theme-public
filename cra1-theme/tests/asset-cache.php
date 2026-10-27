<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\Assets;

$temp=sys_get_temp_dir().'/cra1-asset-cache-'.bin2hex(random_bytes(6));
mkdir($temp,0700);
$checks=0;
function assetCheck(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function assetFixture(string $root,string $bytes):string{
    $base='/web/cra1/releases/fixture-same-version';
    Files::putJson($root.'/cra1-theme/release.json',[
        'release'=>'fixture-same-version','asset_bases'=>['website'=>$base],
        'files'=>['public'.$base.'/app.js'=>['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)]]
    ]);
    return $base;
}
function assetCleanup(string $path):void{
    if(is_file($path)||is_link($path)){unlink($path);return;}
    foreach(scandir($path) as $name)if($name!=='.'&&$name!=='..')assetCleanup($path.'/'.$name);
    rmdir($path);
}
try{
    $base=assetFixture($temp.'/first','old cached script');
    assetFixture($temp.'/second','fixed script');
    assetFixture($temp.'/repeated','fixed script');
    $old=Assets::url('website','app.js','',$temp.'/first');
    $new=Assets::url('website','app.js','',$temp.'/second');
    assetCheck(parse_url($old,PHP_URL_PATH)===parse_url($new,PHP_URL_PATH),'Rebuilding does not change the theme version or resource path');
    assetCheck($old!==$new,'A cached old entry cannot satisfy the fixed resource URL');
    assetCheck($new===Assets::url('website','app.js','',$temp.'/repeated'),'Identical resource bytes retain a deterministic cache key');
    assetCheck($new===$base.'/app.js?cra1='.substr(hash('sha256','fixed script'),0,16),'The cache key identifies the installed payload');
    assetCheck(Assets::url('website','','',$temp.'/second')===$base,'Directory bases stay usable by relative imports');
    assetCheck(Assets::url('website','legacy.js','',$temp.'/second')===$base.'/legacy.js','Legacy manifests without a file hash retain their URL contract');
    assetCheck(Assets::url('shared','bundle.js','/legacy/shared.js',$temp.'/second')==='/legacy/shared.js','Missing asset domains retain the original fallback');
    try{Assets::url('website','../secret','',$temp.'/second');throw new LogicException('Traversal accepted');}
    catch(InvalidArgumentException $e){$checks++;}
    echo json_encode(['status'=>'passed','checks'=>$checks]),PHP_EOL;
}finally{assetCleanup($temp);}
