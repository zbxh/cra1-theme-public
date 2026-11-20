<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;
use CRA1\Theme\Failure;

/** Disable by native selectors; uninstall moves a fixed set of owned paths into a private recovery copy. */
final class Lifecycle
{
    private string $root;
    private ThemeSelection $selection;
    private string $entry;
    private const TEMPLATES=[
        'web_theme'=>['官网','public/web','index.html'],
        'clientarea_theme'=>['会员中心','public/clientarea/template/pc','header.php'],
        'cart_theme'=>['购物车','public/cart/template/pc','shoppingCar.php'],
        'home_theme'=>['产品管理','public/home/template/pc','home.php'],
        'clientarea_theme_mobile'=>['手机会员中心','public/clientarea/template/mobile','header.php'],
        'cart_theme_mobile'=>['手机购物车','public/cart/template/mobile','shoppingCar.php'],
        'home_theme_mobile'=>['手机产品管理','public/home/template/mobile','home.php'],
    ];
    public function __construct(string $root,ThemeSelection $selection)
    {
        $this->root=rtrim($root,'/');$this->selection=$selection;
        $entry=Files::json($this->root.'/runtime/cra1_theme/entry.json')['entry']??'';
        if(!is_string($entry)||!preg_match('/^[a-z][a-z0-9]{5,31}$/D',$entry)||in_array($entry,['console','public','config','upload','plugins','clientarea','cra1-shared','cra1-install'],true))throw new \RuntimeException('主题后台地址记录无效，禁止自动清理，请先检查 runtime/cra1_theme/entry.json');
        $this->entry=$entry;
    }
    public function status(): array
    {
        $settings=$this->selection->read();$state=Files::json($this->root.'/runtime/cra1_theme/lifecycle.json',true);
        $active=in_array('cra1',$settings,true);
        return ['disabled'=>($state['state']??'')==='disabled','selected'=>$active,'can_restore'=>($state['state']??'')==='disabled'&&!empty($state['before']),
            'settings'=>$this->rows($settings,[]),'pending'=>is_file($this->root.'/runtime/cra1-theme-uninstall/pending.json')];
    }
    private function rows(array $settings,array $changes): array
    {
        $rows=[];
        foreach(self::TEMPLATES as$key=>$template)if(isset($settings[$key]))$rows[]=['key'=>$key,'label'=>$template[0],'before'=>$settings[$key],
            'after'=>$changes[$key]??$settings[$key],'changed'=>array_key_exists($key,$changes),'fallback'=>array_key_exists($key,$changes)&&$changes[$key]===''];
        if(isset($changes['clientarea_theme_mobile_switch']))$rows[]=['key'=>'clientarea_theme_mobile_switch','label'=>'手机独立模板','before'=>$settings['clientarea_theme_mobile_switch'],
            'after'=>$changes['clientarea_theme_mobile_switch'],'changed'=>true];
        return $rows;
    }
    private function available(string $base,string $theme,string $entry): bool
    {
        $relative=$base.'/'.$theme;$path=$this->root.'/'.$relative;
        if(is_link($path)){$this->ownedLink($relative);return is_readable($path.'/'.$entry);}
        Files::noLinks($path.'/'.$entry);
        return is_dir($path)&&is_readable($path.'/'.$entry);
    }
    private function ownedLink(string $relative): void
    {
        $path=$this->root.'/'.$relative;Files::noLinks(dirname($path));
        $manifest=Files::json($this->root.'/runtime/cra1_theme/distribution/current.json',true)['manifest']??[];
        $target=$manifest['references'][$relative]??null;
        if(!is_string($target)||!preg_match('~^public/(?:clientarea|cart|home)/template/(?:pc|mobile)/(?:cra1|default)(?:/|$)~D',$target)||strpos($target,'..')!==false
            ||realpath($path)!==realpath($this->root.'/'.$target)||realpath($path)===false)throw new \RuntimeException('拒绝通过未登记的软链接处理主题文件：'.$relative);
    }
    private function targets(): array
    {
        $paths=['public/web/cra1','public/clientarea/template/pc/cra1','public/clientarea/template/mobile/cra1','public/cart/template/pc/cra1','public/cart/template/mobile/cra1',
            'public/home/template/pc/cra1','public/home/template/mobile/cra1','public/cra1-shared','public/'.$this->entry,'public/cra1-install','public/upload/cra1-theme'];
        if($this->entry!=='cra1admin'&&is_dir($this->root.'/public/cra1admin')){
            // An extracted package may leave an unused default entry. Only a genuine theme shell qualifies.
            $bytes=Files::read($this->root.'/public/cra1admin/index.php');
            if(strpos($bytes,"const DEFAULT_ENTRY = 'cra1admin'")===false)throw new \RuntimeException('public/cra1admin/ 中含有未确认归属的文件，本次未清理，请先检查');
            $paths[]='public/cra1admin';
        }
        $paths=array_merge($paths,Manifest::HELPERS,['cra1-theme','config/cra1_theme_security.key','runtime/cra1_theme']);
        $out=[];foreach($paths as$relative){$path=$this->root.'/'.$relative;if(is_link($path))$this->ownedLink($relative);else Files::noLinks($path);if(file_exists($path)||is_link($path))$out[]=$relative;}
        return $out;
    }
    private function identity(array $settings,array $changes,array $targets,string $mode): string
    {
        $stats=[];foreach($targets as$relative){$s=lstat($this->root.'/'.$relative);$stats[$relative]=[$s['dev'],$s['ino']];}
        $pointer=$this->root.'/runtime/cra1_theme/distribution/current.json';
        return hash('sha256',json_encode([$mode,$settings,$changes,$stats,Files::json($this->root.'/runtime/cra1_theme/lifecycle.json',true),is_file($pointer)?hash_file('sha256',$pointer):null]));
    }
    public function plan(string $mode): array
    {
        if(!in_array($mode,['disable','restore','uninstall'],true))throw new \InvalidArgumentException('请选择停用、重新启用或完整卸载');
        $settings=$this->selection->read();$changes=[];$blockers=[];$warnings=[];$targets=[];
        $state=Files::json($this->root.'/runtime/cra1_theme/lifecycle.json',true);
        foreach(['runtime/cra1_theme/distribution/pending.json','runtime/cra1_theme/transfer-pending.json','runtime/cra1-theme-uninstall/pending.json']as$path)if(is_file($this->root.'/'.$path))$blockers[]='上次更新、导入或卸载尚未完成，请先恢复，再重新检查';
        if($mode==='restore'){
            if(($state['state']??'')!=='disabled'||empty($state['before']))$blockers[]='没有可恢复的停用记录';
            foreach($state['changes']??[]as$key=>$value){
                if(($settings[$key]??null)!==$value){$blockers[]='停用后系统主题选择发生变化，本次不会覆盖，请先在 V10 后台核对主题设置';break;}
                if(array_key_exists($key,$state['before']))$changes[$key]=$state['before'][$key];
            }
            foreach($changes as$key=>$value)if($value==='cra1'&&isset(self::TEMPLATES[$key])&&!$this->available(self::TEMPLATES[$key][1],'cra1',self::TEMPLATES[$key][2]))$blockers[]='主题模板缺失：'.self::TEMPLATES[$key][1].'/cra1/，请先完整更新主题';
        }else{
            foreach(self::TEMPLATES as$key=>$template){
                if(($settings[$key]??'')!=='cra1')continue;
                if($this->available($template[1],'default',$template[2]))$changes[$key]='default';
                elseif(strpos($key,'_mobile')!==false){
                    $changes[$key]='';
                    if(!array_key_exists('clientarea_theme_mobile_switch',$settings))$blockers[]='系统缺少手机模板开关，本次不能安全切换手机页面';
                    else $changes['clientarea_theme_mobile_switch']='0';
                    $warnings[]='本站没有完整的手机官方默认模板，将关闭手机独立模板，使用电脑模板的自适应页面';
                }else $blockers[]='官方默认模板不完整：'.$template[1].'/default/'.$template[2].'，请先从对应 V10 官方安装包补齐，再重新检查';
            }
        }
        if($mode==='uninstall'){
            $targets=$this->targets();
            $manifest=Files::json($this->root.'/runtime/cra1_theme/distribution/current.json',true)['manifest']??Files::json($this->root.'/cra1-theme/release.json');
            $hash=$manifest['files']['public/cra1admin/index.php']['sha256']??null;
            if(!is_string($hash)||!hash_equals($hash,hash_file('sha256',$this->root.'/public/'.$this->entry.'/index.php')))$blockers[]='当前后台入口与安装清单不一致，请先完成一次完整主题更新后再卸载';
            $backup=$this->root.'/runtime/cra1-theme-uninstall';Files::noLinks($backup);
            $parent=is_dir($backup)?$backup:dirname($backup);
            if(!is_writable($parent)||!is_executable($parent))$blockers[]=(new Failure('创建卸载备份',$backup.'/卸载记录','Permission denied',0700))->describe($this->root);
            $device=stat($parent)['dev'];
            foreach($targets as$relative){
                $path=$this->root.'/'.$relative;$parent=dirname($path);
                if(!is_writable($parent)||!is_executable($parent))$blockers['permission:'.$parent]=(new Failure('移出目录中的主题文件',$parent,'Permission denied',0755))->describe($this->root);
                if(lstat($path)['dev']!==$device)$blockers[]='主题路径与私有备份不在同一文件系统，不能安全移出：'.$relative;
            }
            $warnings[]='主题上传的图片和会员自定义头像将随主题移出当前站点，卸载后不再显示；系统公共上传目录和插件附件保持原样';
        }
        foreach($changes as$key=>$value)if(($settings[$key]??null)===$value)unset($changes[$key]);
        foreach(ThemeCache::preflight($this->root)as$warning)$warnings[]=$warning;
        return ['mode'=>$mode,'can_apply'=>!$blockers,'token'=>$this->identity($settings,$changes,$targets,$mode),'settings'=>$this->rows($settings,$changes),
            'changes'=>$changes,'before'=>$settings,'targets'=>$targets,'blockers'=>array_values(array_unique($blockers)),'warnings'=>array_values(array_unique($warnings)),
            'kept'=>['V10 客户、产品、订单、付款和工单数据','官方模板、系统文件及第三方插件','系统公共上传文件和插件附件'],
            'backup_parent'=>$mode==='uninstall'?'runtime/cra1-theme-uninstall/':null];
    }
    /** Caller has already checked role, CSRF and a one-use credential bound to this mode and token. */
    public function apply(string $mode,string $token,string $confirmation,callable $finalize): array
    {
        $lock=$GLOBALS['CRA1_THEME_LIFECYCLE_LOCK']??null;
        if(!is_resource($lock))throw new \RuntimeException('主题操作锁未就绪，请刷新页面后重试');
        if(!flock($lock,LOCK_EX|LOCK_NB))throw new \CRA1ThemeSecurityError('还有主题页面或后台操作正在处理，请稍候重新检查。',409,'THEME_BUSY');
        // These classes remain available even after the backend directory has moved.
        class_exists(Failure::class);class_exists(\CRA1\Theme\Diagnostics::class);
        $plan=$this->plan($mode);
        if(!$plan['can_apply'])throw new \RuntimeException(implode('；',$plan['blockers']));
        if(!hash_equals($plan['token'],$token))throw new \CRA1ThemeSecurityError('主题文件或设置已经变化，请重新检查后操作。',409,'LIFECYCLE_PLAN_CHANGED');
        $text=['disable'=>'停用主题','restore'=>'重新启用','uninstall'=>'卸载酷锐A1'];
        if($confirmation!==$text[$mode])throw new \InvalidArgumentException('请准确输入“'.$text[$mode].'”后再确认');
        $stateFile=$this->root.'/runtime/cra1_theme/lifecycle.json';$previous=is_file($stateFile)?Files::read($stateFile):null;
        if($mode==='uninstall')return $this->uninstall($plan,$finalize);
        $state=$mode==='disable'?['state'=>'disabled','before'=>$plan['before'],'changes'=>$plan['changes'],'time'=>time()]:['state'=>'active','time'=>time()];
        // Repeating disable must not discard the original restore information.
        if($mode==='disable'&&$previous!==null){$old=json_decode($previous,true);if(($old['state']??'')==='disabled'&&empty($plan['changes']))$state=$old;}
        ThemeCache::refresh($this->root,[],$this->entry);
        Files::putJson($stateFile,$state,0600);
        try{$this->selection->change($plan['before'],$plan['changes']);}
        catch(\Throwable $error){
            if($previous!==null)Files::atomic($stateFile,$previous,0600);else if(is_file($stateFile))unlink($stateFile);
            throw $error;
        }
        return ['mode'=>$mode,'completed'=>true,'message'=>$mode==='disable'?'主题已停用，当前使用主题的页面已切回官方模板。主题配置、素材和后台账号已保留。':'已恢复停用前的主题选择，配置和素材保持原样。'];
    }
    private function uninstall(array $plan,callable $finalize): array
    {
        $id=gmdate('Ymd-His').'-'.bin2hex(random_bytes(6));$base=$this->root.'/runtime/cra1-theme-uninstall';$backup=$base.'/'.$id;
        Files::directory($backup,0700);Failure::attempt('限制卸载备份访问权限',$base,static function()use($base){return chmod($base,0700);},0700);
        $links=[];foreach($plan['targets']as$relative)if(is_link($this->root.'/'.$relative))$links[$relative]=readlink($this->root.'/'.$relative);
        $restore=['state'=>'disabled','before'=>$plan['before'],'changes'=>$plan['changes'],'time'=>time()];
        $prior=Files::json($this->root.'/runtime/cra1_theme/lifecycle.json',true);
        if(($prior['state']??'')==='disabled'&&!empty($prior['before'])){
            $matches=true;foreach($prior['changes']??[]as$key=>$value)if(($plan['before'][$key]??null)!==$value)$matches=false;
            if($matches)$restore=$prior;
        }
        $journal=['format'=>1,'state'=>'prepared','id'=>$id,'entry'=>$this->entry,'before'=>$plan['before'],'changes'=>$plan['changes'],'restore_state'=>$restore,'paths'=>$plan['targets'],'links'=>$links,'time'=>time()];
        Files::atomic($backup.'/recover.php',Files::read(__DIR__.'/lifecycle-recover.php'),0600);
        Files::putJson($backup.'/record.json',$journal,0600);
        Files::putJson($base.'/pending.json',['id'=>$id],0600);
        $moved=[];$selectionChanged=false;$closed=false;
        try{
            $this->selection->change($plan['before'],$plan['changes']);$selectionChanged=true;
            Files::putJson($this->root.'/runtime/cra1_theme/lifecycle.json',$restore,0600);
            ThemeCache::refresh($this->root,[],$this->entry);
            $journal['state']='moving';Files::putJson($backup.'/record.json',$journal,0600);
            foreach($plan['targets']as$relative){
                if($relative==='runtime/cra1_theme'){
                    // Close/checkpoint the security database only after its final audit record.
                    $finalize('prepare',['backup_root'=>$backup.'/files']);$closed=true;
                }
                $from=$this->root.'/'.$relative;$to=$backup.'/files/'.$relative;Files::directory(dirname($to),0700);
                Failure::attempt('移出主题文件',$from,static function()use($from,$to){return rename($from,$to);});$moved[]=$relative;
            }
            $journal['state']='complete';$journal['completed_at']=time();Files::putJson($backup.'/record.json',$journal,0600);
            Failure::attempt('完成卸载记录',$base.'/pending.json',static function()use($base){return unlink($base.'/pending.json');});
        }catch(\Throwable $error){
            $restoreErrors=[];
            foreach(array_reverse($moved)as$relative){
                $from=$backup.'/files/'.$relative;$to=$this->root.'/'.$relative;
                if(file_exists($to)||is_link($to)||!@rename($from,$to))$restoreErrors[]=$relative;
            }
            // Keep the native default selection: a failed uninstall must never select missing templates.
            $journal['state']=$restoreErrors?'recovery_required':'rolled_back';$journal['selection_changed']=$selectionChanged;$journal['restore_errors']=$restoreErrors;
            try{Files::putJson($backup.'/record.json',$journal,0600);if(!$restoreErrors&&is_file($base.'/pending.json'))unlink($base.'/pending.json');}catch(\Throwable $ignored){}
            if($closed&&!$restoreErrors)try{$finalize('failed',['backup_root'=>$this->root]);}catch(\Throwable $ignored){}
            throw new \RuntimeException('卸载未完成。'.($selectionChanged?'系统已切回官方模板。':'系统主题选择未改变。').($restoreErrors?'部分主题文件需要恢复，请运行私有备份中的 recover.php：':'已恢复移出的主题文件。恢复命令保存在：').'runtime/cra1-theme-uninstall/'.$id.'/recover.php。原因：'.$error->getMessage(),0,$error);
        }
        $auditError=null;
        try{$finalize('complete',['backup_root'=>$backup.'/files']);}catch(\Throwable $error){$auditError=$error->getMessage();}
        return ['mode'=>'uninstall','completed'=>true,'backup'=>'runtime/cra1-theme-uninstall/'.$id.'/','audit_ok'=>$auditError===null,
            'message'=>'主题已从当前站点卸载，主题后台已关闭。客户、订单、产品、工单及第三方插件保持原样。',
            'warning'=>$auditError===null?null:'卸载已经完成，但最终审计记录写入失败。请保留私有备份并检查其中的安全数据库。原因：'.$auditError,
            'recovery'=>'需要恢复时，由服务器管理员在网站根目录运行：php runtime/cra1-theme-uninstall/'.$id.'/recover.php'];
    }
}
