<?php
/** 独立主题后台：CLI 迁移账号、三级权限、可选 TOTP、SQLite 会话及中文审计。 */
declare(strict_types=1);

error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0');

// 站点根自动探测（后台目录可改名/移动，不硬编码层级）
$ROOT = null;
$__probe = __DIR__;
for ($i = 0; $i < 6; $i++) {
    $__probe = dirname($__probe);
    if (is_file($__probe . '/config.php')) {
        $ROOT = $__probe;
        break;
    }
}
if ($ROOT === null) {
    $ROOT = dirname(__DIR__, 2); // 兜底：public/<slug>/ 的上两级
}
$SLUG = basename(__DIR__); // 目录名即后台路径

/* 保留既有入口；变更只由超级管理员显式执行。 */
const DEFAULT_ENTRY = 'cra1admin';

$STORE      = $ROOT . '/runtime/cra1_theme';
$CONFIG_FILE  = $STORE . '/config.json';
$LEGACY_FILE  = $ROOT . '/public/web/cra1/controller/storage.json';
$ADMIN_FILE   = $STORE . '/admin.json';
$ATTEMPT_FILE = $STORE . '/login_attempts.json';
$AUDIT_FILE   = $STORE . '/audit.log';
$ENTRY_FILE   = $STORE . '/entry.json';   // 非公开的当前入口记录

if (!is_dir($STORE)) {
    @mkdir($STORE, 0750, true);
}

require_once $ROOT . '/public/web/cra1/controller/Cra1.php';
// 会员中心主题配置服务（独立存储与独立 API，不读写官网 config.json）
require_once __DIR__ . '/member_store.php';
require_once __DIR__ . '/cart_store.php';
require_once __DIR__ . '/workspace_store.php';

/* Fixed public projection is served without the administrator PHP session. */
if (in_array((string)($_GET['r']??''),['member.sidebar.snapshot','cart.snapshot'],true)) {
    if(time()>1794441600){http_response_code(410);exit;} // one release compatibility, 2026-11-12 UTC
    $GLOBALS['THEME_PUBLIC_DOMAIN']=($_GET['r']==='cart.snapshot')?'cart':'member';
    require $ROOT.'/public/cra1-shared/snapshot.php';exit;
}
$THEME_SECURITY_STARTED=hrtime(true);
require_once $ROOT.'/lib/cra1_theme_admin.php';
$THEME_REQUEST_ID=bin2hex(random_bytes(12));
try {$THEME_SECURITY=new CRA1ThemeSecurity($ROOT);$THEME_SETTINGS=$THEME_SECURITY->settings();}
catch(Throwable $e){http_response_code(503);header('Cache-Control: no-store');header('X-Robots-Tag: noindex, nofollow');header('X-Content-Type-Options: nosniff');if(strpos((string)($_GET['r']??''),'api.')===0){header('Content-Type: application/json; charset=utf-8');echo json_encode(['status'=>503,'msg'=>'后台安全服务不可用，请通过本地维护命令检查。','code'=>'SECURITY_UNAVAILABLE','request_id'=>$THEME_REQUEST_ID],JSON_UNESCAPED_UNICODE);}else{header('Content-Type: text/plain; charset=utf-8');echo '后台安全服务不可用，请通过本地维护命令检查。';}exit;}
$THEME_NETWORK=CRA1ThemeSecurity::network($_SERVER,$THEME_SETTINGS);$https=$THEME_NETWORK['https'];
$canonical=parse_url((string)$THEME_SETTINGS['canonical_url']);
$authority=strtolower(($canonical['host']??'').(isset($canonical['port'])?':'.$canonical['port']:''));
if($authority===''||strtolower((string)($_SERVER['HTTP_HOST']??''))!==$authority){http_response_code(404);exit;}
$allowed=$THEME_SETTINGS['ip_allowlist']??[];
if($allowed){$pass=false;foreach($allowed as$cidr)if(CRA1ThemeSecurity::contains($THEME_NETWORK['ip'],$cidr))$pass=true;if(!$pass){http_response_code(404);exit;}}
if(!empty($THEME_SETTINGS['force_https'])&&!$https){http_response_code(403);header('Content-Type: text/plain; charset=utf-8');echo '请通过有效的 HTTPS 地址访问后台。';exit;}
if($https&&!empty($THEME_SETTINGS['force_https']))header('Strict-Transport-Security: max-age=31536000');
ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');ini_set('session.use_trans_sid','0');
session_name('CRA1THEMEID');session_set_cookie_params(['lifetime'=>0,'path'=>'/'.$SLUG,'secure'=>$https,'httponly'=>true,'samesite'=>'Lax']);session_start();
// 旧测试版可能仍由保留的后端写入会话键；只迁移本后台的 PHP 会话，保留登录与 CSRF 值。
foreach (['cloud_admin'=>'cra1_admin','cloud_csrf'=>'cra1_csrf'] as $__oldKey=>$__newKey) {
    if (!array_key_exists($__newKey,$_SESSION) && isset($_SESSION[$__oldKey])) $_SESSION[$__newKey]=$_SESSION[$__oldKey];
    unset($_SESSION[$__oldKey]);
}
unset($__oldKey,$__newKey);
$THEME_ACTOR=$THEME_SECURITY->authenticate((string)($_SESSION['security_token']??''));$THEME_SESSION_HASH=isset($_SESSION['security_token'])?CRA1ThemeSecurity::hashToken($_SESSION['security_token']):'';
$BASE_URL='/'.$SLUG.'/index.php';
$THEME_CSP_NONCE=base64_encode(random_bytes(18));

/*
 * 跳转一律使用绝对路径：
 * 目录形式访问（/slug/）时，相对 Location（?r=xxx）会被浏览器按当前路径解析，
 * 叠加 nginx 目录规范化后可能产生「重定向次数过多」。
 */
function redirect_to(string $query): void
{
    global $BASE_URL;
    header('Location: ' . $BASE_URL . ($query !== '' ? ('?' . $query) : ''), true, 302);
    exit;
}

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');header('X-Robots-Tag: noindex, nofollow, noarchive');
header('Referrer-Policy: no-referrer');header('Cache-Control: no-store');
header('Content-Security-Policy: default-src \'self\'; script-src \'self\' \'nonce-'.$THEME_CSP_NONCE.'\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob: https:; font-src \'self\' data:; connect-src \'self\'; frame-src \'self\'; frame-ancestors \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'self\'');

/* ---------- 通用工具 ---------- */
function json_out(array $data,int $code=200): void {
    if(($data['status']??0)===200&&in_array($GLOBALS['THEME_WRITE']['action']??'',['seo.save','workspace.editor.save','workspace.save','save','reset'],true)){try{require_once $GLOBALS['ROOT'].'/lib/cra1_theme_seo.php';theme_generate_seo($GLOBALS['ROOT'],$GLOBALS['THEME_SETTINGS']['canonical_url']);}catch(Throwable $e){$data['data']['seo_ok']=false;$data['msg']='配置已保存，搜索引擎文件同步失败，请通过维护命令重建。';}}
    $data=theme_api_complete($data);$status=(int)($data['status']??$code);
    $data['code']=$data['code']??([200=>'OK',400=>'INVALID_REQUEST',401=>'SESSION_INVALID',403=>'PERMISSION_DENIED',404=>'NOT_FOUND',409=>'CONFIG_CONFLICT',429=>'RATE_LIMITED',500=>'SERVER_ERROR',503=>'SERVICE_UNAVAILABLE'][$status]??'REQUEST_FAILED');
    $data['request_id']=$GLOBALS['THEME_REQUEST_ID'];if(($data['msg']??'')==='success')$data['msg']='已读取';
    http_response_code($status);header('Content-Type: application/json; charset=utf-8');
    if(session_status()===PHP_SESSION_ACTIVE)session_write_close();echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;
}
set_exception_handler(function(Throwable $e): void {
    $status=$e instanceof CRA1ThemeSecurityError?$e->status:($e instanceof InvalidArgumentException?400:500);
    $msg=$e instanceof CRA1ThemeSecurityError?$e->getMessage():($status===400&&preg_match('/[\x{4e00}-\x{9fff}]/u',$e->getMessage())?$e->getMessage():'服务端处理失败，请重试或联系超级管理员。');
    if(!($e instanceof CRA1ThemeSecurityError))error_log('Theme admin request '.$GLOBALS['THEME_REQUEST_ID'].' exception '.get_class($e));
    json_out(['status'=>$status,'msg'=>$msg,'code'=>$e instanceof CRA1ThemeSecurityError?$e->errorCode:'SERVER_ERROR'],$status);
});

function theme_admin_read_config(): array
{
    global $CONFIG_FILE;
    return ThemeWorkspaceStore::readJson($CONFIG_FILE);
}

function client_ip(): string { return (string)($GLOBALS['THEME_NETWORK']['ip']??$_SERVER['REMOTE_ADDR']??''); }
function audit(string $action,string $result,string $detail=''): void {
    if(!empty($GLOBALS['THEME_WRITE']))return;
    theme_event($action,$result,['category'=>preg_match('/login|csrf|password|path/',$action)?'security':'operation','reason'=>'兼容接口记录：'.CRA1ThemeSecurity::safeDetail($detail)]);
}

function atomic_write(string $file, string $content): bool
{
    $tmp = $file . '.tmp.' . getmypid();
    if (file_put_contents($tmp, $content, LOCK_EX) === false) {
        return false;
    }
    @chmod($tmp, 0640);
    return rename($tmp, $file);
}

function read_json(string $file)
{
    if (!is_file($file)) {
        return null;
    }
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : null;
}

function csrf_token(): string
{
    if (empty($_SESSION['cra1_csrf'])) {
        $_SESSION['cra1_csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['cra1_csrf'];
}

function csrf_ok(): bool
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['_csrf'] ?? '');
    return is_string($token) && $token !== ''
        && hash_equals((string) ($_SESSION['cra1_csrf'] ?? ''), $token);
}

/** 解析请求体：JSON 优先，兼容表单提交 */
function read_body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }
    $body = [];
    $raw = file_get_contents('php://input');
    if (is_string($raw) && $raw !== '' && strlen($raw) < 262144) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $body = $decoded;
        }
    }
    if (!$body) {
        $body = $_POST;
    }
    return $body;
}

function is_logged_in(): bool { return theme_actor()!==null; }
function load_admin(): ?array { return theme_actor()?CRA1ThemeSecurity::publicAccount(theme_actor()):null; }

/* ---------- 配置服务（与主题控制器同一存储与校验规则） ---------- */
function url_ok(string $url): bool
{
    $url = trim($url);
    if ($url === '') {
        return true;
    }
    if (strpos($url, '//') === 0) {
        return false;
    }
    return (bool) preg_match('~^(#|/|https://|tel:|mailto:)~i', $url);
}

function text_urls_ok(string $value): bool
{
    foreach (preg_split('/\r?\n/', $value) as $line) {
        $line = trim((string) $line);
        // 行首 ! 为「隐藏」标记，校验时剥离
        if ($line !== '' && $line[0] === '!') {
            $line = trim(substr($line, 1));
        }
        foreach (explode('|', $line) as $seg) {
            $seg = trim($seg);
            if ($seg === '') {
                continue;
            }
            $hasScheme = (bool) preg_match('#^[a-z][a-z0-9+.\-]*:#i', $seg);
            // 图标代码豁免（mdi:headset / material-symbols:rocket / icons8:headset）：
            // 形如「前缀:名称」且不含斜杠/点/空格/@ 的段是图标键而非链接，
            // 前缀不属于真实 URL 协议时跳过链接校验
            if ($hasScheme
                && preg_match('~^[a-z][a-z0-9-]{1,30}:[a-z0-9][a-z0-9-]{0,60}$~i', $seg)
                && !preg_match('~^(?:https?|tel|mailto|ftp|ftps|javascript|data|vbscript|file|blob|sms|magnet|ws|wss)$~i', strstr($seg, ':', true))) {
                continue;
            }
            if (($hasScheme || strpos($seg, '//') === 0) && !url_ok($seg)) {
                return false;
            }
        }
    }
    return true;
}

function config_resolved(): array
{
    global $CONFIG_FILE, $LEGACY_FILE;
    theme_admin_read_config();
    $saved = [];
    foreach ([$LEGACY_FILE, $CONFIG_FILE] as $file) {
        $data = read_json($file);
        if (is_array($data)) {
            $saved = array_merge($saved, $data);
        }
    }
    $out = [];
    foreach (\template\cra1\controller\Cra1::defaults() as $key => $default) {
        $value = $saved[$key] ?? '';
        $out[$key] = ($value === '' || $value === null) ? $default : $value;
    }
    // 行业亮点 canonical rows：后台首次读取时也从旧 c1..c4 派生，
    // 这样 React rows 编辑器可直接显示现有旧数据，且不需要破坏性迁移。
    foreach (['ecommerce', 'finance', 'game', 'auto', 'travel', 'education', 'medical', 'agriculture'] as $industry) {
        $key = 'sol_ind_' . $industry . '_highlights_text';
        if (trim((string) ($saved[$key] ?? '')) === '') {
            $rows = [];
            for ($i = 1; $i <= 4; $i++) {
                $title = trim((string) ($out['sol_ind_' . $industry . '_c' . $i . '_title'] ?? ''));
                $desc = trim((string) ($out['sol_ind_' . $industry . '_c' . $i . '_desc'] ?? ''));
                if ($title !== '') {
                    $rows[] = str_replace(['|', "\r", "\n"], ' ', $title) . '|' . str_replace(['|', "\r", "\n"], ' ', $desc);
                }
            }
            $out[$key] = implode("\n", $rows);
        }
    }
    return $out;
}

/**
 * 校验并归一化一个配置键的写入值。
 * 返回 [ok, value]；空字符串/null = 空值墓碑（恢复默认），仍写入 ''。
 */
function config_normalize_value(string $key, $raw): array
{
    theme_safe_content($raw,$key);
    $value = is_array($raw) ? '' : trim((string) $raw);

    if (strpos($key, 'show_') === 0) {
        // 显式 '1'/true → 开；其余（含空串）→ 关（'0'）
        $on = in_array($value, ['1', 'true', 'on'], true) || $value === '1';
        return [true, ($value !== '' && ($value === '1' || $value === 'true' || $value === 'on' || filter_var($value, FILTER_VALIDATE_BOOLEAN))) ? '1' : '0'];
    }
    if ($value === '') {
        return [true, '']; // 空值墓碑：读取侧解释为默认值
    }
    if (substr($key, -4) === '_url' || substr($key, -5) === '_link') {
        if (!url_ok($value)) {
            return [false, '链接必须以 #、/、https://、tel: 或 mailto: 开头：' . $key];
        }
    }
    if (substr($key, -5) === '_text' && !text_urls_ok($value)) {
        return [false, '「' . $key . '」包含不允许的链接，仅支持 #、/、https://、tel:、mailto:'];
    }
    // 自定义代码允许更长内容（最高 200KB），其余字段 2 万字符
    $maxLen = (strpos($key, 'custom_') === 0) ? 200000 : 20000;
    if (mb_strlen($value) > $maxLen) {
        return [false, '字段过长：' . $key];
    }
    return [true, $value];
}

