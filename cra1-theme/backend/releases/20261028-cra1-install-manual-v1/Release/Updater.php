<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** Theme-only file transaction. A persisted journal makes interrupted writes recoverable. */
final class Updater
{
    private string $root;
    private string $dir;
    private string $entry;
    private $contextReader;
    private $fileWriter;
    public function __construct(string $root,string $entry,?callable $contextReader=null,?callable $fileWriter=null)
    {
        $this->root=rtrim($root,'/');$this->dir=$this->root.'/runtime/cra1_theme/distribution';$this->entry=$entry;
        $this->contextReader=$contextReader??static function()use($root){return Inspector::context($root);};
        $this->fileWriter=$fileWriter??[Files::class,'atomic'];
    }
    public function preflight(string $archive): array
    {
        $info=Package::inspect($archive);$doc=$info['manifest'];$files=[];$blockers=$doc['release_blockers']??[];
        if(!is_array($blockers))throw new \InvalidArgumentException('更新包检查规则无效');
        $context=($this->contextReader)();
        if(!Inspector::runtimeMatch($doc,$context)||empty($context['database']))$blockers[]='当前系统与模块组合没有已核验的原生运行基线';
        if(in_array('ONLY_FULL_GROUP_BY',explode(',',strtoupper((string)($context['database_sql_mode']??''))),true))$blockers[]='当前 MySQL 分组规则不符合已验证的原生产品查询环境';
        $dependencies=[];
        foreach($doc['native_dependencies']??[] as $dependency){
            $row=Inspector::nativeDependency($this->root,$dependency,$doc['integration_profiles']??[]);$dependencies[]=$row;
            if($row['status']!=='pass')$blockers[]=$row['path'].'：'.$row['detail'];
        }
        $current=Files::json($this->dir.'/current.json',true);
        if(isset($doc['maintenance'])){
            $base=$doc['maintenance'];
            if(($current['release']??'')!==$base['base_release']||!is_file($this->dir.'/current.json')
                ||!hash_equals($base['base_pointer_sha256'],hash_file('sha256',$this->dir.'/current.json')))$blockers[]='原版本已变化，请重新构建维护更新';
        }
        if(($doc['security_epoch']??1)<($current['security_epoch']??1))$blockers[]='禁止降级到较早的安全兼容层';
        foreach($doc['files'] as $path=>$row){
            try{
                $target=Manifest::destination($this->root,$path,$this->entry);
                if(file_exists($target)&&!is_file($target))throw new \RuntimeException('目标不是普通文件');
                $old=is_file($target)?hash_file('sha256',$target):null;
                $status=$old===null?'新增':(hash_equals($old,$row['sha256'])?'一致':'更新');
                if($old!==null&&strpos($path,'/releases/')!==false&&$status!=='一致')throw new \RuntimeException('不可变资源目录已存在，禁止重写');
                $parent=dirname($target);while(!is_dir($parent))$parent=dirname($parent);
                if(!is_writable($parent))throw new \RuntimeException('目标目录不可写');
                $files[]=['path'=>$path,'owner'=>'酷锐A1主题','purpose'=>$row['purpose']??self::purpose($path),'status'=>$status,'before'=>$old,'after'=>$row['sha256'],'impact'=>$status==='一致'?'无变化':'旧版将备份；不涉及系统核心'];
            }catch(\Throwable $e){$blockers[]=$path.'：'.$e->getMessage();$files[]=['path'=>$path,'status'=>'阻断','owner'=>'酷锐A1主题','purpose'=>self::purpose($path),'impact'=>$e->getMessage()];}
        }
        try{References::inspect($this->root,$doc['references']??[],$this->entry);References::checkCopies($this->root);}catch(\Throwable $e){$blockers[]=$e->getMessage();}
        if(is_file($this->dir.'/pending.json'))$blockers[]='有未完成的更新，请先恢复';
        return $info+['release_channel'=>$doc['release_channel']??'candidate','files'=>$files,'native_dependencies'=>$dependencies,'blockers'=>$blockers,'can_apply'=>!$blockers,'signature'=>'请核对更新包来源及 SHA-256 校验值'];
    }
    public static function purpose(string $path): string
    {
        if(strpos($path,'backend/')!==false||strpos($path,'lib/')===0)return '主题后端、鉴权或配置适配';
        if(strpos($path,'source/')!==false)return '可编辑构建源码';
        if(strpos($path,'cra1admin')!==false)return '独立主题管理台';
        if(strpos($path,'cra1-install')!==false)return '安装向导';
        if(strpos($path,'cra1-shared')!==false)return '三个主题共用组件';
        if(strpos($path,'clientarea')!==false||strpos($path,'/home/')!==false)return '会员中心模板与资源';
        if(strpos($path,'/cart/')!==false)return '购物车模板与资源';
        return '主题页面、资源或发行说明';
    }
    public static function retainedOnRollback(string $path): bool
    {
        // Rolling back a UI must not restore older authorization or public filtering.
        return strpos($path,'cra1-theme/backend/')===0||strpos($path,'lib/')===0||strpos($path,'public/cra1-install/')===0||
            in_array($path,['public/cra1admin/index.php','public/web/cra1/controller/hooks.php','public/cra1-shared/runtime.php','public/cra1-shared/snapshot.php','public/cra1-shared/compat.php','public/cra1-shared/compatibility.php','public/cra1-shared/assets.php'],true);
    }
    public function apply(string $archive,string $expectedDigest): array
    {
        return Files::locked($this->dir.'/update.lock',function()use($archive,$expectedDigest){
            $check=$this->preflight($archive);
            if(!hash_equals($check['sha256'],$expectedDigest))throw new \RuntimeException('候选包与已确认预检不一致');
            if(!$check['can_apply'])throw new \RuntimeException('候选包存在发行阻断项，禁止应用');
            $id=$check['manifest']['release'];$backup=$this->dir.'/history/'.$id.'-'.bin2hex(random_bytes(5));
            $stage=$this->dir.'/staging/'.bin2hex(random_bytes(16));$prepared=false;
            try{
                Package::stage($archive,$stage,$check);
                $previous=Files::json($this->dir.'/current.json',true);
                $journal=['release'=>$id,'entry'=>$this->entry,'previous'=>$previous,'created_at'=>time(),'backup'=>$backup,'files'=>[],'references'=>[],'state'=>'prepared'];
                if(isset($check['manifest']['version']))$journal['version']=$check['manifest']['version'];
                $journal['release_channel']=$check['manifest']['release_channel']??'candidate';
                foreach($check['files'] as $row){
                    $target=Manifest::destination($this->root,$row['path'],$this->entry);
                    if($row['before']!==null){
                        if(!is_file($target)||!hash_equals($row['before'],hash_file('sha256',$target)))throw new \RuntimeException('预检后目标已变更，请重新检查');
                        Files::atomic($backup.'/files/'.$row['path'],(string)file_get_contents($target),0600);
                    }
                    $journal['files'][$row['path']]=['before'=>$row['before'],'after'=>$row['after'],'mode'=>is_file($target)?(fileperms($target)&0777):0644];
                }
                $references=$check['manifest']['references']??[];
                if($references&&References::usesCopies($this->root,$references)){
                    $copyPlan=References::copyPlan($this->root,$references,$stage);
                    $registry=Files::json(References::copyRegistry($this->root),true);
                    foreach($copyPlan as$path=>$row){
                        $target=Manifest::destination($this->root,$path,$this->entry);
                        if($row['before']!==null)Files::atomic($backup.'/files/'.$path,(string)file_get_contents($target),0600);
                        $journal['files'][$path]=['before'=>$row['before'],'after'=>$row['after'],'mode'=>is_file($target)?fileperms($target)&0777:0644];
                        $registry['files'][$path]=$row['after'];
                    }
                    if(isset($registry['files']))ksort($registry['files']);
                    $registryPath='runtime/cra1_theme/native-reference-copies.json';$target=$this->root.'/'.$registryPath;
                    $before=is_file($target)?hash_file('sha256',$target):null;
                    if($before!==null)Files::atomic($backup.'/files/'.$registryPath,(string)file_get_contents($target),0600);
                    $journal['files'][$registryPath]=['before'=>$before,'after'=>hash('sha256',json_encode($registry,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n"),'mode'=>0600];
                }else foreach($references as $path=>$target)if(!file_exists($this->root.'/'.$path)&&!is_link($this->root.'/'.$path))$journal['references'][$path]=$target;
                Files::putJson($backup.'/journal.json',$journal,0600);
                Files::putJson($this->dir.'/pending.json',$journal,0600);$prepared=true;
                foreach($check['manifest']['files'] as $path=>$row){
                    $target=Manifest::destination($this->root,$path,$this->entry);
                    if(is_file($target)&&hash_equals($row['sha256'],hash_file('sha256',$target)))continue;
                    if(strpos($path,'public/')===0&&!is_dir(dirname($target))&&!mkdir(dirname($target),0755,true))throw new \RuntimeException('主题资源目录无法创建');
                    ($this->fileWriter)($target,(string)file_get_contents($stage.'/'.$path),strpos($path,'public/')===0?0644:0640);
                    if(!is_file($target)||!hash_equals($row['sha256'],hash_file('sha256',$target)))throw new \RuntimeException('落盘校验失败：'.$path);
                    self::invalidate($target);
                }
                References::apply($this->root,$check['manifest']['references']??[]);
                // Candidate migration runs only in the write transaction, after its files
                // passed verification. Read-only preflight never initializes user data.
                self::migrateAnnouncements($this->root,$check['manifest']);
                $current=['release'=>$id,'manifest'=>$check['manifest'],'security_epoch'=>$check['manifest']['security_epoch']??1,'archive_sha256'=>$expectedDigest,'installed_at'=>time(),'history'=>basename($backup),'previous_release'=>$previous['release']??null];
                if(isset($check['manifest']['backend_root']))$current['backend_root']=$check['manifest']['backend_root'];
                // New resource selection becomes visible only after all files are verified.
                Files::putJson($this->dir.'/current.json',$current,0600);
                $journal['state']='complete';Files::putJson($backup.'/journal.json',$journal,0600);
                unlink($this->dir.'/pending.json');$prepared=false;
                return ['release'=>$id,'history'=>basename($backup),'files'=>count($journal['files']),'preserved'=>['主配置','账号','密钥','媒体','页面覆盖','草稿'],'rollback_available'=>true];
            }catch(\Throwable $e){
                if($prepared){
                    try{$this->restore($journal,false,false);}
                    catch(\Throwable $recovery){throw new \RuntimeException('更新中断，自动恢复未完成；恢复记录已保留，请在主题管理执行恢复',0,$recovery);}
                    throw new \RuntimeException('更新失败，主题文件和生效引用已恢复',0,$e);
                }
                throw $e;
            }finally{$this->removeStage($stage);}
        });
    }
    public static function migrateAnnouncements(string $root,array $manifest): void
    {
        $backend=$manifest['backend_root']??'';
        if (!is_string($backend)||!preg_match('~^cra1-theme/backend/releases/[a-z0-9][a-z0-9-]{3,80}$~D',$backend)) return;
        $base=rtrim($root,'/').'/'.$backend;
        if (!is_file($base.'/Storage/AnnouncementStore.php')) return;
        foreach (['Announcements/PageCatalog.php','Announcements/LegacyMigration.php','Storage/AnnouncementStore.php'] as $relative) {
            Files::noLinks($base.'/'.$relative);
            $class='CRA1\\Theme\\'.str_replace('/','\\',substr($relative,0,-4));
            if (!class_exists($class,false)) require_once $base.'/'.$relative;
        }
        (new \CRA1\Theme\Storage\AnnouncementStore($root))->migrate();
    }
    private function validateJournal(array $j,bool $protectChanges,bool $retainSecurity): void
    {
        if(($j['entry']??'')!==$this->entry||!preg_match('/^[a-z0-9-]+$/D',basename((string)($j['backup']??'')))||dirname((string)($j['backup']??''))!==$this->dir.'/history'||!is_array($j['files']??null)||!is_array($j['previous']??null))throw new \RuntimeException('恢复记录归属异常');
        Files::noLinks($j['backup']);
        foreach($j['files'] as $path=>$row){
            $target=$this->journalTarget($path);
            if(!is_array($row)||!array_key_exists('before',$row)||($row['before']!==null&&!preg_match('/^[a-f0-9]{64}$/D',(string)$row['before']))||!preg_match('/^[a-f0-9]{64}$/D',(string)($row['after']??''))||!is_int($row['mode']??null)||$row['mode']<0||$row['mode']>0777)throw new \RuntimeException('恢复文件记录异常');
            if($retainSecurity&&(self::retainedOnRollback($path)||$path==='runtime/cra1_theme/native-reference-copies.json'))continue;
            if($row['before']!==null){$file=$j['backup'].'/files/'.$path;Files::noLinks($file);if(!is_file($file)||!hash_equals($row['before'],hash_file('sha256',$file)))throw new \RuntimeException('恢复文件损坏：'.$path);}
            if($protectChanges&&is_file($target)&&!hash_equals($row['after'],hash_file('sha256',$target))&&($row['before']===null||!hash_equals($row['before'],hash_file('sha256',$target))))throw new \RuntimeException('更新后文件已被修改，请先备份：'.$path);
        }
        References::inspect($this->root,$j['references']??[],$this->entry);
    }
    private function restore(array $journal,bool $protectChanges,bool $retainSecurity): void
    {
        $this->validateJournal($journal,$protectChanges,$retainSecurity);
        foreach(array_reverse($journal['files'],true) as $path=>$row){
            if($retainSecurity&&(self::retainedOnRollback($path)||$path==='runtime/cra1_theme/native-reference-copies.json'))continue;
            $target=$this->journalTarget($path);
            if($row['before']===null){if(is_file($target)&&strpos($path,'/releases/')===false&&!unlink($target))throw new \RuntimeException('无法恢复新增文件');}
            else Files::atomic($target,(string)file_get_contents($journal['backup'].'/files/'.$path),$row['mode']);
            self::invalidate($target);
        }
        $removeReferences=$journal['references']??[];
        if($retainSecurity)$removeReferences=array_filter($removeReferences,static function($path){return strpos($path,'/releases/')===false;},ARRAY_FILTER_USE_KEY);
        References::removeCreated($this->root,$removeReferences);
        if($retainSecurity&&is_file(References::copyRegistry($this->root))){
            $registry=Files::json(References::copyRegistry($this->root));
            foreach($journal['files']as$path=>$row)if(isset($registry['files'][$path])&&strpos($path,'/releases/')===false){
                if(is_file($this->root.'/'.$path))$registry['files'][$path]=hash_file('sha256',$this->root.'/'.$path);else unset($registry['files'][$path]);
            }
            if(isset($registry['files']))ksort($registry['files']);Files::putJson(References::copyRegistry($this->root),$registry,0600);
        }
        $previous=$journal['previous'];
        if($retainSecurity){
            $current=Files::json($this->dir.'/current.json',true);$previous['security_epoch']=$current['security_epoch']??1;$previous['retained_backend_release']=$current['release']??'';
            if(isset($current['backend_root']))$previous['backend_root']=$current['backend_root'];
            if(isset($previous['manifest']))foreach($current['manifest']['files']??[] as $path=>$row)if(self::retainedOnRollback($path))$previous['manifest']['files'][$path]=$row;
        }
        Files::putJson($this->dir.'/current.json',$previous,0600);
        if(is_file($this->dir.'/pending.json'))unlink($this->dir.'/pending.json');
    }
    private function journalTarget(string $path): string
    {
        if($path==='runtime/cra1_theme/native-reference-copies.json'){
            $target=$this->root.'/'.$path;Files::noLinks($target);return $target;
        }
        return Manifest::destination($this->root,$path,$this->entry);
    }
    public function rollback(string $history): array
    {
        return Files::locked($this->dir.'/update.lock',function()use($history){
            if(!preg_match('/^[a-z0-9-]+$/D',$history))throw new \InvalidArgumentException('备份标识无效');
            if(is_file($this->dir.'/pending.json'))throw new \RuntimeException('请先恢复中断更新');
            $journal=Files::json($this->dir.'/history/'.$history.'/journal.json');
            $current=Files::json($this->dir.'/current.json',true);
            if(($current['history']??'')!==$history||($journal['backup']??'')!==$this->dir.'/history/'.$history)throw new \RuntimeException('只能回退当前版本，禁止跨版本覆盖');
            $this->validateJournal($journal,true,true);
            $journal['retain_security']=true;
            Files::putJson($this->dir.'/pending.json',$journal,0600);
            $this->restore($journal,true,true);
            return ['release'=>$journal['previous']['release']??'安装前版本','restored'=>true,'security_retained'=>true];
        });
    }
    public function recover(): array
    {
        return Files::locked($this->dir.'/update.lock',function(){
            $journal=Files::json($this->dir.'/pending.json');
            $this->restore($journal,false,!empty($journal['retain_security']));return ['restored'=>true];
        });
    }
    public function history(): array
    {
        $out=[];
        foreach(glob($this->dir.'/history/*/journal.json')?:[] as $file){$j=Files::json($file);$row=['id'=>basename(dirname($file)),'release'=>$j['release'],'created_at'=>$j['created_at'],'state'=>$j['state']];if(isset($j['version']))$row['version']=$j['version'];if(isset($j['release_channel']))$row['release_channel']=$j['release_channel'];$out[]=$row;}
        return ['current'=>CustomerData::current(Files::json($this->dir.'/current.json',true)),'history'=>$out,'interrupted'=>is_file($this->dir.'/pending.json')];
    }
    private static function invalidate(string $target): void{if(function_exists('opcache_invalidate')&&substr($target,-4)==='.php')opcache_invalidate($target,true);}
    private function removeStage(string $dir): void
    {
        if(!is_dir($dir))return;
        $it=new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir,\FilesystemIterator::SKIP_DOTS),\RecursiveIteratorIterator::CHILD_FIRST);
        foreach($it as $file){if($file->isDir()&&!$file->isLink())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($dir);
    }
}
