<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

final class Management
{
    public static function run(string $action,array $p): array
    {
        $root=$GLOBALS['ROOT'];$actor=theme_actor();
        theme_require_role(in_array($action,['check','history','diagnostics','online.check'],true)?['admin','super_admin']:['super_admin']);
        $updater=new Updater($root,$GLOBALS['SLUG']);$dir=$root.'/runtime/cra1_theme/distribution';
        switch($action){
            case 'lifecycle.get': case 'lifecycle.plan': case 'lifecycle.apply':
                $data=self::lifecycle($root,$action,$p);break;
            case 'check': $data=Inspector::inspect($root,['entry'=>$GLOBALS['SLUG'],'https'=>!empty($GLOBALS['THEME_NETWORK']['https']),'origin'=>$GLOBALS['THEME_SETTINGS']['canonical_url']??'']);$data['nginx_rules']=ServerRules::nginx($GLOBALS['SLUG']);break;
            case 'diagnostics': $data=Diagnostics::collect($root,$GLOBALS['SLUG'],['https'=>!empty($GLOBALS['THEME_NETWORK']['https'])]);break;
            case 'history': $data=$updater->history();break;
            case 'online.settings.get': $data=(new OnlineUpdateSettings($root))->get();break;
            case 'online.settings.save': $data=(new OnlineUpdateSettings($root))->save((string)($p['github_prefix']??''));break;
            case 'online.check':
                $current=Files::json($dir.'/current.json',true)['manifest']??[];
                $settings=(new OnlineUpdateSettings($root))->get();
                $data=(new OnlineUpdates(null,$settings['github_prefix']))->latest($current,($p['include_test']??false)===true);break;
            case 'online.download':
                [$id,$path]=self::candidatePath($dir);
                try{
                    $current=Files::json($dir.'/current.json',true)['manifest']??[];
                    $pointer=is_file($dir.'/current.json')?hash_file('sha256',$dir.'/current.json'):'missing';
                    $settings=(new OnlineUpdateSettings($root))->get();
                    $source=(new OnlineUpdates(null,$settings['github_prefix']))->download((string)($p['version']??''),$path,$current);
                    $data=self::checkCandidate($updater,$dir,$id,$path,(int)$actor['id']);
                    if(($data['version']??'')!==$source['version']||(($data['release_channel']??'')==='test')!==($source['release_channel']==='test'))throw new \InvalidArgumentException('安装包内容与发布版本不一致，请重新检查最新版本');
                    $meta=Files::json($dir.'/candidates/'.$id.'.json');$meta['pointer_sha256']=$pointer;
                    Files::putJson($dir.'/candidates/'.$id.'.json',$meta,0600);
                }catch(\Throwable $error){
                    if(is_file($path))unlink($path);
                    if(is_file($dir.'/candidates/'.$id.'.json'))unlink($dir.'/candidates/'.$id.'.json');
                    throw $error;
                }
                break;
            case 'local.list': $data=(new LocalPackages($root))->listing();break;
            case 'upload':
                $file=$_FILES['file']??[];
                if(in_array($file['error']??UPLOAD_ERR_NO_FILE,[UPLOAD_ERR_INI_SIZE,UPLOAD_ERR_FORM_SIZE],true))throw new \InvalidArgumentException('安装包超过服务器上传限制，可使用下方的服务器本地导入');
                if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK||!is_uploaded_file($file['tmp_name']??'')||($file['size']??0)>LocalPackages::MAX_BYTES)throw new \InvalidArgumentException('请选择不超过 80MB 的主题安装包 ZIP');
                [$id,$path]=self::candidatePath($dir);
                \CRA1\Theme\Failure::attempt('保存上传的安装包',$path,static function()use($file,$path){return move_uploaded_file($file['tmp_name'],$path);},0600);chmod($path,0600);
                $data=self::checkCandidate($updater,$dir,$id,$path,(int)$actor['id']);break;
            case 'local.import':
                [$id,$path]=self::candidatePath($dir);
                (new LocalPackages($root))->copyToCandidate((string)($p['file']??''),$path);
                $data=self::checkCandidate($updater,$dir,$id,$path,(int)$actor['id']);break;
            case 'candidate.get': case 'apply':
                $id=(string)($p['candidate']??'');if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new \InvalidArgumentException('候选包标识无效');
                $meta=Files::json($dir.'/candidates/'.$id.'.json');
                if($meta['expires_at']<time()||$meta['owner_id']!==(int)$actor['id']||!hash_equals($meta['session_hash'],$GLOBALS['THEME_SESSION_HASH']))throw new \RuntimeException('候选包预检已失效，请重新上传');
                $path=$dir.'/candidates/'.$id.'.zip';
                if($action==='candidate.get')$data=CustomerData::candidate($updater->preflight($path)+['candidate'=>$id]);
                else{
                    if(!hash_equals($meta['sha256'],(string)($p['expectedDigest']??'')))throw new \RuntimeException('请使用当前预检校验值确认');
                    $data=$updater->apply($path,$meta['sha256'],$meta['pointer_sha256']??null);
                    unlink($path);unlink($dir.'/candidates/'.$id.'.json');
                }break;
            case 'rollback': $data=$updater->rollback((string)($p['history']??''));break;
            case 'recover': $data=$updater->recover();break;
            default: throw new \InvalidArgumentException('未知主题管理操作');
        }
        return ['status'=>200,'msg'=>'已完成','data'=>$data];
    }

    private static function lifecycle(string $root,string $action,array $p): array
    {
        $service=new Lifecycle($root,ThemeSelection::native($root));
        if($action==='lifecycle.get')return $service->status();
        $mode=$p['mode']??'';
        if(!is_string($mode)||!in_array($mode,['disable','restore','uninstall'],true))throw new \InvalidArgumentException('请选择需要执行的主题操作');
        if($action==='lifecycle.plan')return $service->plan($mode);
        foreach(['token','confirmation']as$field)if(!is_string($p[$field]??null))throw new \InvalidArgumentException('请重新检查并完整填写确认信息');
        if(!preg_match('/^[a-f0-9]{64}$/D',$p['token']))throw new \InvalidArgumentException('检查结果已失效，请重新检查');
        $security=theme_security();$context=theme_context(['category'=>'security','target'=>'theme:uninstall','risk'=>'high']);
        return $service->apply($mode,$p['token'],$p['confirmation'],static function(string $stage,array $result)use($security,$context,$root):void{
            if($stage==='prepare'){
                // The shared request lock has drained all other theme requests.
                $security->tx(static function()use($security):void{
                    $security->db->exec('UPDATE sessions SET revoked_at='.time().' WHERE revoked_at=0');
                    $security->db->exec('UPDATE challenges SET used_at='.time().' WHERE used_at=0');
                });
                foreach(['security.sqlite','attachments.sqlite']as$name){
                    $path=$root.'/runtime/cra1_theme/'.$name;if(!is_file($path))continue;
                    $db=$name==='security.sqlite'?$security->db:new \PDO('sqlite:'.$path,null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION]);
                    $row=$db->query('PRAGMA wal_checkpoint(TRUNCATE)')->fetch(\PDO::FETCH_NUM);
                    if((int)($row[0]??1)!==0)throw new \RuntimeException('主题数据库仍有请求正在使用，请稍候重试，原数据已保留');
                    unset($db);
                }
                unset($GLOBALS['THEME_WRITE']);unset($security->db);
                return;
            }
            $archived=new \CRA1ThemeSecurity($result['backup_root']);
            $archived->event('release.lifecycle.apply',$stage==='complete'?'ok':'fail',$context+['reason'=>$stage==='complete'?'已切回官方模板，主题文件及私有数据已移至非公开备份，全部主题会话已撤销':'卸载失败，主题文件已恢复，保留官方模板选择']);
            $archived->db->query('PRAGMA wal_checkpoint(TRUNCATE)')->fetchAll();
            if($stage==='failed')$GLOBALS['THEME_SECURITY']=$archived;
        });
    }

    private static function candidatePath(string $dir): array
    {
        $id=bin2hex(random_bytes(16));$path=$dir.'/candidates/'.$id.'.zip';Files::noLinks($path);
        Files::directory(dirname($path),0700);
        return [$id,$path];
    }

    private static function checkCandidate(Updater $updater,string $dir,string $id,string $path,int $owner): array
    {
        try{
            $check=$updater->preflight($path);
            Files::putJson($dir.'/candidates/'.$id.'.json',['owner_id'=>$owner,'session_hash'=>$GLOBALS['THEME_SESSION_HASH'],'sha256'=>$check['sha256'],'expires_at'=>time()+3600],0600);
            return CustomerData::candidate($check+['candidate'=>$id]);
        }catch(\Throwable $error){
            if(is_file($path))unlink($path);
            if(is_file($dir.'/candidates/'.$id.'.json'))unlink($dir.'/candidates/'.$id.'.json');
            throw $error;
        }
    }
}
