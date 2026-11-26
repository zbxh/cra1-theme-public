<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

final class Database
{
    public static function prefix(): string
    {
        $prefix = 'idcsmart_';
        if (function_exists('config')) {
            $value = config('database.connections.mysql.prefix');
            if (is_string($value) && $value !== '') $prefix = $value;
        }
        if (!preg_match('/^[A-Za-z0-9_]+$/D', $prefix)) throw new \RuntimeException('Invalid database prefix');
        return $prefix;
    }

    /** Standalone theme requests read site connection settings without booting V10. */
    public static function localConnection(): ?\PDO
    {
        static $pdo = null, $tried = false;
        if ($tried) return $pdo;
        $tried = true;
        if (!defined('DATABASE_HOSTNAME') && is_file(CRA1_THEME_ROOT.'/config.php')) {
            require_once CRA1_THEME_ROOT.'/config.php';
        }
        if (!defined('DATABASE_HOSTNAME') || !defined('DATABASE_NAME')) return null;
        try {
            $dsn = 'mysql:host='.DATABASE_HOSTNAME.';port='.DATABASE_PORT.';dbname='.DATABASE_NAME.';charset='.DATABASE_CHARSET;
            $pdo = new \PDO($dsn, DATABASE_USERNAME, DATABASE_PASSWORD, [
                \PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE=>\PDO::FETCH_ASSOC,
                \PDO::ATTR_TIMEOUT=>5,
            ]);
        } catch (\Throwable $error) {}
        return $pdo;
    }

    public static function query(\PDO $db, string $sql)
    {
        $result = $db->query(str_replace('idcsmart_', self::prefix(), $sql));
        if ($result === false) throw new \RuntimeException('Theme read query failed');
        return $result;
    }
}
