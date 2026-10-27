<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit(1);
$root=realpath($argv[1]??'');$source=realpath(dirname(__DIR__,2));
if(!$root||$root===$source||strpos($root,$source.DIRECTORY_SEPARATOR)===0||!is_file($root.'/.cra1-native-fixture.json'))throw new RuntimeException('An isolated native fixture is required');
$input=json_decode(stream_get_contents(STDIN),true);
$_SERVER=array_merge($_SERVER,['HTTP_HOST'=>'127.0.0.1','SERVER_ADDR'=>'127.0.0.1','SERVER_PORT'=>80,'REMOTE_ADDR'=>'127.0.0.1','SCRIPT_NAME'=>'/index.php']);
require $root.'/cra1-theme/backend/bootstrap.php';
$result=CRA1\Theme\Http\NativeAdmin::run($root,(string)($input['authorization']??''),static function($request){return ['status'=>200,'admin_id'=>(int)$request->admin_id];});
echo json_encode(['status'=>$result['status'],'admin_id'=>$result['admin_id']??0,'native_superadmin_authentication'=>true,'production_writes'=>0]).PHP_EOL;
