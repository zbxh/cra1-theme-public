<?php
/** Theme-only runtime projection. No arbitrary setting lookup is exposed to HTTP. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

final class CRA1ThemePublicProjection
{
    public static function content(array $value): array
    {
        if (array_key_exists('enabled', $value) && !$value['enabled']) return ['enabled' => 0];
        $result = [];
        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $list = $item === [] || array_keys($item) === range(0, count($item) - 1);
                if ($list) {
                    $result[$key] = [];
                    foreach ($item as $row) {
                        if (is_array($row) && ((isset($row['enabled']) && !$row['enabled']) || !empty($row['hidden']))) continue;
                        $result[$key][] = is_array($row) ? self::content($row) : $row;
                    }
                } else $result[$key] = self::content($item);
            } else $result[$key] = $item;
        }
        return $result;
    }

    public static function capabilities(?PDO $db): array
    {
        if (!$db) return ['plugins'=>[],'features'=>['recharge_open'=>0,'withdraw_open'=>0]];
        $settings=[]; $plugins=[];
        try {
            $rows=\CRA1\Theme\Compatibility\Database::query($db,"SELECT setting,value FROM idcsmart_configuration WHERE setting IN ('recharge_open','recharge_min','recharge_max','recharge_notice','recharge_money_notice_content','recharge_pay_notice_content')")->fetchAll(PDO::FETCH_ASSOC);
            foreach($rows as $row)$settings[$row['setting']]=$row['value'];
        } catch(Throwable $e) { error_log('CRA1 recharge settings unavailable'); }
        try {
            foreach(\CRA1\Theme\Compatibility\Database::query($db,"SELECT id,name FROM idcsmart_plugin WHERE module='addon' AND status=1")->fetchAll(PDO::FETCH_ASSOC) as $p)$plugins[$p['name']]=(int)$p['id'];
        } catch(Throwable $e) { error_log('CRA1 plugin capabilities unavailable'); }
        $features=['recharge_open'=>(int)($settings['recharge_open']??0)===1?1:0,'withdraw_open'=>0];
        if($features['recharge_open']) {
            foreach(['recharge_min','recharge_max'] as $key)$features[$key]=(string)($settings[$key]??'');
            if((int)($settings['recharge_notice']??0)===1){$features['recharge_money_notice']=(string)($settings['recharge_money_notice_content']??'');$features['recharge_pay_notice']=(string)($settings['recharge_pay_notice_content']??'');}
        }
        if(isset($plugins['IdcsmartWithdraw'])) {
            try {
                $row=\CRA1\Theme\Compatibility\Database::query($db,"SELECT status FROM idcsmart_addon_idcsmart_withdraw_rule WHERE source='credit' LIMIT 1")->fetch(PDO::FETCH_ASSOC);
                $features['withdraw_open']=!$row||(int)$row['status']===1?1:0;
            } catch(Throwable $e) { error_log('CRA1 withdrawal capability unavailable'); }
        }
        return ['plugins'=>$plugins,'features'=>$features];
    }

    public static function member(array $data,array $caps): array
    {
        $plugins=$caps['plugins']??[];$features=$caps['features']??[];
        if(!isset($plugins['IdcsmartTicket']))$data['content']['ticket_assist']=['enabled'=>0];
        if(!isset($plugins['IdcsmartNews']))$data['content']['home_news']=['enabled'=>0];
        if(!isset($plugins['IdcsmartCertification']))unset($data['content']['home_security']['items']['certification']);
        $defaults=['ql-ticket'=>['IdcsmartTicket','ticket.htm'],'ql-subuser'=>['IdcsmartSubAccount','childAccount.htm'],'ql-news'=>['IdcsmartNews','source.htm']];
        $filter=function(array $nodes)use(&$filter,$plugins,$features,$defaults):array{
            $out=[];
            foreach($nodes as $node){
                if(!is_array($node))continue;
                if(isset($defaults[$node['id']??''])){
                    [$plugin,$view]=$defaults[$node['id']];$original=(string)($node['url']??'');
                    if($original===''||$original==='home.htm'||preg_match('~^/?plugin/[0-9]+/'.preg_quote($view,'~').'(?:[?#]|$)~',$original)){
                        if(!isset($plugins[$plugin]))continue;$node['url']='plugin/'.$plugins[$plugin].'/'.$view;
                    }
                }
                $url=(string)($node['url']??'');
                if(preg_match('~^/?plugin/([0-9]+)/~',$url,$m)&&!in_array((int)$m[1],array_values($plugins),true))continue;
                if(preg_match('~(?:^|/)withdrawal\.htm~',$url)&&empty($features['withdraw_open']))continue;
                if(preg_match('~(?:^|/)recharge\.htm~',$url)&&empty($features['recharge_open']))continue;
                foreach(['children','items'] as $key)if(isset($node[$key])&&is_array($node[$key]))$node[$key]=$filter($node[$key]);
                $out[]=$node;
            }return $out;
        };
        if(isset($data['content']['home_quick_links']['items']))$data['content']['home_quick_links']['items']=$filter($data['content']['home_quick_links']['items']);
        $data['sidebar']=$filter($data['sidebar']??[]);
        $data['features']=$features;
        return $data;
    }

    public static function code(array $code): array
    {
        $result = ['css_enabled' => !empty($code['css_enabled']), 'js_enabled' => !empty($code['js_enabled'])];
        if ($result['css_enabled']) $result['css'] = (string)($code['css'] ?? '');
        if ($result['js_enabled']) $result['js'] = (string)($code['js'] ?? '');
        return $result;
    }
}

final class CRA1ThemeRuntime
{
    /** Pure projection, used by PHP fixtures as well as rendered theme pages. */
    public static function project(array $s, array $plugins, string $page, array $extra = []): array
    {
        $on = static function ($key) use ($s): bool { return (int)($s[$key] ?? 0) === 1; };
        $common = [];
        foreach (['copyright_info','enterprise_address','enterprise_mailbox','enterprise_name','enterprise_telephone','website_name','website_url','terms_service_url','terms_privacy_url','currency_code','currency_prefix','currency_suffix','system_logo','clientarea_logo_url','clientarea_logo_url_blank'] as $key) {
            if (isset($s[$key])) $common[$key] = $s[$key];
        }
        $locale = ['current' => (string)($s['lang_home'] ?? 'zh-cn')];
        if ($on('lang_home_open')) {
            $locale['choices'] = $extra['languages'] ?? [];
            $common['lang_list'] = $locale['choices'];
            $common['lang_home_open'] = 1;
        } else $common['lang_list'] = [];
        if ($page!=='website') foreach(['copyright_info','enterprise_address','enterprise_mailbox','enterprise_name','enterprise_telephone'] as $key)unset($common[$key]);
        $common['lang_home'] = $locale['current'];
        $common['lang_home_follow_browser'] = $on('lang_home_follow_browser') ? 1 : 0;
        $links = [];
        foreach ($plugins as $p) {
            if ((int)($p['status'] ?? 0) !== 1 || (int)($p['id'] ?? 0) < 1) continue;
            $name = strtolower((string)($p['name'] ?? ''));
            $views = ['idcsmartcertification'=>['certification','authentication_select.htm'], 'idcsmartticket'=>['ticket','ticket.htm'], 'idcsmartnews'=>['news','source.htm'], 'idcsmartsubaccount'=>['subaccount','childAccount.htm']];
            if (isset($views[$name])) $links[$views[$name][0]] = '/plugin/'.(int)$p['id'].'/'.$views[$name][1];
        }
        $activeNames=array_map('strtolower',array_column(array_filter($plugins,static function($p){return (int)($p['status'] ?? 0)===1;}),'name'));
        $features=[]; foreach (['renew'=>'idcsmartrenew','refund'=>'idcsmartrefund','flow_packet'=>'flowpacket','unified_expiry'=>'unifiedexpiry','ticket'=>'idcsmartticket','news'=>'idcsmartnews','announcement'=>'idcsmartannouncement','client_care'=>'clientcare','certification_available'=>'idcsmartcertification','ssh'=>'idcsmartsshkey','security_group'=>'idcsmartcloud'] as $cap=>$plugin) $features[$cap]=in_array($plugin,$activeNames,true);
        $features += ['recharge_open' => 0, 'withdraw_open' => !empty($extra['withdraw']) ? 1 : 0];
        if ($on('recharge_open')) {
            $features['recharge_open'] = 1;
            $common['recharge_open'] = 1;
            foreach (['recharge_min','recharge_max'] as $key) { $features[$key] = (string)($s[$key] ?? ''); $common[$key] = $features[$key]; }
            if ($on('recharge_notice')) {
                foreach (['recharge_money_notice_content','recharge_pay_notice_content'] as $key) $common[$key] = (string)($s[$key] ?? '');
                $features['recharge_money_notice'] = $common['recharge_money_notice_content'];
                $features['recharge_pay_notice'] = $common['recharge_pay_notice_content'];
            }
            if (!empty($extra['recharge_certification']) && isset($links['certification'])) $features['certification'] = ['recharge_need' => 1];
        }
        if ($page==='website' && isset($extra['feedback_type'])) $common['feedback_type']=$extra['feedback_type'];
        if (isset($s['theme_header_support'])) $common['theme_header_support'] = $s['theme_header_support'];
        $auth = ['login' => [], 'register' => [], 'reset' => ['email'], 'associate'=>['email','phone'], 'captcha' => []];
        foreach (['email-password'=>'login_email_password','phone-password'=>'login_phone_password','phone-code'=>'login_phone_verify'] as $id=>$key) if ($on($key)) $auth['login'][] = $id;
        foreach (['email','phone'] as $type) if ($on('register_'.$type)) {
            $auth['register'][] = ['type'=>$type,'code'=>$on('code_client_'.$type.'_register')];
            if ($type==='phone') $auth['reset'][] = $type;
        }
        $preferred = ($s['first_login_method'] ?? '') === 'code' ? 'phone-code' : (($s['first_password_login_method'] ?? '') === 'email' ? 'email-password' : 'phone-password');
        $auth['preferred'] = in_array($preferred, $auth['login'], true) ? $preferred : ($auth['login'][0] ?? '');
        foreach (['login','register','password_reset','oauth','verify','update','security_verify'] as $scene) if ($on('captcha_client_'.$scene)) $auth['captcha'][$scene] = true;
        if ($on('captcha_client_login_error')) $auth['captcha_on_failure'] = true;
        if (!empty($extra['qr_login'])) $auth['qr'] = ['preferred'=>($s['first_login_type'] ?? '')==='mp_weixin_notice'];
        if ($on('client_strong_password_rule')) $auth['password_rule'] = 'strong';
        if (in_array($page, ['login','regist','forget','oauth'], true)) {
            $auth['providers'] = $extra['oauth'] ?? [];
            if ($page==='regist' && isset($extra['sales'])) $auth['sales']=$extra['sales'];
            if ($on('login_register_redirect_show') && !empty($s['login_register_redirect_url'])) $auth['external'] = ['text'=>(string)($s['login_register_redirect_text'] ?? ''),'url'=>$s['login_register_redirect_url'],'blank'=>$on('login_register_redirect_blank')];
        }
        if ($on('cart_instruction')) { $common['cart_instruction'] = 1; $common['cart_instruction_content'] = (string)($s['cart_instruction_content'] ?? ''); }
        $common['cart_change_product'] = $on('cart_change_product') ? 1 : 0;
        foreach (['first_navigation','second_navigation'] as $key) $common[$key] = (string)($s[$key] ?? '');

        $common['prohibit_user_information_changes'] = array_values(array_filter(explode(',', (string)($s['prohibit_user_information_changes'] ?? ''))));
        // Compatibility signals required by native theme components, without unused content.
        foreach (['login_email_password','login_phone_password','login_phone_verify','register_email','register_phone','code_client_email_register','code_client_phone_register','client_strong_password_rule','balance_notice_show','donot_save_client_product_password'] as $key) if ($on($key)) $common[$key] = 1;
        foreach ($auth['captcha'] as $scene=>$yes) $common['captcha_client_'.$scene] = 1;
        $required = array_values(array_filter(explode(',', (string)($s['home_enforce_safe_method'] ?? ''))));
        if ($required) $common['home_enforce_safe_method'] = $required;
        if ($page !== 'recharge') {
            unset($features['recharge_min'],$features['recharge_max'],$features['recharge_money_notice'],$features['recharge_pay_notice'],$features['certification']);
            foreach (['recharge_min','recharge_max','recharge_money_notice_content','recharge_pay_notice_content'] as $key) unset($common[$key]);
        }
        if (!in_array($page,['goods','goodsList','goods_iframe','goods_embed','shoppingCar','settlement','orderResult'],true)) foreach (['cart_instruction','cart_instruction_content','cart_change_product','first_navigation','second_navigation','custom_fields'] as $key) unset($common[$key]);
        if (!in_array($page,['account','security','security_ssh','security_group','security_log'],true)) unset($common['prohibit_user_information_changes']);
        if (!in_array($page,['login','regist','forget','oauth','account','security'],true)) {
            foreach (array_keys($common) as $key) if (preg_match('/^(?:login_|register_|code_client_|client_strong_)/',$key)) unset($common[$key]);
            $auth = [];
        }
        unset($common['home_enforce_safe_method']);
        return ['projection_version'=>2,'page'=>$page,'common'=>$common,'auth'=>$auth,'features'=>$features,'links'=>$links,'locale'=>$locale,'client_custom_fields'=>!empty($extra['client_custom_fields']),'app_presets'=>!empty($extra['app_presets']),'traffic_modules'=>$extra['traffic_modules'] ?? []];
    }

    public static function load(string $page): array
    {
        return \CRA1\Theme\Compatibility\Capabilities::attempt('projection:'.$page, static function()use($page){ return self::loadPage($page); }, []);
    }

    private static function loadPage(string $page): array
    {
        try {
            $keys = ['copyright_info','enterprise_address','enterprise_mailbox','enterprise_name','enterprise_telephone','website_name','website_url','terms_service_url','terms_privacy_url','currency_code','currency_prefix','currency_suffix','system_logo','clientarea_logo_url','clientarea_logo_url_blank','lang_home','lang_home_open','lang_home_follow_browser','login_email_password','login_phone_password','login_phone_verify','first_login_type','captcha_client_login_error','first_login_method','first_password_login_method','register_email','register_phone','code_client_email_register','code_client_phone_register','client_strong_password_rule','recharge_open','recharge_min','recharge_max','recharge_notice','recharge_money_notice_content','recharge_pay_notice_content','cart_instruction','cart_instruction_content','cart_change_product','first_navigation','second_navigation','prohibit_user_information_changes','home_enforce_safe_method','balance_notice_show','donot_save_client_product_password','login_register_redirect_show','login_register_redirect_text','login_register_redirect_url','login_register_redirect_blank'];
            foreach (['login','register','password_reset','oauth','verify','update','security_verify'] as $scene) $keys[] = 'captcha_client_'.$scene;
            $s = configuration($keys);
            if ($page==='website') $extraFeedback=\CRA1\Theme\Compatibility\Capabilities::attempt('feedback', static function(){return (new \app\common\model\FeedbackTypeModel())->feedbackTypeList();}, []);
            \CRA1\Theme\Compatibility\Capabilities::attempt('header-support', static function()use(&$s){
            if (is_file(IDCSMART_ROOT.'public/web/cra1/controller/Cra1.php')) {
                require_once IDCSMART_ROOT.'public/web/cra1/controller/Cra1.php';
                if (function_exists('cra1_support_render_config')) { $theme = new \template\cra1\controller\Cra1(); $s['theme_header_support'] = \cra1_support_render_config($theme->resolvedConfig(),$s); }
            }
            return $s['theme_header_support']??null;
            });
            $support=\CRA1\Theme\Compatibility\Capabilities::attempt('header-support',static function(){return null;});
            if ($support!==null) $s['theme_header_support']=$support;
            if (!empty($s['system_logo'])) $s['system_logo'] = config('idcsmart.system_logo_url').$s['system_logo'];
            $plugins = \CRA1\Theme\Compatibility\Capabilities::attempt('plugins', static function(){return \think\facade\Db::name('plugin')->where('module','addon')->where('status',1)->field('id,name,status')->select()->toArray();}, []);
            $extra = ['feedback_type'=>$extraFeedback['list'] ?? [],'languages'=>\CRA1\Theme\Compatibility\Capabilities::attempt('languages',static function(){return function_exists('lang_list') ? lang_list('home') : [];},[])];
            foreach ($plugins as $p) {
                if (strtolower($p['name']) === 'clientcustomfield') $extra['client_custom_fields'] = true;
                if (strtolower($p['name']) === 'idcsmartcertification') {
                    $c = \CRA1\Theme\Compatibility\Capabilities::attempt('cert-config', static function()use($p){return \think\facade\Db::name('plugin')->where('id',$p['id'])->value('config');}, ''); $c = json_decode((string)$c,true) ?: [];
                    $extra['recharge_certification'] = !empty($c['certification_open']) && !empty($c['certification_recharge']);
                }
                if (strtolower($p['name']) === 'idcsmartwithdraw') {
                    try { $withdrawStatus=\think\facade\Db::name('addon_idcsmart_withdraw_rule')->where('source','credit')->value('status'); $extra['withdraw'] = $withdrawStatus === null || (int)$withdrawStatus === 1; } catch (\Throwable $e) { $extra['withdraw'] = false; }
                }
            }
            if (in_array($page,['login','oauth','account'],true)) {
                $oauth = \CRA1\Theme\Compatibility\Capabilities::attempt('oauth', static function(){return (new \app\admin\model\PluginModel())->oauthList();}, []);
                $extra['oauth'] = array_map(static function ($p) { return array_intersect_key($p,array_flip(['name','title','url','img','logo'])); }, $oauth['list'] ?? []);
            }
            $pluginConfig=in_array($page,['login','regist'],true) ? \CRA1\Theme\Compatibility\Capabilities::attempt('plugin-configuration',static function(){return (array)hook('common_plugin_configuration');},[]) : [];
            if ($page==='login') foreach ($pluginConfig as $h) if ((int)($h['status'] ?? 0)===200 && (int)($h['data']['mp_weixin_notice']['scan_login'] ?? 0)===1) $extra['qr_login']=true;
            if ($page==='regist') foreach ($pluginConfig as $h) { $sale=$h['data']['idcsmart_sale'] ?? []; if (($h['status'] ?? 0)===200 && isset($sale['register_hide_sale']) && (int)$sale['register_hide_sale']===0) $extra['sales']=['required'=>false,'select'=>(int)($sale['register_select_sale'] ?? 0)===1,'list'=>array_map(static function($r){return array_intersect_key($r,array_flip(['sale_number','name']));},$sale['sales'] ?? [])]; }
            
            foreach (['mf_cloud','mf_dcim'] as $module) if (\CRA1\Theme\Compatibility\Capabilities::module($module, ['detail'])) $extra['traffic_modules'][] = $module;
            $extra['app_presets'] = \CRA1\Theme\Compatibility\Capabilities::appPresets();
            return self::project($s,$plugins,$page,$extra);
        } catch (\Throwable $e) {
            error_log('CRA1 theme runtime projection unavailable');
            return ['projection_version'=>2,'page'=>$page,'error'=>true,'common'=>[],'auth'=>['login'=>[],'register'=>[],'reset'=>[],'captcha'=>[]],'features'=>['recharge_open'=>0,'withdraw_open'=>0],'links'=>[]];
        }
    }
}
