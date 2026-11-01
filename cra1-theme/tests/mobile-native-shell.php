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
namespace app\common\logic {
    class ClientareaTemplateLogic {
        public function validName($name){return is_string($name)&&preg_match('/^[A-Za-z0-9_-]+$/D',$name);}
        public function normalizeName($name,$fallback='default'){return $name?:$fallback;}
        public function resolveBusinessTemplate($type,$name,$view,$mobile,$pc,$phone){
            $GLOBALS['resolution']=[$type,$name,$view,$mobile,$pc,$phone];
            return ['template_file'=>$GLOBALS['businessExists']?'/business/'.$view.'.html':false,'resolved_view_path'=>'/business/','themes'=>$GLOBALS['businessTheme']];
        }
        public function resolvePublicShell($mobile,$pc,$phone,$align=''){
            $GLOBALS['alignment']=$align;
            return ['header_file'=>'/shell/header.php','footer_file'=>'/shell/footer.php','resolved_view_path'=>'/shell/','themes'=>$GLOBALS['shellTheme']];
        }
    }
}
namespace addon\idcsmart_news\model {
    class IdcsmartNewsModel {public function where($key,$id){$GLOBALS['newsId']=$id;return $this;}public function value($key){return '原生新闻内容';}}
}
namespace {
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');require CRA1_THEME_BACKEND.'/bootstrap.php';
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
    $GLOBALS['mobile']=true;$GLOBALS['mobileTheme']='cra1';$GLOBALS['cookies']=[];
    $GLOBALS['moduleEnabled']=true;$GLOBALS['businessExists']=true;$GLOBALS['businessTheme']='pc/default';$GLOBALS['shellTheme']='mobile/cra1';
    $GLOBALS['plugins']=[['id'=>1,'name'=>'IdcsmartTicket','status'=>1],['id'=>2,'name'=>'IdcsmartCertification','status'=>1],['id'=>3,'name'=>'IdcsmartNews','status'=>1],['id'=>4,'name'=>'DisabledAddon','status'=>0]];
    $GLOBALS['hook']=null;$GLOBALS['safetyCalls']=0;$GLOBALS['safetyRedirect']=false;
    $view=new MobileNativeView();$view->request=new MobileNativeRequest();$view->request->params=['module'=>'mf_cloud','view_html'=>'product_detail','id'=>24];return $view;
}
$checks=[];
function checkMobile($ok,$label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks'][]=$label;}
$v=resetView();$body=$v->module();
checkMobile(count($v->renders)===3,'fallback renders selected header, original business view and selected footer once');
checkMobile($GLOBALS['filters']===['name'=>'MfCloud','status'=>1,'module'=>'server'],'only an enabled registered server module is adapted');
checkMobile($GLOBALS['alignment']==='','business fallback never forces the public shell to default');
checkMobile($v->renders[1]['data']['themes']==='pc/default'&&$v->renders[1]['data']['public_themes']==='mobile/cra1','business and public template identities stay independent');
checkMobile($v->renders[1]['data']['lang_home']==='zh-cn','native language context remains available');
checkMobile(strpos($body,'/theme.css?v=10.7.4')!==false&&strpos($body,'/module.js?v=10.7.4')!==false,'native static resource versioning remains intact');
checkMobile(strpos($body,'native-content')!==false&&substr_count($body,'<!--hooks-->')===1,'business HTML and append hooks are preserved');
checkMobile($GLOBALS['hook'][1]['module']==='mf_cloud'&&$GLOBALS['hook'][1]['client_id']===7,'module hook context retains identity and module');
foreach (['mobileOff','otherTheme','explicitDefault','missingBusiness','themeBusiness','disabledModule','invalidView','missingShell'] as $case) {
    $v=resetView();
    if($case==='mobileOff')$GLOBALS['mobile']=false;
    if($case==='otherTheme')$GLOBALS['mobileTheme']='mycra1';
    if($case==='explicitDefault')$v->request->params['theme_mobile']='default';
    if($case==='missingBusiness')$GLOBALS['businessExists']=false;
    if($case==='themeBusiness')$GLOBALS['businessTheme']='mobile/cra1';
    if($case==='disabledModule')$GLOBALS['moduleEnabled']=false;
    if($case==='invalidView')$v->request->params['view_html']='../product_detail';
    if($case==='missingShell')$GLOBALS['shellTheme']='mobile/default';
    checkMobile($v->module()==='native-module'&&count($v->renders)===0,$case.' delegates to the native controller without rendering another shell');
}
$v=resetView();$v->request->params=['plugin_id'=>1,'view_html'=>'ticket'];$body=$v->plugin();
checkMobile(count($v->renders)===3&&$GLOBALS['resolution'][0]==='addon','addon fallback also uses the selected shell');
checkMobile($GLOBALS['safetyCalls']===1&&$GLOBALS['hook'][1]['plugin_id']===1,'addon safety checks and append hook identifiers are retained');
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
echo json_encode(['status'=>'passed','checks'=>count($checks),'production_writes'=>0]),PHP_EOL;
}
