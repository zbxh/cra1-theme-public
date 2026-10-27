<?php
/** Announcement migration in real theme update/rollback transactions, with disposable data. */
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\Updater;
use CRA1\Theme\Storage\AnnouncementStore;
$base=sys_get_temp_dir().'/cra1-notice-release-'.bin2hex(random_bytes(6));mkdir($base,0700);$checks=0;
function check($ok,string $label):void{if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function removeFixture(string $dir):void{if(is_file($dir)||is_link($dir)){unlink($dir);return;}foreach(scandir($dir)as$name)if($name!=='.'&&$name!=='..')removeFixture($dir.'/'.$name);rmdir($dir);}
try{
 $backend='cra1-theme/backend/releases/fixture-notices-v1';$files=['public/web/cra1/update-probe.js'=>'new UI'];
 foreach(['Announcements/PageCatalog.php','Announcements/LegacyMigration.php','Storage/AnnouncementStore.php','Storage/member_store.php','Storage/workspace_schema.json']as$path)$files[$backend.'/'.$path]=file_get_contents(CRA1_THEME_BACKEND.'/'.$path);
 $rows=[];foreach($files as$name=>$bytes)$rows[$name]=['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)];
 $manifest=['format'=>1,'product'=>'cra1-theme','release'=>'fixture-notices-v1','backend_root'=>$backend,'files'=>$rows,'verified_combinations'=>[['system'=>'10.7.4','modules'=>[],'evidence'=>'isolated test only']],'release_blockers'=>[]];
 $archive=$base.'/update.zip';$zip=new ZipArchive();$zip->open($archive,ZipArchive::CREATE);$zip->addFromString('manifest.json',json_encode($manifest));foreach($files as$name=>$bytes)$zip->addFromString('payload/'.$name,$bytes);$zip->close();
 $site=$base.'/site';Files::atomic($site.'/public/web/cra1/update-probe.js','old UI');Files::atomic($site.'/app/protected.php','untouched native file');
 $legacy=['content'=>['notices'=>['enabled'=>1,'items'=>[['id'=>'original','title'=>'迁移前的公告','global'=>1,'enabled'=>1]]]],'merchant_extra'=>['keep'=>1]];
 Files::putJson($site.'/runtime/cra1_theme/member_center.json',$legacy);Files::putJson($site.'/runtime/cra1_theme/member_center_public.json',$legacy);
 $sourceHash=hash_file('sha256',$site.'/runtime/cra1_theme/member_center.json');$coreHash=hash_file('sha256',$site.'/app/protected.php');
 $context=static function(){return ['database'=>true,'system_version'=>'10.7.4','modules'=>[]];};$updater=new Updater($site,'cra1admin',$context);
 check($updater->preflight($archive)['can_apply'],'real updater accepts isolated candidate');
 check(!is_file($site.'/runtime/cra1_theme/announcements.json')&&!is_dir($site.'/runtime/cra1_theme/announcement-migration'),'preflight never migrates');
 $writes=0;$interrupted=new Updater($site,'cra1admin',$context,static function($path,$bytes,$mode)use(&$writes){if(++$writes===2)throw new RuntimeException('fixture interruption');Files::atomic($path,$bytes,$mode);});
 $failed=false;try{$interrupted->apply($archive,hash_file('sha256',$archive));}catch(RuntimeException $e){$failed=true;}
 check($failed&&file_get_contents($site.'/public/web/cra1/update-probe.js')==='old UI','interrupted update restores UI files');
 check(!is_file($site.'/runtime/cra1_theme/distribution/pending.json')&&!is_file($site.'/runtime/cra1_theme/announcements.json'),'interrupted writes leave no migration or pending selection');
 $applied=$updater->apply($archive,hash_file('sha256',$archive));$store=new AnnouncementStore($site);
 check($store->publicPayload('member','/home.htm')['items'][0]['title']==='迁移前的公告','successful update migrates old content');
 check(!isset(Files::json($site.'/runtime/cra1_theme/member_center_public.json')['content']['notices']),'update removes old public announcement content');
 $saved=$store->payload();$values=$saved['values'];$values['items'][0]['title']='新版保存的公告';$store->save($saved['revision'],$values,'fixture');$hash=hash_file('sha256',$site.'/runtime/cra1_theme/announcements.json');
 $updater->rollback($applied['history']);
 check(file_get_contents($site.'/public/web/cra1/update-probe.js')==='old UI','rollback restores previous UI');
 check(hash_file('sha256',$site.'/runtime/cra1_theme/announcements.json')===$hash,'rollback retains newly saved announcement data');
 $updater->apply($archive,hash_file('sha256',$archive));
 check(hash_file('sha256',$site.'/runtime/cra1_theme/announcements.json')===$hash,'reapply does not import stale notices again');
 check(hash_file('sha256',$site.'/runtime/cra1_theme/member_center.json')===$sourceHash&&hash_file('sha256',$site.'/app/protected.php')===$coreHash,'source configuration and native files unchanged');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{removeFixture($base);}
