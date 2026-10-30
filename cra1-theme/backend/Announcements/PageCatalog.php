<?php
declare(strict_types=1);
namespace CRA1\Theme\Announcements;

use CRA1\Theme\Files;

/** Display pages, independent of the administrator's much smaller editor list. */
final class PageCatalog
{
    private string $root;
    private ?array $entries = null;
    private ?array $plugins;
    public function __construct(string $root, ?array $plugins = null) { $this->root = rtrim($root, '/'); $this->plugins = $plugins; }

    public function entries(): array
    {
        if ($this->entries !== null) return $this->entries;
        $out = [];
        $add = static function(string $theme, string $id, string $label, string $category, array $paths) use (&$out): void {
            $out[$theme.':'.$id] = ['id'=>$id,'theme'=>$theme,'label'=>$label,'category'=>$category,'paths'=>$paths];
        };
        $schemaFile=defined('CRA1_THEME_BACKEND')?CRA1_THEME_BACKEND.'/Storage/workspace_schema.json':$this->root.'/cra1-theme/backend/Storage/workspace_schema.json';
        $schema = Files::json($schemaFile);
        foreach ($schema['pages'] as $id=>$page) {
            $paths = [(string)$page['route']];
            if ($id==='home') $paths = array_merge($paths, ['/index.html','/index.php']);
            foreach ($schema['pageAliases'] ?? [] as $alias=>$spec) if (($spec['aliasOf']??'')===$id) $paths[]=$spec['route']??'/'.$alias.'.html';
            $add('website',(string)$id,$page['label'],$page['category']??'其他页面',array_values(array_unique($paths)));
        }
        $add('website','notifications','所有通知','资讯与文档',['/notifications.html']);
        $member = [
            'home'=>['首页','常用页面',['/home.htm']], 'products'=>['产品列表','常用页面',['/productList.htm','/product_list.htm','/product.htm']],
            'server'=>['服务器控制面板','常用页面',['/productdetail.htm']], 'account'=>['账户信息','账户与安全',['/account.htm']],
            'security'=>['安全中心','账户与安全',['/security.htm']], 'ssh'=>['SSH 密钥','账户与安全',['/security_ssh.htm']],
            'security-group'=>['安全组','账户与安全',['/security_group.htm','/group_rules.htm']], 'security-log'=>['操作日志','账户与安全',['/security_log.htm']],
            'finance'=>['财务中心','财务与订单',['/finance.htm']], 'recharge'=>['充值','财务与订单',['/recharge.htm']],
            'withdrawal'=>['提现','财务与订单',['/withdrawal.htm']], 'transfer'=>['余额转账','财务与订单',['/transfer.htm']],
            'order'=>['订单详情','财务与订单',['/orderDetail.htm']], 'cashier'=>['收银台','财务与订单',['/cashier.htm']],
            'embedded'=>['内嵌页面','资讯与其他',['/custom_iframe.htm']], 'news'=>['资讯详情','资讯与其他',['/newsView.htm']],
            'login'=>['登录','登录与注册',['/login.htm']], 'regist'=>['注册','登录与注册',['/regist.htm']],
            'forget'=>['找回密码','登录与注册',['/forget.htm']], 'oauth'=>['第三方登录','登录与注册',['/oauth.htm']],
            'agreement'=>['协议页面','资讯与其他',['/agreement.htm']], 'cross-module'=>['跨模块产品','常用页面',['/crossModule.htm']],
            '404'=>['404 页面','资讯与其他',['/404.htm']], 'permission'=>['无权限页面','资讯与其他',['/noPermissions.htm']],
            'network-error'=>['网络错误页面','资讯与其他',['/networkErro.htm']],
        ];
        foreach ($member as $id=>[$label,$group,$paths]) $add('member',(string)$id,$label,$group,$paths);
        foreach (['goodsList'=>['商品列表','商品页面'],'goods'=>['商品选配','商品页面'],'goods_iframe'=>['嵌入选配','商品页面'],'goods_embed'=>['商品嵌入','商品页面'],'index_iframe'=>['嵌入商品列表','商品页面'],'shoppingCar'=>['购物车','订单页面'],'settlement'=>['结算','订单页面'],'orderResult'=>['订单结果','订单页面']] as $id=>[$label,$group]) $add('cart',$id,$label,$group,['/cart/'.$id.'.htm']);
        foreach ($this->plugins() as $plugin) {
            if ((int)($plugin['status']??0)!==1 || !preg_match('/^[A-Za-z][A-Za-z0-9_]*$/D',(string)($plugin['name']??''))) continue;
            $folder=strtolower(preg_replace('/(?<!^)[A-Z]/','_$0',$plugin['name']));
            $module=$plugin['module']??'addon';
            if (!in_array($module,['addon','server','reserver'],true)) continue;
            $base=$this->root.'/public/plugins/'.$module.'/'.$folder;
            if (!is_dir($base)) continue;
            $known=['authentication_status'=>'认证状态','authentication_thrid'=>'第三方认证','file_download'=>'文件下载','product_detail'=>'产品详情','product_list'=>'产品列表','self_change_ip'=>'自助更换 IP','unified_expiry'=>'统一到期日期','msgDetail'=>'消息详情','index'=>'功能首页','applyContract'=>'申请合同','contractDetail'=>'合同详情','signContract'=>'签署合同','invoice'=>'发票','issuedInvoice'=>'已开发票','buyDomain'=>'域名购买','creatTemplate'=>'域名资料模板','domain_list'=>'域名列表','whois'=>'域名信息','recommend'=>'推荐计划','ticket'=>'工单中心','ticketDetails'=>'工单详情','addTicket'=>'提交工单','source'=>'内容列表','news_detail'=>'内容详情','helpTotal'=>'文档中心','help_detail'=>'文档详情','authentication_select'=>'实名认证','authentication_person'=>'个人认证','authentication_company'=>'企业认证','childAccount'=>'子账户','addChildAccount'=>'新增子账户'];
            $views=array_map(static function(string $file): string { return pathinfo($file,PATHINFO_FILENAME); },glob($base.'/template/clientarea/pc/default/*.{html,php}',GLOB_BRACE)?:[]);
            // These pages are rendered by our ViewClientController adapter even
            // when an older announcement package has no pc/default directory.
            if ($plugin['name']==='IdcsmartAnnouncement' && $module==='addon') $views=array_merge($views,['source','news_detail']);
            foreach (array_unique($views) as $view) {
                if (!preg_match('/^[A-Za-z][A-Za-z0-9_-]*$/D',$view) || in_array($view,['header','footer'],true)) continue;
                $id='plugin:'.$plugin['name'].':'.$view;
                $url='/plugin/'.(int)$plugin['id'].'/'.$view.'.htm';
                if ($module!=='addon') { $id='module:'.$folder.':'.$view; $url='/module/'.$folder.'/'.$view.'.htm'; }
                $add('member',$id,$known[$view]??$view,(string)($plugin['title']??'扩展页面'),[$url]);
            }
        }
        return $this->entries=$out;
    }

