<?php
declare(strict_types=1);
$base=sys_get_temp_dir().'/cra1-filesystem-'.bin2hex(random_bytes(6));mkdir($base,0700);mkdir($base.'/public',0700);
copy(dirname(__DIR__).'/backend/Files.php',$base.'/Files.php');
$code='set_error_handler(static function($n,$s){throw new ErrorException($s,0,$n);});require $argv[1]."/Files.php";'
 .'CRA1\\Theme\\Files::atomic($argv[1]."/public/file.json","{\"kept\":true}");'
 .'$d=CRA1\\Theme\\Files::json($argv[1]."/public/file.json");'
 .'CRA1\\Theme\\Files::noLinks($argv[1]."/public/future/missing.json");'
 .'$denied=false;try{CRA1\\Theme\\Files::noLinks(dirname($argv[1])."/outside");}catch(Throwable $e){$denied=true;}'
 .'symlink($argv[1]."/public/file.json",$argv[1]."/public/link.json");'
 .'$link=false;try{CRA1\\Theme\\Files::json($argv[1]."/public/link.json");}catch(Throwable $e){$link=true;}'
 .'if(!$d["kept"]||!$denied||!$link)exit(2);echo json_encode(["status"=>"passed","checks"=>4]);';
try{
 $pipes=[];$process=proc_open([PHP_BINARY,'-d','disable_functions=','-d','open_basedir='.$base,'-r',$code,$base],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
 $out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$status=proc_close($process);
 if($status!==0||$err!=='')throw new RuntimeException('Restricted filesystem fixture failed: '.$err);
 echo $out.PHP_EOL;
}finally{
 foreach(glob($base.'/public/*')?:[]as$p)unlink($p);
 unlink($base.'/Files.php');rmdir($base.'/public');rmdir($base);
}
