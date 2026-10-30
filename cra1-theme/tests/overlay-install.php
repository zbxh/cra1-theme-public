<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Release\Package;
use CRA1\Theme\Release\Updater;
use CRA1\Theme\Files;
$base=sys_get_temp_dir().'/cra1-overlay-'.bin2hex(random_bytes(6));mkdir($base,0700);
$checks=0;
function check($ok,string $label):void{if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function rejects(callable $run,string $label):void{try{$run();}catch(Throwable $e){$GLOBALS['checks']++;return;}throw new RuntimeException($label);}
function installZip(string $file,array $payload,array $extra=[]):array{
 $rows=[];foreach($payload as $name=>$bytes)$rows[$name]=['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)];
 $manifest=['format'=>1,'product'=>'cra1-theme','release'=>'fixture-overlay-v1','version'=>'v17.1','release_channel'=>'test','files'=>$rows,'verified_combinations'=>[['system'=>'10.7.4','modules'=>[],'evidence'=>'isolated fixture only']],'release_blockers'=>[]];
 $zip=new ZipArchive();$zip->open($file,ZipArchive::CREATE|ZipArchive::OVERWRITE);
 $zip->addFromString('cra1-theme/release.json',json_encode($manifest));
 foreach($payload as$name=>$bytes)$zip->addFromString($name,$bytes);
 foreach($extra as$name=>$bytes)$zip->addFromString($name,$bytes);
 $zip->close();return $manifest;
}
function clean(string $path):void{if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')clean($path.'/'.$name);rmdir($path);}
try{
 $payload=['public/web/cra1/page.js'=>'current','public/cra1admin/welcome.php'=>'admin-current','public/web/cra1/releases/fixture-overlay-v1/app.js'=>'immutable'];
 $archive=$base.'/install.zip';$inner=installZip($archive,$payload);$info=Package::inspect($archive);
 check($info['archive_format']==='install','flat installation archive accepted');
 check($info['manifest']['version']==='v17.1','public version preserved');
 check(count($info['manifest']['files'])===count($payload)+1,'release manifest included in complete overwrite inventory');
 Package::stage($archive,$base.'/staged',$info);
 check(file_get_contents($base.'/staged/public/web/cra1/page.js')==='current','flat installation files extracted through validated staging');
 check(json_decode(file_get_contents($base.'/staged/cra1-theme/release.json'),true)===$inner,'inner manifest retained unchanged');
 foreach(['../private.txt','public/web/cra1/../../config.php','config.php','runtime/cra1_theme/config.json','app/common.php']as$unsafe){
  $bad=$base.'/unsafe.zip';installZip($bad,[$unsafe=>'forbidden']);rejects(static function()use($bad){Package::inspect($bad);},'unsafe overwrite accepted');
 }
 $bad=$base.'/extra.zip';installZip($bad,$payload,['public/web/cra1/extra.js'=>'unlisted']);rejects(static function()use($bad){Package::inspect($bad);},'unlisted installation file accepted');
 $bad=$base.'/tampered.zip';installZip($bad,$payload);$z=new ZipArchive();$z->open($bad);$z->addFromString('public/web/cra1/page.js','changed');$z->close();rejects(static function()use($bad){Package::inspect($bad);},'tampered installation file accepted');
 $bad=$base.'/missing.zip';installZip($bad,$payload);$z=new ZipArchive();$z->open($bad);$z->deleteName('public/web/cra1/page.js');$z->close();rejects(static function()use($bad){Package::inspect($bad);},'missing installation file accepted');
 $bad=$base.'/symlink.zip';installZip($bad,$payload);$z=new ZipArchive();$z->open($bad);$z->setExternalAttributesName('public/web/cra1/page.js',ZipArchive::OPSYS_UNIX,0120777<<16);$z->close();rejects(static function()use($bad){Package::inspect($bad);},'symlink installation entry accepted');
 $bad=$base.'/ambiguous.zip';installZip($bad,$payload,['manifest.json'=>'{}']);rejects(static function()use($bad){Package::inspect($bad);},'ambiguous archive layout accepted');
 $site=$base.'/site';mkdir($site);Files::atomic($site.'/public/web/cra1/page.js','previous');Files::atomic($site.'/public/customadmin/welcome.php','admin-previous');
 Files::atomic($site.'/public/web/cra1/releases/previous-v1/app.js','previous-immutable');
 $protected=['app/protected.php'=>'core','runtime/cra1_theme/config.json'=>'{"private":"keep"}','runtime/cra1_theme/member_center.json'=>'{"custom":"keep"}','runtime/cra1_theme/security.sqlite'=>'private-identity','config/cra1_theme_security.key'=>'private-key','public/upload/cra1_theme/photo.png'=>'merchant-media'];
 foreach($protected as$p=>$b)Files::atomic($site.'/'.$p,$b);
 $updater=new Updater($site,'customadmin',static function(){return['database'=>true,'system_version'=>'10.7.4','modules'=>[]];});
 check($updater->preflight($archive)['can_apply'],'same installation archive passes overwrite preflight');
 $result=$updater->apply($archive,$info['sha256']);
 check(file_get_contents($site.'/public/web/cra1/page.js')==='current','theme file overwritten');
 check(file_get_contents($site.'/public/customadmin/welcome.php')==='admin-current','renamed admin entry mapped safely');
 check(!is_dir($site.'/public/cra1admin'),'overwrite does not expose duplicate default admin entry');
 check($updater->history()['current']['release']==='fixture-overlay-v1','resource pointer switched');
 foreach($protected as$p=>$b)check(file_get_contents($site.'/'.$p)===$b,'protected data preserved: '.$p);
 $updater->rollback($result['history']);
 check(file_get_contents($site.'/public/web/cra1/page.js')==='previous','rollback restores prior theme file');
 check(is_file($site.'/public/web/cra1/releases/fixture-overlay-v1/app.js')&&is_file($site.'/public/web/cra1/releases/previous-v1/app.js'),'immutable resources retained');
 foreach($protected as$p=>$b)check(file_get_contents($site.'/'.$p)===$b,'rollback preserves data: '.$p);
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{clean($base);}
