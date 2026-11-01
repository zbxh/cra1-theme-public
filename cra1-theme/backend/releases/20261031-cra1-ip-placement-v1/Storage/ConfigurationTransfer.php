<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;

use CRA1\Theme\Files;

/** Full theme settings only. Installation identities and business databases are never transferable. */
final class ConfigurationTransfer
{
    public const MAX_BYTES=8388608;
    public const DEFAULT_HISTORY_LIMIT=20;
    private const FILES=['website'=>'config.json','member'=>'member_center.json','cart'=>'cart_theme.json','notifications'=>'announcements.json'];
    private const SNAPSHOTS=['member_center_public.json','cart_theme_public.json'];
    private string $root;
    private string $dir;
    private $writer;
    private ?array $catalog;
    public function __construct(string $root,?callable $writer=null,?array $catalog=null){$this->root=$root;$this->dir=$root.'/runtime/cra1_theme';$this->writer=$writer??static function($p,$b){Files::atomic($p,$b,0600);};$this->catalog=$catalog;}
    private function menu(): MenuTransfer { return new MenuTransfer($this->root,$this->catalog); }
    private function locked(callable $work)
    {
        $paths=['config.json','member_center.json','cart_theme.json','announcements.json'];
        $run=function(int $i)use(&$run,$paths,$work){return isset($paths[$i])?Files::locked($this->dir.'/'.$paths[$i].'.lock',function()use($i,&$run){return $run($i+1);}):$work();};
        return Files::locked($this->dir.'/transfer.lock',function()use($run){return $run(0);});
    }
    private function raw(): array { $out=[];foreach(self::FILES as$domain=>$file)$out[$domain]=Files::json($this->dir.'/'.$file,true);return $out; }
    private static function hash(array $data): string {return hash('sha256',json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));}
    private function fingerprints(): array
    {
        $out=[];foreach(self::FILES as$file){$p=$this->dir.'/'.$file;Files::noLinks($p);$out[$file]=is_file($p)?hash_file('sha256',$p):null;}return $out;
    }
    private function websiteKeys(): array
    {
        $catalog=(new ThemeWorkspaceStore($this->root))->catalog();
        return array_unique(array_merge(array_keys(\template\cra1\controller\Cra1::defaults()),array_keys($catalog['fields']),['page_content_overrides_json','page_module_visibility_json','page_module_orders_json','public_content_explicit_json']));
    }
    public function export(string $origin): array
    {
        return $this->locked(function()use($origin){
            if(is_file($this->dir.'/transfer-pending.json'))throw new \InvalidArgumentException('上次导入尚未完成，请先恢复原配置后再导出');
            $out=$this->document($this->raw());
            // Media binaries are not settings. Keep referenced uploaded images usable across sites.
            $rewrite=function($v)use(&$rewrite,$origin){if(is_array($v)){foreach($v as&$item)$item=$rewrite($item);return $v;}return is_string($v)?preg_replace('~(?<![A-Za-z0-9:/])(/upload/(?:cra1-theme|common)/[A-Za-z0-9_./%-]+)~',rtrim($origin,'/').'$1',$v):$v;};
            return $rewrite($out);
        });
    }
    private function document(array $raw): array
    {
        $website=array_replace(\template\cra1\controller\Cra1::defaults(),Files::json($this->root.'/public/web/cra1/controller/storage.json',true),$raw['website']);
        $website=array_intersect_key($website,array_flip($this->websiteKeys()));
        foreach($this->websiteKeys()as$key)if(!array_key_exists($key,$website))$website[$key]='';
        $member=(new MemberCenterStore($this->root.'/runtime'))->normalizedPreview($raw['member']);
        $cart=(new CartThemeStore($this->root.'/runtime'))->normalizedPreview($raw['cart']);
        foreach(['schema_version','version','updated_at','updated_by']as$k){unset($member[$k],$cart[$k]);}
        $notice=new AnnouncementStore($this->root);$n=$raw['notifications']['values']??AnnouncementStore::defaults();
        return ['format'=>'cra1-configuration','schema'=>1,'site_key'=>$this->menu()->siteKey(),'bindings'=>$this->menu()->bindings(),
            'settings'=>['website'=>$website,'member'=>$member,'cart'=>$cart,'notifications'=>$notice->normalize($n,$n,false)]];
    }
    public function exportWithMedia(string $origin,int $owner,string $session): array
    {
        return (new ConfigurationMedia($this->root))->bundle($this->export($origin),$origin,$owner,$session);
    }
    private function difference(array $next): array
    {
        $after=$next;$after['notifications']=$next['notifications']['values'];
        $labels=[];foreach((new ThemeWorkspaceStore($this->root))->catalog()['fields']as$key=>$field)if(!empty($field['label']))$labels[$key]=$field['label'];
        return ConfigurationDiff::compare($this->document($this->raw())['settings'],$after,$labels);
    }
    private function capture(string $action,string $operator): string
    {
        $id=bin2hex(random_bytes(16));$before=[];
        foreach(array_merge(array_values(self::FILES),self::SNAPSHOTS)as$name){$p=$this->dir.'/'.$name;Files::noLinks($p);$bytes=is_file($p)?file_get_contents($p):null;if($bytes===false)throw new \RuntimeException('配置备份无法读取');$before[$name]=$bytes===null?null:base64_encode($bytes);}
        Files::putJson($this->dir.'/transfers/backups/'.$id.'.json',['created_at'=>microtime(true),'action'=>$action,'operator'=>$operator,'files'=>$before],0600);
        return $id;
    }
    private function historyRaw(string $id): array
    {
        if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new \InvalidArgumentException('配置历史不存在或已清理');
        $doc=Files::json($this->dir.'/transfers/backups/'.$id.'.json');$raw=[];
        foreach(self::FILES as$domain=>$file){
            if(!array_key_exists($file,$doc['files']??[]))throw new \InvalidArgumentException('配置历史不完整，无法恢复');
            $encoded=$doc['files'][$file];$bytes=$encoded===null?null:(is_string($encoded)?base64_decode($encoded,true):false);
            if($bytes===false)throw new \InvalidArgumentException('配置历史损坏，无法恢复');
            $raw[$domain]=$bytes===null?[]:json_decode($bytes,true,32);
            if(!is_array($raw[$domain])||($bytes!==null&&json_last_error()!==JSON_ERROR_NONE))throw new \InvalidArgumentException('配置历史损坏，无法恢复');
        }return $raw;
    }
    public static function tracks(string $action): bool
    {
        return in_array($action,['save','reset','page-layout.save','page-layout.reset','seo.save','member.import','member.sidebar.save','member.appearance.save','member.content.save','member.reset','cart.save','cart.reset','workspace.save','workspace.editor.save','workspace.editor.reset','announcements.save','announcements.reset','icons.apply'],true);
    }
    public function checkpoint(string $action,string $operator): void
    {
        $this->locked(function()use($action,$operator){
            if(is_file($this->dir.'/transfer-pending.json'))throw new \InvalidArgumentException('上次配置导入未完成，请先恢复');
            // Do not retain duplicate snapshots when a rejected or no-op save is retried.
            $current=$this->raw();$all=$this->history();
            if(!empty($all['items'][0]['available'])){try{if($this->historyRaw($all['items'][0]['id'])===$current)return;}catch(\Throwable $e){}}
            $this->capture($action,$operator);$this->prune();
        });
    }
    private function historyLimit(): int
    {
        $path=$this->dir.'/transfers/history-settings.json';Files::noLinks($path);
        if(!file_exists($path))return self::DEFAULT_HISTORY_LIMIT;
        $settings=Files::json($path);
        if(($settings['schema']??null)!==1||!isset($settings['limit'])||!is_int($settings['limit'])||$settings['limit']<0)throw new \RuntimeException('配置历史保留设置无法读取，已暂停自动清理，请检查存储后重试');
        return $settings['limit'];
    }
    private function historyItems(): array
    {
        $items=[];
        foreach(glob($this->dir.'/transfers/backups/*.json')?:[]as$file){
            $id=basename($file,'.json');if(!preg_match('/^[a-f0-9]{32}$/D',$id))continue;
            try{$doc=Files::json($file);$this->historyRaw($id);$items[]=['id'=>$id,'created_at'=>(float)($doc['created_at']??filemtime($file)),'action'=>(string)($doc['action']??'transfer.apply'),'operator'=>(string)($doc['operator']??''),'available'=>true];}
            catch(\Throwable $e){$items[]=['id'=>$id,'created_at'=>is_link($file)?0:(int)filemtime($file),'action'=>'unavailable','operator'=>'','available'=>false];}
        }
        usort($items,static function($a,$b){return $b['created_at']<=>$a['created_at']?:strcmp($b['id'],$a['id']);});
        return $items;
    }
    public function history(): array { return ['items'=>$this->historyItems(),'limit'=>$this->historyLimit()]; }
    /** Zero explicitly means unlimited. This local policy is not part of transferable settings. */
    public function saveHistoryLimit($limit,$expected): array
    {
        foreach([$limit,$expected]as$value)if(!is_int($value)||$value<0)throw new \InvalidArgumentException('请输入正整数份数，或选择不限制份数');
        return Files::locked($this->dir.'/distribution/update.lock',function()use($limit,$expected){return $this->locked(function()use($limit,$expected){
            if(is_file($this->dir.'/distribution/pending.json'))throw new \InvalidArgumentException('主题更新尚未完成，请先恢复更新');
            if($this->historyLimit()!==$expected)return ['status'=>409,'msg'=>'历史保留设置已被修改，请刷新后重新确认'];
            // Validate recovery metadata before any policy write or destructive cleanup.
            $this->pendingBackup();$count=count($this->historyItems());
            Files::putJson($this->dir.'/transfers/history-settings.json',['schema'=>1,'limit'=>$limit],0600);
            $warning='';try{$this->prune();}catch(\Throwable $e){error_log('CRA1 configuration history cleanup deferred');$warning='部分较早历史未能清理，将在下次保存配置时重试。';}
            $history=$this->history();$deleted=$count-count($history['items']);
            return ['status'=>200,'msg'=>'历史保留设置已保存'.($deleted?'，已清理 '.$deleted.' 份较早记录':'').'。'.$warning,'data'=>['history'=>$history,'previous_limit'=>$expected,'deleted'=>$deleted,'warning'=>$warning]];
        });});
    }
    private function pendingBackup(): string
    {
        $path=$this->dir.'/transfer-pending.json';$doc=Files::json($path,true);$pending=$doc['backup']??'';
        if((file_exists($path)&&!isset($doc['backup']))||!is_string($pending)||($pending!==''&&!preg_match('/^[a-f0-9]{32}$/D',$pending)))throw new \RuntimeException('配置恢复记录无法读取，已暂停历史清理');
        return $pending;
    }
    private function prune(): void
    {
        $limit=$this->historyLimit();if($limit===0)return;
        $pending=$this->pendingBackup();
        foreach(array_slice($this->historyItems(),$limit)as$item)if($item['id']!==$pending){$p=$this->dir.'/transfers/backups/'.$item['id'].'.json';Files::noLinks($p);if(!unlink($p))throw new \RuntimeException('较早的配置历史暂时无法清理');}
    }
    public function prepareHistory(string $id,int $owner,string $session,string $operator): array
    {
        // Re-use the same preview, expiry, conflict and verified-apply contract as file imports.
        return $this->prepare($this->document($this->historyRaw($id)),$owner,$session,$operator,'history.restore');
    }
    public static function decode(string $bytes): array
    {
        if($bytes===''||strlen($bytes)>self::MAX_BYTES)throw new \InvalidArgumentException('配置文件为空或超过 8MB');
        $doc=json_decode($bytes,true,32);if(!is_array($doc)||json_last_error()!==JSON_ERROR_NONE)throw new \InvalidArgumentException('配置文件 JSON 格式不正确');return $doc;
    }
    private function validate(array $doc): array
    {
        if(($doc['format']??'')!=='cra1-configuration'||($doc['schema']??null)!==1||!is_array($doc['settings']??null)||!is_array($doc['bindings']??null)||!is_string($doc['site_key']??null))throw new \InvalidArgumentException('请选择酷锐A1导出的完整配置 JSON 文件');
        $settings=$doc['settings'];
        if(array_diff(array_keys($settings),array_keys(self::FILES))||array_diff(array_keys(self::FILES),array_keys($settings)))throw new \InvalidArgumentException('完整配置必须包含官网、会员中心、购物车及通知设置');
        foreach($settings as$value)if(!is_array($value))throw new \InvalidArgumentException('配置分区格式不正确');
        MenuTransfer::checkBindings($doc['bindings']);
        if(array_diff(array_keys($settings['website']),$this->websiteKeys()))throw new \InvalidArgumentException('配置包含当前主题版本不支持的官网字段，请使用兼容版本');
        foreach($settings['website']as$key=>$value){
            if(!is_scalar($value)&&$value!==null)throw new \InvalidArgumentException('官网配置字段格式不正确');
            if(is_string($value)&&strlen($value)>1048576)throw new \InvalidArgumentException('官网配置字段过大');
            if(substr($key,-5)==='_json'&&$value!==''&&$value!==null){json_decode((string)$value,true);if(json_last_error()!==JSON_ERROR_NONE)throw new \InvalidArgumentException('官网布局或页面覆盖格式不正确');}
        }
        // File uploads must use the same content policy as ordinary editors.
        // Validate parsed policy documents so nested custom code retains its explicit permission boundary.
        require_once dirname(__DIR__).'/Support/cra1_theme_admin.php';
        $safe=function($value,string $key='')use(&$safe){
            if(in_array($key,['custom_code','custom_css','custom_js','custom_css_enabled','custom_js_enabled'],true))return;
            if(is_array($value)){foreach($value as$k=>$v)$safe($v,(string)$k);return;}
            if(is_string($value)&&substr($key,-5)==='_json'&&$value!==''){$data=json_decode($value,true,32);if(is_array($data)){$safe($data);return;}}
            \theme_safe_content($value,$key);
        };$safe($settings);
        $workspace=new ThemeWorkspaceStore($this->root);
        $workspace->validateTransfer('member',$settings['member']);$workspace->validateTransfer('cart',$settings['cart']);
        MenuTransfer::checkTree($settings['member']['sidebar']['nodes']??[]);
        return $settings;
    }
    private function plan(array $doc,string $operator): array
    {
        $settings=$this->validate($doc);$raw=$this->raw();$warnings=[];$menu=$this->menu();$same=hash_equals($menu->siteKey(),$doc['site_key']);
        $settings['member']['sidebar']['nodes']=$menu->remap($settings['member']['sidebar']['nodes'],$doc['bindings'],$same,$warnings);
        // The tree has already been remapped. Remap other structured links once.
        $sidebar=$settings['member']['sidebar'];unset($settings['member']['sidebar']);
        $settings=$menu->remapLinks($settings,$doc['bindings'],$same,$warnings);$settings['member']['sidebar']=$sidebar;
        $treeErrors=(new MemberCenterStore($this->root.'/runtime'))->validateTree($settings['member']['sidebar']['nodes'],true);if($treeErrors)throw new \InvalidArgumentException(implode('；',array_slice($treeErrors,0,3)));
        $next=[];$next['website']=array_replace($raw['website'],$settings['website']);
        foreach(['member'=>MemberCenterStore::class,'cart'=>CartThemeStore::class]as$domain=>$class){
            $store=new $class($this->root.'/runtime');$current=$store->read();
            $data=array_replace($current,$settings[$domain]);$data['version']=$current['version']+1;$data['updated_at']=time();$data['updated_by']=$operator;
            $next[$domain]=$store->normalizedPreview($data);
        }
        $notice=new AnnouncementStore($this->root);$current=$notice->read();
        $next['notifications']=['schema'=>1,'version'=>$current['version']+1,'updated_at'=>time(),'updated_by'=>$operator,
            'values'=>$notice->normalize($settings['notifications'],$settings['notifications'],false)];
        if(!$same)$warnings[]='商品、文章分类、部门和外部链接等站点关联请在目标站复核。';
        return ['next'=>$next,'warnings'=>array_values(array_unique($warnings))];
    }
    public function prepare(array $doc,int $owner,string $session,string $operator,string $operation='transfer.apply'): array
    {
        return $this->locked(function()use($doc,$owner,$session,$operator,$operation){
            if(is_file($this->dir.'/transfer-pending.json'))throw new \InvalidArgumentException('上次导入未完成，请先恢复原配置');
            $plan=$this->plan($doc,$operator);$media=(new ConfigurationMedia($this->root))->inspect($doc);$id=bin2hex(random_bytes(16));
            foreach(glob($this->dir.'/transfers/incoming/*.json')?:[]as$p)if(filemtime($p)<time()-1800)unlink($p);
            Files::putJson($this->dir.'/transfers/incoming/'.$id.'.json',['owner'=>$owner,'session'=>$session,'expires'=>time()+900,'expected'=>$this->fingerprints(),'document'=>$doc,'operation'=>$operation,'plan_hash'=>$this->planHash($plan)],0600);
            return ['candidate'=>$id,'sections'=>['官网设置与页面内容','会员中心及菜单','购物车设置','全部通知'],'warnings'=>$plan['warnings'],'expires_at'=>time()+900,'operation'=>$operation,'difference'=>$this->difference($plan['next']),'media'=>$media];
        });
    }
    public function apply(string $id,int $owner,string $session,string $operator): array
    {
        if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new \InvalidArgumentException('导入预览已失效，请重新选择配置文件');
        return Files::locked($this->dir.'/distribution/update.lock',function()use($id,$owner,$session,$operator){return $this->locked(function()use($id,$owner,$session,$operator){
            if(is_file($this->dir.'/distribution/pending.json'))throw new \InvalidArgumentException('主题更新未完成，请先恢复更新后再导入配置');
            if(is_file($this->dir.'/transfer-pending.json'))throw new \InvalidArgumentException('上次导入未完成，请先恢复原配置');
            $file=$this->dir.'/transfers/incoming/'.$id.'.json';$saved=Files::json($file);
            if(($saved['expires']??0)<time()||($saved['owner']??0)!==$owner||!hash_equals((string)($saved['session']??''),$session))throw new \InvalidArgumentException('导入预览已失效，请重新选择配置文件');
            if(!hash_equals(self::hash($saved['expected']),self::hash($this->fingerprints())))return ['status'=>409,'msg'=>'预览后主题配置已有修改，请重新选择文件核对后导入'];
            $plan=$this->plan($saved['document'],$operator);
            if(isset($saved['plan_hash'])&&!hash_equals($saved['plan_hash'],$this->planHash($plan)))return ['status'=>409,'msg'=>'预览后可用菜单或插件已变化，请重新预览'];
            $media=(new ConfigurationMedia($this->root))->inspect($saved['document']);
            if($media['missing'])return ['status'=>409,'msg'=>'配套图片尚未就绪，请先将图片包解压到目标 V10 的 public 目录，再重新预览'];
            $operation=($saved['operation']??'')==='history.restore'?'history.restore':'transfer.apply';
            $backup=$this->capture($operation,$operator);
            Files::putJson($this->dir.'/transfer-pending.json',['backup'=>$backup],0600);
            try{
                foreach(self::FILES as$domain=>$name)($this->writer)($this->dir.'/'.$name,json_encode($plan['next'][$domain],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n");
                $member=new MemberCenterStore($this->root.'/runtime');$cart=new CartThemeStore($this->root.'/runtime');
                if(!$member->writePublicSnapshot($plan['next']['member'])||!$cart->writePublicSnapshot($plan['next']['cart']))throw new \RuntimeException('前台快照同步失败');
                unlink($this->dir.'/transfer-pending.json');unlink($file);try{$this->prune();}catch(\Throwable $cleanup){error_log('CRA1 configuration history cleanup deferred');}
            }catch(\Throwable $e){
                error_log('CRA1 configuration import failed: '.get_class($e));
                try{$this->restore($backup);}catch(\Throwable $restore){throw new \InvalidArgumentException('配置导入中断，请检查存储空间和目录权限，再点击恢复原配置');}
                throw new \InvalidArgumentException('配置导入未完成，原配置已恢复，请检查存储空间和目录权限后重试');
            }
            return ['status'=>200,'msg'=>$operation==='history.restore'?'历史配置已恢复，恢复前的配置已自动备份':'完整主题配置已导入，原配置已自动备份','data'=>['warnings'=>$plan['warnings'],'backup'=>$backup]];
        });});
    }
    private function planHash(array $plan): string
    {
        foreach(['member','cart','notifications']as$domain)foreach(['version','updated_at','updated_by']as$key)unset($plan['next'][$domain][$key]);
        return self::hash($plan);
    }
    private function restore(string $id): void
    {
        if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new \RuntimeException('导入恢复记录格式异常');
        $backup=Files::json($this->dir.'/transfers/backups/'.$id.'.json');
        $expected=array_merge(array_values(self::FILES),self::SNAPSHOTS);
        if(!is_array($backup['files']??null)||array_keys($backup['files'])!==$expected)throw new \RuntimeException('导入恢复记录不完整');
        $decoded=[];
        foreach($backup['files']as$name=>$bytes){Files::noLinks($this->dir.'/'.$name);if($bytes!==null&&!is_string($bytes))throw new \RuntimeException('导入恢复记录损坏');$decoded[$name]=$bytes===null?null:base64_decode($bytes,true);if($decoded[$name]===false)throw new \RuntimeException('导入恢复记录损坏');}
        foreach($decoded as$name=>$bytes){$p=$this->dir.'/'.$name;if($bytes===null){if(is_file($p)&&!unlink($p))throw new \RuntimeException('无法恢复原配置');}else Files::atomic($p,$bytes,0600);}
        if(is_file($this->dir.'/transfer-pending.json'))unlink($this->dir.'/transfer-pending.json');
    }
    public function recover(): array {return Files::locked($this->dir.'/distribution/update.lock',function(){return $this->locked(function(){$pending=Files::json($this->dir.'/transfer-pending.json',true);if($pending)$this->restore((string)$pending['backup']);return ['status'=>200,'msg'=>'原配置已恢复'];});});}
}
