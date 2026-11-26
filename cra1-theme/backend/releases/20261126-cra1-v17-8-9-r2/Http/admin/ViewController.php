<?php
declare(strict_types=1);
namespace CRA1\Theme\Http\admin;

/** Retain native authentication, safety redirects and template dispatch. */
class ViewController extends \app\admin\controller\ViewController
{
    public function index()
    {
        $content = parent::index();
        if ($this->request->param('view_html') !== 'configuration_oss') return $content;
        $script = file_get_contents(CRA1_THEME_BACKEND.'/Compatibility/admin-pages.js');
        return preg_replace('~</body>~i', '<script>'.$script.'</script></body>', $content, 1);
    }
}
