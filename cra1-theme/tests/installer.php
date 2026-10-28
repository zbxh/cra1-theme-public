<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Release\Installer;
use CRA1\Theme\Files;
$base=sys_get_temp_dir().'/cra1-installer-'.bin2hex(random_bytes(6));mkdir($base,0700);$checks=0;
function check($value,$label){if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
function cleanup($path){if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')cleanup($path.'/'.$name);rmdir($path);}
function fixture($dir){mkdir($dir.'/public/cra1admin',0700,true);mkdir($dir.'/lib',0700);foreach(['cra1_theme_security.php','cra1_theme_media.php']as$file)symlink(CRA1_THEME_ROOT.'/lib/'.$file,$dir.'/lib/'.$file);Files::atomic($dir.'/public/cra1admin/probe.php','fixture admin');$backend='cra1-theme/backend/releases/fixture-announcements';foreach(['Announcements/PageCatalog.php','Announcements/LegacyMigration.php','Storage/AnnouncementStore.php']as$path)Files::atomic($dir.'/'.$backend.'/'.$path,(string)file_get_contents(CRA1_THEME_BACKEND.'/'.$path));Files::putJson($dir.'/cra1-theme/release.json',['backend_root'=>$backend,'references'=>[],'files'=>['public/cra1admin/probe.php'=>['sha256'=>hash('sha256','fixture admin'),'bytes'=>13]]]);return new Installer($dir);}
$previous=['admin_theme'=>'default','clientarea_theme'=>'default','cart_theme'=>'default','web_theme'=>'default','cart_instruction'=>1,'cart_instruction_content'=>'merchant copy','home_host_theme'=>['mf_cloud'=>'default'],'home_host_theme_mobile'=>['mf_cloud'=>'default']];
$input=['entry'=>'cloudcustom','username'=>'fixture_admin','password'=>'Isolated-password-123!','canonical'=>'https://fixture.invalid'];$passed=['counts'=>['blocked'=>0,'unverified'=>0]];
try{
 $noAuth=\CRA1\Theme\Http\NativeAdmin::run($base,'',static function(){throw new RuntimeException('must not run');});check($noAuth['status']===401,'anonymous first visitor cannot create admin');
 $installer=fixture($base.'/fail');
 $inspectionOptions=['https'=>true,'context'=>['database'=>true,'system_version'=>'10.7.4','modules'=>[]]];
 $inspection=$installer->preflight($inspectionOptions+['entry'=>'untrusted']);
 check($inspection['scope']==='environment'&&count($inspection['checks'])===6,'fresh installation checks only the six environment groups');
 check(strpos(json_encode($inspection),'untrusted')===false,'administrator entry comes from the installation record, never supplied inspection options');
 $rejected=false;try{$installer->install($input,['counts'=>['blocked'=>1,'unverified'=>0]]);}catch(RuntimeException $e){$rejected=true;}
 check($rejected&&!is_file($base.'/fail/runtime/cra1_theme/security.sqlite'),'preflight failure never initializes identities');
 $pointerFile=$base.'/fail/runtime/cra1_theme/distribution/current.json';
 Files::putJson($pointerFile,['release'=>'preserve-existing-pointer']);$pointerHash=hash_file('sha256',$pointerFile);
 $rejected=false;try{$installer->install($input,$passed);}catch(RuntimeException $e){$rejected=true;}
 check($rejected,'late initialization conflict is reported');check(hash_file('sha256',$pointerFile)===$pointerHash,'failed installation preserves the existing pointer');
 check($installer->state()['mode']==='install','failed initialization can be retried');
 check(!is_file($base.'/fail/config/cra1_theme_security.key')&&!is_file($base.'/fail/runtime/cra1_theme/security.sqlite'),'failed identities removed');check(is_dir($base.'/fail/public/cra1admin')&&!is_dir($base.'/fail/public/cloudcustom'),'failed admin rename restored');
 check(!is_file($base.'/fail/runtime/cra1_theme/announcements.json'),'failed installation removes only the new announcement document');
 $installer=fixture($base.'/success');
 Files::putJson($base.'/success/native-theme-settings.json',$previous);$settingsHash=hash_file('sha256',$base.'/success/native-theme-settings.json');
 Files::putJson($base.'/success/runtime/cra1_theme/member_center.json',['version'=>42,'unknown'=>'keep']);$hash=hash_file('sha256',$base.'/success/runtime/cra1_theme/member_center.json');
 $result=$installer->install($input,$passed);
 check($result['installed']&&$result['password']===$input['password'],'password displayed only on success response');
 check(hash_file('sha256',$base.'/success/runtime/cra1_theme/member_center.json')===$hash,'existing content and unknown fields preserved');
 check(hash_file('sha256',$base.'/success/native-theme-settings.json')===$settingsHash,'installation leaves existing theme selections and native settings unchanged');
 check(!is_file($base.'/success/runtime/cra1_theme/install-previous-themes.json'),'installation no longer creates an unused native activation backup');
 $security=new CRA1ThemeSecurity($base.'/success');$account=$security->checkPassword($input['username'],$input['password']);
 check($account!==null&&$account['role']==='super_admin','independent administrator can log in while all three native themes remain default');
 $token=$security->startSession($account,'127.0.0.1','isolated-installer');
 check($security->authenticate($token)!==null,'theme administrator session does not require theme activation');
 check(hash_file('sha256',$base.'/success/native-theme-settings.json')===$settingsHash,'administrator login preserves native settings');unset($security);
 check($installer->state()['mode']==='maintenance','installer locked after success');
 $inspection=$installer->preflight($inspectionOptions);
 check($inspection['mode']==='maintenance'&&$inspection['scope']==='environment','maintenance revisit preserves the renamed administrator entry without repeating file audits');
 $entryRecord=$base.'/success/runtime/cra1_theme/entry.json';
 Files::putJson($entryRecord,['entry'=>'../outside']);$rejected=false;
 try{$installer->preflight($inspectionOptions);}catch(RuntimeException $e){$rejected=true;}
 check($rejected,'invalid persisted administrator entry cannot redirect file checks');
 Files::putJson($entryRecord,[]);$rejected=false;
 try{$installer->preflight($inspectionOptions);}catch(RuntimeException $e){$rejected=true;}
 check($rejected,'incomplete persisted administrator entry is not silently replaced by the default');
 Files::putJson($entryRecord,['entry'=>$input['entry']]);
 $pointer=Files::json($base.'/success/runtime/cra1_theme/distribution/current.json');
 check($pointer['release']==='legacy-install'&&isset($pointer['manifest']),'first installation creates a rollback baseline pointer');
 check(is_file($base.'/success/runtime/cra1_theme/attachments.sqlite'),'media and avatar service initialized without a separate manual command');
 check(is_file($base.'/success/runtime/cra1_theme/announcements.json'),'installation initializes the private announcement document');
 $rejected=false;try{$installer->install($input,$passed);}catch(RuntimeException $e){$rejected=true;}check($rejected,'revisit cannot initialize again');
 $leaked=false;$files=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base.'/success',FilesystemIterator::SKIP_DOTS));foreach($files as$file){if($file->isFile()&&!$file->isLink()&&strpos((string)file_get_contents($file->getPathname()),$input['password'])!==false)$leaked=true;}
 check(!$leaked,'plaintext password never persisted');check((fileperms($base.'/success/config/cra1_theme_security.key')&0777)===0600,'private key permissions');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0])."\n";
}finally{cleanup($base);}
