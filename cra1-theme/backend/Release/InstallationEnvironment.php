<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** Initial installation checks the host environment, independently of business compatibility. */
final class InstallationEnvironment
{
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
        $unwritable = [];
        foreach (['runtime/cra1_theme','config','public/upload','public','public/'.$entry,'public/cra1-install','cra1-theme/backend'] as $directory) {
            $path = rtrim($root,'/').'/'.$directory;
            try {
                Files::noLinks($path);
                while (!file_exists($path) && dirname($path) !== $path) $path = dirname($path);
                if (!is_dir($path) || !is_writable($path)) $unwritable[] = $directory;
            } catch (\Throwable $error) {
                $unwritable[] = $directory;
            }
        }
        $add('directories',$unwritable?'blocked':'pass','目录权限',$unwritable?'请检查这些目录的写入权限：'.implode('、',$unwritable):'主题配置、图片和安装目录可写');

        $https = $options['https'] ?? (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        $add('https',$https?'pass':'blocked','HTTPS',$https?'已通过 HTTPS 访问':'请通过本站有效的 HTTPS 地址安装');

        $proof = Files::json($root.'/runtime/cra1_theme/private-path-check.json',true);
        $protected = PrivatePaths::valid($proof,$root,$options['origin'] ?? null);
        $detail = '配置、账号等私有文件无法通过网站下载';
        if (!$protected) {
            $checks = $proof['checks'] ?? [];
            if (!$checks) $detail = '文件访问检查尚未完成，请点击“验证并检查”重试';
            elseif (empty($checks[0]['passed'])) $detail = '服务器无法正确访问本站 HTTPS 地址，请检查域名解析、证书或回源设置后重试';
            elseif (empty($proof['passed'])) $detail = '目录访问保护未通过，请确认网站运行目录为 V10 的 public 目录后重试';
            else $detail = '文件访问检查已过期或站点地址已变化，请重新检查';
        }
        $add('private-paths',$protected?'pass':'blocked','文件访问保护',$detail);

        if (is_file($root.'/runtime/cra1_theme/distribution/pending.json')) {
            $add('interrupted','blocked','安装状态','存在未完成的主题更新，请从现有主题后台恢复后再操作');
        }
        $release = Files::json($root.'/cra1-theme/release.json',true);
        $current = Files::json($root.'/runtime/cra1_theme/distribution/current.json',true);
        if (isset($current['manifest']) && is_array($current['manifest'])) $release = $current['manifest'];
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
