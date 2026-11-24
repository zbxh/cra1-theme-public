<?php
declare(strict_types=1);
namespace CRA1\Theme\Http\home;

use CRA1\Theme\Compatibility\ModulePresentation;
use CRA1\Theme\Context;
use CRA1\Theme\Presentation\ClientareaTemplates;
use CRA1\Theme\Presentation\OfficialCart;

/** Limit the adapter to third-party configuration pages under the CRA1 cart theme. */
class ViewCartController extends \app\home\controller\ViewCartController
{
    public function index()
    {
        $params = $this->request->param();
        if (($params['view_html'] ?? '') !== 'goods') return parent::index();
        $mobile = use_mobile();
        $templates = new ClientareaTemplates();
        $phone = $templates->normalizeName(
            $params['theme_mobile'] ?? (cookie('cart_theme_mobile') ?: configuration('cart_theme_mobile')),
            (string)configuration('cart_theme_mobile')
        );
        $theme = $templates->cartTheme('goods', $mobile, (string)configuration('cart_theme'), $phone);
        if (!Context::isCRA1($theme)) return parent::index();

        try {
            $key = ModulePresentation::cart($params['id'] ?? $params['product_id'] ?? null);
            if ($key === null) return parent::index();
            $mode = (new ModulePresentation(CRA1_THEME_ROOT))->mode($key, 'cart');
            $data = assign_clientarea_lang_config([
                'title'=>'首页-智简魔方',
                'addons'=>(new \app\admin\model\PluginModel())->plugins('addon')['list'],
                'system_version'=>configuration('system_version'),
                'clientarea_theme_color'=>configuration('clientarea_theme_color') ?? 'default',
            ]);
            $content = OfficialCart::cartDocument($data, $mobile, $mode === 'cra1');
        } catch (\Throwable $error) {
            error_log('CRA1: using the standard cart controller for module configuration');
            $content = null;
        }
        if ($content === null) return parent::index();
        $expected = $params['cra1_verify_module'] ?? null;
        if (is_string($expected) && $expected === $key) {
            $content = ModulePresentation::verificationNotice($content, OfficialCart::fullOfficialCart()
                ? '商品模块匹配。实际显示完整官方购物车选配页。'
                : '商品模块匹配。实际显示酷锐A1导航与官方选配区。');
        }
        header('Cache-Control: no-cache');
        return $this->applyViewAppendHook('cart_view_append', [
            'page_type'=>'cart', 'view_html'=>'goods', 'cart_theme'=>$theme,
            'client_id'=>get_client_id(false),
        ], $content);
    }
}
