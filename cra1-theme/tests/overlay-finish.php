<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
require CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\Overlay;
use CRA1\Theme\Release\ThemeCache;
use CRA1\Theme\Release\Updater;
$base=sys_get_temp_dir().'/cra1-finish-overlay-'.bin2hex(random_bytes(6));mkdir($base,0700);$checks=0;
function check($ok,string $label):void{if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function rejects(callable $run,string $label):void{try{$run();}catch(Throwable $error){$GLOBALS['checks']++;return;}throw new RuntimeException($label);}
function clean(string $path):void{if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')clean($path.'/'.$name);rmdir($path);}
function fixture(string $site):array{
 mkdir($site,0700);$password='Fixture-password-123!';
 CRA1ThemeSecurity::install($site,'fixture-admin',CRA1ThemeSecurity::password($password),['canonical_url'=>'https://fixture.invalid','force_https'=>true]);
 Files::putJson($site.'/runtime/cra1_theme/install.json',['entry'=>'originaladmin']);
 Files::putJson($site.'/runtime/cra1_theme/entry.json',['entry'=>'customadmin']);
 Files::atomic($site.'/public/customadmin/index.php','old custom administrator');
 Files::putJson($site.'/runtime/cra1_theme/distribution/current.json',['release'=>'previous-release','manifest'=>['release'=>'previous-release'],'security_epoch'=>1]);
 $protected=['runtime/cra1_theme/config.json'=>'{"merchant":"keep"}','runtime/cra1_theme/member_center.json'=>'{"sidebar":[],"unknown":"keep"}','runtime/cra1_theme/cart_theme.json'=>'{"custom_css":"keep"}','runtime/cra1_theme/announcements.json'=>'{"private":"keep"}','public/upload/cra1_theme/photo.png'=>'merchant media','app/core.php'=>'core','public/cart/template/pc/default/page.php'=>'default','native-settings.json'=>'{"themes":"default"}'];
 foreach($protected as$path=>$bytes)Files::atomic($site.'/'.$path,$bytes);
 foreach(['runtime/cra1_theme/security.sqlite','config/cra1_theme_security.key','runtime/cra1_theme/entry.json','runtime/cra1_theme/install.json']as$path)$protected[$path]=(string)file_get_contents($site.'/'.$path);
 $release='fixture-extracted-v1';$backend='cra1-theme/backend/releases/'.$release;
 $payload=['public/web/cra1/page.php'=>'new page','public/web/cra1/releases/'.$release.'/app.js'=>'new assets',
  'public/cra1admin/index.php'=>'new custom administrator',$backend.'/Release/Updater.php'=>'backend marker'];
 $rows=[];
 foreach($payload as$path=>$bytes){Files::atomic($site.'/'.$path,$bytes);$rows[$path]=['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)];}
 $doc=['format'=>1,'product'=>'cra1-theme','release'=>$release,'version'=>'v17.3','release_channel'=>'test','backend_root'=>$backend,'files'=>$rows,'release_blockers'=>[]];
 Files::putJson($site.'/cra1-theme/release.json',$doc);
 return [$doc,$protected];
}
$context=static function(){return ['database'=>true,'system_version'=>'10.7.4','modules'=>[]];};
try{
 [$doc,$protected]=fixture($base.'/site');$site=$base.'/site';$overlay=new Overlay($site,$context);
 $pointer=hash_file('sha256',$site.'/runtime/cra1_theme/distribution/current.json');
 $bytes=file_get_contents($site.'/public/web/cra1/page.php');unlink($site.'/public/web/cra1/page.php');
 rejects(static function()use($overlay){$overlay->prepare();},'partial extraction must not pass');Files::atomic($site.'/public/web/cra1/page.php',$bytes);
 Files::atomic($site.'/public/web/cra1/page.php','mixed package');rejects(static function()use($overlay){$overlay->prepare();},'mixed extraction must not pass');Files::atomic($site.'/public/web/cra1/page.php',$bytes);
 rename($site.'/public/web/cra1/page.php',$site.'/outside.php');symlink($site.'/outside.php',$site.'/public/web/cra1/page.php');
 rejects(static function()use($overlay){$overlay->prepare();},'extracted symlink must not pass');unlink($site.'/public/web/cra1/page.php');rename($site.'/outside.php',$site.'/public/web/cra1/page.php');
 check(hash_file('sha256',$site.'/runtime/cra1_theme/distribution/current.json')===$pointer,'rejected extraction does not change selection');
 $ready=$overlay->prepare();check($ready['data']['can_update']&&$ready['data']['update_state']==='ready','valid extraction prepares regular update');
 check($ready['data']['admin_url']==='/customadmin/index.php','current renamed entry takes precedence over historical install address');
 Files::putJson($site.'/runtime/cra1_theme/distribution/current.json',['release'=>'concurrent-release']);
 rejects(static function()use($overlay,$ready){$overlay->apply($ready['confirmation']);},'stale confirmation must not switch concurrent release');
 Overlay::discard($site,$ready['confirmation']);
 Files::putJson($site.'/runtime/cra1_theme/distribution/current.json',['release'=>'previous-release','manifest'=>['release'=>'previous-release'],'security_epoch'=>1]);
 $ready=$overlay->prepare();Files::atomic($site.'/public/web/cra1/page.php','changed after check');
 rejects(static function()use($overlay,$ready){$overlay->apply($ready['confirmation']);},'files changed after check must not apply');
 Files::atomic($site.'/public/web/cra1/page.php',$bytes);Overlay::discard($site,$ready['confirmation']);
 $themeCache=$site.'/runtime/temp/'.str_repeat('a',32).'.php';$nativeCache=$site.'/runtime/temp/'.str_repeat('b',32).'.php';
 Files::atomic($themeCache,'<?php /*'.serialize([$site.'/public/web/cra1/page.php'=>time()+3600]).'*/ ?>cached old theme');
 Files::atomic($nativeCache,'<?php /*'.serialize([$site.'/public/cart/template/pc/default/page.php'=>time()+3600]).'*/ ?>native cache');
 $ready=$overlay->prepare();$result=$overlay->apply($ready['confirmation']);
 check($result['updated']&&$result['admin_url']==='/customadmin/index.php','finish uses original administrator entry');
 check(file_get_contents($site.'/public/customadmin/index.php')==='new custom administrator','extracted default administrator files map to current custom address');
 check(!is_file($themeCache)&&is_file($nativeCache),'only CRA1 compiled templates cleared even with future timestamps');
 foreach($protected as$path=>$value)check(file_get_contents($site.'/'.$path)===$value,'data preserved: '.$path);
 $after=hash_file('sha256',$site.'/runtime/cra1_theme/distribution/current.json');
 $again=$overlay->apply($ready['confirmation']);check($again['updated']&&hash_file('sha256',$site.'/runtime/cra1_theme/distribution/current.json')===$after,'duplicate completion is idempotent');
 Overlay::discard($site,$ready['confirmation']);
 check($overlay->prepare()['data']['update_state']==='current','subsequent check recognizes selected package without reinitializing');
 $updater=new Updater($site,'customadmin',$context);$updater->rollback($result['history']);
 check(file_get_contents($site.'/public/customadmin/index.php')==='new custom administrator','security entry retained on rollback');
 check(Files::json($site.'/runtime/cra1_theme/distribution/current.json')['release']==='previous-release','rollback returns former pointer');
 $ready=$overlay->prepare();$restored=$overlay->apply($ready['confirmation']);Overlay::discard($site,$ready['confirmation']);
 check($restored['updated'],'re-extracted package can complete after rollback');
 $history=$site.'/runtime/cra1_theme/distribution/history/'.$restored['history'].'/journal.json';$journal=Files::json($history);$journal['state']='prepared';
 Files::putJson($site.'/runtime/cra1_theme/distribution/pending.json',$journal,0600);
 $pending=$overlay->prepare();check($pending['data']['can_recover']&&!$pending['data']['can_update'],'interrupted update offers recovery, never another apply');
 rejects(static function()use($overlay,$ready){$overlay->recover($ready['confirmation']);},'only confirmed pending journal can recover');
 check($overlay->recover($pending['confirmation'])['restored'],'fixed entry reuses ordinary transaction recovery');
 check(!is_file($site.'/runtime/cra1_theme/distribution/pending.json'),'successful recovery clears maintenance marker');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{clean($base);}
