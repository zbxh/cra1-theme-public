<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

/** Page input policy only. Business access remains with the native controller/API. */
final class PluginPages
{
    public static function redirect(string $name, string $view, array $params, int $id): string
    {
        $base='/plugin/'.$id.'/';
        if ($name==='IdcsmartCertification') {
            if (in_array($view,['authentication_person','authentication_company'],true)
                && (!is_string($params['name']??null) || trim($params['name'])==='')) return $base.'authentication_select.htm';
            if (in_array($view,['authentication_status','authentication_thrid'],true)
                && !in_array((string)($params['type']??''),['1','2','3'],true)) return $base.'authentication_select.htm';
        }
        if ($name==='ClientCare' && $view==='msgDetail' && !preg_match('/^[1-9]\d*$/D',(string)($params['id']??''))) return '/account.htm';
        if ($name==='IdcsmartDomain' && $view==='whois' && (!is_string($params['domain']??null) || trim($params['domain'])==='')) return $base.'domain_list.htm';
        return '';
    }
}
