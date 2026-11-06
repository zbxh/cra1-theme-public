<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;

/** Public business failures; diagnostics belong to private server records. */
final class CustomerError
{
    public static function message($value, int $status = 0): string
    {
        if ($status === 401) return '登录已失效，请重新登录';
        if ($status === 429) return '操作过于频繁，请稍后重试';
        if ($status >= 500) return '服务暂时不可用，请稍后重试或联系客服';
        $fallback = '操作暂时无法完成，请稍后重试或联系客服';
        if (!is_string($value)) return $fallback;
        $value = trim($value);
        if ($value === '' || mb_strlen($value) > 240 || preg_match('/[\x00-\x08\x0b-\x1f\x7f\x{202a}-\x{202e}\x{2066}-\x{2069}]/u', $value)) return $fallback;
        $internal = '~魔方云|智简魔方|idcsmart|\b(?:re)?mf_(?:cloud|dcim|finance)\b|SQLSTATE|SQL syntax|PDOException|mysqli|数据库|数据表|\b(?:table|column)\b.{0,80}(?:exist|unknown)|stack\s*trace|traceback|fatal\s*error|parse\s*error|\b(?:TypeError|ReferenceError|SyntaxError|Exception|ThinkPHP|Guzzle|Symfony)\b|cannot (?:read|set) propert|is not (?:defined|a function)|unexpected token|failed to fetch|network\s*error|load failed|request failed with status|timeout of \d|curl(?:\s*error)?|upstream|provider|供应商|上游服务|下游服务|ECONN\w*|ENOTFOUND|EAI_AGAIN|CORS|检查兼容性|主题脚本|模块计价接口|配置接口返回异常~iu';
        $private = '~https?://|(?:\b\d{1,3}\.){3}\d{1,3}\b|/(?:www|root|etc|usr|var|home|srv|opt|tmp)/|[a-z]:\\\\|[\w/.-]+\.(?:php|sql|jsx?|tsx?)(?::\d+|\s+on\s+line\b)|(?:authorization|bearer|(?:access[_-]?|refresh[_-]?)?token|cookie|client[_-]?secret|api[_-]?(?:key|secret)|secret[_-]?key|password|密码|令牌|密钥)\s*[:=：]\s*\S+|\beyJ[A-Za-z0-9_-]{12,}|<[^>]+>|[{}]~iu';
        return preg_match($internal, $value) || preg_match($private, $value) || !preg_match('/[\x{3400}-\x{9fff}]/u', $value) ? $fallback : $value;
    }

    public static function payload(array $data, int $httpStatus = 200): array
    {
        $status = $httpStatus >= 400 ? $httpStatus : (int)($data['status'] ?? 0);
        if ($status < 400) return $data;
        $data = self::withoutDiagnostics(self::requirements($data, \CRA1\Theme\Security\OperationVerification::redact($data)));
        $data['msg'] = self::message($data['msg'] ?? $data['message'] ?? null, $status);
        if (array_key_exists('message', $data)) $data['message'] = $data['msg'];
        return $data;
    }

    private static function requirements(array $source, array $filtered): array
    {
        // Native challenges use this key as a boolean requirement, while account
        // responses use it for the secret hash. Preserve only the former.
        if (array_key_exists('operate_password', $source)
            && in_array($source['operate_password'], [0, 1, '0', '1', false, true], true)) {
            $filtered['operate_password'] = $source['operate_password'];
            if (!array_key_exists('set_operate_password', $source)) unset($filtered['set_operate_password']);
        }
        foreach ($source as $key => $value) {
            if (is_array($value) && isset($filtered[$key]) && is_array($filtered[$key])) {
                $filtered[$key] = self::requirements($value, $filtered[$key]);
            }
        }
        return $filtered;
    }

    private static function withoutDiagnostics(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && preg_match('/^(?:trace|stack|stack_trace|exception|file|line|sql|debug|error_info|previous|provider_error|error_detail|diagnostics)$/iD', $key)) unset($data[$key]);
            elseif (is_array($value)) $data[$key] = self::withoutDiagnostics($value);
            elseif (in_array($key, ['msg','message','error','reason','tip'], true) && is_string($value)) $data[$key] = self::message($value);
        }
        return $data;
    }
}
