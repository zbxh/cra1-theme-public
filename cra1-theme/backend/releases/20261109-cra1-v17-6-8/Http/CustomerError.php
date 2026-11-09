<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;

/** Public business failures; diagnostics belong to private server records. */
final class CustomerError
{
    public static function message($value, int $status = 0, array $context = []): string
    {
        if ($status === 401) return '登录已失效，请重新登录';
        if ($status === 429) return '操作过于频繁，请稍后重试';
        $path=(string)($context['path']??'');$write=!in_array(strtoupper((string)($context['method']??'GET')),['GET','HEAD','OPTIONS'],true);
        if(in_array($status,[403,404],true)&&preg_match('~/order/[1-9]\d*(?:/|$)~',$path))return '订单不存在或你无权查看，请到订单列表确认';
        if ($status >= 500) {
            if(preg_match('~/(?:pay|gateway)(?:/|$)~',$path))return $write||preg_match('~/status$~',$path)?'尚未确认付款结果，请先查看订单状态，避免重复付款':'付款信息暂时无法加载，请稍后重试或联系客服';
            if(preg_match('~/(?:renew|renewal)(?:/|$)~',$path))return $write?'尚未确认续费是否提交成功，请先到订单列表查看，避免重复提交':'续费信息暂时无法获取，请稍后重试或联系客服';
            if($write&&preg_match('~/(?:product|cart)/settle(?:/|$)~',$path))return '尚未确认订单是否创建成功，请先到订单列表查看，避免重复下单';
            if($write)return '暂未收到操作结果，请先查看当前状态，避免重复提交';
            if(preg_match('~/(?:quote|price|calculate)(?:/|$)~',$path))return '暂时无法获取价格，请重新报价；确认金额后再提交';
            if(preg_match('~/(?:module|configoption|config_option)(?:/|$)~',$path))return '商品配置暂时无法打开，请重新加载；仍无法打开时请联系客服';
            return '服务暂时不可用，请稍后重试或联系客服';
        }
        $fallback = '操作暂时无法完成，请稍后重试或联系客服';
        if (!is_string($value)) return $fallback;
        $value = trim($value);
        if ($value === '' || mb_strlen($value) > 240 || preg_match('/[\x00-\x08\x0b-\x1f\x7f\x{202a}-\x{202e}\x{2066}-\x{2069}]/u', $value)) return $fallback;
        $internal = '~魔方云|智简魔方|idcsmart|\b(?:re)?mf_(?:cloud|dcim|finance)\b|SQLSTATE|SQL syntax|PDOException|mysqli|数据库|数据表|\b(?:table|column)\b.{0,80}(?:exist|unknown)|stack\s*trace|traceback|fatal\s*error|parse\s*error|\b(?:TypeError|ReferenceError|SyntaxError|Exception|ThinkPHP|Guzzle|Symfony)\b|cannot (?:read|set) propert|is not (?:defined|a function)|unexpected token|failed to fetch|network\s*error|load failed|request failed with status|timeout of \d|curl(?:\s*error)?|upstream|provider|供应商|上游服务|下游服务|ECONN\w*|ENOTFOUND|EAI_AGAIN|CORS|检查兼容性|主题脚本|模块计价接口|配置接口返回异常~iu';
        $private = '~(?:^|[\s/])(?:runtime|config|vendor|app|storage|private)/|[\w/.-]+\.(?:php|sql|sqlite|key|pem|env)(?:\b|$)|https?://|(?:\b\d{1,3}\.){3}\d{1,3}\b|/(?:www|root|etc|usr|var|home|srv|opt|tmp|runtime|config|vendor|app|storage|private)/|[a-z]:\\\\|[\w/.-]+\.(?:php|sql|sqlite|key|pem|env|jsx?|tsx?)(?::\d+|\s+on\s+line\b|\b)|(?:authorization|bearer|(?:access[_-]?|refresh[_-]?)?token|cookie|client[_-]?secret|api[_-]?(?:key|secret)|secret[_-]?key|password|密码|令牌|密钥)\s*[:=：]\s*\S+|\beyJ[A-Za-z0-9_-]{12,}|<[^>]+>|[{}]~iu';
        return preg_match($internal, $value) || preg_match($private, $value) || !preg_match('/[\x{3400}-\x{9fff}]/u', $value) ? $fallback : $value;
    }

    public static function payload(array $data, int $httpStatus = 200, array $context = []): array
    {
        $status = $httpStatus >= 400 ? $httpStatus : (int)($data['status'] ?? 0);
        if ($status < 400) return $data;
        $message=self::message($data['msg']??$data['message']??null,$status,$context);
        $data = self::withoutDiagnostics(self::requirements($data, \CRA1\Theme\Security\OperationVerification::redact($data)));
        $data['msg'] = $message;
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
            if (is_string($key) && preg_match('/^(?:trace|stack|stack_trace|exception|file|line|sql|debug|error_info|previous|provider_error|error_detail|diagnostics|raw|headers|request|config|authorization|cookie|password|passwd|secret|access_token|refresh_token|token|api_key|api_secret|api_token|secret_key|client_secret|private_key|filepath|server_path|upstream_url|provider_url)$/iD', $key)) unset($data[$key]);
            elseif (is_array($value)) $data[$key] = self::withoutDiagnostics($value);
            elseif (in_array($key, ['msg','message','error','reason','tip','detail','description'], true) && is_string($value)) $data[$key] = self::message($value);
            elseif(is_string($value)&&preg_match('~(?:^|[\s/])(?:runtime|config|vendor|app|storage|private)/|[\w/.-]+\.(?:php|sql|sqlite|key|pem|env)(?:\b|$)|https?://|(?:\b\d{1,3}\.){3}\d{1,3}\b|SQLSTATE|PDOException|stack trace|/(?:www|root|etc|usr|var|home|srv|opt|tmp|runtime|config|vendor|app|storage|private)/|[a-z]:\\\\|(?:Bearer|password|token|secret)\s*[:=]~i',$value))unset($data[$key]);
        }
        return $data;
    }
}
