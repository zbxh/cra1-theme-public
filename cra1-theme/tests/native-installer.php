<?php
declare(strict_types=1);
/** Install and log in without changing native settings in a disposable V10 installation. */
if (PHP_SAPI !== 'cli') exit(1);
$root = realpath($argv[1] ?? '');
$source = realpath(dirname(__DIR__, 2));
$input = json_decode(stream_get_contents(STDIN), true);
if (!$root || $root === $source || strpos($root, $source.DIRECTORY_SEPARATOR) === 0
    || !is_file($root.'/.cra1-native-fixture.json') || ($input['fixture_write_test'] ?? false) !== true) {
    throw new RuntimeException('An explicitly acknowledged isolated native fixture is required');
}
$_SERVER = array_merge($_SERVER, ['HTTP_HOST'=>'127.0.0.1','SERVER_ADDR'=>'127.0.0.1',
    'SERVER_PORT'=>80,'REMOTE_ADDR'=>'127.0.0.1','SCRIPT_NAME'=>'/index.php']);
require $root.'/cra1-theme/backend/bootstrap.php';
$result = CRA1\Theme\Http\NativeAdmin::run($root, (string)($input['authorization'] ?? ''), static function () use ($root) {
    $checks = [];
    $check = static function ($value, string $label) use (&$checks): void {
        if (!$value) throw new RuntimeException($label);
        $checks[] = $label;
    };
    $runtime = $root.'/runtime/cra1_theme';
    $paths = ['install.json','entry.json','config.json','member_center.json','cart_theme.json','announcements.json','distribution/current.json'];
    $saved = [];
    foreach ($paths as $name) $saved[$name] = is_file($runtime.'/'.$name) ? file_get_contents($runtime.'/'.$name) : null;
    foreach (['runtime/cra1_theme/security.sqlite','config/cra1_theme_security.key','runtime/cra1_theme/attachments.sqlite'] as $path) {
        if (file_exists($root.'/'.$path)) throw new RuntimeException('Use a fresh isolated identity/media fixture');
    }
    $entry = 'cra1fixture'.bin2hex(random_bytes(4));
    $adminFrom = $root.'/public/cra1admin';
    $adminTo = $root.'/public/'.$entry;
    $model = new app\common\model\ConfigurationModel();
    $previous = $model->themeList();
    $configuration = static function (): array {
        $rows = app\common\model\ConfigurationModel::column('value','setting');
        ksort($rows);
        return $rows;
    };
    $originalSettings = $configuration();
    $references = CRA1\Theme\Files::json($root.'/cra1-theme/release.json')['references'] ?? [];
    $newReferences = [];
    foreach ($references as $path=>$target) {
        if (!file_exists($root.'/'.$path) && !is_link($root.'/'.$path)) $newReferences[$path] = $target;
    }
    // This seam tests the installation transaction only. Public candidate gates stay unchanged.
    $fixturePreflight = ['counts'=>['blocked'=>0,'unverified'=>0],'fixture_only'=>true];
    $password = 'Fixture-'.bin2hex(random_bytes(12)).'!';
    $setup = ['entry'=>$entry,'username'=>'fixture-installer','password'=>$password,'canonical'=>'https://fixture.invalid'];
    $security = null;
    try {
        if (is_file($runtime.'/install.json')) unlink($runtime.'/install.json');
        $installer = new CRA1\Theme\Release\Installer($root);
        $check($installer->state()['mode'] === 'install', 'fresh identity uses initialization mode');
        $reply = $installer->install($setup,$fixturePreflight);
        $check(!empty($reply['installed']) && $reply['password'] === $password, 'installation completes without calling the native theme writer');
        $check($reply['admin_url'] === '/'.$entry.'/index.php' && is_dir($adminTo) && !is_dir($adminFrom), 'renamed admin entry matches success response');
        $current = $model->themeList();
        foreach (['web_theme','clientarea_theme','clientarea_theme_mobile','cart_theme','cart_theme_mobile','home_theme','home_theme_mobile'] as $key) {
            $check(($current[$key] ?? '') === ($previous[$key] ?? ''), 'native theme selection preserved: '.$key);
        }
        $check(($current['home_host_theme'] ?? []) === ($previous['home_host_theme'] ?? [])
            && ($current['home_host_theme_mobile'] ?? []) === ($previous['home_host_theme_mobile'] ?? []), 'native module detail-theme maps preserved');
        $check($originalSettings === $configuration(), 'every native system setting remains unchanged');
        $check(!is_file($runtime.'/install-previous-themes.json'), 'no unused activation backup is created');
        $security = new CRA1ThemeSecurity($root);
        $check($security->checkPassword('fixture-installer',$password) !== null
            && $security->scalar('SELECT COUNT(*) FROM accounts WHERE enabled=1') == 1, 'new independent administrator authenticates');
        $check($security->scalar('PRAGMA quick_check') === 'ok' && is_file($runtime.'/attachments.sqlite'), 'identity and media self-checks pass');
        $rejected = false;
        $account=$security->checkPassword('fixture-installer',$password);
        $token=$security->startSession($account,'127.0.0.1','native-installer-fixture');
        $check($security->authenticate($token)!==null,'independent administrator can use a session before activating themes');
        $member=new CRA1\Theme\Storage\MemberCenterStore($root.'/runtime');$config=$member->read();
        $savedContent=$member->save(['appearance'=>['aside_mobile_expand'=>'all']],'fixture-installer',(int)$config['version']);
        $check((int)$savedContent['status']===200&&$member->read()['appearance']['aside_mobile_expand']==='all','theme content can be saved before activation');
        $check($originalSettings===$configuration(),'administrator login and editing leave native theme selections unchanged');
        try { $installer->install($setup,$fixturePreflight); }
        catch (RuntimeException $e) { $rejected = true; }
        $check($rejected && $installer->state()['mode'] === 'maintenance', 'revisit cannot replace the administrator or configuration');
        $leaked = false;
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($runtime,FilesystemIterator::SKIP_DOTS)) as $file) {
            if ($file->isFile() && strpos((string)file_get_contents($file->getPathname()),$password) !== false) $leaked = true;
        }
        $check(!$leaked, 'generated plaintext password is absent from persisted installation records');
        return ['status'=>200,'result'=>'passed','checks'=>count($checks),'results'=>$checks,
            'native_settings_unchanged'=>true,'fixture_preflight_only'=>true,'production_writes'=>0];
    } finally {
        unset($security);
        if (is_dir($adminTo) && !rename($adminTo,$adminFrom)) throw new RuntimeException('Fixture entry could not be restored');
        CRA1\Theme\Release\References::removeCreated($root,$newReferences);
        foreach (['security.sqlite','security.sqlite-wal','security.sqlite-shm','attachments.sqlite','attachments.sqlite-wal','attachments.sqlite-shm'] as $name) {
            if (is_file($runtime.'/'.$name)) unlink($runtime.'/'.$name);
        }
        if (is_file($root.'/config/cra1_theme_security.key')) unlink($root.'/config/cra1_theme_security.key');
        foreach ($saved as $name=>$bytes) {
            if ($bytes === null) { if (is_file($runtime.'/'.$name)) unlink($runtime.'/'.$name); }
            else CRA1\Theme\Files::atomic($runtime.'/'.$name,$bytes,0600);
        }
    }
});
echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES).PHP_EOL;
