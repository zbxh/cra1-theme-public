<?php
/** Run as the web service user; never changes a real config or account. */
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');require CRA1_THEME_BACKEND.'/bootstrap.php';
foreach(['member_store','cart_store']as$file)require CRA1_THEME_BACKEND.'/Storage/'.$file.'.php';
use CRA1\Theme\Storage\MemberCenterStore;
use CRA1\Theme\Storage\CartThemeStore;
$base=sys_get_temp_dir().'/cra1-storage-errors-'.bin2hex(random_bytes(6));mkdir($base,0700);$checks=0;
function check($v,string $m):void{if(!$v)throw new RuntimeException($m);$GLOBALS['checks']++;}
function clean(string $p):void{if(!is_dir($p)){unlink($p);return;}chmod($p,0700);foreach(scandir($p)as$n)if($n!=='.'&&$n!=='..')clean($p.'/'.$n);rmdir($p);}
try{
 foreach(['member'=>MemberCenterStore::class,'cart'=>CartThemeStore::class]as$domain=>$class){
  $runtime=$base.'/'.$domain;mkdir($runtime.'/cra1_theme',0700,true);$dir=$runtime.'/cra1_theme';
  $main=$dir.'/'.($domain==='member'?'member_center':'cart_theme').'.json';$snapshot=$dir.'/'.($domain==='member'?'member_center_public':'cart_theme_public').'.json';
  $store=new $class($runtime);$patch=$domain==='member'?['appearance'=>['sidebar_collapsed'=>false]]:['content'=>[]];
  $ok=$store->save($patch,'isolated-fixture');check($ok['status']===200&&$ok['data']['snapshot_ok'],'initial isolated save '.$domain);
  $before=file_get_contents($main);chmod($dir,0500);
  $failure=$store->save($patch,'isolated-fixture');
  check($failure['status']===400&&strpos($failure['msg'],'配置未保存')!==false,'definite failed save '.$domain);
  check(strpos($failure['msg'],'0500')!==false&&strpos($failure['msg'],'PHP 运行账号')!==false,'actual mode and runtime identity '.$domain);
  check(file_get_contents($main)===$before,'main config unchanged '.$domain);chmod($dir,0700);
  unlink($snapshot);mkdir($snapshot,0700);
  $partial=$store->save($patch,'isolated-fixture');
  check($partial['status']===200&&$partial['data']['snapshot_ok']===false&&$partial['data']['save_state']==='partial','committed config with failed snapshot stays successful '.$domain);
  check(strpos($partial['msg'],'配置已保存')!==false&&strpos($partial['data']['snapshot_error'],basename($snapshot))!==false,'partial result explains exact snapshot location '.$domain);
  check(file_get_contents($main)!==$before,'main config actually committed '.$domain);
  rmdir($snapshot);$store->ensureSnapshot();check(is_file($snapshot),'snapshot repair works '.$domain);
  $good=file_get_contents($main);file_put_contents($main,'{fixture-broken');
  try{$store->read();throw new RuntimeException('corrupt config must be rejected');}
  catch(RuntimeException $error){check(strpos($error->getMessage(),basename($main))!==false&&strpos($error->getMessage(),'备份恢复')!==false,'corrupt config identifies file and recovery step '.$domain);}
  check(file_get_contents($main)==='{fixture-broken','corrupt config is never overwritten '.$domain);file_put_contents($main,$good);
  chmod($main,0000);
  try{$store->read();throw new RuntimeException('unreadable config must be rejected');}
  catch(\CRA1\Theme\Failure $error){check(strpos($error->describe(CRA1_THEME_ROOT),'读取文件失败')!==false&&strpos($error->describe(CRA1_THEME_ROOT),'权限不足')!==false,'unreadable config is not mislabeled as corrupt JSON '.$domain);}
  chmod($main,0640);
 }
 require CRA1_THEME_BACKEND.'/Support/cra1_theme_media.php';
 $mediaRoot=$base.'/media';mkdir($mediaRoot.'/runtime/cra1_theme',0700,true);
 $media=new CRA1ThemeMediaStore($mediaRoot,true);chmod($mediaRoot.'/runtime/cra1_theme',0500);
 try{$media->lock();throw new RuntimeException('lock must fail');}
 catch(\CRA1\Theme\Failure $failure){$message=$failure->describe($mediaRoot);check(strpos($message,'attachments.lock')!==false&&strpos($message,'权限不足')!==false,'attachment lock reports the actual permission error');check(strpos($message,'暂时忙')===false,'attachment permission failure is never mislabeled as contention');}
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_requests'=>0])."\n";
}finally{clean($base);}
