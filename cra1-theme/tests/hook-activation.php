<?php
declare(strict_types=1);
$fixture=sys_get_temp_dir().'/cra1-hook-activation-'.bin2hex(random_bytes(6));mkdir($fixture,0700);$checks=0;
function activationProbe(string $root):int {
    $code='define("CRA1_THEME_ROOT",'.var_export($root,true).');define("CRA1_THEME_BACKEND",'.var_export(dirname(__DIR__).'/backend',true).');class FixtureEvent{public static $calls=0;public static function listen($n,$f){self::$calls++;}}class_alias("FixtureEvent","think\\\\facade\\\\Event");function configuration($k){return "default";}require '.var_export(dirname(__DIR__).'/backend/bootstrap.php',true).';CRA1\\Theme\\Http\\HookBootstrap::register();echo FixtureEvent::$calls;';
    $pipes=[];$p=proc_open([PHP_BINARY,'-r',$code],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$status=proc_close($p);
    if($status!==0)throw new RuntimeException('Activation fixture failed: '.$error);return (int)$out;
}
function activationCheck(bool $ok,string $label):void {if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
try{
    activationCheck(activationProbe($fixture)===0,'uploading candidate files does not register a second security pipeline');
    mkdir($fixture.'/runtime/cra1_theme',0700,true);file_put_contents($fixture.'/runtime/cra1_theme/install.json','{"initialized":true}');
    activationCheck(activationProbe($fixture)===1,'completed installation registers native hook');
    unlink($fixture.'/runtime/cra1_theme/install.json');mkdir($fixture.'/runtime/cra1_theme/distribution',0700);file_put_contents($fixture.'/runtime/cra1_theme/distribution/current.json','{"backend_root":"cra1-theme/backend/releases/fixture-active"}');
    activationCheck(activationProbe($fixture)===1,'committed update registers native hook for a legacy install');
    file_put_contents($fixture.'/runtime/cra1_theme/distribution/current.json','{}');activationCheck(activationProbe($fixture)===0,'empty recovery pointer does not activate new middleware');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{foreach(['runtime/cra1_theme/install.json','runtime/cra1_theme/distribution/current.json'] as $p)if(is_file($fixture.'/'.$p))unlink($fixture.'/'.$p);foreach(['runtime/cra1_theme/distribution','runtime/cra1_theme','runtime',''] as $p)if(is_dir(rtrim($fixture.'/'.$p,'/')))rmdir(rtrim($fixture.'/'.$p,'/'));}
