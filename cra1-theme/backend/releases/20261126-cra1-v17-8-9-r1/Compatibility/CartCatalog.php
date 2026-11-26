<?php
declare(strict_types=1);

namespace CRA1\Theme\Compatibility;

use CRA1\Theme\Content\CartDescriptions;
use PDO;
use RuntimeException;

final class CartCatalog
{
    private PDO $pdo;
    private string $prefix;

    public function __construct()
    {
        $pdo = Database::localConnection();
        if (!$pdo) throw new RuntimeException('V10 商品目录暂时无法读取');
        $this->pdo = $pdo;
        $this->prefix = Database::prefix();
    }

    /** The editor includes hidden products so operators can prepare their content in advance. */
    public function directory(): array
    {
        $groups = $this->pdo->query("SELECT id,name,parent_id,hidden FROM {$this->prefix}product_group ORDER BY `order` DESC,id")->fetchAll();
        $products = $this->pdo->query("SELECT id,name,product_group_id group_id,hidden FROM {$this->prefix}product WHERE product_id=0 ORDER BY `order` DESC,id")->fetchAll();
        return ['groups'=>$groups, 'products'=>$products];
    }

    /** Resolve one selection against V10. A visible product supplies its own verified parents. */
    public function selection(array $input): array
    {
        $product = CartDescriptions::id($input['product'] ?? 0);
        $second = CartDescriptions::id($input['second'] ?? 0);
        $first = CartDescriptions::id($input['first'] ?? 0);
        $table = $this->prefix.'product_group';
        if ($product) {
            $query = $this->pdo->prepare($this->visibleProductQuery().' AND p.id=?');
            $query->execute([$product]);
            if ($row = $query->fetch()) return array_map('intval', $row);
        }
        if ($second) {
            $query = $this->pdo->prepare("SELECT f.id FROM {$table} g INNER JOIN {$table} f ON f.id=g.parent_id
                WHERE g.id=? AND g.hidden=0 AND f.parent_id=0 AND f.hidden=0");
            $query->execute([$second]);
            $parent = (int)$query->fetchColumn();
            if ($parent && (!$first || $first === $parent)) return ['second'=>$second, 'first'=>$parent];
        }
        if ($first) {
            $query = $this->pdo->prepare("SELECT id FROM {$table} WHERE id=? AND parent_id=0 AND hidden=0");
            $query->execute([$first]);
            if ($query->fetchColumn()) return ['first'=>$first];
        }
        return [];
    }

    public function visibleProductSelections(): array
    {
        return $this->pdo->query($this->visibleProductQuery())->fetchAll();
    }

    private function visibleProductQuery(): string
    {
        $table = $this->prefix.'product_group';
        return "SELECT p.id product, IF(g.parent_id=0,0,g.id) `second`, IF(g.parent_id=0,g.id,g.parent_id) `first`
            FROM {$this->prefix}product p
            INNER JOIN {$table} g ON g.id=p.product_group_id AND g.hidden=0
            LEFT JOIN {$table} f ON f.id=g.parent_id AND f.parent_id=0 AND f.hidden=0
            WHERE p.product_id=0 AND p.hidden=0 AND (g.parent_id=0 OR f.id IS NOT NULL)";
    }

    public static function paths(array $directory): array
    {
        $paths = ['first'=>[], 'second'=>[], 'product'=>[]];
        foreach ($directory['groups'] as $row) {
            if (!(int)$row['parent_id']) $paths['first'][$row['id']] = [$row['name']];
        }
        foreach ($directory['groups'] as $row) {
            if (isset($paths['first'][$row['parent_id']])) $paths['second'][$row['id']] = [$paths['first'][$row['parent_id']][0], $row['name']];
        }
        foreach ($directory['products'] as $row) {
            $parent = $paths['second'][$row['group_id']] ?? $paths['first'][$row['group_id']] ?? null;
            if ($parent !== null) $paths['product'][$row['id']] = array_merge($parent, [$row['name']]);
        }
        return $paths;
    }
}