    private function plugins(): array
    {
        if ($this->plugins!==null) return $this->plugins;
        $this->plugins=[];
        if (!is_file($this->root.'/config.php')) return [];
        try {
            require_once $this->root.'/config.php';
            if (!defined('DATABASE_HOSTNAME')) return [];
            $db=new \PDO('mysql:host='.DATABASE_HOSTNAME.';port='.DATABASE_PORT.';dbname='.DATABASE_NAME.';charset='.DATABASE_CHARSET,DATABASE_USERNAME,DATABASE_PASSWORD,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_TIMEOUT=>2]);
            $this->plugins=\CRA1\Theme\Compatibility\Database::query($db,'SELECT id,name,title,module,status FROM idcsmart_plugin WHERE status=1')->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\Throwable $e) { error_log('CRA1 announcement extension pages unavailable'); }
        return $this->plugins;
    }

    public function resolve(string $theme, string $path): ?array
    {
        if (!in_array($theme,['website','member','cart'],true) || strlen($path)>2048 || strpos($path,'://')!==false || strpos($path,'//')===0) return null;
        $path=parse_url($path,PHP_URL_PATH);
        if (!is_string($path) || strpos($path,'..')!==false || preg_match('/[%\\\\\x00-\x1f]/',$path)) return null;
        $path='/'.ltrim($path,'/');
        foreach ($this->entries() as $entry) if ($entry['theme']===$theme && in_array($path,$entry['paths'],true)) return $entry;
        return null;
    }
    public function page(string $theme, string $id): ?array { return $this->entries()[$theme.':'.$id]??null; }
    public function publicList(): array { return array_values($this->entries()); }
}
