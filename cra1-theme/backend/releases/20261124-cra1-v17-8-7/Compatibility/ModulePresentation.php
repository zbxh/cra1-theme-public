<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

use app\common\model\HostModel;
use app\common\model\ProductModel;
use app\common\model\UpstreamProductModel;
use CRA1\Theme\Files;
use CRA1\Theme\Security\NativeAuthorization;

/** Independent presentation choices for V10's installed server and reseller modules. */
final class ModulePresentation
{
    private const INTEGRATED = ['mf_cloud', 'mf_dcim', 'idcsmart_common', 'remf_cloud', 'remf_dcim', 'reidcsmart_common'];
    private string $file;

    public function __construct(string $root)
    {
        $this->file = $root.'/runtime/cra1_theme/module-presentation.json';
    }

    public static function key(string $kind, string $name): ?string
    {
        return in_array($kind, ['server', 'reserver'], true)
            && preg_match('/^[a-z][a-z0-9_]{0,99}$/D', $name)
            && !in_array($name, self::INTEGRATED, true) ? $kind.':'.$name : null;
    }

    private static function id($value): int
    {
        if (!is_string($value) && !is_int($value)) return 0;
        return (int)(filter_var($value, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]) ?: 0);
    }

    private static function module(int $productId, callable $local): ?string
    {
        // The native purchase and control-panel endpoints both prioritize only_api.
        $upstream = UpstreamProductModel::where('product_id', $productId)->where('mode', 'only_api')->find();
        return $upstream
            ? self::productKey('only_api', (string)$upstream['res_module'], '')
            : self::productKey('', '', (string)$local());
    }

    public static function productKey(string $mode, string $upstream, string $local): ?string
    {
        return $mode === 'only_api' ? self::key('reserver', $upstream) : self::key('server', $local);
    }

    public static function cart($id): ?string
    {
        $id = self::id($id);
        if (!$id) return null;
        $product = ProductModel::find($id);
        if (!$product || (int)$product['hidden'] === 1) return null;
        return self::module($id, [$product, 'getModule']);
    }

    public static function panel($id): ?string
    {
        $host = self::authorizedHost($id);
        return $host ? self::module((int)$host['product_id'], [$host, 'getModule']) : null;
    }

    private static function authorizedHost($id): ?HostModel
    {
        $id = self::id($id);
        if (!$id || (int)get_client_id(false) <= 0) return null;
        $owner = (int)get_client_id();
        if ($owner <= 0) return null;
        $host = HostModel::where('id', $id)->where('client_id', $owner)->where('is_delete', 0)->find();
        if (!$host || !NativeAuthorization::hostVisible($id)
            || !NativeAuthorization::allows('app\\home\\controller\\HostController::clientArea')) return null;
        return $host;
    }

    private function overrides(): array
    {
        $data = Files::json($this->file, true);
        return $data['modules'] ?? [];
    }

    public function mode(string $key, string $surface): string
    {
        try {
            return ($this->overrides()[$key][$surface] ?? '') === 'official' ? 'official' : 'cra1';
        } catch (\Throwable $error) {
            error_log('CRA1: module display settings could not be read');
            return 'cra1';
        }
    }

    public function listing(array $catalogue): array
    {
        $overrides = $this->overrides();
        $rows = [];
        foreach (['server'=>'modules', 'reserver'=>'res_modules'] as $kind=>$group) {
            foreach ($catalogue[$group] ?? [] as $module) {
                $name = (string)$module['name'];
                $key = self::key($kind, $name);
                if ($key === null) continue;
                $rows[] = ['key'=>$key, 'name'=>$name, 'label'=>$module['label'], 'kind'=>$kind,
                    'cart'=>$overrides[$key]['cart'] ?? 'cra1', 'panel'=>$overrides[$key]['panel'] ?? 'cra1'];
            }
        }
        return ['modules'=>$rows];
    }

    public function save(array $catalogue, array $input): array
    {
        $key = $input['key'] ?? null;
        $known = array_column($this->listing($catalogue)['modules'], 'key');
        if (!in_array($key, $known, true)) throw new \InvalidArgumentException('请重新读取已安装模块');
        $choices = [];
        foreach (['cart', 'panel'] as $surface) {
            $choice = $input[$surface] ?? null;
            if (!in_array($choice, ['cra1', 'official'], true)) throw new \InvalidArgumentException('请选择有效的页面显示方式');
            if ($choice === 'official') $choices[$surface] = $choice;
        }
        return Files::locked($this->file.'.lock', function () use ($catalogue, $input, $key, $choices): array {
            $overrides = $this->overrides();
            $previous = $overrides[$key] ?? [];
            foreach (['cart', 'panel'] as $surface) {
                if (($input['previous'][$surface] ?? null) !== ($previous[$surface] ?? 'cra1')) {
                    throw new \InvalidArgumentException('此模块的显示设置已被修改，请重新读取后保存');
                }
            }
            if ($choices !== $previous) {
                if ($choices) $overrides[$key] = $choices;
                else unset($overrides[$key]);
                Files::putJson($this->file, ['modules'=>$overrides], 0600);
            }
            return $this->listing($catalogue);
        });
    }

    public function verification(array $catalogue, array $input, callable $directory): array
    {
        $key = $input['key'] ?? null;
        $rows = array_column($this->listing($catalogue)['modules'], null, 'key');
        if (!is_string($key) || !isset($rows[$key])) throw new \InvalidArgumentException('请重新读取已安装模块');
        $search = $input['search'] ?? '';
        if (!is_string($search) || strlen($search) > 240) throw new \InvalidArgumentException('请输入有效的查询条件');
        $page = max(1, (int)($input['page'] ?? 1));
        $module = $rows[$key];
        $products = $directory($module, trim($search), $page);
        return ['module'=>$module] + $products;
    }

    /** Only a member authorized for this host can use the result. */
    public static function checkPanel(string $expected, $id): ?bool
    {
        if (!preg_match('/^(server|reserver):([a-z][a-z0-9_]{0,99})$/D', $expected, $match)
            || self::key($match[1], $match[2]) === null) return null;
        $host = self::authorizedHost($id);
        return $host ? self::module((int)$host['product_id'], [$host, 'getModule']) === $expected : null;
    }

    public static function verificationNotice(string $html, string $message): string
    {
        $end = strripos($html, '</body>');
        if ($end === false) return $html;
        $notice = '<details open style="position:fixed;z-index:2147480000;bottom:12px;right:12px;max-width:min(360px,calc(100vw - 24px));padding:10px 14px;border-radius:8px;border:1px solid #d0d6d8;background:#fff;color:#22292b;font:14px/1.5 system-ui;box-shadow:0 4px 18px #161b1d22">'
            .'<summary style="cursor:pointer">模块快速验证</summary><p role="status" style="margin:5px 0 0">'
            .htmlspecialchars($message, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8').'</p></details>';
        return substr_replace($html,$notice,$end,0);
    }
}
