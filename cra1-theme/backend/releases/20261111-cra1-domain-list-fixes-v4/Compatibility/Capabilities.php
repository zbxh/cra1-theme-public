<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

/** Each optional capability fails independently; results live only for this request. */
final class Capabilities
{
    private static array $memo = [];
    public static function attempt(string $key, callable $read, $fallback = null)
    {
        if (!array_key_exists($key, self::$memo)) {
            try { self::$memo[$key] = $read(); }
            catch (\Throwable $e) {
                error_log('CRA1 capability unavailable: '.$key);
                self::$memo[$key] = $fallback;
            }
        }
        return self::$memo[$key];
    }

    public static function module(string $name, array $methods): bool
    {
        if (!in_array($name, ['mf_cloud', 'mf_dcim'], true)) return false;
        return (bool)self::attempt('module:'.$name.':'.implode(',', $methods), static function () use ($name, $methods) {
            $installed = \think\facade\Db::name('plugin')->where('module', 'server')
                ->where('name', parse_name($name, 1))->where('status', 1)->find();
            if (!$installed) return false;
            $class = '\\server\\'.$name.'\\controller\\home\\CloudController';
            if (!class_exists($class)) return false;
            foreach ($methods as $method) if (!method_exists($class, $method)) return false;
            return true;
        }, false);
    }

    public static function appPresets(): bool
    {
        return (bool)self::attempt('module:app-presets', static function () {
            if (!self::module('mf_cloud', [])) return false;
            $class = '\\server\\mf_cloud\\controller\\home\\AppPresetController';
            if (!class_exists($class) || !method_exists($class, 'tasks') || !method_exists($class, 'logs')) return false;
            // A leftover controller is insufficient: its registered routes and schema must exist.
            $route = file_get_contents(CRA1_THEME_ROOT.'/public/plugins/server/mf_cloud/route.php');
            if (strpos($route, 'app_preset_task') === false) return false;
            \think\facade\Db::name('module_mf_cloud_app_preset_task')->limit(1)->field('id')->select();
            return true;
        }, false);
    }
}
