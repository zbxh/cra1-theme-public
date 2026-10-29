<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
define('CRA1_THEME_PREVIEW_DISPLAY_ONLY',true);
// Load the real rendering helpers without running V10's event callbacks.
function add_hook($event,$callback):void{}
require CRA1_THEME_BACKEND.'/bootstrap.php';
require CRA1_THEME_ROOT.'/public/web/cra1/controller/Cra1.php';
require CRA1_THEME_ROOT.'/public/web/cra1/controller/SeoRegistry.php';
require CRA1_THEME_ROOT.'/public/web/cra1/controller/PageModuleRegistry.php';
require CRA1_THEME_ROOT.'/public/web/cra1/controller/hooks.php';
require CRA1_THEME_BACKEND.'/Storage/member_store.php';
require CRA1_THEME_BACKEND.'/Storage/cart_store.php';
require CRA1_THEME_BACKEND.'/Storage/workspace_store.php';
use CRA1\Theme\Storage\ThemeWorkspaceStore;
$root=sys_get_temp_dir().'/cra1-editor-'.bin2hex(random_bytes(6));
mkdir($root.'/runtime/cra1_theme',0700,true);
$checks=[];
function check($value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
$remove=function($p)use(&$remove){if(is_dir($p)){foreach(scandir($p)as$n)if($n!=='.'&&$n!=='..')$remove($p.'/'.$n);rmdir($p);}else unlink($p);};
try{
 $file=$root.'/runtime/cra1_theme/config.json';
 $raw=['page_hero_rows_text'=>"404|原页首|原说明\n!404|隐藏页首|保留隐藏内容\ncloud|云页首|其他页面"];
 file_put_contents($file,json_encode($raw));
 $store=new ThemeWorkspaceStore($root,CRA1_THEME_BACKEND.'/Storage/workspace_schema.json');
 $before=$store->editorGet('website','page:404')['data'];
 $rows=explode("\n",$before['values']['content']['page_hero_rows_text']);
 check(strpos($rows[0],'404|')===0,'numeric 404 page identity is preserved in the visible editor row');
 check(strpos($rows[1],'!404|')===0,'hidden row keeps both hidden prefix and numeric page identity');
 $changed=str_replace('原页首','新页首',$before['values']['content']['page_hero_rows_text']);
 $saved=$store->editorSave('website','page:404',$before['revisions'],['content'=>['page_hero_rows_text'=>$changed]],'fixture');
 check($saved['status']===200,'editing the projected 404 row saves without a false page-ownership error');
 $after=$store->editorGet('website','page:404')['data'];
 check(strpos($after['values']['content']['page_hero_rows_text'],'404|新页首|')===0,'404 title survives a fresh editor read');
 check(strpos($after['values']['content']['page_hero_rows_text'],'!404|隐藏页首|保留隐藏内容')!==false,'saving visible text preserves hidden historical rows');
 $disk=json_decode(file_get_contents($file),true);
 check($disk['page_hero_rows_text']===$raw['page_hero_rows_text'],'page override leaves shared rows and other pages unchanged');
 $stale=$store->editorSave('website','page:404',$before['revisions'],['content'=>['page_hero_rows_text'=>$changed.'x']],'fixture');
 check($stale['status']===409,'numeric-page fix preserves stale-editor conflict protection');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0],JSON_UNESCAPED_UNICODE).PHP_EOL;
}finally{$remove($root);}
