<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
require CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php';
use CRA1\Theme\Files;
$base=sys_get_temp_dir().'/cra1-sqlite-test-'.bin2hex(random_bytes(6));$checks=0;
function check($value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
function cleanup($path){if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')cleanup($path.'/'.$name);rmdir($path);}
try{
 Files::atomic($base.'/public/fixture','');
 CRA1ThemeSecurity::install($base,'fixture_admin',CRA1ThemeSecurity::password('Fixture-password-123!'),['canonical_url'=>'http://fixture.invalid']);
 $security=new CRA1ThemeSecurity($base);
 check($security->checkPassword('fixture_admin','Fixture-password-123!')!==null,'identity initializes and accepts the supplied password');
 $context=['risk'=>'high','actor_id'=>1,'target'=>'theme','ip'=>'127.0.0.1','time'=>100];
 $first=$security->event('distribution.install','ok',$context,[],'fixture-import-1');
 $rows=$security->rows('SELECT * FROM alerts');$alert=$rows[0];
 check($first>0&&count($rows)===1&&(int)$alert['count']===1&&(int)$alert['first_at']===100,'first high-risk event inserts exactly one alert');
 $security->db->exec('UPDATE alerts SET read_at=101');$context['time']=200;
 $second=$security->event('distribution.install','ok',$context,[],'fixture-import-2');$alert=$security->rows('SELECT * FROM alerts')[0];
 check($second>$first&&(int)$alert['count']===2&&(int)$alert['first_at']===100&&(int)$alert['last_at']===200&&(int)$alert['read_at']===0,'a repeated event increments count, retains first time and clears read status');
 check($security->event('distribution.install','ok',$context,[],'fixture-import-2')===0,'imported events remain deduplicated');
 check((int)$security->scalar('SELECT count FROM alerts')===2,'duplicate imports do not increment the alert');
 $security->event('distribution.install','attempt',$context);
 check((int)$security->scalar('SELECT count FROM alerts')===2,'attempt records do not aggregate into alerts');
 $security->event('login','ok',['risk'=>'low','actor_id'=>1]);
 check((int)$security->scalar('SELECT COUNT(*) FROM alerts')===1,'ordinary events do not add high-risk alerts');
 $tail=$security->scalar("SELECT value FROM meta WHERE key='chain_tail'");$count=$security->scalar('SELECT COUNT(*) FROM events');
 $security->db->exec("CREATE TRIGGER fail_alert BEFORE UPDATE ON alerts BEGIN SELECT RAISE(ABORT,'fixture rollback'); END");
 $failed=false;try{$security->event('distribution.install','ok',$context);}catch(Throwable $error){$failed=strpos($error->getMessage(),'fixture rollback')!==false;}
 check($failed,'a failed alert write is reported');
 check($tail===$security->scalar("SELECT value FROM meta WHERE key='chain_tail'")&&$count===$security->scalar('SELECT COUNT(*) FROM events'),'a failed alert write rolls back both the audit event and chain tail');
 $security->db->exec('DROP TRIGGER fail_alert');
 check($security->verifyIntegrity()['verified']===(int)$count,'all successful records retain the integrity chain');
 echo json_encode(['status'=>'passed','checks'=>$checks,'sqlite'=>$security->scalar('SELECT sqlite_version()'),'production_writes'=>0])."\n";
}finally{unset($security);if(is_dir($base))cleanup($base);}
