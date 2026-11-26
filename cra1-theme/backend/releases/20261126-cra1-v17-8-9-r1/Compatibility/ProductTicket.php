<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

use CRA1\Theme\Security\NativeAuthorization;
use think\facade\Db;

final class ProductTicket
{
    private const PLUGINS = ['IdcsmartTicket'=>'idcsmart_ticket', 'TicketPremium'=>'ticket_premium'];

    public static function entry(string $root): string
    {
        if ((int)get_client_id(false) <= 0) return '';
        $plugins = Db::name('plugin')->where('module', 'addon')->where('status', 1)
            ->whereIn('name', array_keys(self::PLUGINS))->column('id', 'name');
        $choices = [];
        foreach (self::PLUGINS as $name => $slug) {
            $id = (int)($plugins[$name] ?? 0);
            if (!$id || !NativeAuthorization::allows('addon\\'.$slug.'\\controller\\clientarea\\TicketController::create')) continue;
            $path = $root.'/public/plugins/addon/'.$slug.'/template/clientarea/';
            if (!glob($path.'*/*/addTicket.html') && !is_file($path.'addTicket.html')) continue;
            $choices[] = '/plugin/'.$id.'/addTicket.htm';
        }
        if (count($choices) < 2) return $choices[0] ?? '';

        // A configured, visible "new ticket" link disambiguates two enabled plugins.
        require_once CRA1_THEME_BACKEND.'/Storage/member_store.php';
        $store = new \CRA1\Theme\Storage\MemberCenterStore($root.'/runtime');
        $nodes = $store->sidebarPreview($store->read()['sidebar']['nodes']);
        return self::configuredEntry($nodes, $choices) ?: $choices[0];
    }

    private static function configuredEntry(array $nodes, array $choices): string
    {
        foreach ($nodes as $node) {
            $url = (string)($node['url'] ?? '');
            if (preg_match('~^/?plugin/[1-9]\d*/addTicket\.htm(?:[?#]|$)~D', $url)) {
                $path = '/'.ltrim((string)parse_url($url, PHP_URL_PATH), '/');
                if (in_array($path, $choices, true)) return $path;
            }
            $child = self::configuredEntry($node['children'] ?? [], $choices);
            if ($child !== '') return $child;
        }
        return '';
    }

    public static function forHost(string $root, $value): string
    {
        if ((!is_int($value) && !is_string($value)) || !ctype_digit((string)$value)) return '';
        $id = (int)$value;
        if ($id <= 0 || !NativeAuthorization::hostVisible($id)
            || (!NativeAuthorization::allows('app\\home\\controller\\HostController::index')
                && !NativeAuthorization::allows('app\\home\\controller\\HostController::list'))) return '';
        $owned = Db::name('host')->where('client_id', (int)get_client_id())->where('id', $id)
            ->where('is_delete', 0)->whereNotIn('status', ['Deleted', 'Cancelled'])->count();
        if (!$owned) return '';
        $entry = self::entry($root);
        return $entry === '' ? '' : $entry.'?cra1_host='.$id;
    }
}
