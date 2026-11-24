<?php
declare(strict_types=1);
namespace CRA1\Theme\Http\home;

use CRA1\Theme\Compatibility\ModulePresentation;
use CRA1\Theme\Context;
use CRA1\Theme\Presentation\ClientareaTemplates;
use CRA1\Theme\Presentation\OfficialCart;

/** Keep the native dispatch, initialization, permissions and unknown-page fallback. */
class ViewClientController extends \app\home\controller\ViewClientController
{
    public function index()
    {
        $params = $this->request->param();
        $expected = $params['cra1_verify_module'] ?? null;
        if (($params['view_html'] ?? '') !== 'productdetail' || !is_string($expected) || get_client_id(false) <= 0) return parent::index();
        header('Cache-Control: private, no-store');
        try {
            $matches = ModulePresentation::checkPanel($expected, $params['id'] ?? null);
        } catch (\Throwable $error) {
            $matches = null;
        }
        if ($matches !== true) {
            return response($matches === false ? '模块快速验证：所选实例不属于待验证模块。请核对实例编号。'
                : '模块快速验证：该实例不可访问。请登录有权查看此实例的测试会员账号。', $matches === false ? 400 : 404)
                ->contentType('text/plain', 'utf-8');
        }
        $html = parent::index();
        if (!is_string($html)) return $html;
        $message = !OfficialCart::handlesPanel() ? '实例模块匹配。当前页面使用 V10 默认加载流程，未进入酷锐A1的模块展示适配。'
            : (OfficialCart::panelUsesCRA1() ? '实例模块匹配。实际显示酷锐A1导航与官方控制面板。'
                : '实例模块匹配。实际显示完整官方控制面板。');
        return ModulePresentation::verificationNotice($html, $message);
    }

    public function module()
    {
        $params=$this->request->param();
        $theme=(string)($params['theme']??(cookie('clientarea_theme')?:configuration('clientarea_theme')));
        if (use_mobile()) $theme=(string)($params['theme_mobile']??(cookie('clientarea_theme_mobile')?:configuration('clientarea_theme_mobile')));
        // Native detail scripts require a concrete host. Keep an incomplete
        // bookmark actionable rather than rendering an empty, unusable panel.
        if (\CRA1\Theme\Context::isCRA1($theme) && ($params['view_html']??'')==='product_detail'
            && (!is_scalar($params['id']??null) || !preg_match('~^[1-9][0-9]*$~D',(string)$params['id']))) return redirect('/productList.htm');
        if (($params['view_html'] ?? '') === 'product_detail' && is_string($params['module'] ?? null)) {
            $panel = $this->nativeModulePanel($params);
            if ($panel !== null) return $panel;
        }
        if (use_mobile() && \CRA1\Theme\Context::isCRA1($theme) && is_string($params['module']??null)) {
            $module=\app\admin\model\PluginModel::where('name',parse_name($params['module'],1))->where('status',1)->where('module','server')->find();
            if ($module) {
                $content=$this->mobileFallbackPage('server',parse_name((string)$module['name']),(string)($params['view_html']??'index'),$params);
                if ($content!==null) return $content;
            }
        }
        return parent::module();
    }

