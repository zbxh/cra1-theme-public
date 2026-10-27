<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;

final class Manifest
{
    public const MAX_FILES=25000;
    public const MAX_BYTES=268435456;
    public const ROOTS=[
        'cra1-theme/backend/','cra1-theme/docs/','cra1-theme/licenses/','cra1-theme/source/','cra1-theme/scripts/',
        'public/web/cra1/','public/clientarea/template/pc/cra1/','public/clientarea/template/mobile/cra1/',
        'public/cart/template/pc/cra1/','public/cart/template/mobile/cra1/',
        'public/home/template/pc/cra1/','public/home/template/mobile/cra1/','public/cra1-shared/','public/cra1admin/','public/cra1-install/',
    ];
    public const HELPERS=['lib/cra1_theme_admin.php','lib/cra1_theme_security.php','lib/cra1_theme_media.php','lib/cra1_theme_seo.php','lib/cra1_theme_client_actions.php','bin/cra1-theme-security.php','bin/cra1-theme-media.php'];

    public static function path(string $path): string
    {
        if ($path==='' || strlen($path)>500 || preg_match('~[\\\\\x00-\x1f\x7f:%]~',$path) || $path[0]==='/' || substr($path,-1)==='/') throw new \InvalidArgumentException('发行包路径无效');
        foreach(explode('/',$path) as $part) if ($part==='' || $part==='.' || $part==='..' || $part[0]==='.') throw new \InvalidArgumentException('发行包路径穿越或隐藏路径');
        $allowed=in_array($path,self::HELPERS,true)||in_array($path,['cra1-theme/LICENSE.txt','cra1-theme/THIRD_PARTY_NOTICES.md','cra1-theme/release.json'],true);
        foreach(self::ROOTS as $root) if(strncmp($path,$root,strlen($root))===0) $allowed=true;
        if(!$allowed || preg_match('~(?:^|/)(?:node_modules|runtime|config|logs?|backups?|tests?)(?:/|$)|(?:\.sqlite(?:-wal|-shm)?|\.key|\.pem|\.env|storage\.json|entry\.json|admin\.json|auth\.json)$~i',$path)) throw new \InvalidArgumentException('发行包含非主题文件或私有数据：'.$path);
        return $path;
    }

    /** Native assets may have Chinese names and spaces; these paths are read-only. */
    public static function nativePath(string $path): string
    {
        if($path===''||strlen($path)>500||preg_match('//u',$path)!==1
            ||preg_match('~[\\\\\x00-\x1f\x7f:%]~',$path)||$path[0]==='/'||substr($path,-1)==='/'
            ||!preg_match('~^(?:app|route|vendor|public/(?:plugins|(?:clientarea|cart|home)/template/(?:pc|mobile)/default))/~D',$path))throw new \InvalidArgumentException('原生契约路径无效');
        $parts=explode('/',$path);
        foreach($parts as $i=>$part){
            // Official empty component directories carry this non-secret placeholder.
            $placeholder=$part==='.gitkeep'&&$i===count($parts)-1;
            if($part===''||$part==='.'||$part==='..'||($part[0]==='.'&&!$placeholder))throw new \InvalidArgumentException('原生契约路径穿越或隐藏路径');
        }
        return $path;
    }

