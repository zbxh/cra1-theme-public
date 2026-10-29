<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
foreach(['member_store.php','cart_store.php','workspace_store.php']as$p)require CRA1_THEME_BACKEND.'/Storage/'.$p;
require dirname(__DIR__,2).'/public/web/cra1/controller/Cra1.php';
use CRA1\Theme\Files;
use CRA1\Theme\Storage\MenuTransfer;
use CRA1\Theme\Storage\ConfigurationTransfer;
use CRA1\Theme\Storage\MemberCenterStore;
use CRA1\Theme\Storage\CartThemeStore;
use CRA1\Theme\Storage\AnnouncementStore;
$base=sys_get_temp_dir().'/cra1-config-test-'.bin2hex(random_bytes(6));mkdir($base,0700);$checks=[];
function check($ok,string $label): void {if(!$ok)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
function rejects(callable $fn,string $label): void {try{$fn();}catch(Throwable $e){check($e instanceof InvalidArgumentException||$e instanceof RuntimeException,$label.' has a handled error');return;}throw new RuntimeException($label);}
function clean(string $p):void{if(is_file($p)||is_link($p)){unlink($p);return;}foreach(scandir($p)as$n)if($n!=='.'&&$n!=='..')clean($p.'/'.$n);rmdir($p);}
function ids(array $nodes):array{$r=[];foreach($nodes as$n){$r[]=$n['id'];$r=array_merge($r,ids($n['children']??[]));}return $r;}
function files(string $root):array{$out=[];foreach(['config','member_center','cart_theme','announcements','member_center_public','cart_theme_public']as$n){$f=$root.'/runtime/cra1_theme/'.$n.'.json';$out[$n]=is_file($f)?file_get_contents($f):null;}return $out;}
function fixture(string $root):void{mkdir($root.'/runtime/cra1_theme',0700,true);Files::putJson($root.'/runtime/cra1_theme/config.json',['cap1_title'=>'Target','page_content_overrides_json'=>'{"schema":1,"pages":{}}']);Files::putJson($root.'/runtime/cra1_theme/member_center.json',MemberCenterStore::defaults());Files::putJson($root.'/runtime/cra1_theme/cart_theme.json',CartThemeStore::defaults());Files::putJson($root.'/runtime/cra1_theme/announcements.json',['schema'=>1,'version'=>1,'values'=>AnnouncementStore::defaults()]);Files::atomic($root.'/config/cra1_theme_security.key',random_bytes(32));Files::atomic($root.'/runtime/cra1_theme/entry.json','{"entry":"privateadmin"}');Files::atomic($root.'/runtime/cra1_theme/security.sqlite','private-account-data');}
try{
 $a=$base.'/source';$b=$base.'/target';fixture($a);fixture($b);
 $catalog=['error'=>'','menu'=>[['label'=>'魔方云(自定义配置)','source_type'=>'module','module'=>['mf_cloud'],'product_id'=>[772]]],'navs'=>[['id'=>901,'url'=>'finance.htm','module'=>'','plugin'=>''],['id'=>902,'url'=>'plugin/345/source.htm','module'=>'','plugin'=>'IdcsmartNews']], 'plugins'=>['IdcsmartNews'=>['enabled'=>true]],'products'=>[['id'=>999,'module'=>'mf_cloud','res_module'=>'']]];
 $menu=new MenuTransfer($a,$catalog);$seed=$menu->defaults();
 check(array_column($seed['nodes'],'label')===['产品管理','财务中心','账户中心','服务与支持'],'installation seed includes exactly the four approved first-level groups');
 check($seed['nodes'][0]['children'][2]['product_id']===[772]&&$seed['nodes'][0]['children'][2]['hidden']===0,'default example inherits the actual navigation product association');
 check($seed['nodes'][0]['children'][1]['hidden']===1,'unavailable default module example is hidden');
 check($seed['nodes'][3]['children'][1]['url']==='plugin/345/source.htm','default plugin alias remaps to the target plugin identifier');
 check($seed['nodes'][2]['children'][2]['hidden']===1,'missing default plugin is hidden');
 $seed['recent']=MemberCenterStore::defaults()['sidebar']['recent'];$selected=$seed['nodes'][1]['children'][0]['children'][1]['id'];
 $doc=$menu->export($seed,[$selected],true);
 check(count($doc['sidebar']['nodes'])===1&&count($doc['sidebar']['nodes'][0]['children'][0]['children'])===1,'selecting one leaf keeps its ancestors and excludes siblings');
 check($doc['sidebar']['nodes'][0]['children'][0]['children'][0]['label']==='余额记录','selected leaf retains its original content');
 check($doc['sidebar']['recent']===$seed['recent'],'recent access settings are independently exportable');
 check(count($doc['bindings']['navs'])===1&&$doc['bindings']['plugins']===[],'unselected menu source metadata is excluded');
 $none=$menu->export($seed,[],true);check($none['sidebar']['nodes']===[],'recent-only export does not include menu entries');
 rejects(fn()=>$menu->export($seed,[],false),'empty export rejected');
 rejects(fn()=>MenuTransfer::select($seed['nodes'],[[]]),'malformed selection rejected');
 $copy=$menu->proposal($doc,ids($doc['sidebar']['nodes']),false,$seed,'append');
 check(count($copy['sidebar']['nodes'])===5&&count(ids($copy['sidebar']['nodes']))===count(array_unique(ids($copy['sidebar']['nodes']))),'append preserves existing menu and generates distinct copied identities');
 $replaced=$menu->proposal($doc,[$selected],false,$seed,'replace');check(count($replaced['sidebar']['nodes'])===1&&$replaced['sidebar']['recent']===$seed['recent'],'replace affects selected tree and leaves unselected recent settings intact');
 $bad=$doc;$bad['sidebar']['nodes'][0]['unexpected']='x';rejects(fn()=>$menu->validate($bad),'unknown menu fields rejected');
 $bad=$doc;$bad['sidebar']['nodes'][0]['url']='javascript:alert(1)';rejects(fn()=>$menu->validate($bad),'unsafe menu URL rejected');
 $bad=$doc;$bad['bindings']['plugins']=['x'=>[]];rejects(fn()=>$menu->validate($bad),'malformed bindings rejected');
 $bad=$doc;$bad['sidebar']['recent']['enabled']=[];rejects(fn()=>$menu->validate($bad),'malformed recent settings rejected');
 $bad=$doc;$leaf=&$bad['sidebar']['nodes'][0]['children'][0]['children'][0];$leaf['children']=[array_replace($leaf,['id'=>'fourth-level-node','children'=>[]])];rejects(fn()=>$menu->validate($bad),'fourth level rejected');unset($leaf);
 $product=$seed;$product['nodes'][0]['children'][2]['product_id']=[772];$productDoc=$menu->export($product,ids($product['nodes']),false);
 $same=$menu->proposal($productDoc,ids($productDoc['sidebar']['nodes']),false,['nodes'=>[],'shape'=>3],'replace');check($same['sidebar']['nodes'][0]['children'][2]['product_id']===[772],'same-site export preserves exact product associations');
 $other=new MenuTransfer($b,$catalog);$cross=$other->proposal($productDoc,ids($productDoc['sidebar']['nodes']),false,['nodes'=>[],'shape'=>3],'replace');check($cross['sidebar']['nodes'][0]['children'][2]['product_id']===[]&&$cross['sidebar']['nodes'][0]['children'][2]['hidden']===1,'cross-site import never treats source product ids as target ids');

 $warnings=[];$links=$other->remapLinks(['url'=>'plugin/123/source.htm','custom_js'=>'plugin/123/source.htm'],['plugins'=>[123=>'IdcsmartNews']],false,$warnings);check($links['url']==='plugin/345/source.htm'&&$links['custom_js']==='plugin/123/source.htm','structured plugin links remap without changing custom code');
 $warnings=[];$links=$other->remapLinks(['menu_text'=>'新闻|/plugin/123/source.htm|简介','html'=>'<a href="/plugin/123/source.htm">新闻</a>','external'=>'https://outside.example/plugin/123/source.htm'],['plugins'=>[123=>'IdcsmartNews']],false,$warnings);check($links['menu_text']==='新闻|/plugin/345/source.htm|简介'&&$links['html']==='<a href="/plugin/345/source.htm">新闻</a>'&&$links['external']==='https://outside.example/plugin/123/source.htm','website row links and rich text remap while external URLs retain their explicit destination');
 $warnings=[];$links=$other->remapLinks(['url'=>'plugin/777/missing.htm'],['plugins'=>[777=>'MissingPlugin']],false,$warnings);check($links['url']==='#'&&count($warnings)===1,'unavailable structured plugin links never point at an unrelated target plugin');
 $settings=(new MemberCenterStore($a.'/runtime'))->read();$settings['sidebar']=$seed;$settings['custom_code']=['css'=>'.sample{}','js'=>'window.transferSample=true;','css_enabled'=>false,'js_enabled'=>false];$settings['content']['home_quick_links']['enabled']=false;Files::putJson($a.'/runtime/cra1_theme/member_center.json',$settings);
 Files::putJson($a.'/runtime/cra1_theme/config.json',['cap1_title'=>'Source','page_module_visibility_json'=>'{"schema":1,"defaults":{},"pages":{}}','page_content_overrides_json'=>'{"schema":1,"pages":{"home":{"banner_title":"Custom"}}}','custom_js'=>'window.websiteSample=true;','custom_js_enabled'=>'0','cap1_link'=>'/upload/cra1-theme/demo.png']);
 $t=new ConfigurationTransfer($a,null,$catalog);$full=$t->export('https://source.example');
 check(array_keys($full['settings'])===['website','member','cart','notifications'],'full export contains all four configuration domains');
 check($full['settings']['website']['cap1_link']==='https://source.example/upload/cra1-theme/demo.png','uploaded media references remain usable through the source origin');
 check(strpos(json_encode($full),'privateadmin')===false&&strpos(json_encode($full),'private-account-data')===false&&!isset($full['settings']['member']['updated_by']),'export excludes administrator identities, accounts and secrets');
 check($full['settings']['member']['custom_code']['js_enabled']===false&&$full['settings']['member']['custom_code']['js']==='window.transferSample=true;','disabled code is retained privately in export');
 $target=new ConfigurationTransfer($b,null,$catalog);$before=files($b);$key=hash_file('sha256',$b.'/config/cra1_theme_security.key');$account=hash_file('sha256',$b.'/runtime/cra1_theme/security.sqlite');
 $p=$target->prepare(ConfigurationTransfer::decode(json_encode($full)),7,'session-one','owner');check(files($b)===$before,'preview does not change theme configurations');
 rejects(fn()=>$target->apply($p['candidate'],8,'session-one','owner'),'candidate bound to account');
 rejects(fn()=>$target->apply($p['candidate'],7,'session-two','owner'),'candidate bound to login session');
 $applied=$target->apply($p['candidate'],7,'session-one','owner');check($applied['status']===200,'full import succeeds');
 $after=files($b);check(json_decode($after['config'],true)['cap1_title']==='Source'&&json_decode($after['member_center'],true)['custom_code']['js']==='window.transferSample=true;','full import restores website and member settings');
 check(is_file($b.'/runtime/cra1_theme/transfers/backups/'.$applied['data']['backup'].'.json'),'automatic backup retained before import');
 check(hash_file('sha256',$b.'/config/cra1_theme_security.key')===$key&&hash_file('sha256',$b.'/runtime/cra1_theme/security.sqlite')===$account,'full import preserves the target accounts and cryptographic key');
 check(is_file($b.'/runtime/cra1_theme/member_center_public.json')&&is_file($b.'/runtime/cra1_theme/cart_theme_public.json'),'public snapshots regenerated through existing filtered projections');
 rejects(fn()=>$target->apply($p['candidate'],7,'session-one','owner'),'applied preview cannot be replayed');
 $p=$target->prepare($full,7,'session-one','owner');$f=$b.'/runtime/cra1_theme/config.json';$bytes=file_get_contents($f);file_put_contents($f,$bytes.' ');check($target->apply($p['candidate'],7,'session-one','owner')['status']===409,'configuration changed after preview causes conflict');check(file_get_contents($f)===$bytes.' ','conflict does not overwrite the concurrent edit');
 $p=$target->prepare($full,7,'session-one','owner');$incoming=$b.'/runtime/cra1_theme/transfers/incoming/'.$p['candidate'].'.json';$expired=Files::json($incoming);$expired['expires']=time()-1;Files::putJson($incoming,$expired);rejects(fn()=>$target->apply($p['candidate'],7,'session-one','owner'),'expired preview rejected');
 $before=files($b);$writes=0;$failure=new ConfigurationTransfer($b,function($p,$v)use(&$writes){if(++$writes===3)throw new RuntimeException('simulated disk failure');Files::atomic($p,$v,0600);},$catalog);$p=$failure->prepare($full,7,'session-one','owner');rejects(fn()=>$failure->apply($p['candidate'],7,'session-one','owner'),'write failure produces recoverable error');check(files($b)===$before&&!is_file($b.'/runtime/cra1_theme/transfer-pending.json'),'write failure restores all four originals and both snapshots exactly');
 $backup=bin2hex(random_bytes(16));$original=[];foreach(['config.json','member_center.json','cart_theme.json','announcements.json','member_center_public.json','cart_theme_public.json']as$n)$original[$n]=base64_encode(file_get_contents($b.'/runtime/cra1_theme/'.$n));Files::putJson($b.'/runtime/cra1_theme/transfers/backups/'.$backup.'.json',['files'=>$original]);Files::putJson($b.'/runtime/cra1_theme/transfer-pending.json',['backup'=>$backup]);file_put_contents($b.'/runtime/cra1_theme/config.json','{}');rejects(fn()=>$target->export('https://target.example'),'incomplete imports cannot be exported');$target->recover();check(files($b)===$before,'interrupted import recovers the exact original configuration');
 $bad=$full;$bad['settings']['website']['private_key']='not-a-setting';rejects(fn()=>$target->prepare($bad,7,'s','o'),'unknown exported keys rejected');
 $bad=$full;unset($bad['settings']['cart']);rejects(fn()=>$target->prepare($bad,7,'s','o'),'partial full configuration rejected');
 $bad=$full;$bad['settings']['website']['cap1_title']='<script>alert(1)</script>';rejects(fn()=>$target->prepare($bad,7,'s','o'),'uploaded HTML uses ordinary editor content policy');
 rejects(fn()=>ConfigurationTransfer::decode('{bad'),'damaged JSON rejected');
 rejects(fn()=>ConfigurationTransfer::decode(str_repeat('x',ConfigurationTransfer::MAX_BYTES+1)),'oversized JSON rejected');
 $path=$b.'/runtime/cra1_theme/member_center.json';$good=file_get_contents($path);file_put_contents($path,'{broken');$corrupt=files($b);rejects(fn()=>$target->prepare($full,7,'s','o'),'corrupt target is never silently replaced');check(files($b)===$corrupt,'corrupt target preserved byte for byte');file_put_contents($path,$good);

 // Lossless administrator diffs, including JSON layouts and exact empty/null boundaries.
 $diff=\CRA1\Theme\Storage\ConfigurationDiff::compare(['website'=>['a'=>'','b'=>null,'layout_json'=>'{"title":"Old"}']],['website'=>['a'=>null,'b'=>'','layout_json'=>'{"title":"New"}']]);
 check($diff['total']===3&&$diff['entries'][2]['before']==='Old'&&$diff['entries'][2]['after']==='New','field diff distinguishes empty from null and expands JSON-backed settings');
 $d=\CRA1\Theme\Storage\ConfigurationDiff::compare(['member'=>['version'=>1,'sidebar'=>['nodes'=>[['id'=>'first','label'=>'One'],['id'=>'second','label'=>'Two']]]]],['member'=>['version'=>2,'sidebar'=>['nodes'=>[['id'=>'second','label'=>'Two'],['id'=>'first','label'=>'One']]]]]);
 check($d['total']===1&&strpos($d['entries'][0]['path'],'@order')!==false,'reordering stable menu identities is reported once without metadata noise');
 $long=str_repeat('文',1000);$d=\CRA1\Theme\Storage\ConfigurationDiff::compare(['website'=>['custom_css'=>'old']],['website'=>['custom_css'=>$long]]);check($d['entries'][0]['after']===$long,'diff retains the complete content rather than silently truncating code');
 check(isset($replaced['difference']['entries']),'menu proposal includes the actual selected before/after difference');
 $previewCatalog=$catalog;$previewCatalog['preview_capabilities']=['plugins'=>['IdcsmartNews'=>345],'features'=>['withdraw_open'=>0,'recharge_open'=>0]];
 $previewer=new MenuTransfer($a,$previewCatalog);$nodes=[['id'=>'root-preview','label'=>'示例分组','source_type'=>'custom','children'=>[['id'=>'first-preview','label'=>'页面一','url'=>'account.htm','source_type'=>'custom'],['id'=>'second-preview','label'=>'页面二','url'=>'account.htm','source_type'=>'custom'],['id'=>'plugin-preview','label'=>'缺失插件','url'=>'plugin/777/source.htm','source_type'=>'custom'],['id'=>'hidden-preview','label'=>'隐藏页面','url'=>'finance.htm','source_type'=>'custom','hidden'=>1]]]];
 $pv=$previewer->preview(['nodes'=>$nodes,'shape'=>3]);check(count($pv['nodes'][0]['children'])===2&&$pv['counts']['hidden']===1,'menu preview reuses live visibility projection for hidden entries and unavailable plugins');
 check(count($pv['issues'])===2,'menu check reports duplicate targets and plugin filtering without modifying the draft');
 $failedCatalog=$catalog;$failedCatalog['error']='offline';rejects(fn()=>(new MenuTransfer($a,$failedCatalog))->preview(['nodes'=>[]]),'failed catalog is not reported as a passed menu check');
 // Images remain a separate, session-protected download and are never imported through the backend.
 $png=base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=');
 Files::atomic($a.'/public/upload/cra1-theme/picture.png',$png,0644);Files::atomic($a.'/public/upload/cra1-theme/unreferenced.png',$png.'unused',0644);Files::atomic($a.'/public/upload/cra1-theme/avatars/private.png',$png,0644);
 $mediaDoc=$full;$mediaDoc['settings']['website']['cap1_link']='https://source.example/upload/cra1-theme/picture.png';$mediaDoc['settings']['website']['cap1_title']='/upload/cra1-theme/picture.png';
 $mediaDoc['settings']['website']['custom_css']='.example{background:url("/upload/cra1-theme/picture.png")}';
 $mediaDoc['settings']['website']['cap1_desc']='https://external.example/upload/cra1-theme/picture.png';
 $mediaStore=new \CRA1\Theme\Storage\ConfigurationMedia($a);$bundle=$mediaStore->bundle($mediaDoc,'https://source.example',7,'media-session');
 check($bundle['media']['count']===1,'images referenced in multiple fields are deduplicated by content');
 check(strpos($bundle['document']['settings']['website']['cap1_link'],'/upload/cra1-theme/migration/')===0&&strpos($bundle['document']['settings']['website']['custom_css'],'/upload/cra1-theme/migration/')!==false,'configuration and CSS point to the same content-addressed bundled image');
 check($bundle['document']['settings']['website']['cap1_desc']===$mediaDoc['settings']['website']['cap1_desc'],'external images remain external and are never downloaded');
 $zipPath=$mediaStore->download($bundle['media']['id'],7,'media-session');$zip=new ZipArchive();$zip->open($zipPath);check($zip->numFiles===2&&$zip->locateName('图片解压说明.txt')!==false,'image ZIP contains only the referenced image and extraction instructions');
 $picture=$bundle['document']['media']['files'][0];check($zip->getFromName(ltrim($picture['path'],'/'))===$png,'bundled bytes match their configuration hash');
 rejects(fn()=>$mediaStore->download($bundle['media']['id'],8,'media-session'),'image download is bound to its administrator');rejects(fn()=>$mediaStore->download($bundle['media']['id'],7,'other-session'),'image download is bound to its login session');
 $checker=new \CRA1\Theme\Storage\ConfigurationMedia($b);check(count($checker->inspect($bundle['document'])['missing'])===1,'import identifies images which have not been manually extracted');
 $mediaPrepared=$target->prepare($bundle['document'],7,'media-session','owner');check($mediaPrepared['media']['missing']&&$target->apply($mediaPrepared['candidate'],7,'media-session','owner')['status']===409,'missing pictures block submission without changing any settings');
 Files::atomic($b.'/public'.$picture['path'],$zip->getFromName(ltrim($picture['path'],'/')),0644);$zip->close();check($checker->inspect($bundle['document'])['missing']===[],'manual extraction to public satisfies image readiness');
 $mediaPrepared=$target->prepare($bundle['document'],7,'media-session','owner');check($target->apply($mediaPrepared['candidate'],7,'media-session','owner')['status']===200,'configuration imports after its matching pictures are extracted');
 $badMedia=$bundle['document'];$badMedia['media']['files'][0]['path']='/upload/cra1-theme/migration/../../private.json';rejects(fn()=>$checker->inspect($badMedia),'image manifest cannot read arbitrary paths');
 $badMedia=$bundle['document'];$badMedia['media']['files'][0]['sha256']=str_repeat('a',64);rejects(fn()=>$checker->inspect($badMedia),'image hash and target filename must agree');
 $avatarDoc=$mediaDoc;$avatarDoc['settings']=['website'=>['url'=>'/upload/cra1-theme/avatars/private.png']];check($mediaStore->bundle($avatarDoc,'https://source.example',7,'s')['media']===null,'member avatars are never bundled');
 symlink($a.'/config/cra1_theme_security.key',$a.'/public/upload/cra1-theme/link.png');$linkDoc=$avatarDoc;$linkDoc['settings']['website']['url']='/upload/cra1-theme/link.png';$linked=$mediaStore->bundle($linkDoc,'https://source.example',7,'s');check($linked['media']===null&&count($linked['warnings'])===1,'symlink media is refused without leaking its target');
 // History covers ordinary saves and imports, and restoring history is a new protected transaction.
 check(ConfigurationTransfer::tracks('workspace.editor.save')&&ConfigurationTransfer::tracks('announcements.save')&&!ConfigurationTransfer::tracks('workspace.preview'),'only configuration-changing actions create history');
 $stateBefore=$target->history();check(count($stateBefore['items'])>0,'imports and legacy backups appear in configuration history');
 $restoreId=$stateBefore['items'][0]['id'];$restorePreview=$target->prepareHistory($restoreId,7,'history-session','owner');check($restorePreview['operation']==='history.restore'&&isset($restorePreview['difference']['entries']),'history restore has the same detailed preview and confirmation contract');
 check($target->apply($restorePreview['candidate'],7,'history-session','owner')['status']===200,'history restore completes through the normal transactional apply');
 check($target->history()['items'][0]['action']==='history.restore','restore preserves the state it replaced so it can be undone');
 $historyBefore=$target->history();$target->checkpoint('workspace.editor.save','owner');$once=$target->history();$target->checkpoint('workspace.editor.save','owner');check(count($target->history()['items'])===count($once['items']),'repeated no-op save checkpoints do not fill history');
 for($i=0;$i<24;$i++){Files::putJson($b.'/runtime/cra1_theme/config.json',['cap1_title'=>'history-'.$i]);$target->checkpoint('save','owner');}
 check(count($target->history()['items'])===20,'history retention is bounded to the latest twenty snapshots');
 $malformed=bin2hex(random_bytes(16));file_put_contents($b.'/runtime/cra1_theme/transfers/backups/'.$malformed.'.json','{broken');$items=$target->history()['items'];check(count(array_filter($items,fn($item)=>!$item['available']))===1&&count(array_filter($items,fn($item)=>$item['available']))===20,'a corrupt history item does not hide other valid history');
 rejects(fn()=>$target->prepareHistory($malformed,7,'s','owner'),'corrupt history cannot overwrite live settings');
 $goodHistory=array_values(array_filter($items,fn($item)=>$item['available']))[0]['id'];$restorePreview=$target->prepareHistory($goodHistory,7,'s','owner');$f=$b.'/runtime/cra1_theme/config.json';file_put_contents($f,file_get_contents($f).' ');check($target->apply($restorePreview['candidate'],7,'s','owner')['status']===409,'history restore rejects a configuration modified after preview');
 check(hash_file('sha256',$b.'/config/cra1_theme_security.key')===$key&&hash_file('sha256',$b.'/runtime/cra1_theme/security.sqlite')===$account,'all new migration and history flows preserve accounts and cryptographic keys');
 // The local retention policy is administrator-controlled and is never transferred or restored.
 $c=$base.'/retention';fixture($c);$retention=new ConfigurationTransfer($c,null,$catalog);$policy=$c.'/runtime/cra1_theme/transfers/history-settings.json';
 check($retention->history()['limit']===20&&!file_exists($policy),'existing sites use twenty without mutating their configuration');
 $result=$retention->saveHistoryLimit(25,20);check($result['status']===200&&$result['data']['previous_limit']===20&&$result['data']['deleted']===0,'saving a larger limit persists the selected policy');
 check((new ConfigurationTransfer($c,null,$catalog))->history()['limit']===25,'history limit survives a new request');
 for($i=0;$i<28;$i++){Files::putJson($c.'/runtime/cra1_theme/config.json',['cap1_title'=>'retention-'.$i]);$retention->checkpoint('save','owner');}
 check(count($retention->history()['items'])===25,'ordinary saves honor a limit greater than the previous fixed twenty');
 $result=$retention->saveHistoryLimit(0,25);check($result['status']===200&&$result['data']['deleted']===0,'unlimited mode does not remove existing history');
 for($i=0;$i<7;$i++){Files::putJson($c.'/runtime/cra1_theme/config.json',['cap1_title'=>'unlimited-'.$i]);$retention->checkpoint('save','owner');}
 check(count($retention->history()['items'])===32&&$retention->history()['limit']===0,'unlimited mode keeps all additional checkpoints');
 $export=$retention->export('https://example.invalid');check(strpos(json_encode($export),'history-settings')===false&&!isset($export['settings']['history_limit']),'local retention policy is excluded from configuration exports');
 $preview=$retention->prepare($full,7,'s','owner');$retention->apply($preview['candidate'],7,'s','owner');check($retention->history()['limit']===0,'full import preserves the local retention policy');
 $restore=$retention->prepareHistory($retention->history()['items'][1]['id'],7,'s','owner');$retention->apply($restore['candidate'],7,'s','owner');check($retention->history()['limit']===0,'history restore preserves the local retention policy');
 $latest=array_column(array_slice($retention->history()['items'],0,3),'id');$total=count($retention->history()['items']);$dataBefore=files($c);$result=$retention->saveHistoryLimit(3,0);
 check($result['data']['deleted']===$total-3&&array_column($retention->history()['items'],'id')===$latest,'reducing retention deletes exactly the older records and keeps the newest three');
 check(files($c)===$dataBefore,'changing retention never rewrites theme settings or public snapshots');
 $policyBefore=file_get_contents($policy);$idsBefore=array_column($retention->history()['items'],'id');
 foreach([-1,1.5,true,'2',[],null]as$bad)rejects(fn()=>$retention->saveHistoryLimit($bad,3),'invalid retention value rejected: '.gettype($bad));
 rejects(fn()=>$retention->saveHistoryLimit(2,'3'),'expected limit must be an integer');
 check($retention->saveHistoryLimit(1,20)['status']===409,'stale administrators cannot overwrite a newer retention policy');
 check(file_get_contents($policy)===$policyBefore&&array_column($retention->history()['items'],'id')===$idsBefore,'invalid and conflicting saves leave policy and history intact');
 $result=$retention->saveHistoryLimit(1,3);Files::putJson($c.'/runtime/cra1_theme/config.json',['cap1_title'=>'one-item']);$retention->checkpoint('save','owner');check(count($retention->history()['items'])===1,'minimum finite retention works on subsequent ordinary saves');
 $idsBefore=glob($c.'/runtime/cra1_theme/transfers/backups/*.json');file_put_contents($policy,'{broken');
 rejects(fn()=>$retention->history(),'corrupt policy is reported instead of defaulting to twenty');rejects(fn()=>$retention->saveHistoryLimit(2,1),'corrupt policy cannot be silently replaced');rejects(fn()=>$retention->checkpoint('save','owner'),'corrupt policy prevents destructive checkpoint cleanup');
 check(glob($c.'/runtime/cra1_theme/transfers/backups/*.json')===$idsBefore&&file_get_contents($policy)==='{broken','corrupt retention never causes history deletion');
 Files::putJson($policy,['schema'=>1,'limit'=>1]);unlink($policy);symlink($c.'/config/cra1_theme_security.key',$policy);rejects(fn()=>$retention->saveHistoryLimit(2,1),'retention settings cannot follow a symbolic link');unlink($policy);
 $d=$base.'/pending-retention';fixture($d);$protected=new ConfigurationTransfer($d,null,$catalog);
 for($i=0;$i<4;$i++){Files::putJson($d.'/runtime/cra1_theme/config.json',['cap1_title'=>'protected-'.$i]);$protected->checkpoint('save','owner');}
 $old=$protected->history()['items'][3]['id'];$oldPath=$d.'/runtime/cra1_theme/transfers/backups/'.$old.'.json';$oldBytes=file_get_contents($oldPath);Files::putJson($d.'/runtime/cra1_theme/transfer-pending.json',['backup'=>$old]);$protected->saveHistoryLimit(1,20);
 check(is_file($oldPath)&&file_get_contents($oldPath)===$oldBytes&&count($protected->history()['items'])===2,'cleanup keeps an older backup required for interrupted recovery in addition to the newest record');
 $protected->recover();check($protected->history()['limit']===1&&!is_file($d.'/runtime/cra1_theme/transfer-pending.json'),'interrupted recovery works with a reduced limit and preserves that limit');
 $protected->checkpoint('save','owner');check(count($protected->history()['items'])===1,'recovered backup becomes eligible for normal retention cleanup');
 Files::putJson($d.'/runtime/cra1_theme/transfer-pending.json',[]);$localPolicy=file_get_contents($d.'/runtime/cra1_theme/transfers/history-settings.json');rejects(fn()=>$protected->saveHistoryLimit(2,1),'damaged recovery metadata stops a retention write');check(file_get_contents($d.'/runtime/cra1_theme/transfers/history-settings.json')===$localPolicy,'damaged recovery metadata does not change the policy');
 echo json_encode(['status'=>'passed','checks'=>count($checks),'scenarios'=>$checks,'production_writes'=>0],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),PHP_EOL;
}finally{clean($base);}
