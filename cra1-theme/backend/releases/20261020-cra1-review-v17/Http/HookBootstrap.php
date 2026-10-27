<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;

final class HookBootstrap
{
    private static bool $registered = false;
    public static function register(): void
    {
        if (self::$registered || !class_exists('think\\facade\\Event')) return;
        // Uploading source/candidate files must not activate a second security
        // pipeline on a legacy site. Installation or an atomic update commits it.
        $installed=is_file(CRA1_THEME_ROOT.'/runtime/cra1_theme/install.json');
        $current=\CRA1\Theme\Files::json(CRA1_THEME_ROOT.'/runtime/cra1_theme/distribution/current.json',true);
        if(!$installed&&empty($current['backend_root']))return;
        self::$registered = true;
        // AppInit runs before the native HTTP middleware pipeline is resolved.
        \think\facade\Event::listen('HttpRun', static function () {
            if (!\CRA1\Theme\Context::memberActive()) return;
            if (class_exists(MemberGuard::class) && class_exists(OperationGuard::class)) {
                app()->bind('app\\http\\middleware\\CheckHome', MemberGuard::class);
                app()->bind('app\\http\\middleware\\CheckClientOperatePassword', OperationGuard::class);
            }
        });
        if (\CRA1\Theme\Context::memberActive()) Routes::register();
    }
}