    public static function validate(array $doc): array
    {
        if(($doc['format']??null)!==1 || ($doc['product']??'')!=='cra1-theme' || !preg_match('/^[a-z0-9][a-z0-9-]{3,80}$/D',(string)($doc['release']??''))) throw new \InvalidArgumentException('发行清单格式不支持');
        if(isset($doc['release_channel'])&&!in_array($doc['release_channel'],['candidate','test'],true))throw new \InvalidArgumentException('发行渠道无效');
        $files=$doc['files']??null;
        if(!is_array($files)||!$files||count($files)>self::MAX_FILES) throw new \InvalidArgumentException('发行文件数量异常');
        $total=0;$case=[];
        foreach($files as $path=>$row){
            self::path((string)$path);
            $key=strtolower($path);if(isset($case[$key]))throw new \InvalidArgumentException('发行包路径大小写冲突');$case[$key]=true;
            if(!is_array($row)||!preg_match('/^[a-f0-9]{64}$/D',(string)($row['sha256']??''))||!is_int($row['bytes']??null)||$row['bytes']<0)throw new \InvalidArgumentException('发行文件校验信息异常');
            $total+=$row['bytes'];
        }
        if($total>self::MAX_BYTES)throw new \InvalidArgumentException('发行包解压体积过大');
        if(isset($doc['theme_id']))Identity::project($doc);
        if(isset($doc['identity'])){
            $identity=Identity::project($doc['identity']);
            foreach(['product','display_name','brand']as$key)if(($identity[$key]??null)!==($doc[$key]??null))throw new \InvalidArgumentException('主题信息与统一标识不一致');
        }
        // Older archives remain readable. Their optional metadata never enters customer responses.
        if(isset($doc['license'])){
            $license=$doc['license'];$identity=$doc['identity']??[];
            if(!is_array($license)||($license['file']??'')!=='cra1-theme/LICENSE.txt'
                ||!is_int($license['version']??null)||$license['version']<1
                ||!preg_match('/^[a-f0-9]{64}$/D',(string)($license['sha256']??'')))throw new \InvalidArgumentException('历史包登记信息无效');
            $terms=$license;unset($terms['sha256']);
            if(($identity['license']??null)!==$terms||($files[$license['file']]['sha256']??'')!==$license['sha256'])throw new \InvalidArgumentException('历史包登记信息与文件不一致');
        }
        $references=$doc['references']??[];
        if(!is_array($references))throw new \InvalidArgumentException('原生依赖清单无效');
        foreach($references as $path=>$target){
            if(!is_string($path)||!is_string($target)||!preg_match('~^public/(?:clientarea|cart|home)/template/(?:pc|mobile)/cra1(?:/[A-Za-z0-9_./-]+)?$~D',$path)||strpos($path,'..')!==false)throw new \InvalidArgumentException('原生依赖位置无效');
            self::path($path.'/reference-check');
            if(!preg_match('~^public/(?:clientarea|cart|home)/template/(?:pc|mobile)/(?:cra1|default)(?:/[A-Za-z0-9_./-]+)?$~D',$target)||strpos($target,'..')!==false||$target===$path)throw new \InvalidArgumentException('原生依赖目标无效');
            foreach(array_keys($files) as $file)if(strtolower($file)===strtolower($path)||strpos(strtolower($file),strtolower($path).'/')===0||strpos(strtolower($path),strtolower($file).'/')===0)throw new \InvalidArgumentException('发行文件与依赖位置冲突');
            foreach(array_keys($references) as $other)if($other!==$path&&(strtolower($other)===strtolower($path)||strpos(strtolower($other),strtolower($path).'/')===0))throw new \InvalidArgumentException('原生依赖位置相互重叠');
        }
        if (isset($doc['security_epoch']) && (!is_int($doc['security_epoch']) || $doc['security_epoch']<1)) throw new \InvalidArgumentException('安全兼容版本无效');
        if(isset($doc['backend_root'])&&$doc['backend_root']!=='cra1-theme/backend/releases/'.$doc['release'])throw new \InvalidArgumentException('私有后端必须使用对应的不可变版本目录');
        if(isset($doc['asset_bases'])){
            $expected=['member'=>'/clientarea/template/pc/cra1/releases/','native'=>'/clientarea/template/pc/cra1/releases/','cart'=>'/cart/template/pc/cra1/releases/','shared'=>'/cra1-shared/releases/','website'=>'/web/cra1/releases/','admin'=>'assets/releases/'];
            if(!is_array($doc['asset_bases'])||array_diff(array_keys($doc['asset_bases']),array_keys($expected)))throw new \InvalidArgumentException('主题资源域无效');
            foreach($doc['asset_bases'] as $domain=>$base)if($base!==$expected[$domain].$doc['release'])throw new \InvalidArgumentException('主题资源必须使用同一不可变发行版本');
        }
        if (isset($doc['verified_combinations']) && !is_array($doc['verified_combinations'])) throw new \InvalidArgumentException('兼容矩阵无效');
        foreach ($doc['verified_combinations']??[] as $combination) if (!is_array($combination)||!is_string($combination['system']??null)||!is_array($combination['modules']??null)||empty($combination['evidence'])) throw new \InvalidArgumentException('兼容记录不完整');
        if(isset($doc['installation_combinations'])&&!is_array($doc['installation_combinations']))throw new \InvalidArgumentException('安装基线无效');
        foreach($doc['installation_combinations']??[]as$combination){
            if(!is_array($combination)||!is_string($combination['system']??null)||!is_array($combination['modules']??null)
                ||!is_array($combination['evidence']??null)||($combination['evidence']['scope']??'')!=='native-runtime-baseline'
                ||($combination['evidence']['official_upgrade']??false)!==true
                ||!preg_match('/^[a-f0-9]{64}$/D',(string)($combination['evidence']['record_sha256']??'')))throw new \InvalidArgumentException('安装基线缺少官方升级证据');
        }
        foreach(['release_blockers','commercial_blockers']as$key){
            if(isset($doc[$key])&&!is_array($doc[$key]))throw new \InvalidArgumentException('安装条件格式无效');
            foreach($doc[$key]??[]as$blocker)if(!is_string($blocker)||$blocker==='')throw new \InvalidArgumentException('安装条件内容无效');
        }
        if(isset($doc['native_dependencies'])&&!is_array($doc['native_dependencies']))throw new \InvalidArgumentException('原生契约清单无效');
        $nativePaths=[];
        foreach($doc['native_dependencies']??[] as $dependency){
            if(!is_array($dependency)||!is_string($dependency['path']??null)
                ||isset($nativePaths[strtolower($dependency['path'])])
                ||!is_array($dependency['verified_sha256']??[]))throw new \InvalidArgumentException('原生契约路径或校验信息无效');
            self::nativePath($dependency['path']);
            $nativePaths[strtolower($dependency['path'])]=true;
            foreach($dependency['verified_sha256']??[] as $hash)if(!is_string($hash)||!preg_match('/^[a-f0-9]{64}$/D',$hash))throw new \InvalidArgumentException('原生契约校验值无效');
        }
        return $doc;
    }

    public static function destination(string $root,string $path,string $entry): string
    {
        self::path($path);
        if(!preg_match('/^[a-z0-9]{6,32}$/D',$entry))throw new \InvalidArgumentException('主题后台路径无效');
        if(strncmp($path,'public/cra1admin/',strlen('public/cra1admin/'))===0)$path='public/'.$entry.'/'.substr($path,strlen('public/cra1admin/'));
        $target=rtrim($root,'/').'/'.$path;
        for($p=$target;$p!==rtrim($root,'/');$p=dirname($p)){
            if(is_link($p))throw new \RuntimeException('目标为软链接，禁止覆盖：'.$path);
            if(dirname($p)===$p)throw new \RuntimeException('目标路径超出站点');
        }
        return $target;
    }
}
