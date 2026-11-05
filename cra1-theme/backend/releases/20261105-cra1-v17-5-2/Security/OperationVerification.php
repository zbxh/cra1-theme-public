<?php
namespace CRA1\Theme\Security;

use app\common\model\ClientModel;
use app\common\model\HostModel;
use think\facade\Cache;

/** Member step-up authorization. Never caches passwords or trusts browser flags. */
final class OperationVerification
{
    const TTL = 900;

    public static function enabled(): bool
    {
        return in_array('operate_password', explode(',', (string) configuration('home_enforce_safe_method')), true);
    }

    private static function sessionKey(int $clientId): string
    {
        $token = (string) get_header_jwt();
        return $token === '' ? '' : 'client_operation_grant_' . $clientId . '_' . hash('sha256', $token);
    }

    private static function fingerprint($client): string
    {
        return hash('sha256', json_encode([(string)$client['operate_password'], (string)$client['password'], (string)$client['phone_code'], (string)$client['phone'], (string)$client['email']]));
    }

    public static function channelProofKey(string $key): string
    {
        return $key . '_session_' . hash('sha256', (string)get_header_jwt());
    }

    public static function revoke(int $clientId): void
    {
        $key = self::sessionKey($clientId);
        if ($key !== '') Cache::delete($key);
        idcsmart_cache('CLIENT_OPERATE_PASSWORD_' . $clientId, null);
    }

    public static function expiresAt(int $clientId): int
    {
        if ($clientId <= 0 || self::sessionKey($clientId) === '') return 0;
        $client = ClientModel::find($clientId);
        $grant = Cache::get(self::sessionKey($clientId));
        if (!$client || !is_array($grant) || (int) ($grant['expires_at'] ?? 0) <= time()
            || !hash_equals(self::fingerprint($client), (string) ($grant['fingerprint'] ?? ''))) return 0;
        return (int) $grant['expires_at'];
    }

    public static function verifyPassword(int $clientId, $password, bool $issueGrant = true): array
    {
        $client = ClientModel::find($clientId);
        if (!$client || $clientId <= 0 || ($issueGrant && self::sessionKey($clientId) === '')) return ['status'=>401, 'msg'=>'登录已失效，请重新登录'];
        if (empty($client['operate_password'])) return ['status'=>403, 'msg'=>'请先在账户安全设置中设置操作密码', 'data'=>['setup_required'=>true, 'setup_url'=>'/security.htm']];
        if (!is_string($password) || $password === '' || strlen($password) > 1024) return ['status'=>400, 'msg'=>'请输入操作密码'];
        // Account-wide failure limit is serialized even with the file-cache driver.
        $dir = CRA1_THEME_ROOT . '/runtime/cra1_theme/verification_locks/';
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return ['status'=>503, 'msg'=>'验证服务暂时不可用，请稍后重试'];
        $lock = @fopen($dir . substr(hash('sha256', 'operate:' . $clientId), 0, 2) . '.lock', 'c');
        if (!$lock) return ['status'=>503, 'msg'=>'验证服务暂时不可用，请稍后重试'];
        try {
            if (!flock($lock, LOCK_EX)) return ['status'=>503, 'msg'=>'验证服务暂时不可用，请稍后重试'];
            $key = 'client_operation_failures_' . $clientId;
            $rate = Cache::get($key);
            if (!is_array($rate) || (int) ($rate['until'] ?? 0) <= time()) $rate = ['count'=>0, 'until'=>time()+300];
            if ($rate['count'] >= 5) return ['status'=>429, 'msg'=>'操作密码连续错误，请五分钟后重试'];
            if (!idcsmart_password_compare($password, $client['operate_password'])) {
                $rate['count']++;
                Cache::set($key, $rate, max(1, $rate['until']-time()));
                return ['status'=>400, 'msg'=>'操作密码错误，请重新输入'];
            }
            Cache::delete($key);
            idcsmart_cache('CLIENT_OPERATE_PASSWORD_' . $clientId, null);
            if (!$issueGrant) return ['status'=>200, 'msg'=>'验证成功'];
            $expires = time() + self::TTL;
            if (!Cache::set(self::sessionKey($clientId), ['expires_at'=>$expires, 'fingerprint'=>self::fingerprint($client)], self::TTL)) return ['status'=>503, 'msg'=>'验证服务暂时不可用，请稍后重试'];
            return ['status'=>200, 'msg'=>'验证成功，当前登录十五分钟内无需重复输入操作密码', 'data'=>['expires_at'=>$expires]];
        } finally {
            flock($lock, LOCK_UN); fclose($lock);
        }
    }

