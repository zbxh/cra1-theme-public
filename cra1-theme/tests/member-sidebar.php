<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND', dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
require CRA1_THEME_BACKEND.'/Storage/member_store.php';
require CRA1_THEME_BACKEND.'/Storage/cart_store.php';
require CRA1_THEME_BACKEND.'/Storage/workspace_store.php';
use CRA1\Theme\Storage\MemberCenterStore;
use CRA1\Theme\Storage\ThemeWorkspaceStore;
$checks=[];
function check($ok, string $label): void { if (!$ok) throw new RuntimeException($label); $GLOBALS['checks'][]=$label; }
function node(int $id, string $name, string $url='', array $children=[]): array {
    return ['id'=>sprintf('00000000-0000-4000-8000-%012d',$id),'label'=>$name,'url'=>$url,'source_type'=>'custom','children'=>$children];
}
function row(int $id, int $parent, string $name, string $url, string $type='custom', int $nav=0): array {
    return ['menu_id'=>$id,'parent_menu_id'=>$parent,'label'=>$name,'url'=>$url,'source_type'=>$type,'source_nav_id'=>$nav,
        'language'=>[],'icon'=>'','second_reminder'=>0,'module'=>[],'res_module'=>[],'product_id'=>[],
        'show_quick_order'=>0,'quick_order_url'=>'','is_cross_module'=>0,'select_field'=>[],'order'=>$id];
}
function names(array $nodes): array { $out=[]; foreach ($nodes as $n) { $out[]=$n['label']; $out=array_merge($out,names($n['children']??[])); } return $out; }
$root=sys_get_temp_dir().'/cra1-sidebar-'.bin2hex(random_bytes(6));
mkdir($root.'/runtime/cra1_theme',0700,true);
$store=new MemberCenterStore($root.'/runtime');
try {
    check($store->read()['sidebar']['shape']===3,'new installs use three levels');
    $three=[node(1,'测试','',[node(2,'二级测试','',[node(3,'测试页面','home.htm')])])];
    $old=MemberCenterStore::defaults();$old['sidebar']['shape']=2;$old['sidebar']['nodes']=$three;
    $file=$root.'/runtime/cra1_theme/member_center.json';file_put_contents($file,json_encode($old));$before=hash_file('sha256',$file);
    check($store->read()['sidebar']['shape']===3,'omitted shape is recovered for an existing three-level tree');
    check($store->snapshotProjection($store->read())['nav_shape']===3,'public projection and editor agree on the three levels');
    check(hash_file('sha256',$file)===$before,'shape recovery never writes the main configuration');
    $products=$old;
    $products['sidebar']['nodes']=[node(1,'产品管理','',[node(2,'云服务器','productList.htm',[
        node(3,'全部产品','/productList.htm#top'), node(4,'全部产品','productList.htm?tab=using&m=legacy'), node(5,'当前产品','productList.htm'),
    ])])];
    $key=node(3,'')['id'];
    $products['content']['product_list']['overrides']=[$key=>['enabled'=>0,'title'=>'保留草稿','description'=>'','html'=>'']];
    file_put_contents($file,json_encode($products));$before=hash_file('sha256',$file);
    $stored=$store->read();$projected=$store->snapshotProjection($stored);
    $links=$projected['sidebar'][0]['children'][0]['children'];
    check($links[0]['id']===$key && $links[0]['url']==='/productList.htm?tab=all#top','legacy all-products leaf retains ID and now opens the all tab');
    check($links[1]['url']==='productList.htm?tab=using&m=legacy' && $links[2]['url']==='productList.htm','explicit tabs and other legacy entries are kept');
    check($stored['content']['product_list']['overrides'][$key]['title']==='保留草稿','disabled heading copy stays in admin storage');
    check($projected['content']['product_list']['overrides'][$key]===['enabled'=>0],'disabled heading copy is stripped from the public snapshot');
    check(hash_file('sha256',$file)===$before,'product links are corrected on read without rewriting the saved tree');
    $products['content']['product_list']['overrides'][$key]['purchase']=['enabled'=>1,'text'=>'立即购买','url'=>'/cart/goodsList.htm?product_id=10','target'=>'blank'];
    $stored=$store->normalizedPreview($products);
    $block=$store->snapshotProjection($stored)['content']['product_list']['overrides'][$key];
    check($block===['enabled'=>0,'purchase'=>['enabled'=>1,'text'=>'立即购买','url'=>'/cart/goodsList.htm?product_id=10','target'=>'blank']],
        'buying can be enabled without publishing disabled heading copy');
    foreach (['//example.org/cart','/\\example.org/cart',"java\nscript:alert(1)",'https:///example.org/cart','https://user@example.org/cart','mailto:test@example.org'] as $url) {
        $products['content']['product_list']['overrides'][$key]['purchase']['url']=$url;
        check($store->normalizedPreview($products)['content']['product_list']['overrides'][$key]['purchase']['url']==='',
            'unsafe or invalid purchase URL is discarded during normalization');
    }
    $products['content']['product_list']['overrides'][$key]['purchase']=['enabled'=>0,'text'=>'下次恢复','url'=>'https://example.org/cart'];
    $stored=$store->normalizedPreview($products);
    check($stored['content']['product_list']['overrides'][$key]['purchase']['url']==='https://example.org/cart' &&
        $store->snapshotProjection($stored)['content']['product_list']['overrides'][$key]['purchase']===['enabled'=>0],
        'explicitly disabling a button retains its settings and publishes only its disabled flag');
    check($store->validateTree([node(10,'空一级'),node(11,'另一级','',[node(12,'空二级')])],true)===[],'empty first and second groups can be saved');
    check(count($store->validateTree([node(1,'一级','',[node(2,'二级','',[node(3,'缺链接')])])],true))===1,'a third-level page still requires a link');
    check((bool)$store->validateTree([node(1,'一级','',[node(2,'二级','',[node(3,'三级','home.htm',[node(4,'四级','home.htm')])])])],true),'fourth level remains rejected');
    $legacy=$old;$legacy['sidebar']['nodes']=[node(10,'原分组','',[node(11,'原页面','account.htm')])];
    file_put_contents($file,json_encode($legacy));$before=hash_file('sha256',$file);
    $w=new ThemeWorkspaceStore($root,CRA1_THEME_BACKEND.'/Storage/workspace_schema.json');
    $a=$w->editorGet('member','sidebar')['data'];$b=$w->editorGet('member','sidebar')['data'];
    check($a['revision']===$b['revision']&&json_encode($a['values'])===json_encode($b['values']),'legacy editor projection has deterministic identities and revisions');
    $sidebar=$a['values']['main']['sidebar'];
    check($sidebar['pull_enabled']===1 && $store->snapshotProjection($store->read())['nav_pull_enabled']===1,
        'existing configurations default to the visible desktop menu pull');
    check($sidebar['shape']===3&&$sidebar['nodes'][1]['children'][0]['label']==='原分组'&&$sidebar['nodes'][1]['children'][0]['children'][0]['id']===node(11,'')['id'],'legacy conversion preserves original parents and page IDs');
    check(hash_file('sha256',$file)===$before,'opening the editor does not migrate or overwrite stored data');
    $saved=$w->editorSave('member','sidebar',$a['revisions'],['main'=>['sidebar'=>['nodes'=>$three]]],'fixture');
    check($saved['status']===200&&$store->read()['sidebar']['shape']===3,'editor saves the effective shape with nodes even if the patch omitted shape');
    check($store->read()['sidebar']['nodes'][0]['children'][0]['children'][0]['label']==='测试页面','saving preserves every level');
    $conflict=$w->editorSave('member','sidebar',$a['revisions'],['main'=>['sidebar'=>['nodes'=>[]]]],'fixture');
    check($conflict['status']===409&&count($store->read()['sidebar']['nodes'])===1,'stale drafts retain conflict protection');
    $editor=$w->editorGet('member','sidebar')['data'];
    $saved=$w->editorSave('member','sidebar',$editor['revisions'],['main'=>['sidebar'=>['pull_enabled'=>0]]],'fixture');
    check($saved['status']===200 && $store->read()['sidebar']['pull_enabled']===0
        && $store->snapshotProjection($store->read())['nav_pull_enabled']===0,
        'the desktop menu pull can be disabled and publishes the saved value');
    check($store->read()['sidebar']['nodes'][0]['children'][0]['children'][0]['label']==='测试页面',
        'changing the desktop pull leaves menu entries intact');
    $catalog=['error'=>'','menu'=>[row(1,0,'计算服务',''),row(2,1,'服务器','productList.htm','module'),row(3,0,'账户资料','account.htm','system',12)]];
    $catalog['menu'][1]['product_id']=[24,25];$catalog['menu'][1]['module']=['mf_cloud'];
    check($store->diff($catalog)['removed']===[],'manual groups are never reported as expired system sources');
    $first=$store->proposeImport($catalog,'replace',['shape'=>3,'nodes'=>$three,'recent'=>['title'=>'保留']]);
    $tree=$first['nodes'];
    check($first['shape']===3&&count($tree)===1&&$tree[0]['children'][0]['label']==='计算服务'&&$tree[0]['children'][0]['children'][0]['label']==='服务器','system parent/child map to theme second/third levels');
    check(!in_array('测试',names($tree),true),'replace removes the whole previous copy, not just a group with a hardcoded name');
    check($tree[0]['children'][0]['children'][0]['product_id']===[24,25]&&$tree[0]['children'][0]['children'][0]['module']===['mf_cloud'],'import retains product associations and module metadata');
    check($tree[0]['children'][1]['source_nav_id']===12,'import retains native navigation identity');
    $duplicates=$catalog;$duplicates['menu'][]=row(9,1,'账户入口副本','account.htm','system',12);
    $duplicateTree=$store->proposeImport($duplicates,'replace',['shape'=>3,'nodes'=>[]]);
    check($duplicateTree['nodes'][0]['children'][0]['children'][1]['source_nav_id']===12&&$duplicateTree['nodes'][0]['children'][1]['source_nav_id']===12,'intentional native page copies remain under their respective parents');
    check($store->proposeImport($duplicates,'merge',['shape'=>3,'nodes'=>$duplicateTree['nodes']])['added']===0,'intentional duplicate sources reimport idempotently');
    $saved=$store->save(['sidebar'=>['shape'=>3,'nodes'=>$tree]],'fixture');$tree=$store->read()['sidebar']['nodes'];
    check($store->read()['sidebar']['pull_enabled']===0,'menu-only updates preserve the desktop pull preference');
    $tree[0]['label']='商家已改分组';$tree[0]['children'][0]['label']='商家已改分类';
    $moved=$tree[0]['children'][0]['children'][0];$moved['label']='商家已改服务器';$moved['hidden']=1;$moved['url']='productList.htm?mine=1';
    $tree[0]['children'][0]['children']=[];
    $tree[]=node(20,'自定义分组','',[node(21,'自定义二级','',[$moved])]);
    $merged=$store->proposeImport($catalog,'merge',['shape'=>3,'nodes'=>$tree]);
    check($merged['added']===0,'reimport adds no duplicates after renaming and moving imported entries');
    check($merged['nodes'][1]['children'][0]['children'][0]===$moved,'append preserves custom parent, hidden state, URL and stable identity');
    $catalog['menu'][]=row(4,1,'新增页面','finance.htm');
    $next=$store->proposeImport($catalog,'merge',['shape'=>3,'nodes'=>$tree]);
    check($next['added']===1&&$next['nodes'][0]['children'][0]['children'][0]['label']==='新增页面','append places new pages under the existing renamed parent');
    check($next['nodes'][0]['label']==='商家已改分组'&&$next['nodes'][0]['children'][0]['label']==='商家已改分类','append keeps local labels and group order');
    $again=$store->proposeImport($catalog,'merge',['shape'=>3,'nodes'=>$next['nodes']]);
    check($again['added']===0,'a second append is idempotent');
    $bad=false;try{$store->proposeImport($catalog,'invalid',['shape'=>3,'nodes'=>$tree]);}catch(InvalidArgumentException $e){$bad=true;}check($bad,'unknown import modes fail without changing data');
    $bad=false;try{$store->proposeImport(['error'=>'源读取失败'],'replace',['shape'=>3,'nodes'=>$tree]);}catch(RuntimeException $e){$bad=true;}check($bad,'catalogue failures cannot erase the draft');
    $encoded=json_encode($store->snapshotProjection($store->read()));check(strpos($encoded,'import_key')===false,'internal import identities stay out of public snapshots');
    echo json_encode(['status'=>'passed','checks'=>count($checks),'scenarios'=>$checks,'production_writes'=>0],JSON_UNESCAPED_UNICODE),PHP_EOL;
} finally {
    $remove=function($p)use(&$remove){if(is_dir($p)){foreach(scandir($p)as$n)if($n!=='.'&&$n!=='..')$remove($p.'/'.$n);rmdir($p);}else unlink($p);};$remove($root);
}
