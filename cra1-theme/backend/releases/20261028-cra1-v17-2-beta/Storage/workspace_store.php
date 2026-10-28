<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;
use PDO;
use CRA1ThemeSecurity;
use stdClass;
use Throwable;
use RuntimeException;
use InvalidArgumentException;
use DOMDocument;
use DOMElement;
use DOMComment;
use DOMProcessingInstruction;
use DOMText;
use DOMNode;
use CRA1ThemePublicProjection;

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

/** Logical scope fingerprints deliberately exclude unrelated domain changes. */
function theme_workspace_revision(array $values): string
{
    $canonical = function ($v) use (&$canonical) {
        if (is_object($v)) $v = (array) $v;
        if (!is_array($v)) return $v;
        if ($v && array_keys($v) !== range(0, count($v) - 1)) ksort($v);
        foreach ($v as $k => $x) $v[$k] = $canonical($x);
        return $v;
    };
    return substr(hash('sha256', (string) json_encode($canonical($values), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)), 0, 24);
}

require_once __DIR__ . '/editor_store.php';
final class ThemeWorkspaceStore
{
    use ThemeEditorStore;
    private string $root;
    private string $configFile;
    private array $catalog;
    private MemberCenterStore $member;
    private CartThemeStore $cart;
    private ?string $siteName = null;

    public function __construct(string $root, ?string $schemaFile = null)
    {
        $this->root = rtrim($root, '/');
        $this->configFile = $this->root . '/runtime/cra1_theme/config.json';
        $this->member = new MemberCenterStore($this->root . '/runtime');
        $this->cart = new CartThemeStore($this->root . '/runtime');
        $this->catalog = self::readJson($schemaFile ?? __DIR__ . '/workspace_schema.json', false);
    }

