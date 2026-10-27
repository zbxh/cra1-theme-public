<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Storage\AnnouncementStore;
use CRA1\Theme\Announcements\PageCatalog;
date_default_timezone_set('Asia/Shanghai');
$base=sys_get_temp_dir().'/cra1-announcements-'.bin2hex(random_bytes(6));mkdir($base,0700);$checks=0;
function check($ok,string $label):void { if (!$ok) throw new RuntimeException($label);$GLOBALS['checks']++; }
function removeFixture(string $dir):void { if(is_file($dir)||is_link($dir)){unlink($dir);return;}foreach(scandir($dir)as$name)if($name!=='.'&&$name!=='..')removeFixture($dir.'/'.$name);rmdir($dir); }
function rejects(callable $work,string $label):void { $thrown=false;try{$work();}catch(InvalidArgumentException $e){$thrown=true;}check($thrown,$label); }
function fixtureItem(string $id,array $patch=[]):array { return array_replace(['id'=>$id,'title'=>'服务公告','label'=>'维护','icon'=>'megaphone','detail'=>'<p>安全的公告内容</p>','action'=>'detail','action_label'=>'查看详情','targets'=>['member'=>['all'=>true,'pages'=>[]]],'enabled'=>true],$patch); }
try {
    $catalog=new PageCatalog($base,[]);$store=new AnnouncementStore($base,$catalog);
    $pages=$catalog->publicList();check(count(array_filter($pages,static fn($p)=>$p['theme']==='website'))===42,'41 website pages plus notification center');
    check($catalog->resolve('website','/notifications.html')['id']==='notifications','notification center has a stable placement identity');
    $schema=Files::json(CRA1_THEME_BACKEND.'/Storage/workspace_schema.json');
    foreach($schema['pageAliases']as$alias)check($catalog->resolve('website',$alias['route'])['id']===$alias['aliasOf'],'website aliases use canonical IDs');
    check($catalog->resolve('member','/productList.htm?id=1')['id']==='products','product queries match page type');
    check($catalog->resolve('cart','/cart/goods.htm?id=24')['id']==='goods','cart page type');
    foreach(['//evil.invalid','/../home.htm','/home%2ehtm','https://evil.invalid/home.htm','/unknown.htm']as$path)check($catalog->resolve('member',$path)===null,'reject unknown or forged path');
    check($catalog->resolve('website','/home.htm')===null,'theme ownership');
    $a=$store->payload();$b=$store->payload();check($a['revision']===$b['revision'],'missing store produces stable revision');check(!is_dir($base.'/runtime'),'read does not initialize data');
    $legacy=['version'=>7,'unknown'=>['keep'=>'merchant'],'content'=>['notices'=>['enabled'=>1,'interval'=>8,'items'=>[['id'=>'old-global','title'=>'<b>会员通知</b>','content'=>'<p>旧正文</p>','enabled'=>1,'global'=>1,'buttons'=>[['label'=>'帮助','link'=>'/document.html']]],['id'=>'old-home','title'=>'首页专属','enabled'=>1,'global'=>0]]]]];
    Files::putJson($base.'/runtime/cra1_theme/member_center.json',$legacy);
    Files::putJson($base.'/runtime/cra1_theme/member_center_public.json',$legacy);
    Files::putJson($base.'/runtime/cra1_theme/config.json',['show_notice'=>'0','notice_bar_text'=>'官网旧公告|/news.html','merchant'=>'preserved']);
    $before=hash_file('sha256',$base.'/runtime/cra1_theme/member_center.json');
    $read1=$store->payload();usleep(10000);check($read1['revision']===$store->payload()['revision'],'legacy projection stable');
    $store->migrate();$migrated=$store->read();check(count($migrated['values']['items'])===3,'migration retains disabled source content');
    check($store->publicPayload('member','/finance.htm')['items'][0]['title']==='会员通知','global member migration');
    check(count($store->publicPayload('member','/home.htm',null,null,true)['items'])===2,'home-only migration');
    check(count($store->publicPayload('cart','/cart/goods.htm')['items'])===1,'old shared shell targets retained');
    check(!$store->publicPayload('website','/index.html')['items'],'disabled website stays hidden');
    check(hash_file('sha256',$base.'/runtime/cra1_theme/member_center.json')===$before,'legacy source preserved for recovery');
    check(!isset(Files::json($base.'/runtime/cra1_theme/member_center_public.json')['content']['notices']),'public legacy snapshot scrubbed');
    $backup=Files::json($base.'/runtime/cra1_theme/announcement-migration/backup.json');check($backup['files']['runtime/cra1_theme/member_center.json']['sha256']===$before,'exact migration backup');
    $hash=hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json');$store->migrate();check(hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json')===$hash,'idempotent migration');
    $now=strtotime('2026-10-21 12:00:00');$format=static fn($at)=>date('Y-m-d\TH:i:s',$at);
    $values=['enabled'=>true,'interval'=>6,'hide_single_arrows'=>true,'items'=>[
        fixtureItem('visible-one',['priority'=>1,'ends_at'=>$format($now+7),'detail'=>'<script>window.bad=1</script><p onclick="bad()">允许正文</p>']),
        fixtureItem('visible-two',['priority'=>9,'targets'=>['member'=>['all'=>false,'pages'=>['home']]]]),
        fixtureItem('future-one',['title'=>'FUTURE_PRIVATE','starts_at'=>$format($now+2)]),
        fixtureItem('expired-one',['title'=>'EXPIRED_PRIVATE','ends_at'=>$format($now)]),
        fixtureItem('disabled-one',['title'=>'DISABLED_PRIVATE','enabled'=>false]),
        fixtureItem('other-page',['title'=>'OTHER_PAGE_PRIVATE','targets'=>['cart'=>['all'=>true,'pages'=>[]]]]),
    ]];
    $saved=$store->save($store->payload()['revision'],$values,'fixture');check($saved['status']===200,'whole page save');
    $public=$store->publicPayload('member','/home.htm',$now,null,true);check(array_column($public['items'],'id')===['visible-two','visible-one'],'priority and list order');check($public['refresh_after']===2,'refresh follows next start boundary');check($public['items'][1]['expires_in']===7,'expiry boundary uses server time');
    check($public['hide_single_arrows']===false,'legacy hide flag cannot hide navigation');
    check($store->read()['values']['hide_single_arrows']===true,'legacy setting is retained without rewriting stored values');
    $encoded=json_encode($public);foreach(['FUTURE_PRIVATE','EXPIRED_PRIVATE','DISABLED_PRIVATE','OTHER_PAGE_PRIVATE','targets','priority','starts_at','published_at']as$private)check(strpos($encoded,$private)===false,'no hidden content or configuration leak: '.$private);
    $archive=$store->allPublicPayload($now,true);
    check(array_column($archive['items'],'id')===['visible-two','visible-one','other-page'],'center includes active notifications from all three themes');
    foreach(['FUTURE_PRIVATE','EXPIRED_PRIVATE','DISABLED_PRIVATE','targets','priority','starts_at','published_at','dismiss_for','dismissible','icon_html']as$private) {
        check(strpos(json_encode($archive),$private)===false,'center does not reveal hidden content or editor fields: '.$private);
    }
    check($store->allPublicPayload($now+2,true)['refresh_after']===5,'center follows scheduled publication and expiry boundaries');
    check(array_column($store->allPublicPayload($now)['items'],'id')===['other-page'],'anonymous center only returns website or cart notifications');
    check($store->publicPayload('member','/home.htm',$now)['items']===[],'forged member path cannot read member-only notifications');
    check($store->publicPayload('member','/home.htm',$now)['refresh_after']===30,'private start and expiry do not alter anonymous refresh metadata');
    check(array_column($store->publicPayload('cart','/cart/goods.htm',$now)['items'],'id')===['other-page'],'cart notification is visible without a login');
    $accessDoc=$store->read();$accessDraft=$saved['data']['values'];
    $accessDraft['items'][1]['targets']['website']=['all'=>false,'pages'=>['home']];
    check(array_column($store->publicPayload('member','/home.htm',$now,$accessDraft)['items'],'id')===['visible-two'],'one website placement makes mixed notification public');
    $accessDraft['items'][1]['targets']['website']=['all'=>false,'pages'=>[]];
    $accessDraft['items'][1]['targets']['cart']=['all'=>false,'pages'=>['goods']];
    check(array_column($store->publicPayload('member','/home.htm',$now,$accessDraft)['items'],'id')===['visible-two'],'one cart placement makes mixed notification public');
    $accessDraft['items'][1]['targets']['cart']=['all'=>false,'pages'=>['removed-page']];
    Files::putJson($base.'/runtime/cra1_theme/announcements.json',['schema'=>1,'version'=>2,'updated_at'=>0,'values'=>$accessDraft]);
    check(!in_array('visible-two',array_column($store->allPublicPayload($now)['items'],'id'),true),'removed cart page cannot turn a member-only entry public');
    check(in_array('visible-two',array_column($store->allPublicPayload($now,true)['items'],'id'),true),'member retains access when its selected page remains valid');
    Files::putJson($base.'/runtime/cra1_theme/announcements.json',$accessDoc);
    $centerHash=hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json');$store->allPublicPayload($now,true);
    check(hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json')===$centerHash,'center never rewrites notification content or revisions');
    check(strpos($encoded,'window.bad')===false&&strpos($encoded,'onclick')===false,'details are sanitized');
    check($public['items'][1]['summary']==='允许正文','empty summary falls back to sanitized detail text');
    $textDraft=$saved['data']['values'];$textDraft['items'][1]['summary']='';$textDraft['items'][1]['detail']='<p>第一段 <strong>加粗</strong>&amp;支持</p><p>第二段<br>第三行</p>';
    $textPublic=$store->publicPayload('member','/home.htm',$now,$textDraft,true);
    check($textPublic['items'][0]['summary']==='第一段 加粗&支持 第二段 第三行','summary separates blocks and decodes entities');
    $textDraft['items'][1]['summary']='商家填写的简短说明';
    check($store->publicPayload('member','/home.htm',$now,$textDraft,true)['items'][0]['summary']==='商家填写的简短说明','explicit summary takes precedence');
    check($store->read()['values']['items'][0]['summary']==='','derived summary never overwrites the stored field');
    check(count($store->publicPayload('member','/home.htm',$now+2,null,true)['items'])===3,'begins at exact second');
    check(!in_array('visible-one',array_column($store->publicPayload('member','/home.htm',$now+7,null,true)['items'],'id'),true),'expires at exact second');
    $original=$saved['data']['values'];$revision=$saved['data']['revision'];$disk=hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json');
    $conflict=$store->save('incorrect',['enabled'=>false],'fixture');check($conflict['status']===409,'stale revisions conflict');check(hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json')===$disk,'conflict writes nothing');
    $bad=$original;$bad['items'][1]['targets']['member']['pages']=['made-up'];rejects(static fn()=>$store->save($revision,$bad,'fixture'),'unknown page rejected atomically');check(hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json')===$disk,'one invalid item prevents all writes');
    foreach([['interval'=>0],['unknown'=>'value']]as$bad)rejects(static fn()=>$store->save($revision,$bad,'fixture'),'invalid settings rejected');
    foreach(['javascript:alert(1)','data:text/html,test','//evil.invalid','/ok.htm'."\n".'bad']as$url)rejects(static fn()=>AnnouncementStore::safeUrl($url),'unsafe URL rejected');
    $next=$original;$next['items']=array_reverse($next['items']);$next['items'][4]['priority']=8;
    $normalized=$store->normalize($next,$original);$old=array_column($original['items'],null,'id');foreach($normalized['items']as$item)check($item['revision']===$old[$item['id']]['revision'],'ordering and priority preserve dismiss revision');
    $next['items'][0]['title']='内容变更';$changed=$store->normalize($next,$original);check($changed['items'][0]['revision']!==$old[$changed['items'][0]['id']]['revision'],'content edits reset only edited notice');
    $draft=$original;$draft['items'][0]['title']='未保存预览';$preview=$store->publicPayload('member','/home.htm',$now,$draft,true);check(strpos(json_encode($preview,JSON_UNESCAPED_UNICODE),'未保存预览')!==false,'draft preview');check(hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json')===$disk,'preview writes nothing');
    Files::putJson($base.'/runtime/cra1_theme/announcements.json',['valid_json'=>'wrong_shape']);$corrupt=hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json');$rejected=false;try{$store->save($revision,['enabled'=>true],'fixture');}catch(RuntimeException $e){$rejected=true;}check($rejected&&hash_file('sha256',$base.'/runtime/cra1_theme/announcements.json')===$corrupt,'corrupt document never overwritten');
    $pluginDir=$base.'/public/plugins/addon/example/template/clientarea/pc/default';mkdir($pluginDir,0700,true);file_put_contents($pluginDir.'/ticket.html','fixture');
    $extensions=new PageCatalog($base,[['id'=>9,'name'=>'Example','module'=>'addon','title'=>'工单','status'=>1],['id'=>10,'name'=>'Disabled','module'=>'addon','status'=>0]]);
    check($extensions->resolve('member','/plugin/9/ticket.htm')['id']==='plugin:Example:ticket','enabled plugin page uses stable identity');check($extensions->resolve('member','/plugin/10/ticket.htm')===null,'disabled plugins omitted');
    $preset=$base.'/legacy-preset';Files::putJson($preset.'/runtime/cra1_theme/distribution/current.json',['manifest'=>['product'=>'cra1-theme','files'=>['public/web/cra1/controller/Cra1.php'=>['sha256'=>'617e59a6f8ce48025aa0b826dc4c4ba88e54463b306a58aa51971b14b243e3e2']]]]);
    $presetStore=new AnnouncementStore($preset,new PageCatalog($preset,[]));
    check(count($presetStore->publicPayload('website','/index.html')['items'])===3,'known installed legacy template presets migrate even if never explicitly saved');
    check(!is_file($preset.'/runtime/cra1_theme/announcements.json'),'preset projection is read only');
    Files::putJson($preset.'/runtime/cra1_theme/config.json',['show_notice'=>'0','notice_bar_text'=>'商家文案|/about.html']);
    check(!$presetStore->publicPayload('website','/index.html')['items'],'explicit disabled value overrides old template defaults');
    check($presetStore->read()['values']['items'][0]['title']==='商家文案','explicit merchant text overrides old presets');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0],JSON_UNESCAPED_UNICODE).PHP_EOL;
} finally { removeFixture($base); }
