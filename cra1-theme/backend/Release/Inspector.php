<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** Read-only inspection: no store constructor, migration, snapshot or cache repair. */
final class Inspector
{
    public static function context(string $root): array
    {
        try{
            if(!defined('DATABASE_HOSTNAME'))require_once $root.'/config.php';
            foreach(['DATABASE_HOSTNAME','DATABASE_PORT','DATABASE_NAME','DATABASE_CHARSET','DATABASE_USERNAME','DATABASE_PASSWORD'] as $constant)if(!defined($constant))throw new \RuntimeException('数据库配置不完整');
            $db=new \PDO('mysql:host='.DATABASE_HOSTNAME.';port='.DATABASE_PORT.';dbname='.DATABASE_NAME.';charset='.DATABASE_CHARSET,DATABASE_USERNAME,DATABASE_PASSWORD,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_TIMEOUT=>3]);
            $query=\CRA1\Theme\Compatibility\Database::query($db,"SELECT setting,value FROM idcsmart_configuration WHERE setting IN ('system_version','clientarea_theme','clientarea_theme_mobile','cart_theme','cart_theme_mobile','web_theme','home_theme','home_theme_mobile')");
            $settings=array_column($query->fetchAll(\PDO::FETCH_ASSOC),'value','setting');
            $modules=\CRA1\Theme\Compatibility\Database::query($db,"SELECT name,version,status FROM idcsmart_plugin WHERE module='server'")->fetchAll(\PDO::FETCH_ASSOC);
            $sqlMode=(string)\CRA1\Theme\Compatibility\Database::query($db,'SELECT @@session.sql_mode')->fetchColumn();
            return ['system_version'=>$settings['system_version']??'','settings'=>$settings,'modules'=>$modules,'database'=>true,'database_sql_mode'=>$sqlMode];
        }catch(\Throwable $e){return ['system_version'=>'','modules'=>[],'database'=>false,'error'=>'无法只读确认系统版本和数据库连接'];}
    }
    public static function inspect(string $root,array $options=[]): array
    {
        $rows=[];
        $add=static function($id,$status,$label,$detail,$path='',$impact='',$scope='installation')use(&$rows){$rows[]=['id'=>$id,'status'=>$status,'label'=>$label,'detail'=>$detail,'path'=>$path,'scope'=>$scope,'owner'=>preg_match('~^(?:app|route|vendor|public/plugins)/|/default/~',$path)?'V10 或原生模块文件（只读）':'CRA1 或运行环境','impact'=>$impact];};
        $add('php',(PHP_MAJOR_VERSION===7&&PHP_MINOR_VERSION===4)?'pass':(version_compare(PHP_VERSION,'7.4','<')?'blocked':'unverified'),'PHP',PHP_VERSION,'','当前适配 PHP 7.4；其他版本请先检查兼容性');
        foreach(['pdo_mysql','pdo_sqlite','sodium','fileinfo','gd','zip','mbstring','dom','curl']as$ext)$add('extension:'.$ext,extension_loaded($ext)?'pass':'blocked',$ext,extension_loaded($ext)?'已加载':'缺少必要扩展');
        $add('password',defined('PASSWORD_ARGON2ID')?'pass':'blocked','密码存储',defined('PASSWORD_ARGON2ID')?'Argon2id 可用':'缺少 Argon2id');
        $context=$options['context']??self::context($root);
        $add('database',!empty($context['database'])?'pass':'blocked','数据库连接',!empty($context['database'])?'只读连接成功':'读取失败，未执行修改');
        if(isset($context['database_sql_mode'])) {
            $groupBy=in_array('ONLY_FULL_GROUP_BY',explode(',',strtoupper((string)$context['database_sql_mode'])),true);
            $add('database-group-by',$groupBy?'blocked':'pass','原生产品查询环境',$groupBy?'当前 MySQL 开启 ONLY_FULL_GROUP_BY，已验证的 V10 产品列表查询不能执行':'MySQL 分组规则符合已验证的原生查询环境','','请按 V10 的环境要求检查数据库配置；主题检查不会修改数据库模式或系统查询');
        }
        $version=(string)($context['system_version']??'');
        $release=Files::json($root.'/cra1-theme/release.json',true);
        $current=Files::json($root.'/runtime/cra1_theme/distribution/current.json',true);
        if(isset($current['manifest'])&&is_array($current['manifest']))$release=$current['manifest'];
        $identity=null;
        if(isset($release['identity'])||isset($release['theme_id'])){
            try{
                $identity=Identity::read($root);
                $matches=Identity::project($release['identity']??$release)===$identity;
                $add('identity',$matches?'pass':'blocked','主题标识',$matches?'与当前版本一致':'与当前版本不一致','cra1-theme/docs/product-identity.json','请检查主题文件是否完整更新');
            }catch(\Throwable $e){$add('identity','blocked','主题标识','主题标识登记无法读取','cra1-theme/docs/product-identity.json','请检查主题文件是否齐全');}
        }
        $runtimeSupported=self::runtimeMatch($release,$context);
        $add('compatibility',$runtimeSupported?'pass':'unverified','系统与模块兼容',$runtimeSupported?'系统与模块版本匹配，继续检查相关文件':('当前 '.($version?:'未知版本').'；尚无匹配的兼容记录'),'','请使用适配当前系统和模块版本的主题包');
        foreach($context['modules']??[] as $module){
            $folder=strtolower(preg_replace('/(?<!^)[A-Z]/','_$0',$module['name']));
            $file=$root.'/public/plugins/server/'.$folder.'/'.$module['name'].'.php';
            if(is_file($file)&&preg_match('/[\'\"]version[\'\"]\s*=>\s*[\'\"]([^\'\"]+)[\'\"]/u',(string)file_get_contents($file),$match)&&$match[1]!==$module['version'])$add('module-version:'.$module['name'],'blocked','模块版本不一致','数据库版本 '.$module['version'].'，源码元数据 '.$match[1],'public/plugins/server/'.$folder.'/'.$module['name'].'.php','模块升级状态或文件来源需先核实');
        }
        foreach($release['release_blockers']??[]as$i=>$blocker)$add('gate:'.$i,'blocked','安装条件',(string)$blocker);
        $files=$release['files']??[];
        if(!$files)$add('manifest','unverified','运行文件清单','尚未生成完整发行清单');
        foreach($files as$path=>$expected){
            if(CustomerData::repositoryFile($path))continue;
            try{
                $target=Manifest::destination($root,$path,$options['entry']??'cra1admin');
                $status=!is_file($target)?'blocked':(hash_equals($expected['sha256'],hash_file('sha256',$target))?'pass':'unverified');
                $add('file:'.$path,$status,Updater::purpose($path),$status==='pass'?'与发行清单一致':($status==='blocked'?'文件缺失':'文件有差异，未判断为主题或系统造成'),$path,'缺失或不兼容可能影响对应页面或功能');
            }catch(\Throwable $e){$add('file:'.$path,'blocked','发行文件',$e->getMessage(),$path);}
        }
        foreach($release['native_dependencies']??[]as$dependency){
            $check=self::nativeDependency($root,$dependency,$release['integration_profiles']??[]);
            $add('dependency:'.$check['path'],$check['status'],$check['purpose'],$check['detail'],$check['path'],$check['impact']);
        }
        // Renaming a backend entry checks its parent when requested. Ordinary
        // use and uploads into theme-owned directories do not write public/ itself.
        foreach(['runtime/cra1_theme','config','public/upload']as$dir){
            $path=$root.'/'.$dir;while(!file_exists($path)&&dirname($path)!==$path)$path=dirname($path);
            $add('writable:'.$dir,is_writable($path)?'pass':'blocked','目录权限',is_writable($path)?'目标可写':'目标不可写',$dir);
        }
        $https=$options['https']??(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off');
        $add('https',$https?'pass':'blocked','HTTPS',$https?'已通过 HTTPS 访问':'安装需要有效 HTTPS；不信任未经配置的转发请求头');
        // Inspection never makes network requests to localhost or downloads private canaries.
        try{$proof=Files::json($root.'/runtime/cra1_theme/private-path-check.json',true);}
        catch(\Throwable $error){$proof=[];}
        $diagnostic=PrivatePaths::assessment($proof,$root,$options['origin']??null);
        $add('private-paths',$diagnostic['status'],'文件访问诊断',$diagnostic['detail']);
        $pending=is_file($root.'/runtime/cra1_theme/distribution/pending.json');
        if($pending)$add('interrupted','blocked','中断更新','发现更新恢复记录，请先恢复主题文件');
        $counts=['pass'=>0,'warning'=>0,'blocked'=>0,'unverified'=>0];foreach($rows as$row)$counts[$row['status']]++;
        $installationCounts=['pass'=>0,'warning'=>0,'blocked'=>0,'unverified'=>0];foreach($rows as$row)if($row['scope']==='installation')$installationCounts[$row['status']]++;
        return ['release'=>$release['release']??'未登记','version'=>$release['version']??null,'release_channel'=>$release['release_channel']??'candidate','identity'=>$identity,'target'=>'10.7.4','context'=>$context,'checks'=>$rows,'counts'=>$counts,'installation_counts'=>$installationCounts,'installation_ready'=>$runtimeSupported&&$installationCounts['blocked']===0&&$installationCounts['unverified']===0,'compatible'=>$runtimeSupported&&$installationCounts['blocked']===0&&$installationCounts['unverified']===0,'read_only'=>true];
    }
    /** Runtime baseline is deliberately separate from a complete business support claim. */
    public static function runtimeMatch(array $release,array $context): bool
    {
        foreach($release['installation_combinations']??$release['verified_combinations']??[] as $combination){
            if(($combination['system']??'')===($context['system_version']??'')&&self::moduleMatch($context['modules']??[],$combination['modules']??[]))return true;
        }
        foreach($release['integration_profiles']??[] as $profile){
            if(($profile['provenance']??'')==='reviewed-integration'&&($profile['system']??'')===($context['system_version']??'')
                &&self::moduleMatch($context['modules']??[],$profile['modules']??[]))return true;
        }
        return false;
    }
    public static function moduleMatch(array $actual,array $verified): bool
    {
        $map=[];foreach($actual as$row)if((int)($row['status']??0)===1)$map[$row['name']]=$row['version'];
        ksort($map);ksort($verified);return $map===$verified;
    }

    /** Shared by read-only inspection and candidate preflight; never trust a version alone. */
    public static function nativeDependency(string $root,array $dependency,array $profiles=[]): array
    {
        $path=(string)($dependency['path']??'');
        $result=['path'=>$path,'status'=>'blocked','purpose'=>$dependency['purpose']??'原生依赖',
            'detail'=>'依赖路径无效','impact'=>$dependency['impact']??'须完成真实接口契约验证'];
        try{Manifest::nativePath($path);}catch(\Throwable $e){return $result;}
        $file=$root.'/'.$path;
        try{Files::noLinks($file);}catch(\Throwable $e){$result['detail']='原生依赖路径存在软链接，归属未确认';return $result;}
        if(!is_file($file)){$result['detail']='依赖缺失';return $result;}
        $verified=$dependency['verified_sha256']??[];
        if(is_array($verified)&&in_array(hash_file('sha256',$file),$verified,true)){
            $result['status']='pass';$result['detail']='匹配已验证官方基线';
        }elseif(\CRA1\Theme\Compatibility\KnownContracts::matchProfile($root,[],array_values(array_filter($profiles,static function($profile)use($path){return is_array($profile)&&isset($profile['files'][$path]);})))!==null){
            $result['status']='pass';$result['detail']='匹配已审阅并验证的系统适配组合';
        }else{
            $result['status']='unverified';$result['detail']='文件未匹配已核验官方基线；本站历史差异不归因于主题';
        }
        return $result;
    }
}
