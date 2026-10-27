<?php
declare(strict_types=1);
/** Probe the original Think/V10 pipeline in an explicitly marked isolated installation. */
if (PHP_SAPI !== 'cli') exit(1);
$root = realpath($argv[1] ?? '');
$source = realpath(dirname(__DIR__, 2));
if (!$root || $root === $source || strpos($root, $source.DIRECTORY_SEPARATOR) === 0
    || !is_file($root.'/.cra1-native-fixture.json')) throw new RuntimeException('An isolated native fixture is required');
$input = json_decode(stream_get_contents(STDIN), true);
if (!is_array($input)) throw new InvalidArgumentException('JSON fixture input required');
$path = (string)($input['path'] ?? '');
$method = strtoupper((string)($input['method'] ?? 'GET'));
if (!in_array($path, ['/console/v1/account', '/console/v1/host', '/console/v1/mf_cloud/999999/remote_info', '/console/v1/cra1-theme/security/operation/status', '/console/v1/cra1-theme/security/operation/verify', '/console/v1/cra1-theme/member/avatar', '/console/v1/cra1-theme/member/products'], true)
    || !in_array($method, ['GET', 'POST'], true)
    || ($method === 'POST' && $path !== '/console/v1/cra1-theme/security/operation/verify')) throw new InvalidArgumentException('Probe action is not registered');
$origin = 'http://127.0.0.1';
$_GET = $method === 'GET' ? ($input['params'] ?? []) : [];
$_POST = $method === 'POST' ? ($input['params'] ?? []) : [];
$_REQUEST = array_merge($_GET, $_POST);
$_SERVER = array_merge($_SERVER, ['HTTP_HOST'=>'127.0.0.1','SERVER_ADDR'=>'127.0.0.1','SERVER_NAME'=>'127.0.0.1','SERVER_PORT'=>80,'REMOTE_ADDR'=>'127.0.0.1','SCRIPT_NAME'=>'/index.php','PHP_SELF'=>'/index.php','PATH_INFO'=>$path,'REQUEST_URI'=>$path,'REQUEST_METHOD'=>$method,'HTTP_ORIGIN'=>$origin,'HTTP_AUTHORIZATION'=>(string)($input['authorization']??'')]);
require $root.'/config.php';
require $root.'/vendor/autoload.php';
define('IDCSMART_ROOT', $root.'/');
define('WEB_ROOT', $root.'/public/');
define('UPLOAD_DEFAULT', WEB_ROOT.'upload/common/default/');
$app = new think\App($root.'/');
$app->debug(true);
$app->initialize();
$request = $app->make('request', [], true);
$request->withServer($_SERVER)->withHeader(['authorization'=>$_SERVER['HTTP_AUTHORIZATION'],'origin'=>$origin,'host'=>'127.0.0.1'])->withGet($_GET)->withPost($_POST)->withInput('');
$request->setMethod($method);
$request->setPathinfo(ltrim($path, '/'));
$response = $app->http->run($request);
$body = $response->getData();
if (!is_array($body)) {
    preg_match('~<h2[^>]*>(.*?)</h2>~s', $response->getContent(), $message);
    throw new RuntimeException('Native response was not a business JSON result: '.json_encode(['class'=>get_class($response),'http'=>$response->getCode(),'app'=>$app->http->getName(),'path'=>$request->pathinfo(),'hook_loaded'=>class_exists('CRA1\\Theme\\Http\\HookBootstrap',false),'native_guard'=>get_class($app->make('app\\http\\middleware\\CheckHome')),'fixture_error'=>substr(strip_tags($message[1]??''),0,200)]));
}
$account = $body['data']['account'] ?? [];
$secret = static function ($value) use (&$secret): bool {
    if (!is_array($value)) return false;
    foreach ($value as $key=>$item) {
        // Legacy challenges carry operate_password=1 as a requirement flag.
        if ($key==='operate_password' && in_array($item,[0,1,false,true],true)) continue;
        if (is_string($key) && preg_match('/^(?:password|operate_password|panel_pass|vnc_password|api_secret)$/iD', $key)) return true;
        if ($secret($item)) return true;
    }
    return false;
};
$result = ['status'=>(int)($body['status']??0),'native_http_status'=>$response->getCode(),'native_client_id'=>(int)$request->client_id,
    'system_version'=>(string)configuration('system_version'),
    'member_guard'=>get_class($app->make('app\\http\\middleware\\CheckHome')),
    'operation_guard'=>get_class($app->make('app\\http\\middleware\\CheckClientOperatePassword')),
    'contains_secret_keys'=>$secret($body), 'account_fields'=>is_array($account)?array_keys($account):[],
    'verification_enabled'=>(bool)($body['data']['enabled']??false),
    'verification_expires_at'=>(int)($body['data']['expires_at']??0),
    'challenge_kind'=>(string)($body['data']['security_verification']['kind']??''),
    'cache_control'=>(string)$response->getHeader('Cache-Control')];
$app->http->end($response);
echo json_encode($result, JSON_UNESCAPED_UNICODE).PHP_EOL;
