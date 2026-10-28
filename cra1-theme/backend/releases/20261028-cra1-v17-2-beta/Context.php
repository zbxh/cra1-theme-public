<?php
declare(strict_types=1);
namespace CRA1\Theme;

final class Context
{
    public static function isCRA1(string $theme): bool
    {
        return in_array($theme, ['cra1', 'pc/cra1', 'mobile/cra1'], true);
    }

    /** Server settings decide security policy; request cookies cannot disable it. */
    public static function active(): bool
    {
        return self::selected(['web_theme', 'clientarea_theme', 'clientarea_theme_mobile', 'cart_theme', 'cart_theme_mobile']);
    }

    /** A website-only installation must not change another member theme's API policy. */
    public static function memberActive(): bool
    {
        return self::selected(['clientarea_theme', 'clientarea_theme_mobile', 'cart_theme', 'cart_theme_mobile']);
    }

    private static function selected(array $keys): bool
    {
        if (!function_exists('configuration')) return false;
        foreach ($keys as $key) {
            try { if (self::isCRA1((string)configuration($key))) return true; }
            catch (\Throwable $e) { error_log('CRA1 context setting unavailable: '.$key); }
        }
        return false;
    }

    public static function version(): string
    {
        try { return function_exists('configuration') ? (string)configuration('system_version') : ''; }
        catch (\Throwable $e) { return ''; }
    }
}
