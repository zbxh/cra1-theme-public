<?php
declare(strict_types=1);

namespace CRA1\Theme\Content;

use InvalidArgumentException;

/** Private rules and the minimal, time-aware projection for a single selection. */
final class CartDescriptions
{
    public const SCOPES = ['product', 'second', 'first', 'global'];

    public static function defaults(): array
    {
        return ['global'=>['mode'=>'custom', 'html'=>''], 'first'=>[], 'second'=>[], 'product'=>[]];
    }

    public static function id($value): int
    {
        return (is_int($value) || is_string($value)) && preg_match('/^[1-9][0-9]{0,9}$/D', (string)$value)
            && (int)$value <= 4294967295 ? (int)$value : 0;
    }

    public static function normalize($input, bool $strict = false): array
    {
        $result = self::defaults();
        if (!is_array($input) || array_diff_key($input, $result + ['shared'=>[]])) {
            if ($strict) throw new InvalidArgumentException('购物车顶部说明的分级配置格式不正确');
            if (!is_array($input)) return $result;
        }
        $shared = $input['shared'] ?? [];
        if (!is_array($shared)) {
            if ($strict) throw new InvalidArgumentException('共用说明的格式不正确');
            $shared = [];
        }
        foreach ($shared as $key => $document) {
            if (!self::referenceId($key)) {
                if ($strict) throw new InvalidArgumentException('共用说明的标识无效');
                continue;
            }
            $rule = self::rule($document, $strict);
            if ($rule !== null) $result['shared'][$key] = $rule;
        }
        if (array_key_exists('global', $input)) {
            $result['global'] = self::binding($input['global'], $result, $strict) ?? $result['global'];
        }
        foreach (['first', 'second', 'product'] as $scope) {
            if (!array_key_exists($scope, $input)) continue;
            if (!is_array($input[$scope])) {
                if ($strict) throw new InvalidArgumentException('购物车顶部说明的条目格式不正确');
                continue;
            }
            foreach ($input[$scope] as $id => $rule) {
                if (!self::id($id)) {
                    if ($strict) throw new InvalidArgumentException('购物车顶部说明的商品或分组标识无效');
                    continue;
                }
                $normalized = self::binding($rule, $result, $strict);
                if ($normalized !== null && (isset($normalized['ref']) || $normalized['mode'] === 'hide' || $normalized['html'] !== '')) {
                    $result[$scope][(int)$id] = $normalized;
                }
            }
        }
        return self::prune($result);
    }

    private static function referenceId($value): bool
    {
        return is_string($value) && preg_match('/^d-[a-f0-9]{32}$/D', $value) === 1;
    }

    private static function binding($value, array $rules, bool $strict): ?array
    {
        if (!is_array($value) || !array_key_exists('ref', $value)) return self::rule($value, $strict);
        $ref = $value['ref'];
        if (count($value) === 1 && self::referenceId($ref) && isset($rules['shared'][$ref])) return ['ref'=>$ref];
        if ($strict) throw new InvalidArgumentException('购物车顶部说明引用的共用内容不存在或格式不正确');
        return null;
    }

    private static function prune(array $rules): array
    {
        if (empty($rules['shared'])) return $rules;
        $used = [];
        foreach (self::SCOPES as $scope) {
            foreach ($scope === 'global' ? [$rules['global'] ?? []] : ($rules[$scope] ?? []) as $rule) {
                if (self::referenceId($rule['ref'] ?? null)) $used[$rule['ref']] = true;
            }
        }
        $rules['shared'] = array_intersect_key($rules['shared'], $used);
        if (!$rules['shared']) unset($rules['shared']);
        return $rules;
    }

    private static function rule($value, bool $strict): ?array
    {
        if (!is_array($value) || array_diff(array_keys($value), ['mode', 'html'])
            || !in_array($value['mode'] ?? null, ['custom', 'hide'], true)
            || !is_string($value['html'] ?? '')) {
            if ($strict) throw new InvalidArgumentException('购物车顶部说明仅支持自定义和隐藏');
            return null;
        }
        return ['mode'=>$value['mode'], 'html'=>ContentDocument::normalize($value['html'] ?? '', $strict)];
    }

