<?php
declare(strict_types=1);
// Render actual packaged templates with isolated data. Native libraries are read-only fixtures.
$site=realpath($argv[1]??'');$native=realpath($argv[2]??'');
if(!$site||!$native||$site===$native||!is_file($native.'/vendor/autoload.php'))throw new RuntimeException('Use an extracted candidate and an explicit native fixture root');
define('IDCSMART_ROOT',$site.'/');
function runtime_path(){return IDCSMART_ROOT.'runtime/';}
function add_hook($name,$callback){$GLOBALS['fixture_hooks'][$name][]=$callback;}
function parse_name($name,$type=0){return $name;}
function view_tpl_replace($content,$data,$name=''){return $content;}
function config($key){return '';}
function hook($name){return [];}
function configuration($key){$d=['website_name'=>'Fixture Site','enterprise_name'=>'Fixture','system_version'=>'10.7.4','web_theme'=>'cra1','lang_home'=>'zh-cn'];return is_array($key)?array_intersect_key($d,array_flip($key)):($d[$key]??'');}
// Deliberately fail optional DB consumers instead of opening any system database.
class NoFixtureDatabase {public static function __callStatic($method,$args){throw new RuntimeException('No database in template fixture');}}
class_alias(NoFixtureDatabase::class,'think\\facade\\Db');
class NoFixtureEvent {public static function listen($name,$callback):void {}}
class_alias(NoFixtureEvent::class,'think\\facade\\Event');
require $native.'/vendor/autoload.php';
require $site.'/cra1-theme/backend/bootstrap.php';
$manifest=CRA1\Theme\Files::json($site.'/cra1-theme/release.json');
CRA1\Theme\Release\References::apply($site,$manifest['references']);
require $site.'/public/web/cra1/controller/Cra1.php';
require $site.'/public/web/cra1/controller/hooks.php';
$checks=0;$pages=[];$assets=[];
function packagedCheck($ok,string $label):void {if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function packagedRender(string $file,array $data,string $base,string $suffix):string {
    fwrite(STDERR,'render '.substr($file,strlen(IDCSMART_ROOT)).PHP_EOL);
    $tpl=new think\Template();$tpl->config(['cache_path'=>runtime_path().'template-fixture/','view_path'=>$base.'/','view_suffix'=>$suffix,'tpl_cache'=>false]);
    ob_start();try{$tpl->fetch($file,$data);return ob_get_clean();}catch(Throwable $e){ob_end_clean();throw $e;}
}
function packagedAssets(string $html,string $page):void {
    preg_match_all('~(?<![:A-Za-z])(?:src|href)="(/[^"<>]+)"~',$html,$matches);
    foreach(array_unique($matches[1]) as $url){
        $path=parse_url(html_entity_decode($url),PHP_URL_PATH);
        if(!preg_match('~\.(?:js|css)$~',$path)||strpos($path,'/upload/')===0)continue;
        packagedCheck(is_file(IDCSMART_ROOT.'public'.$path),'missing resource '.$path.' in '.$page);
        $GLOBALS['assets'][$path]=true;
    }
}
// Exercise the real header with CRA1-only data; no old theme data alias is provided.
$headerData=['cra1'=>['seo'=>['titleFull'=>'详情标题-验收站点','siteName'=>'验收站点']]];
$headerBase=IDCSMART_ROOT.'public/web/cra1';
$header=packagedRender($headerBase.'/header.html',['data'=>$headerData,'title'=>'验收站点','keywords'=>'','description'=>''],$headerBase,'html');
packagedCheck(strpos($header,'<title>详情标题-验收站点</title>')!==false,'CRA1-only SEO overrides a bare site title');
packagedCheck(strpos($header,'data-theme="cra1"')!==false,'website styling uses the CRA1 theme identifier');
$header=packagedRender($headerBase.'/header.html',['data'=>$headerData,'title'=>'系统详情标题','keywords'=>'','description'=>''],$headerBase,'html');
packagedCheck(strpos($header,'<title>系统详情标题</title>')!==false,'specific native detail titles remain intact');
$headerData['page_key']='home';
$headerData['cra1']['slides']=[['img'=>'/web/cra1/assets/img/banner/banner-hw-1.jpg']];
$header=packagedRender($headerBase.'/header.html',['data'=>$headerData,'title'=>'验收站点','keywords'=>'','description'=>''],$headerBase,'html');
packagedCheck(strpos($header,'rel="preload" as="image" type="image/webp" href="/web/cra1/assets/img/banner/banner-hw-1.webp"')!==false,'CRA1-only home data preloads the existing WebP companion');
$websitePages=cra1_page_module_manifest();
$websitePages['notifications']=['route'=>'/notifications.html'];
foreach($websitePages as $key=>$page){
    $tplName=(string)$key==='home'?'index':(string)$key;
    $_SERVER['REQUEST_URI']=$page['route'];$_SERVER['HTTP_HOST']='fixture.invalid';
    $data=[];foreach($GLOBALS['fixture_hooks']['web_data_custom']??[] as $hook){$r=$hook(['themes'=>'cra1','tpl_name'=>$tplName,'url'=>'https://fixture.invalid'.$page['route']]);$data=array_replace_recursive($data,$r['data']??[]);}
    $data['config']=cra1_system_display_config();$data['url']='https://fixture.invalid'.$page['route'];
    $html=packagedRender(IDCSMART_ROOT.'public/web/cra1/'.$tplName.'.html',['data'=>$data,'title'=>'Fixture','keywords'=>'','description'=>''],IDCSMART_ROOT.'public/web/cra1','html');
    packagedCheck(strpos($html,'<html')!==false&&strpos($html,'</html>')!==false,'website document '.$key);packagedAssets($html,'website:'.$key);$pages[]='website:'.$key;
}
foreach(['pc','mobile'] as $device){
    $themes=$device.'/cra1';$member=IDCSMART_ROOT.'public/clientarea/template/'.$themes;
    $vars=['title'=>'Fixture','addons'=>[],'template_catalog'=>'clientarea','template_catalog_home'=>'home','template_catalog_cart'=>'cart','themes'=>$themes,'themes_home'=>$themes,'themes_cart'=>$themes,'public_themes'=>$themes,'clientarea_theme_color'=>'default','system_version'=>'10.7.4','lang_home'=>'zh-cn','lang_home_follow_browser'=>0,'lang_home_open'=>0];
    foreach(glob(IDCSMART_ROOT.'public/clientarea/template/pc/cra1/*.php') as $file){
        $name=basename($file,'.php');if(in_array($name,['header','footer'],true))continue;
        $_SERVER['REQUEST_URI']='/'.$name.'.htm';
        $html=packagedRender($member.'/'.$name.'.php',$vars,$member,'php');
        packagedCheck(strpos($html,'<html')!==false&&strpos($html,'</html>')!==false,'member document '.$themes.'/'.$name);packagedAssets($html,'member:'.$themes.'/'.$name);$pages[]='member:'.$themes.'/'.$name;
    }
    $_SERVER['REQUEST_URI']='/home.htm';$html=packagedRender($member.'/header.php',$vars,$member,'php').packagedRender(IDCSMART_ROOT.'public/home/template/'.$themes.'/home.php',$vars,IDCSMART_ROOT.'public/home/template/'.$themes,'php').packagedRender($member.'/footer.php',$vars,$member,'php');
    packagedCheck(substr_count($html,'class="cra1-shell"')===1,'home renders one member shell '.$themes);
    packagedCheck(substr_count($html,'<aside-menu ')===1&&substr_count($html,'<top-menu ')===1,'home renders sidebar and header '.$themes);
    packagedCheck(substr_count($html,'id="cra1-content-slot"')===1&&strpos($html,'id="root"')===false,'home mounts React inside the member shell '.$themes);
    packagedCheck(strpos($html,'/js/shell.js')!==false,'home loads shell lifecycle '.$themes);
    packagedCheck(substr_count($html,'/cra1-shared.js')===1&&substr_count($html,'/cra1-shared.css')===1,'home loads shared assets once '.$themes);
    packagedAssets($html,'home:'.$themes);$pages[]='home:'.$themes;
    $pluginVars=array_replace($vars,['cra1_plugin_id'=>71]);
    $html=packagedRender($member.'/header.php',$pluginVars,$member,'php')
        .packagedRender(CRA1_THEME_BACKEND.'/Views/announcement.html',$pluginVars,CRA1_THEME_BACKEND.'/Views','html')
        .packagedRender($member.'/footer.php',$pluginVars,$member,'php');
    packagedCheck(substr_count($html,'<cra1-announcement-page :plugin-id="71">')===1,'announcement uses its own consumer '.$themes);
    packagedCheck(substr_count($html,'/js/plugin-pages.js')===1,'plugin adapter loads once before native business scripts '.$themes);
    packagedAssets($html,'announcement:'.$themes);$pages[]='announcement:'.$themes;
    foreach([$device.'/default',$device.'/cloud',$device.'/mycra1'] as $otherTheme){
        $standalone=packagedRender(IDCSMART_ROOT.'public/home/template/'.$themes.'/home.php',array_replace($vars,['themes'=>$otherTheme]),IDCSMART_ROOT.'public/home/template/'.$themes,'php');
        packagedCheck(substr_count($standalone,'id="root"')===1&&strpos($standalone,'class="cra1-shell"')===false,'independent home preserves another member theme '.$otherTheme);
        packagedCheck(strpos($standalone,'id="mainLoading"')===false,'independent home has no shell-dependent loading overlay '.$otherTheme);
        packagedCheck(substr_count($standalone,'/cra1-shared.js')===1&&substr_count($standalone,'/cra1-shared.css')===1,'independent home supplies shared assets once '.$otherTheme);
    }
    foreach(['goodsList','goods','goods_iframe','goods_embed','index_iframe','shoppingCar','settlement','orderResult'] as $name){
        $cart=IDCSMART_ROOT.'public/cart/template/'.$themes;$_SERVER['REQUEST_URI']='/cart/'.$name.'.htm'.($name==='goods'?'?standalone=1':'');
        $html=packagedRender($member.'/header.php',$vars,$member,'php').packagedRender($cart.'/'.$name.'.php',$vars,$cart,'php').packagedRender($member.'/footer.php',$vars,$member,'php');
        packagedCheck(strpos($html,'<html')!==false&&strpos($html,'</html>')!==false,'cart document '.$themes.'/'.$name);packagedAssets($html,'cart:'.$themes.'/'.$name);$pages[]='cart:'.$themes.'/'.$name;
    }
}
echo json_encode(['status'=>'passed','checks'=>$checks,'pages'=>$pages,'unique_assets'=>count($assets),'production_writes'=>0,'native_fixture'=>'installed native libraries; not official compatibility proof'],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE).PHP_EOL;
