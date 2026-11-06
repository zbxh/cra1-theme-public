<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** Finish a customer-extracted install ZIP through the regular update transaction. */
final class Overlay
{
    private string $root;
    private string $dir;
    private string $entry;
    private $contextReader;
    public function __construct(string $root,?callable $contextReader=null)
    {
        $this->root=rtrim($root,'/');$this->dir=$this->root.'/runtime/cra1_theme/distribution';
        if((new Installer($this->root))->state()['mode']!=='maintenance')throw new \RuntimeException('请先完成首次安装');
        $record=Files::json($this->root.'/runtime/cra1_theme/entry.json',true);
        $installation=Files::json($this->root.'/runtime/cra1_theme/install.json',true);
        // install.json records the original address; entry.json follows later renames.
        $entry=is_file($this->root.'/runtime/cra1_theme/entry.json')?($record['entry']??null):($installation['entry']??null);
        if(!is_string($entry)||!preg_match('/^[a-z0-9]{6,32}$/D',$entry))throw new \RuntimeException('原主题后台地址记录不完整，原资料已保留，请联系网站管理员检查');
        $this->entry=$entry;$this->contextReader=$contextReader;
    }
    private function updater(): Updater{return new Updater($this->root,$this->entry,$this->contextReader);}
    private function pointerDigest(): string
    {
        $file=$this->dir.'/current.json';Files::noLinks($file);
        return is_file($file)?hash_file('sha256',$file):'missing';
    }
    private function candidate(): array
    {
        $file=$this->root.'/cra1-theme/release.json';Files::noLinks($file);
        if(!is_file($file)||!is_readable($file)||filesize($file)>8388608)throw new \RuntimeException('主题安装清单缺失或无法读取，请将同一份安装包完整解压到 V10 网站根目录');
        $raw=(string)file_get_contents($file);$doc=json_decode($raw,true);
        if(!is_array($doc)||isset($doc['files']['cra1-theme/release.json']))throw new \RuntimeException('主题安装清单损坏，请重新完整解压同一份安装包');
        $digest=hash('sha256',$raw);$doc['files']['cra1-theme/release.json']=['sha256'=>$digest,'bytes'=>strlen($raw)];
        $doc=Manifest::validate($doc);
        if(($doc['backend_root']??'')!=='cra1-theme/backend/releases/'.$doc['release'])throw new \RuntimeException('此安装包不支持解压更新，请使用新版完整主题安装包');
        return ['manifest'=>$doc,'digest'=>$digest];
    }
    private function selected(array $candidate): bool
    {
        $current=Files::json($this->dir.'/current.json',true);$selected=$current['manifest']??[];
        $expected=$candidate['manifest'];unset($selected['files']['cra1-theme/release.json'],$expected['files']['cra1-theme/release.json']);
        return ($current['release']??null)===$expected['release']&&($current['backend_root']??$selected['backend_root']??null)===$expected['backend_root']&&$selected==$expected;
    }
    private function verify(array $candidate,bool $installed=false): array
    {
        $sources=[];
        foreach($candidate['manifest']['files']as$path=>$row){
            $source=Manifest::destination($this->root,$path,$installed?$this->entry:'cra1admin');
            clearstatcache(true,$source);
            if(!is_file($source)||!is_readable($source)||filesize($source)!==$row['bytes']||!hash_equals($row['sha256'],hash_file('sha256',$source)))
                throw new \RuntimeException('主题文件未解压完整或与安装包不一致，请重新完整解压同一份安装包后检查：'.$path);
            $sources[$path]=$source;
        }
        return $sources;
    }
    private function data(array $candidate,string $state): array
    {
        $doc=$candidate['manifest'];
        return ['mode'=>'maintenance','update_state'=>$state,'version'=>$doc['version']??$doc['release'],
            'release_channel'=>$doc['release_channel']??'candidate','admin_url'=>'/'.$this->entry.'/index.php',
            'checks'=>[],'can_update'=>false,'can_recover'=>false];
    }
    public function prepare(): array
    {
        $candidate=$this->candidate();$data=$this->data($candidate,'ready');
        foreach(array_slice(glob($this->dir.'/overlay/*.zip')?:[],0,100)as$old){
            Files::noLinks($old);
            if(preg_match('/^[a-f0-9]{32}\.zip$/D',basename($old))&&is_file($old)&&filemtime($old)<time()-3600)unlink($old);
        }
        Files::noLinks($this->dir.'/pending.json');
        if(is_file($this->dir.'/pending.json')){
            $data['update_state']='interrupted';$data['can_recover']=true;
            $data['checks'][]=['status'=>'warning','label'=>'更新状态','detail'=>'发现未完成的更新，请先恢复，再重新检查。'];
            return ['data'=>$data,'confirmation'=>['action'=>'recover','pending'=>hash_file('sha256',$this->dir.'/pending.json')]];
        }
        $installed=$this->selected($candidate);$sources=$this->verify($candidate,$installed);
        if($installed){$data['update_state']='current';return ['data'=>$data];}
        if(!class_exists(\ZipArchive::class))throw new \RuntimeException('PHP 未启用 ZIP 扩展，请在网站面板启用后重新检查');
        $pointer=$this->pointerDigest();$archive=$this->dir.'/overlay/'.bin2hex(random_bytes(16)).'.zip';Files::noLinks($archive);
        if(!is_dir(dirname($archive))&&!mkdir(dirname($archive),0700,true)&&!is_dir(dirname($archive)))throw new \RuntimeException('更新暂存目录无法创建，请检查 runtime/cra1_theme/ 的写入权限');
        $zip=new \ZipArchive();
        if($zip->open($archive,\ZipArchive::CREATE|\ZipArchive::EXCL)!==true)throw new \RuntimeException('更新暂存文件无法创建，请检查运行目录的写入权限');
        try{
            foreach($sources as$path=>$source){
                if(!$zip->addFile($source,$path)||!$zip->setCompressionName($path,\ZipArchive::CM_DEFLATE,1))throw new \RuntimeException('主题更新文件无法暂存，请重新检查');
            }
            if(!$zip->close())throw new \RuntimeException('主题更新文件暂存失败，请检查剩余磁盘空间');
            $zip=null;chmod($archive,0600);
            $check=$this->updater()->preflight($archive);
            if(!hash_equals($candidate['digest'],$check['manifest']['files']['cra1-theme/release.json']['sha256']))throw new \RuntimeException('解压文件已变化，请重新检查');
            if($pointer!==$this->pointerDigest())throw new \RuntimeException('主题版本已变化，请重新检查');
            $data['can_update']=$check['can_apply'];
            $data['checks'][]=['status'=>'pass','label'=>'解压文件','detail'=>'完整性检查通过，将沿用原主题后台地址和账号。'];
            foreach($check['blockers']as$message)$data['checks'][]=['status'=>'blocked','label'=>'更新条件','detail'=>$message];
            foreach($check['warnings']as$message)$data['checks'][]=['status'=>'warning','label'=>'运行提示','detail'=>$message];
            if(!$data['can_update']){self::discard($this->root,['archive'=>basename($archive)]);return ['data'=>$data];}
            return ['data'=>$data,'confirmation'=>['action'=>'update','archive'=>basename($archive),'sha256'=>$check['sha256'],
                'candidate'=>$candidate['digest'],'pointer'=>$pointer,'entry'=>$this->entry]];
        }catch(\Throwable $error){
            if($zip!==null)$zip->close();
            self::discard($this->root,['archive'=>basename($archive)]);throw $error;
        }
    }
    public function apply(array $confirmation): array
    {
        $candidate=$this->candidate();
        if(($confirmation['action']??'')!=='update'||($confirmation['entry']??'')!==$this->entry||!hash_equals((string)($confirmation['candidate']??''),$candidate['digest']))throw new \RuntimeException('解压文件已变化，请重新点击“验证并检查”');
        // A lost response may be retried safely, without a second update journal.
        if($this->selected($candidate)){$this->verify($candidate,true);return $this->data($candidate,'current')+['updated'=>true];}
        $this->verify($candidate);
        $archive=$this->archive($confirmation);
        $result=$this->updater()->apply($archive,(string)($confirmation['sha256']??''),(string)($confirmation['pointer']??''));
        return $this->data($candidate,'complete')+['updated'=>true,'history'=>$result['history']];
    }
    public function recover(array $confirmation): array
    {
        if(($confirmation['action']??'')!=='recover')throw new \RuntimeException('请重新检查未完成的更新');
        $pending=$this->dir.'/pending.json';Files::noLinks($pending);
        if(!is_file($pending)||!hash_equals((string)($confirmation['pending']??''),hash_file('sha256',$pending)))throw new \RuntimeException('更新状态已变化，请重新检查');
        $this->updater()->recover($confirmation['pending']);return ['restored'=>true,'mode'=>'maintenance'];
    }
    private function archive(array $confirmation): string
    {
        if(!preg_match('/^[a-f0-9]{32}\.zip$/D',(string)($confirmation['archive']??'')))throw new \RuntimeException('更新检查已失效，请重新检查');
        $path=$this->dir.'/overlay/'.$confirmation['archive'];Files::noLinks($path);return $path;
    }
    public static function discard(string $root,array $confirmation): void
    {
        if(!preg_match('/^[a-f0-9]{32}\.zip$/D',(string)($confirmation['archive']??'')))return;
        $path=rtrim($root,'/').'/runtime/cra1_theme/distribution/overlay/'.$confirmation['archive'];Files::noLinks($path);
        if(is_file($path))unlink($path);
    }
}