    public static function challenge(string $scene, array $methods, string $kind = 'identity'): array
    {
        return ['status'=>400, 'msg'=>'请完成安全验证', 'data'=>[
            'need_security_verify'=>true, 'available_methods'=>array_values($methods),
            'security_verification'=>['kind'=>$kind, 'scene'=>$scene, 'methods'=>array_values($methods), 'captcha_required'=>(bool)configuration($scene === 'verify' ? 'captcha_client_verify' : 'captcha_client_security_verify')],
        ]];
    }

    public static function passwordGate(int $clientId, array $params = []): array
    {
        idcsmart_cache('CLIENT_OPERATE_PASSWORD_' . $clientId, null);
        if (!self::enabled() || self::expiresAt($clientId) > 0) return ['status'=>200];
        $client = ClientModel::find($clientId);
        if (!$client || empty($client['operate_password'])) return ['status'=>403, 'msg'=>'请先在账户安全设置中设置操作密码', 'data'=>['setup_required'=>true, 'setup_url'=>'/security.htm']];
        if (!empty($params['client_operate_password'])) return self::verifyPassword($clientId, $params['client_operate_password']);
        $result = self::challenge('operation', [['value'=>'operate_password', 'label'=>'操作密码', 'tip'=>'验证成功后，当前登录十五分钟内无需重复输入']], 'operation');
        $result['data']['operate_password'] = 1; // Legacy clients still receive their original signal.
        $result['data']['client_operate_methods'] = $params['client_operate_methods'] ?? '';
        return $result;
    }

    public static function path($request): string
    {
        return '/' . trim((string) $request->pathinfo(), '/');
    }

    /** Only the registered non-secret GET summary may bypass credential verification. */
    public static function remoteSummary(string $path, string $method, array $params = []): bool
    {
        return $method === 'GET' && in_array($params['metadata_only'] ?? null, [1, '1'], true)
            && (bool)preg_match('~^/(?:console/v1/)?(?:re)?mf_(?:cloud|dcim|finance|finance_common|finance_dcim)/[1-9][0-9]*/remote_info$~D', $path);
    }

    /** Pure route policy: reads and quotes never acquire mutation requirements. */
    public static function sensitive(string $path, string $method): bool
    {
        $path = rtrim(preg_replace('~^/console/v1~', '', $path), '/');
        if ($method === 'GET') return (bool) preg_match('~^/(?:re)?mf_(?:cloud|dcim|finance|finance_common|finance_dcim)/[1-9][0-9]*/(?:remote_info|download_rdp|app_preset_task/[1-9][0-9]*/credential)$~D', $path);
        if (!in_array($method, ['POST','PUT','DELETE'], true)) return false;
        if (preg_match('~^/(?:(?:re)?mf_(?:cloud|dcim|finance|finance_common|finance_dcim))/[1-9][0-9]*/(?:on|off|reboot|hard_off|hard_reboot|reset_password|crack_pass|reinstall|rescue(?:/exit)?|exit_rescue|vnc(?:/(?:restart|start))?|reset_bmc|cancel_task|simulate_physical_machine|disk/[1-9][0-9]*/(?:unmount|mount)|snapshot(?:/restore|/[1-9][0-9]*)?|backup(?:/restore|/[1-9][0-9]*)?|vpc_network(?:/[1-9][0-9]*)?|nat_acl|nat_web)$~D', $path)) return true;
        if (preg_match('~^/(?:re)?mf_(?:cloud|dcim|finance|finance_common|finance_dcim)/[1-9][0-9]*/(?:common_config|recommend_config|ip_num|upgrade_defence|disk|disk/resize|backup_config|image)/order$~D', $path)) return true;
        if (preg_match('~^/(?:re)?mf_cloud/[1-9][0-9]*/(?:app_preset/order|app_preset_task/[1-9][0-9]*/retry|app_preset_binding/[1-9][0-9]*/uninstall)$~D', $path)) return true;
        if (preg_match('~^/(?:re)?mf_cloud/[1-9][0-9]*/disk/[1-9][0-9]*/failed$~D', $path) && $method === 'DELETE') return true;
        if (preg_match('~^/(?:(?:re)?mf_(?:cloud|dcim|finance|finance_common|finance_dcim)|(?:re)?idcsmart_common)/batch_operate$~D', $path)) return true;
        if (preg_match('~^/(?:re)?idcsmart_common/host/[1-9][0-9]*/(?:provision/[^/]+|custom/provision|upgrade|upgrade_config)$~D', $path)) return !preg_match('~/provision/status$~D', $path);
        if (preg_match('~^/host/[1-9][0-9]*/(?:renew(?:/auto)?|product_upgrade/order|on_demand_to_recurring_prepayment|recurring_prepayment_to_on_demand|auto_release_time|flow_packet_order)$~D', $path)) return true;
        if (preg_match('~^/security_group(?:/[1-9][0-9]*(?:/(?:host(?:/[1-9][0-9]*)?|rule(?:/batch)?))?|/rule/[1-9][0-9]*)?$~D', $path)) return true;
        return false;
    }

