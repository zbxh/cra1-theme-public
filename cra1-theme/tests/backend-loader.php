<?php
declare(strict_types=1);
// Every probe runs in a separate PHP process against a relocated, synthetic install.
$base=sys_get_temp_dir().'/cra1-backend-loader-'.bin2hex(random_bytes(6));
function loaderRemove(string $p):void {if(is_dir($p)&&!is_link($p)){foreach(scandir($p) as $n)if($n!=='.'&&$n!=='..')loaderRemove($p.'/'.$n);rmdir($p);}elseif(file_exists($p)||is_link($p))unlink($p);}
function loaderWrite(string $p,string $b):void {if(!is_dir(dirname($p)))mkdir(dirname($p),0700,true);file_put_contents($p,$b);}
$checks=0;
function loaderCheck(bool $v,string $label):void {if(!$v)throw new RuntimeException($label);$GLOBALS['checks']++;}
function loaderProbe(string $root,?array $change=null,bool $restricted=false):array {
    $code='try{require '.var_export($root.'/cra1-theme/backend/bootstrap.php',true).';';
    if($change!==null)$code.='file_put_contents('.var_export($root.'/runtime/cra1_theme/distribution/current.json',true).','.var_export(json_encode($change),true).');';
    $code.='echo json_encode(["backend"=>CRA1_THEME_BACKEND,"value"=>CRA1\\Theme\\Probe::value()]);}catch(Throwable $e){fwrite(STDERR,"expected probe failure");exit(2);}';
    $args=[PHP_BINARY];if($restricted){$args[]='-d';$args[]='open_basedir='.$root;}
    $args[]='-r';$args[]=$code;
    $pipes=[];$process=proc_open($args,[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$status=proc_close($process);
    return ['status'=>$status,'data'=>json_decode($out,true),'stderr'=>$error];
}
try {
    loaderWrite($base.'/cra1-theme/backend/bootstrap.php',(string)file_get_contents(dirname(__DIR__).'/backend/bootstrap.php'));
    foreach(['loader-one','loader-two'] as $id){
        $root=$base.'/cra1-theme/backend/releases/'.$id;
        loaderWrite($root.'/Release/Updater.php','<?php // isolated selector prerequisite');
        loaderWrite($root.'/Security/OperationVerification.php','<?php // isolated selector prerequisite');
        loaderWrite($root.'/Probe.php','<?php namespace CRA1\\Theme;final class Probe {public static function value(){return '.var_export($id,true).';}}');
    }
    $one=['backend_root'=>'cra1-theme/backend/releases/loader-one'];$two=['backend_root'=>'cra1-theme/backend/releases/loader-two'];
    $pointer=$base.'/runtime/cra1_theme/distribution/current.json';
    loaderWrite($base.'/cra1-theme/release.json',json_encode($one));
    $r=loaderProbe($base);loaderCheck($r['status']===0&&$r['data']['value']==='loader-one','install manifest selects relocated private backend');
    $r=loaderProbe($base,null,true);loaderCheck($r['status']===0&&$r['stderr']===''&&$r['data']['value']==='loader-one','loader works with site-only open_basedir without touching denied ancestors');
    loaderWrite($pointer,json_encode(['manifest'=>$two]));$r=loaderProbe($base);loaderCheck($r['status']===0&&$r['data']['value']==='loader-two','current manifest selects the completed backend');
    $r=loaderProbe($base,$one);loaderCheck($r['status']===0&&$r['data']['value']==='loader-two','request keeps selected backend after pointer changes');
    loaderWrite($pointer,json_encode(['manifest'=>$one]+$two));$r=loaderProbe($base);loaderCheck($r['status']===0&&$r['data']['value']==='loader-two','UI rollback can retain the newer safety backend');
    foreach(['../../app','cra1-theme/backend/releases/missing','cra1-theme/backend/releases/../loader-one'] as $path){loaderWrite($pointer,json_encode(['backend_root'=>$path]));loaderCheck(loaderProbe($base)['status']!==0,'invalid or incomplete backend rejected');}
    loaderWrite($pointer,'{broken');loaderCheck(loaderProbe($base)['status']!==0,'damaged pointer is not silently replaced');loaderCheck(file_get_contents($pointer)==='{broken','damaged pointer remains unchanged');
    unlink($pointer);symlink($base.'/cra1-theme/release.json',$pointer);loaderCheck(loaderProbe($base)['status']!==0,'pointer symlink rejected');unlink($pointer);
    rename($base.'/cra1-theme/backend/releases/loader-one',$base.'/held');symlink($base.'/held',$base.'/cra1-theme/backend/releases/loader-one');
    loaderCheck(loaderProbe($base)['status']!==0,'backend directory symlink rejected');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
} finally {loaderRemove($base);}
