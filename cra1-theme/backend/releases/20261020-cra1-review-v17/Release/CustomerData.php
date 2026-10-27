<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;

/** Explicit customer API projection; never forward an internal package manifest. */
final class CustomerData
{
    public const DOCUMENTS=['product-identity.json','nginx.example.conf','安装更新与回退.md','测试版与后续更新.md','icon-source-evidence.json'];

    public static function repositoryFile(string $path): bool
    {
        if($path==='cra1-theme/LICENSE.txt'||preg_match('~(?:^|/)Release/LicenseCredential\.php$~D',$path)
            ||strpos($path,'cra1-theme/licenses/issuer-')===0)return true;
        return strpos($path,'cra1-theme/docs/')===0&&!in_array(substr($path,strlen('cra1-theme/docs/')),self::DOCUMENTS,true);
    }

    public static function candidate(array $data): array
    {
        $out=array_intersect_key($data,array_flip(['sha256','bytes','release_channel','files','native_dependencies','blockers','can_apply','signature','candidate']));
        $out['release']=$data['manifest']['release']??$data['release']??null;
        $out['files']=array_values(array_filter($out['files']??[],static function($row){return !self::repositoryFile((string)($row['path']??''));}));
        return $out;
    }

    public static function current(array $data): array
    {
        return array_intersect_key($data,array_flip(['release','installed_at','history','previous_release']));
    }
}
