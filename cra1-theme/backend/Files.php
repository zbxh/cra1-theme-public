<?php
declare(strict_types=1);
namespace CRA1\Theme;

final class Files
{
    public static function noLinks(string $path): void
    {
        if ($path === '' || $path[0] !== '/' || strpos($path, "\0") !== false) throw new \RuntimeException('文件路径无效');
        foreach (explode('/', $path) as $part) if ($part === '..' || $part === '.') throw new \RuntimeException('文件路径不规范');
        $boundary='/';$restriction=(string)ini_get('open_basedir');
        if($restriction!==''){
            $allowed=false;
            foreach(explode(PATH_SEPARATOR,$restriction)as$base){
                $base=rtrim($base,'/');if($base==='')$base='/';
                if($base==='.')$base=(string)getcwd();
                if($path===$base||$base==='/'||strpos($path,$base.'/')===0){
                    if(!$allowed||strlen($base)>strlen($boundary))$boundary=$base;
                    $allowed=true;
                }
            }
            if(!$allowed||realpath($boundary)!==$boundary)throw new Failure('检查文件访问范围',$path,'open_basedir restriction in effect');
        }
        for($p=$path;;$p=dirname($p)){
            if(is_link($p))throw new \RuntimeException('拒绝通过软链接访问文件');
            if($p===$boundary||$p==='/')break;
        }
    }
    public static function json(string $path, bool $missing = false): array
    {
        self::noLinks($path);
        if (!is_file($path)) {
            if ($missing) return [];
            throw new Failure('读取文件',$path,'No such file or directory');
        }
        $data=json_decode((string)self::read($path),true);
        if (!is_array($data) || json_last_error()!==JSON_ERROR_NONE) throw new \RuntimeException('配置内容不是有效的 JSON，读取已中止，原文件已保留：'.Diagnostics::clean($path,defined('CRA1_THEME_ROOT')?CRA1_THEME_ROOT:''));
        return $data;
    }
    public static function read(string $path): string
    {
        self::noLinks($path);
        return Failure::attempt('读取文件',$path,static function()use($path){return file_get_contents($path);});
    }
    public static function directory(string $path,int $mode=0700): void
    {
        self::noLinks($path);
        if(is_dir($path))return;
        Failure::attempt('创建目录',$path,static function()use($path,$mode){return mkdir($path,$mode,true)||is_dir($path);},$mode);
    }
    /** @return resource */
    public static function openLock(string $path,int $kind=LOCK_EX)
    {
        self::noLinks($path);self::directory(dirname($path));
        $f=Failure::attempt('打开配置锁',$path,static function()use($path){return fopen($path,'c+b');},0600);
        try{Failure::attempt('获取配置锁',$path,static function()use($f,$kind){return flock($f,$kind);},0600);}
        catch(\Throwable $e){fclose($f);throw $e;}
        return $f;
    }
    public static function atomic(string $path, string $bytes, int $mode = 0640): void
    {
        self::noLinks($path);
        $dir=dirname($path);
        self::directory($dir);
        $temp=$path.'.cra1-'.bin2hex(random_bytes(8));
        try {
            $f=Failure::attempt('创建临时文件',$path,static function()use($temp){return fopen($temp,'x+b');},$mode);
            try {
                Failure::attempt('写入文件',$path,static function()use($f,$bytes){return fwrite($f,$bytes)===strlen($bytes)&&fflush($f);},$mode);
                Failure::attempt('设置文件权限',$path,static function()use($temp,$mode){return chmod($temp,$mode);},$mode);
            } finally { fclose($f); }
            Failure::attempt('替换文件',$path,static function()use($temp,$path){return rename($temp,$path);},$mode);
        } finally { if (is_file($temp)) @unlink($temp); }
    }
    public static function putJson(string $path, array $data, int $mode = 0640): void
    {
        self::atomic($path,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n",$mode);
    }
    public static function locked(string $path, callable $work)
    {
        $f=self::openLock($path);
        try { return $work(); }
        finally { flock($f,LOCK_UN); fclose($f); }
    }
}
