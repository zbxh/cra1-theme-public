<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;
use CRA1\Theme\Files;

/** Referenced, local theme pictures only. The ZIP is extracted manually, never accepted as an import. */
final class ConfigurationMedia
{
    public const MAX_FILES=200;
    public const MAX_TOTAL=104857600;
    private string $root;
    public function __construct(string $root){$this->root=$root;}
    private static function origin(string $url): string
    {
        $p=parse_url($url);if(!is_array($p)||!in_array(strtolower($p['scheme']??''),['http','https'],true)||empty($p['host'])||isset($p['user']))return '';
        $scheme=strtolower($p['scheme']);$port=(int)($p['port']??($scheme==='https'?443:80));
        return $scheme.'://'.strtolower($p['host']).':'.$port;
    }
    private static function local(string $path): bool
    {
        return preg_match('~^/(?:upload/(?:cra1-theme|common)|web/cra1/assets/images)/[A-Za-z0-9_./%\~-]+$~D',$path)===1
            &&strpos($path,'/avatars/')===false&&strpos($path,'/../')===false&&strpos($path,'/./')===false;
    }
    public function bundle(array $document,string $origin,int $owner,string $session): array
    {
        if(!class_exists('ZipArchive'))throw new \InvalidArgumentException('服务器未启用 ZIP 扩展，暂时无法打包图片');
        $source=self::origin($origin);if($source==='')throw new \InvalidArgumentException('网站地址未配置，无法识别本站图片');
        $files=[];$warnings=[];$cache=[];$total=0;
        $replace=function(array $m)use($source,&$files,&$warnings,&$cache,&$total):string{
            $url=$m[0];$absolute=preg_match('~^https?://~i',$url)===1;
            if($absolute&&self::origin($url)!==$source)return $url;
            $parsed=parse_url($url);$path=rawurldecode((string)($parsed['path']??''));
            if(!self::local($path))return $url;
            if(array_key_exists($path,$cache))return $cache[$path]===null?$url:$cache[$path].(isset($parsed['query'])?'?'.$parsed['query']:'').(isset($parsed['fragment'])?'#'.$parsed['fragment']:'');
            $cache[$path]=null;$disk=$this->root.'/public'.$path;
            try{
                Files::noLinks($disk);
                if(!is_file($disk)||!is_readable($disk))throw new \RuntimeException('图片不存在或不可读');
                $extension=strtolower(pathinfo($disk,PATHINFO_EXTENSION));$allowed=['png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp','gif'=>'image/gif','ico'=>'image/x-icon'];
                if(!isset($allowed[$extension]))throw new \RuntimeException('此格式不打包');
                if(filesize($disk)>8388608)throw new \RuntimeException('单张图片超过 8MB');
                $bytes=file_get_contents($disk);if($bytes===false||strlen($bytes)>8388608)throw new \RuntimeException('图片无法读取');
                $mime=(new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
                if($mime!==$allowed[$extension]&&!($extension==='ico'&&$mime==='image/vnd.microsoft.icon'))throw new \RuntimeException('图片格式与文件内容不一致');
                if(!@getimagesizefromstring($bytes)&&$extension!=='ico')throw new \RuntimeException('图片损坏');
                $hash=hash('sha256',$bytes);$target='/upload/cra1-theme/migration/'.$hash.'.'.($extension==='jpeg'?'jpg':$extension);
                if(!isset($files[$target])){
                    if(count($files)>=self::MAX_FILES||$total+strlen($bytes)>self::MAX_TOTAL)throw new \LengthException('引用图片超过 200 张或 100MB，请减少配置中的图片后重试');
                    $files[$target]=['path'=>$target,'sha256'=>$hash,'bytes'=>strlen($bytes),'source'=>$disk];$total+=strlen($bytes);
                }
                $cache[$path]=$target;
                return $target.(isset($parsed['query'])?'?'.$parsed['query']:'').(isset($parsed['fragment'])?'#'.$parsed['fragment']:'');
            }catch(\LengthException $e){throw new \InvalidArgumentException($e->getMessage());}
            catch(\Throwable $e){$warnings[]='部分本地图片未能打包，已保留来源地址：'.basename($path);return $url;}
        };
        $walk=function($value)use(&$walk,$replace){
            if(is_array($value)){foreach($value as&$v)$v=$walk($v);return $value;}
            if(!is_string($value))return $value;
            $json=json_decode($value,true,32);
            if(is_array($json))return json_encode($walk($json),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
            return preg_replace_callback('~https?://[^\s"\'<>\\\\(){}|;,]+|(?<![A-Za-z0-9:/._-])/(?:upload/(?:cra1-theme|common)|web/cra1/assets/images)/[A-Za-z0-9_./%\~-]+(?:[?#][^\s"\'<>\\\\(){}|;,]*)?~iu',$replace,$value);
        };
        $document['settings']=$walk($document['settings']);
        $list=[];foreach($files as$file){unset($file['source']);$list[]=$file;}
        if(!$list)return ['document'=>$document,'media'=>null,'warnings'=>array_values(array_unique($warnings))];
        $document['media']=['schema'=>1,'files'=>$list];$id=bin2hex(random_bytes(16));
        $dir=$this->root.'/runtime/cra1_theme/transfers/media';Files::noLinks($dir);
        if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new \RuntimeException('图片临时目录不可写');
        foreach(glob($dir.'/*.json')?:[]as$p){Files::noLinks($p);if(filemtime($p)<time()-1800){$zip=substr($p,0,-5).'.zip';Files::noLinks($zip);if(is_file($zip))unlink($zip);unlink($p);}}
        $path=$dir.'/'.$id.'.zip';$zip=new \ZipArchive();$opened=false;
        try{
            if($zip->open($path,\ZipArchive::CREATE|\ZipArchive::EXCL)!==true)throw new \RuntimeException('图片压缩包创建失败');
            $opened=true;
            foreach($files as$file){Files::noLinks($file['source']);if(!$zip->addFile($file['source'],ltrim($file['path'],'/')))throw new \RuntimeException('图片压缩包写入失败');}
            $guide="酷锐A1主题配套图片\n\n1. 将本包内的 upload 文件夹解压到目标 V10 网站的 public 目录（包含 index.php 的网站运行目录）。\n2. 完成后图片应位于 public/upload/cra1-theme/migration/ 下。\n3. 再到目标站的主题后台导入本次一起导出的完整配置 JSON。\n\n只复制 upload 文件夹；本说明无需上传。不要把本 ZIP 上传到主题后台。\n图片文件名由内容生成，不会覆盖不同内容的原图片。请保留原 JSON 与配套图片包。\n";
            if(!$zip->addFromString('图片解压说明.txt',$guide))throw new \RuntimeException('图片压缩包未完成');
            $closed=$zip->close();$opened=false;if(!$closed)throw new \RuntimeException('图片压缩包未完成');
            chmod($path,0600);
            // addFile streams from disk. Verify the finished ZIP before exposing its token,
            // so concurrent edits cannot produce a picture that differs from the JSON manifest.
            $verify=new \ZipArchive();if($verify->open($path)!==true)throw new \RuntimeException('图片压缩包校验失败');
            try{foreach($files as$file){
                $stream=$verify->getStream(ltrim($file['path'],'/'));if(!$stream)throw new \RuntimeException('图片压缩包校验失败');
                try{$hash=hash_init('sha256');$length=hash_update_stream($hash,$stream);$actual=hash_final($hash);}finally{fclose($stream);}
                if($length!==$file['bytes']||!hash_equals($file['sha256'],$actual))throw new \InvalidArgumentException('导出期间图片发生变化，请重新导出');
            }}finally{$verify->close();}
            Files::putJson($dir.'/'.$id.'.json',['owner'=>$owner,'session'=>$session,'expires'=>time()+900],0600);
        }catch(\Throwable $e){if($opened){@$zip->close();}if(is_file($path))unlink($path);throw $e;}
        return ['document'=>$document,'media'=>['id'=>$id,'count'=>count($list),'bytes'=>$total,'expires_at'=>time()+900,'destination'=>'目标 V10 网站的 public 目录（包含 index.php 的运行目录）'],'warnings'=>array_values(array_unique($warnings))];
    }
    public function download(string $id,int $owner,string $session): string
    {
        if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new \InvalidArgumentException('图片下载已失效，请重新导出');
        $base=$this->root.'/runtime/cra1_theme/transfers/media/'.$id;$saved=Files::json($base.'.json',true);Files::noLinks($base.'.zip');
        if(($saved['expires']??0)<time()||($saved['owner']??0)!==$owner||!hash_equals((string)($saved['session']??''),$session)||!is_file($base.'.zip'))throw new \InvalidArgumentException('图片下载已失效，请重新导出');
        return $base.'.zip';
    }
    public function inspect(array $document): array
    {
        if(!isset($document['media']))return ['missing'=>[],'count'=>0];$media=$document['media'];
        if(!is_array($media)||($media['schema']??null)!==1||!is_array($media['files']??null)||count($media['files'])>self::MAX_FILES)throw new \InvalidArgumentException('配套图片信息格式不正确');
        $missing=[];$seen=[];$total=0;
        foreach($media['files']as$file){
            if(!is_array($file)||!is_string($file['path']??null)||!preg_match('~^/upload/cra1-theme/migration/([a-f0-9]{64})\.(png|jpg|webp|gif|ico)$~D',$file['path'],$m)||($file['sha256']??'')!==$m[1]||!is_int($file['bytes']??null)||$file['bytes']<1||$file['bytes']>8388608||isset($seen[$file['path']]))throw new \InvalidArgumentException('配套图片信息格式不正确');
            $seen[$file['path']]=true;$total+=$file['bytes'];if($total>self::MAX_TOTAL)throw new \InvalidArgumentException('配套图片体积过大');
            $path=$this->root.'/public'.$file['path'];Files::noLinks($path);
            if(!is_file($path)||filesize($path)!==$file['bytes']||!hash_equals($file['sha256'],(string)hash_file('sha256',$path)))$missing[]=basename($file['path']);
        }
        return ['missing'=>$missing,'count'=>count($seen)];
    }
}
