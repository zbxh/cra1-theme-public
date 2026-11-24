<?php
declare(strict_types=1);
use CRA1\Theme\Compatibility\ModulePresentation;

foreach (['Failure', 'Files', 'Compatibility/ModulePresentation'] as $name) require __DIR__.'/../backend/'.$name.'.php';
$root = sys_get_temp_dir().'/cra1-module-presentation-'.bin2hex(random_bytes(6));
$settings = new ModulePresentation($root);
$catalogue = [
    'modules'=>[['name'=>'direct_admin','label'=>'DirectAdmin'], ['name'=>'mf_cloud','label'=>'魔方云'], ['name'=>'mf_cloud_ip','label'=>'魔方云 IP']],
    'res_modules'=>[['name'=>'direct_admin','label'=>'DirectAdmin 代理'], ['name'=>'idcsmart_common','label'=>'通用产品']],
];
$file = $root.'/runtime/cra1_theme/module-presentation.json';
function verify($condition): void { if (!$condition) throw new RuntimeException('Module presentation assertion failed'); }
$key = 'server:direct_admin';
$defaults = ['cart'=>'cra1','panel'=>'cra1'];
try {
    $rows = array_column($settings->listing($catalogue)['modules'], null, 'key');
    verify(array_keys($rows) === [$key, 'server:mf_cloud_ip', 'reserver:direct_admin']);
    verify($rows[$key]['cart'] === 'cra1' && $rows[$key]['panel'] === 'cra1' && !is_file($file));
    $settings->save($catalogue, ['key'=>$key, 'previous'=>$defaults,'cart'=>'official','panel'=>'cra1']);
    verify($settings->mode($key, 'cart') === 'official' && $settings->mode($key, 'panel') === 'cra1');
    verify($settings->mode('reserver:direct_admin', 'cart') === 'cra1');
    try {
        $settings->save($catalogue, ['key'=>$key, 'previous'=>$defaults,'cart'=>'cra1','panel'=>'official']);
        throw new RuntimeException('Stale update accepted');
    } catch (InvalidArgumentException $expected) {
        verify($settings->mode($key, 'cart') === 'official');
    }
    $settings->save($catalogue, ['key'=>$key,'previous'=>['cart'=>'official','panel'=>'cra1'],'cart'=>'cra1','panel'=>'official']);
    verify($settings->mode($key, 'cart') === 'cra1' && $settings->mode($key, 'panel') === 'official');
    $settings->save($catalogue, ['key'=>$key,'previous'=>['cart'=>'cra1','panel'=>'official']]+$defaults);
    verify(json_decode(file_get_contents($file), true)['modules'] === []);
    echo "Module presentation settings passed\n";
} finally {
    foreach ([$file, $file.'.lock'] as $entry) if (is_file($entry)) unlink($entry);
    foreach (['/runtime/cra1_theme','/runtime',''] as $dir) if (is_dir($root.$dir)) rmdir($root.$dir);
}
