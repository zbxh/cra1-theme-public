<?php
declare(strict_types=1);

// Exercise the public API error boundary in separate PHP processes. Successful
// native authentication and installation are covered by the browser flow.
$root=dirname(__DIR__,2);
$base=sys_get_temp_dir().'/cra1-installer-api-'.bin2hex(random_bytes(6));
mkdir($base,0700);$checks=0;
function check($value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
function cleanup(string $path):void{if(is_file($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')cleanup($path.'/'.$name);rmdir($path);}
function response(string $name,?string $bootstrap,?string $manifest=null):array{
    $dir=$GLOBALS['base'].'/'.$name;
    mkdir($dir.'/public/cra1-install',0700,true);
    copy($GLOBALS['root'].'/public/cra1-install/api.php',$dir.'/public/cra1-install/api.php');
    if($bootstrap!==null){mkdir($dir.'/cra1-theme/backend',0700,true);file_put_contents($dir.'/cra1-theme/backend/bootstrap.php',$bootstrap);}
    if($manifest!==null)file_put_contents($dir.'/cra1-theme/release.json',$manifest);
    $command=[PHP_BINARY,'-d','display_errors=0',$dir.'/public/cra1-install/api.php'];
    $process=proc_open($command,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
    if(!is_resource($process))throw new RuntimeException('Cannot start isolated PHP fixture');
    fclose($pipes[0]);$body=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    $code=proc_close($process);$data=json_decode($body,true);
    check($code===0&&is_array($data)&&json_last_error()===JSON_ERROR_NONE,$name.' returns JSON instead of a blank page');
    check(($data['status']??0)===400&&is_string($data['msg']??null),$name.' has a visible installer error');
    check(strpos($body,'INTERNAL-DATABASE-DETAIL')===false&&strpos($body,$GLOBALS['base'])===false,$name.' does not disclose internal details');
    return $data;
}
try{
    $data=response('missing-bootstrap',null);
    check(strpos($data['msg'],'解压到 V10 网站根目录')!==false,'incomplete extraction gives an actionable instruction');
    $data=response('damaged-manifest',(string)file_get_contents($root.'/cra1-theme/backend/bootstrap.php'),'{damaged');
    check(strpos($data['msg'],'清单损坏')!==false,'damaged release metadata is caught by the API boundary');
    $data=response('database-error','<?php throw new PDOException("INTERNAL-DATABASE-DETAIL");');
    check($data['msg']==='安装服务暂不可用，请检查环境后重新点击“验证并检查”','database implementation errors use the generic customer message');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0])."\n";
}finally{cleanup($base);}
