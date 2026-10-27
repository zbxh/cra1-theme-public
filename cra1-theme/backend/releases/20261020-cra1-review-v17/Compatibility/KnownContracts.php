<?php
declare(strict_types=1);
namespace CRA1\Theme\Compatibility;

/** Read-only, request-scoped checks. A version number alone cannot prove a security contract. */
final class KnownContracts
{
    public static function filesMatch(string $root,array $files): bool
    {
        if(!$files)return false;
        foreach($files as$relative=>$expected){
            if(!preg_match('~^(?:app|route|vendor|public/plugins)/[A-Za-z0-9_./-]+$~D',(string)$relative)||strpos($relative,'..')!==false
                ||!preg_match('/^[a-f0-9]{64}$/D',(string)$expected))return false;
            $file=$root.'/'.$relative;
            try{\CRA1\Theme\Files::noLinks($file);}catch(\Throwable $e){return false;}
            if(!is_file($file)||!hash_equals($expected,(string)hash_file('sha256',$file)))return false;
        }
        return true;
    }
    public static function security(): bool
    {
        return (bool)Capabilities::attempt('native-security-contract',static function(){
            $registry=\CRA1\Theme\Files::json(CRA1_THEME_BACKEND.'/Compatibility/native-contracts.json');
            $files=$registry['systems'][\CRA1\Theme\Context::version()]['security_files']??[];
            return self::filesMatch(CRA1_THEME_ROOT,$files);
        },false);
    }
    public static function module(string $name,string $version): bool
    {
        if($name!=='MfCloud')return false;
        return (bool)Capabilities::attempt('native-module-contract:'.$name.':'.$version,static function()use($name,$version){
            $registry=\CRA1\Theme\Files::json(CRA1_THEME_BACKEND.'/Compatibility/native-contracts.json');
            $files=$registry['modules'][$name][$version]['files']??[];
            return self::filesMatch(CRA1_THEME_ROOT,$files);
        },false);
    }
}
