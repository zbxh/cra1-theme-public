<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;

final class LicenseCredential
{
    public static function validate(array $doc): void
    {
        if(array_diff(array_keys($doc),['issuer','key_id','serial','subject','sites','scope','issued_at','expires_at','signature']))throw new \InvalidArgumentException('授权凭证包含未知字段');
        foreach(['issuer','key_id','serial','subject','scope','issued_at'] as $key)if(!is_string($doc[$key]??null)||trim($doc[$key])===''||strlen($doc[$key])>2000||preg_match('/[\x00-\x1f]/',$doc[$key]))throw new \InvalidArgumentException('授权凭证缺少有效的'.$key);
        if(!preg_match('/^[A-Za-z0-9_-]{3,64}$/D',$doc['key_id'])||!preg_match('/^[A-Za-z0-9_.-]{3,100}$/D',$doc['serial']))throw new \InvalidArgumentException('授权凭证编号无效');
        if(!is_array($doc['sites']??null)||!$doc['sites']||count($doc['sites'])>100)throw new \InvalidArgumentException('授权站点列表无效');
        foreach($doc['sites'] as $site){
            if(!is_string($site))throw new \InvalidArgumentException('授权站点格式无效');$u=parse_url($site);
            if(!filter_var($site,FILTER_VALIDATE_URL)||!in_array($u['scheme']??'',['https','http'],true)||!empty($u['path'])||isset($u['query'])||isset($u['fragment'])||isset($u['user']))throw new \InvalidArgumentException('授权站点必须是完整的站点源地址');
        }
        foreach(['issued_at','expires_at'] as $key){
            if($key==='expires_at'&&($doc[$key]??null)===null)continue;
            $date=\DateTimeImmutable::createFromFormat('!Y-m-d',(string)($doc[$key]??''));
            if(!$date||$date->format('Y-m-d')!==$doc[$key])throw new \InvalidArgumentException('授权日期无效');
        }
        if(!empty($doc['expires_at'])&&$doc['expires_at']<$doc['issued_at'])throw new \InvalidArgumentException('授权到期日期早于签发日期');
    }
    public static function canonical(array $doc): string
    {
        unset($doc['signature']);ksort($doc);
        return json_encode($doc,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
    }
    public static function inspect(array $doc,string $root): array
    {
        if(!$doc)return ['valid'=>false,'status'=>'未登记商业授权凭证；符合免费使用条件时无需登记','runtime_enforcement'=>false];
        self::validate($doc);
        $trusted=\CRA1\Theme\Files::json($root.'/cra1-theme/licenses/issuer-keys.json',true);
        $key=base64_decode((string)($trusted[$doc['key_id']??'']??''),true);
        $sig=base64_decode((string)($doc['signature']??''),true);
        $valid=is_string($key)&&strlen($key)===SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES&&is_string($sig)&&strlen($sig)===SODIUM_CRYPTO_SIGN_BYTES&&sodium_crypto_sign_verify_detached($sig,self::canonical($doc),$key);
        return ['valid'=>$valid,'status'=>$valid?'发行方签名有效，请按凭证范围使用':'未验证的签名，请向发行方核对','credential'=>array_diff_key($doc,['signature'=>true]),'runtime_enforcement'=>false];
    }
}
