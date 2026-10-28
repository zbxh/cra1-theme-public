<?php
/** CRA1 card adapter: native routes keep authentication and business validation. */
declare(strict_types=1);

final class CRA1ThemeClientActions
{
    public static function route(string $path, string $method): bool
    {
        if ($method === 'GET') {
            return (bool) preg_match('~^/(?:host/[1-9][0-9]*(?:/renew(?:/auto)?)?|(?:mf_cloud|mf_dcim)/[1-9][0-9]*(?:/status|/image/check|/remote_info)?|mf_cloud/[1-9][0-9]*/(?:recommend_config(?:/price)?|common_config)|product/[1-9][0-9]*/(?:(?:mf_cloud|mf_dcim)/(?:order_page|image)|mf_cloud/line/[1-9][0-9]*)|ssh_key)$~D', $path);
        }
        if ($method === 'PUT') return (bool) preg_match('~^/host/[1-9][0-9]*/renew/auto$~D', $path);
        return $method === 'POST' && (bool) preg_match('~^/(?:(?:mf_cloud|mf_dcim)/[1-9][0-9]*/(?:on|off|reboot|reset_password|reinstall|vnc|image/order)|mf_cloud/[1-9][0-9]*/(?:recommend_config|common_config)/order|host/[1-9][0-9]*/renew)$~D', $path);
    }

    public static function validParameters(array $query, array $body, string $path = '', string $method = ''): bool
    {
        $elastic = (bool) preg_match('~^/mf_cloud/[1-9][0-9]*/common_config(?:/order)?$~D', $path);
        $package = (bool) preg_match('~^/mf_cloud/[1-9][0-9]*/recommend_config/(?:price|order)$~D', $path);
        $automatic = (bool) preg_match('~^/host/[1-9][0-9]*/renew/auto$~D', $path);
        if (preg_match('~^/(?:mf_cloud|mf_dcim)/[1-9][0-9]*/remote_info$~D', $path)) return $method === 'GET' && !$query && !$body;
        $numeric = ['cpu', 'memory', 'bw', 'flow', 'peak_defence', 'ip_num', 'ipv6_num', 'image_id'];
        if ($automatic) return !$query && ($method === 'GET' ? !$body : count($body) === 1 && array_key_exists('status', $body) && in_array($body['status'], [0, 1, '0', '1'], true));
        if (($elastic || $package) && $method === 'GET' && $body) return false;
        foreach (array_keys($query) as $key) {
            if ($elastic && in_array($key, $numeric, true)) {
                if (!self::numericValue($query[$key])) return false;
                continue;
            }
            if ($package && $key === 'recommend_config_id') {
                if (!(is_int($query[$key]) || is_string($query[$key])) || !preg_match('/^[1-9][0-9]{0,9}$/D', (string) $query[$key])) return false;
                continue;
            }
            if ($package && $key === 'customfield') {
                if (!self::validPromo($query[$key])) return false;
                continue;
            }
            if (!in_array($key, ['page', 'limit', 'image_id', 'check_limit_rule', 'is_market'], true)) return false;
            if (!is_scalar($query[$key]) || !preg_match('/^[0-9]{1,10}$/D', (string) $query[$key])) return false;
        }
        $allowed = ['client_operate_password', 'password', 'code', 'image_id', 'port', 'part_type', 'format_data_disk', 'ssh_key_id', 'billing_cycle', 'customfield'];
        if ($elastic) $allowed = array_merge($numeric, ['client_operate_password']);
        if ($package) $allowed = ['recommend_config_id', 'customfield', 'client_operate_password'];
        foreach (array_keys($body) as $key) {
            if (!in_array($key, $allowed, true)) return false;
            if ($elastic && in_array($key, $numeric, true) && !self::numericValue($body[$key])) return false;
            if ($package && $key === 'recommend_config_id' && (!(is_int($body[$key]) || is_string($body[$key])) || !preg_match('/^[1-9][0-9]{0,9}$/D', (string) $body[$key]))) return false;
            if ($package && $key === 'customfield' && !self::validPromo($body[$key])) return false;
            if (($elastic || $package) && $key === 'client_operate_password' && !is_string($body[$key])) return false;
        }
        return true;
    }

    private static function numericValue($value): bool
    {
        return (is_int($value) || is_float($value) || is_string($value)) && (bool) preg_match('/^[0-9]{1,10}(?:\.[0-9]{1,6})?$/D', (string) $value);
    }

    private static function validPromo($value): bool
    {
        if (!is_array($value) || array_keys($value) !== ['promo_code'] || !is_array($value['promo_code']) || count($value['promo_code']) !== 1) return false;
        $code = $value['promo_code'][0] ?? null;
        return is_string($code) && strlen($code) <= 128 && !preg_match('/[\x00-\x1f\x7f]/', $code);
    }

