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
            case 'upload':
                $file=$_FILES['file']??[];
                if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK||!is_uploaded_file($file['tmp_name']??'')||($file['size']??0)>83886080)throw new \InvalidArgumentException('请选择不超过 80MB 的 ZIP 候选包');
                $id=bin2hex(random_bytes(16));$path=$dir.'/candidates/'.$id.'.zip';
                if(!is_dir(dirname($path))&&!mkdir(dirname($path),0700,true))throw new \RuntimeException('候选包目录不可写');
                if(!move_uploaded_file($file['tmp_name'],$path))throw new \RuntimeException('候选包保存失败');chmod($path,0600);
                try{$check=$updater->preflight($path);}catch(\Throwable $e){unlink($path);throw $e;}
                Files::putJson($dir.'/candidates/'.$id.'.json',['owner_id'=>(int)$actor['id'],'session_hash'=>$GLOBALS['THEME_SESSION_HASH'],'sha256'=>$check['sha256'],'expires_at'=>time()+3600],0600);
                $data=CustomerData::candidate($check+['candidate'=>$id]);break;
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
}
