<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

require_once dirname(__DIR__,3).'/cra1-shared/icons.php';
/** Shared contract for the website's editable customer-service dropdown. */
function cra1_support_url(string $url): bool
{
    if ($url === '') return true;
    return !preg_match('/[\x00-\x20\\\\]/', $url)
        && (bool) preg_match('~^(?:https?://|/(?!/)|#|tel:|mailto:)~i', $url);
}

function cra1_support_string(array $value, string $key, int $limit): string
{
    if (isset($value[$key]) && !is_string($value[$key])) throw new InvalidArgumentException('客服信息的文字格式不正确');
    $text = trim($value[$key] ?? '');
    if (mb_strlen($text) > $limit || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/', $text)) throw new InvalidArgumentException('客服信息文字过长或包含无效字符');
    return $text;
}

function cra1_support_bool(array $value, string $key, bool $default): bool
{
    if (array_key_exists($key, $value) && !is_bool($value[$key])) throw new InvalidArgumentException('客服信息的显示开关格式不正确');
    return $value[$key] ?? $default;
}

function cra1_support_action(array $item): array
{
    if ($item['url'] !== '') return ['action'=>'link', 'href'=>$item['url'], 'copy'=>''];
    $value = $item['value']; $account = ltrim($value, '@');
    switch ($item['type']) {
        case 'phone':
            $parts = preg_split('/[xX]/', $value, 2);
            $number = preg_replace('/[^\d+]/', '', $parts[0]);
            $href = 'tel:' . $number . (isset($parts[1]) ? ';ext=' . $parts[1] : ''); break;
        case 'email': $href = 'mailto:' . rawurlencode(strstr($value, '@', true)) . '@' . substr(strstr($value, '@'), 1); break;
        case 'qq': $href = 'https://wpa.qq.com/msgrd?v=3&uin=' . rawurlencode($value) . '&site=qq&menu=yes'; break;
        case 'telegram': $href = 'https://t.me/' . rawurlencode($account); break;
        case 'whatsapp': $href = 'https://wa.me/' . preg_replace('/\D/', '', $value); break;
        case 'x': $href = 'https://x.com/' . rawurlencode($account); break;
        case 'instagram': $href = 'https://www.instagram.com/' . rawurlencode($account) . '/'; break;
        case 'weibo': $href = 'https://weibo.com/u/' . rawurlencode($value); break;
        case 'wechat': case 'account': return ['action'=>'copy', 'href'=>'', 'copy'=>$value];
        default: return ['action'=>'text', 'href'=>'', 'copy'=>''];
    }
    return ['action'=>'link', 'href'=>$href, 'copy'=>''];
}

function cra1_support_normalize_json($text): string
{
    if (!is_string($text)) throw new InvalidArgumentException('客服信息格式不正确');
    if (trim($text) === '') return '';
    if (mb_strlen($text) > 20000) throw new InvalidArgumentException('客服信息过长，请减少条目或缩短文字');
    $doc = json_decode($text, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($doc) || ($doc['schema'] ?? null) !== 1
        || !isset($doc['groups']) || !is_array($doc['groups']) || count($doc['groups']) > 8) throw new InvalidArgumentException('客服信息格式不正确');
    $out = ['schema'=>1, 'enabled'=>cra1_support_bool($doc, 'enabled', true), 'groups'=>[]];
    $ids = []; $total = 0;
    foreach ($doc['groups'] as $group) {
        if (!is_array($group) || !isset($group['items']) || !is_array($group['items'])) throw new InvalidArgumentException('客服分组格式不正确');
        $id = cra1_support_string($group, 'id', 80);
        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $id) || isset($ids[$id])) throw new InvalidArgumentException('客服分组标识重复或无效');
        $ids[$id] = true;
        $g = ['id'=>$id, 'title'=>cra1_support_string($group, 'title', 60), 'enabled'=>cra1_support_bool($group, 'enabled', true), 'items'=>[]];
        foreach ($group['items'] as $row) {
            if (!is_array($row) || ++$total > 60) throw new InvalidArgumentException('客服条目最多 60 条');
            $id = cra1_support_string($row, 'id', 80);
            if (!preg_match('/^[a-zA-Z0-9_-]+$/', $id) || isset($ids[$id])) throw new InvalidArgumentException('客服条目标识重复或无效');
            $ids[$id] = true;
            $item = ['id'=>$id, 'text'=>cra1_support_string($row, 'text', 120), 'icon'=>cra1_support_string($row, 'icon', 240),
                'type'=>cra1_support_string($row, 'type', 20), 'value'=>cra1_support_string($row, 'value', 200), 'url'=>cra1_support_string($row, 'url', 2000),
                'showText'=>cra1_support_bool($row, 'showText', true), 'showIcon'=>cra1_support_bool($row, 'showIcon', true),
                'enabled'=>cra1_support_bool($row, 'enabled', true), 'newWindow'=>cra1_support_bool($row, 'newWindow', true)];
            if (!in_array($item['type'], ['text','link','phone','email','qq','wechat','telegram','whatsapp','x','instagram','weibo','account'], true)) throw new InvalidArgumentException('请选择有效的客服联系方式');
            if (!cra1_support_url($item['url'])) throw new InvalidArgumentException('客服链接格式不正确，请填写站内地址或完整的网址');
            if(isset($row['icon_style'])) { $style=cra1_icon_style_clean($row['icon_style']);if($style)$item['icon_style']=$style; }
            $icon = $item['icon'];
            // New values are checked against the shared resolver at the store boundary.
            // Historical unknown values retain their exact strings.
            if (!$item['showText'] && !$item['showIcon']) throw new InvalidArgumentException('客服条目至少要显示文字或图标');
            if ($item['text'] === '' && $item['value'] === '') throw new InvalidArgumentException('请填写客服条目的显示文字或联系方式');
            if ($item['type'] === 'link' && $item['url'] === '') throw new InvalidArgumentException('请填写客服条目的跳转链接');
            $v = $item['value']; $a = ltrim($v, '@');
            $checks = [
                'phone'=>['/^(?:\+?\d)[\d\s().-]{2,40}(?:[xX]\d{1,8})?$/', '请填写有效的电话号码；分机可使用 x123'],
                'qq'=>['/^\d{5,12}$/', '请填写 5 至 12 位 QQ 号码'],
                'telegram'=>['/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/', '请填写有效的 Telegram 用户名'],
                'whatsapp'=>['/^\+?[\d\s()-]{7,24}$/', '请填写带国家或地区编号的 WhatsApp 手机号'],
                'x'=>['/^[a-zA-Z0-9_]{1,15}$/', '请填写有效的 X 用户名'],
                'instagram'=>['/^[a-zA-Z0-9_.]{1,30}$/', '请填写有效的 Instagram 用户名'],
                'weibo'=>['/^\d{5,20}$/', '请填写微博用户 UID；主页链接可选择“网页链接”'],
            ];
            if (isset($checks[$item['type']]) && !preg_match($checks[$item['type']][0], in_array($item['type'], ['telegram','x','instagram'], true) ? $a : $v)) throw new InvalidArgumentException($checks[$item['type']][1]);
            if ($item['type'] === 'whatsapp' && !preg_match('/^\d{7,15}$/', preg_replace('/\D/', '', $v))) throw new InvalidArgumentException('WhatsApp 手机号应包含国家或地区编号，共 7 至 15 位');
            if ($item['type'] === 'email' && !filter_var($v, FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('请填写有效的邮箱地址');
            if (in_array($item['type'], ['wechat','account'], true) && ($v === '' || preg_match('/\s/', $v))) throw new InvalidArgumentException('请填写有效的社交账号');
            $g['items'][] = $item;
        }
        $out['groups'][] = $g;
    }
    return (string) json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function cra1_support_document(array $cfg, bool $strict = false, ?array $system = null): array
{
    $raw = (string) ($cfg['header_support_json'] ?? '');
    if (trim($raw) !== '') {
        try { return json_decode(cra1_support_normalize_json($raw), true); }
        catch (Throwable $e) { if ($strict) throw $e; }
    }
    $items = $cfg['float_items'] ?? (function_exists('cra1_parse_float_items') ? cra1_parse_float_items($cfg['float_items_text'] ?? '') : []);
    $systemValue = function (string $key) use (&$system): string {
        if ($system === null) $system = function_exists('cra1_system_display_config') ? cra1_system_display_config(dirname(__DIR__, 4)) : [];
        return trim((string) ($system[$key] ?? ''));
    };
    $contact = function (string $kind) use ($items, $systemValue): string {
        $pattern = $kind === 'sales' ? '/售前|销售|商务/u' : '/售后|技术支持/u';
        foreach ($items as $item) if (preg_match($pattern, $item['name'] ?? '') && !empty($item['url']) && cra1_support_url($item['url'])) return $item['url'];
        foreach ($items as $item) if (preg_match('/客服|在线咨询/u', $item['name'] ?? '') && preg_match('~^(?:https?://|/(?!/))~i', $item['url'] ?? '') && cra1_support_url($item['url'])) return $item['url'];
        $url = $systemValue('online_customer_service_link');
        if ($url !== '' && cra1_support_url($url)) return $url;
        return '/contact.html';
    };
    $row = function ($id, $text, $icon, $type, $value, $url) { return ['id'=>$id,'text'=>$text,'icon'=>$icon,'type'=>$type,'value'=>$value,'url'=>$url,'showText'=>true,'showIcon'=>true,'enabled'=>true,'newWindow'=>true]; };
    $main = []; $phone = trim((string) ($cfg['hotline'] ?? ''));
    if ($phone === '') $phone = $systemValue('enterprise_telephone');
    if ($phone !== '') $main[] = $row('support-phone', '', 'phone', 'phone', $phone, '');
    $main[] = $row('support-sales', '售前咨询', 'mail', 'link', '', $contact('sales'));
    $main[] = $row('support-service', '售后在线', 'headset', 'link', '', $contact('service'));
    return ['schema'=>1,'enabled'=>true,'groups'=>[
        ['id'=>'support-main','title'=>'联系我们','enabled'=>true,'items'=>$main],
        ['id'=>'support-other','title'=>'其他服务','enabled'=>true,'items'=>[
            $row('support-suggestion','我要建议','message','link','','/feedback.html'),
            $row('support-complaint','我要投诉','file','link','','/feedback.html'),
        ]],
    ]];
}

function cra1_support_render_config(array $cfg, ?array $system = null): array
{
    $doc = cra1_support_document($cfg, false, $system); $out = ['enabled'=>$doc['enabled'], 'groups'=>[]];
    if (!$doc['enabled']) return $out;
    $defaults = ['phone'=>'phone','email'=>'mail','qq'=>'qq','wechat'=>'wechat','text'=>'message'];
    foreach ($doc['groups'] as $g) {
        if (!$g['enabled']) continue;
        $items = [];
        foreach ($g['items'] as $item) {
            if (!$item['enabled']) continue;
            $item += cra1_support_action($item);
            $item['label'] = $item['text'] !== '' ? $item['text'] : $item['value'];
            $spec = $item['icon'] !== '' ? $item['icon'] : ($defaults[$item['type']] ?? 'link');
            $item['icon_img'] = '';
            if ($item['showIcon']) {
                $name = preg_replace('/^iconify:/', '', $spec);
                $file = preg_match('/^[a-z0-9-]+:[a-z0-9-]+$/i', $name) ? str_replace(':', '-', $name) . '.svg' : '';
                if (preg_match('~^(?:https?://|/(?!/))~i', $spec)) $item['icon_img'] = $spec;
                elseif ($file !== '' && is_file(__DIR__ . '/../assets/icons/' . $file)) $item['icon_img'] = '/web/cra1/assets/icons/' . $file;
                elseif (function_exists('cra1_icon_url')) $item['icon_img'] = cra1_icon_url($spec, 40);
            }
            $resolved=cra1_icons_resolve($spec,'website');
            $item['icon_svg']=$resolved['svg']??'';
            $item['icon_style_attrs']=cra1_icon_style_attrs($item['icon_style']??null,false);
            $item['icon_png'] = function_exists('cra1_icon_is_png') && cra1_icon_is_png($item['icon_img']);
            $item['external'] = (bool) preg_match('~^https?://~i', $item['href']);
            $items[] = $item;
        }
        if ($items) $out['groups'][] = ['id'=>$g['id'], 'title'=>$g['title'], 'items'=>$items];
    }
    return $out;
}
