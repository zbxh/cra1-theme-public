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

    public static function query(\PDO $db, string $sql)
    {
        $result = $db->query(str_replace('idcsmart_', self::prefix(), $sql));
        if ($result === false) throw new \RuntimeException('Theme read query failed');
        return $result;
    }
}
