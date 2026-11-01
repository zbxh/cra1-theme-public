<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

final class ThemeCache
{
    /** Extracted files may have older mtimes than V10's compiled templates. */
    public static function refresh(string $root,array $manifest,string $entry): void
    {
        foreach($manifest['files']??[]as$path=>$row){
            if(substr($path,-4)!=='.php')continue;
            $target=Manifest::destination($root,$path,$entry);
            if(function_exists('opcache_invalidate'))opcache_invalidate($target,true);
        }
        $dir=rtrim($root,'/').'/runtime/temp';Files::noLinks($dir);
        if(!is_dir($dir))return;
        $prefixes=[];
        foreach(['web/cra1','clientarea/template/pc/cra1','clientarea/template/mobile/cra1','home/template/pc/cra1','home/template/mobile/cra1','cart/template/pc/cra1','cart/template/mobile/cra1']as$rel)$prefixes[]=rtrim($root,'/').'/public/'.$rel.'/';
        $files=new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir,\FilesystemIterator::SKIP_DOTS));
        foreach($files as$file){
            if($file->isLink()||!$file->isFile()||!preg_match('/^[a-f0-9]{32}\.php$/D',$file->getFilename()))continue;
            $path=$file->getPathname();Files::noLinks($path);
            $handle=fopen($path,'rb');if(!$handle)throw new \RuntimeException('主题页面缓存无法读取，请检查 runtime/temp/ 的读取权限');
            try{$header=fgets($handle,65536);}finally{fclose($handle);}
            if(!is_string($header)||strpos($header,'<?php /*')!==0)continue;
            foreach($prefixes as$prefix)if(strpos($header,$prefix)!==false){
                if(!unlink($path))throw new \RuntimeException('主题页面缓存无法刷新，请检查 runtime/temp/ 的写入权限');
                if(function_exists('opcache_invalidate'))opcache_invalidate($path,true);
                break;
            }
        }
    }
}