    public static function hasScopedRules(array $rules): bool
    {
        return !empty($rules['first']) || !empty($rules['second']) || !empty($rules['product']);
    }

    private static function ruleAt(array $rules, string $scope, int $id)
    {
        return $scope === 'global' ? ($rules['global'] ?? null) : ($id ? ($rules[$scope][$id] ?? null) : null);
    }

    public static function withPreview(array $rules, string $scope, int $id, string $mode, string $html): array
    {
        $rule = ['mode'=>$mode, 'html'=>$html];
        $ref = self::ruleAt($rules, $scope, $id)['ref'] ?? null;
        if (self::referenceId($ref)) $rules['shared'][$ref] = $rule;
        elseif ($scope === 'global') $rules['global'] = $rule;
        else $rules[$scope][$id] = $rule;
        return $rules;
    }

    public static function project(array $rules, array $selection, int $now): array
    {
        return self::resolve($rules, $selection, static fn(string $html): array => ContentDocument::project($html, $now));
    }

    /** Compare what the current catalog would actually display, including timed content and overrides. */
    public static function affectedProducts(array $before, array $after, array $selections, int $now): int
    {
        $documents = [];
        $render = static function (string $html) use (&$documents, $now): array {
            return $documents[$html] ?? ($documents[$html] = ContentDocument::project($html, $now));
        };
        $count = 0;
        foreach ($selections as $selection) {
            $a = self::resolve($before, $selection, $render);
            $b = self::resolve($after, $selection, $render);
            if ($a['mode'] !== $b['mode'] || $a['html'] !== $b['html']) $count++;
        }
        return $count;
    }

    private static function resolve(array $rules, array $selection, callable $render): array
    {
        $next = null;
        foreach (self::SCOPES as $scope) {
            $id = $scope === 'global' ? 0 : self::id($selection[$scope] ?? 0);
            $rule = self::ruleAt($rules, $scope, $id);
            if (!is_array($rule)) continue;
            if (array_key_exists('ref', $rule)) {
                if (!self::referenceId($rule['ref'])) continue;
                $rule = $rules['shared'][$rule['ref']] ?? null;
            }
            if (($rule['mode'] ?? '') === 'hide') {
                return ['mode'=>'hide', 'scope'=>$scope, 'id'=>$id, 'html'=>'', 'next_change'=>$next];
            }
            if (($rule['mode'] ?? '') !== 'custom' || !is_string($rule['html'] ?? null)) continue;
            $content = $render($rule['html']);
            if ($content['next_change'] !== null) {
                $next = $next === null ? $content['next_change'] : min($next, $content['next_change']);
            }
            if ($content['html'] !== '') {
                return ['mode'=>'custom', 'scope'=>$scope, 'id'=>$id, 'html'=>$content['html'], 'next_change'=>$next];
            }
        }
        return ['mode'=>'none', 'scope'=>'', 'id'=>0, 'html'=>'', 'next_change'=>$next];
    }

    /** The browser receives only the effective content and its next refresh delay. */
    public static function storefront(array $rules, array $selection, int $now): array
    {
        $value = self::project($rules, $selection, $now);
        return [
            'mode'=>$value['mode'],
            'html'=>$value['html'],
            'refresh_after'=>$value['next_change'] === null ? null : $value['next_change'] - $now,
        ];
    }

    /** Only a unique, full classification path can identify a rule on another site. */
    public static function remap(array $rules, array $source, array $target, int &$unmatched): array
    {
        foreach (['first', 'second', 'product'] as $scope) {
            $candidates = [];
            foreach ($target[$scope] ?? [] as $id => $path) $candidates[json_encode($path)][] = $id;
            $assign = [];
            foreach ($rules[$scope] ?? [] as $id => $rule) {
                $path = $source[$scope][$id] ?? null;
                $matches = is_array($path) ? ($candidates[json_encode($path)] ?? []) : [];
                if (count($matches) !== 1) {
                    $unmatched++;
                    continue;
                }
                $assign[$matches[0]][] = $rule;
            }
            $rules[$scope] = [];
            foreach ($assign as $id => $items) {
                if (count($items) === 1) $rules[$scope][$id] = $items[0];
                else $unmatched += count($items);
            }
            ksort($rules[$scope]);
        }
        return self::prune($rules);
    }
}
