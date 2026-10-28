<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

/** Read-only, request-scoped checks. A version number alone cannot prove a security contract. */
final class KnownContracts
{
    /** Profiles describe a complete reviewed combination, never a union of allowed file hashes. */
    public static function matchProfile(string $root, array $original, array $profiles = []): ?string
    {
        if (self::filesMatch($root, $original)) return 'official';
        foreach ($profiles as $profile) {
            if (!is_array($profile) || !preg_match('/^[a-z0-9][a-z0-9-]{3,80}$/D', (string)($profile['id'] ?? ''))
                || ($profile['provenance'] ?? '') !== 'reviewed-integration'
                || !preg_match('/^[a-f0-9]{64}$/D', (string)($profile['review_sha256'] ?? ''))
                || !is_array($profile['files'] ?? null)) continue;
            // A profile may add dependencies; it cannot omit an original dependency.
            if (array_diff_key($original, $profile['files'])) continue;
            if (self::filesMatch($root, $profile['files'])) return $profile['id'];
        }
        return null;
    }

    public static function filesMatch(string $root,array $files): bool
    {
        if(!$files)return false;
        foreach($files as$relative=>$expected){
            if(!preg_match('~^(?:app|route|vendor|public/plugins)/[A-Za-z0-9_./-]+$~D',(string)$relative)||strpos($relative,'..')!==false
                ||!preg_match('/^[a-f0-9]{64}$/D',(string)$expected))return false;
            $file=$root.'/'.$relative;
            try{\CRA1\Theme\Files::noLinks($file);}catch(\Throwable $e){return false;}
            if(!is_file($file)||!is_readable($file)||!hash_equals($expected,(string)hash_file('sha256',$file)))return false;
        }
        return true;
    }
    public static function security(): bool
    {
        return (bool)Capabilities::attempt('native-security-contract',static function(){
            $registry=\CRA1\Theme\Files::json(CRA1_THEME_BACKEND.'/Compatibility/native-contracts.json');
            $system=$registry['systems'][\CRA1\Theme\Context::version()]??[];
            return self::matchProfile(CRA1_THEME_ROOT,$system['security_files']??[],$system['profiles']??[]) !== null;
        },false);
    }
    public static function module(string $name,string $version): bool
    {
        if($name!=='MfCloud')return false;
        return (bool)Capabilities::attempt('native-module-contract:'.$name.':'.$version,static function()use($name,$version){
            $registry=\CRA1\Theme\Files::json(CRA1_THEME_BACKEND.'/Compatibility/native-contracts.json');
            $module=$registry['modules'][$name][$version]??[];
            return self::matchProfile(CRA1_THEME_ROOT,$module['files']??[],$module['profiles']??[]) !== null;
        },false);
    }
}
