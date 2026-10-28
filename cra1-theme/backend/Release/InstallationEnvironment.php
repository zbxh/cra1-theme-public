<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** Initial installation checks the host environment, independently of business compatibility. */
final class InstallationEnvironment
{
    private static function existingDirectory(string $root,string $relative): string
    {
        $path=rtrim($root,'/').'/'.$relative;
        while(!file_exists($path)&&dirname($path)!==$path)$path=dirname($path);
        return $path;
    }

    private static function writableDirectory(string $root,string $relative): bool
    {
        $path=rtrim($root,'/').'/'.$relative;
        try{
            Files::noLinks($path);
            $path=self::existingDirectory($root,$relative);
            return is_dir($path)&&is_writable($path)&&is_executable($path);
        }catch(\Throwable $error){return false;}
    }

    private static function context(string $root): array
    {
        try {
            if (!defined('DATABASE_HOSTNAME')) require_once $root.'/config.php';
            foreach (['DATABASE_HOSTNAME','DATABASE_PORT','DATABASE_NAME','DATABASE_CHARSET','DATABASE_USERNAME','DATABASE_PASSWORD'] as $constant) {
                if (!defined($constant)) throw new \RuntimeException('数据库配置不完整');
            }
            $db = new \PDO('mysql:host='.DATABASE_HOSTNAME.';port='.DATABASE_PORT.';dbname='.DATABASE_NAME.';charset='.DATABASE_CHARSET,
                DATABASE_USERNAME,DATABASE_PASSWORD,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_TIMEOUT=>3]);
            $query = \CRA1\Theme\Compatibility\Database::query($db,"SELECT value FROM idcsmart_configuration WHERE setting='system_version'");
            return ['database'=>true,'system_version'=>(string)$query->fetchColumn()];
        } catch (\Throwable $error) {
            return ['database'=>false,'system_version'=>''];
        }
    }

    public static function inspect(string $root, array $options = []): array
    {
        $rows = [];
        $add = static function (string $id, string $status, string $label, string $detail) use (&$rows): void {
            $rows[] = ['id'=>$id,'status'=>$status,'label'=>$label,'detail'=>$detail];
        };
        $php = PHP_MAJOR_VERSION === 7 && PHP_MINOR_VERSION === 4;
        $add('php',$php?'pass':'blocked','PHP 版本',$php?'PHP '.PHP_VERSION:'请使用 V10 对应的 PHP 7.4 环境，当前为 '.PHP_VERSION);

        $missing = [];
        foreach (['pdo_mysql','pdo_sqlite','sodium','fileinfo','gd','zip','mbstring','dom','curl'] as $extension) {
            if (!extension_loaded($extension)) $missing[] = $extension;
        }
        if (!defined('PASSWORD_ARGON2ID')) $missing[] = 'Argon2id';
        $add('extensions',$missing?'blocked':'pass','必要扩展',$missing?'请启用：'.implode('、',$missing):'已加载主题所需的 PHP 扩展');

        // The optional context is used by isolated PHP fixtures, never accepted from HTTP input.
        $context = $options['context'] ?? self::context($root);
        $add('database',!empty($context['database'])?'pass':'blocked','数据库连接',!empty($context['database'])?'数据库可连接':'无法连接 V10 数据库，请检查站点数据库配置');

        $entry = (string)($options['entry'] ?? 'cra1admin');
        if (!preg_match('/^[a-z][a-z0-9]{5,31}$/D',$entry)) throw new \InvalidArgumentException('主题后台地址记录无效');
        $release = Files::json($root.'/cra1-theme/release.json',true);
        $current = Files::json($root.'/runtime/cra1_theme/distribution/current.json',true);
        if (isset($current['manifest']) && is_array($current['manifest'])) $release = $current['manifest'];
        $unwritable = [];$unreadable=[];$referenceError='';
        // Program directories and controllers are read-only during initialization.
        // Only identity/configuration storage and missing native references need writes.
        foreach(['runtime/cra1_theme','runtime/cra1_theme/distribution','config']as$directory)if(!self::writableDirectory($root,$directory))$unwritable[]=$directory;
        $references=$release['references']??[];
        foreach($references as$destination=>$target){
            if(!is_string($destination))continue;
            Manifest::path($destination.'/permission-check');
            if(!file_exists($root.'/'.$destination)&&!is_link($root.'/'.$destination)&&!self::writableDirectory($root,dirname($destination)))$unwritable[]=dirname($destination);
        }
        // A previous extraction may already contain dependency directories. In
        // copy mode, check only parents of files that actually need to change.
        if($references&&References::usesCopies($root,$references)){
            try{
                foreach(References::copyPlan($root,$references)as$destination=>$row){
                    if($row['before']!==$row['after']&&!self::writableDirectory($root,dirname($destination)))$unwritable[]=dirname($destination);
                }
            }catch(\Throwable $error){$referenceError='原生页面资源暂时无法准备，请检查安装包是否完整解压后重新检查';}
        }
        foreach(['public/cra1-install','public/'.$entry,'cra1-theme/backend']as$directory){
            $path=$root.'/'.$directory;
            if(!file_exists($path)&&!is_link($path))continue;
            try{Files::noLinks($path);if(!is_dir($path)||!is_readable($path)||!is_executable($path))$unreadable[]=$directory;}
            catch(\Throwable $error){$unreadable[]=$directory;}
        }
        foreach(['public/cra1-install/index.php','public/cra1-install/api.php','public/cra1-install/installer.js','public/cra1-install/installer.css','public/'.$entry.'/index.php','cra1-theme/backend/bootstrap.php']as$file){
            $path=$root.'/'.$file;if(file_exists($path)&&(!is_file($path)||!is_readable($path)))$unreadable[]=$file;
        }
        $details=[];$locations=[];
        foreach($unwritable as$directory){
            $path=self::existingDirectory($root,$directory);
            $relative=$path===rtrim($root,'/')?'网站根目录':substr($path,strlen(rtrim($root,'/'))+1);
            $locations[$relative]=true;
        }
        ksort($locations);$parents=[];
        foreach(array_keys($locations)as$directory){
            $covered=isset($locations['网站根目录']);
            foreach($parents as$parent)if(strpos($directory,$parent.'/')===0)$covered=true;
            if(!$covered||$directory==='网站根目录')$parents[]=$directory;
        }
        if($parents)$details[]='PHP 运行用户需要写入：'.implode('、',$parents).'（含需要创建或补齐的子目录），请在网站面板检查属主及写入权限';
        if($unreadable)$details[]='请检查解压文件是否完整、目录可访问及文件可读：'.implode('、',array_unique($unreadable));
        if($referenceError!=='')$details[]=$referenceError;
        $add('directories',$details?'blocked':'pass','目录权限',$details?implode('；',$details).'。无需将整站设为 777':'初始化目录可写，主题程序可读');

        $https = $options['https'] ?? (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        $add('https',$https?'pass':'blocked','HTTPS',$https?'已通过 HTTPS 访问':'请通过本站有效的 HTTPS 地址安装');

        try {$proof = Files::json($root.'/runtime/cra1_theme/private-path-check.json',true);}
        catch (\Throwable $error) {$proof = [];}
        $diagnostic = PrivatePaths::assessment($proof,$root,$options['origin'] ?? null);
        $add('private-paths',$diagnostic['status'],'文件访问诊断',$diagnostic['detail']);

        if (is_file($root.'/runtime/cra1_theme/distribution/pending.json')) {
            $add('interrupted','blocked','安装状态','存在未完成的主题更新，请从现有主题后台恢复后再操作');
        }
        $identity = isset($release['theme_id']) ? Identity::project($release) : null;
        $counts = ['pass'=>0,'warning'=>0,'blocked'=>0,'unverified'=>0];
        foreach ($rows as $row) $counts[$row['status']]++;
        $ready = $counts['blocked'] === 0;
        return ['release'=>$release['release'] ?? '未登记','version'=>$release['version'] ?? null,
            'release_channel'=>$release['release_channel'] ?? 'candidate','identity'=>$identity,
            'environment'=>['system_version'=>(string)($context['system_version'] ?? ''),'php'=>PHP_VERSION],
            'checks'=>$rows,'counts'=>$counts,'installation_counts'=>$counts,
            'installation_ready'=>$ready,'compatible'=>$ready,'scope'=>'environment','read_only'=>true];
    }
}
