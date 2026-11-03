<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** An optional inbox, never an arbitrary server path supplied by the browser. */
final class LocalPackages
{
    public const DIRECTORY='runtime/cra1_theme/distribution/imports';
    public const MAX_BYTES=83886080;
    private string $directory;

    public function __construct(string $root)
    {
        $this->directory=rtrim($root,'/').'/'.self::DIRECTORY;
    }

    public function listing(): array
    {
        return ['directory'=>self::DIRECTORY.'/','files'=>array_values($this->scan()),'limit_mb'=>80];
    }

    private function scan(): array
    {
        Files::noLinks($this->directory);
        if(!is_dir($this->directory)&&!mkdir($this->directory,0700,true)&&!is_dir($this->directory))throw new \RuntimeException('无法创建本地安装包目录，请检查主题运行目录权限');
        if(!is_readable($this->directory))throw new \RuntimeException('本地安装包目录不可读，请检查目录权限');
        $rows=[];$count=0;
        foreach(new \FilesystemIterator($this->directory,\FilesystemIterator::SKIP_DOTS) as $file){
            if(++$count>2000)throw new \RuntimeException('本地目录中的文件过多，请仅保留需要导入的安装包后重试');
            $name=$file->getFilename();
            if(strlen($name)>240||preg_match('/[\x00-\x1f\x7f\\\\]/',$name)||!preg_match('/\.zip$/iD',$name))continue;
            // PHP may reject even stat calls on a link outside open_basedir.
            // One unreadable entry must not break the entire package selector.
            try{
                $stat=@lstat($file->getPathname());
                if(!$stat||($stat['mode']&0170000)!==0100000||$stat['nlink']!==1||$stat['size']<1||$stat['size']>self::MAX_BYTES||!@is_readable($file->getPathname()))continue;
            }catch(\Throwable $error){continue;}
            $id=self::identity($name,$stat);
            $rows[$id]=['id'=>$id,'name'=>$name,'bytes'=>$stat['size'],'modified_at'=>$stat['mtime']];
        }
        uasort($rows,static function($a,$b){return $b['modified_at']<=>$a['modified_at']?:strcmp($a['name'],$b['name']);});
        return $rows;
    }

    private static function identity(string $name,array $stat): string
    {
        return hash('sha256',json_encode([$name,$stat['dev'],$stat['ino'],$stat['size'],$stat['mtime'],$stat['ctime']],JSON_THROW_ON_ERROR));
    }

    public function copyToCandidate(string $id,string $destination): void
    {
        if(!preg_match('/^[a-f0-9]{64}$/D',$id))throw new \InvalidArgumentException('请选择本地目录中的主题安装包');
        $rows=$this->scan();$row=$rows[$id]??null;
        if(!$row)throw new \RuntimeException('本地安装包已变化或不可读取，请刷新列表后重新选择');
        $path=$this->directory.'/'.$row['name'];Files::noLinks($path);Files::noLinks($destination);
        $in=@fopen($path,'rb');if(!$in)throw new \RuntimeException('本地安装包无法读取，请刷新列表后重试');
        $out=null;$created=false;
        try{
            $before=fstat($in);
            if(!$before||($before['mode']&0170000)!==0100000||$before['nlink']!==1||!hash_equals($id,self::identity($row['name'],$before)))throw new \RuntimeException('本地安装包已变化，请刷新列表后重试');
            $out=@fopen($destination,'x+b');if(!$out)throw new \RuntimeException('安装包暂存目录不可写');$created=true;
            if(!chmod($destination,0600))throw new \RuntimeException('安装包暂存权限设置失败');
            $written=stream_copy_to_stream($in,$out,self::MAX_BYTES+1);
            $after=fstat($in);
            if($written!==$before['size']||$written>self::MAX_BYTES||!$after||!hash_equals($id,self::identity($row['name'],$after))||!fflush($out))throw new \RuntimeException('安装包尚未上传完成或发生变化，请上传完成后刷新重试');
        }catch(\Throwable $error){
            if(is_resource($out)){fclose($out);$out=null;}
            if($created&&is_file($destination))unlink($destination);
            throw $error;
        }finally{
            fclose($in);if(is_resource($out))fclose($out);
        }
    }
}
