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
            if(!$allowed||realpath($boundary)!==$boundary)throw new \RuntimeException('文件路径不在已确认的允许目录内');
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
            throw new \RuntimeException('文件不存在：'.basename($path));
        }
        $data=json_decode((string)file_get_contents($path),true);
        if (!is_array($data) || json_last_error()!==JSON_ERROR_NONE) throw new \RuntimeException('JSON 损坏，原文件已保留：'.basename($path));
        return $data;
    }
    public static function atomic(string $path, string $bytes, int $mode = 0640): void
    {
        self::noLinks($path);
        $dir=dirname($path);
        if (!is_dir($dir) && !mkdir($dir,0700,true) && !is_dir($dir)) throw new \RuntimeException('目录无法创建');
        $temp=$path.'.cra1-'.bin2hex(random_bytes(8));
        try {
            $f=fopen($temp,'x+b');
            if (!$f) throw new \RuntimeException('文件不可写');
            try {
                if (fwrite($f,$bytes)!==strlen($bytes) || !fflush($f)) throw new \RuntimeException('写入未完成');
                chmod($temp,$mode);
            } finally { fclose($f); }
            if (!rename($temp,$path)) throw new \RuntimeException('文件替换失败');
        } finally { if (is_file($temp)) unlink($temp); }
    }
    public static function putJson(string $path, array $data, int $mode = 0640): void
    {
        self::atomic($path,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n",$mode);
    }
    public static function locked(string $path, callable $work)
    {
        self::noLinks($path);
        if (!is_dir(dirname($path)) && !mkdir(dirname($path),0700,true) && !is_dir(dirname($path))) throw new \RuntimeException('锁目录不可写');
        $f=fopen($path,'c+b');
        if (!$f) throw new \RuntimeException('锁不可用');
        try { if (!flock($f,LOCK_EX)) throw new \RuntimeException('无法取得锁'); return $work(); }
        finally { flock($f,LOCK_UN); fclose($f); }
    }
}
