#!/usr/bin/env php
<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
require dirname(__DIR__).'/backend/bootstrap.php';
require dirname(__DIR__).'/backend/Release/LicenseCredential.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\LicenseCredential;
$args=$argv;array_shift($args);$cmd=array_shift($args);
try{
 if($cmd==='keygen'){
  if(count($args)!==3)throw new InvalidArgumentException('keygen /private/issuer-secret.json /private/issuer-keys.json key-id');
  [$private,$public,$id]=$args;
  if(!preg_match('/^[A-Za-z0-9_-]{3,64}$/D',$id)||file_exists($private)||file_exists($public))throw new RuntimeException('密钥标识无效或输出已存在，拒绝覆盖');
  foreach([$private,$public]as$file)if(strpos($file,rtrim(CRA1_THEME_ROOT,'/').'/public/')===0||$file[0]!=='/')throw new RuntimeException('密钥必须输出到非公开的绝对路径');
  $pair=sodium_crypto_sign_keypair();Files::putJson($private,['key_id'=>$id,'secret'=>base64_encode(sodium_crypto_sign_secretkey($pair))],0600);
  Files::putJson($public,[$id=>base64_encode(sodium_crypto_sign_publickey($pair))],0640);sodium_memzero($pair);
  echo "已创建离线密钥。仅公钥文件可放入 cra1-theme/licenses/issuer-keys.json。\n";
 }elseif($cmd==='sign'){
  if(count($args)!==3)throw new InvalidArgumentException('sign /private/issuer-secret.json credential-input.json /private/signed-credential.json');
  [$keyFile,$input,$output]=$args;if(file_exists($output))throw new RuntimeException('凭证输出已存在，拒绝覆盖');
  $key=Files::json($keyFile);$doc=Files::json($input);$doc['key_id']=$key['key_id'];unset($doc['signature']);LicenseCredential::validate($doc);
  $secret=base64_decode($key['secret'],true);if($secret===false||strlen($secret)!==SODIUM_CRYPTO_SIGN_SECRETKEYBYTES)throw new RuntimeException('私钥无效');
  $doc['signature']=base64_encode(sodium_crypto_sign_detached(LicenseCredential::canonical($doc),$secret));sodium_memzero($secret);Files::putJson($output,$doc,0600);echo "授权凭证已签发，不改变主题运行状态。\n";
 }else throw new InvalidArgumentException('命令：keygen 或 sign；此工具仅供发行方离线使用');
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