    public static function readJson(string $file, bool $missingAllowed = true): array
    {
        if (!is_file($file)) {
            if ($missingAllowed) return [];
            throw new RuntimeException('配置注册表缺失，请检查发布文件');
        }
        $data = json_decode((string) file_get_contents($file), true);
        if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('配置 JSON 损坏，操作已中止，原文件保留');
        }
        return $data;
    }

    public function catalog(): array { return $this->catalog; }

    /** Legacy forms keep their existing payloads while preserving explicit page rules. */
    public function applyLegacyPatch(array $raw, array $patch): array
    {
        if (array_key_exists('header_support_json', $patch)) $patch['header_support_json'] = cra1_support_normalize_json($patch['header_support_json']);
        $cfg=$this->resolved($raw);foreach($patch as $key=>$value)$this->validateIconField((string)$key,(string)$value,(string)($cfg[$key]??''));
        $next = array_replace($raw, $patch);
        // An explicit full reset owns the new policy document too.
        if (array_key_exists('page_module_visibility_json', $patch)) return $next;
        $doc = null;
        foreach ($patch as $key => $value) {
            if (strpos((string) $key, 'show_') !== 0) continue;
            foreach ($this->catalog['assignments'][$key] ?? [] as $scopeId) {
                $scope = $this->catalog['scopes'][$scopeId];
                if ($scope['kind'] === 'shared') {
                    foreach ($scope['fields'] as $field) {
                        if ($field['key'] !== $key || $field['adapter'] !== 'visibility-default') continue;
                        if ($doc === null) $doc = $this->migratedVisibility($raw);
                        $doc['defaults'][$field['moduleId']] = (string) $value === '1';
                    }
                } elseif ($scope['kind'] === 'layout') {
                    foreach ($this->catalog['pages'][$scope['pageKey']]['modules'] as $module) {
                        if ($module['visibilityKey'] !== $key) continue;
                        if ($doc === null) $doc = $this->migratedVisibility($raw);
                        if ($value === '' || $value === null) unset($doc['pages'][$scope['pageKey']][$module['id']]);
                        else $doc['pages'][$scope['pageKey']][$module['id']] = (string) $value === '1';
                    }
                }
            }
        }
        if ($doc !== null) $next['page_module_visibility_json'] = $this->encode($doc);
        return $next;
    }

    private function seoResolve(string $page, array $config, array $pages): array
    {
        if ($this->siteName === null) {
            $this->siteName = '';
            // Standalone admin uses the same read-only site setting as the front end.
            if (is_file($this->root . '/config.php')) {
                require_once $this->root . '/config.php';
                if (defined('DATABASE_HOSTNAME') && defined('DATABASE_NAME')) {
                    try {
                        $pdo = new PDO('mysql:host=' . DATABASE_HOSTNAME . ';port=' . DATABASE_PORT . ';dbname=' . DATABASE_NAME . ';charset=' . DATABASE_CHARSET,
                            DATABASE_USERNAME, DATABASE_PASSWORD, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]);
                        $this->siteName = (string) (\CRA1\Theme\Compatibility\Database::query($pdo,"SELECT value FROM idcsmart_configuration WHERE setting='website_name' LIMIT 1")->fetchColumn() ?: '');
                    } catch (Throwable $e) { /* Explicit global suffix remains usable while the system database is unavailable. */ }
                }
            }
        }
        return cra1_seo_resolve_page($page, $config, $pages, $this->siteName);
    }

    private function scope(string $domain, string $id): array
    {
        $scope = $this->catalog['scopes'][$id] ?? null;
        if (!is_array($scope) || $scope['domain'] !== $domain) throw new InvalidArgumentException('未知的配置范围');
        return $scope;
    }

    private function resolved(array $raw): array
    {
        $legacy = self::readJson($this->root . '/public/web/cra1/controller/storage.json');
        $saved = array_merge($legacy, $raw);
        $out = \template\cra1\controller\Cra1::defaults();
        foreach ($saved as $key => $value) {
            if ($value !== '' && $value !== null) $out[$key] = $value;
        }
        $out['_theme_saved_fields'] = array_keys(array_filter($saved, static function($v){return $v !== '' && $v !== null;}));
        $public = json_decode((string)($saved['public_content_explicit_json'] ?? ''), true);
        $out['_public_explicit_fields'] = is_array($public) ? array_keys($public) : [];
        foreach ($out['_public_explicit_fields'] as $key) if (array_key_exists($key, $saved)) $out[$key] = $saved[$key];
        // Industry rows were historically derived from four fixed cards.
        foreach ($this->catalog['pages'] as $pk => $p) {
            $pk = (string) $pk;
            if (strpos($pk, 'solution/') !== 0) continue;
            $industry = substr($pk, 9);
            $key = 'sol_ind_' . $industry . '_highlights_text';
            if (trim((string) ($out[$key] ?? '')) !== '') continue;
            $rows = [];
            for ($i = 1; $i <= 4; $i++) {
                $prefix = 'sol_ind_' . $industry . '_c' . $i;
                if (!empty($out[$prefix . '_title'])) $rows[] = $out[$prefix . '_title'] . '|' . ($out[$prefix . '_desc'] ?? '');
            }
            $out[$key] = implode("\n", $rows);
        }
        return $out;
    }

    private function visibilityRaw(array $raw): array
    {
        return array_merge($raw, self::readJson($this->root . '/public/web/cra1/controller/storage.json'));
    }

    private function document(array $raw, string $key): array
    {
        $text = (string) ($raw[$key] ?? '');
        if ($text === '') return [];
        $doc = json_decode($text, true);
        if (!is_array($doc) || json_last_error() !== JSON_ERROR_NONE) throw new RuntimeException('布局 / SEO 数据损坏，操作已中止，原配置保留');
        return $doc;
    }

    private function rowPage(string $line): string
    {
        $line = ltrim($line);
        $line = ltrim($line, '!>');
        return trim(explode('|', $line, 2)[0]);
    }

    private function ownedLine(string $line, string $adapter, ?string $page): bool
    {
        $target = $this->rowPage($line);
        if ($adapter === 'page-rows') return $target === $page;
        return $target === '' || $target === '*' || preg_match('/[,，\s]/u', $target) === 1;
    }

    private function validateIconField(string $key,string $value,string $old): void {
        if($key==='header_support_json'&&$value!==$old){$doc=json_decode($value,true);$previous=json_decode($old,true);$list=[];foreach($doc['groups']??[] as $g)$list=array_merge($list,$g['items']??[]);$oldList=[];foreach($previous['groups']??[] as $g)$oldList=array_merge($oldList,$g['items']??[]);cra1_icons_validate_nodes($list,$oldList,'website');}
        $f=$this->catalog['fields'][$key]??[];
        foreach($f['cols']??[] as $i=>$c)if(($c['type']??'')==='icon')cra1_icons_validate_row_text($value,$old,$i);
        if(($f['type']??'')==='icon')cra1_icon_validate_change($value,$old);
    }

    private function rows(string $text, string $adapter, ?string $page): string
    {
        return implode("\n", array_values(array_filter(preg_split('/\r?\n/', $text), function ($line) use ($adapter, $page) {
            return trim($line) !== '' && $this->ownedLine($line, $adapter, $page);
        })));
    }

    /** Merge just owned lines; untouched legacy rows retain bytes and relative order. */
    private function mergeRows(string $current, string $patch, string $adapter, ?string $page): string
    {
        $new = array_values(array_filter(preg_split('/\r?\n/', $patch), static function ($l) { return trim($l) !== ''; }));
        foreach ($new as $line) {
            if (!$this->ownedLine($line, $adapter, $page)) throw new InvalidArgumentException('条目包含当前范围以外的页面');
        }
        $out = []; $inserted = false;
        foreach (preg_split('/\r?\n/', $current) as $line) {
            if ($this->ownedLine($line, $adapter, $page) && trim($line) !== '') {
                if (!$inserted) { $out = array_merge($out, $new); $inserted = true; }
            } else { $out[] = $line; }
        }
        if (!$inserted) {
            // Single-value parsers use first match: a new page row precedes the shared fallback.
            $out = $adapter === 'page-rows' ? array_merge($new, $out) : array_merge($out, $new);
        }
        return trim(implode("\n", $out), "\r\n");
    }

    private function publicDefault(array $raw, array $resolved, string $mid, string $key): bool
    {
        $doc = $this->document($raw, 'page_module_visibility_json');
        if (array_key_exists($mid, $doc['defaults'] ?? [])) return $doc['defaults'][$mid] === true;
        $legacy = $this->visibilityRaw($raw);
        if (isset($legacy[$key]) && $legacy[$key] !== '') return (string) $legacy[$key] === '1';
        return isset(cra1_shared_module_keys()[$mid]) ? true : (string) ($resolved[$key] ?? '') === '1';
    }

    public function project(array $scope, array $raw): array
    {
        if ($scope['domain'] !== 'website') {
            if ($scope['kind'] === 'custom-code') return ['custom_code' => $raw['custom_code'] ?? ['css'=>'','js'=>'','css_enabled'=>true,'js_enabled'=>true]];
            if ($scope['kind'] === 'member-appearance') return ['appearance' => $raw['appearance']];
            if ($scope['kind'] === 'member-sidebar') return ['sidebar' => $this->member->sidebarForEditor($raw['sidebar'])];
            $content = [];
            foreach ($scope['keys'] as $key) $content[$key] = $raw['content'][$key] ?? [];
            if ($scope['domain']==='member' && isset($content['product_list']['default'])) {
                if($content['product_list']['default']['title']==='')$content['product_list']['default']['title']='我的产品';
                if($content['product_list']['default']['description']==='')$content['product_list']['default']['description']='查看与管理已开通的产品与服务';
            }
            if ($scope['domain']==='cart') {
                $fallbacks=['goodslist'=>['copy'=>['title'=>'订购产品','tabs_title'=>'选配方式']],
                    'shoppingcar'=>['empty'=>['title'=>'暂无商品']],
                    'settlement'=>['copy'=>['title'=>'请核对商品信息','agree_text'=>'已阅读并同意']],
                    'orderresult'=>['copy'=>['success_title'=>'订单已支付','cancel_title'=>'订单提交成功，请尽快付款！','pending_title'=>'订单提交成功，请尽快付款！订单号']]];
                foreach($content as$key=>&$block)foreach($fallbacks[$key]??[] as$part=>$values)foreach($values as$field=>$fallback)if(($block[$part][$field]??'')==='')$block[$part][$field]=$fallback;
                unset($block);
            }
            return ['content' => $content];
        }
        $resolved = $this->resolved($raw);
        if ($scope['kind'] === 'layout') {
            $pk = $scope['pageKey']; $doc = $this->document($raw, 'page_module_orders_json');
            $doc['pages'] = $doc['pages'] ?? [];
            $visibility = $this->document($raw, 'page_module_visibility_json');
            $states = [];
            foreach ($this->catalog['pages'][$pk]['modules'] as $module) {
                if (!$module['visibilityKey']) continue;
                $value = $visibility['pages'][$pk][$module['id']] ?? null;
                $states[$module['id']] = $value === null ? 'inherit' : ($value ? 'show' : 'hide');
            }
            return ['order' => cra1_page_module_order($pk, $doc),
                'inheritOrder' => !isset($doc['pageOverrides'][$pk]), 'visibility' => $states];
        }
        if ($scope['kind'] === 'seo') {
            $doc = $this->document($raw, 'seo_page_meta_json');
            $value = $doc['pages'][$scope['pageKey']] ?? [];
            return ['title' => (string) ($value['title'] ?? ''), 'desc' => (string) ($value['desc'] ?? ''),
                'kw' => (string) ($value['kw'] ?? ''), 'noindex' => !empty($value['noindex']) || $scope['pageKey'] === '404'];
        }
        $out = [];
        foreach ($scope['fields'] as $f) {
            foreach ($f['keys'] as $key) {
                $value = $resolved[$key] ?? '';
                if ($key === 'header_support_json') $value = json_encode(cra1_support_document($resolved, true), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if (($f['visual']['widget'] ?? '') === 'copy') $value = cra1_copy_editor_text('public', substr($key,5,-5), $resolved);
                if (in_array($f['adapter'], ['page-rows','shared-rows'], true)) $value = $this->rows((string) $value, $f['adapter'], $f['boundPage'] ?? null);
                if ($f['adapter'] === 'visibility-default') $value = $this->publicDefault($raw, $resolved, $f['moduleId'], $key) ? '1' : '0';
                $out[$key] = $value;
            }
        }
        if ($scope['kind'] === 'shared') {
            $doc = $this->document($raw, 'page_module_visibility_json'); $states = [];
            foreach ($scope['affectedPageKeys'] as $pk) {
                if (cra1_module_visibility_key($pk, $scope['moduleId']) === null) continue;
                $v = $doc['pages'][$pk][$scope['moduleId']] ?? null;
                $states[$pk] = $v === null ? 'inherit' : ($v ? 'show' : 'hide');
            }
            if ($states) $out['pageVisibility'] = $states;
        }
        return $out;
    }

    private function payload(array $scope, array $raw): array
    {
        $values = $this->project($scope, $raw);
        $out = ['scopeId' => $scope['id'], 'values' => $values, 'revision' => theme_workspace_revision($values),
            'version' => $raw['version'] ?? null, 'scope' => $scope, 'resolved' => [], 'sources' => []];
        if ($scope['domain'] !== 'website') return $out;
        $cfg = $this->resolved($raw);
        if ($scope['kind'] === 'global-seo') {
            $seoDoc = $this->document($raw, 'seo_page_meta_json');
            foreach ($this->catalog['pages'] as $pk => $page) {
                $out['resolved']['pageSeo'][(string) $pk] = $this->seoResolve((string) $pk, $cfg, $seoDoc['pages'] ?? []);
            }
        }
        if (isset($scope['pageKey'])) {
            $pk = $scope['pageKey'];
            $seoDoc = $this->document($raw, 'seo_page_meta_json');
            $out['resolved']['seo'] = $this->seoResolve($pk, $cfg, $seoDoc['pages'] ?? []);
            unset($seoDoc['pages'][$pk]);
            $out['resolved']['seoDefault'] = $this->seoResolve($pk, $cfg, $seoDoc['pages'] ?? []);
            $layoutDoc = $this->document($raw, 'page_module_orders_json');
            unset($layoutDoc['pageOverrides'][$pk]);
            $layoutDoc['pages'] = $layoutDoc['pages'] ?? [];
            $out['resolved']['inheritedOrder'] = cra1_page_module_order($pk, $layoutDoc);
            foreach ($this->catalog['pages'][$pk]['modules'] as $m) {
                $out['resolved']['visibility'][$m['id']] = cra1_module_visible($m['id'], $pk, $cfg, $this->visibilityRaw($raw));
                $visibleDoc = $this->document($raw, 'page_module_visibility_json');
                unset($visibleDoc['pages'][$pk][$m['id']]);
                $inheritedRaw = $this->visibilityRaw($raw);
                $inheritedRaw['page_module_visibility_json'] = $this->encode($visibleDoc);
                $out['resolved']['inheritedVisibility'][$m['id']] = cra1_module_visible($m['id'], $pk, $cfg, $inheritedRaw);
            }
        }
        foreach ($scope['fields'] as $f) {
            if ($f['adapter'] === 'page-rows') {
                $shared = $this->rows((string) ($cfg[$f['key']] ?? ''), 'shared-rows', null);
                $shared = implode("\n", array_filter(explode("\n", $shared), function ($line) use ($scope) {
                    return strpos(ltrim($line), '!') !== 0 && cra1_row_targets_page($this->rowPage($line), $scope['pageKey']);
                }));
                $single = preg_match('/^prod_.*_title_text$/', $f['key']) || in_array($f['key'], ['page_hero_rows_text','prod_service_heads_text','prod_cta_btn1_text'], true);
                $overrideKey = in_array($f['moduleId'], ['price_slider','link_tiles'], true) ? $f['moduleId'] . '_' . str_replace(['/', '-'], '_', $scope['pageKey']) . '_text' : null;
                $out['sources'][$f['key']] = ['kind' => 'shared', 'scopeId' => 'shared:' . $f['moduleId'], 'value' => $shared,
                    'mode' => $single ? 'fallback' : 'append', 'overriddenBy' => $overrideKey && trim((string) ($cfg[$overrideKey] ?? '')) !== '' ? $overrideKey : null];
            }
        }
        return $out;
    }

    public function get(string $domain, string $id): array
    {
        if ($domain==='announcements' && $id==='announcements:all') return ['status'=>200,'msg'=>'success','data'=>(new AnnouncementStore($this->root))->payload()];
        $scope = $this->scope($domain, $id);
        $raw = $domain === 'website' ? self::readJson($this->configFile) : ($domain === 'member' ? $this->member->read() : $this->cart->read());
        return ['status' => 200, 'msg' => 'success', 'data' => $this->payload($scope, $raw)];
    }

    private function validateKeys(array $patch, array $allowed): void
    {
        foreach ($patch as $key => $value) {
            if (!in_array($key, $allowed, true)) throw new InvalidArgumentException('字段不属于当前配置范围：' . $key);
        }
    }

    private function applyDomain(array $scope, array $current, array $patch): array
    {
        $section = $scope['kind'] === 'custom-code' ? 'custom_code' : ($scope['kind'] === 'member-appearance' ? 'appearance' : ($scope['kind'] === 'member-sidebar' ? 'sidebar' : 'content'));
        if ($scope['kind'] === 'member-sidebar') $current['sidebar'] = $this->member->sidebarForEditor($current['sidebar']);
        $this->validateKeys($patch, [$section]);
        if (!isset($patch[$section]) || !is_array($patch[$section])) throw new InvalidArgumentException('配置格式不正确');
        $allowed = $section === 'content' ? $scope['keys'] : array_keys($current[$section]);
        $this->validateKeys($patch[$section], $allowed);
        $this->validateContract($patch[$section], $this->catalog['contracts'][$scope['domain']][$section], $section);
        if($scope['domain']==='member'&&isset($patch['sidebar']['nodes']))cra1_icons_validate_nodes($patch['sidebar']['nodes'],$current['sidebar']['nodes']??[]);
        if($scope['domain']==='member'&&isset($patch['content']['home_quick_links']['items']))cra1_icons_validate_nodes($patch['content']['home_quick_links']['items'],$current['content']['home_quick_links']['items']??[],'member-quick');
        if ($scope['domain']==='cart' && isset($patch['content']['goodslist']) && array_key_exists('heading_icons',$patch['content']['goodslist'])) {
            CartThemeStore::validateHeadingIcons($patch['content']['goodslist']['heading_icons'],$current['content']['goodslist']['heading_icons']??[]);
        }
        if ($scope['domain']==='cart' && isset($patch['content']['goodslist']['heading_icon_styles'])) CartThemeStore::validateHeadingIconStyles($patch['content']['goodslist']['heading_icon_styles']);
        if ($scope['domain']==='cart' && isset($patch['content']['shoppingcar']['empty']['button_target'])) {
            $target=trim((string)$patch['content']['shoppingcar']['empty']['button_target']);
            if($target!==''&&(strpos($target,'//')===0||!preg_match('~^(?:/|#|https://|tel:|mailto:)~i',$target)||preg_match('/[<>"\'\s]/',$target)))throw new InvalidArgumentException('按钮跳转目标：请选择站内页面、商品、联系方式或 HTTPS 网址');
        }
        if($section==='custom_code')foreach($patch[$section]as$key=>$v){if(in_array($key,['css','js'],true)&&(!is_string($v)||strlen($v)>1048576))throw new InvalidArgumentException('自定义代码必须是文本且不超过 1MB');if(in_array($key,['css_enabled','js_enabled'],true)&&!is_bool($v))throw new InvalidArgumentException('代码启用状态必须是开关值');}
        if ($section === 'sidebar' && isset($patch['sidebar']['nodes'])) {
            $shape = (int) ($patch['sidebar']['shape'] ?? $current['sidebar']['shape'] ?? 3);
            if ($shape !== 3) throw new InvalidArgumentException('菜单编辑器使用三级分组结构');
            $errors = $this->member->validateTree($patch['sidebar']['nodes'], true);
            if ($errors) throw new InvalidArgumentException(implode('；', array_slice($errors, 0, 5)));
        }
        return [$section => array_replace($current[$section], $patch[$section])];
    }

    /** Reject nested unknown keys instead of silently dropping administrator input. */
    private function validateContract($value, $rule, string $path, int $depth = 0): void
    {
        if ($depth > 16) throw new InvalidArgumentException('配置层级过深：' . $path);
        if ($rule === 'icon-style') { cra1_icon_style_clean($value);return; }
        if ($rule === 'scalar') {
            if (!is_scalar($value) && $value !== null) throw new InvalidArgumentException('字段格式不正确：' . $path);
            return;
        }
        if (isset($rule['$ref'])) $rule = $this->catalog['contractDefinitions'][$rule['$ref']];
        if (is_object($value)) $value = (array) $value;
        if (!is_array($value)) throw new InvalidArgumentException('配置格式不正确：' . $path);
        if (isset($rule['$list'])) {
            if ($value && array_keys($value) !== range(0, count($value) - 1)) throw new InvalidArgumentException('条目必须是数组：' . $path);
            foreach ($value as $key => $item) $this->validateContract($item, $rule['$list'], $path . '.' . $key, $depth + 1);
        } elseif (isset($rule['$map'])) {
            foreach ($value as $key => $item) $this->validateContract($item, $rule['$map'], $path . '.' . $key, $depth + 1);
        } else {
            foreach ($value as $key => $item) {
                if (!array_key_exists($key, $rule)) throw new InvalidArgumentException('未知字段：' . $path . '.' . $key);
                $this->validateContract($item, $rule[$key], $path . '.' . $key, $depth + 1);
            }
        }
    }

    private function encode(array $doc): string
    {
        foreach (['pages', 'defaults', 'pageOverrides'] as $key) {
            if (isset($doc[$key]) && !$doc[$key]) $doc[$key] = new stdClass();
        }
        return (string) json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function writeMain(array $data): void
    {
        $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) throw new RuntimeException('配置编码失败，原配置保留');
        $tmp = $this->configFile . '.tmp.' . bin2hex(random_bytes(6));
        if (file_put_contents($tmp, $encoded) === false) { @unlink($tmp); throw new RuntimeException('配置文件不可写'); }
        if (is_file($this->configFile)) {
            @chmod($tmp, fileperms($this->configFile) & 0777);
            @chown($tmp, fileowner($this->configFile));
            @chgrp($tmp, filegroup($this->configFile));
        } else @chmod($tmp, 0640);
        if (!rename($tmp, $this->configFile)) { @unlink($tmp); throw new RuntimeException('配置替换失败，原配置保留'); }
    }

    /** Freeze only legacy exceptions; public defaults remain inheritable. */
    public function migratedVisibility(array $raw): array
    {
        $doc = $this->document($raw, 'page_module_visibility_json');
        $doc += ['schema' => 1, 'defaults' => [], 'pages' => []];
        $cfg = $this->resolved($raw); $legacy = $this->visibilityRaw($raw);
        foreach ($this->catalog['pages'] as $pk => $page) {
            $pk = (string) $pk;
            foreach ($page['modules'] as $m) {
                $key = $m['visibilityKey']; $mid = $m['id'];
                if (!$key || array_key_exists($mid, $doc['defaults'])) continue;
                $default = $this->publicDefault($raw, $cfg, $mid, $key);
                $doc['defaults'][$mid] = $default;
                foreach ($this->catalog['pages'] as $target => $p) {
                    $target = (string) $target;
                    if (cra1_module_visibility_key($target, $mid) === null) continue;
                    $actual = cra1_module_visible($mid, $target, $cfg, $legacy);
                    if ($actual !== $default && !array_key_exists($mid, $doc['pages'][$target] ?? [])) $doc['pages'][$target][$mid] = $actual;
                }
            }
        }
        return $doc;
    }

    private function applyWebsite(array $scope, array $raw, array $patch): array
    {
        $cfg = $this->resolved($raw);
        if ($scope['kind'] === 'layout') {
            $this->validateKeys($patch, ['order','inheritOrder','visibility']);
            $pk = $scope['pageKey']; $doc = $this->document($raw, 'page_module_orders_json');
            $doc += ['pages' => [], 'pageOverrides' => []]; $doc['schema'] = 2;
            if (isset($patch['inheritOrder']) && !is_bool($patch['inheritOrder'])) throw new InvalidArgumentException('排序继承值必须为布尔值');
            if (!empty($patch['inheritOrder'])) unset($doc['pageOverrides'][$pk]);
            elseif (isset($patch['order']) || (array_key_exists('inheritOrder', $patch) && $patch['inheritOrder'] === false)) {
                $order = $patch['order'] ?? cra1_page_module_order($pk, $doc);
                if (!is_array($order)) throw new InvalidArgumentException('模块顺序格式不正确');
                $allowed = array_column($this->catalog['pages'][$pk]['modules'], 'id');
                if (count($order) !== count($allowed) || count(array_unique($order)) !== count($allowed) || array_diff($order, $allowed)) throw new InvalidArgumentException('模块顺序包含未知或重复项');
                $doc['pageOverrides'][$pk] = array_values($order);
            }
            $raw['page_module_orders_json'] = $this->encode($doc);
            if (isset($patch['visibility'])) {
                if (!is_array($patch['visibility'])) throw new InvalidArgumentException('显隐规则格式不正确');
                $visible = $this->migratedVisibility($raw);
                foreach ($patch['visibility'] as $mid => $mode) {
                    if (cra1_module_visibility_key($pk, (string) $mid) === null) throw new InvalidArgumentException('系统模块不能设置显隐');
                    if (!in_array($mode, ['inherit','show','hide'], true)) throw new InvalidArgumentException('未知显隐规则');
                    if ($mode === 'inherit') unset($visible['pages'][$pk][$mid]); else $visible['pages'][$pk][$mid] = $mode === 'show';
                }
                $raw['page_module_visibility_json'] = $this->encode($visible);
            }
            return $raw;
        }
        if ($scope['kind'] === 'seo') {
            $this->validateKeys($patch, ['title','desc','kw','noindex']);
            $pk = $scope['pageKey']; $doc = $this->document($raw, 'seo_page_meta_json'); $doc += ['schema' => 1, 'pages' => []];
            $value = $doc['pages'][$pk] ?? [];
            foreach ($patch as $key => $v) {
                if ($key === 'noindex') {
                    if (!is_bool($v)) throw new InvalidArgumentException('收录状态格式不正确');
                    if ($pk === '404' && !$v) throw new InvalidArgumentException('404 页面由系统固定不收录');
                    if ($v && $pk !== '404') $value[$key] = true; else unset($value[$key]);
                } else {
                    if (!is_string($v) || mb_strlen($v) > 300) throw new InvalidArgumentException('SEO 文本最多 300 字');
                    if (trim($v) === '') unset($value[$key]); else $value[$key] = trim($v);
                }
            }
            if ($value) $doc['pages'][$pk] = $value; else unset($doc['pages'][$pk]);
            $raw['seo_page_meta_json'] = $this->encode($doc); return $raw;
        }
        $allowed = $scope['keys']; if ($scope['kind'] === 'shared') $allowed[] = 'pageVisibility';
        $this->validateKeys($patch, $allowed);
        $byKey = []; foreach ($scope['fields'] as $f) foreach ($f['keys'] as $key) $byKey[$key] = $f;
        $visibilityBefore = $scope['kind'] === 'shared' ? $this->migratedVisibility($raw) : [];
        foreach ($patch as $key => $value) {
            if ($key === 'pageVisibility') continue;
            if ($key === 'header_support_json') $value = cra1_support_normalize_json($value);
            if (!is_scalar($value) && $value !== null) throw new InvalidArgumentException('字段必须是文本或标量：' . $key);
            if (function_exists('config_normalize_value')) {
                [$valid, $value] = config_normalize_value($key, $value);
                if (!$valid) throw new InvalidArgumentException((string) $value);
            } else $value = (string) $value;
            $this->validateIconField((string)$key,(string)$value,(string)($cfg[$key]??''));
            $f = $byKey[$key];
            if (($f['visual']['widget'] ?? '') === 'copy' && strpos($key, 'copy_') === 0) {
                $value = cra1_copy_editor_patch(substr($key, 5, -5), $cfg, (string)$value);
                if ($value === null) continue;
            }
            if (in_array($f['adapter'], ['page-rows','shared-rows'], true)) {
                // Unsaved page defaults remain fallbacks. Copying them into a
                // public save would mask the new public row with exact-page rows.
                // Actual saved rows, including hidden/unknown data, stay intact.
                $saved = array_replace(self::readJson($this->root . '/public/web/cra1/controller/storage.json'), $raw);
                $base = $f['adapter']==='shared-rows' ? ($saved[$key]??'') : ($cfg[$key]??'');
                $raw[$key] = $this->mergeRows((string)$base, (string) $value, $f['adapter'], $f['boundPage'] ?? null);
            } else {
                $raw[$key] = $value;
                if ($f['adapter'] === 'visibility-default') {
                    $doc = $visibilityBefore;
                    $doc['defaults'][$f['moduleId']] = (string) $value === '1';
                    $raw['page_module_visibility_json'] = $this->encode($doc);
                }
            }
            // An intentional clear is distinct from an untouched legacy value.
            // Mark only submitted fields; defaults are never copied wholesale.
            if ($f['adapter'] !== 'visibility-default') {
                $explicit=$this->document($raw,'public_content_explicit_json');
                // Nonempty shared rows still use per-page template fallbacks
                // for omitted positions; an empty list deliberately removes them.
                if ($f['adapter']==='shared-rows' && trim((string)$value)!=='') unset($explicit[$key]);
                else $explicit[$key]=true;
                $raw['public_content_explicit_json']=$this->encode($explicit);
            }
        }
        if (isset($patch['pageVisibility'])) {
            if (!is_array($patch['pageVisibility'])) throw new InvalidArgumentException('显隐规则格式不正确');
            $doc = $this->migratedVisibility($raw); $mid = $scope['moduleId'];
            foreach ($patch['pageVisibility'] as $pk => $mode) {
                $pk = (string) $pk;
                if (!in_array($pk, $scope['affectedPageKeys'], true) || cra1_module_visibility_key($pk, $mid) === null) throw new InvalidArgumentException('页面不属于当前模块');
                if (!in_array($mode, ['inherit','show','hide'], true)) throw new InvalidArgumentException('未知显隐规则');
                if ($mode === 'inherit') unset($doc['pages'][$pk][$mid]); else $doc['pages'][$pk][$mid] = $mode === 'show';
            }
            $raw['page_module_visibility_json'] = $this->encode($doc);
        }
        return $raw;
    }

    public function save(string $domain, string $id, string $expected, array $patch, string $operator): array
    {
        if ($domain==='announcements' && $id==='announcements:all') return (new AnnouncementStore($this->root))->save($expected,$patch,$operator);
        $scope = $this->scope($domain, $id);
        if ($expected === '' || !$patch) throw new InvalidArgumentException('缺少配置版本或修改内容');
        if ($domain !== 'website') {
            $store = $domain === 'member' ? $this->member : $this->cart;
            $result = $store->save([], $operator, 0, [
                'expectedRevision' => $expected,
                'project' => function ($raw) use ($scope) { return $this->project($scope, $raw); },
                'merge' => function ($raw) use ($scope, $patch) { return $this->applyDomain($scope, $raw, $patch); },
            ]);
            if ($result['status'] !== 200) return $result;
            $payload = $this->payload($scope, $result['data']['config']);
            $payload['snapshot_ok'] = $result['data']['snapshot_ok'];
            return ['status' => 200, 'msg' => $result['msg'], 'data' => $payload];
        }
        $lock = fopen($this->configFile . '.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('存储锁不可用');
        try {
            $raw = self::readJson($this->configFile);
            $payload = $this->payload($scope, $raw);
            if (!hash_equals($payload['revision'], $expected)) return ['status' => 409, 'msg' => '当前范围已被其他会话修改，草稿已保留', 'data' => $payload];
            $next = $this->applyWebsite($scope, $raw, $patch);
            $this->writeMain($next);
            return ['status' => 200, 'msg' => '当前范围已保存，前台已生效', 'data' => $this->payload($scope, $next)];
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }

    public function rebuild(string $domain): array
    {
        if (!in_array($domain, ['member','cart'], true)) throw new InvalidArgumentException('该配置域没有公开快照');
        ($domain === 'member' ? $this->member : $this->cart)->ensureSnapshot();
        return ['status' => 200, 'msg' => '前台快照已同步', 'data' => ['snapshot_ok' => true]];
    }

    public function migrate(bool $apply = false): array
    {
        $lock = fopen($this->configFile . '.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('存储锁不可用');
        try {
            $raw = self::readJson($this->configFile); $cfg = $this->resolved($raw); $doc = $this->migratedVisibility($raw);
            $next = $raw; $next['page_module_visibility_json'] = $this->encode($doc); $differences = [];
            $comparison = [];
            foreach ($this->catalog['pages'] as $pk => $p) {
                $pk = (string) $pk;
                $comparison[$pk] = [];
                foreach ($p['modules'] as $m) {
                    $before = cra1_module_visible($m['id'], $pk, $cfg, $this->visibilityRaw($raw));
                    $after = cra1_module_visible($m['id'], $pk, $cfg, $this->visibilityRaw($next));
                    $comparison[$pk][$m['id']] = ['before' => $before, 'after' => $after];
                    if ($before !== $after) $differences[] = $pk . ':' . $m['id'];
                }
            }
            if ($differences) throw new RuntimeException('迁移会改变页面显示，已中止');
            $changed = ($raw['page_module_visibility_json'] ?? '') !== $next['page_module_visibility_json'];
            if ($apply && $changed) {
                $this->writeMain($next);
            }
            return ['changed' => $changed, 'applied' => $apply && $changed, 'pages' => count($this->catalog['pages']),
                'comparedModules' => array_sum(array_map('count', $comparison)), 'visibilityDifferences' => $differences, 'comparison' => $comparison];
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }
}
