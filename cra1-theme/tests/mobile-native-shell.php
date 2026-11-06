<?php
declare(strict_types=1);
/** Isolated view-resolution contracts: never boot a site or write business data. */
namespace app\home\controller {
    class ViewClientController {
        public $request;
        public function module(){return 'native-module';}
        public function plugin(){return 'native-plugin';}
        protected function applyViewAppendHook(string $name,array $params,string $content): string {
            $GLOBALS['hook']=[$name,$params];return $content.'<!--hooks-->';
        }
    }
}
namespace app\admin\model {
    class PluginModel {
        public static function where($key,$value){$GLOBALS['filters']=[$key=>$value];return new PluginQuery();}
        public function plugins($type){return ['list'=>$GLOBALS['plugins']];}
    }
    class PluginQuery {
        public function where($key,$value){$GLOBALS['filters'][$key]=$value;return $this;}
        public function find(){return $GLOBALS['moduleEnabled']?['name'=>'MfCloud']:null;}
    }
}
namespace addon\idcsmart_news\model {
    class IdcsmartNewsModel {public function where($key,$id){$GLOBALS['newsId']=$id;return $this;}public function value($key){return '原生新闻内容';}}
}
namespace {
$fixture=sys_get_temp_dir().'/cra1-mobile-native-'.bin2hex(random_bytes(6));
mkdir($fixture,0700);define('IDCSMART_ROOT',$fixture.'/');
// Optional real V10 class, extracted from the official installation/upgrade ZIP.
// Never mock enhanced methods here: a previous mock hid a production fatal error.
$native=getenv('CRA1_NATIVE_TEMPLATE_LOGIC');if($native)require $native;
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');require CRA1_THEME_BACKEND.'/bootstrap.php';
function fixtureFile(string $relative): string {
    $file=IDCSMART_ROOT.$relative;if(!is_dir(dirname($file)))mkdir(dirname($file),0700,true);file_put_contents($file,'fixture');return $file;
}
function emptyFixture(string $dir): void {
    foreach(new FilesystemIterator($dir) as $p){if($p->isDir()&&!$p->isLink()){emptyFixture($p->getPathname());rmdir($p->getPathname());}else unlink($p->getPathname());}
}
function use_mobile(){return $GLOBALS['mobile'];}
function configuration($key){return ['clientarea_theme'=>'cra1','clientarea_theme_mobile'=>$GLOBALS['mobileTheme'],'system_version'=>'10.7.4','clientarea_theme_color'=>'default'][$key]??'';}
function cookie($key,$value=null){if($value!==null)$GLOBALS['cookies'][$key]=$value;return $GLOBALS['cookies'][$key]??'';}
function parse_name($name,$type=0){return $type?str_replace(' ','',ucwords(str_replace('_',' ',$name))):strtolower(preg_replace('/(?<!^)[A-Z]/','_$0',$name));}
function assign_clientarea_lang_config($data){return $data+['lang_home'=>'zh-cn'];}
function get_client_id($required=false){return 7;}
function check_home_enforce_safe_method_redirect(){$GLOBALS['safetyCalls']++;return ['redirect'=>$GLOBALS['safetyRedirect'],'url'=>'/security.htm'];}
function redirect($url){return 'redirect:'.$url;}
class MobileNativeRequest {public $params=[];public function param(){return $this->params;}}
class MobileNativeView extends \CRA1\Theme\Http\home\ViewClientController {
    public $renders=[];
    protected function renderCRA1(string $file,string $base,string $suffix,array $data): string {
        $this->renders[]=compact('file','base','suffix','data');
        return $suffix==='html'?'<div class="business">native-content</div><script src="/module.js"></script>':(strpos($file,'header')!==false?'<head><link href="/theme.css"></head><body>':'</body>');
    }
}
function resetView(): MobileNativeView {
    emptyFixture(IDCSMART_ROOT);
    foreach(['header','footer'] as $page)fixtureFile('public/clientarea/template/mobile/cra1/'.$page.'.php');
    foreach(['server/mf_cloud/product_detail','addon/idcsmart_ticket/ticket','addon/idcsmart_certification/certification','addon/idcsmart_news/news_detail'] as $path){[$type,$name,$page]=explode('/',$path);fixtureFile('public/plugins/'.$type.'/'.$name.'/template/clientarea/pc/default/'.$page.'.html');}
    $GLOBALS['mobile']=true;$GLOBALS['mobileTheme']='cra1';$GLOBALS['cookies']=[];
    $GLOBALS['moduleEnabled']=true;
    $GLOBALS['plugins']=[['id'=>1,'name'=>'IdcsmartTicket','status'=>1],['id'=>2,'name'=>'IdcsmartCertification','status'=>1],['id'=>3,'name'=>'IdcsmartNews','status'=>1],['id'=>4,'name'=>'DisabledAddon','status'=>0]];
    $GLOBALS['hook']=null;$GLOBALS['safetyCalls']=0;$GLOBALS['safetyRedirect']=false;
    $view=new MobileNativeView();$view->request=new MobileNativeRequest();$view->request->params=['module'=>'mf_cloud','view_html'=>'product_detail','id'=>24];return $view;
}
$checks=[];
function checkMobile($ok,$label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
$v=resetView();$body=$v->module();
checkMobile(count($v->renders)===3,'fallback renders selected header, original business view and selected footer once');
checkMobile($GLOBALS['filters']===['name'=>'MfCloud','status'=>1,'module'=>'server'],'only an enabled registered server module is adapted');
checkMobile(strpos($v->renders[0]['file'],'/mobile/cra1/header.php')!==false,'business fallback never forces the public shell to default');
checkMobile($v->renders[1]['data']['themes']==='pc/default'&&$v->renders[1]['data']['public_themes']==='mobile/cra1','business and public template identities stay independent');
checkMobile($v->renders[1]['data']['lang_home']==='zh-cn','native language context remains available');
checkMobile(strpos($body,'/theme.css?v=10.7.4')!==false&&strpos($body,'/module.js?v=10.7.4')!==false,'native static resource versioning remains intact');
checkMobile(strpos($body,'native-content')!==false&&substr_count($body,'<!--hooks-->')===1,'business HTML and append hooks are preserved');
checkMobile($GLOBALS['hook'][1]['module']==='mf_cloud'&&$GLOBALS['hook'][1]['client_id']===7,'module hook context retains identity and module');
foreach (['mobileOff','otherTheme','explicitDefault','missingBusiness','disabledModule','invalidView','missingShell'] as $case) {
    $v=resetView();
    if($case==='mobileOff')$GLOBALS['mobile']=false;
    if($case==='otherTheme')$GLOBALS['mobileTheme']='mycra1';
    if($case==='explicitDefault')$v->request->params['theme_mobile']='default';
    if($case==='missingBusiness')unlink(IDCSMART_ROOT.'public/plugins/server/mf_cloud/template/clientarea/pc/default/product_detail.html');
    if($case==='disabledModule')$GLOBALS['moduleEnabled']=false;
    if($case==='invalidView')$v->request->params['view_html']='../product_detail';
    if($case==='missingShell')unlink(IDCSMART_ROOT.'public/clientarea/template/mobile/cra1/header.php');
    checkMobile($v->module()==='native-module'&&count($v->renders)===0,$case.' delegates to the native controller without rendering another shell');
}
$v=resetView();$v->request->params=['plugin_id'=>1,'view_html'=>'ticket'];$body=$v->plugin();
checkMobile(count($v->renders)===3&&strpos($v->renders[1]['file'],'/addon/idcsmart_ticket/')!==false,'addon fallback also uses the selected shell');
checkMobile($GLOBALS['safetyCalls']===1&&$GLOBALS['hook'][1]['plugin_id']===1,'addon safety checks and append hook identifiers are retained');
$v=resetView();$v->request->params=['plugin_id'=>1,'view_html'=>'ticket','theme'=>'default','theme_mobile'=>'cra1'];$v->plugin();
checkMobile(count($v->renders)===3&&$v->renders[0]['data']['public_themes']==='mobile/cra1','mobile CRA1 works independently of the selected PC theme');
$v=resetView();$GLOBALS['plugins'][]=['id'=>5,'name'=>'IdcsmartAnnouncement','status'=>1];$v->request->params=['plugin_id'=>5,'view_html'=>'source','theme'=>'cra1','theme_mobile'=>'default'];
checkMobile($v->plugin()==='native-plugin'&&!$v->renders,'a native mobile theme keeps its own announcement page when PC uses CRA1');
$v=resetView();$GLOBALS['mobile']=false;$v->request->params=['plugin_id'=>1,'view_html'=>'ticket','theme'=>'default','theme_mobile'=>'cra1'];
checkMobile($v->plugin()==='native-plugin'&&!$v->renders,'mobile-only CRA1 never takes over another selected PC theme');
$v=resetView();$v->request->params=['plugin_id'=>1,'view_html'=>'ticket'];$GLOBALS['safetyRedirect']=true;
checkMobile($v->plugin()==='redirect:/security.htm'&&!$v->renders,'required account safety setup redirects before rendering');
$v=resetView();$v->request->params=['plugin_id'=>2,'view_html'=>'certification'];$v->plugin();
checkMobile($GLOBALS['safetyCalls']===0&&count($v->renders)===3,'certification retains its native exemption from the safety redirect');
$v=resetView();$v->request->params=['plugin_id'=>3,'view_html'=>'news_detail','id'=>8];$v->plugin();
checkMobile($GLOBALS['newsId']===8&&$v->renders[1]['data']['news_template_seo']==='原生新闻内容','news retains the native article context');
$v=resetView();$v->request->params=['plugin_id'=>4,'view_html'=>'index'];
checkMobile($v->plugin()==='native-plugin'&&!$v->renders,'disabled addons are never adapted');
$v=resetView();$v->request->params=['module'=>'mf_cloud','view_html'=>'product_detail','id'=>null];
checkMobile($v->module()==='redirect:/productList.htm','incomplete host links keep their established recovery');
// Exercise every official fallback level against files, not an invented native API.
foreach(['mobile/default','pc/cra1','mobile/cra1'] as $theme){
    $v=resetView();fixtureFile('public/plugins/server/mf_cloud/template/clientarea/'.$theme.'/product_detail.html');$v->module();
    checkMobile(count($v->renders)===3&&$v->renders[1]['data']['themes']===$theme,$theme.' business template retains the selected mobile shell');
}
$logic=new \CRA1\Theme\Presentation\ClientareaTemplates();
foreach(['addon','server'] as $type){
    resetView();$name=$type==='addon'?'idcsmart_ticket':'mf_cloud';$view=$type==='addon'?'ticket':'product_detail';
    foreach(['mobile/cra1','mobile/default','pc/cra1','pc/default'] as $theme)fixtureFile('public/plugins/'.$type.'/'.$name.'/template/clientarea/'.$theme.'/'.$view.'.html');
    foreach(['mobile/cra1','mobile/default','pc/cra1','pc/default'] as $theme){
        $resolved=$logic->resolveBusinessTemplate($type,$name,$view,true,'cra1','cra1');
        checkMobile($resolved['themes']===$theme,$type.' selects '.$theme.' in official fallback order');
        if(class_exists('app\\common\\logic\\ClientareaTemplateLogic')){
            $stock=(new \app\common\logic\ClientareaTemplateLogic())->resolveBusinessTemplate($type,$name,$view,true,'cra1','cra1');
            checkMobile($stock['themes']===$resolved['themes'],'official V10 resolver agrees for '.$type.' '.$theme);
        }
        unlink($resolved['template_file']);
    }
    checkMobile($logic->resolveBusinessTemplate($type,$name,$view,true,'cra1','cra1')===[],'missing '.$type.' template preserves native missing-page handling');
}
checkMobile($logic->resolveBusinessTemplate('other','mf_cloud','index',true,'cra1','cra1')===[],'unknown template roots are not accepted');
checkMobile($logic->resolveBusinessTemplate('server','../mf_cloud','index',true,'cra1','cra1')===[],'request names cannot traverse template paths');
resetView();$v=new MobileNativeView();$v->request=new MobileNativeRequest();$v->request->params=['module'=>'mf_cloud','view_html'=>'product_detail','id'=>24,'theme'=>'cra1','theme_mobile'=>'cra1'];$v->module();
checkMobile(($GLOBALS['cookies']['clientarea_theme']??'')==='cra1'&&($GLOBALS['cookies']['clientarea_theme_mobile']??'')==='cra1','valid theme preview cookies are preserved');
emptyFixture(IDCSMART_ROOT);rmdir(IDCSMART_ROOT);
echo json_encode(['status'=>'passed','checks'=>count($checks),'official_resolver_loaded'=>(bool)$native,'production_writes'=>0]),PHP_EOL;
}
