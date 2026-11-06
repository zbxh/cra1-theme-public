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
        $php = version_compare(PHP_VERSION,'7.4','>=');
        $add('php',$php?'pass':'blocked','PHP 版本',$php?'PHP '.PHP_VERSION:'主题需要 PHP 7.4 或更高版本，当前为 '.PHP_VERSION);

        $missing = [];
        foreach (['pdo_mysql','pdo_sqlite','sodium','fileinfo','gd','zip','mbstring','dom','curl'] as $extension) {
            if (!extension_loaded($extension)) $missing[] = $extension;
        }
        if (!defined('PASSWORD_ARGON2ID')) $missing[] = 'Argon2id';
        $add('extensions',$missing?'blocked':'pass','必要扩展',$missing?'请启用：'.implode('、',$missing):'已加载主题所需的 PHP 扩展');

        // The optional context is used by isolated PHP fixtures, never accepted from HTTP input.
        $context = $options['context'] ?? self::context($root);
        $add('database',!empty($context['database'])?'pass':'blocked','数据库连接',!empty($context['database'])?'数据库可连接':'无法连接 V10 数据库，请检查站点数据库配置');

        $release = Files::json($root.'/cra1-theme/release.json',true);
        $current = Files::json($root.'/runtime/cra1_theme/distribution/current.json',true);
        if (isset($current['manifest']) && is_array($current['manifest'])) $release = $current['manifest'];
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
