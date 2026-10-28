<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;

/** Presentation only: native authentication policy is never editable here. */
final class AuthAppearance
{
    public static function defaults(string $page): array
    {
        static $defaults;
        if ($defaults === null) $defaults = json_decode((string)file_get_contents(__DIR__.'/auth-pages.defaults.json'), true);
        return $defaults[$page === 'regist' ? 'regist' : 'login'];
    }

    private static function text($value, int $length): string
    {
        return mb_substr(trim(strip_tags(is_scalar($value) ? (string)$value : '')), 0, $length);
    }

    private static function url($value, bool $image = false): string
    {
        $url = is_string($value) ? trim($value) : '';
        if ($url === '' || strlen($url) > 2000 || preg_match('~[\\\\\x00-\x20\x7f]~', $url) || strpos($url, '//') === 0) return '';
        if (preg_match('~^https?://~i', $url)) {
            $parsed = parse_url($url);
            return $parsed && !empty($parsed['host']) && !isset($parsed['user']) && !isset($parsed['pass']) ? $url : '';
        }
        if (!$image && preg_match('~^(?:mailto:|tel:)~i', $url)) return $url;
        return preg_match('~^[a-z][a-z0-9+.-]*:~i', $url) ? '' : $url;
    }

    public static function normalize(array $input, string $page): array
    {
        $d = self::defaults($page); $result = [];
        foreach (['title'=>80, 'description'=>200, 'footer'=>200] as $key=>$max) $result[$key] = self::text($input[$key] ?? $d[$key], $max);
        $result['logo'] = self::url($input['logo'] ?? '', true);
        $brand = is_array($input['brand'] ?? null) ? $input['brand'] : [];
        $result['brand'] = ['enabled'=>(int)($brand['enabled'] ?? 1) ? 1 : 0];
        foreach (['label'=>40, 'title'=>120, 'description'=>240] as $key=>$max) $result['brand'][$key] = self::text($brand[$key] ?? $d['brand'][$key], $max);
        $result['brand']['image'] = self::url($brand['image'] ?? '', true);
        $items = $brand['items'] ?? $d['brand']['items']; $result['brand']['items'] = []; $seen=[];
        foreach (is_array($items) ? $items : [] as $index=>$item) {
            if (!is_array($item) || count($result['brand']['items']) >= 6) continue;
            $id = (string)($item['id'] ?? '');
            if (!preg_match('/^[A-Za-z0-9_-]{6,64}$/D', $id) || isset($seen[$id])) {
                $suffix = count($result['brand']['items']);
                do { $id = 'auth-item-'.$suffix++; } while (isset($seen[$id]));
            }
            $seen[$id] = true;
            $result['brand']['items'][] = ['id'=>$id, 'title'=>self::text($item['title'] ?? '', 60), 'description'=>self::text($item['description'] ?? '', 160), 'enabled'=>(int)($item['enabled'] ?? 1) ? 1 : 0];
        }
        $support = is_array($input['support'] ?? null) ? $input['support'] : [];
        $result['support'] = ['enabled'=>(int)($support['enabled'] ?? 0) ? 1 : 0, 'label'=>self::text($support['label'] ?? $d['support']['label'], 30), 'url'=>self::url($support['url'] ?? '')];
        return $result;
    }

    public static function project(array $input, string $page): array
    {
        $result = self::normalize($input, $page);
        foreach (['brand','support'] as $key) if (!$result[$key]['enabled']) $result[$key] = ['enabled'=>0];
        if (!empty($result['brand']['enabled'])) $result['brand']['items'] = array_values(array_filter($result['brand']['items'], static function($item){return $item['enabled'] && ($item['title'] !== '' || $item['description'] !== '');}));
        return $result;
    }
}
