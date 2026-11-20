<?php
declare(strict_types=1);
namespace CRA1\Theme\Presentation;

/** Theme-owned paths: no dependency on additions to V10's template resolver. */
final class ClientareaTemplates
{
    public function validName($name): bool
    {
        return is_string($name) && preg_match('/^[A-Za-z0-9_-]+$/D', $name) === 1;
    }

    public function normalizeName($name, string $fallback = 'default'): string
    {
        return $this->validName($name) ? $name : ($this->validName($fallback) ? $fallback : 'default');
    }

    /** Keep V10's mobile → mobile default → PC → PC default order. */
    private function levels(bool $mobile, string $pc, string $phone): array
    {
        $pc = $this->normalizeName($pc);
        $phone = $this->normalizeName($phone);
        return array_values(array_unique($mobile
            ? ['mobile/'.$phone, 'mobile/default', 'pc/'.$pc, 'pc/default']
            : ['pc/'.$pc, 'pc/default']));
    }

    public function resolveBusinessTemplate(string $type, string $name, string $view, bool $mobile, string $pc, string $phone): array
    {
        if (!in_array($type, ['addon', 'server'], true) || !$this->validName($name) || !$this->validName($view)) return [];
        $root = rtrim(IDCSMART_ROOT, '/').'/public/plugins/'.$type.'/'.$name.'/template/clientarea/';
        foreach ($this->levels($mobile, $pc, $phone) as $theme) {
            $base = $root.$theme.'/';
            if (is_file($base.$view.'.html')) return [
                'themes'=>$theme, 'template_file'=>$base.$view.'.html', 'resolved_view_path'=>$base,
            ];
        }
        return [];
    }

    /** The surrounding shell follows the selected theme, independently of the business fallback. */
    public function resolvePublicShell(bool $mobile, string $pc, string $phone): array
    {
        $root = rtrim(IDCSMART_ROOT, '/').'/public/clientarea/template/';
        foreach ($this->levels($mobile, $pc, $phone) as $theme) {
            $base = $root.$theme.'/';
            if (is_file($base.'header.php') && is_file($base.'footer.php')) return [
                'themes'=>$theme, 'header_file'=>$base.'header.php', 'footer_file'=>$base.'footer.php', 'resolved_view_path'=>$base,
            ];
        }
        return [];
    }
}