    public static function response($native, int $httpCode, string $requestId, string $path): array
    {
        if (!is_array($native)) $native = [];
        $status = (int) ($native['status'] ?? ($httpCode >= 400 ? $httpCode : 503));
        if ($status === 200 && $httpCode < 400) {
            $data = $native['data'] ?? [];
            if (substr($path, -12) === '/remote_info') {
                $data = is_array($data) ? array_intersect_key($data, array_flip(['username', 'password', 'port', 'panel_pass', 'vpc_private_ip', 'verification_expires_at'])) : [];
                $data = array_filter($data, static function ($value): bool { return is_string($value) || is_int($value); });
            }
            if (substr($path, -7) === '/status' && is_array($data)) {
                $states = ['on' => '已开机', 'off' => '已关机', 'operating' => '操作处理中', 'pending' => '开通中', 'suspend' => '已暂停', 'fault' => '状态暂不可用'];
                $state = (string) ($data['status'] ?? '');
                $data = ['status' => isset($states[$state]) ? $state : 'fault', 'desc' => $states[$state] ?? $states['fault']];
            }
            return ['status' => 200, 'msg' => '请求成功', 'data' => $data, 'request_id' => $requestId];
        }
        if (!in_array($status, [400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504], true)) $status = 503;
        $messages = [401 => '登录已失效，请重新登录', 403 => '当前账号无权执行此操作', 404 => '当前产品暂不支持此功能', 409 => '服务器状态已变化，请重新检查后操作', 422 => '提交的信息不符合要求，请检查后重试', 429 => '操作过于频繁，请稍后重试'];
        $message = $messages[$status] ?? (substr($path, -7) === '/status' ? '暂时无法获取服务器状态，请稍后重试' : '暂时无法完成此操作，请稍后重试或联系客服');
        // Forward explicit business meanings, never interpolate upstream error text.
        $raw = (string) ($native['msg'] ?? '');
        $known = ['操作密码错误' => '操作密码错误，请重新输入', '验证码错误' => '验证码错误，请重新输入', '验证码已过期' => '验证码已过期，请重新获取', '未变更' => '请先调整至少一项配置', '优惠码' => '优惠码不可用，请检查后重试', '已关机' => '服务器已关机', '已开机' => '服务器已开机'];
        foreach ($known as $needle => $safe) if ($status === 400 && mb_strpos($raw, $needle) !== false) { $message = $safe; break; }
        $data = [];
        if (!empty($native['data']['setup_required'])) {
            $data = ['setup_required'=>true, 'setup_url'=>'/security.htm'];
            $message = '请先在账户安全设置中设置操作密码';
        }
        $verification = $native['data']['security_verification'] ?? null;
        if (is_array($verification) && in_array($verification['kind'] ?? '', ['operation','native_code'], true)) {
            $methods = [];
            foreach (($verification['methods'] ?? []) as $item) {
                if (!is_array($item) || !in_array($item['value'] ?? '', ['operate_password','phone_code','email_code'], true)) continue;
                $value = $item['value'];
                $methods[] = ['value'=>$value, 'label'=>['operate_password'=>'操作密码','phone_code'=>'短信验证码','email_code'=>'邮箱验证码'][$value], 'tip'=>$value === 'operate_password' ? '当前登录十五分钟内有效' : '请验证已绑定的联系方式'];
            }
            if ($methods) $data = ['need_security_verify'=>true, 'security_verification'=>['kind'=>$verification['kind'], 'scene'=>$verification['kind'] === 'native_code' ? 'verify' : 'operation', 'methods'=>$methods, 'captcha_required'=>!empty($verification['captcha_required'])]];
            $message = '请完成安全验证';
        }
        if ((int) ($native['data']['operate_password'] ?? 0) === 1) { $data['operate_password'] = 1; $message = '该操作需要验证操作密码'; }
        return ['status' => $status, 'msg' => $message, 'code' => 'INSTANCE_ACTION_UNAVAILABLE', 'data' => $data, 'request_id' => $requestId];
    }

    public static function diagnostic(string $root, string $id, string $path, int $status, string $message, array $sensitive): void
    {
        // No request body, credentials, response data or client IP is persisted.
        foreach ($sensitive as $secret) if (is_string($secret) && $secret !== '') $message = str_replace($secret, '[redacted]', $message);
        $message = preg_replace('~https?://[^\s<>"\']+~i', '[upstream URL]', strip_tags($message));
        $message = preg_replace('~(?:Bearer\s+\S+|(?:password|token|secret|authorization|密码|密钥)\s*[:=：]\s*[^\s,;]+)~iu', '[redacted]', $message);
        $dir = $root . '/runtime/cra1_theme/instance_diagnostics';
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return;
        $file = $dir . '/' . date('Y-m-d') . '.jsonl';
        $row = ['time' => gmdate('c'), 'request_id' => $id, 'path' => $path, 'status' => $status, 'message' => mb_substr((string) $message, 0, 1000)];
        @file_put_contents($file, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . "\n", FILE_APPEND | LOCK_EX);
        @chmod($file, 0600);
    }
}