    /** Keep action permissions independent of the identity-verification grant. */
    public static function requiredGroup(string $path, string $method, array $params = []): string
    {
        $path = rtrim(preg_replace('~^/console/v1~', '', $path), '/');
        if ($method==='POST' && $path==='/refund') return 'clientarea_auth_refund_renew_upgrade';
        if (!self::sensitive($path,$method)) return '';
        if ($method==='GET') {
            if (self::remoteSummary($path, $method, $params)) return '';
            return 'clientarea_auth_control_reinstall_rescue_reset_set_mount';
        }
        if (preg_match('~/(?:re)?idcsmart_common/host/[1-9][0-9]*/custom/provision$~D',$path)
            && in_array(strtolower((string)($params['func']??'')),['remoteinfo','trafficusage'],true)) return '';
        if (preg_match('~/batch_operate$~D',$path)) {
            $action=(string)($params['action']??'');
            if (in_array($action,['on','off','reboot','hard_off','hard_reboot'],true)) return 'clientarea_auth_on_off_restart';
            if ($action==='delete') return 'clientarea_auth_delete';
        }
        if (preg_match('~/(?:on|off|reboot|hard_off|hard_reboot)$~D',$path)) return 'clientarea_auth_on_off_restart';
        if (preg_match('~/order$~D',$path) || preg_match('~^/host/[1-9][0-9]*/(?:renew(?:/auto)?|on_demand_to_recurring_prepayment|recurring_prepayment_to_on_demand|flow_packet_order)$~D',$path)) return 'clientarea_auth_refund_renew_upgrade';
        if ($method==='DELETE' && preg_match('~/(?:snapshot|backup)/[1-9][0-9]*$|/disk/[1-9][0-9]*/failed$~D',$path)) return 'clientarea_auth_delete';
        return 'clientarea_auth_control_reinstall_rescue_reset_set_mount';
    }

    /** Native module settings, not a submitted code/flag, decide whether SMS replaces the password. */
    private static function nativeSmsRequired($request): bool
    {
        $path = self::path($request);
        if (!preg_match('~/(mf_cloud|mf_dcim)/([1-9][0-9]*)/(reset_password|reinstall)$~D', $path, $m)) return false;
        $host = HostModel::where('id', (int) $m[2])->where('client_id', get_client_id())->find();
        if (!$host) return false;
        $model = '\\server\\' . $m[1] . '\\model\\ConfigModel';
        $key = $m[3] === 'reinstall' ? 'reinstall_sms_verify' : 'reset_password_sms_verify';
        return (int) $model::where('product_id', $host['product_id'])->value($key) === 1;
    }

    public static function enforce($request, bool $force = false): array
    {
        if ($request->is_api) return ['status'=>200];
        if (preg_match('~/(?:re)?idcsmart_common/host/[1-9][0-9]*/custom/provision$~D', self::path($request))
            && in_array(strtolower((string)$request->param('func')), ['remoteinfo', 'trafficusage'], true)) {
            $request->client_operation_summary = true;
            return ['status'=>200];
        }
        $credentials = strtoupper($request->method()) === 'GET' && (string)$request->param('credentials_only') === '1'
            && preg_match('~/(?:re)?idcsmart_common/host/[1-9][0-9]*/configoption$~D', self::path($request));
        if (!$force && !$credentials && !self::sensitive(self::path($request), strtoupper($request->method()))) return ['status'=>200];
        $clientId = (int) get_client_id();
        if (self::remoteSummary(self::path($request), strtoupper($request->method()), $request->param())) return ['status'=>200];
        if (self::nativeSmsRequired($request)) {
            if ((int) $request->client_operation_phone_verified === $clientId) return ['status'=>200];
            $client = ClientModel::find($clientId);
            if (!$client || empty($client['phone'])) return ['status'=>403, 'msg'=>'该操作需要验证已绑定手机，请先完善账户安全设置'];
            $methods = [['value'=>'phone_code', 'label'=>'短信验证码', 'tip'=>'验证码将发送至已绑定手机', 'phone_code'=>$client['phone_code'], 'account'=>'']];
            if (!$request->param('code')) return self::challenge('verify', $methods, 'native_code');
            // Native business code validates and consumes its own code exactly once.
            // A nonempty code only allows entry into that validator, never grants access.
            return ['status'=>200];
        }
        return self::passwordGate($clientId, $request->param());
    }

