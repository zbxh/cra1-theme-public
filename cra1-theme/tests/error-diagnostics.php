<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Failure;
use CRA1\Theme\Diagnostics;
use CRA1\Theme\Files;
use CRA1\Theme\Http\CustomerError;
$checks=0;
function check($value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
foreach([
 ['Read-only file system','只读'],['Disk quota exceeded','配额'],['No space left on device','inode'],
 ['open_basedir restriction in effect','open_basedir'],['Too many open files','文件数量'],
]as[$warning,$needle]){
 $reason=(new Failure('写入文件','/fixture-site/runtime/cra1_theme/config.json',$warning,0600))->describe('/fixture-site');
 check(strpos($reason,$needle)!==false&&strpos($reason,'/fixture-site')===false,'accurate storage classification: '.$needle);
}
$base=sys_get_temp_dir().'/cra1-diagnostics-'.bin2hex(random_bytes(5));mkdir($base,0700);
try{
 Files::atomic($base.'/config.json','before',0600);chmod($base.'/config.json',0400);
 Files::atomic($base.'/config.json','after',0600);
 check(file_get_contents($base.'/config.json')==='after','atomic replacement depends on parent permissions, not old file write bit');
 $lock=Files::openLock($base.'/config.lock');check(is_resource($lock),'shared lock opens');flock($lock,LOCK_UN);fclose($lock);
 $p=new PDOException('SQLSTATE[HY000] Access denied for user private-user password=fixture-secret');$p->errorInfo=['HY000',1045,'private'];
 $reason=Diagnostics::reason($p,$base);
 check(strpos($reason,'拒绝认证')!==false&&strpos($reason,'fixture-secret')===false&&strpos($reason,'private-user')===false,'database auth failure is Chinese and private');
 $p=new PDOException('SQLSTATE[HY000] Connection refused');$p->errorInfo=['HY000',2002,'private'];
 check(strpos(Diagnostics::reason($p),'连接不可用')!==false,'database transport is not mislabeled as bad credentials');
 $unknown=Diagnostics::reason(new RuntimeException('Unexpected value in /root/private.php token=secret'));
 check(strpos($unknown,'无法')===false&&strpos($unknown,'确认')!==false&&strpos($unknown,'private')===false,'unconfirmed cause remains unconfirmed');
 foreach([['/host/20/renew','续费'],['/product/settle','订单'],['/pay','付款']]as[$path,$needle]){
  $result=CustomerError::payload(['status'=>503,'msg'=>'SQLSTATE[HY000]','data'=>['debug'=>'private','cookie'=>'secret','description'=>'/runtime/cra1_theme/security.sqlite']],200,['method'=>'POST','path'=>$path]);
  check(strpos($result['msg'],'尚未确认')!==false&&strpos($result['msg'],$needle)!==false,'write errors cannot claim failure before state is checked');
  check(strpos(json_encode($result),'private')===false&&strpos(json_encode($result),'secret')===false,'error envelopes are recursively private');
 }
 foreach([403,404]as$status)check(CustomerError::message('internal',$status,['path'=>'/order/20'])==='订单不存在或你无权查看，请到订单列表确认','orders have the same inaccessible message');
 $copy=['status'=>200,'data'=>['html'=>'<form></form><script>pay()</script>','password'=>'authorized-credential']];
 check(CustomerError::payload($copy)===$copy,'success and payment HTML contracts remain unchanged');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_requests'=>0])."\n";
}finally{foreach(glob($base.'/*')?:[]as$p)unlink($p);rmdir($base);}