/** 锁定并增量合并写入 runtime 配置：未出现的键保持不变。 */
function config_patch_write(array $patch): array
{
    global $CONFIG_FILE;
    $defaults = \template\cra1\controller\Cra1::defaults();
    $lockFile = $CONFIG_FILE . '.lock';
    $dir = dirname($lockFile);
    if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
        return ['status' => 400, 'msg' => '存储目录不可写'];
    }
    $lock = fopen($lockFile, 'c');
    if (!$lock) {
        return ['status' => 400, 'msg' => '存储锁不可用'];
    }
    flock($lock, LOCK_EX);

    $current = [];
    if (is_file($CONFIG_FILE)) {
        $decoded = json_decode((string) file_get_contents($CONFIG_FILE), true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
            flock($lock, LOCK_UN);
            fclose($lock);
            return ['status' => 400, 'msg' => '存储文件损坏，保存已中止，原配置保留'];
        }
        $current = $decoded;
    }

    $accepted = [];
    foreach ($patch as $key => $value) {
        if (!array_key_exists($key, $defaults)) {
            continue; // 未知键忽略
        }
        $accepted[$key] = $value;
    }

    if (!function_exists('add_hook')) { function add_hook($name, $callback) {} }
    require_once $GLOBALS['ROOT'] . '/public/web/cra1/controller/hooks.php';
    $current = (new ThemeWorkspaceStore($GLOBALS['ROOT']))->applyLegacyPatch($current, $accepted);

    $ok = atomic_write($CONFIG_FILE, (string) json_encode($current, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    flock($lock, LOCK_UN);
    fclose($lock);
    return $ok ? ['status' => 200, 'msg' => '保存成功，前台已生效']
               : ['status' => 400, 'msg' => '保存失败：存储文件不可写'];
}

function config_save(array $input): array
{
    global $CONFIG_FILE;
    // 页面模块布局由专用 API（api.page-layout.*）维护，普通字段保存不接受该键，
    // 避免旧会话用陈旧整块 JSON 覆盖其他页面刚保存的顺序
    unset($input['page_module_orders_json']);
    unset($input['page_module_visibility_json']);
    unset($input['seo_page_meta_json']); // SEO 每页元信息由 api.seo.* 维护
    $patch = [];
    foreach (\template\cra1\controller\Cra1::defaults() as $key => $default) {
        if (!array_key_exists($key, $input)) {
            continue;
        }
        list($ok, $value) = config_normalize_value($key, $input[$key]);
        if (!$ok) {
            return ['status' => 400, 'msg' => $value];
        }
        $patch[$key] = $value;
    }
    if (empty($patch)) {
        return ['status' => 400, 'msg' => '没有需要保存的内容'];
    }
    $res = config_patch_write($patch);
    if ($res['status'] === 200) {
        $resolved = config_resolved();
        // 统一响应契约：完整 resolved 配置同时在顶层 config 与 data.config，
        // 旧客户端（legacy Alpine）读顶层，React 读 data.config
        $res['config'] = $resolved;
        $res['data'] = ['config' => $resolved];
    }
    return $res;
}

/* ---------- 页面渲染 ---------- */
$ASSET_VER = filemtime(__DIR__ . '/admin.js') . '.' . filemtime(__DIR__ . '/admin.css');

function html_head(string $title): void
{
    header('Content-Type: text/html; charset=utf-8');
    $ver = htmlspecialchars($GLOBALS['ASSET_VER']);
    echo '<!DOCTYPE html><html lang="zh-CN" data-theme="cra1" class="h-full"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex,nofollow">'
        . '<title>' . htmlspecialchars($title) . '</title>'
        . '<link rel="stylesheet" href="admin.css?v=' . $ver . '">'
        . '<script defer src="/web/cra1/assets/js/alpine.min.js?v='
        . htmlspecialchars((string) @filemtime($GLOBALS['ROOT'] . '/public/web/cra1/assets/js/alpine.min.js'))
        . '"></script>'
        . '</head><body class="min-h-full bg-base-200 text-base-content">';
}

function page_auth(array $admin): void
{
    html_head('酷锐A1主题管理台');
    $csrf = htmlspecialchars(csrf_token());
    $baseUrl = htmlspecialchars($GLOBALS['BASE_URL']);
    $ver = htmlspecialchars($GLOBALS['ASSET_VER']);
    echo <<<HTML
<div id="app" class="min-h-screen" data-csrf="{$csrf}" data-user="{$admin['username']}" data-base="{$baseUrl}"
     x-data="cra1Admin" x-cloak>

    <!-- 移动端抽屉容器 -->
    <div class="drawer lg:drawer-open">
        <input id="navDrawer" type="checkbox" class="drawer-toggle" x-model="drawerOpen">

        <div class="drawer-content flex min-h-screen flex-col">
            <!-- 顶栏 -->
            <header class="sticky top-0 z-30 border-b border-base-300 bg-base-100/95 backdrop-blur">
                <div class="flex h-14 items-center gap-3 px-4 md:px-6">
                    <label for="navDrawer" class="btn btn-ghost btn-sm lg:hidden" aria-label="打开导航">
                        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </label>
                    <div class="flex min-w-0 items-center gap-2">
                        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-btn bg-primary text-sm font-bold text-primary-content">CRA1</span>
                        <span class="truncate font-semibold">酷锐A1主题管理台</span>
                    </div>
                    <div class="ml-1 hidden min-w-0 items-center gap-1.5 text-sm text-muted md:flex">
                        <span class="text-base-300">/</span>
                        <span class="truncate" x-text="activeLabel"></span>
                    </div>

                    <div class="ml-auto flex items-center gap-2">
                        <span class="hidden text-sm text-muted sm:inline" x-text="'管理员：' + user"></span>

                        <button type="button" class="btn btn-ghost btn-sm gap-1.5" x-show="dirtyCount > 0" x-cloak
                                @click="saveAll()" :disabled="saving">
                            <span class="badge badge-warning badge-sm" x-text="dirtyCount"></span>
                            <span class="hidden sm:inline">未保存</span>
                        </button>

                        <div class="dropdown dropdown-end">
                            <button type="button" tabindex="0" class="btn btn-ghost btn-sm" aria-label="更多操作">
                                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                            </button>
                            <ul tabindex="0" class="menu dropdown-content z-50 mt-2 w-44 rounded-box border border-base-300 bg-base-100 p-2 shadow-card">
                                <li><button type="button" @click="saveAll()" :disabled="saving || dirtyCount === 0">保存全部配置</button></li>
                                <li><button type="button" @click="resetModal = true">恢复全部默认</button></li>
                                <li><button type="button" id="btnLogout" @click="logout()">退出登录</button></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </header>

            <!-- 内容区 -->
            <main class="flex-1 px-4 py-5 md:px-6 md:py-6">
                <div class="mx-auto w-full max-w-[80rem]">
                    <!-- 概览 -->
                    <section x-show="active === 'overview'" x-cloak>
                        <h1 class="mb-1 text-lg font-semibold">概览</h1>
                        <p class="mb-5 text-sm text-muted">当前主题配置状态与后台入口信息。</p>

                        <div id="ovStats" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <template x-for="s in stats" :key="s.label">
                                <div class="ov-card">
                                    <div class="ov-num" x-text="s.value"></div>
                                    <div class="ov-label" x-text="s.label"></div>
                                </div>
                            </template>
                        </div>

                        <!-- 前台模块实际状态：与官网渲染逻辑一致，消除后台与前台认知差 -->
                        <div class="mt-5 rounded-box border border-base-300 bg-base-100 p-5">
                            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 class="font-semibold">前台模块状态</h2>
                                    <p class="mt-0.5 text-xs text-muted">按当前配置，官网首页各模块的实际显示情况（与前台渲染逻辑一致）。</p>
                                </div>
                                <a class="btn btn-outline btn-xs" href="/" target="_blank" rel="noopener">打开官网首页 ↗</a>
                            </div>
                            <ul class="divide-y divide-base-200">
                                <template x-for="m in modules" :key="m.key">
                                    <li class="flex items-center gap-3 py-2.5">
                                        <span class="shrink-0" :class="m.show ? 'text-success' : 'text-base-300'">
                                            <svg x-show="m.show" x-cloak class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
                                            <svg x-show="!m.show" x-cloak class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                                        </span>
                                        <span class="min-w-0 flex-1 truncate text-sm" :class="m.show ? 'text-base-content' : 'text-muted'" x-text="m.label"></span>
                                        <span class="shrink-0 text-xs text-muted" x-text="m.detail"></span>
                                        <span class="badge badge-sm shrink-0" :class="m.show ? 'badge-success badge-outline' : 'badge-ghost'" x-text="m.show ? '显示' : '隐藏'"></span>
                                    </li>
                                </template>
                            </ul>
                        </div>

                        <!-- 全后台模块开关总览：点击直达对应设置页 -->
                        <div class="mt-5 rounded-box border border-base-300 bg-base-100 p-5">
                            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h2 class="font-semibold">模块开关总览</h2>
                                    <p class="mt-0.5 text-xs text-muted">全后台共 <span x-text="switchList.length"></span> 个模块开关；点击任意开关直达对应设置页修改。</p>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                <template x-for="sw in switchList" :key="sw.key">
                                    <button type="button" class="switch-chip ui-transition"
                                            :class="sw.on ? 'switch-chip-on' : ''"
                                            @click="goToSwitch(sw.key)"
                                            :title="sw.on ? '已开启 · 点击前往 ' + sw.page : '已关闭 · 点击前往 ' + sw.page">
                                        <span class="switch-dot" :class="sw.on ? 'bg-success' : 'bg-base-300'"></span>
                                        <span x-text="sw.label"></span>
                                    </button>
                                </template>
                            </div>
                        </div>

                        <div class="mt-5 rounded-box border border-base-300 bg-base-100 p-5">
                            <h2 class="mb-1 font-semibold">当前后台地址</h2>
                            <p class="mb-3 text-sm text-muted">请妥善保管该地址，它不在任何页面公开链接中出现；可在「安全与后台」中自定义或随机更换。</p>
                            <div class="flex flex-wrap gap-2">
                                <input id="ovUrl" type="text" readonly class="input input-bordered input-sm min-w-[16rem] flex-1 font-mono text-xs" :value="baseUrl">
                                <button type="button" class="btn btn-outline btn-sm" @click="copyBase()">复制</button>
                                <a class="btn btn-outline btn-sm" :href="baseUrl" target="_blank" rel="noopener">打开</a>
                            </div>
                        </div>

                        <div class="mt-5 rounded-box border border-base-300 bg-base-100 p-5">
                            <h2 class="mb-3 font-semibold">站内快捷入口</h2>
                            <div class="grid gap-3 sm:grid-cols-3">
                                <a class="ov-card link" href="/" target="_blank" rel="noopener">官网首页 ↗</a>
                                <a class="ov-card link" href="/solution.html" target="_blank" rel="noopener">解决方案页 ↗</a>
                                <a class="ov-card link" href="/cart/goodsList.htm" target="_blank" rel="noopener">商品列表 ↗</a>
                            </div>
                        </div>
                    </section>

                    <!-- 配置页 -->
                    <section x-show="active !== 'overview' && active !== 'security'" x-cloak>
                        <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
                            <div class="min-w-0">
                                <h1 class="text-lg font-semibold" x-text="activeLabel"></h1>
                                <p class="mt-1 max-w-3xl text-sm leading-6 text-muted" x-show="activeHint" x-text="activeHint"></p>
                            </div>
                            <span class="badge badge-ghost" x-show="dirtyCount > 0" x-cloak>
                                <span x-text="dirtyCount"></span> 项未保存
                            </span>
                        </div>

                        <div class="rounded-box border border-base-300 bg-base-100 p-5">
                            <template x-for="f in activeFields" :key="f.key">
                                <div class="mb-6 last:mb-0">
                                    <!-- 开关 -->
                                    <template x-if="f.type === 'switch'">
                                        <label class="flex cursor-pointer items-center gap-3">
                                            <!-- 不用 x-model：checkbox 带 value 属性时 Alpine 按
                                                 cast(el.value)===model 判定勾选，字符串 '1' 会永远渲染为未勾选，
                                                 造成「后台开关与前台实际状态不一致」的假象 -->
                                            <input type="checkbox" class="toggle toggle-primary toggle-sm"
                                                   :data-key="f.key"
                                                   :checked="String(form[f.key]) === '1'"
                                                   @change="form[f.key] = \$event.target.checked ? '1' : ''">
                                            <span class="text-sm font-medium" x-text="f.label"></span>
                                        </label>
                                    </template>

                                    <!-- 行式列表编辑器：一行一项摘要，新增/编辑走弹窗 -->
                                    <template x-if="f.type === 'rows'">
                                        <div>
                                            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <span class="text-sm font-medium text-base-content" x-text="f.label"></span>
                                                    <span class="ml-2 text-xs text-muted">
                                                        <span x-text="rowsOf(f).length"></span> 项
                                                        <span x-show="hiddenCountOf(f) > 0" x-cloak>
                                                            · <span x-text="hiddenCountOf(f)"></span> 项已隐藏
                                                        </span>
                                                    </span>
                                                </div>
                                                <button type="button" class="btn btn-outline btn-xs" @click="openRowAdd(f)">
                                                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>
                                                    <span x-text="f.addLabel || '添加'"></span>
                                                </button>
                                            </div>
                                            <p class="field-hint mb-2" x-show="f.hint" x-text="f.hint"></p>

                                            <!-- 菜单导航：一级 / 二级树形层级 -->
                                            <template x-if="f.menuLike">
                                                <div class="space-y-2">
                                                    <template x-for="(g, gi) in menuGroups(f)" :key="f.key + '-g' + gi + '-' + rowRev">
                                                        <div class="menu-group">
                                                            <!-- 一级项（拖拽 = 整组移动，含其二级项） -->
                                                            <div class="row-line" draggable="true"
                                                                 @dragstart="onRowDragStart(\$event, f, g.pIndex)"
                                                                 @dragover="onRowDragOver(\$event, f, g.pIndex)"
                                                                 @drop="onRowDrop(\$event, f, g.pIndex)"
                                                                 @dragend="onRowDragEnd()"
                                                                 :class="{ 'row-drop': _dragOver === g.pIndex && _drag && _drag.key === f.key }">
                                                                <span class="row-handle" title="拖拽排序：整组移动（含其二级项）" aria-hidden="true">
                                                                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"></path></svg>
                                                                </span>
                                                                <button type="button" class="row-btn menu-caret" :class="g.children.length ? '' : 'invisible pointer-events-none'"
                                                                        @click="toggleMenuGroup(f.key, g.parent.cols[0])"
                                                                        :aria-expanded="menuGroupOpen(f.key, g.parent.cols[0]) ? 'true' : 'false'"
                                                                        :title="menuGroupOpen(f.key, g.parent.cols[0]) ? '收起下级菜单' : '展开下级菜单'">
                                                                    <svg class="h-4 w-4 ui-transition" :class="menuGroupOpen(f.key, g.parent.cols[0]) ? '' : '-rotate-90'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                                                                </button>
                                                                <div class="row-main">
                                                                    <span class="row-title" x-text="rowSummary(f, g.parent).title"></span>
                                                                    <span class="row-badge row-badge-lvl" x-show="String(g.parent.cols[3] || '1') !== '2'">一级</span>
                                                                    <span class="row-badge row-badge-warn" x-show="String(g.parent.cols[3] || '1') === '2'" x-cloak title="二级项排在了所有一级项之前，前台会忽略它">无上级</span>
                                                                    <span class="row-badge row-badge-off" x-show="g.parent.hidden" x-cloak>已隐藏</span>
                                                                    <span class="row-desc" x-text="rowSummary(f, g.parent).sub"></span>
                                                                </div>
                                                                <div class="row-actions">
                                                                    <button type="button" class="btn btn-ghost btn-xs row-edit-btn" @click="openRowEdit(f, g.pIndex)">编辑</button>
                                                                    <button type="button" class="row-btn" @click="toggleRow(f, g.pIndex)"
                                                                            :title="g.parent.hidden ? '当前隐藏，点击恢复显示' : '点击隐藏（前台不显示）'"
                                                                            :aria-label="g.parent.hidden ? '恢复显示' : '隐藏'">
                                                                        <svg x-show="!g.parent.hidden" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                                        <svg x-show="g.parent.hidden" x-cloak class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 11s3.5 7 10 7a9.7 9.7 0 0 0 4.42-1M2 2l20 20"></path></svg>
                                                                    </button>
                                                                    <span class="row-sep" aria-hidden="true"></span>
                                                                    <button type="button" class="row-btn" @click="duplicateRow(f, g.pIndex)" title="复制此项" aria-label="复制">
                                                                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                                    </button>
                                                                    <button type="button" class="row-btn row-btn-danger" @click="removeRow(f, g.pIndex)" title="删除此项（其二级项将上移为一级）" aria-label="删除">
                                                                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <!-- 二级项：缩进 + 引导线，可点击一级箭头收起 -->
                                                            <div class="menu-children" x-show="g.children.length > 0 && menuGroupOpen(f.key, g.parent.cols[0])" x-cloak>
                                                                <template x-for="(c, cj) in g.children" :key="f.key + '-c' + gi + '-' + cj + '-' + rowRev">
                                                                    <div class="row-line" draggable="true"
                                                                         @dragstart="onRowDragStart(\$event, f, c.index)"
                                                                         @dragover="onRowDragOver(\$event, f, c.index)"
                                                                         @drop="onRowDrop(\$event, f, c.index)"
                                                                         @dragend="onRowDragEnd()"
                                                                         :class="{ 'row-hidden': c.row.hidden, 'row-drop': _dragOver === c.index && _drag && _drag.key === f.key }">
                                                                        <span class="row-handle" title="拖拽排序（同级之间；拖到其他一级项上可更换上级）" aria-hidden="true">
                                                                            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"></path></svg>
                                                                        </span>
                                                                        <div class="row-main">
                                                                            <span class="row-title" x-text="rowSummary(f, c.row).title"></span>
                                                                            <span class="row-badge row-badge-lvl">二级</span>
                                                                            <span class="row-badge row-badge-off" x-show="c.row.hidden" x-cloak>已隐藏</span>
                                                                            <span class="row-desc" x-text="rowSummary(f, c.row).sub"></span>
                                                                        </div>
                                                                        <div class="row-actions">
                                                                            <button type="button" class="btn btn-ghost btn-xs row-edit-btn" @click="openRowEdit(f, c.index)">编辑</button>
                                                                            <button type="button" class="row-btn" @click="toggleRow(f, c.index)"
                                                                                    :title="c.row.hidden ? '当前隐藏，点击恢复显示' : '点击隐藏（前台不显示）'"
                                                                                    :aria-label="c.row.hidden ? '恢复显示' : '隐藏'">
                                                                                <svg x-show="!c.row.hidden" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                                                <svg x-show="c.row.hidden" x-cloak class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 11s3.5 7 10 7a9.7 9.7 0 0 0 4.42-1M2 2l20 20"></path></svg>
                                                                            </button>
                                                                            <span class="row-sep" aria-hidden="true"></span>
                                                                            <button type="button" class="row-btn" @click="duplicateRow(f, c.index)" title="复制此项" aria-label="复制">
                                                                                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                                            </button>
                                                                            <button type="button" class="row-btn row-btn-danger" @click="removeRow(f, c.index)" title="删除此项" aria-label="删除">
                                                                                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </template>
                                                            </div>
                                                            <div class="menu-add">
                                                                <button type="button" class="btn btn-ghost btn-xs" @click="openRowAdd(f, gi)">
                                                                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>
                                                                    添加二级菜单
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </template>
                                                    <p class="row-empty" x-show="menuGroups(f).length === 0" x-cloak>
                                                        暂无菜单，点击右上角「添加菜单项」创建一级菜单
                                                    </p>
                                                </div>
                                            </template>

                                            <!-- 其他列表：扁平结构 -->
                                            <template x-if="!f.menuLike">
                                                <ul class="row-editor" :data-rows="f.key">
                                                    <template x-for="(row, ri) in rowsOf(f)" :key="f.key + '-' + ri + '-' + rowRev">
                                                        <li class="row-line" x-show="!needsCollapse(f) || isListExpanded(f) || ri < rowCollapseThreshold"
                                                            draggable="true"
                                                            @dragstart="onRowDragStart(\$event, f, ri)"
                                                            @dragover="onRowDragOver(\$event, f, ri)"
                                                            @drop="onRowDrop(\$event, f, ri)"
                                                            @dragend="onRowDragEnd()"
                                                            :class="{ 'row-hidden': row.hidden, 'row-drop': _dragOver === ri && _drag && _drag.key === f.key }">
                                                            <span class="row-handle" title="拖拽排序" aria-hidden="true">
                                                                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01"></path></svg>
                                                            </span>
                                                            <div class="row-main">
                                                                <img x-show="iconColIndex(f) >= 0 && iconPreviewUrl(row.cols[iconColIndex(f)])" :src="iconPreviewUrl(row.cols[iconColIndex(f)], 28)" alt="" class="h-4 w-4 shrink-0">
                                                                <span class="row-title" x-text="rowSummary(f, row).title"></span>
                                                                <span class="row-badge row-badge-off" x-show="row.hidden" x-cloak>已隐藏</span>
                                                                <span class="row-desc" x-text="rowSummary(f, row).sub"></span>
                                                            </div>
                                                            <div class="row-actions">
                                                                <button type="button" class="btn btn-ghost btn-xs row-edit-btn" @click="openRowEdit(f, ri)">编辑</button>
                                                                <button type="button" class="row-btn" @click="toggleRow(f, ri)"
                                                                        :title="row.hidden ? '当前隐藏，点击恢复显示' : '点击隐藏（前台不显示）'"
                                                                        :aria-label="row.hidden ? '恢复显示' : '隐藏'">
                                                                    <svg x-show="!row.hidden" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                                    <svg x-show="row.hidden" x-cloak class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 11s3.5 7 10 7a9.7 9.7 0 0 0 4.42-1M2 2l20 20"></path></svg>
                                                                </button>
                                                                <span class="row-sep" aria-hidden="true"></span>
                                                                <button type="button" class="row-btn" @click="duplicateRow(f, ri)" title="复制此项" aria-label="复制">
                                                                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                                </button>
                                                                <button type="button" class="row-btn row-btn-danger" @click="removeRow(f, ri)" title="删除此项" aria-label="删除">
                                                                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"></path></svg>
                                                                </button>
                                                            </div>
                                                        </li>
                                                    </template>
                                                    <li class="row-empty" x-show="rowsOf(f).length === 0" x-cloak>
                                                        暂无内容，点击右上角按钮添加
                                                    </li>
                                                    <!-- 长列表折叠提示 -->
                                                    <li x-show="needsCollapse(f)" x-cloak class="pt-1">
                                                        <button type="button" class="btn btn-ghost btn-xs w-full"
                                                                @click="toggleListExpand(f)">
                                                            <span x-show="!isListExpanded(f)">
                                                                展开剩余 <span x-text="collapsedCount(f)"></span> 项
                                                            </span>
                                                            <span x-show="isListExpanded(f)" x-cloak>收起</span>
                                                            <svg class="h-3.5 w-3.5 ui-transition" :class="isListExpanded(f) ? 'rotate-180' : ''"
                                                                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m6 9 6 6 6-6"></path></svg>
                                                        </button>
                                                    </li>
                                                </ul>
                                            </template>
                                        </div>
                                    </template>

                                    <!-- 固定项分组：卡片摘要 + 编辑弹窗（固定结构，仅修改） -->
                                    <template x-if="f.type === 'cards'">
                                        <div>
                                            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <span class="text-sm font-medium text-base-content" x-text="f.label"></span>
                                                    <span class="ml-2 text-xs text-muted" x-text="'固定 ' + f.items.length + ' 项 · 点击「编辑」在弹窗中修改'"></span>
                                                </div>
                                            </div>
                                            <p class="field-hint mb-2" x-show="f.hint" x-text="f.hint"></p>
                                            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                                <template x-for="(it, ii) in f.items" :key="f.key + '-' + it.key">
                                                    <div class="card-item">
                                                        <div class="card-item-head">
                                                            <span class="flex min-w-0 items-center gap-1.5">
                                                                <img x-cloak x-show="cardIconPreview(f, ii)" :src="cardIconPreview(f, ii)" alt="" class="h-4 w-4 shrink-0">
                                                                <span class="card-item-name truncate" x-text="it.label"></span>
                                                            </span>
                                                            <button type="button" class="btn btn-ghost btn-xs" @click="openCardEdit(f, ii)">
                                                                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
                                                                编辑
                                                            </button>
                                                        </div>
                                                        <p class="card-item-title" :class="cardTextValue(f, ii, 0) ? '' : 'italic opacity-40'" x-text="cardTextValue(f, ii, 0) || '未填写'"></p>
                                                        <p class="card-item-desc" x-show="cardTextValue(f, ii, 1)" x-text="cardTextValue(f, ii, 1)"></p>
                                                    </div>
                                                </template>
                                            </div>
                                        </div>
                                    </template>

                                    <!-- 图标字段：可视化点选 + 搜索弹窗，加载当前值 -->
                                    <template x-if="f.type === 'icon'">
                                        <div class="flex items-center gap-2">
                                            <span class="icon-preview" x-cloak x-show="iconPreviewUrl(form[f.key])">
                                                <img :src="iconPreviewUrl(form[f.key], 40)" alt="">
                                            </span>
                                            <input type="text" class="input input-bordered w-full" x-model="form[f.key]"
                                                   :data-key="f.key"
                                                   :placeholder="f.placeholder || 'mdi:headset / icons8:headset'">
                                            <button type="button" class="btn btn-outline shrink-0" @click="openIconPicker({ kind: 'form', key: f.key })">选择图标</button>
                                        </div>
                                    </template>
                                    <!-- 普通文本 / 多行文本 -->
                                    <!-- 标签字段：逗号/回车应用、框内固定 chips、可拖拽排序 -->
                                    <template x-if="f.type === 'tags'">
                                        <label class="field block">
                                            <span x-text="f.label"></span>
                                            <div class="tag-input" @click="$el.querySelector('input').focus()">
                                                <template x-for="(tag, ti) in tagsOf(form[f.key])" :key="f.key + '-t' + ti + '-' + tag">
                                                    <span class="tag-chip"
                                                          :class="tagDrag.key === f.key && tagDrag.index === ti ? 'dragging' : (tagDrag.key === f.key && tagDrag.over === ti ? (tagDrag.before ? 'over-before' : 'over-after') : '')"
                                                          draggable="true"
                                                          @dragstart="tagDrag.key = f.key; tagDrag.index = ti"
                                                          @dragend="tagDrag.key = null; tagDrag.index = -1; tagDrag.over = -1"
                                                          @dragover.prevent="tagDrag.key === f.key && tagDrag.index !== ti && (tagDrag.over = ti, tagDrag.before = ($event.clientX - $event.currentTarget.getBoundingClientRect().left) / $event.currentTarget.getBoundingClientRect().width < 0.5)"
                                                          @drop.prevent="tagDrop(f.key, ti, $event)">
                                                        <span x-text="tag"></span>
                                                        <button type="button" class="tag-chip-x" :aria-label="'删除标签 ' + tag"
                                                                @click.stop="tagRemove(f.key, ti)">✕</button>
                                                    </span>
                                                </template>
                                                <input type="text" :data-key="f.key" :placeholder="tagsOf(form[f.key]).length ? '' : (f.placeholder || '输入后按回车或英文逗号添加')"
                                                       @keydown.enter.prevent="tagDraft[f.key] = tagCommit(f.key, $event.target.value); $event.target.value = ''"
                                                       @keydown.,.prevent="tagDraft[f.key] = tagCommit(f.key, $event.target.value); $event.target.value = ''"
                                                       @keydown.backspace="if ($event.target.value === '') { tagRemove(f.key, tagsOf(form[f.key]).length - 1); }"
                                                       @blur="if ($event.target.value.trim() !== '') { tagCommit(f.key, $event.target.value); $event.target.value = ''; }">
                                            </div>
                                            <span class="field-hint block" x-show="f.hint" x-text="f.hint"></span>
                                        </label>
                                    </template>

                                    <template x-if="f.type !== 'switch' && f.type !== 'rows' && f.type !== 'cards' && f.type !== 'icon' && f.type !== 'tags'">
                                        <label class="field block">
                                            <span x-text="f.label"></span>
                                            <template x-if="f.type === 'textarea'">
                                                <textarea class="textarea textarea-bordered w-full font-mono text-xs leading-5"
                                                          :rows="f.rows || 4" :data-key="f.key" x-model="form[f.key]"></textarea>
                                            </template>
                                            <template x-if="f.type !== 'textarea'">
                                                <input type="text" class="input input-bordered w-full"
                                                       :data-key="f.key" x-model="form[f.key]">
                                            </template>
                                            <span class="field-hint block" x-show="f.hint" x-text="f.hint"></span>
                                        </label>
                                    </template>
                                </div>
                            </template>
                        </div>
                    </section>

                    <!-- 安全与后台 -->
                    <section x-show="active === 'security'" x-cloak>
                        <h1 class="mb-1 text-lg font-semibold">安全与后台</h1>
                        <p class="mb-5 text-sm text-muted">账号密码、后台访问路径与操作审计。</p>

                        <div class="rounded-box border border-base-300 bg-base-100 p-5">
                            <h2 class="mb-3 font-semibold">修改密码</h2>
                            <div class="grid gap-3 md:grid-cols-3">
                                <label class="field block"><span>当前密码</span>
                                    <input type="password" id="pwdOld" autocomplete="current-password" class="input input-bordered w-full"></label>
                                <label class="field block"><span>新密码（至少 8 位）</span>
                                    <input type="password" id="pwdNew" autocomplete="new-password" class="input input-bordered w-full"></label>
                                <label class="field block"><span>确认新密码</span>
                                    <input type="password" id="pwdNew2" autocomplete="new-password" class="input input-bordered w-full"></label>
                            </div>
                            <button type="button" class="btn btn-primary mt-4" id="pwdSave" @click="savePassword()" :disabled="saving">更新密码</button>
                        </div>

                        <div class="mt-4 rounded-box border border-base-300 bg-base-100 p-5">
                            <h2 class="mb-1 font-semibold">后台路径</h2>
                            <p class="mb-3 text-sm leading-6 text-muted">当前地址：<span class="font-mono text-xs" x-text="baseUrl"></span><br>修改路径后旧地址立即失效，且需要使用新地址重新登录；仅支持 6-32 位小写字母或数字。</p>
                            <div class="flex flex-wrap gap-2">
                                <input type="text" id="pathInput" maxlength="32" placeholder="新的后台路径，如 mysecretpanel"
                                       class="input input-bordered input-sm min-w-[14rem] flex-1 font-mono text-xs">
                                <button type="button" class="btn btn-outline btn-sm" @click="randomPath()">随机生成</button>
                                <button type="button" class="btn btn-primary btn-sm" id="pathSave" @click="changePath()" :disabled="saving">确认修改</button>
                            </div>
                        </div>

                        <div class="mt-4 rounded-box border border-base-300 bg-base-100 p-5">
                            <div class="mb-3 flex items-center justify-between gap-3">
                                <h2 class="font-semibold">操作日志</h2>
                                <button type="button" class="btn btn-ghost btn-xs" @click="loadLogs()">刷新</button>
                            </div>
                            <div class="log-wrap">
                                <table class="table table-sm table-zebra log-table">
                                    <thead>
                                        <tr><th>时间</th><th>IP</th><th>动作</th><th>结果</th><th>详情</th></tr>
                                    </thead>
                                    <tbody>
                                        <template x-for="(row, ri) in logs" :key="ri">
                                            <tr>
                                                <td class="whitespace-nowrap" x-text="row.time"></td>
                                                <td class="whitespace-nowrap" x-text="row.ip"></td>
                                                <td x-text="row.action"></td>
                                                <td :class="row.result === 'ok' ? 'text-success' : 'text-error'" x-text="row.result"></td>
                                                <td class="max-w-[16rem] truncate" x-text="row.detail"></td>
                                            </tr>
                                        </template>
                                        <tr x-show="logs.length === 0"><td colspan="5" class="text-center text-muted">暂无日志</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <!-- 底部保存栏（分页面保存） -->
            <div class="sticky bottom-0 z-20 border-t border-base-300 bg-base-100/95 backdrop-blur">
                <div class="mx-auto flex w-full max-w-[80rem] flex-wrap items-center gap-3 px-4 py-3 md:px-6">
                    <!-- 有改动：显示主操作；无改动：只显示恢复默认与提示，避免灰底禁用按钮 -->
                    <template x-if="active !== 'overview' && active !== 'security' && dirtyCount > 0">
                        <div class="flex flex-wrap items-center gap-2">
                            <button type="button" class="btn btn-primary btn-sm" id="btnSave"
                                    @click="saveCurrent()" :disabled="saving">
                                <span x-show="!saving">保存本页</span>
                                <span x-show="saving" class="loading loading-spinner loading-xs"></span>
                            </button>
                            <button type="button" class="btn btn-ghost btn-sm" @click="revertCurrent()">撤销本页修改</button>
                            <button type="button" class="btn btn-ghost btn-sm" @click="resetModal = true">恢复全部默认</button>
                            <span class="text-xs text-warning">
                                <span x-text="dirtyCount"></span> 项修改未保存（Ctrl/Cmd + S 保存本页）
                            </span>
                        </div>
                    </template>
                    <template x-if="active === 'overview' || active === 'security' || dirtyCount === 0">
                        <div class="flex flex-wrap items-center gap-2">
                            <button type="button" class="btn btn-ghost btn-sm" id="btnReset" @click="resetModal = true">恢复全部默认</button>
                            <span class="text-xs text-muted">保存后官网前台立即生效；留空字段使用主题默认值。</span>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- 侧边栏 -->
        <div class="drawer-side z-40">
            <label for="navDrawer" class="drawer-overlay" aria-label="关闭导航"></label>
            <aside class="flex h-full w-72 flex-col border-r border-base-300 bg-base-100">
                <div class="border-b border-base-300 p-3">
                    <!-- 自绘边框：daisyUI 的 .input 会给容器加边框，与内部 input 叠加成双框 -->
                    <label class="flex h-9 items-center gap-2 rounded-btn border border-base-300 bg-base-100 px-3 focus-within:border-primary">
                        <svg class="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                        <input type="search" class="h-full w-full min-w-0 border-0 bg-transparent p-0 text-sm text-base-content outline-none placeholder:text-muted" placeholder="搜索设置…" x-model="query" @keydown.escape="query = ''">
                    </label>
                </div>

                <nav class="flex-1 overflow-y-auto p-3" aria-label="配置导航">
                    <!-- 搜索结果 -->
                    <template x-if="query.trim() !== ''">
                        <div>
                            <p class="mb-2 px-3 text-[12px] font-semibold text-muted">
                                搜索结果 <span x-text="'(' + searchResults.length + ')'"></span>
                            </p>
                            <template x-for="item in searchResults" :key="item.key">
                                <button type="button" class="nav-item" :class="{ active: active === item.key }"
                                        @click="go(item.key)">
                                    <span class="min-w-0 flex-1 truncate" x-text="item.label"></span>
                                    <span class="shrink-0 text-[11px] text-muted" x-text="item.section"></span>
                                    <span class="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" x-show="dirtyKeys[item.key]" x-cloak></span>
                                </button>
                            </template>
                            <p class="px-3 py-4 text-center text-xs text-muted" x-show="searchResults.length === 0">没有匹配的设置项</p>
                        </div>
                    </template>

                    <!-- 分组折叠导航 -->
                    <template x-if="query.trim() === ''">
                        <div>
                            <button type="button" class="nav-item" :class="{ active: active === 'overview' }" @click="go('overview')">
                                <span class="flex-1">概览</span>
                            </button>

                            <template x-for="sec in sections" :key="sec.key">
                                <div>
                                    <button type="button" class="nav-section" @click="toggleSection(sec.key)"
                                            :aria-expanded="openSections[sec.key] ? 'true' : 'false'">
                                        <span x-text="sec.label"></span>
                                        <span class="flex items-center gap-1.5">
                                            <span class="badge badge-warning badge-xs" x-show="sectionDirtyCount(sec.key) > 0" x-cloak
                                                  x-text="sectionDirtyCount(sec.key)"></span>
                                            <svg class="h-3 w-3 shrink-0 text-muted ui-transition" :class="openSections[sec.key] ? 'rotate-90' : ''"
                                                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"></path></svg>
                                        </span>
                                    </button>
                                    <div x-show="openSections[sec.key]" x-cloak>
                                        <template x-for="item in sec.items" :key="item.key">
                                            <button type="button" class="nav-item sub" :class="{ active: active === item.key }"
                                                    @click="go(item.key)">
                                                <span class="min-w-0 flex-1 truncate" x-text="item.label"></span>
                                                <span class="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" x-show="dirtyKeys[item.key]" x-cloak></span>
                                            </button>
                                        </template>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </template>
                </nav>

                <!-- 固定底栏：账号相关入口始终可见，不随导航滚动 -->
                <div class="border-t border-base-300 bg-base-200/50 p-3">
                    <button type="button" class="nav-item" :class="{ active: active === 'security' }" @click="go('security')">
                        <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z"></path><path d="m9 12 2 2 4-4"></path></svg>
                        <span class="flex-1">安全与后台</span>
                        <span class="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" x-show="dirtyKeys['security']" x-cloak></span>
                    </button>
                    <p class="mt-1.5 px-3 text-[11px] leading-none text-muted">v2.0 · 独立管理台</p>
                </div>
            </aside>
        </div>
    </div>

    <!-- 离开确认模态 -->
    <div class="modal" :class="{ 'modal-open': leaveModal }" x-cloak>
        <div class="modal-box max-w-md">
            <h3 class="text-base font-semibold">有未保存的修改</h3>
            <p class="py-3 text-sm text-muted">
                「<span x-text="pendingTargetLabel"></span>」有 <span x-text="dirtyCount"></span> 项修改尚未保存。
            </p>
            <div class="modal-action flex-wrap gap-2">
                <button type="button" class="btn btn-primary btn-sm" @click="saveThenGo()" :disabled="saving">保存并切换</button>
                <button type="button" class="btn btn-warning btn-outline btn-sm" @click="discardThenGo()">放弃修改</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="leaveModal = false">取消</button>
            </div>
        </div>
    </div>

    <!-- 恢复默认确认模态 -->
    <div class="modal" :class="{ 'modal-open': resetModal }" x-cloak>
        <div class="modal-box max-w-md">
            <h3 class="text-base font-semibold">恢复全部默认</h3>
            <p class="py-3 text-sm text-muted">将清除所有已保存的 酷锐A1主题配置，官网恢复为主题默认内容。此操作不可撤销。</p>
            <div class="modal-action">
                <button type="button" class="btn btn-error btn-sm" @click="doReset()" :disabled="saving">确认恢复</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="resetModal = false">取消</button>
            </div>
        </div>
    </div>


    <!-- 行项编辑弹窗（列表项新增 / 编辑） -->
    <div class="modal" :class="{ 'modal-open': rowModal.open }" x-cloak data-row-modal
         @keydown.escape.window="rowModal.open = false">
        <div class="modal-box max-w-lg">
            <h3 class="text-base font-semibold">
                <span x-text="rowModal.index >= 0 ? '编辑' : '添加'"></span>
                <span x-text="rowField ? ' · ' + rowField.label : ''"></span>
            </h3>
            <div class="mt-4 grid gap-3">
                <template x-for="(col, ci) in rowField ? rowField.cols : []" :key="rowModal.fieldKey + '-' + ci">
                    <label class="field block">
                        <span x-text="col.label"></span>
                        <template x-if="col.type === 'select'">
                            <select class="select select-bordered w-full" x-model="rowModal.cols[ci]">
                                <template x-for="opt in col.options" :key="opt[0]">
                                    <option :value="opt[0]" x-text="opt[1]"></option>
                                </template>
                            </select>
                        </template>
                        <template x-if="col.type === 'checkbox'">
                            <span class="flex h-10 items-center">
                                <input type="checkbox" class="toggle toggle-primary"
                                       :checked="String(rowModal.cols[ci]) === '1'"
                                       @change="rowModal.cols[ci] = \$event.target.checked ? '1' : ''">
                            </span>
                        </template>
                        <template x-if="col.type === 'icon'">
                            <div class="flex items-center gap-2">
                                <span class="icon-preview" x-cloak x-show="iconPreviewUrl(rowModal.cols[ci])">
                                    <img :src="iconPreviewUrl(rowModal.cols[ci], 40)" alt="">
                                </span>
                                <input type="text" class="input input-bordered w-full" x-model="rowModal.cols[ci]"
                                       :placeholder="col.placeholder || ''">
                                <button type="button" class="btn btn-outline shrink-0" @click="openIconPicker({ kind: 'rowModal', colIndex: ci })">选择图标</button>
                            </div>
                        </template>
                        <template x-if="col.type === 'textarea'">
                            <textarea class="textarea textarea-bordered w-full" :rows="col.rows || 3"
                                      x-model="rowModal.cols[ci]" :placeholder="col.placeholder || ''"
                                      :aria-label="col.label || ''"></textarea>
                        </template>
                        <template x-if="col.type !== 'select' && col.type !== 'checkbox' && col.type !== 'icon' && col.type !== 'textarea'">
                            <input type="text" class="input input-bordered w-full" x-model="rowModal.cols[ci]"
                                   :placeholder="col.placeholder || ''" @keydown.enter="saveRowModal()">
                        </template>
                        <p class="mt-1 text-xs text-muted" x-show="col.hint" x-cloak x-text="col.hint"></p>
                    </label>
                </template>
            </div>
            <label class="mt-4 flex cursor-pointer items-center gap-3 rounded-btn bg-base-200/60 px-3 py-2.5">
                <input type="checkbox" class="toggle toggle-primary toggle-sm"
                       :checked="rowModal.hidden"
                       @change="rowModal.hidden = \$event.target.checked">
                <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium">在前台隐藏此项</span>
                    <span class="block text-xs text-muted">配置保留，但前台不输出；可随时恢复显示</span>
                </span>
            </label>
            <p class="mt-2 text-sm text-error" x-show="rowModalError" x-cloak x-text="rowModalError"></p>
            <div class="modal-action">
                <button type="button" class="btn btn-ghost btn-sm" @click="rowModal.open = false">取消</button>
                <button type="button" class="btn btn-primary btn-sm" @click="saveRowModal()" :disabled="saving">保存</button>
            </div>
        </div>
    </div>

    <!-- 固定项编辑弹窗（cards 字段） -->
    <div class="modal" :class="{ 'modal-open': cardModal.open }" x-cloak data-card-modal
         @keydown.escape.window="cardModal.open = false">
        <div class="modal-box max-w-lg">
            <h3 class="text-base font-semibold">
                编辑<span x-text="cardField ? ' · ' + cardField.label : ''"></span>
                <span x-text="cardItemLabel ? ' · ' + cardItemLabel : ''"></span>
            </h3>
            <div class="mt-4 grid gap-3">
                <template x-for="(cf, ci) in cardField ? cardField.fields : []" :key="cardModal.fieldKey + '-' + ci">
                    <label class="field block">
                        <span x-text="cf.label"></span>
                        <!-- 标签列：逗号/回车应用、框内固定 chips、可拖拽排序 -->
                        <template x-if="cf.type === 'tags'">
                            <div class="tag-input" @click="$el.querySelector('input').focus()">
                                <template x-for="(tag, ti) in tagsOf(cardModal.values[cf.key])" :key="cf.key + '-ct' + ti + '-' + tag">
                                    <span class="tag-chip"
                                          :class="cardTagDrag.key === cf.key && cardTagDrag.index === ti ? 'dragging' : (cardTagDrag.key === cf.key && cardTagDrag.over === ti ? (cardTagDrag.before ? 'over-before' : 'over-after') : '')"
                                          draggable="true"
                                          @dragstart="cardTagDrag.key = cf.key; cardTagDrag.index = ti"
                                          @dragend="cardTagDrag.key = null; cardTagDrag.index = -1; cardTagDrag.over = -1"
                                          @dragover.prevent="cardTagDrag.key === cf.key && cardTagDrag.index !== ti && (cardTagDrag.over = ti, cardTagDrag.before = ($event.clientX - $event.currentTarget.getBoundingClientRect().left) / $event.currentTarget.getBoundingClientRect().width < 0.5)"
                                          @drop.prevent="cardTagDrop(cf.key, ti, $event)">
                                        <span x-text="tag"></span>
                                        <button type="button" class="tag-chip-x" :aria-label="'删除标签 ' + tag"
                                                @click.stop="cardTagRemove(cf.key, ti)">✕</button>
                                    </span>
                                </template>
                                <input type="text" :placeholder="tagsOf(cardModal.values[cf.key]).length ? '' : (cf.placeholder || '输入后按回车或英文逗号添加')"
                                       @keydown.enter.prevent="cardTagCommit(cf.key, $event.target.value); $event.target.value = ''"
                                       @keydown.,.prevent="cardTagCommit(cf.key, $event.target.value); $event.target.value = ''"
                                       @keydown.backspace="if ($event.target.value === '') { cardTagRemove(cf.key, tagsOf(cardModal.values[cf.key]).length - 1); }">
                            </div>
                        </template>
                        <template x-if="cf.type !== 'tags' && cf.type === 'textarea'">
                            <textarea class="textarea textarea-bordered w-full" :rows="cf.rows || 3"
                                      x-model="cardModal.values[cf.key]"></textarea>
                        </template>
                        <template x-if="cf.type === 'icon'">
                            <div class="flex items-center gap-2">
                                <span class="icon-preview" x-cloak x-show="iconPreviewUrl(cardModal.values[cf.key])">
                                    <img :src="iconPreviewUrl(cardModal.values[cf.key], 40)" alt="">
                                </span>
                                <input type="text" class="input input-bordered w-full" x-model="cardModal.values[cf.key]"
                                       :placeholder="cf.placeholder || ''">
                                <button type="button" class="btn btn-outline shrink-0" @click="openIconPicker({ kind: 'cardModal', cfKey: cf.key })">选择图标</button>
                            </div>
                        </template>
                        <template x-if="cf.type !== 'textarea' && cf.type !== 'icon' && cf.type !== 'tags'">
                            <input type="text" class="input input-bordered w-full" x-model="cardModal.values[cf.key]"
                                   :placeholder="cf.placeholder || ''" @keydown.enter="saveCardEdit()">
                        </template>
                    </label>
                </template>
            </div>
            <p class="mt-2 text-sm text-error" x-show="cardModalError" x-cloak x-text="cardModalError"></p>
            <div class="modal-action">
                <button type="button" class="btn btn-ghost btn-sm" @click="cardModal.open = false">取消</button>
                <button type="button" class="btn btn-primary btn-sm" @click="saveCardEdit()" :disabled="saving">保存</button>
            </div>
        </div>
    </div>

    <!-- 图标选择器：内置图标 / Iconify 搜索 / Icons8 手输 -->
    <div class="modal" :class="{ 'modal-open': iconPicker.open }" x-cloak data-icon-picker
         @keydown.escape.window="iconPicker.open = false">
        <div class="modal-box max-w-xl">
            <h3 class="text-base font-semibold">选择图标</h3>
            <div class="mt-3 flex flex-wrap gap-1.5">
                <button type="button" class="btn btn-xs" :class="iconPicker.mode === 'iconify' ? 'btn-primary' : 'btn-outline'" @click="iconPicker.mode = 'iconify'">Iconify 搜索</button>
                <button type="button" class="btn btn-xs" :class="iconPicker.mode === 'icons8' ? 'btn-primary' : 'btn-outline'" @click="iconPicker.mode = 'icons8'">Icons8</button>
                <button type="button" class="btn btn-xs" :class="iconPicker.mode === 'builtins' ? 'btn-primary' : 'btn-outline'" @click="iconPicker.mode = 'builtins'">内置图标</button>
            </div>

            <!-- Iconify：关键词搜索（浏览器直连 api.iconify.design，仅后台使用；前台图标由服务端缓存为本站文件） -->
            <div x-show="iconPicker.mode === 'iconify'" class="mt-3">
                <div class="flex flex-wrap gap-1.5">
                    <template x-for="pf in ICON_PREFIXES" :key="pf">
                        <button type="button" class="rounded-full border px-2.5 py-1 text-xs transition-colors duration-150"
                                :class="iconPicker.prefix === pf ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-base-300 text-muted'"
                                @click="iconPicker.prefix = pf; searchIcons()" x-text="pf === 'all' ? '全部前缀' : pf"></button>
                    </template>
                </div>
                <input type="text" class="input input-bordered mt-2 w-full" placeholder="搜索图标，如 headset / server / shield"
                       x-model="iconPicker.query" @input.debounce.400ms="searchIcons()">
                <div class="mt-2 text-sm text-muted" x-show="iconPicker.searching">搜索中…</div>
                <div class="mt-2 text-sm text-error" x-show="iconPicker.searchError" x-cloak x-text="iconPicker.searchError"></div>
                <div class="icon-grid mt-2">
                    <template x-for="r in iconPicker.results" :key="r.id">
                        <button type="button" class="icon-cell" @click="applyIcon(r.id)" :title="r.id">
                            <img :src="r.url" alt="" loading="lazy">
                            <span class="w-full truncate text-center" x-text="r.id"></span>
                        </button>
                    </template>
                </div>
            </div>

            <!-- Icons8：输入即过滤下方图标库；列表外代码可直接使用 -->
            <div x-show="iconPicker.mode === 'icons8'" class="mt-3" x-cloak>
                <p class="field-hint">输入关键词过滤下方图标库；输入的词也会作为图标代码（slug）实时预览，列表外代码可直接使用。保存后由服务端缓存为本站 PNG。</p>
                <div class="mt-2 flex items-center gap-2">
                    <span class="icon-preview" x-cloak x-show="iconPicker.icons8Slug">
                        <img :src="'https://img.icons8.com/fluency-systems-filled/40/' + iconPicker.icons8Slug + '.png'" alt=""
                             @error="iconPicker.searchError = '该 slug 不存在或加载失败'">
                    </span>
                    <span class="shrink-0 text-sm text-muted">icons8:</span>
                    <input type="text" class="input input-bordered w-full font-mono text-sm" placeholder="输入关键词过滤，如 server / chart / cloud"
                           x-model="iconPicker.icons8Slug" @input="iconPicker.searchError = ''">
                </div>
                <div class="icon-grid mt-3">
                    <template x-for="slug in icon8Filtered" :key="slug">
                        <button type="button" class="icon-cell" @click="applyIcon('icons8:' + slug)" :title="'icons8:' + slug">
                            <img :src="'https://img.icons8.com/fluency-systems-filled/32/' + slug + '.png'" alt="" loading="lazy">
                            <span class="w-full truncate text-center" x-text="slug"></span>
                        </button>
                    </template>
                </div>
                <p class="field-hint mt-2" x-show="icon8Filtered.length === 0" x-cloak>常用库中无匹配——将直接使用「icons8:<span x-text="iconPicker.icons8Slug"></span>」作为图标代码。</p>
                <button type="button" class="btn btn-primary btn-sm mt-3" x-show="iconPicker.icons8Slug"
                        @click="applyIcon('icons8:' + iconPicker.icons8Slug)">使用该图标</button>
            </div>

            <!-- 内置图标 -->
            <div x-show="iconPicker.mode === 'builtins'" class="mt-3" x-cloak>
                <div class="icon-grid">
                    <template x-for="b in ICON_BUILTINS" :key="b.key">
                        <button type="button" class="icon-cell" @click="applyIcon(b.key)" :title="b.key">
                            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path :d="b.path"></path></svg>
                            <span class="w-full truncate text-center" x-text="b.label"></span>
                        </button>
                    </template>
                    <button type="button" class="icon-cell" @click="applyIcon('')" title="清除自定义图标，回退默认">
                        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
                        <span class="w-full truncate text-center">默认</span>
                    </button>
                </div>
            </div>

            <!-- 手动输入兜底 -->
            <div class="mt-4 border-t border-base-200 pt-3">
                <p class="field-hint">手动输入图标代码（兜底）：内置键 kefu / phone / qq / wechat / link，Iconify 如 mdi:headset，Icons8 如 icons8:headset。</p>
                <div class="mt-2 flex items-center gap-2">
                    <input type="text" class="input input-bordered w-full font-mono text-sm" placeholder="mdi:headset"
                           x-model="iconPicker.manual">
                    <button type="button" class="btn btn-primary btn-sm shrink-0" @click="applyIcon(iconPicker.manual)">应用</button>
                </div>
            </div>

            <div class="modal-action">
                <button type="button" class="btn btn-ghost btn-sm" @click="iconPicker.open = false">取消</button>
            </div>
        </div>
    </div>

    <!-- 提示 -->
    <div id="toast" class="pointer-events-none fixed left-1/2 top-4 z-[60] -translate-x-1/2" x-cloak x-show="toastShow"
         x-transition:enter="ui-transition" x-transition:enter-start="opacity-0 -translate-y-2" x-transition:enter-end="opacity-100 translate-y-0"
         x-transition:leave="ui-transition" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0">
        <div class="alert py-2.5 text-sm shadow-card" :class="toastErr ? 'alert-error' : 'alert-success'">
            <span x-text="toastMsg"></span>
        </div>
    </div>
</div>
<script src="admin.js?v={$ver}"></script>
HTML;
    echo '</body></html>';
}

/* ---------- 路由 ---------- */
$r = isset($_GET['r']) ? (string) $_GET['r'] : '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$admin = load_admin();
if ($r==='setup'){http_response_code(404);exit;}
if ($r==='preview') {
    if(!is_logged_in()){http_response_code(401);exit;}
    $token=(string)($_GET['__theme_preview']??'');$doc=null;
    if(preg_match('/^[a-f0-9]{64}$/D',$token)){$file=$STORE.'/previews/'.$token.'.json';$doc=is_file($file)?json_decode((string)file_get_contents($file),true):null;}
    if(!is_array($doc)||($doc['expires']??0)<time()||(int)($doc['owner_id']??0)!==(int)theme_actor()['id']||!hash_equals((string)($doc['session_hash']??''),CRA1ThemeSecurity::hashToken((string)$_SESSION['security_token']))){http_response_code(410);exit;}
    $GLOBALS['THEME_VERIFIED_PREVIEW']=$doc;session_write_close();require_once __DIR__.'/preview.php';theme_editor_preview($ROOT);exit;
}
/* JSON API */
if (strpos($r,'api.')===0) {
    $action=substr($r,4);$body=read_body();
    if(in_array($action,['auth.login','auth.mfa','auth.captcha'],true))theme_auth_api($action,$body);
    // The old password route uses the same service and cannot bypass step-up.
    if($action==='password')$action='security.password';
    theme_api_guard($action,$body);
    header('Server-Timing: security;dur='.round((hrtime(true)-$THEME_SECURITY_STARTED)/1000000,3));
    if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
    if(strpos($action,'security.')===0||in_array($action,['auth.reauth','logs'],true))theme_security_api($action,$body);

    if (strpos($action,'release.')===0) json_out(\CRA1\Theme\Release\Management::run(substr($action,8),$body));

    if ($action==='announcements.legacy-draft') {
        $store=new \CRA1\Theme\Storage\AnnouncementStore($ROOT);
        $source=$body['source']??'';
        if(!in_array($source,['member','website'],true)||!is_array($body['original']??null)||!is_array($body['values']??null))throw new InvalidArgumentException('旧通知草稿格式不正确');
        $result=[];
        foreach(['original','values'] as $part){
            $value=$body[$part];
            $converted=\CRA1\Theme\Announcements\LegacyMigration::fromValues($source==='website'?$value:[],$source==='member'?['notices'=>$value]:[]);
            $result[$part]=$store->normalize($converted,$converted,false)['items'];
        }
        json_out(['status'=>200,'msg'=>'旧通知草稿已读取','data'=>$result]);
    }
    if ($action==='announcements.preview') {
        $store=new \CRA1\Theme\Storage\AnnouncementStore($ROOT);
        if (!is_array($body['values']??null)) throw new InvalidArgumentException('通知草稿格式不正确');
        $theme=(string)($body['theme']??'');$path=(string)($body['path']??'');
        if(!$store->catalog()->resolve($theme,$path))throw new InvalidArgumentException('请选择有效的预览页面');
        $data=$store->publicPayload($theme,$path,null,$body['values'],true);
        $data['assets']=['css'=>\CRA1\Theme\Release\Assets::url('shared','cra1-shared.css'),'js'=>\CRA1\Theme\Release\Assets::url('shared','announcements-preview.js')];
        json_out(['status'=>200,'msg'=>'success','data'=>$data]);
    }

    if (strpos($action, 'workspace.') === 0) {
        if (!function_exists('add_hook')) { function add_hook($name, $callback) {} }
        require_once $ROOT . '/public/web/cra1/controller/hooks.php';
        $workspace = new ThemeWorkspaceStore($ROOT);
        $body = read_body();
        $sub = substr($action, strlen('workspace.'));
        if ($sub === 'catalog') json_out(['status' => 200, 'msg' => 'success', 'data' => $workspace->catalog()]);
        $domain = (string) ($body['domain'] ?? '');
        if ($sub === 'editor.import' && $domain === 'member') {
            if(isset($body['nodes'])&&!is_array($body['nodes']))throw new InvalidArgumentException('菜单草稿格式不正确');
            json_out($workspace->editorImport((string)($body['mode']??'merge'),$body['nodes']??null,isset($body['shape'])?(int)$body['shape']:null));
        }
        if ($sub === 'editor.get') json_out($workspace->editorGet($domain,(string)($body['editorId']??'')));
        if ($sub === 'editor.save') {
            if(!is_array($body['patch']??null)||!is_array($body['expectedRevisions']??null))throw new InvalidArgumentException('修改内容或版本格式不正确');
            $result=$workspace->editorSave($domain,(string)($body['editorId']??''),$body['expectedRevisions'],$body['patch'],(string)($_SESSION['cra1_admin']??'admin'));
            $partial=$result['status']===200&&isset($result['data']['snapshot_ok'])&&$result['data']['snapshot_ok']===false;
            audit('editor.save',$partial?'partial':($result['status']===200?'ok':'fail'),$domain.':'.(string)($body['editorId']??'').($partial?' snapshot=failed':''));json_out($result);
        }
        if ($sub === 'preview') {
            if(!is_array($body['patch']??[])||!is_array($body['related']??[]))throw new InvalidArgumentException('预览草稿格式不正确');
            json_out($workspace->preview($domain,(string)($body['editorId']??''),$body['patch']??[],$body['related']??[]));
        }
        if ($sub === 'snapshot.rebuild') {
            $result = $workspace->rebuild($domain);
            audit('workspace.snapshot.rebuild', 'ok', $domain);
            json_out($result);
        }
        $scopeId = (string) ($body['scopeId'] ?? '');
        if ($sub === 'get') json_out($workspace->get($domain, $scopeId));
        if ($sub === 'save') {
            if (!is_array($body['patch'] ?? null)) throw new InvalidArgumentException('修改内容格式不正确');
            $result = $workspace->save($domain, $scopeId, (string) ($body['expectedRevision'] ?? ''),
                $body['patch'], (string) ($_SESSION['cra1_admin'] ?? 'admin'));
            $partial = $result['status'] === 200 && isset($result['data']['snapshot_ok']) && $result['data']['snapshot_ok'] === false;
            audit('workspace.save', $partial ? 'partial' : ($result['status'] === 200 ? 'ok' : 'fail'), $domain . ':' . $scopeId . ($partial ? ' snapshot=failed' : ''));
            json_out($result);
        }
        json_out(['status' => 404, 'msg' => '未知工作区接口'], 404);
    }

    if (strpos($action,'media.')===0) {
        require_once __DIR__.'/media_store.php';
        $sub=substr($action,6);if(!in_array($sub,['list','attachments','upload','rename','delete','restore'],true))throw new InvalidArgumentException('未知图片操作');
        json_out(theme_admin_media($ROOT,$sub));
    }

    if ($action === 'get') {
        json_out(['status' => 200, 'msg' => 'success', 'data' => config_resolved(),
            'meta' => ['revision' => theme_workspace_revision(theme_admin_read_config()), 'updated_at' => is_file($CONFIG_FILE) ? filemtime($CONFIG_FILE) : 0]]);
    }

    /* ---------- 商品清单（供「导入商品」选择器使用） ----------
       只读、需登录（与其他 api.* 同一鉴权）。直连数据库读取商品与其两级分组，
       供后台按「二级分组 → 商品」的树形结构挑选与排序。
       不调用 /console/v1 接口：那是会员中心前台接口，后台会话不被其认可。 */
    if ($action === 'products') {
        $list = [];
        try {
            // 连接参数取自站点根目录的 config.php（纯 define()，不含框架引导，
            // 引入安全）。本后台是独立入口、不引导 v10 框架，因此 DATABASE_* 常量
            // 默认未定义——直接用会得到字面量字符串（getaddrinfo failed / Unknown character set）。
            $siteCfg = $ROOT . '/config.php';
            if (is_file($siteCfg)) {
                require_once $siteCfg;
            }
            if (!defined('DATABASE_HOSTNAME')) {
                json_out(['status' => 500, 'msg' => '读取商品失败：缺少数据库配置（config.php）']);
            }
            $db = new PDO(
                'mysql:host=' . DATABASE_HOSTNAME
                . ';port=' . (defined('DATABASE_PORT') ? DATABASE_PORT : 3306)
                . ';dbname=' . DATABASE_NAME
                . ';charset=' . (defined('DATABASE_CHARSET') ? DATABASE_CHARSET : 'utf8mb4'),
                DATABASE_USERNAME,
                DATABASE_PASSWORD,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT]
            );
            // 两级分组：parent_id=0 为一级，其余挂在某个一级下
            $groups = [];
            foreach ($db->query('SELECT id, name, parent_id FROM idcsmart_product_group') as $g) {
                $groups[(int) $g['id']] = [
                    'id'     => (int) $g['id'],
                    'name'   => (string) $g['name'],
                    'parent' => (int) $g['parent_id'],
                ];
            }
            $sql = 'SELECT id, name, price, cycle, pay_type, product_group_id, hidden FROM idcsmart_product WHERE hidden = 0 ORDER BY `order` ASC, id ASC';
            foreach ($db->query($sql) as $p) {
                $g2 = (int) $p['product_group_id'];
                $g2row = $groups[$g2] ?? null;
                // 一级分组：分组自身即一级时 parent=0，否则取它的父级
                $g1row = null;
                if ($g2row) {
                    $g1row = $g2row['parent'] > 0 ? ($groups[$g2row['parent']] ?? null) : $g2row;
                }
                $list[] = [
                    'id'       => (int) $p['id'],
                    'name'     => (string) $p['name'],
                    'price'    => (string) $p['price'],
                    'cycle'    => (string) $p['cycle'],
                    'pay_type' => (string) $p['pay_type'],
                    'g1'       => $g1row ? (string) $g1row['name'] : '',
                    'g1id'     => $g1row ? (int) $g1row['id'] : 0,
                    'g2'       => $g2row ? (string) $g2row['name'] : '',
                    'g2id'     => $g2row ? (int) $g2row['id'] : 0,
                ];
            }
        } catch (Throwable $e) {
            json_out(['status' => 500, 'msg' => '读取商品失败：' . $e->getMessage()]);
        }
        json_out(['status' => 200, 'msg' => 'success', 'data' => ['list' => $list]]);
    }

    $body = read_body();

    if ($action === 'save') {
        $res = config_save(is_array($body) ? $body : []);
        audit('save', $res['status'] === 200 ? 'ok' : 'fail', (string) count($body));
        json_out($res);
    }
    /* ---------- SEO 元信息（专用 API：按页覆盖 title/desc/kw，全局字段走普通保存） ---------- */
    if (strpos($action, 'seo') === 0 && is_file(__DIR__ . '/../web/cra1/controller/SeoRegistry.php')) {
        require_once __DIR__ . '/../web/cra1/controller/PageModuleRegistry.php';
        require_once __DIR__ . '/../web/cra1/controller/SeoRegistry.php';
        $sub = substr($action, strlen('seo.'));

        if ($sub === 'get') {
            $stored = theme_admin_read_config();
            $raw = cra1_seo_page_meta_raw(is_array($stored) ? (string) ($stored['seo_page_meta_json'] ?? '') : '');
            $pages = is_array($raw['pages'] ?? null) ? $raw['pages'] : [];
            $cfg = config_resolved();
            $mf = cra1_page_module_manifest();
            $out = [];
            foreach (cra1_seo_registry() as $pk => $meta) {
                if (!empty($meta['aliasOf'])) {
                    continue;
                }
                $route = (string) ($mf[$pk]['route'] ?? '');
                $label = (string) ($mf[$pk]['label'] ?? $pk);
                $resolved = cra1_seo_resolve_page($pk, $cfg, $pages);
                $out[$pk] = [
                    'label' => $label,
                    'route' => $route,
                    'isDetail' => !empty($meta['isDetail']),
                    'noindexDefault' => !empty($meta['noindex']),
                    'defaultTitle' => (string) ($meta['title'] ?? ''),
                    'defaultDesc' => (string) ($meta['description'] ?? ''),
                    'defaultKw' => (string) ($meta['keywords'] ?? ''),
                    'override' => (isset($pages[$pk]) && is_array($pages[$pk])) ? [
                        'title' => (string) ($pages[$pk]['title'] ?? ''),
                        'desc' => (string) ($pages[$pk]['desc'] ?? ''),
                        'kw' => (string) ($pages[$pk]['kw'] ?? ''),
                        'noindex' => !empty($pages[$pk]['noindex']),
                    ] : null,
                    'resolvedTitle' => (string) ($resolved['titleFull'] ?? ''),
                    'resolvedDesc' => (string) ($resolved['description'] ?? ''),
                    'resolvedKw' => (string) ($resolved['keywords'] ?? ''),
                    'resolvedNoindex' => !empty($resolved['noindex']),
                ];
            }
            json_out(['status' => 200, 'msg' => 'success', 'data' => ['pages' => $out, 'revision' => cra1_page_layout_revision($pages)]]);
        }

        if ($sub === 'save') {
            $pageKey = trim((string) ($body['pageKey'] ?? ''));
            $reg = cra1_seo_registry();
            if ($pageKey === '' || !isset($reg[$pageKey]) || !empty($reg[$pageKey]['aliasOf'])) {
                json_out(['status' => 400, 'msg' => '未知页面']);
            }
            $clean = [];
            foreach (['title', 'desc', 'kw'] as $k) {
                $v = trim((string) ($body[$k] ?? ''));
                if ($v !== '') {
                    $clean[$k] = mb_substr($v, 0, 300);
                }
            }
            if (!empty($body['noindex'])) {
                $clean['noindex'] = true;
            }
            $lock = fopen($CONFIG_FILE . '.lock', 'c');
            if (!$lock) { json_out(['status' => 400, 'msg' => '存储锁不可用']); }
            flock($lock, LOCK_EX);
            $decoded = theme_admin_read_config();
            if (!is_array($decoded)) { $decoded = []; }
            $pages = [];
            $old = json_decode((string) ($decoded['seo_page_meta_json'] ?? ''), true);
            if (is_array($old) && isset($old['pages']) && is_array($old['pages'])) { $pages = $old['pages']; }
            if (array_key_exists('expectedRevision', $body)) {
                $rev = cra1_page_layout_revision($pages);
                if ((string) $body['expectedRevision'] !== $rev) {
                    flock($lock, LOCK_UN); fclose($lock);
                    json_out(['status' => 409, 'msg' => 'SEO 配置已被其他会话修改，请刷新后重试', 'data' => ['revision' => $rev]]);
                }
            }
            if ($clean) { $pages[$pageKey] = $clean; } else { unset($pages[$pageKey]); }
            $decoded['seo_page_meta_json'] = json_encode(['schema' => 1, 'pages' => (object) $pages], JSON_UNESCAPED_SLASHES);
            $ok = atomic_write($CONFIG_FILE, (string) json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            flock($lock, LOCK_UN); fclose($lock);
            if (!$ok) { json_out(['status' => 400, 'msg' => '保存失败：存储文件不可写']); }
            cra1_layout_audit('seo-save', 'ok', 'pageKey=' . $pageKey);
            json_out(['status' => 200, 'msg' => '已保存，前台已生效', 'data' => ['pageKey' => $pageKey, 'override' => $clean ?: null, 'revision' => cra1_page_layout_revision($pages)]]);
        }

        json_out(['status' => 404, 'msg' => '未知 SEO 接口'], 404);
    }

    /* ---------- 主题页面清单（只读）：前台主题自带的页面，按分类分组 ----------
       数据源是服务端单一真相：云页面模块 manifest（route/label/sortKey）
       + SEO 注册表（title/description），不另维护第二份页面清单。
       因此前台新增页面时，只要进了 manifest/SEO 注册表，本清单自动跟随。 */
    if ($action === 'site-pages') {
        if (!is_file(__DIR__ . '/../web/cra1/controller/PageModuleRegistry.php')) {
            json_out(['status' => 400, 'msg' => '页面注册表不可用']);
        }
        require_once __DIR__ . '/../web/cra1/controller/PageModuleRegistry.php';
        require_once __DIR__ . '/../web/cra1/controller/SeoRegistry.php';

        $mf  = cra1_page_module_manifest();
        $seo = cra1_seo_registry();

        /**
         * sortKey → 分类显示名与顺序。
         * 数组顺序即侧栏分类顺序（同名分类自动合并到首次出现的位置）。
         * 未登记的 sortKey 落到「其它页面」，保证新页面上线即可见、不需要改这里。
         */
        $famOrder = [
            'home.v1'               => '首页与总览',
            'product.detail.v1'     => '产品页面',
            'solution.overview.v1'  => '解决方案',
            'solution.industry.v1'  => '行业方案',
            'content.list.v1'       => '内容列表',
            'content.detail.v1'     => '内容详情',
            'document.center.v1'    => '文档中心',
            'document.search.v1'    => '文档中心',
            'partner.v1'            => '合作伙伴',
            'about.v1'              => '关于与联系',
            'contact.v1'            => '关于与联系',
            'recruit.v1'            => '关于与联系',
            'feedback.v1'           => '服务与支持',
            'activities.v1'         => '服务与支持',
            'service.guarantee.v1'  => '服务与支持',
            'news.classify.v1'      => '内容列表',
            'error.404.v1'          => '其它页面',
        ];

        $groups = [];
        foreach ($seo as $pk => $meta) {
            if (!empty($meta['aliasOf'])) {
                continue;   // 旧地址跳转页不作为可打开页面列出
            }
            $route = (string) ($mf[$pk]['route'] ?? '');
            if ($route === '') {
                continue;   // 没有真实路由的条目不展示
            }
            $label = (string) ($mf[$pk]['label'] ?? '');
            if ($label === '') {
                $label = (string) ($meta['title'] ?? $pk);
            }
            $sortKey = (string) ($mf[$pk]['sortKey'] ?? '');
            $family  = $famOrder[$sortKey] ?? '其它页面';

            // 分类前缀（如「产品 · 云服务器」）已在分类维度体现，标题里去掉以免重复
            $title = $label;
            if (strpos($label, ' · ') !== false) {
                $parts = explode(' · ', $label, 2);
                if (isset($parts[1]) && $parts[1] !== '') {
                    $title = $parts[1];
                }
            }

            $groups[$family][] = [
                'key'         => (string) $pk,
                'title'       => $title,
                'description' => (string) ($meta['description'] ?? ''),
                'route'       => $route,
                'isDetail'    => !empty($meta['isDetail']),
            ];
        }

        // 分类顺序：先按登记顺序，未登记的分类排到末尾
        $ordered = [];
        foreach ($famOrder as $family) {
            if (isset($groups[$family]) && !isset($ordered[$family])) {
                $ordered[$family] = $groups[$family];
            }
        }
        foreach ($groups as $family => $items) {
            if (!isset($ordered[$family])) {
                $ordered[$family] = $items;
            }
        }

        $out = [];
        $total = 0;
        foreach ($ordered as $family => $items) {
            usort($items, static function ($a, $b) {
                return strcmp($a['title'], $b['title']);
            });
            $total += count($items);
            $out[] = ['group' => $family, 'pages' => $items];
        }

        json_out(['status' => 200, 'msg' => 'success', 'data' => ['groups' => $out, 'total' => $total]]);
    }

    /** 服务端请求站内接口（返回 JSON 数组；失败返回空数组） */
    if (!function_exists('cra1admin_get_json')) {
        function cra1admin_get_json(string $path): array
        {
            $url = 'http://127.0.0.1' . $path;
            $ctx = stream_context_create(['http' => ['timeout' => 8, 'header' => "Host: " . ($_SERVER['HTTP_HOST'] ?? 'localhost') . "\r\n"]]);
            $raw = @file_get_contents($url, false, $ctx);
            if (!is_string($raw) || $raw === '') {
                return [];
            }
            $d = json_decode($raw, true);
            return is_array($d) ? $d : [];
        }
    }

    /* ---------- 菜单链接候选（主题页面 + v10 商品）：供后台「菜单导航」链接选择器 ---------- */
    if ($action === 'link-options') {
        require_once __DIR__ . '/../web/cra1/controller/PageModuleRegistry.php';
        $pages = [];
        foreach (cra1_page_module_manifest() as $pk => $p) {
            if (isset($p['aliasOf'])) {
                continue;
            }
            $route = (string) ($p['route'] ?? '');
            if ($route === '') {
                continue;
            }
            $pages[] = ['url' => $route, 'label' => (string) ($p['label'] ?? $pk)];
        }
        // 系统常用入口（非主题页面）
        $extra = [
            ['url' => '/cart/goodsList.htm', 'label' => '商品列表'],
            ['url' => '/home.htm', 'label' => '会员中心首页'],
            ['url' => '/finance.htm', 'label' => '我的订单'],
            ['url' => '/account.htm', 'label' => '账户信息'],
            ['url' => '/cart/shoppingCar.htm', 'label' => '购物车'],
        ];
        json_out(['status' => 200, 'msg' => 'success', 'data' => ['pages' => array_merge($pages, $extra)]]);
    }

    /* Icon suite v2: zero-network local reads; online is always explicit. */
    if (in_array($action, ['icons.catalog','icons.page','icon-search','icons.resolve','icons.preview','icons.apply'], true)) {
        require_once __DIR__.'/../cra1-shared/icons.php';
        $started=microtime(true);
        // Authentication and CSRF have completed. External waits cannot hold the session.
        if (session_status()===PHP_SESSION_ACTIVE) session_write_close();
        if ($action==='icons.catalog') {
            $catalog=cra1_icons_data('catalog');
            if ((int)($body['version']??1)>=2) {
                $prefix=(string)($body['category']??'builtin');
                if(!in_array($prefix,array_column($catalog['categories']??[],'key'),true))$prefix='builtin';
                $page=cra1_icons_page($prefix,0,60);
                $out=$catalog+['initial'=>$page,'presets'=>cra1_icons_presets()];
            } else {
                $out=$catalog;
                foreach($out['categories'] as &$cat) $cat['hot']=cra1_icons_page($cat['key'],0,60)['icons'];unset($cat);
            }
        } elseif ($action==='icons.page') {
            $out=cra1_icons_page((string)($body['prefix']??''),max(0,(int)($body['page']??0)),min(60,max(1,(int)($body['per']??60))));
        } elseif ($action==='icon-search') {
            $source=(string)($body['source']??'local');
            $out=$source==='online'?cra1_icons_online_search(trim((string)($body['q']??''))):cra1_icons_search((string)($body['q']??''),(string)($body['prefix']??''),(string)($body['preferred']??''));
        } elseif ($action==='icons.resolve') {
            $items=$body['items']??[];if(!is_array($items)||count($items)>100)throw new InvalidArgumentException('每次最多解析一百个图标');
            $resolved=[];foreach($items as $it){if(!is_array($it))throw new InvalidArgumentException('图标参数格式不正确');$resolved[]=cra1_icons_resolve((string)($it['value']??''),(string)($it['context']??'website'),(string)($it['default']??''));}
            $out=['version'=>cra1_icons_version(),'icons'=>$resolved];
        } elseif ($action==='icons.preview') {
            $out=['version'=>cra1_icons_version(),'icons'=>cra1_icons_online_previews((array)($body['ids']??[]))];
        } else {
            $d=cra1_icons_import((string)($body['value']??''));if(empty($d['available']))throw new InvalidArgumentException('图标不可用');$out=['version'=>cra1_icons_version(),'icon'=>$d];
        }
        header('Server-Timing: icons;dur='.round((microtime(true)-$started)*1000,2));
        json_out(['status'=>200,'msg'=>'success','data'=>$out]);
    }

    /* ---------- 主题自带图标清单（供后台图标选择器「点选」） ----------
       单一真相是主题的 cra1_builtin_icons()（键 + 名称 + SVG）。
       这里额外给出每个图标的**可直接用于 <img> 的预览 URL**：
       走后端既有的 cra1_icon_url() 落盘逻辑，因此后台预览与前台显示同一份文件。 */
    if ($action === 'icons') {
        // 只引图标库与图标 URL 助手：hooks.php 在框架环境下已加载过，
        // 移动后台再 require 一次会因函数重复声明 / 钩子重复注册而 500。
        require_once __DIR__ . '/../web/cra1/controller/BuiltinIcons.php';
        require_once __DIR__ . '/icon_url_helper.php';
        $out = [];
        foreach (cra1_builtin_icons() as $key => $def) {
            $out[] = [
                'key'      => (string) $key,
                'label'    => (string) ($def['label'] ?? $key),
                'keywords' => (string) ($def['keywords'] ?? ''),
                'url'      => (string) cra1admin_icon_preview_url($key),
            ];
        }
        json_out(['status' => 200, 'msg' => 'success', 'data' => ['icons' => $out]]);
    }

    // Shared read-only projection: exactly the category/product tree used by the website.
    if ($action === 'navigation-catalog') {
        if (!function_exists('add_hook')) { function add_hook($name, $callback) {} }
        require_once $ROOT . '/public/web/cra1/controller/hooks.php';
        $rows = cra1_menu_catalog_rows();
        json_out(['status' => 200, 'msg' => 'success', 'data' => [
            'catalog' => cra1_menu_catalog_tree($rows['groups'], $rows['products']), 'error' => $rows['error'],
        ]]);
    }

    /* ---------- v10 商品分组与商品（供菜单链接选择器「快速选择商品」） ---------- */
    if ($action === 'product-options') {
        $catalog=(new MemberCenterStore($ROOT.'/runtime'))->visualCatalog();
        if(!empty($catalog['error']))json_out(['status'=>400,'msg'=>$catalog['error']]);
        $body=read_body();
        if(isset($body['limit'])){$offset=max(0,(int)($body['offset']??0));$limit=min(200,max(1,(int)$body['limit']));$catalog['total']=count($catalog['products']);$catalog['products']=array_slice($catalog['products'],$offset,$limit);}
        json_out(['status'=>200,'msg'=>'success','data'=>$catalog]);
    }

    /* ---------- 页面模块布局（专用 API：按 sortKey 增量保存，与普通字段保存共用存储与锁） ---------- */
    if (strpos($action, 'page-layout') === 0 && is_file(__DIR__ . '/../web/cra1/controller/PageModuleRegistry.php')) {
        require_once __DIR__ . '/../web/cra1/controller/PageModuleRegistry.php';
        $sub = substr($action, strlen('page-layout.'));

        if ($sub === 'get') {
            $stored = theme_admin_read_config();
            $raw = cra1_page_layout_raw(is_array($stored) ? (string) ($stored['page_module_orders_json'] ?? '') : '');
            $pages = is_array($raw['pages'] ?? null) ? $raw['pages'] : [];
            $out = [];
            foreach (cra1_page_module_manifest() as $pk => $p) {
                if (isset($p['aliasOf'])) {
                    $out[$pk] = ['label' => $p['label'], 'route' => $p['route'], 'aliasOf' => $p['aliasOf']];
                    continue;
                }
                $ids = [];
                foreach ($p['modules'] as $m) { $ids[] = $m['id']; }
                $out[$pk] = [
                    'label' => $p['label'], 'route' => $p['route'], 'sortKey' => $p['sortKey'],
                    'heroLabel' => $p['heroLabel'],
                    'modules' => $p['modules'], 'defaultOrder' => $ids,
                    'currentOrder' => cra1_page_module_order($pk, $raw),
                ];
            }
            json_out(['status' => 200, 'msg' => 'success', 'data' => [
                'manifest' => $out,
                'pages' => (object) $pages,
                'revision' => cra1_page_layout_revision($pages),
            ]]);
        }

        if ($sub === 'save') {
            $sortKey = trim((string) ($body['sortKey'] ?? ''));
            $order = is_array($body['order'] ?? null) ? $body['order'] : null;
            if ($sortKey === '' || $order === null) {
                json_out(['status' => 400, 'msg' => '缺少 sortKey 或 order']);
            }
            // sortKey 必须来自 manifest
            $known = [];
            foreach (cra1_page_module_manifest() as $p) {
                if (!isset($p['aliasOf'])) $known[$p['sortKey']] = true;
            }
            if (!isset($known[$sortKey])) {
                json_out(['status' => 400, 'msg' => '未知的页面家族']);
            }
            // 至少一个成员页面用于白名单校验
            $anyPage = null;
            foreach (cra1_page_module_manifest() as $pk => $p) {
                if (!isset($p['aliasOf']) && $p['sortKey'] === $sortKey) { $anyPage = $pk; break; }
            }
            $clean = cra1_normalize_page_order($anyPage, $order);

            $lockFile = $CONFIG_FILE . '.lock';
            $lock = fopen($lockFile, 'c');
            if (!$lock) { json_out(['status' => 400, 'msg' => '存储锁不可用']); }
            flock($lock, LOCK_EX);
            $decoded = theme_admin_read_config();
            if (!is_array($decoded)) { $decoded = []; }
            $current = [];
            $rawOld = (string) ($decoded['page_module_orders_json'] ?? '');
            $oldDoc = json_decode($rawOld, true);
            if (is_array($oldDoc) && isset($oldDoc['pages']) && is_array($oldDoc['pages'])) {
                $current = $oldDoc['pages'];
            }
            if (array_key_exists('expectedRevision', $body)) {
                $rev = cra1_page_layout_revision($current);
                if ((string) $body['expectedRevision'] !== $rev) {
                    flock($lock, LOCK_UN); fclose($lock);
                    json_out(['status' => 409, 'msg' => '布局已被其他会话修改，请刷新后重试', 'data' => ['revision' => $rev]]);
                }
            }
            $current[$sortKey] = $clean;
            $affected = [];
            foreach (cra1_page_module_manifest() as $pk => $p) {
                if (!isset($p['aliasOf']) && $p['sortKey'] === $sortKey) { $affected[] = $pk; }
            }
            $oldDoc = is_array($oldDoc) ? $oldDoc : [];
            $oldDoc['schema'] = isset($oldDoc['pageOverrides']) ? 2 : 1;
            $oldDoc['pages'] = (object) $current;
            $decoded['page_module_orders_json'] = json_encode($oldDoc, JSON_UNESCAPED_SLASHES);
            $ok = atomic_write($CONFIG_FILE, (string) json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            flock($lock, LOCK_UN); fclose($lock);
            if (!$ok) { json_out(['status' => 400, 'msg' => '保存失败：存储文件不可写']); }
            cra1_layout_audit('save', 'ok', 'sortKey=' . $sortKey . ' pages=' . count($affected));
            json_out(['status' => 200, 'msg' => '布局已保存，前台已生效', 'data' => [
                'sortKey' => $sortKey, 'order' => $clean,
                'affectedPageKeys' => $affected,
                'revision' => cra1_page_layout_revision($current),
            ]]);
        }

        if ($sub === 'reset') {
            $sortKey = trim((string) ($body['sortKey'] ?? ''));
            $known = [];
            foreach (cra1_page_module_manifest() as $p) {
                if (!isset($p['aliasOf'])) $known[$p['sortKey']] = true;
            }
            if ($sortKey === '' || !isset($known[$sortKey])) {
                json_out(['status' => 400, 'msg' => '未知的页面家族']);
            }
            $lockFile = $CONFIG_FILE . '.lock';
            $lock = fopen($lockFile, 'c');
            if (!$lock) { json_out(['status' => 400, 'msg' => '存储锁不可用']); }
            flock($lock, LOCK_EX);
            $decoded = theme_admin_read_config();
            if (!is_array($decoded)) { $decoded = []; }
            $current = [];
            $oldDoc = json_decode((string) ($decoded['page_module_orders_json'] ?? ''), true);
            if (is_array($oldDoc) && isset($oldDoc['pages']) && is_array($oldDoc['pages'])) {
                $current = $oldDoc['pages'];
            }
            unset($current[$sortKey]);
            $oldDoc = is_array($oldDoc) ? $oldDoc : [];
            $oldDoc['schema'] = isset($oldDoc['pageOverrides']) ? 2 : 1;
            $oldDoc['pages'] = (object) $current;
            $decoded['page_module_orders_json'] = json_encode($oldDoc, JSON_UNESCAPED_SLASHES);
            $ok = atomic_write($CONFIG_FILE, (string) json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            flock($lock, LOCK_UN); fclose($lock);
            cra1_layout_audit('reset', $ok ? 'ok' : 'fail', 'sortKey=' . $sortKey);
            json_out($ok ? ['status' => 200, 'msg' => '已恢复该家族默认顺序', 'data' => ['revision' => cra1_page_layout_revision($current)]]
                         : ['status' => 400, 'msg' => '操作失败：存储文件不可写']);
        }

        json_out(['status' => 404, 'msg' => '未知布局接口'], 404);
    }

    if ($action === 'reset') {
        global $CONFIG_FILE;
        $tomb = [];
        foreach (\template\cra1\controller\Cra1::defaults() as $k => $v) { if(!in_array($k,['custom_css','custom_js','custom_css_enabled','custom_js_enabled'],true))$tomb[$k] = ''; }
        $result = config_patch_write($tomb);
        $ok = $result['status'] === 200;
        audit('reset', $ok ? 'ok' : 'fail');
        json_out($ok ? ['status' => 200, 'msg' => '已恢复默认'] : $result);
    }
    if ($action === 'logout') {
        theme_security()->revoke((int)theme_actor()['id'],CRA1ThemeSecurity::hashToken((string)$_SESSION['security_token']));
        if(session_status()!==PHP_SESSION_ACTIVE)session_start();
        $_SESSION = [];
        session_destroy();
        session_write_close();
        json_out(['status' => 200, 'msg' => '已退出']);
    }
    if ($action === 'path') {
        $newPath = strtolower(trim((string) ($body['new_path'] ?? '')));
        if (!preg_match('/^[a-z0-9]{6,32}$/', $newPath)) {
            json_out(['status' => 400, 'msg' => '路径需为 6-32 位小写字母或数字']);
        }
        if ($newPath === $SLUG) {
            json_out(['status' => 400, 'msg' => '新路径与当前路径相同']);
        }
        $target = dirname(__DIR__) . '/' . $newPath;
        if (file_exists($target)) {
            json_out(['status' => 400, 'msg' => '目标目录已存在，请换一个路径']);
        }
        if (!@rename(__DIR__, $target)) {
            audit('path', 'fail', $newPath);
            json_out(['status' => 400, 'msg' => '路径修改失败：目录不可写或被占用']);
        }
        $entryRecord = is_file($ENTRY_FILE) ? json_decode((string) file_get_contents($ENTRY_FILE), true) : [];
        if (!is_array($entryRecord)) $entryRecord = [];
        $entryRecord['entry'] = $newPath;
        $entryRecord['updated_at'] = time();
        if (!atomic_write($ENTRY_FILE, (string) json_encode($entryRecord, JSON_UNESCAPED_SLASHES))) {
            $restored = @rename($target, __DIR__);
            audit('path', 'fail', '入口记录写入失败；目录' . ($restored ? '已恢复' : '恢复失败：' . $newPath));
            json_out(['status' => 400, 'msg' => $restored
                ? '入口记录保存失败，后台目录已恢复，请检查存储权限'
                : '入口记录保存失败，后台目录已移至 /' . $newPath . '，请修复存储权限后更新入口记录']);
        }
        theme_security()->db->prepare('UPDATE sessions SET revoked_at=? WHERE revoked_at=0')->execute([time()]);
        if(session_status()!==PHP_SESSION_ACTIVE)session_start();
        $_SESSION = [];
        session_destroy();
        session_write_close();
        json_out([
            'status' => 200,
            'msg'    => '后台路径已更新，请使用新地址重新登录',
            'data'   => ['url' => '/' . $newPath . '/index.php'],
        ]);
    }
    /* ---------- 会员中心主题控制（与官网控制独立存储） ---------- */
    if (strpos($action, 'member.') === 0) {
        $member = new MemberCenterStore($ROOT . '/runtime');
        $sub    = substr($action, 7);   // 去掉 "member."
        $operator = (string) ($_SESSION['cra1_admin'] ?? 'admin');
        $body   = read_body();

        if ($sub === 'get') {
            // 打开后台即完成一次性分组树迁移（旧两级 → 一级分组/菜单/页面），
            // 幂等：已迁移（shape=3）时原样返回
            $migrated = $member->read();
            json_out([
                'status' => 200,
                'msg'    => 'success',
                'data'   => [
                    'config'    => $migrated,
                    'defaults'  => MemberCenterStore::defaults(),
                    'has_store' => $member->exists(),
                ],
            ]);
        }

        if ($sub === 'catalog') {
            $catalog = $member->readSystemCatalog();
            json_out([
                'status' => 200,
                'msg'    => 'success',
                'data'   => [
                    'catalog' => $catalog,
                    'diff'    => $catalog['error'] === '' ? $member->diff($catalog) : null,
                ],
            ]);
        }

        if ($sub === 'import') {
            $catalog = $member->readSystemCatalog();
            if ($catalog['error'] !== '') {
                json_out(['status' => 400, 'msg' => $catalog['error']]);
            }
            $mode = (string) ($body['mode'] ?? 'first');
            $nodes = $member->importFromSystem($catalog);

            $cur = $member->read();
            $added = 0;
            if (isset($body['expectedRevision'])) {
                $actual = theme_workspace_revision(['sidebar' => $cur['sidebar']]);
                if (!hash_equals($actual, (string) $body['expectedRevision'])) {
                    json_out(['status' => 409, 'msg' => '菜单已被其他会话修改，草稿已保留',
                        'data' => ['values' => ['sidebar' => $cur['sidebar']], 'revision' => $actual, 'version' => $cur['version']]]);
                }
            }
            if ((int) ($cur['sidebar']['shape'] ?? 2) >= 3) {
                $incoming = $member->wrapImportUnderServiceGroup($nodes, ['sidebar' => ['nodes' => []]]);
                if ($mode === 'merge') {
                    $nodes = $member->mergeImported($cur['sidebar']['nodes'] ?? [], $incoming, $added);
                } else {
                    $keep = array_values(array_filter($cur['sidebar']['nodes'] ?? [], static function ($n) { return ($n['label'] ?? '') !== '产品与服务'; }));
                    $nodes = $member->mergeImported($keep, $incoming, $added);
                }
            } elseif ($mode === 'merge') {
                $nodes = $member->mergeImported($cur['sidebar']['nodes'] ?? [], $nodes, $added);
            } else {
                $counter = function (array $list) use (&$counter): int { $n = 0; foreach ($list as $node) $n += 1 + $counter($node['children'] ?? []); return $n; };
                $added = $counter($nodes);
            }
            if ($mode === 'merge' && $added === 0) {
                json_out(['status' => 200, 'msg' => '没有新增菜单，配置版本保持不变',
                    'data' => ['config' => $cur, 'added' => 0, 'skipped' => count($catalog['navs'] ?? []), 'failed' => 0]]);
            }

            $errors = $member->validateTree($nodes, (int) ($cur['sidebar']['shape'] ?? 2) >= 3);
            if ($errors) {
                json_out(['status' => 400, 'msg' => implode('；', array_slice($errors, 0, 5))]);
            }

            $res = $member->save([
                'sidebar' => ['version' => (int) ($cur['sidebar']['version'] ?? 1) + 1,
                              'imported_at' => time(), 'shape' => (int) ($cur['sidebar']['shape'] ?? 2),
                              'nodes' => $nodes],
            ], $operator, isset($body['expectedRevision']) ? (int) $cur['version'] : (int) ($body['version'] ?? $cur['version']));
            $res['data']['added'] = $added;
            $res['data']['skipped'] = max(0, count($catalog['navs'] ?? []) - $added);
            $res['data']['failed'] = 0;
            audit('member.import', $res['status'] === 200 ? 'ok' : 'fail', 'mode=' . $mode);
            json_out($res);
        }

        if ($sub === 'sidebar.save') {
            $nodes = is_array($body['nodes'] ?? null) ? $body['nodes'] : null;
            if ($nodes === null) {
                json_out(['status' => 400, 'msg' => '缺少 nodes']);
            }
            $cur = $member->read();
            $errors = $member->validateTree($nodes, (int) ($cur['sidebar']['shape'] ?? 2) >= 3);
            if ($errors) {
                json_out(['status' => 400, 'msg' => implode('；', array_slice($errors, 0, 5))]);
            }
            $patch = [
                'version'     => (int) ($cur['sidebar']['version'] ?? 1) + 1,
                'imported_at' => (int) ($cur['sidebar']['imported_at'] ?? 0),
                'shape'       => (int) ($cur['sidebar']['shape'] ?? 2),
                'nodes'       => $nodes,
            ];
            // 最近访问设置（随菜单结构一起提交；未提交时存储层沿用当前值）
            if (array_key_exists('recent', $body)) {
                $patch['recent'] = is_array($body['recent']) ? $body['recent'] : [];
            }
            $res = $member->save(['sidebar' => $patch], $operator, (int) ($body['version'] ?? 0));
            audit('member.sidebar.save', $res['status'] === 200 ? 'ok' : 'fail', 'nodes=' . count($nodes));
            json_out($res);
        }

        if ($sub === 'appearance.save') {
            $app = is_array($body['appearance'] ?? null) ? $body['appearance'] : [];
            $res = $member->save(['appearance' => $app], $operator, (int) ($body['version'] ?? 0));
            audit('member.appearance.save', $res['status'] === 200 ? 'ok' : 'fail');
            json_out($res);
        }

        /* ---------- 会员中心内容设置（页面文案 / 公告轮播 / 置顶公告） ---------- */
        if ($sub === 'content.get') {
            $cur = $member->read();
            json_out([
                'status' => 200,
                'msg'    => 'success',
                'data'   => [
                    'content'  => $cur['content'],
                    'version'  => (int) $cur['version'],
                    'defaults' => MemberCenterStore::defaults()['content'],
                ],
            ]);
        }

        if ($sub === 'content.catalog') {
            // 新闻/公告插件与分类目录：只读，不引导 ThinkPHP、不写任何系统表
            $catalog = $member->readContentCatalog();
            json_out([
                'status' => 200,
                'msg'    => 'success',
                'data'   => [
                    'catalog' => $catalog,
                ],
            ]);
        }

        if ($sub === 'ticket.catalog') {
            // 工单部门（插件工单类型）目录：只读，供「工单提交助手」配置选择
            $catalog = $member->readTicketTypeCatalog();
            json_out(['status' => 200, 'msg' => 'success', 'data' => $catalog]);
        }

        if ($sub === 'content.save') {
            $content = is_array($body['content'] ?? null) ? $body['content'] : null;
            if ($content === null) {
                json_out(['status' => 400, 'msg' => '缺少 content']);
            }
            $res = $member->save(['content' => $content], $operator, (int) ($body['version'] ?? 0));
            audit('member.content.save', $res['status'] === 200 ? 'ok' : 'fail');
            json_out($res);
        }

        if ($sub === 'reset') {
            $res = $member->reset($operator);
            audit('member.reset', $res['status'] === 200 ? 'ok' : 'fail');
            json_out($res);
        }

        json_out(['status' => 404, 'msg' => '未知会员中心接口'], 404);
    }

    /* ---------- 购物车主题控制（第三个配置域，与官网/会员中心独立存储） ---------- */
    if (strpos($action, 'cart.') === 0) {
        $cart     = new CartThemeStore($ROOT . '/runtime');
        $sub      = substr($action, 5);
        $operator = (string) ($_SESSION['cra1_admin'] ?? 'admin');
        $body     = read_body();

        if ($sub === 'get') {
            json_out([
                'status' => 200,
                'msg'    => 'success',
                'data'   => [
                    'config'    => $cart->read(),
                    'defaults'  => CartThemeStore::defaults(),
                    'has_store' => $cart->exists(),
                ],
            ]);
        }

        if ($sub === 'save') {
            $content = is_array($body['content'] ?? null) ? $body['content'] : null;
            if ($content === null) {
                json_out(['status' => 400, 'msg' => '缺少 content']);
            }
            $res = $cart->save(['content' => $content], $operator, (int) ($body['version'] ?? 0));
            audit('cart.save', $res['status'] === 200 ? 'ok' : 'fail');
            json_out($res);
        }

        if ($sub === 'reset') {
            $res = $cart->reset($operator);
            audit('cart.reset', $res['status'] === 200 ? 'ok' : 'fail');
            json_out($res);
        }

        json_out(['status' => 404, 'msg' => '未知购物车主题接口'], 404);
    }

    if ($action === 'logs') {
        $lines = [];
        if (is_file($AUDIT_FILE)) {
            $lines = file($AUDIT_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            $lines = array_slice($lines, -50);
        }
        $list = [];
        foreach (array_reverse($lines) as $line) {
            $p = explode("\t", $line);
            $list[] = [
                'time'   => $p[0] ?? '',
                'ip'     => $p[1] ?? '',
                'action' => $p[2] ?? '',
                'result' => $p[3] ?? '',
                'detail' => $p[4] ?? '',
            ];
        }
        json_out(['status' => 200, 'msg' => 'success', 'data' => ['list' => $list]]);
    }
    json_out(['status' => 404, 'msg' => '未知接口'], 404);
}

/* 登录 / 初始化 */
if($r==='login'||$r==='') {
    if(is_logged_in())redirect_to('r=dashboard');
    if($method==='POST'){theme_auth_api('auth.login',read_body());}
    require __DIR__.'/login.php';exit;
}

/* --------------------------------------------------------------------------
   管理台页面
   --------------------------------------------------------------------------
   渲染已适配独立身份与重新认证的版本化 React 界面。
   回退仅选择兼容安全资源，不重新启用旧 Alpine 壳或单账号鉴权。
   -------------------------------------------------------------------------- */
if ($r === 'dashboard') {
    if (!is_logged_in() || !$admin) {
        redirect_to('r=login');
    }

    // Enable a verified immutable release last. Disabling this flag restores the
    // previous UI while the compatible storage layer keeps all new page settings.
    $assetBase = 'assets/releases/20261013-security-compat-v1';
    $releaseFile = $STORE . '/admin_release.json';
    $release = is_file($releaseFile) ? json_decode((string) file_get_contents($releaseFile), true) : null;
    $previous = isset($_GET['previous']) && (string) $_GET['previous'] === '1';
    if (is_array($release) && ($previous || empty($release['enabled']))
        && preg_match('#^assets/releases/[0-9]{8}-security-[A-Za-z0-9._-]+$#D', (string) ($release['previous'] ?? ''))) {
        $candidate = $release['previous'];
        if (is_file(__DIR__ . '/' . $candidate . '/admin.js') && is_file(__DIR__ . '/' . $candidate . '/admin.css')) $assetBase = $candidate;
    }
    if (!$previous && is_array($release) && !empty($release['enabled'])
        && preg_match('/^[0-9]{8}-security-[A-Za-z0-9._-]+$/D', (string) ($release['release'] ?? ''))) {
        $candidate = 'assets/releases/' . $release['release'];
        if (is_file(__DIR__ . '/' . $candidate . '/admin.js') && is_file(__DIR__ . '/' . $candidate . '/admin.css')) $assetBase = $candidate;
    }
    require_once $ROOT.'/cra1-theme/backend/bootstrap.php';
    if (!$previous) $assetBase=\CRA1\Theme\Release\Assets::admin($assetBase);
    $reactJs  = __DIR__ . '/' . $assetBase . '/admin.js';
    $reactCss = __DIR__ . '/' . $assetBase . '/admin.css';

    if (!is_file($reactJs)||!is_file($reactCss)){http_response_code(503);echo '后台资源尚未就绪，请联系维护人员。';exit;}

    header('Content-Type: text/html; charset=utf-8');
    $csrf    = csrf_token();
    $user    = (string) theme_actor()['username'];
    $base    = (string) $BASE_URL;
    // Release paths provide cache identity. Avoid query strings on the entry:
    // lazy chunks may import its shared exports and must use the same module URL.
    $assetQuery = $assetBase === 'assets' ? '?v=' . filemtime($reactJs) . '.' . filemtime($reactCss) : '';
    $boot    = json_encode([
        'csrf' => $csrf,
        'user' => $user,
        'user_id' => (int)theme_actor()['id'],
        'role' => theme_actor()['role'],
        'mfa_enabled' => !empty(theme_actor()['mfa_secret']),
        'must_change' => (bool)theme_actor()['must_change'],
        'http_test' => !empty($THEME_SETTINGS['http_test'])&&!$https,
        'base' => 'index.php',
        'slug' => $SLUG,
        'release' => $assetBase,
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP);

    echo '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex,nofollow">'
        . '<title>酷锐A1主题 · 管理台</title>'
        . '<link rel="stylesheet" href="' . htmlspecialchars($assetBase . '/admin.css' . $assetQuery, ENT_QUOTES) . '">'
        . '<script nonce="'.htmlspecialchars($THEME_CSP_NONCE,ENT_QUOTES).'">window.__CRA1_ADMIN__ = ' . $boot . ';</script>'
        . '</head><body><div id="cra1-admin-root"></div>'
        . '<script type="module" src="' . htmlspecialchars($assetBase . '/admin.js' . $assetQuery, ENT_QUOTES) . '"></script>'
        . '</body></html>';
    exit;
}

redirect_to('r=dashboard');
