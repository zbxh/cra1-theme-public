<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

/** Public system display fields only; never expose credentials in previews. */
function cra1_system_display_config(?string $root = null): array
{
    $keys=['website_name','official_website_logo','enterprise_name','enterprise_telephone','enterprise_mailbox','enterprise_address','enterprise_qrcode',
        'online_customer_service_link','icp_info','icp_info_link','copyright_info','public_security_network_preparation','public_security_network_preparation_link','telecom_appreciation'];
    $out=[];
    if (function_exists('configuration')) {
        foreach ($keys as$key) $out[$key]=(string)configuration($key);
        return $out;
    }
    if ($root===null || !is_file($root.'/config.php')) return [];
    require_once $root.'/config.php';
    if (!defined('DATABASE_HOSTNAME') || !defined('DATABASE_NAME')) return [];
    try {
        $pdo=new PDO('mysql:host='.DATABASE_HOSTNAME.';port='.DATABASE_PORT.';dbname='.DATABASE_NAME.';charset='.DATABASE_CHARSET,
            DATABASE_USERNAME,DATABASE_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_TIMEOUT=>3]);
        $stmt=$pdo->prepare('SELECT setting,value FROM idcsmart_configuration WHERE setting IN ('.implode(',',array_fill(0,count($keys),'?')).')');
        $stmt->execute($keys);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as$row) $out[$row['setting']]=(string)$row['value'];
    } catch (Throwable $e) { /* An unavailable system source must not write display defaults. */ }
    return $out;
}

/** Shared, read-only presentation defaults used by the editor and templates. */
function cra1_content_defaults_catalog(): array
{
    static $catalog;
    if ($catalog === null) {
        $value = json_decode((string) @file_get_contents(__DIR__ . '/content_defaults.json'), true);
        $catalog = is_array($value) ? $value : [];
    }
    return $catalog;
}

function cra1_copy_normalize_text(string $text): string
{
    // Older single-quoted PHP defaults stored literal \\n between key/value rows.
    // Only a row boundary is repaired; normal text, CSS and JS are untouched.
    return preg_replace('/\\\\n(?=[!>]*[A-Za-z][A-Za-z0-9_]*\\|)/', "\n", $text);
}

function cra1_copy_has_saved_value(array $config, string $key): bool
{
    if (cra1_content_explicit($config, $key)) return true;
    if (isset($config['_theme_saved_fields'])) return in_array($key, $config['_theme_saved_fields'], true);
    $defaults = \template\cra1\controller\Cra1::defaults();
    return array_key_exists($key, $config) && cra1_copy_normalize_text((string) $config[$key]) !== cra1_copy_normalize_text((string) ($defaults[$key] ?? ''));
}

function cra1_copy_effective_map(string $page, string $module, array $config): array
{
    $catalog = cra1_content_defaults_catalog();
    $fallbacks = $catalog['copy'][$page][$module] ?? $catalog['copy']['public'][$module] ?? [];
    $key = 'copy_' . $module . '_text';
    $explicit = cra1_content_explicit($config, $key);
    $map = $fallbacks;
    if (!$explicit && !cra1_copy_has_saved_value($config, $key)) return $map;
    if ($explicit && trim((string) ($config[$key] ?? '')) === '') return array_fill_keys(array_keys($fallbacks), '');
    $saved = [];
    foreach (preg_split('/\r?\n/', cra1_copy_normalize_text((string) ($config[$key] ?? ''))) as $line) {
        [$hidden, $line] = cra1_line_hidden($line);
        $parts = explode('|', $line, 2);
        if ($hidden || count($parts) !== 2 || trim($parts[0]) === '') continue;
        $saved[trim($parts[0])] = trim($parts[1]);
    }
    // New independent positions inherit a legacy custom value until edited.
    foreach ($catalog['aliases'][$page][$module] ?? [] as $target => $source) {
        if (!array_key_exists($target, $saved) && array_key_exists($source, $saved)) $saved[$target] = $saved[$source];
    }
    foreach ($saved as $k => $v) {
        if ($explicit || $v !== '') $map[$k] = $v;
    }
    return $map;
}

function cra1_copy_editor_text(string $page, string $module, array $config): string
{
    $key = 'copy_' . $module . '_text';
    $map = cra1_copy_effective_map($page, $module, $config);
    $text = cra1_copy_has_saved_value($config, $key) ? cra1_copy_normalize_text((string) ($config[$key] ?? '')) : '';
    $lines = trim($text) === '' ? [] : preg_split('/\r?\n/', $text);
    $present = [];
    foreach ($lines as &$line) {
        [$hidden, $content] = cra1_line_hidden($line);
        $parts = explode('|', $content, 2);
        if ($hidden || count($parts) !== 2) continue;
        $k = trim($parts[0]);
        $present[$k] = true;
        if (trim($parts[1]) === '' && !cra1_content_explicit($config, $key) && isset($map[$k])) $line = $k . '|' . $map[$k];
    }
    unset($line);
    foreach ($map as $k => $v) if (!isset($present[$k])) $lines[] = $k . '|' . $v;
    return implode("\n", $lines);
}

/** Merge changed positions, keeping unsaved template defaults out of storage. */
function cra1_copy_editor_patch(string $module, array $config, string $submitted): ?string
{
    $baseline = cra1_copy_editor_text('public', $module, $config);
    if ($submitted === $baseline) return null;
    if (trim($submitted) === '') return '';
    $groups = static function (string $text): array {
        $out = [];
        foreach (preg_split('/\r?\n/', cra1_copy_normalize_text($text)) as $line) {
            if (trim($line) === '') continue;
            [, $content] = cra1_line_hidden($line);
            $parts = explode('|', $content, 2);
            if (count($parts) === 2) $out[trim($parts[0])][] = $line;
        }
        return $out;
    };
    $before = $groups($baseline); $after = $groups($submitted); $changed = [];
    foreach (array_unique(array_merge(array_keys($before), array_keys($after))) as $key) {
        if (($before[$key] ?? []) !== ($after[$key] ?? [])) $changed[$key] = $after[$key] ?? [];
    }
    if (!$changed) return null;
    $key = 'copy_' . $module . '_text';
    $saved = cra1_copy_has_saved_value($config, $key) ? cra1_copy_normalize_text((string)($config[$key] ?? '')) : '';
    $lines = [];
    foreach (preg_split('/\r?\n/', $saved) as $line) {
        if (trim($line) === '') continue;
        [, $content] = cra1_line_hidden($line); $parts = explode('|', $content, 2);
        if (!array_key_exists(trim($parts[0]), $changed)) $lines[] = $line;
    }
    foreach ($changed as $rows) foreach ($rows as $line) $lines[] = $line;
    return implode("\n", $lines);
}

function cra1_footer_default_text(): string
{
    return "产品|\n>云服务器|/cloud.html\n>物理裸机|/dedicated.html\n>域名注册|/domain.html\n>SSL 证书|/ssl.html\n方案|\n>全部方案|/solution.html\n>电商零售|/solution/ecommerce.html\n>金融科技|/solution/finance.html\n支持|\n>文档中心|/document.html\n>官方公告|/announce.html\n>联系我们|/contact.html\n账户|\n>管理控制台|/home.htm\n>我的订单|/finance.htm\n>账户信息|/account.htm\n关于|\n>公司介绍|/about.html\n>新闻资讯|/news.html\n>服务保障|/service-guarantee.html";
}
