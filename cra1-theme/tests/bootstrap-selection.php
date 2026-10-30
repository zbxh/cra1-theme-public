<?php
declare(strict_types=1);
$source=dirname(__DIR__).'/backend/bootstrap.php';$base=sys_get_temp_dir().'/cra1-bootstrap-'.bin2hex(random_bytes(6));mkdir($base,0700);$checks=0;
function check($ok,string $label):void{if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function clean(string $path):void{if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')clean($path.'/'.$name);rmdir($path);}
function selection(bool $installer):array{
 $script=($installer?'define("CRA1_THEME_INSTALLER_CANDIDATE",true);':'').'try{require $argv[1];echo CRA1_THEME_BACKEND;}catch(Throwable $e){echo "rejected";exit(2);}';
 $command=[PHP_BINARY,'-r',$script,$GLOBALS['base'].'/cra1-theme/backend/bootstrap.php'];
 $process=proc_open($command,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);fclose($pipes[0]);$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);return [proc_close($process),$out,$err];
}
try{
 foreach(['old-release','new-release']as$id){$backend=$base.'/cra1-theme/backend/releases/'.$id;foreach(['Release/Updater.php','Security/OperationVerification.php']as$path){mkdir(dirname($backend.'/'.$path),0700,true);file_put_contents($backend.'/'.$path,'<?php');}}
 copy($source,$base.'/cra1-theme/backend/bootstrap.php');mkdir($base.'/runtime/cra1_theme/distribution',0700,true);
 file_put_contents($base.'/cra1-theme/release.json',json_encode(['release'=>'new-release','backend_root'=>'cra1-theme/backend/releases/new-release']));
 file_put_contents($base.'/runtime/cra1_theme/distribution/current.json',json_encode(['release'=>'old-release','backend_root'=>'cra1-theme/backend/releases/old-release']));
 $normal=selection(false);check($normal[0]===0&&substr($normal[1],-12)==='/old-release','ordinary requests keep committed backend after extraction');
 $installer=selection(true);check($installer[0]===0&&substr($installer[1],-12)==='/new-release','only fixed installer selects package backend');
 file_put_contents($base.'/runtime/cra1_theme/distribution/current.json','broken pointer');
 check(selection(false)[0]===2&&selection(true)[0]===0,'fixed recovery entry can start independently of a damaged old pointer');
 file_put_contents($base.'/cra1-theme/release.json',json_encode(['release'=>'different-release','backend_root'=>'cra1-theme/backend/releases/new-release']));check(selection(true)[0]===2,'candidate release and backend must agree');
 file_put_contents($base.'/cra1-theme/release.json',json_encode(['release'=>'new-release','backend_root'=>'../outside']));check(selection(true)[0]===2,'candidate cannot redirect backend outside theme releases');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{clean($base);}
