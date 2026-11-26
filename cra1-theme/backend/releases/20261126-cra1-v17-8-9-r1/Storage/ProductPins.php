<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;

use CRA1\Theme\Files;
use CRA1\Theme\Security\NativeAuthorization;
use think\facade\Db;

/** Personal preferences, independent of the merchant's theme configuration. */
final class ProductPins
{
    private const LIMIT = 50;
    private string $file;
    private int $owner;

    public function __construct(string $root, int $owner, int $actor)
    {
        $this->owner = $owner;
        $this->file = $root.'/runtime/cra1_theme/product-pins/'.$owner.'/'.$actor.'.json';
    }

    private function stored(): array
    {
        $ids = Files::json($this->file, true)['ids'] ?? [];
        if (!is_array($ids)) throw new \RuntimeException('Invalid product pin preference');
        return array_slice(array_values(array_unique(array_filter($ids, static function ($id): bool {
            return is_int($id) && $id > 0;
        }))), 0, self::LIMIT);
    }

    public function set(int $id, bool $pinned): void
    {
        Files::locked($this->file.'.lock', function () use ($id, $pinned): void {
            $stored = $this->stored();
            $candidates = array_values(array_unique(array_merge($stored, [$id])));
            $available = Db::name('host')->where('client_id', $this->owner)
                ->where('is_delete', 0)->where('is_sub', 0)
                ->whereNotIn('status', ['Deleted', 'Cancelled'])->whereIn('id', $candidates)
                ->column('id');
            $available = array_map('intval', $available);
            $visible = NativeAuthorization::visibleHostIds();
            if ($visible !== null) $available = array_intersect($available, $visible);
            if (!in_array($id, $available, true)) throw new \InvalidArgumentException('当前产品无法置顶');
            $ids = array_values(array_intersect($stored, $available));
            if ($pinned && !in_array($id, $ids, true)) {
                if (count($ids) >= self::LIMIT) throw new \InvalidArgumentException('最多置顶 50 个产品，请先取消一个置顶');
                array_unshift($ids, $id);
            } elseif (!$pinned) {
                $ids = array_values(array_diff($ids, [$id]));
            }
            if ($ids !== $stored) Files::putJson($this->file, ['ids'=>$ids], 0600);
        });
    }

    /** The native product list applies ownership, status and assignment before returning any IDs. */
    public function listOrder(): array
    {
        return $this->stored();
    }
}
