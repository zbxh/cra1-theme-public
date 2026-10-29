<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** Runtime identity contains product information only. */
final class Identity
{
    public static function read(string $root): array
    {
        return self::project(Files::json($root.'/cra1-theme/docs/product-identity.json'));
    }

    public static function project(array $doc): array
    {
        $expected=['format'=>1,'product'=>'cra1-theme','display_name'=>'酷锐A1主题','brand'=>'CRA1','theme_id'=>'cra1',
            'php_namespace'=>'CRA1\\Theme','controller'=>'template\\cra1\\controller\\Cra1','shared_global'=>'CRA1Shared',
            'member_api_prefix'=>'/console/v1/cra1-theme/','session_cookie'=>'CRA1THEMEID'];
        foreach($expected as $key=>$value)if(($doc[$key]??null)!==$value)throw new \RuntimeException('主题标识登记信息无效');
        return $expected;
    }
}
