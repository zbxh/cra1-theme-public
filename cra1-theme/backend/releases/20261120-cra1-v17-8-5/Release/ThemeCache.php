<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

final class ThemeCache
{
    /** OPcache is optional; shared hosts may deliberately restrict its API. */
    private static function opcodeApiAvailable(): bool
    {
        if(!function_exists('opcache_invalidate')||in_array('opcache_invalidate',array_map('trim',explode(',',(string)ini_get('disable_functions'))),true))return false;
        $prefix=(string)ini_get('opcache.restrict_api');
        return $prefix===''||strpos((string)($_SERVER['SCRIPT_FILENAME']??''),$prefix)===0;
    }
    public static function invalidate(string $path): void
    {
        if(substr($path,-4)!=='.php'||!self::opcodeApiAvailable())return;
        // V10 converts PHP warnings to exceptions. A disabled/uncached OPcache
        // entry must not turn an otherwise verified file transaction into a failure.
        try{@opcache_invalidate($path,true);}catch(\Throwable $error){}
    }
    /** Check only the caches this update will actually remove. No writes here. */
    public static function preflight(string $root): array
    {
        $warnings=[];
        if(filter_var(ini_get('opcache.enable'),FILTER_VALIDATE_BOOLEAN)
            &&(PHP_SAPI!=='cli'||filter_var(ini_get('opcache.enable_cli'),FILTER_VALIDATE_BOOLEAN))
            &&!self::opcodeApiAvailable()){
            if(!filter_var(ini_get('opcache.validate_timestamps'),FILTER_VALIDATE_BOOLEAN))throw new \RuntimeException('服务器已关闭 PHP 缓存自动刷新，并限制了缓存刷新接口。请在网站面板开启 OPcache 时间戳校验后重新检查，避免更新后继续使用旧代码');
            $warnings[]='服务器限制了 PHP 缓存刷新接口，更新后 PHP 将按时间戳自动刷新；如仍看到旧页面，请稍候刷新或在网站面板重启 PHP。';
        }
        foreach(self::compiled($root)as$path){
            if(!is_writable(dirname($path))||!is_executable(dirname($path)))throw new \RuntimeException('主题页面缓存需要刷新，但 PHP 运行用户无删除权限，请在网站面板检查 runtime/temp/ 的属主和写入权限后重新检查');
        }
        return $warnings;
    }
    /** Extracted files may have older mtimes than V10's compiled templates. */
    public static function refresh(string $root,array $manifest,string $entry): void
    {
        foreach($manifest['files']??[]as$path=>$row){
            if(substr($path,-4)!=='.php')continue;
            $target=Manifest::destination($root,$path,$entry);
            self::invalidate($target);
        }
        foreach(self::compiled($root)as$path){
            if(!@unlink($path))throw new \RuntimeException('主题页面缓存无法刷新，请检查 runtime/temp/ 的写入权限');
            self::invalidate($path);
        }
    }
    private static function compiled(string $root): array
    {
        $dir=rtrim($root,'/').'/runtime/temp';Files::noLinks($dir);
        if(!is_dir($dir))return [];
        $matches=[];
        $prefixes=[];
        foreach(['web/cra1','clientarea/template/pc/cra1','clientarea/template/mobile/cra1','home/template/pc/cra1','home/template/mobile/cra1','cart/template/pc/cra1','cart/template/mobile/cra1']as$rel)$prefixes[]=rtrim($root,'/').'/public/'.$rel.'/';
        $files=new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir,\FilesystemIterator::SKIP_DOTS));
        foreach($files as$file){
            if($file->isLink()||!$file->isFile()||!preg_match('/^[a-f0-9]{32}\.php$/D',$file->getFilename()))continue;
            $path=$file->getPathname();Files::noLinks($path);
            $handle=@fopen($path,'rb');if(!$handle)throw new \RuntimeException('主题页面缓存无法读取，请检查 runtime/temp/ 的读取权限');
            try{$header=fgets($handle,65536);}finally{fclose($handle);}
            if(!is_string($header)||strpos($header,'<?php /*')!==0)continue;
            foreach($prefixes as$prefix)if(strpos($header,$prefix)!==false){
                $matches[]=$path;
                break;
            }
        }
        return $matches;
    }
}
