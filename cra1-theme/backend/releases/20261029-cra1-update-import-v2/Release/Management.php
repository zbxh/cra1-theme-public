<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

final class Management
{
    public static function run(string $action,array $p): array
    {
        $root=$GLOBALS['ROOT'];$actor=theme_actor();
        theme_require_role(in_array($action,['check','history'],true)?['admin','super_admin']:['super_admin']);
        $updater=new Updater($root,$GLOBALS['SLUG']);$dir=$root.'/runtime/cra1_theme/distribution';
        switch($action){
            case 'check': $data=Inspector::inspect($root,['entry'=>$GLOBALS['SLUG'],'https'=>!empty($GLOBALS['THEME_NETWORK']['https']),'origin'=>$GLOBALS['THEME_SETTINGS']['canonical_url']??'']);$data['nginx_rules']=ServerRules::nginx($GLOBALS['SLUG']);break;
            case 'history': $data=$updater->history();break;
            case 'local.list': $data=(new LocalPackages($root))->listing();break;
            case 'upload':
                $file=$_FILES['file']??[];
                if(in_array($file['error']??UPLOAD_ERR_NO_FILE,[UPLOAD_ERR_INI_SIZE,UPLOAD_ERR_FORM_SIZE],true))throw new \InvalidArgumentException('安装包超过服务器上传限制，可使用下方的服务器本地导入');
                if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK||!is_uploaded_file($file['tmp_name']??'')||($file['size']??0)>LocalPackages::MAX_BYTES)throw new \InvalidArgumentException('请选择不超过 80MB 的主题安装包 ZIP');
                [$id,$path]=self::candidatePath($dir);
                if(!move_uploaded_file($file['tmp_name'],$path))throw new \RuntimeException('候选包保存失败');chmod($path,0600);
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
                    $data=$updater->apply($path,$meta['sha256']);
                    unlink($path);unlink($dir.'/candidates/'.$id.'.json');
                }break;
            case 'rollback': $data=$updater->rollback((string)($p['history']??''));break;
            case 'recover': $data=$updater->recover();break;
            default: throw new \InvalidArgumentException('未知主题管理操作');
        }
        return ['status'=>200,'msg'=>'已完成','data'=>$data];
    }

    private static function candidatePath(string $dir): array
    {
        $id=bin2hex(random_bytes(16));$path=$dir.'/candidates/'.$id.'.zip';Files::noLinks($path);
        if(!is_dir(dirname($path))&&!mkdir(dirname($path),0700,true)&&!is_dir(dirname($path)))throw new \RuntimeException('候选包目录不可写');
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
