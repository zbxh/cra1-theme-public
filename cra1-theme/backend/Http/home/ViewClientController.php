<?php
declare(strict_types=1);
namespace CRA1\Theme\Http\home;

/** Keep the native dispatch, initialization, permissions and unknown-page fallback. */
class ViewClientController extends \app\home\controller\ViewClientController
{
    public function plugin()
    {
        $params=$this->request->param();
        $pc=(string)($params['theme']??(cookie('clientarea_theme')?:configuration('clientarea_theme')));
        $mobile=(string)($params['theme_mobile']??(cookie('clientarea_theme_mobile')?:configuration('clientarea_theme_mobile')));
        if (!\CRA1\Theme\Context::isCRA1($pc) || (use_mobile() && $mobile!=='' && $mobile!=='default' && !\CRA1\Theme\Context::isCRA1($mobile))) return parent::plugin();
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
        if ($name!=='IdcsmartAnnouncement' || !in_array($view,['source','news_detail'],true)) return parent::plugin();
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

    private function renderCRA1(string $file,string $base,string $suffix,array $data): string
    {
        $tpl=new \think\Template();
        $tpl->config(['view_path'=>$base,'view_suffix'=>$suffix,'cache_path'=>runtime_path().'cra1-plugin-views/']);
        ob_start();
        try {$tpl->fetch($file,$data);return (string)ob_get_clean();}
        catch (\Throwable $e) {ob_end_clean();throw $e;}
    }
}
