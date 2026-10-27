<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\References;
use CRA1\Theme\Release\Updater;
$base=sys_get_temp_dir().'/cra1-native-copies-'.bin2hex(random_bytes(6));$checks=0;
function check($ok,$message){if(!$ok)throw new RuntimeException($message);$GLOBALS['checks']++;}
function removeCopyFixture($path){if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$n)if($n!=='.'&&$n!=='..')removeCopyFixture($path.'/'.$n);rmdir($path);}
try{
 check(!References::linksAvailable(),'run fixture with -d disable_functions=symlink,readlink');
 Files::atomic($base.'/public/clientarea/template/pc/default/api/common.js','native API');
 Files::atomic($base.'/public/clientarea/template/pc/default/components/sample/component.js','native component');
 Files::atomic($base.'/public/clientarea/template/pc/default/components/sample/.gitkeep','');
 Files::atomic($base.'/public/clientarea/template/pc/cra1/header.php','first UI');
 $refs=['public/clientarea/template/pc/cra1/api/common.js'=>'public/clientarea/template/pc/default/api/common.js','public/clientarea/template/pc/cra1/components'=>'public/clientarea/template/pc/default/components','public/clientarea/template/mobile/cra1'=>'public/clientarea/template/pc/cra1'];
 $native=hash_file('sha256',$base.'/public/clientarea/template/pc/default/api/common.js');
 References::apply($base,$refs);
 check(file_get_contents($base.'/public/clientarea/template/mobile/cra1/api/common.js')==='native API','mobile virtual source includes declared child dependencies');
 check(file_get_contents($base.'/public/clientarea/template/mobile/cra1/components/sample/component.js')==='native component','directory dependencies are copied without disabled symlink function');
 check(!is_link($base.'/public/clientarea/template/mobile/cra1')&&!is_link($base.'/public/clientarea/template/pc/cra1/api/common.js'),'fallback creates ordinary files and directories');
 check(References::apply($base,$refs)===[],'copy dependency preparation is idempotent');
 References::checkCopies($base);check(true,'copy integrity registry matches prepared bytes');
 $path='public/clientarea/template/pc/cra1/header.php';$release='fixture-copy-update-v1';
 $meta=['format'=>1,'product'=>'cra1-theme','release'=>$release,'files'=>[$path=>['sha256'=>hash('sha256','second UI'),'bytes'=>strlen('second UI')]],'references'=>$refs,'verified_combinations'=>[['system'=>'10.7.4','modules'=>[],'evidence'=>'isolated copy fixture']],'release_blockers'=>[]];
 $zipPath=$base.'/update.zip';$zip=new ZipArchive();$zip->open($zipPath,ZipArchive::CREATE);$zip->addFromString('manifest.json',json_encode($meta));$zip->addFromString('payload/'.$path,'second UI');$zip->close();
 $up=new Updater($base,'cra1admin',static function(){return ['database'=>true,'system_version'=>'10.7.4','modules'=>[]];});
 check($up->preflight($zipPath)['can_apply'],'real updater accepts managed copy directories');
 $r=$up->apply($zipPath,hash_file('sha256',$zipPath));
 check(file_get_contents($base.'/public/clientarea/template/mobile/cra1/header.php')==='second UI','update copies use staged future UI files inside the same transaction');
 $up->rollback($r['history']);
 check(file_get_contents($base.'/public/clientarea/template/mobile/cra1/header.php')==='first UI','rollback restores managed mobile copies together with desktop UI');
 References::checkCopies($base);check(true,'copy ownership registry remains accurate after rollback');
 check(hash_file('sha256',$base.'/public/clientarea/template/pc/default/api/common.js')===$native,'native source files remain unchanged through update and rollback');
 Files::atomic($base.'/public/clientarea/template/pc/cra1/api/common.js','merchant change');
 check(!$up->preflight($zipPath)['can_apply'],'unregistered merchant copy changes block update');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{removeCopyFixture($base);}