    private function nativeModulePanel(array $params): ?string
    {
        $mobile = use_mobile();
        $pc = (string)($params['theme'] ?? (cookie('clientarea_theme') ?: configuration('clientarea_theme')));
        $phone = (string)($params['theme_mobile'] ?? (cookie('clientarea_theme_mobile') ?: configuration('clientarea_theme_mobile')));
        $shell = (new ClientareaTemplates())->resolvePublicShell($mobile, $pc, $phone);
        if (!Context::isCRA1($shell['themes'] ?? '')) return null;
        try {
            $module = parse_name($params['module']);
            $key = ModulePresentation::key('server', $module);
            if ($key === null || $key !== ModulePresentation::panel($params['id'] ?? null)) return null;
            $plugins = new \app\admin\model\PluginModel();
            if (!$plugins->where('name', parse_name($module, 1))->where('status', 1)->where('module', 'server')->find()) return null;
            $mode = (new ModulePresentation(CRA1_THEME_ROOT))->mode($key, 'panel');
            $data = assign_clientarea_lang_config([
                'addons'=>$plugins->plugins('addon')['list'],
                'system_version'=>configuration('system_version'),
                'clientarea_theme_color'=>configuration('clientarea_theme_color') ?? 'default',
            ]);
            $html = OfficialCart::directPanel($data, $module, $mobile, $mode === 'cra1');
        } catch (\Throwable $error) {
            error_log('CRA1: using the standard module controller for detail');
            return null;
        }
        if ($html === null) return null;
        header('Cache-Control: private, no-store');
        return $this->applyViewAppendHook('clientarea_view_append', [
            'page_type'=>'clientarea_module', 'view_html'=>'product_detail', 'module'=>$module,
            'themes'=>$shell['themes'], 'client_id'=>get_client_id(false),
        ], $html);
    }

    public function plugin()
    {
        $params=$this->request->param();
        $pc=(string)($params['theme']??(cookie('clientarea_theme')?:configuration('clientarea_theme')));
        $mobile=(string)($params['theme_mobile']??(cookie('clientarea_theme_mobile')?:configuration('clientarea_theme_mobile')));
        if (!\CRA1\Theme\Context::isCRA1(use_mobile() ? $mobile : $pc)) return parent::plugin();
        $id=(int)($params['plugin_id']??0);
        $plugins=(new \app\admin\model\PluginModel())->plugins('addon')['list']??[];
        $plugin=null;
        foreach ($plugins as $row) if ((int)$row['id']===$id && (int)($row['status']??1)===1) {$plugin=$row;break;}
        if (!$plugin) return parent::plugin();
        $name=(string)$plugin['name'];$view=(string)($params['view_html']??'index');
        $redirect=\CRA1\Theme\Compatibility\PluginPages::redirect($name,$view,$params,$id);
        if ($redirect!=='') return redirect($redirect);
        // Older announcement packages store templates directly under clientarea,
        // and their scripts read /news. Render the theme's announcement consumer.
        if ($name!=='IdcsmartAnnouncement' || !in_array($view,['source','news_detail'],true)) {
            $content=$this->mobileFallbackPage('addon',parse_name($name),$view,$params,$plugins);
            return $content!==null?$content:parent::plugin();
        }
        $check=check_home_enforce_safe_method_redirect();
        if (!empty($check['redirect'])) return redirect($check['url']);
        if (isset($params['theme'])) cookie('clientarea_theme',$pc);
        if (isset($params['theme_mobile'])) cookie('clientarea_theme_mobile',$mobile);
        $data=assign_clientarea_lang_config([
            'title'=>'公告中心','description'=>'','template_catalog'=>'clientarea',
            'themes'=>'pc/cra1','public_themes'=>'pc/cra1','addons'=>$plugins,
            'system_version'=>configuration('system_version'),
            'clientarea_theme_color'=>configuration('clientarea_theme_color')?:'default',
            'cra1_plugin_id'=>$id,
        ]);
        $base=IDCSMART_ROOT.'public/clientarea/template/pc/cra1/';
        $content=$this->renderCRA1($base.'header.php',$base,'php',$data)
            .$this->renderCRA1(CRA1_THEME_BACKEND.'/Views/announcement.html',CRA1_THEME_BACKEND.'/Views/','html',$data)
            .$this->renderCRA1($base.'footer.php',$base,'php',$data);
        return $this->applyViewAppendHook('clientarea_view_append',[
            'page_type'=>'clientarea_plugin','view_html'=>$view,'plugin'=>'idcsmart_announcement',
            'plugin_id'=>$id,'themes'=>'pc/cra1','client_id'=>get_client_id(false),
        ],$content);
    }

