<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/bootstrap.php';
// Source-only licensing tools are deliberately omitted from runtime releases.
require dirname(__DIR__).'/backend/Release/LicenseCredential.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\LicenseCredential;
$dir=sys_get_temp_dir().'/cra1-license-'.bin2hex(random_bytes(6));mkdir($dir,0700);$checks=0;
function check($ok,$msg){if(!$ok)throw new RuntimeException($msg);$GLOBALS['checks']++;}
function reject(callable $f){try{$f();}catch(Throwable $e){$GLOBALS['checks']++;return;}throw new RuntimeException('invalid credential accepted');}
try{
 $pair=sodium_crypto_sign_keypair();$public=base64_encode(sodium_crypto_sign_publickey($pair));$key=sodium_crypto_sign_secretkey($pair);
 Files::putJson($dir.'/cra1-theme/licenses/issuer-keys.json',['fixture-key'=>$public]);
 $doc=['issuer'=>'Fixture issuer','key_id'=>'fixture-key','serial'=>'fixture-001','subject'=>'Fixture only','sites'=>['https://fixture.invalid'],'scope'=>'single commercial site; no resale','issued_at'=>'2026-10-19','expires_at'=>null];
 $doc['signature']=base64_encode(sodium_crypto_sign_detached(LicenseCredential::canonical($doc),$key));
 check(LicenseCredential::inspect($doc,$dir)['valid'],'valid signed credential');
 $changed=$doc;$changed['subject']='tampered';check(!LicenseCredential::inspect($changed,$dir)['valid'],'altered credential rejected');
 $changed=$doc;$changed['key_id']='unknown-key';check(!LicenseCredential::inspect($changed,$dir)['valid'],'unknown issuer rejected');
 check(!LicenseCredential::inspect([],$dir)['runtime_enforcement'],'no license cannot become runtime kill switch');
 $changed=$doc;$changed['sites']=['javascript:alert(1)'];reject(static function()use($changed){LicenseCredential::validate($changed);});
 $changed=$doc;$changed['issued_at']='2026-02-30';reject(static function()use($changed){LicenseCredential::validate($changed);});
 $changed=$doc;$changed['expires_at']='2025-01-01';reject(static function()use($changed){LicenseCredential::validate($changed);});
 $changed=$doc;$changed['password']='forbidden';reject(static function()use($changed){LicenseCredential::validate($changed);});
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0])."\n";
}finally{unlink($dir.'/cra1-theme/licenses/issuer-keys.json');rmdir($dir.'/cra1-theme/licenses');rmdir($dir.'/cra1-theme');rmdir($dir);}
