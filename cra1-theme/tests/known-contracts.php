<?php
declare(strict_types=1);
if (!defined('CRA1_THEME_BACKEND')) define('CRA1_THEME_BACKEND', dirname(__DIR__).'/backend');
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Compatibility\KnownContracts;
$dir=sys_get_temp_dir().'/cra1-contracts-'.bin2hex(random_bytes(6));mkdir($dir.'/app',0700,true);$checks=0;
function contractCheck($ok,$label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
try{
    file_put_contents($dir.'/app/native.php','original');$files=['app/native.php'=>hash('sha256','original')];
    contractCheck(KnownContracts::filesMatch($dir,$files),'exact original file accepted');
    $reviewed=['id'=>'reviewed-fixture-1','provenance'=>'reviewed-integration','review_sha256'=>str_repeat('a',64),'files'=>['app/native.php'=>hash('sha256','changed')]];
    contractCheck(KnownContracts::matchProfile($dir,$files,[$reviewed])==='official','original profile remains supported');
    file_put_contents($dir.'/app/native.php','changed');contractCheck(!KnownContracts::filesMatch($dir,$files),'same version with changed source rejected');
    contractCheck(KnownContracts::matchProfile($dir,$files,[$reviewed])==='reviewed-fixture-1','complete reviewed integration accepted');
    contractCheck(KnownContracts::matchProfile($dir,$files)===null,'unknown changes never auto-enrol');
    $invalid=$reviewed;unset($invalid['review_sha256']);contractCheck(KnownContracts::matchProfile($dir,$files,[$invalid])===null,'unreviewed integration rejected');
    $invalid=$reviewed;$invalid['files']=[];contractCheck(KnownContracts::matchProfile($dir,$files,[$invalid])===null,'profile cannot omit original dependencies');
    file_put_contents($dir.'/app/extra.php','dependency');
    $first=$reviewed;$first['files']['app/extra.php']=hash('sha256','different');
    $second=$reviewed;$second['files']['app/native.php']=hash('sha256','other');$second['files']['app/extra.php']=hash('sha256','dependency');
    contractCheck(KnownContracts::matchProfile($dir,$files,[$first,$second])===null,'hashes from separate profiles cannot be mixed');
    $reviewed['files']['app/extra.php']=hash('sha256','dependency');
    contractCheck(KnownContracts::matchProfile($dir,$files,[$reviewed])==='reviewed-fixture-1','additional security dependencies checked');
    file_put_contents($dir.'/app/extra.php','tampered');contractCheck(KnownContracts::matchProfile($dir,$files,[$reviewed])===null,'changed transitive dependency rejected');
    unlink($dir.'/app/native.php');contractCheck(!KnownContracts::filesMatch($dir,$files),'missing native file rejected');
    file_put_contents($dir.'/app/other.php','original');symlink($dir.'/app/other.php',$dir.'/app/native.php');contractCheck(!KnownContracts::filesMatch($dir,$files),'native symlink rejected');
    contractCheck(!KnownContracts::filesMatch($dir,[]),'unregistered contract rejected');
    contractCheck(!KnownContracts::filesMatch($dir,['app/../private.php'=>hash('sha256','original')]),'traversal contract rejected');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{foreach(['native.php','other.php','extra.php']as$name)if(is_link($dir.'/app/'.$name)||is_file($dir.'/app/'.$name))unlink($dir.'/app/'.$name);rmdir($dir.'/app');rmdir($dir);}