    /** Separate the selected shell from a plugin's fallback business template. */
    private function mobileFallbackPage(string $type,string $name,string $view,array $params,?array $plugins=null)
    {
        if (!use_mobile()) return null;
        $pc=(string)($params['theme']??(cookie('clientarea_theme')?:configuration('clientarea_theme')));
        $mobile=(string)($params['theme_mobile']??(cookie('clientarea_theme_mobile')?:configuration('clientarea_theme_mobile')));
        if (!\CRA1\Theme\Context::isCRA1($mobile)) return null;
        $logic=new \CRA1\Theme\Presentation\ClientareaTemplates();
        if (!$logic->validName($view)) return null;
        $pc=$logic->normalizeName($pc,(string)configuration('clientarea_theme'));
        $mobile=$logic->normalizeName($mobile,(string)configuration('clientarea_theme_mobile'));
        $business=$logic->resolveBusinessTemplate($type,$name,$view,true,$pc,$mobile);
        // Resolve native mobile and PC fallbacks alike; older V10 controllers
        // cannot render a PC-only module template from a mobile request.
        if (empty($business['template_file'])) return null;
        $shell=$logic->resolvePublicShell(true,$pc,$mobile);
        if (empty($shell['header_file']) || empty($shell['footer_file']) || !\CRA1\Theme\Context::isCRA1((string)$shell['themes'])) return null;
        if ($type==='addon' && $name!=='idcsmart_certification') {
            $check=check_home_enforce_safe_method_redirect();
            if (!empty($check['redirect'])) return redirect($check['url']);
        }
        if (isset($params['theme']) && $logic->validName($params['theme'])) cookie('clientarea_theme',$pc);
        if (isset($params['theme_mobile']) && $logic->validName($params['theme_mobile'])) cookie('clientarea_theme_mobile',$mobile);
        $plugins=$plugins??((new \app\admin\model\PluginModel())->plugins('addon')['list']??[]);
        $news='';
        if ($type==='addon' && $name==='idcsmart_news') $news=(string)((new \addon\idcsmart_news\model\IdcsmartNewsModel())->where('id',$params['id']??0)->value('content')??'');
        $data=assign_clientarea_lang_config([
            'template_catalog'=>'clientarea','themes'=>$business['themes'],'public_themes'=>$shell['themes'],
            'addons'=>$plugins,'system_version'=>configuration('system_version'),
            'clientarea_theme_color'=>configuration('clientarea_theme_color')?:'default','news_template_seo'=>$news,
        ]);
        $content=$this->renderCRA1($shell['header_file'],$shell['resolved_view_path'],'php',$data)
            .$this->renderCRA1($business['template_file'],$business['resolved_view_path'],'html',$data)
            .$this->renderCRA1($shell['footer_file'],$shell['resolved_view_path'],'php',$data);
        $version='?v='.configuration('system_version');
        foreach (['~<link\s+[^>]*?href="([^"]+\.css)"[^>]*>~i','~<script\s+[^>]*?src="([^"]+\.js)"[^>]*>~i'] as $pattern) {
            $content=preg_replace_callback($pattern,static function(array $match) use($version): string {return str_replace($match[1],$match[1].$version,$match[0]);},$content);
        }
        $hook=['page_type'=>$type==='server'?'clientarea_module':'clientarea_plugin','view_html'=>$view,
            'themes'=>$business['themes'],'public_themes'=>$shell['themes'],'client_id'=>get_client_id(false)];
        if ($type==='server') $hook['module']=$name;
        else {$hook['plugin']=$name;$hook['plugin_id']=(int)($params['plugin_id']??0);}
        return $this->applyViewAppendHook('clientarea_view_append',$hook,$content);
    }

    protected function renderCRA1(string $file,string $base,string $suffix,array $data): string
    {
        $tpl=new \think\Template(['compile_type'=>\CRA1\Theme\Presentation\TemplateCache::class]);
        $tpl->config(['view_path'=>$base,'view_suffix'=>$suffix,'cache_path'=>runtime_path().'cra1-plugin-views/']);
        ob_start();
        try {$tpl->fetch($file,$data);return (string)ob_get_clean();}
        catch (\Throwable $e) {ob_end_clean();throw $e;}
    }
}
