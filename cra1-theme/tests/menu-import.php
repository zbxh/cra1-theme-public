<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
foreach(['member_store.php','cart_store.php','workspace_store.php']as$file)require CRA1_THEME_BACKEND.'/Storage/'.$file;
require CRA1_THEME_ROOT.'/public/web/cra1/controller/Cra1.php';
use CRA1\Theme\Storage\MemberCenterStore;
use CRA1\Theme\Storage\MenuTransfer;
use CRA1\Theme\Storage\ThemeWorkspaceStore;
$root=sys_get_temp_dir().'/cra1-menu-import-'.bin2hex(random_bytes(6));mkdir($root.'/runtime/cra1_theme',0700,true);
$checks=[];
function check($ok,string $name):void{if(!$ok)throw new RuntimeException($name);$GLOBALS['checks'][]=$name;}
function ids(array $nodes):array{$out=[];foreach($nodes as$n){$out[]=$n['id'];$out=array_merge($out,ids($n['children']??[]));}return $out;}
function item(string $id,string $label,string $icon='',array $children=[]):array{return ['id'=>$id,'label'=>$label,'icon'=>$icon,'children'=>$children,'url'=>$children?'':'account.htm','source_type'=>'custom'];}
try{
 $cfg=MemberCenterStore::defaults();$cfg['sidebar']['nodes']=[item('existing-root','原有菜单','old-private-icon')];
 $file=$root.'/runtime/cra1_theme/member_center.json';file_put_contents($file,json_encode($cfg));$before=hash_file('sha256',$file);
 $catalog=['error'=>'','menu'=>[],'navs'=>[],'plugins'=>[],'products'=>[],'preview_capabilities'=>[]];
 $transfer=new MenuTransfer($root,$catalog);$store=new MemberCenterStore($root.'/runtime');
 $cfg=$store->read();
 $tree=[item('import-root','导入分组','icon-a-6',[item('import-group','下级分组','icon-caiwuzhongxin',[item('import-page','账户页','icon-a-13')])])];
 $doc=['format'=>'cra1-menu','schema'=>1,'site_key'=>'different-site','bindings'=>['navs'=>[],'plugins'=>[]],'sidebar'=>['shape'=>3,'nodes'=>$tree]];
 $proposal=$transfer->proposal($doc,ids($tree),false,$cfg['sidebar'],'append');
 check(json_encode($proposal['sidebar']['nodes'][0])===json_encode($cfg['sidebar']['nodes'][0]),'appending never changes an existing unavailable merchant icon');
 check($proposal['sidebar']['nodes'][1]['icon']==='icon-a-6','native icon survives cross-site import');
 check($proposal['sidebar']['nodes'][1]['children'][0]['children'][0]['icon']==='icon-a-13','third-level native icon survives import');
 check(hash_file('sha256',$file)===$before,'import proposal does not write configuration');
 $workspace=new ThemeWorkspaceStore($root,CRA1_THEME_BACKEND.'/Storage/workspace_schema.json');$initial=$workspace->editorGet('member','sidebar')['data'];
 $save=$workspace->editorSave('member','sidebar',$initial['revisions'],['main'=>['sidebar'=>$proposal['sidebar']]],'fixture');
 check($save['status']===200&&count($store->read()['sidebar']['nodes'])===2,'imported nodes save through the real workspace validation');
 $render=$store->sidebarPreview($store->read()['sidebar']['nodes'],[]);
 check(!empty($render[1]['icon_resolved']['url']),'native icons are also resolved in the menu preview');
 $bad=$doc;$bad['sidebar']['nodes'][0]['children'][0]['icon']='local-library:not-installed';
 $adapted=$transfer->proposal($bad,ids($tree),false,$store->read()['sidebar'],'replace');
 check($adapted['sidebar']['nodes'][0]['children'][0]['icon']==='','nonportable imported icon falls back before save');
 check(count($adapted['warnings'])===1&&strpos($adapted['warnings'][0],'下级分组')!==false,'fallback names the affected menu in the import preview');
 $current=$workspace->editorGet('member','sidebar')['data'];
 check($workspace->editorSave('member','sidebar',$current['revisions'],['main'=>['sidebar'=>$adapted['sidebar']]],'fixture')['status']===200,'fallback proposal can be saved instead of failing at the final step');
 try{cra1_icons_validate_nodes($bad['sidebar']['nodes'],[]);throw new RuntimeException('invalid direct choice was accepted');}
 catch(InvalidArgumentException $e){check(strpos($e->getMessage(),'导入分组 / 下级分组')!==false,'direct invalid choice still fails with an exact menu path');}
 $unsafe=$doc;$unsafe['sidebar']['nodes'][0]['url']='javascript:alert(1)';
 try{$transfer->proposal($unsafe,ids($tree),false,$cfg['sidebar'],'replace');throw new RuntimeException('unsafe URL accepted');}
 catch(InvalidArgumentException $e){check(true,'icon fallback never bypasses unsafe menu URL validation');}
 $stale=$workspace->editorSave('member','sidebar',$initial['revisions'],['main'=>['sidebar'=>['nodes'=>[]]]],'fixture');
 check($stale['status']===409&&!empty($store->read()['sidebar']['nodes']),'conflicting import cannot erase saved menus');
 // Optional private customer input is read at test time, never copied to the fixture or output.
 $input=getenv('CRA1_TEST_MENU_FILE');
 if($input){
  $doc=json_decode((string)file_get_contents($input),true,512,JSON_THROW_ON_ERROR);
  $current=$workspace->editorGet('member','sidebar')['data'];
  $p=$transfer->proposal($doc,ids($doc['sidebar']['nodes']),false,$store->read()['sidebar'],'replace');
  $save=$workspace->editorSave('member','sidebar',$current['revisions'],['main'=>['sidebar'=>$p['sidebar']]],'fixture');
  check($save['status']===200&&count($store->read()['sidebar']['nodes'])===count($doc['sidebar']['nodes']),'private supplied menu completes import, save and reload');
 }
 echo json_encode(['status'=>'passed','checks'=>count($checks),'production_writes'=>0],JSON_UNESCAPED_UNICODE),PHP_EOL;
}finally{$remove=function($p)use(&$remove){if(is_dir($p)){foreach(scandir($p)as$n)if($n!=='.'&&$n!=='..')$remove($p.'/'.$n);rmdir($p);}else unlink($p);};$remove($root);}
