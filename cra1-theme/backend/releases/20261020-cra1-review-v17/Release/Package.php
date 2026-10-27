<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

final class Package
{
    /** Reject symlinks and unlisted entries before extraction. No extractTo(). */
    public static function inspect(string $archive): array
    {
        if(!is_file($archive)||is_link($archive)||filesize($archive)>83886080)throw new \InvalidArgumentException('候选包不存在或超过 80MB');
        $zip=new \ZipArchive();
        if($zip->open($archive)!==true)throw new \InvalidArgumentException('无法读取 ZIP 候选包');
        try{
            if($zip->numFiles>Manifest::MAX_FILES+1)throw new \InvalidArgumentException('ZIP 文件数量过多');
            $manifestStat=$zip->statName('manifest.json');
            if(!$manifestStat||$manifestStat['size']>8388608)throw new \InvalidArgumentException('发行清单缺失或过大');
            $raw=$zip->getFromName('manifest.json');
            if(!is_string($raw)||strlen($raw)>8388608)throw new \InvalidArgumentException('发行清单缺失或过大');
            $doc=Manifest::validate(json_decode($raw,true,512,JSON_THROW_ON_ERROR));
            $seen=[];$bytes=0;
            for($i=0;$i<$zip->numFiles;$i++){
                $stat=$zip->statIndex($i);$name=$stat['name'];
                if(isset($seen[strtolower($name)]))throw new \InvalidArgumentException('ZIP 重复路径');$seen[strtolower($name)]=true;
                $ops=0;$attrs=0;$zip->getExternalAttributesIndex($i,$ops,$attrs);
                $type=($attrs>>16)&0170000;
                if($type!==0&&$type!==0100000)throw new \InvalidArgumentException('ZIP 不允许软链接、目录或特殊文件');
                if($name==='manifest.json')continue;
                if(strncmp($name,'payload/',8)!==0)throw new \InvalidArgumentException('ZIP 含清单外内容');
                $path=Manifest::path(substr($name,8));$row=$doc['files'][$path]??null;
                if(!$row||(int)$stat['size']!==$row['bytes'])throw new \InvalidArgumentException('文件不在清单或体积不符：'.$path);
                $bytes+=(int)$stat['size'];if($bytes>Manifest::MAX_BYTES)throw new \InvalidArgumentException('ZIP 解压体积过大');
                $stream=$zip->getStream($name);if(!$stream)throw new \RuntimeException('ZIP 文件无法读取');
                try{$hash=hash_init('sha256');hash_update_stream($hash,$stream,$row['bytes']+1);$actual=hash_final($hash);}finally{fclose($stream);}
                if(!hash_equals($row['sha256'],$actual))throw new \InvalidArgumentException('文件校验失败：'.$path);
            }
            if(count($seen)!==count($doc['files'])+1)throw new \InvalidArgumentException('发行包文件缺失');
            return ['manifest'=>$doc,'sha256'=>hash_file('sha256',$archive),'bytes'=>$bytes];
        }finally{$zip->close();}
    }

    public static function stage(string $archive,string $dir,array $expected): void
    {
        $checked=self::inspect($archive);
        if(!hash_equals($expected['sha256'],$checked['sha256']))throw new \RuntimeException('候选包在预检后发生变化');
        if(file_exists($dir))throw new \RuntimeException('暂存目录已存在');
        if(!mkdir($dir,0700,true))throw new \RuntimeException('暂存目录不可写');
        $zip=new \ZipArchive();$zip->open($archive);
        try{foreach($checked['manifest']['files']as$path=>$row){
            $bytes=$zip->getFromName('payload/'.$path);
            if(!is_string($bytes)||!hash_equals($row['sha256'],hash('sha256',$bytes)))throw new \RuntimeException('暂存文件校验失败');
            Files::atomic($dir.'/'.$path,$bytes,0600);
        }}finally{$zip->close();}
    }
}
