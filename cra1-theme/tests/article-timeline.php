<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
require CRA1_THEME_BACKEND.'/Storage/member_store.php';
$checks=0;
function check($value,string $label):void {if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
$dir=sys_get_temp_dir().'/cra1-article-timeline-'.bin2hex(random_bytes(5));mkdir($dir,0700);
$store=new \CRA1\Theme\Storage\MemberCenterStore($dir);
$base=\CRA1\Theme\Storage\MemberCenterStore::defaults();
try {
    $legacy=$base;$legacy['content']['home_news']=['enabled'=>1,'type_id'=>7,'limit'=>8];
    $old=$store->normalizedPreview($legacy)['content']['home_news'];
    check($old['source']==='news'&&$old['title']==='公告'&&$old['type_id']===7&&$old['limit']===8,'legacy timeline remains unchanged');
    foreach(['news'=>'IdcsmartNews','announcement'=>'IdcsmartAnnouncement','help'=>'IdcsmartHelp']as$source=>$plugin){
        $data=$base;$data['content']['home_news']=['enabled'=>1,'title'=>'<b>帮助指南</b>','description'=>'','source'=>$source,'type_id'=>3,'limit'=>10];
        $data=$store->normalizedPreview($data);$value=$data['content']['home_news'];
        check($value['title']==='帮助指南'&&$value['description']===''&&$value['source']===$source&&$value['type_id']===3,'source and sanitized copy: '.$source);
        $projected=CRA1ThemePublicProjection::member(['content'=>$data['content']],['plugins'=>[$plugin=>4]]);
        check($projected['content']['home_news']===$value,'only the selected plugin is required: '.$source);
        $off=CRA1ThemePublicProjection::member(['content'=>$data['content']],['plugins'=>[]]);
        check($off['content']['home_news']===['enabled'=>0],'unavailable source is hidden: '.$source);
        $result=$store->save(['content'=>$data['content']],'isolated-fixture');
        check($result['status']===200&&$store->read()['content']['home_news']===$value,'save and reread: '.$source);
    }
    $data=$base;$data['content']['home_news']=['source'=>'unregistered','type_id'=>-2,'limit'=>500,'title'=>str_repeat('长',80)];
    $value=$store->normalizedPreview($data)['content']['home_news'];
    check($value['source']==='news'&&$value['type_id']===0&&$value['limit']===10&&mb_strlen($value['title'])===40,'untrusted source, category and limits normalized');
    foreach(['IdcsmartNews'=>'news','IdcsmartAnnouncement'=>'announcement','IdcsmartHelp'=>'help']as$plugin=>$source){
        $runtime=CRA1ThemeRuntime::project([],[['id'=>7,'name'=>$plugin,'status'=>1]],'home');
        check($runtime['features'][$source]===true&&$runtime['links'][$source]==='/plugin/7/source.htm','real plugin-derived runtime links: '.$source);
    }
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]),PHP_EOL;
} finally {
    $remove=function($path)use(&$remove){if(is_dir($path)){foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')$remove($path.'/'.$name);rmdir($path);}else unlink($path);};$remove($dir);
}