    /** Ordinary detail responses never include credentials, including when authorization is still valid. */
    public static function redact($value, array $fieldTypes = [])
    {
        if (is_object($value)) $value = json_decode(json_encode($value), true);
        if (!is_array($value)) return $value;
        // Native product lists separate field definitions from per-host maps.
        // Carry the trusted field types down to those maps before redacting.
        foreach ((array)($value['self_defined_field']??[]) as $field) {
            if (is_array($field) && (int)($field['id']??0)>0 && isset($field['field_type'])) {
                $fieldTypes[(int)$field['id']]=(string)$field['field_type'];
            }
        }
        $secret = '~^(?:password|passwd|rootpass|root_password|rootpassword|panel_pass|panel_password|bmc_password|vnc_password|vnc_pass|operate_password|api_secret|secret_key)$~iD';
        if (($value['field_type'] ?? '') === 'password') { unset($value['value']); $value['verification_required'] = true; }
        if (isset($value['operate_password'])) $value['set_operate_password'] = !empty($value['operate_password']) ? 1 : 0;
        if (isset($value['key']) && is_string($value['key']) && preg_match($secret, $value['key'])) {
            $value['value'] = ''; $value['verification_required'] = true;
        }
        foreach ($value as $key => $item) {
            if (is_string($key) && preg_match($secret, $key)) { unset($value[$key]); continue; }
            if (is_string($key) && preg_match('/^self_defined_field_([1-9][0-9]*)$/D',$key,$match)
                && (!isset($fieldTypes[(int)$match[1]]) || $fieldTypes[(int)$match[1]]==='password')) {
                unset($value[$key]); continue;
            }
            if ($key==='self_defined_field' && (is_array($item)||is_object($item))) {
                $item=(array)$item;
                foreach ($item as $id=>$entry) {
                    if (ctype_digit((string)$id) && !is_array($entry) && !is_object($entry)
                        && (!isset($fieldTypes[(int)$id]) || $fieldTypes[(int)$id]==='password')) unset($item[$id]);
                }
            }
            $value[$key] = self::redact($item,$fieldTypes);
        }
        return $value;
    }

    public static function filterResponse($request, $response)
    {
        if ($request->is_api) return $response;
        $path = self::path($request);
        $payload = $response->getData();
        if (is_array($payload) && (int)($payload['status'] ?? 0) >= 400) {
            $response->data(\CRA1\Theme\Http\CustomerError::payload($payload))->header(['Cache-Control'=>'no-store, private']);
        }
        if ($request->client_operation_summary) return $response->data(self::redact($response->getData()))->header(['Cache-Control'=>'no-store, private']);
        if (strtoupper($request->method()) !== 'GET') return $response;
        if (self::remoteSummary($path, 'GET', $request->param())) {
            // Never depend on provider field names or an existing password grant
            // to decide what a background summary may disclose.
            $data = $response->getData();
            if (is_array($data) && (int)($data['status'] ?? 0) === 200 && is_array($data['data'] ?? null)) {
                $summary = array_intersect_key($data['data'], array_flip(['username','port','rescue','simulate_physical_machine']));
                $data = ['status'=>200, 'data'=>array_filter($summary, 'is_scalar')];
            } else {
                $status = is_array($data) ? (int)($data['status'] ?? 503) : 503;
                $data = ['status'=>in_array($status, [401,403,404], true) ? $status : 503, 'msg'=>'实例信息暂时无法获取，请稍后重试'];
            }
            return $response->data($data)->header(['Cache-Control'=>'no-store, private', 'Pragma'=>'no-cache']);
        }
        if ((string)$request->param('credentials_only') === '1' && preg_match('~/(?:re)?idcsmart_common/host/[1-9][0-9]*/configoption$~D', $path)) {
            $data = $response->getData();
            if (is_array($data) && (int)($data['status'] ?? 0) === 200) {
                $host = $data['data']['host'] ?? [];
                $data['data'] = array_intersect_key(is_array($host) ? $host : [], array_flip(['username','password','port','panel_pass']));
                $data['data']['verification_expires_at'] = self::enabled() ? self::expiresAt((int)get_client_id()) : 0;
                $response->data($data);
            }
            return $response->header(['Cache-Control'=>'no-store, private', 'Pragma'=>'no-cache']);
        }
        // Summary reads always redact, even with a valid grant. Explicit credential reads carry their expiry.
        if (self::sensitive($path, 'GET')) {
            $data = $response->getData();
            if (is_array($data) && isset($data['data']) && is_array($data['data'])) {
                $data['data']['verification_expires_at'] = self::enabled() ? self::expiresAt((int)get_client_id()) : 0;
                $response->data($data);
            }
            return $response->header(['Cache-Control'=>'no-store, private', 'Pragma'=>'no-cache']);
        }
        if (!preg_match('~^/console/v1/(?:account$|(?:home/|client/)?host(?:/|$)|(?:re)?(?:mf_|idcsmart_common))~', $path)) return $response;
        $data = $response->getData();
        if (!is_array($data) && !is_object($data)) return $response;
        return $response->data(self::redact($data))->header(['Cache-Control'=>'no-store, private']);
    }
}
