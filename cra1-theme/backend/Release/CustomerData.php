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
        $out=array_intersect_key($data,array_flip(['sha256','bytes','release_channel','blockers','warnings','can_apply','candidate']));
        $out['release']=$data['manifest']['release']??$data['release']??null;
        if(isset($data['manifest']['version']))$out['version']=$data['manifest']['version'];
        // Keep actionable rows for older admin clients. The digest is still
        // needed to confirm exactly the package that passed preflight.
        $out['files']=array_values(array_filter($data['files']??[],static function($row){
            return ($row['status']??'')==='阻断'&&!self::repositoryFile((string)($row['path']??''));
        }));
        return $out;
    }

    public static function inspection(array $data): array
    {
        $out=array_intersect_key($data,array_flip(['release','version','release_channel','compatible','read_only']));
        $out['context']=['system_version'=>$data['context']['system_version']??'','php_version'=>PHP_VERSION];
        $out['checks']=array_values(array_filter($data['checks'],static function(array $row): bool {
            return $row['id']!=='compatibility'&&strpos($row['id'],'dependency:')!==0;
        }));
        $out['counts']=array_replace(['pass'=>0,'warning'=>0,'blocked'=>0,'unverified'=>0],array_count_values(array_column($out['checks'],'status')));
        $out['overview']=Inspector::overview($out['checks']);
        unset($out['overview']['contracts']);
        return $out;
    }

    public static function current(array $data): array
    {
        $out=array_intersect_key($data,array_flip(['release','installed_at','history','previous_release']));
        if(isset($data['manifest']['version']))$out['version']=$data['manifest']['version'];
        if(isset($data['manifest']['release_channel']))$out['release_channel']=$data['manifest']['release_channel'];
        return $out;
    }
}
