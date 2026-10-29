<?php
declare(strict_types=1);
// Use the installed, unmodified native cache contract in an isolated fixture.
$native = realpath($argv[1] ?? '');
if (!$native || !is_file($native.'/.cra1-native-fixture.json')) throw new RuntimeException('Isolated native fixture required');
require $native.'/vendor/autoload.php';
require dirname(__DIR__).'/backend/Presentation/TemplateCache.php';
$writer = new \CRA1\Theme\Presentation\TemplateCache();
$root = sys_get_temp_dir().'/cra1-template-cache-'.bin2hex(random_bytes(6));
mkdir($root, 0700);
$checks = 0;
function cacheCheck(bool $ok, string $label): void { if (!$ok) throw new RuntimeException($label); $GLOBALS['checks']++; }
function cacheValue(string $label, string $view): string { return '<?php /*a:1:{s:'.strlen($view).':"'.$view.'";i:1;}*/ return '.var_export($label, true).';'; }
try {
    $file = $root.'/compiled.php';
    $source = '/fixture/public/web/cra1/index.html';
    $writer->write($file, cacheValue('before', $source));
    $open = fopen($file, 'rb');
    $inode = fstat($open)['ino'];
    $writer->write($file, cacheValue('after', $source));
    cacheCheck((include $file) === 'after', 'new readers receive the complete new compilation');
    cacheCheck(strpos(stream_get_contents($open), "'before'") !== false, 'an existing reader retains its original file without truncation');
    fclose($open); clearstatcache(true, $file);
    cacheCheck(stat($file)['ino'] !== $inode, 'theme compilation is published by atomic replacement');
    $nativeFile = $root.'/native.php';
    $writer->write($nativeFile, cacheValue('native-before', '/fixture/public/web/default/index.html'));
    $open = fopen($nativeFile, 'rb'); $inode = fstat($open)['ino'];
    $writer->write($nativeFile, cacheValue('native-after', '/fixture/public/web/default/index.html'));
    clearstatcache(true, $nativeFile);
    cacheCheck(stat($nativeFile)['ino'] === $inode, 'other themes retain native storage behavior'); fclose($open);
    foreach (['clientarea/template/pc/cra1/header.php','cart/template/pc/cra1/goodsList.php','clientarea/template/mobile/cra1/header.php'] as $view) {
        $writer->write($file, cacheValue('complete', '/fixture/public/'.$view));
        cacheCheck((include $file) === 'complete', 'all CRA1 surfaces use the same cache contract');
    }
    cacheCheck(glob($root.'/.cra1-*.tmp') === [], 'successful writes do not leave temporary files');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
} finally {
    foreach (glob($root.'/*') as $file) unlink($file);
    rmdir($root);
}
