<?php
/** Authenticated, allowlisted theme projection; native authentication and ownership remain authoritative. */
declare(strict_types=1);
ini_set('display_errors', '0');
$root = dirname(__DIR__, 2);
require_once $root . '/lib/cra1_theme_client_actions.php';
require_once __DIR__.'/compatibility.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
$requestId = bin2hex(random_bytes(10));
$send = static function (array $data, int $http = 200): void {
    http_response_code($http);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_SLASHES);
};
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$target = $_GET['target'] ?? '';
$requested = is_string($target) ? $target : '';
$target = CRA1ThemeCompatibility::route($requested);
if ($method !== 'GET' || $target === '') {
    $send(['status' => 404, 'msg' => '请求的功能不存在', 'request_id' => $requestId], 404); exit;
}
$authorization = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!preg_match('/^Bearer [^\s]{1,8192}$/D', $authorization)) {
    $send(['status' => 401, 'msg' => '登录已失效，请重新登录', 'request_id' => $requestId], 401); exit;
}
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
$authority = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site' || ($origin !== '' && strtolower((string) parse_url($origin, PHP_URL_HOST) . (parse_url($origin, PHP_URL_PORT) ? ':' . parse_url($origin, PHP_URL_PORT) : '')) !== $authority)) {
    $send(['status' => 403, 'msg' => '请求来源无效', 'request_id' => $requestId], 403); exit;
}
$query = $_GET; unset($query['target']);
$raw = (string) file_get_contents('php://input', false, null, 0, 65537);
$body = $raw === '' ? [] : json_decode($raw, true);
if (strlen($raw) > 65536 || !is_array($body) || $query || $body) {
    $send(['status' => 400, 'msg' => '提交的信息不符合要求，请检查后重试', 'request_id' => $requestId], 400); exit;
}
// Re-enter exactly the existing console route, including its member, ownership,
// operation-password, subaccount and duplicate-request middleware. No HTTP proxy.
$_GET = $query;
$_POST = $method === 'POST' ? $body : [];
$_REQUEST = array_merge($query, $body);
unset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
$_SERVER['HTTP_AUTHORIZATION'] = $authorization;
$_SERVER['PATH_INFO'] = '/console/v1' . $target;
$_SERVER['REQUEST_URI'] = $_SERVER['PATH_INFO'] . ($query ? '?' . http_build_query($query) : '');
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['PHP_SELF'] = '/index.php';
$level = ob_get_level(); ob_start();
$finished = false;
register_shutdown_function(static function () use (&$finished, $level, $send, $requestId): void {
    if ($finished) return;
    while (ob_get_level() > $level) ob_end_clean();
    $send(['status' => 503, 'msg' => '服务暂时不可用，请稍后重试', 'request_id' => $requestId], 503);
});
try {
    require $root . '/config.php';
    require $root . '/vendor/autoload.php';
    if (!defined('IDCSMART_ROOT')) define('IDCSMART_ROOT', $root . '/');
    if (!defined('WEB_ROOT')) define('WEB_ROOT', $root . '/public/');
    if (!defined('UPLOAD_DEFAULT')) define('UPLOAD_DEFAULT', WEB_ROOT . 'upload/common/default/');
    $app = new \think\App($root . '/'); $app->debug(false);
    $app->initialize();
    $request = $app->make('request', [], true); $request->setMethod($method);
    $native = $app->http->run($request);
    $payload = CRA1ThemeCompatibility::payload($native->getData());
    $result = CRA1ThemeClientActions::response($payload, $native->getCode(), $requestId, $target);
    if ((int)$result['status'] === 200) {
        if ($requested === '/access') $result['data'] = CRA1ThemeCompatibility::access((int)get_client_id(false),$payload['data']['account'] ?? []);
        elseif (substr($requested,-4)==='/log') $result['data']=CRA1ThemeCompatibility::log($payload['data'] ?? []);
        elseif (preg_match('~/field/([1-9][0-9]*)$~D',$requested)) $result['data']=$payload['data']??[];
        else $result['data'] = CRA1ThemeCompatibility::host($payload['data'] ?? []);
    }
    if ($result['status'] !== 200) {
        CRA1ThemeClientActions::diagnostic($root, $requestId, $target, $result['status'], is_array($payload) ? (string) ($payload['msg'] ?? 'Invalid native response') : 'Invalid native response', [$authorization, substr($authorization, 7), (string) ($body['password'] ?? ''), (string) ($body['client_operate_password'] ?? ''), (string) ($body['code'] ?? '')]);
    }
    // End native request while output is still buffered (no native error pages).
    $app->http->end($native);
} catch (Throwable $error) {
    CRA1ThemeClientActions::diagnostic($root, $requestId, $target, 503, $error->getMessage(), [$authorization, substr($authorization, 7), (string) ($body['password'] ?? ''), (string) ($body['client_operate_password'] ?? '')]);
    $result = ['status' => 503, 'msg' => '服务暂时不可用，请稍后重试', 'request_id' => $requestId];
}
while (ob_get_level() > $level) ob_end_clean();
$finished = true;
// Native middleware may have supplied headers; never expose redirects or debug headers.
header_remove('Location');
$send($result, in_array($result['status'], [401, 403, 404, 429, 503], true) ? $result['status'] : 200);
