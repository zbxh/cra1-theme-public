<?php
/** CRA1 private backend. A shared file lock protects requests from concurrent removal; configuration is never changed here. */
declare(strict_types=1);
if (!defined('CRA1_THEME_ROOT')) define('CRA1_THEME_ROOT', dirname(__DIR__, 2));
if (!defined('CRA1_THEME_BACKEND')) {
    $selected = __DIR__;
    $pointer = CRA1_THEME_ROOT.'/runtime/cra1_theme/distribution/current.json';
    $releaseFile = CRA1_THEME_ROOT.'/cra1-theme/release.json';
    $rootBoundary=rtrim(CRA1_THEME_ROOT,'/');
    if(realpath($rootBoundary)!==$rootBoundary)throw new \RuntimeException('主题根目录归属异常');
    $noLinks=static function(string $path)use($rootBoundary):void{
        if(strpos($path,$rootBoundary.'/')!==0)throw new \RuntimeException('主题路径超出本站目录');
        for($p=$path;;$p=dirname($p)){
            if(is_link($p))throw new \RuntimeException('主题目录归属异常');
            if($p===$rootBoundary)break;
        }
    };
    $read = static function (string $file)use($noLinks): array {
        $noLinks($file);
        if (!is_file($file)) return [];
        if (is_link($file)) throw new \RuntimeException('主题发行清单归属异常');
        if (!is_readable($file)) throw new \RuntimeException('主题发行记录无法读取，请在网站面板检查主题文件及目录的读取权限');
        $doc = json_decode((string)file_get_contents($file),true);
        if (!is_array($doc) || json_last_error()!==JSON_ERROR_NONE) throw new \RuntimeException('主题发行清单损坏，原文件保留');
        return $doc;
    };
    // A lock outside the theme data directory survives complete removal. Never
    // follow symlinks, and fail promptly while files are being moved.
    $lifecycleLock=$rootBoundary.'/runtime/cra1-theme-lifecycle.lock';
    $noLinks($lifecycleLock);
    if(is_dir($rootBoundary.'/runtime/cra1_theme')){
        $oldMask=umask(0077);
        try{$handle=@fopen($lifecycleLock,'c+b');}finally{umask($oldMask);}
        if(!$handle)throw new \RuntimeException('主题操作锁无法打开：runtime/cra1-theme-lifecycle.lock。请在网站面板检查此文件及 runtime/ 目录是否允许 PHP 运行账号读写，并检查磁盘空间');
        if(!flock($handle,LOCK_SH|LOCK_NB))throw new \RuntimeException('主题正在停用、启用或卸载，请稍后刷新页面');
        $GLOBALS['CRA1_THEME_LIFECYCLE_LOCK']=$handle;
        $noLinks($rootBoundary.'/runtime/cra1-theme-uninstall/pending.json');
        if(is_file($rootBoundary.'/runtime/cra1-theme-uninstall/pending.json'))throw new \RuntimeException('主题卸载尚未完成，请由服务器管理员运行私有卸载备份中的 recover.php 恢复');
    }
    unset($lifecycleLock,$oldMask,$handle);
    // The fixed maintenance entry must be able to finish an extracted update
    // while normal requests continue to use the last committed release.
    $installer = defined('CRA1_THEME_INSTALLER_CANDIDATE') && CRA1_THEME_INSTALLER_CANDIDATE === true;
    $current = $installer ? [] : $read($pointer);
    $manifest = isset($current['manifest']) && is_array($current['manifest']) ? $current['manifest'] : $read($releaseFile);
    $backend = $current['backend_root'] ?? $manifest['backend_root'] ?? '';
    if ($installer && $backend !== '' && $backend !== 'cra1-theme/backend/releases/'.($manifest['release']??'')) throw new \RuntimeException('主题安装文件版本不一致，请完整解压同一份安装包');
    if ($backend !== '') {
        if (!is_string($backend) || !preg_match('~^cra1-theme/backend/releases/[a-z0-9][a-z0-9-]{3,80}$~D',$backend)) throw new \RuntimeException('主题后端版本路径无效');
        $selected = CRA1_THEME_ROOT.'/'.$backend;
        $noLinks($selected);
        if (!is_file($selected.'/Release/Updater.php') || !is_file($selected.'/Security/OperationVerification.php')) throw new \RuntimeException('主题后端版本不完整，请恢复上次安装');
    }
    define('CRA1_THEME_BACKEND', $selected);
    unset($selected,$pointer,$releaseFile,$read,$current,$manifest,$backend,$rootBoundary,$noLinks,$installer);
}
spl_autoload_register(static function (string $class): void {
    $prefix = 'CRA1\\Theme\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) return;
    $relative = substr($class, strlen($prefix));
    if (!preg_match('/^[A-Za-z0-9_\\\\]+$/D', $relative)) return;
    $file = CRA1_THEME_BACKEND.'/'.str_replace('\\', '/', $relative).'.php';
    if (is_file($file)) require_once $file;
});
