<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\LocalPackages;
use CRA1\Theme\Release\Package;
use CRA1\Theme\Release\Updater;

$root=sys_get_temp_dir().'/cra1-local-import-'.bin2hex(random_bytes(6));mkdir($root,0700);$checks=[];
function check($value,string $label): void {if(!$value)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
function rejects(callable $work,string $label): void {try{$work();}catch(Throwable $error){check(true,$label);return;}check(false,$label);}
function removeTree(string $dir): void {foreach(new FilesystemIterator($dir,FilesystemIterator::SKIP_DOTS) as $file){$path=$file->getPathname();if($file->isDir()&&!$file->isLink())removeTree($path);else unlink($path);}rmdir($dir);}
try{
 $inbox=new LocalPackages($root);$first=$inbox->listing();
 check($first['files']===[]&&$first['directory']===LocalPackages::DIRECTORY.'/','empty inbox is created with a relative customer path');
 $directory=$root.'/'.LocalPackages::DIRECTORY;
 check((fileperms($directory)&0777)===0700,'local ZIP inbox stays private');
 $files=['public/web/cra1/example.js'=>'new theme content'];$manifest=['format'=>1,'product'=>'cra1-theme','release'=>'fixture-local-import-v1','version'=>'v17.2','verified_combinations'=>[['system'=>'10.7.4','modules'=>[],'evidence'=>'isolated local import fixture']],'files'=>[]];
 foreach($files as $path=>$bytes)$manifest['files'][$path]=['sha256'=>hash('sha256',$bytes),'bytes'=>strlen($bytes)];
 $source=$directory.'/主题安装包 v17.2.zip';$zip=new ZipArchive();$zip->open($source,ZipArchive::CREATE);$zip->addFromString('cra1-theme/release.json',json_encode($manifest));foreach($files as $path=>$bytes)$zip->addFromString($path,$bytes);$zip->close();
 file_put_contents($directory.'/unfinished.zip.part','incomplete');file_put_contents($directory.'/readme.txt','not a package');mkdir($directory.'/folder.zip');symlink($source,$directory.'/linked.zip');link($source,$directory.'/hardlink.zip');
 check($inbox->listing()['files']===[],'symlinks, hardlinks, partial uploads and directories are not offered');
 unlink($directory.'/hardlink.zip');$list=$inbox->listing();check(count($list['files'])===1&&$list['files'][0]['name']==='主题安装包 v17.2.zip','normal Unicode ZIP names can be selected');
 $id=$list['files'][0]['id'];$stage=$root.'/runtime/cra1_theme/distribution/candidates';mkdir($stage,0700,true);$candidate=$stage.'/candidate.zip';
 $inbox->copyToCandidate($id,$candidate);
 check(hash_file('sha256',$source)===hash_file('sha256',$candidate),'local import copies the exact package bytes');
 check((fileperms($candidate)&0777)===0600&&is_file($source),'candidate is private and original server ZIP is retained');
 check(Package::inspect($candidate)['manifest']['version']==='v17.2','local ZIP uses the real installation manifest contract');
 rejects(static function()use($inbox,$id,$candidate){$inbox->copyToCandidate($id,$candidate);},'existing candidate cannot be replaced');
 check(hash_file('sha256',$source)===hash_file('sha256',$candidate),'rejected overwrite preserves a valid candidate');
 rejects(static function()use($inbox,$stage){$inbox->copyToCandidate('../../config.php',$stage.'/bad.zip');},'browser cannot supply an arbitrary server path');
 $outside=$root.'/outside.zip';copy($source,$outside);symlink($outside,$directory.'/outside-link.zip');symlink('/etc/hosts',$directory.'/host-restricted.zip');
 check(count($inbox->listing()['files'])===1,'a link outside the inbox cannot be imported');
 file_put_contents($source,'changed',FILE_APPEND);clearstatcache();
 rejects(static function()use($inbox,$id,$stage){$inbox->copyToCandidate($id,$stage.'/stale.zip');},'changed files invalidate previously selected identifiers');
 check(!file_exists($stage.'/stale.zip'),'stale local selection leaves no candidate behind');
 // Only the private candidate is used after selection, never the mutable inbox.
 $updater=new Updater($root,'cra1admin',static function(){return ['database'=>true,'system_version'=>'10.7.4','modules'=>[]];});
 $result=$updater->apply($candidate,hash_file('sha256',$candidate));
 check(file_get_contents($root.'/public/web/cra1/example.js')==='new theme content','local candidate follows the existing transactional updater');
 $updater->rollback($result['history']);check(!is_file($root.'/public/web/cra1/example.js'),'local update supports normal rollback');
 $bundle=$stage.'/tutorial-bundle.zip';$zip=new ZipArchive();$zip->open($bundle,ZipArchive::CREATE);$zip->addFromString('cra1-theme-install.zip',file_get_contents($candidate));$zip->addFromString('安装教程/安装教程.md','not install content');$zip->close();
 try{Package::inspect($bundle);check(false,'tutorial bundle must fail');}catch(InvalidArgumentException $error){check(strpos($error->getMessage(),'不要上传包含图文教程')!==false,'tutorial bundles receive an actionable message without nested extraction');}
 check(!is_dir($stage.'/安装教程'),'bundle content is never extracted');
 $empty=$directory.'/empty.zip';touch($empty);$large=$directory.'/oversized.zip';$f=fopen($large,'wb');ftruncate($f,LocalPackages::MAX_BYTES+1);fclose($f);clearstatcache();
 check(count($inbox->listing()['files'])===1,'empty and oversized ZIP files are not offered');
 // The inbox itself must not be a symlink, including after a listing succeeded.
 rename($directory,$directory.'-original');symlink($directory.'-original',$directory);
 rejects(static function()use($inbox){$inbox->listing();},'inbox directory cannot redirect to a different path');
 echo json_encode(['status'=>'passed','checks'=>count($checks),'results'=>$checks],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";
}finally{removeTree($root);}
