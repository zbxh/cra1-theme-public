<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;

/** Explicitly registered dependencies are linked from the customer's legal V10 installation. */
final class References
{
    public static function linksAvailable(): bool
    {
        return function_exists('symlink')&&!in_array('symlink',array_map('trim',explode(',',(string)ini_get('disable_functions'))),true);
    }
    /** Copies are needed on ordinary hosts that disable symlink(). Only registered paths participate. */
    public static function usesCopies(string $root,array $references): bool
    {
        if(!self::linksAvailable())return true;
        foreach($references as$path=>$target)if(is_dir($root.'/'.$path)&&!is_link($root.'/'.$path))return true;
        return false;
    }
    public static function copyRegistry(string $root): string{return rtrim($root,'/').'/runtime/cra1_theme/native-reference-copies.json';}
    public static function checkCopies(string $root): void
    {
        foreach(\CRA1\Theme\Files::json(self::copyRegistry($root),true)['files']??[]as$path=>$hash){
            Manifest::path($path);\CRA1\Theme\Files::noLinks($root.'/'.$path);
            if(!is_file($root.'/'.$path)||!is_string($hash)||!hash_equals($hash,hash_file('sha256',$root.'/'.$path)))throw new \RuntimeException('原生依赖副本缺失或有未登记修改：'.$path);
        }
    }
    /** Expand virtual directories from installed files, staged payload and declared child dependencies. */
    public static function copyPlan(string $root,array $references,string $stage=''): array
    {
        $root=rtrim($root,'/');$stage=rtrim($stage,'/');$old=\CRA1\Theme\Files::json(self::copyRegistry($root),true)['files']??[];
        $plan=[];$walk=null;
        $walk=static function(string $dest,string $source,array $seen=[])use(&$walk,&$plan,$root,$stage,$references,$old):void{
            if(isset($seen[$source])||count($seen)>48)throw new \RuntimeException('原生依赖形成循环');
            $seen[$source]=true;
            foreach($references as$from=>$to)if($source===$from||strpos($source,$from.'/')===0){$walk($dest,$to.substr($source,strlen($from)),$seen);return;}
            $candidate=$stage!==''&&is_file($stage.'/'.$source)?$stage.'/'.$source:$root.'/'.$source;
            if(is_file($candidate)){
                \CRA1\Theme\Files::noLinks($candidate);
                $target=$root.'/'.$dest;
                if(is_link($target))return; // Existing legal dependency links remain linked.
                \CRA1\Theme\Files::noLinks($target);
                if(file_exists($target)&&!is_file($target))throw new \RuntimeException('依赖目标不是普通文件：'.$dest);
                $after=hash_file('sha256',$candidate);$before=is_file($target)?hash_file('sha256',$target):null;
                if($before!==null&&!hash_equals($before,$after)&&!hash_equals((string)($old[$dest]??''),$before))throw new \RuntimeException('依赖副本已有未登记修改：'.$dest);
                if($before!==null&&strpos($dest,'/releases/')!==false&&!hash_equals($before,$after))throw new \RuntimeException('不可变依赖副本有差异：'.$dest);
                $plan[$dest]=['source'=>$candidate,'before'=>$before,'after'=>$after,'bytes'=>filesize($candidate)];
                if(count($plan)>Manifest::MAX_FILES)throw new \RuntimeException('原生依赖副本数量过多');
                return;
            }
            if(is_link($root.'/'.$dest))return;
            $children=[];
            foreach([$root,$stage]as$base){
                if($base===''||!is_dir($base.'/'.$source))continue;
                \CRA1\Theme\Files::noLinks($base.'/'.$source);
                foreach(scandir($base.'/'.$source)as$name){
                    if($name==='.'||$name==='..'||$name==='.gitkeep')continue;
                    if(is_link($base.'/'.$source.'/'.$name))throw new \RuntimeException('依赖源目录含未登记软链接：'.$source.'/'.$name);
                    $children[$name]=true;
                }
            }
            foreach($references as$from=>$to)if(strpos($from,$source.'/')===0)$children[explode('/',substr($from,strlen($source)+1))[0]]=true;
            if(!$children&&!is_dir($root.'/'.$source)&&!($stage!==''&&is_dir($stage.'/'.$source)))throw new \RuntimeException('依赖副本来源不存在：'.$source);
            ksort($children);
            foreach(array_keys($children)as$name)$walk($dest.'/'.$name,$source.'/'.$name,$seen);
        };
        foreach($references as$dest=>$source)$walk($dest,$source);
        return $plan;
    }
    private static function copyApply(string $root,array $references): array
    {
        $plan=self::copyPlan($root,$references);$previous=[];$created=[];
        try{
            foreach($plan as$path=>$row){
                $target=$root.'/'.$path;
                if($row['before']===$row['after'])continue;
                $previous[$target]=$row['before']===null?null:(string)file_get_contents($target);
                if(!is_dir(dirname($target))&&!mkdir(dirname($target),0755,true))throw new \RuntimeException('依赖副本目录不可写');
                \CRA1\Theme\Files::atomic($target,(string)file_get_contents($row['source']),0644);
                if(!hash_equals($row['after'],hash_file('sha256',$target)))throw new \RuntimeException('依赖副本写入校验失败');
                if($row['before']===null)$created[]=$target;
            }
            $registry=self::copyRegistry($root);$doc=\CRA1\Theme\Files::json($registry,true);
            foreach($plan as$path=>$row)$doc['files'][$path]=$row['after'];
            if(isset($doc['files']))ksort($doc['files']);
            if(!is_file($registry))$created[]=$registry;
            $bytes=json_encode($doc,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";
            if(!is_file($registry)||!hash_equals(hash_file('sha256',$registry),hash('sha256',$bytes)))\CRA1\Theme\Files::atomic($registry,$bytes,0600);
            return $created;
        }catch(\Throwable $e){
            foreach(array_reverse($previous,true)as$target=>$bytes){if($bytes===null){if(is_file($target))unlink($target);}else \CRA1\Theme\Files::atomic($target,$bytes,0644);}
            throw $e;
        }
    }
    /** Resolve a planned dependency without creating directories during preflight. */
    private static function resolve(string $root,string $target,array $references,array $seen=[]): string
    {
        if(isset($seen[$target])||count($seen)>32)throw new \RuntimeException('原生依赖形成循环');
        $seen[$target]=true;$real=realpath($root.'/'.$target);
        if($real!==false){
            if(strncmp($real,$root.'/public/',strlen($root.'/public/'))!==0)throw new \RuntimeException('依赖超出站点：'.$target);
            return $real;
        }
        foreach($references as $path=>$next)if($target===$path||strncmp($target,$path.'/',strlen($path)+1)===0)return self::resolve($root,$next.substr($target,strlen($path)),$references,$seen);
        // A directory made entirely from declared child references is also a valid
        // future target, e.g. the mobile cart API directory on a fresh install.
        if(preg_match('~^public/(?:clientarea|cart|home)/template/(?:pc|mobile)/cra1/~D',$target)){
            $children=[];foreach($references as $path=>$next)if(strncmp($path,$target.'/',strlen($target)+1)===0)$children[]=$next;
            if($children){foreach($children as $child)self::resolve($root,$child,$references,$seen);return $root.'/'.$target;}
        }
        throw new \RuntimeException('依赖不存在：'.$target);
    }
    public static function inspect(string $root,array $references,string $entry='cra1admin'): array
    {
        $root=rtrim($root,'/');
        $out=[];
        foreach($references as$path=>$target){
            if(!is_string($path)||!is_string($target)||!preg_match('~^public/(?:clientarea|cart|home)/template/(?:pc|mobile)/cra1(?:/[A-Za-z0-9_./-]+)?$~D',$path)||strpos($path,'..')!==false)throw new \InvalidArgumentException('原生依赖位置无效');
            if(in_array($path,array_map(static function($value){return rtrim($value,'/');},Manifest::ROOTS),true))Manifest::path($path.'/reference-check');else Manifest::path($path);
            if(!preg_match('~^public/(?:clientarea|cart|home)/template/(?:pc|mobile)/(?:cra1|default)(?:/[A-Za-z0-9_./-]+)?$~D',$target)||strpos($target,'..')!==false)throw new \InvalidArgumentException('原生依赖目标无效');
            $real=self::resolve($root,$target,$references);
            $dest=$root.'/'.$path;
            \CRA1\Theme\Files::noLinks(dirname($dest));
            if(is_link($dest)){
                if(realpath($dest)!==$real)throw new \RuntimeException('现有依赖链接不同：'.$path);
            }elseif(file_exists($dest)){
                if(!self::usesCopies($root,$references)&&(!is_file($dest)||!is_file($real)||!hash_equals(hash_file('sha256',$dest),hash_file('sha256',$real))))throw new \RuntimeException('依赖位置已有不同文件，请先检查：'.$path);
            }
            $out[$path]=$target;
        }
        return $out;
    }
    public static function apply(string $root,array $references): array
    {
        $checked=self::inspect($root,$references);$created=[];
        if(self::usesCopies($root,$checked))return self::copyApply($root,$checked);
        try{foreach($checked as$path=>$target){
            $dest=$root.'/'.$path;if(file_exists($dest)||is_link($dest))continue;
            if(!is_dir(dirname($dest))&&!mkdir(dirname($dest),0755,true))throw new \RuntimeException('无法创建依赖目录');
            $from=explode('/',dirname($path));$to=explode('/',$target);
            while($from&&$to&&$from[0]===$to[0]){array_shift($from);array_shift($to);}
            $relative=str_repeat('../',count($from)).implode('/',$to);
            if(!symlink($relative,$dest))throw new \RuntimeException('无法登记原生依赖');$created[]=$dest;
        }
        foreach($checked as $path=>$target)if(realpath($root.'/'.$path)===false||realpath($root.'/'.$path)!==realpath($root.'/'.$target))throw new \RuntimeException('依赖登记后自检失败：'.$path);
        return $created;}catch(\Throwable $e){foreach(array_reverse($created)as$path)unlink($path);throw $e;}
    }

    public static function removeCreated(string $root,array $references): void
    {
        foreach(array_reverse($references,true) as $path=>$target){
            \CRA1\Theme\Files::noLinks(dirname($root.'/'.$path));
            $dest=$root.'/'.$path;
            if(!file_exists($dest)&&!is_link($dest))continue;
            if(!is_link($dest)||realpath($dest)!==realpath($root.'/'.$target))throw new \RuntimeException('依赖链接在更新后被修改，请人工检查：'.$path);
            if(!unlink($dest))throw new \RuntimeException('无法恢复依赖链接：'.$path);
        }
    }
}
