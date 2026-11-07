<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\OnlineUpdates;
use CRA1\Theme\Release\OnlineUpdateSettings;
use CRA1\Theme\Release\Updater;

$root=sys_get_temp_dir().'/cra1-online-updates-'.bin2hex(random_bytes(6));mkdir($root,0700);$checks=[];
function check($ok,string $label):void{if(!$ok)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
function rejects(callable $work,string $label):void{try{$work();}catch(InvalidArgumentException $e){check(true,$label);return;}check(false,$label);}
function removeTree(string $dir):void{foreach(new FilesystemIterator($dir,FilesystemIterator::SKIP_DOTS)as$f){if($f->isDir()&&!$f->isLink())removeTree($f->getPathname());else unlink($f->getPathname());}rmdir($dir);}
function release(string $tag,bool $test=false,string $content='fixture package'):array{
 return ['tag_name'=>$tag,'published_at'=>'2026-11-07T00:00:00Z','prerelease'=>$test,'draft'=>false,'body'=>'Customer-facing release notes',
  'assets'=>[['name'=>'CRA1-theme-'.$tag.'-install.zip','size'=>strlen($content),'state'=>'uploaded','digest'=>'sha256:'.hash('sha256',$content),
   'browser_download_url'=>'https://github.com/zbxh/cra1-theme-public/releases/download/'.$tag.'/CRA1-theme-'.$tag.'-install.zip']]];
}
function transport(array $releases,string $content,?callable $override=null):callable{
 return static function(string $url,callable $write,int $limit,int $timeout)use($releases,$content,$override){
  if($override!==null){$result=$override($url,$write,$limit,$timeout);if($result!==null)return $result;}
  if(strpos($url,'/releases?')!==false){$write(json_encode($releases));return ['status'=>200];}
  if(strpos($url,'/releases/tags/')!==false){$tag=basename($url);foreach($releases as$r)if($r['tag_name']===$tag){$write(json_encode($r));return ['status'=>200];}return ['status'=>404];}
  if(strpos($url,'https://github.com/')===0)return ['status'=>302,'headers'=>['Location'=>'https://release-assets.githubusercontent.com/fixture-package.zip?download=1']];
  if(strpos($url,'https://release-assets.githubusercontent.com/')===0){foreach(str_split($content,1024)as$chunk)$write($chunk);return ['status'=>200];}
  throw new RuntimeException('Unexpected fixture request');
 };
}
try{
 $draft=release('v99.0');$draft['draft']=true;$bundle=release('v98.0');$bundle['assets'][0]['name']='CRA1-theme-v98.0.zip';
 $source=release('v97.0');$source['assets']=[];$wrongOrigin=release('v96.0');$wrongOrigin['assets'][0]['browser_download_url']='https://example.invalid/install.zip';
 $rows=[release('v17.6.9',true),release('v17.7'),release('v17.10',true),$draft,$bundle,$source,$wrongOrigin];
 $client=new OnlineUpdates(transport($rows,'fixture package'));
 $r=$client->latest(['version'=>'v17.6.4'],true);check($r['latest']['version']==='v17.10'&&$r['update_available'],'numeric versions are sorted correctly, including test releases');
 $r=$client->latest(['version'=>'v17.6.4'],false);check($r['latest']['version']==='v17.7'&&$r['latest']['release_channel']==='stable','stable-only selection excludes prereleases and invalid packages');
 check(!array_key_exists('download_url',$r['latest'])&&!array_key_exists('assets',$r['latest']),'customer projection exposes no raw release assets or request parameters');
 check(!$client->latest(['version'=>'v17.10.0'],true)['update_available'],'equivalent two-part and three-part versions are not reinstall offers');
 check(!$client->latest(['version'=>'v18.0'],true)['update_available'],'online discovery does not offer an automatic downgrade');
 check((new OnlineUpdates(transport([],'')))->latest(['version'=>'v17.6.4'],false)['latest']===null,'no usable release is an explicit empty state');
 check($client->latest([],true)['update_available'],'legacy installations without a public version can discover a release');
 $manifest=['format'=>1,'product'=>'cra1-theme','release'=>'fixture-online-release-v1','version'=>'v17.6.4','release_channel'=>'test',
  'verified_combinations'=>[['system'=>'10.7.4','modules'=>[],'evidence'=>'isolated online fixture']],
  'files'=>['public/web/cra1/example.js'=>['sha256'=>hash('sha256','new theme content'),'bytes'=>strlen('new theme content')]]];
 $zip=new ZipArchive();$zip->open($root.'/fixture.zip',ZipArchive::CREATE);$zip->addFromString('cra1-theme/release.json',json_encode($manifest));$zip->addFromString('public/web/cra1/example.js','new theme content');$zip->close();$bytes=file_get_contents($root.'/fixture.zip');$row=release('v17.6.4',true,$bytes);
 $requests=[];$client=new OnlineUpdates(transport([$row],$bytes,static function($url,$write,$limit,$timeout)use(&$requests){$requests[]=$url;check($timeout>0&&$timeout<=75,'network request stays within its operation time budget');return null;}));
 $path=$root.'/candidate.zip';$result=$client->download('v17.6.4',$path,['version'=>'v17.6.3']);
 check(file_get_contents($path)===$bytes&&$result['sha256']===hash('sha256',$bytes),'streamed redirected download retains exact published bytes');
 check((fileperms($path)&0777)===0600,'downloaded package is kept private');
 check(count($requests)===3,'discovery uses only the public tag endpoint, asset and GitHub redirect');
 foreach($requests as$url)check(strpos($url,'site=')===false&&strpos($url,'token=')===false,'remote requests contain no site identity or login credential');
 $updater=new Updater($root,'cra1admin',static function(){return ['database'=>true,'system_version'=>'10.7.4','modules'=>[]];});
 $before=$updater->preflight($path);check($before['can_apply'],'online package uses the existing full package preflight');
 $applied=$updater->apply($path,$result['sha256']);check(file_get_contents($root.'/public/web/cra1/example.js')==='new theme content','downloaded ZIP follows the real transactional apply');
 $updater->rollback($applied['history']);check(!is_file($root.'/public/web/cra1/example.js'),'online package supports existing rollback');
 rejects(static function()use($client,$root){$client->download('../../private',$root.'/bad.zip',[]);},'browser cannot select an arbitrary remote URL or tag path');
 rejects(static function()use($client,$root){$client->download('v17.6.4',$root.'/same.zip',['version'=>'v17.6.4']);},'download rechecks the installed version before any request');
 check(!is_file($root.'/same.zip'),'same-version download leaves no file');
 rejects(static function()use($client,$path){$client->download('v17.6.4',$path,[]);},'a pre-existing candidate is never overwritten');
 check(file_get_contents($path)===$bytes,'rejected overwrite preserves the candidate');
 foreach(['truncated'=>substr($bytes,0,-1),'checksum'=>str_repeat('x',strlen($bytes))]as$name=>$bad){
  $badClient=new OnlineUpdates(transport([$row],$bad));$dest=$root.'/'.$name.'.zip';
  rejects(static function()use($badClient,$dest){$badClient->download('v17.6.4',$dest,[]);},$name.' transfer is rejected');
  check(!file_exists($dest),$name.' transfer is cleaned up');
 }
 $hostile=new OnlineUpdates(transport([$row],$bytes,static function($url){return strpos($url,'https://github.com/')===0?['status'=>302,'headers'=>['location'=>'http://127.0.0.1/private']]:null;}));
 rejects(static function()use($hostile,$root){$hostile->download('v17.6.4',$root.'/hostile.zip',[]);},'redirect cannot contact another service or downgrade the download transport');
 check(!is_file($root.'/hostile.zip'),'invalid redirect leaves no candidate');
 $limited=new OnlineUpdates(static function(){return ['status'=>403];});
 rejects(static function()use($limited){$limited->latest([],true);},'rate limits are reported as failed queries instead of latest-version success');
 $invalid=new OnlineUpdates(static function($url,$write){$write('<html>upstream error</html>');return ['status'=>200];});
 rejects(static function()use($invalid){$invalid->latest([],true);},'non-JSON gateway responses provide an actionable error');
 $aborted=new OnlineUpdates(transport([$row],$bytes,static function($url,$write){if(strpos($url,'https://github.com/')===0){$write('partial');throw new InvalidArgumentException('连接 GitHub 超时');}return null;}));
 rejects(static function()use($aborted,$root){$aborted->download('v17.6.4',$root.'/aborted.zip',[]);},'interrupted transfers are reported');
 check(!is_file($root.'/aborted.zip'),'interrupted transfer removes partial content');
 $legacy=$row;unset($legacy['assets'][0]['digest']);$legacyClient=new OnlineUpdates(transport([$legacy],$bytes));
 check($legacyClient->download('v17.6.4',$root.'/legacy.zip',[])['sha256']===hash('sha256',$bytes),'older published assets without an API digest retain manifest-based compatibility');
 $settingsRoot=$root.'/settings';mkdir($settingsRoot);$store=new OnlineUpdateSettings($settingsRoot);
 check($store->get()===['github_prefix'=>'']&&!is_dir($settingsRoot.'/runtime'),'reading unset acceleration settings does not initialize files');
 check($store->save('  https://proxy.example.test  ')===['github_prefix'=>'https://proxy.example.test/'],'prefix is trimmed and the missing separator is added');
 $settingsPath=$settingsRoot.'/runtime/cra1_theme/distribution/online-settings.json';
 check((fileperms($settingsPath)&0777)===0600,'acceleration prefix is kept in private installation-local settings');
 $saved=Files::json($settingsPath);$saved['future_setting']='keep';Files::putJson($settingsPath,$saved,0600);
 check($store->save('')['github_prefix']===''&&Files::json($settingsPath)['future_setting']==='keep','clearing the prefix restores direct mode and preserves unrelated settings');
 check(OnlineUpdateSettings::prefix('http://127.0.0.1:58743/github')==='http://127.0.0.1:58743/github/','private HTTP accelerators and custom ports are supported');
 check(OnlineUpdateSettings::prefix('https://proxy.example.test/?url=')==='https://proxy.example.test/?url=','query-style prefixes keep their URL parameter');
 foreach(['file:///etc/passwd','javascript:alert(1)','https://user:secret@proxy.example.test/','https://proxy.example.test/#fragment',"https://proxy.example.test/\nheader"]as$badPrefix)rejects(static function()use($badPrefix){OnlineUpdateSettings::prefix($badPrefix);},'non-HTTP connection syntax or embedded credentials are rejected');
 $old=file_get_contents($settingsPath);rejects(static function()use($store){$store->save('not a URL');},'invalid edits do not overwrite the previous connection setting');check(file_get_contents($settingsPath)===$old,'failed save retains exact prior settings');
 file_put_contents($settingsPath,'{broken');try{$store->save('https://proxy.example.test/');check(false,'damaged settings must not be silently replaced');}catch(RuntimeException $e){check(file_get_contents($settingsPath)==='{broken','damaged settings are retained instead of being reset');}
 $proxy='https://proxy.example.test/';$proxyRequests=[];$normal=transport([$row],$bytes);
 $proxyTransport=static function($url,$write,$limit,$timeout)use(&$proxyRequests,$proxy,$normal){$proxyRequests[]=$url;check(strpos($url,$proxy)===0,'metadata, asset and upstream redirects stay on the configured accelerator');return $normal(substr($url,strlen($proxy)),$write,$limit,$timeout);};
 $proxyClient=new OnlineUpdates($proxyTransport,rtrim($proxy,'/'));
 check($proxyClient->latest(['version'=>'v17.6.3'],true)['update_available'],'accelerated metadata retains the ordinary version-selection rules');
 $proxyClient->download('v17.6.4',$root.'/proxied.zip',['version'=>'v17.6.3']);
 check(file_get_contents($root.'/proxied.zip')===$bytes,'prefix downloads retain the exact package bytes and digest');
 check(count($proxyRequests)===4,'successful acceleration never makes a direct fallback request');
 $queryProxy=new OnlineUpdates(static function($url,$write)use($row){check(strpos($url,'https://proxy.example.test/?url=https%3A%2F%2Fapi.github.com%2F')===0,'query-style prefixes encode the complete original address');$write(json_encode([$row]));return ['status'=>200];},'https://proxy.example.test/?url=');
 check($queryProxy->latest([],true)['latest']['version']==='v17.6.4','query-style acceleration can return native GitHub metadata');
 foreach(['unavailable','html','object']as$mode){
  $seen=[];$fallback=new OnlineUpdates(static function($url,$write,$limit,$timeout)use(&$seen,$proxy,$row,$mode){$seen[]=$url;check($timeout>0&&$timeout<=15,'proxy and fallback queries retain a bounded timeout');if(strpos($url,$proxy)===0){if($mode==='unavailable')return ['status'=>403];$write($mode==='html'?'<html>proxy only supports files</html>':'{}');return ['status'=>200];}$write(json_encode([$row]));return ['status'=>200];},$proxy);
  check($fallback->latest([],true)['latest']['version']==='v17.6.4'&&count($seen)===2&&strpos($seen[1],'https://api.github.com/')===0,'download-only and non-JSON proxies fall back to direct metadata without a false empty result');
 }
 $failed=new OnlineUpdates(static function(){return ['status'=>503];},$proxy);rejects(static function()use($failed){$failed->latest([],true);},'combined accelerator and direct failure remains an error');
 $redirected=new OnlineUpdates(static function($url,$write)use($proxy,$row,$bytes){if(strpos($url,'/releases/tags/')!==false){$write(json_encode($row));return ['status'=>200];}if(strpos($url,$proxy.'https://')===0)return ['status'=>302,'headers'=>['location'=>'/delivery/fixture.zip']];check($url==='https://proxy.example.test/delivery/fixture.zip','proxy-relative redirects are resolved once without duplicating the prefix');$write($bytes);return ['status'=>200];},$proxy);
 $redirected->download('v17.6.4',$root.'/relative-proxy.zip',[]);check(file_get_contents($root.'/relative-proxy.zip')===$bytes,'accelerator-relative redirect downloads complete normally');
 $badProxy=new OnlineUpdates(static function($url,$write)use($row){if(strpos($url,'/releases/tags/')!==false){$write(json_encode($row));return ['status'=>200];}return ['status'=>302,'headers'=>['location'=>'file:///private']];},$proxy);
 rejects(static function()use($badProxy,$root){$badProxy->download('v17.6.4',$root.'/bad-proxy.zip',[]);},'acceleration redirects remain HTTP requests');check(!file_exists($root.'/bad-proxy.zip'),'failed accelerated downloads remove partial files');
 $source=file_get_contents(CRA1_THEME_BACKEND.'/Support/cra1_theme_admin.php');
 check(strpos($source,"'release.online.check'")!==false&&strpos($source,"'release.online.download'")!==false,'online actions participate in existing role, CSRF and auditing boundaries');
 echo json_encode(['status'=>'passed','checks'=>count($checks),'results'=>$checks],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";
}finally{removeTree($root);}
