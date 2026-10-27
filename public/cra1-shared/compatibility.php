<?php
/** Theme-only authenticated response projections. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }
final class CRA1ThemeCompatibility
{
    /** Match the native JSON wire contract, including Models and Collections. */
    public static function payload($value): array
    {
        $json = is_string($value) ? $value : json_encode($value, JSON_THROW_ON_ERROR);
        $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data)) throw new \UnexpectedValueException('Invalid native response structure');
        return $data;
    }
    public static function route(string $path): string
    {
        // The native dashboard authenticates every member, including children
        // without account-edit permission. Do not require Account::index here.
        if ($path === '/access') return '/index';
        if (preg_match('~^/host/([1-9][0-9]*)/field/([1-9][0-9]*)$~D', $path, $m)) return '/cra1-theme/member/host/'.$m[1].'/field/'.$m[2];
        if (preg_match('~^/host/([1-9][0-9]*)$~D', $path, $m)) return '/host/'.$m[1];
        if (preg_match('~^/host/([1-9][0-9]*)/app-preset-task/([1-9][0-9]*)/log$~D',$path,$m)) return '/mf_cloud/'.$m[1].'/app_preset_task/'.$m[2].'/log';
        return '';
    }
    public static function host(array $data): array
    {
        $fields = [];
        foreach (($data['self_defined_field'] ?? []) as $f) {
            if (!is_array($f)) continue;
            $row = array_intersect_key($f, array_flip(['id','field_name','field_type','value','description','options']));
            if (($row['field_type'] ?? '') === 'password') { unset($row['value']); $row['verification_required'] = true; }
            $fields[] = $row;
        }
        $data['self_defined_field'] = $fields;
        return $data;
    }
    public static function log(array $data): array
    {
        $clean=static function($text): string {
            $lines=preg_split('/\r?\n/',(string)$text);$result=[];
            foreach($lines as $line){
                if(preg_match('~password|passwd|secret|token|credential|authorization|private.?key|密码|口令|凭据~i',$line))$line='[敏感信息已隐藏]';
                if(preg_match('~魔方云|idcsmart|mf_cloud|mf_dcim|SQLSTATE|/www/|stack trace|upstream|provider~i',$line))$line='[内部诊断信息已隐藏]';
                $result[]=$line;
            }return implode("\n",$result);
        };
        $result=[];
        if(isset($data['full_log']))$result['full_log']=$clean($data['full_log']);
        $result['logs']=[];
        foreach($data['logs']??[] as $line) if(is_array($line))$result['logs'][]=['create_time'=>$line['create_time']??0,'message'=>$clean($line['message']??'')];
        return $result;
    }
    public static function access(int $clientId, array $account=[]): array
    {
        $all = true; $rules = []; $actions = [];
        $plugin = \think\facade\Db::name('plugin')->where('name','IdcsmartSubAccount')->where('status',1)->find();
        if ($plugin) {
            $child = \think\facade\Db::name('addon_idcsmart_sub_account')->where('client_id',$clientId)->find();
            if ($child) {
                $all = false; $ids = json_decode((string)$child['auth'],true) ?: [];
                $rules = (new \addon\idcsmart_sub_account\model\IdcsmartSubAccountModel())->getSubAccountAuthRule($clientId);
                $groups = \think\facade\Db::name('clientarea_auth')->whereIn('id',$ids ?: [-1])->column('title');
                $map = ['power'=>'clientarea_auth_on_off_restart','control'=>'clientarea_auth_control_reinstall_rescue_reset_set_mount','billing'=>'clientarea_auth_refund_renew_upgrade','delete'=>'clientarea_auth_delete'];
                foreach ($map as $key=>$group) $actions[$key] = in_array($group,$groups,true);
            }
        }
        $known = \think\facade\Db::name('clientarea_auth_rule')->column('name');
        $requiredProfile=false;
        foreach(hook('common_custom_fields') as $h) if((int)($h['status'] ?? 0)===200 && !empty($h['data']['before_settle'])) $requiredProfile=true;
        $required=array_filter(explode(',',(string)configuration('home_enforce_safe_method')));
        if ($required) {
            $own=\think\facade\Db::name('client')->where('id',$clientId)->fieldRaw('phone,email,CASE WHEN operate_password <> \'\' THEN 1 ELSE 0 END AS set_operate_password')->find();
            $account=array_merge($account,$own ?: []);
            if(in_array('oauth',$required,true))$account['oauth']=[['link'=>\think\facade\Db::name('oauth')->where('client_id',$clientId)->count()>0]];
        }
        $missing=[];
        foreach ($required as $method) {
            $has=['phone'=>!empty($account['phone']),'email'=>!empty($account['email']),'operate_password'=>!empty($account['set_operate_password']),'oauth'=>count(array_filter($account['oauth'] ?? [], static function($o){return !empty($o['link']);}))>0];
            if(isset($has[$method]) && !$has[$method]) $missing[]=['label'=>['phone'=>'绑定手机号','email'=>'绑定邮箱','operate_password'=>'设置操作密码','oauth'=>'关联第三方账户'][$method],'url'=>$method==='operate_password'?'/account.htm?tab=security&section=operate_password':'/account.htm?tab=security'];
        }
        if (in_array('certification',$required,true)) {
            $certPlugin=\think\facade\Db::name('plugin')->where('module','addon')->where('name','IdcsmartCertification')->where('status',1)->field('id')->find();
            if ($certPlugin) {
                $cert=hook_one('certification_detail',['client_id'=>$clientId]);
                if (!empty($cert) && is_array($cert) && empty($cert['person']) && empty($cert['company'])) $missing[]=['label'=>'完成实名认证','url'=>'/plugin/'.(int)$certPlugin['id'].'/authentication_select.htm'];
            }
        }
        return ['required_profile'=>$requiredProfile,'security'=>$missing,'all'=>$all,'rules'=>array_values($rules),'known'=>array_values($known),'actions'=>$actions];
    }
}
