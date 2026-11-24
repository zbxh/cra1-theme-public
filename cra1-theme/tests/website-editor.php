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
require CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php';
use CRA1\Theme\Storage\ThemeWorkspaceStore;
$root=sys_get_temp_dir().'/cra1-editor-'.bin2hex(random_bytes(6));
mkdir($root.'/runtime/cra1_theme',0700,true);
$checks=[];
function check($value,string $label):void{if(!$value)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
function theme_actor():array{return ['id'=>1];}
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
 $GLOBALS['THEME_ORIGIN']='https://public.example.test:8443';
 $_SESSION=['security_token'=>'fixture-current-session'];$_SERVER['HTTP_HOST']='origin.internal';
 $bytes=file_get_contents($file);$preview=$store->preview('website','page:404',[]);
 parse_str((string)parse_url($preview['data']['url'],PHP_URL_QUERY),$query);
 $doc=json_decode(file_get_contents($root.'/runtime/cra1_theme/previews/'.$query['__theme_preview'].'.json'),true);
 check($doc['origin']===$GLOBALS['THEME_ORIGIN'],'draft preview retains the public authenticated origin rather than a proxy internal Host');
 check($doc['owner_id']===1&&hash_equals($doc['session_hash'],CRA1ThemeSecurity::hashToken($_SESSION['security_token'])),'public origin preservation keeps preview ownership and session binding');
 check(file_get_contents($file)===$bytes,'draft preview does not save live page settings');
 $reading=$store->editorGet('website','reading')['data'];
 check($reading['values']['site-reading']['article_toc_position']==='right','article directory defaults to the right on an existing site');
 $saved=$store->editorSave('website','reading',$reading['revisions'],['site-reading'=>['article_toc_position'=>'left']],'fixture');
 check($saved['status']===200,'article directory side can be changed in the website editor');
 $reading=$store->editorGet('website','reading')['data'];
 $disk=json_decode(file_get_contents($file),true);
 check($reading['values']['site-reading']['article_toc_position']==='left'&&$disk['article_toc_position']==='left','a fresh editor read returns the saved article directory side');
 check($disk['page_hero_rows_text']===$raw['page_hero_rows_text'],'article directory settings preserve other website content');
 $extra='<h3>相关资源</h3><p><a href="/document.html">打开文档</a></p><img src="/sample.png" alt="示例">';
 check($reading['values']['site-reading']['article_sidebar_enabled']==='0','desktop article sidebar module is disabled on existing sites');
 $saved=$store->editorSave('website','reading',$reading['revisions'],['site-reading'=>['article_sidebar_enabled'=>'1','article_sidebar_html'=>$extra]],'fixture');
 check($saved['status']===200,'desktop article sidebar options save together');
 $reading=$store->editorGet('website','reading')['data'];
 $config=$reading['values']['site-reading'];
 $html=cra1_article_sidebar_content($config);
 check(strpos($html,'<h3>相关资源</h3>')!==false&&strpos($html,'href="/document.html"')!==false&&strpos($html,'src="/sample.png"')!==false,'supported title, link and image render as HTML');
 $saved=$store->editorSave('website','reading',$reading['revisions'],['site-reading'=>['article_sidebar_enabled'=>'0']],'fixture');
 $config=$store->editorGet('website','reading')['data']['values']['site-reading'];
 check($saved['status']===200&&$config['article_sidebar_html']===$extra&&cra1_article_sidebar_content($config)==='','disabling hides the module and retains the saved HTML');
 check(cra1_article_sidebar_content(['article_sidebar_enabled'=>'1','article_sidebar_html'=>'<p>&nbsp;<br></p>'])==='','blank markup does not create an empty module');
 $unsafe=cra1_article_sidebar_content(['article_sidebar_enabled'=>'1','article_sidebar_html'=>'<a href="/document.html"><span class="custom">打开</span></a>']);
 check(strpos($unsafe,'<span>打开</span>')!==false,'sidebar HTML applies the same attribute rules within links');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0],JSON_UNESCAPED_UNICODE).PHP_EOL;
}finally{$remove($root);}
