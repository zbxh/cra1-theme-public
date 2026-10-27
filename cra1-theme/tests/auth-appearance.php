<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND', dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
require CRA1_THEME_BACKEND.'/Storage/member_store.php';
require CRA1_THEME_BACKEND.'/Storage/cart_store.php';
require CRA1_THEME_BACKEND.'/Storage/workspace_store.php';
use CRA1\Theme\Storage\AuthAppearance;
use CRA1\Theme\Storage\MemberCenterStore;
use CRA1\Theme\Storage\ThemeWorkspaceStore;
$checks=0;
function check($value,string $label):void {if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
$root=sys_get_temp_dir().'/cra1-auth-appearance-'.bin2hex(random_bytes(5));mkdir($root.'/runtime',0700,true);
$store=new MemberCenterStore($root.'/runtime');
try {
    check($store->read()['content']['auth_login']===AuthAppearance::defaults('login'),'legacy installation receives login defaults without a migration');
    check(!is_dir($root.'/runtime/cra1_theme'),'reading missing display configuration never writes a snapshot');
    foreach(['login','regist'] as $page) {
        $raw=AuthAppearance::defaults($page);$raw['title']='<b>定制标题</b>';$raw['description']='';$raw['brand']['title']='保留的介绍';
        $raw['brand']['enabled']=0;$raw['support']=['enabled'=>0,'label'=>'私有草稿','url'=>'/support'];$raw['login_phone_verify']=1;
        $normalized=AuthAppearance::normalize($raw,$page);$public=AuthAppearance::project($raw,$page);
        check($normalized['title']==='定制标题'&&$normalized['description']==='','plain title and intentional empty text: '.$page);
        check($normalized['brand']['title']==='保留的介绍'&&$normalized['support']['url']==='/support','disabled data stays editable: '.$page);
        check($public['brand']===['enabled'=>0]&&$public['support']===['enabled'=>0],'closed blocks do not disclose their copy: '.$page);
        check(!isset($normalized['login_phone_verify']),'appearance cannot set native authentication policy: '.$page);
        $raw['brand']['enabled']=1;$raw['brand']['items']=[['id'=>'auth-item-1','title'=>'保留','enabled'=>1],['id'=>'auth-item-1','title'=>'隐藏条目','enabled'=>0],['id'=>'bad','title'=>'第三项','enabled'=>1]];
        $normalized=AuthAppearance::normalize($raw,$page);$public=AuthAppearance::project($raw,$page);
        check(count(array_unique(array_column($normalized['brand']['items'],'id')))===3,'stable unique identities even for duplicate or malformed imports: '.$page);
        check(array_column($public['brand']['items'],'title')===['保留','第三项'],'visible list order matches the editor: '.$page);
        foreach(['javascript:alert(1)','data:text/html,x','//outside.invalid/a','https://name:secret@outside.invalid/a',"/a\nnext",'/a\\b']as$url){$raw['logo']=$url;$raw['support']['url']=$url;$result=AuthAppearance::normalize($raw,$page);check($result['logo']===''&&$result['support']['url']==='','unsafe URL excluded: '.$page);}
        foreach(['/upload/example.png','https://example.com/example.png']as$url){$raw['logo']=$url;check(AuthAppearance::normalize($raw,$page)['logo']===$url,'public image accepted: '.$page);}
        foreach(['/help.htm','mailto:support@example.com','tel:123456']as$url){$raw['support']['url']=$url;check(AuthAppearance::normalize($raw,$page)['support']['url']===$url,'support link accepted: '.$page);}
    }
    $workspace=new ThemeWorkspaceStore($root,CRA1_THEME_BACKEND.'/Storage/workspace_schema.json');
    $login=$workspace->get('member','member:login')['data'];$regist=$workspace->get('member','member:regist')['data'];
    check(array_keys($login['values']['content'])===['auth_login']&&array_keys($regist['values']['content'])===['auth_regist'],'each page owns only its corresponding content');
    $change=$login['values'];$change['content']['auth_login']['title']='独立登录页';
    $r=$workspace->save('member','member:login',$login['revision'],$change,'fixture');check($r['status']===200,'scoped login save');
    $next=$regist['values'];$next['content']['auth_regist']['title']='独立注册页';
    $r=$workspace->save('member','member:regist',$regist['revision'],$next,'fixture');check($r['status']===200,'unrelated page save does not conflict');
    $persisted=$store->read();check($persisted['content']['auth_login']['title']==='独立登录页'&&$persisted['content']['auth_regist']['title']==='独立注册页','both pages persist independently');
    $file=$root.'/runtime/cra1_theme/member_center.json';$hash=hash_file('sha256',$file);
    $stale=$workspace->save('member','member:login',$login['revision'],$change,'fixture');check($stale['status']===409&&hash_file('sha256',$file)===$hash,'conflict never overwrites saved data');
    $current=$workspace->get('member','member:login')['data'];$invalid=$current['values'];$invalid['content']['auth_login']['title']='不得部分落盘';$invalid['content']['auth_login']['brand']['login_email_password']=0;
    $rejected=false;try{$r=$workspace->save('member','member:login',$current['revision'],$invalid,'fixture');$rejected=$r['status']!==200;}catch(InvalidArgumentException $e){$rejected=true;}
    check($rejected&&hash_file('sha256',$file)===$hash,'unknown field rejects the entire page transaction');
    $legacy=$persisted['content'];unset($legacy['auth_login'],$legacy['auth_regist']);$r=$store->save(['content'=>$legacy],'older-editor');check($r['status']===200&&$store->read()['content']['auth_login']['title']==='独立登录页','older content editors cannot reset newly saved auth pages');
    $public=$store->snapshotProjection($store->read());check(!isset($public['content']['auth_login'])&&!isset($public['content']['auth_regist']),'global snapshots do not export page-specific authentication copy');
    file_put_contents($file,'{broken');$bad=hash_file('sha256',$file);$failed=false;
    try{$store->read();}catch(Throwable $e){$failed=true;}
    check($failed&&hash_file('sha256',$file)===$bad,'damaged configuration remains untouched');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]),PHP_EOL;
} finally {
    $remove=function($path)use(&$remove){if(is_dir($path)){foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')$remove($path.'/'.$name);rmdir($path);}else unlink($path);};$remove($root);
}
