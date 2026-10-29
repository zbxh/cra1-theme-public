<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/Compatibility/MenuAccess.php';
use CRA1\Theme\Compatibility\MenuAccess;
$pages = [
    ['id'=>1,'url'=>'plugin/91/source.htm','module'=>'addon','plugin'=>'ExampleAddon'],
    ['id'=>2,'url'=>'/plugin/91/source.htm','module'=>'addon','plugin'=>'ExampleAddon'],
    ['id'=>3,'url'=>'plugin/92/source.htm','module'=>'addon','plugin'=>'DisabledAddon'],
    ['id'=>4,'url'=>'finance.htm?tab=orders','module'=>'','plugin'=>''],
    ['id'=>5,'url'=>'https://outside.invalid/page','module'=>'','plugin'=>''],
    ['id'=>6,'url'=>'','module'=>'','plugin'=>''],
];
$actual=MenuAccess::project($pages,[2,3,4],['addon:ExampleAddon'=>true]);
$expected=[['url'=>'/plugin/91/source.htm','allowed'=>true],['url'=>'/plugin/92/source.htm','allowed'=>false],['url'=>'/finance.htm?tab=orders','allowed'=>true]];
if ($actual!==$expected) throw new RuntimeException('Native page groups/plugin states were not preserved');
$denied=MenuAccess::project($pages,[],['addon:ExampleAddon'=>true]);
if (array_filter($denied,static function($p){return $p['allowed'];})) throw new RuntimeException('Empty child grants must not become unrestricted');
if (strpos(json_encode($actual),'ExampleAddon')!==false) throw new RuntimeException('Only page results may be exposed');
echo json_encode(['status'=>'passed','checks'=>3]).PHP_EOL;
