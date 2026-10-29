<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/Support/cra1_theme_security.php';
require dirname(__DIR__).'/backend/Security/AdminRecovery.php';
use CRA1\Theme\Security\AdminRecovery;
$root=sys_get_temp_dir().'/cra1-admin-recovery-'.bin2hex(random_bytes(6));mkdir($root,0700);$checks=[];$mail=[];
function check(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
function rejects(callable $f,string $code,string $label):void{try{$f();}catch(CRA1ThemeSecurityError $e){check($e->errorCode===$code,$label);return;}throw new RuntimeException($label.' was accepted');}
function clearLimits():void{$GLOBALS['s']->db->exec('DELETE FROM limits');}
function account():array{return $GLOBALS['s']->account(1);}
function code():string{return $GLOBALS['mail'][count($GLOBALS['mail'])-1]['code'];}
function clean(string $path):void{foreach(scandir($path)as$n){if($n==='.'||$n==='..')continue;$f=$path.'/'.$n;if(is_dir($f)&&!is_link($f))clean($f);else unlink($f);}rmdir($path);}
try{
 CRA1ThemeSecurity::install($root,'fixture_admin',CRA1ThemeSecurity::password('Original-Fixture-Password-42!'));
 $s=new CRA1ThemeSecurity($root);$schema=$s->scalar("SELECT sql FROM sqlite_master WHERE name='accounts'");
 $service=new AdminRecovery($s,static function(string $email,string $code,string $purpose):bool{$GLOBALS['mail'][]=compact('email','code','purpose');return true;});
 check(!$service->status(1)['enabled'],'old accounts start with recovery disabled without schema migration');
 clearLimits();$pending=$service->beginBinding(account(),'session-a','fixture@example.invalid','127.0.0.1');
 check(count($mail)===1&&$mail[0]['purpose']==='bind','binding sends to the requested mailbox through the supplied mail transport');
 rejects(fn()=>$service->finishBinding(account(),$pending['challenge'],'other-session',code()),'RECOVERY_INVALID','mail proof is bound to the initiating login');
 rejects(fn()=>$service->finishReset($pending['challenge'],'session-a',code(),'Another-Fixture-Password-42!','127.0.0.1'),'RECOVERY_INVALID','binding proof cannot reset a password');
 $service->finishBinding(account(),$pending['challenge'],'session-a',code());
 check($service->status(1)===['enabled'=>true,'email'=>'f***@example.invalid'],'verified email is only returned masked to the account owner');
 check(strpos(json_encode($s->settings()),'fixture@example.invalid')===false&&strpos(json_encode(CRA1ThemeSecurity::publicAccount(account())),'fixture@example.invalid')===false,'recovery mailbox is absent from shared settings and public account projection');
 $stored=$s->scalar('SELECT value FROM meta WHERE key=?',['recovery_email:1']);check(strpos($stored,'fixture@example.invalid')===false,'stored recovery mailbox is encrypted');
 rejects(fn()=>$service->finishBinding(account(),$pending['challenge'],'session-a',code()),'RECOVERY_INVALID','binding proof is consumed once');
 $schemaAfter=$s->scalar("SELECT sql FROM sqlite_master WHERE name='accounts'");check($schema===$schemaAfter,'existing security schema remains unchanged');
 $s=new CRA1ThemeSecurity($root);check((new AdminRecovery($s))->status(1)['enabled'],'verified binding survives reopening existing security database');
 clearLimits();$n=count($mail);$unknown=$service->beginReset('unknown_admin','fixture@example.invalid','anon','127.0.0.1');
 check(count($mail)===$n&&strlen($unknown['challenge'])===64,'unknown account receives an opaque challenge without sending email');
 clearLimits();$wrongEmail=$service->beginReset('fixture_admin','unbound@example.invalid','anon','127.0.0.1');check(count($mail)===$n&&array_keys($unknown)===array_keys($wrongEmail),'unbound mailbox does not receive mail or reveal account validity');
 clearLimits();$reset=$service->beginReset('FIXTURE_ADMIN','fixture@example.invalid','anon','127.0.0.1');$correct=code();
 check(count($mail)===$n+1&&$mail[count($mail)-1]['purpose']==='reset'&&array_keys($reset)===array_keys($unknown),'matching account uses same response contract and registered mailbox');
 rejects(fn()=>$service->beginReset('fixture_admin','fixture@example.invalid','anon','127.0.0.1'),'RATE_LIMITED','repeated send is rate limited independently of login');
 $payload=$s->scalar('SELECT payload FROM challenges WHERE hash=?',[CRA1ThemeSecurity::hashToken($reset['challenge'])]);check(strpos($payload,'"'.$correct.'"')===false&&strpos($payload,'fixture@example.invalid')===false,'challenge stores neither plaintext code nor mailbox');
 rejects(fn()=>$service->finishReset($reset['challenge'],'other-browser',$correct,'New-Fixture-Password-42!','127.0.0.1'),'RECOVERY_INVALID','another browser cannot use a leaked challenge');
 rejects(fn()=>$service->finishReset($reset['challenge'],'anon',$correct,'short','127.0.0.1'),'INVALID_REQUEST','password length is enforced before proof consumption');
 $wrong=$correct==='000000'?'111111':'000000';
 for($i=0;$i<5;$i++)rejects(fn()=>$service->finishReset($reset['challenge'],'anon',$wrong,'New-Fixture-Password-42!','127.0.0.1'),'RECOVERY_INVALID','incorrect email proof rejected attempt '.($i+1));
 rejects(fn()=>$service->finishReset($reset['challenge'],'anon',$correct,'New-Fixture-Password-42!','127.0.0.1'),'RECOVERY_INVALID','five failures invalidate the proof even with correct code later');
 clearLimits();$reset=$service->beginReset('fixture_admin','fixture@example.invalid','anon','127.0.0.1');$correct=code();
 $s->db->prepare('UPDATE challenges SET expires_at=? WHERE hash=?')->execute([time(),CRA1ThemeSecurity::hashToken($reset['challenge'])]);
 rejects(fn()=>$service->finishReset($reset['challenge'],'anon',$correct,'New-Fixture-Password-42!','127.0.0.1'),'RECOVERY_INVALID','expiry is enforced at the exact boundary');
 clearLimits();$reset=$service->beginReset('fixture_admin','fixture@example.invalid','anon','127.0.0.1');$correct=code();$s->changeOwnPassword(account(),'Changed-Before-Reset-42!');
 rejects(fn()=>$service->finishReset($reset['challenge'],'anon',$correct,'New-Fixture-Password-42!','127.0.0.1'),'RECOVERY_INVALID','password change invalidates outstanding reset proof');
 clearLimits();$s->db->exec('UPDATE accounts SET enabled=0 WHERE id=1');$n=count($mail);$disabled=$service->beginReset('fixture_admin','fixture@example.invalid','anon','127.0.0.1');check(count($mail)===$n&&array_keys($disabled)===array_keys($unknown),'disabled accounts cannot receive reset email or disclose their state');$s->db->exec('UPDATE accounts SET enabled=1 WHERE id=1');
 clearLimits();$s->db->prepare('UPDATE accounts SET mfa_secret=?,recovery_hashes=? WHERE id=1')->execute([$s->encrypt('MFA-KEPT'),json_encode(['kept-hash'])]);$oldSession=$s->startSession(account(),'127.0.0.1','fixture');
 $reset=$service->beginReset('fixture_admin','fixture@example.invalid','anon','127.0.0.1');$correct=code();$service->finishReset($reset['challenge'],'anon',$correct,'Final-Fixture-Password-42!','127.0.0.1');
 check((bool)$s->checkPassword('fixture_admin','Final-Fixture-Password-42!'),'valid email proof changes the password');
 check(!$s->checkPassword('fixture_admin','Changed-Before-Reset-42!'),'old password stops working');
 check($s->authenticate($oldSession)===null,'reset revokes previous login sessions');
 check($s->decrypt(account()['mfa_secret'])==='MFA-KEPT'&&account()['recovery_hashes']===json_encode(['kept-hash']),'password recovery preserves MFA and its recovery codes');
 rejects(fn()=>$service->finishReset($reset['challenge'],'anon',$correct,'Replay-Fixture-Password-42!','127.0.0.1'),'RECOVERY_INVALID','successful reset proof cannot be replayed');
 clearLimits();$reset=$service->beginReset('fixture_admin','fixture@example.invalid','anon','127.0.0.1');$correct=code();$service->removeBinding(account());check(!$service->status(1)['enabled'],'verified owner can remove recovery mailbox');
 rejects(fn()=>$service->finishReset($reset['challenge'],'anon',$correct,'Replay-Fixture-Password-42!','127.0.0.1'),'RECOVERY_INVALID','removing mailbox invalidates outstanding reset challenges');
 clearLimits();$failed=new AdminRecovery($s,static fn()=>false);
 rejects(fn()=>$failed->beginBinding(account(),'session-a','fixture@example.invalid','127.0.0.1'),'MAIL_UNAVAILABLE','mail failure cannot complete email binding');check(!$service->status(1)['enabled'],'failed binding preserves unbound state');
 clearLimits();$pending=$service->beginBinding(account(),'session-a','fixture@example.invalid','127.0.0.1');$service->finishBinding(account(),$pending['challenge'],'session-a',code());clearLimits();
 $badSend=$failed->beginReset('fixture_admin','fixture@example.invalid','anon','127.0.0.1');check(array_keys($badSend)===array_keys($unknown),'reset delivery failure does not reveal account existence');
 check($s->scalar('SELECT used_at FROM challenges WHERE hash=?',[CRA1ThemeSecurity::hashToken($badSend['challenge'])])>0,'failed delivery invalidates the unusable proof');
 clearLimits();rejects(fn()=>$service->beginReset('fixture_admin',"bad\r\n@example.invalid",'anon','127.0.0.1'),'INVALID_REQUEST','mail header injection is rejected');
 echo json_encode(['status'=>'passed','checks'=>count($checks),'results'=>$checks],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT).PHP_EOL;
}finally{unset($s,$service);clean($root);}
