<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** A read-only allowlist projection, deliberately separate from detailed admin inspection. */
final class Diagnostics
{
    public static function collect(string $root,string $entry,array $options=[]): array
    {
        $codes=[];$release=[];$context=$options['context']??Inspector::context($root);
        try{
            $pointer=Files::json($root.'/runtime/cra1_theme/distribution/current.json',true);
            $release=$pointer['manifest']??Files::json($root.'/cra1-theme/release.json',true);
            if(!is_array($release))$release=[];
        }catch(\Throwable $error){$codes[]='THEME_MANIFEST_UNAVAILABLE';}
        $extensions=[];
        foreach(['pdo_mysql','pdo_sqlite','sodium','fileinfo','gd','zip','mbstring','dom','curl']as$name){
            $extensions[$name]=extension_loaded($name);
            if(!$extensions[$name])$codes[]='EXTENSION_MISSING';
        }
        if(empty($context['database']))$codes[]='SYSTEM_INFO_UNAVAILABLE';
        if(!Inspector::runtimeMatch($release,$context))$codes[]='COMBINATION_UNVERIFIED';
        $known=[];$enabled=0;$other=0;
        foreach($context['modules']??[]as$module){
            if(!is_array($module)||(int)($module['status']??0)!==1)continue;
            $enabled++;
            if(in_array($module['name']??'', ['MfCloud','MfDcim','IdcsmartCommon','WestDomain'],true))
                $known[$module['name']]=self::version($module['version']??null);
            else $other++;
        }
        ksort($known);
        $resources=[];
        foreach(['backend','member','cart','shared','website','admin','other']as$scope)$resources[$scope]=['checked'=>0,'missing'=>0,'changed'=>0];
        $files=$release['files']??[];
        if(!is_array($files)||!$files||count($files)>10000){$files=[];$codes[]='THEME_MANIFEST_UNAVAILABLE';}
        foreach($files as$path=>$row){
            if(!is_string($path)||!is_array($row)||!preg_match('/^[a-f0-9]{64}$/D',(string)($row['sha256']??''))){$codes[]='THEME_MANIFEST_INVALID';continue;}
            if(CustomerData::repositoryFile($path))continue;
            $scope=self::scope($path);$resources[$scope]['checked']++;
            try{
                $file=Manifest::destination($root,$path,$entry);Files::noLinks($file);
                if(!is_file($file)||!is_readable($file)){$resources[$scope]['missing']++;$codes[]='THEME_FILE_MISSING';}
                elseif(!hash_equals($row['sha256'],(string)hash_file('sha256',$file))){$resources[$scope]['changed']++;$codes[]='THEME_FILE_CHANGED';}
            }catch(\Throwable $error){$resources[$scope]['missing']++;$codes[]='THEME_RESOURCE_UNAVAILABLE';}
        }
        $directories=[];
        foreach(['runtime'=>'runtime/cra1_theme','backend'=>'cra1-theme','admin'=>'public/'.$entry]as$key=>$relative){
            $file=$root.'/'.$relative;
            try{Files::noLinks($file);$directories[$key]=['readable'=>is_dir($file)&&is_readable($file),'writable'=>is_dir($file)&&is_writable($file)];}
            catch(\Throwable $error){$directories[$key]=['readable'=>false,'writable'=>false];}
            if(!$directories[$key]['writable'])$codes[]='THEME_DIRECTORY_NOT_WRITABLE';
        }
        $pending=is_file($root.'/runtime/cra1_theme/distribution/pending.json');
        if($pending)$codes[]='UPDATE_INTERRUPTED';
        $requestId=$GLOBALS['THEME_REQUEST_ID']??'';
        $data=['schema'=>1,'theme'=>'酷锐A1','version'=>self::version($release['version']??null),
            'test_build'=>($release['release_channel']??'')==='test','system'=>self::version($context['system_version']??null),
            'php'=>self::version(PHP_VERSION),'https'=>(bool)($options['https']??false),
            'open_basedir'=>(string)ini_get('open_basedir')!=='','database_readable'=>!empty($context['database']),
            'extensions'=>$extensions,'upload_max_bytes'=>self::bytes((string)ini_get('upload_max_filesize')),
            'post_max_bytes'=>self::bytes((string)ini_get('post_max_size')),
            'modules'=>['known'=>$known,'enabled_count'=>$enabled,'other_count'=>$other],
            'directories'=>$directories,'resources'=>$resources,'update_interrupted'=>$pending,
            'codes'=>array_values(array_unique($codes)),
            'request_id'=>is_string($requestId)&&preg_match('/^[a-f0-9]{24}$/D',$requestId)?$requestId:null];
        return ['report'=>$data,'text'=>"酷锐A1 排查信息\n".json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)];
    }

    private static function version($value): ?string
    {
        return is_string($value)&&preg_match('/^v?\d{1,3}(?:\.\d{1,3}){1,3}$/D',$value)?$value:null;
    }
    private static function bytes(string $value): ?int
    {
        if(!preg_match('/^\s*(\d{1,12})\s*([KMG]?)\s*$/iD',$value,$m))return null;
        $power=[''=>1,'K'=>1024,'M'=>1048576,'G'=>1073741824];
        $bytes=(int)$m[1]*$power[strtoupper($m[2])];
        return $bytes<=PHP_INT_MAX?(int)$bytes:null;
    }
    private static function scope(string $path): string
    {
        if(strpos($path,'cra1-theme/backend/')===0)return 'backend';
        foreach(['clientarea'=>'member','home'=>'member','cart'=>'cart','cra1-shared'=>'shared','web'=>'website','cra1admin'=>'admin']as$prefix=>$scope)
            if(strpos($path,'public/'.$prefix.'/')===0)return $scope;
        return 'other';
    }
}
