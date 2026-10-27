<?php
declare(strict_types=1);
/** An installed site must preview without initializing the native HTTP app. */
$root=dirname(__DIR__,2);
define('CRA1_THEME_ROOT',$root);
if(!defined('CRA1_THEME_BACKEND'))define('CRA1_THEME_BACKEND',$root.'/cra1-theme/backend');
define('CRA1_THEME_PREVIEW_DISPLAY_ONLY',true);
class PreviewUnavailableNativeEvent {
    public static int $calls=0;
    public static function listen($event,$listener): void {self::$calls++;throw new RuntimeException('Native HTTP container must not be used in a draft preview');}
}
class_alias(PreviewUnavailableNativeEvent::class,'think\\facade\\Event');
$registered=[];
function add_hook($name,$callback): void {$GLOBALS['registered'][]=$name;}
function runtime_path(): string {return CRA1_THEME_ROOT.'/runtime/';}
$GLOBALS['THEME_VERIFIED_PREVIEW']=['domain'=>'website','config'=>['cap1_title'=>'未保存的预览文案'],'expires'=>time()+900];
require $root.'/public/web/cra1/controller/Cra1.php';
require $root.'/public/web/cra1/controller/hooks.php';
$checks=0;
foreach([
    [PreviewUnavailableNativeEvent::$calls===0,'Native HTTP event service is not used'],
    [count($registered)===0,'No business or presentation hooks are registered'],
    [function_exists('cra1_theme_config'),'Display configuration resolver is available'],
    [function_exists('cra1_render_page_modules'),'Real page module renderer is available'],
    [function_exists('cra1_page_hero_resolve'),'Real hero resolver is available'],
]as[$ok,$label]){if(!$ok)throw new RuntimeException($label);$checks++;}
$config=cra1_theme_config();
if(($config['cap1_title']??'')!=='未保存的预览文案')throw new RuntimeException('The preview uses the unsaved configuration, not site storage');
$checks++;
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
