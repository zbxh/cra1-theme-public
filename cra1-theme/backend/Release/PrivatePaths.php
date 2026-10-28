<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** Explicit installer self-check; ordinary compatibility inspection stays read-only. */
final class PrivatePaths
{
    public static function valid(array $proof,string $root,?string $origin=null): bool
    {
        $valid=!empty($proof['passed'])
            &&hash_equals(hash('sha256',realpath($root)?:$root),(string)($proof['root_hash']??''))
            &&($proof['checked_at']??0)>time()-86400&&($proof['checked_at']??0)<=time();
        return $valid&&($origin===null||rtrim((string)($proof['origin']??''),'/')===rtrim($origin,'/'));
    }

    public static function ensure(string $root,string $origin,?callable $fetch=null): array
    {
        return Files::locked($root.'/runtime/cra1_theme/private-path-check.lock',static function()use($root,$origin,$fetch){
            $proof=Files::json($root.'/runtime/cra1_theme/private-path-check.json',true);
            return self::valid($proof,$root,$origin)?$proof:self::check($root,$origin,'',$fetch);
        });
    }

    /** $fetch is an isolated-test transport, never supplied by an HTTP request. */
    public static function check(string $root,string $origin,string $caFile='',?callable $fetch=null): array
    {
        $root=rtrim($root,'/');$origin=rtrim($origin,'/');$url=parse_url($origin);
        Files::noLinks($root);
        if(realpath($root)!==$root||!is_dir($root.'/public/cra1-install')
            ||!filter_var($origin,FILTER_VALIDATE_URL)||!$url||($url['scheme']??'')!=='https'
            ||empty($url['host'])||isset($url['user'])||isset($url['pass'])||!empty($url['path'])
            ||isset($url['query'])||isset($url['fragment']))throw new \InvalidArgumentException('请使用本站有效的 HTTPS 地址进行安装检查');
        if($caFile!==''&&($caFile[0]!=='/'||!is_file($caFile)||!is_readable($caFile)))throw new \InvalidArgumentException('自检证书文件不可用');
        if($fetch===null&&!extension_loaded('curl'))throw new \RuntimeException('安装检查需要启用 PHP cURL 扩展');
        $fetch=$fetch??static function(string $target)use($caFile){return self::request($target,$caFile);};
        $id=bin2hex(random_bytes(12));$token='cra1-check-'.bin2hex(random_bytes(24));$paths=[];$rows=[];
        try{
            // A known public response proves this HTTPS origin reaches this installation.
            // An unrelated server returning 404 everywhere cannot pass the private checks.
            $route='/cra1-install/cra1-probe-'.$id.'.txt';$path=$root.'/public'.$route;
            Files::atomic($path,$token,0644);$paths[]=$path;$response=$fetch($origin.$route);
            $publicOk=($response['error']??1)===0&&($response['status']??0)===200
                &&hash_equals($token,(string)($response['body']??''));
            $rows[]=['path'=>$route,'status'=>(int)($response['status']??0),'passed'=>$publicOk];
            if($publicOk){
                foreach(['runtime/cra1_theme','config','cra1-theme/backend']as$dir){
                    $relative=$dir.'/cra1-check-'.$id.'.txt';$path=$root.'/'.$relative;
                    Files::atomic($path,$token,0644);$paths[]=$path;
                    foreach(['/'.$relative,'/public/'.$relative]as$route){
                        $response=$fetch($origin.$route);$status=(int)($response['status']??0);
                        $rows[]=['path'=>$route,'status'=>$status,'passed'=>($response['error']??1)===0
                            &&in_array($status,[403,404],true)&&strpos((string)($response['body']??''),$token)===false];
                    }
                }
            }
            $passed=count($rows)===7&&!in_array(false,array_column($rows,'passed'),true);
            $proof=['format'=>1,'origin'=>$origin,'root_hash'=>hash('sha256',$root),'checked_at'=>time(),'passed'=>$passed,'checks'=>$rows];
            Files::putJson($root.'/runtime/cra1_theme/private-path-check.json',$proof,0600);
            return $proof;
        }finally{foreach($paths as$path)if(is_file($path))unlink($path);}
    }

    private static function request(string $url,string $caFile): array
    {
        $body='';$ch=curl_init($url);
        curl_setopt_array($ch,[CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>5,
            CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
            CURLOPT_HTTPHEADER=>['Accept: text/plain'],CURLOPT_WRITEFUNCTION=>static function($handle,string $chunk)use(&$body){
                if(strlen($body)+strlen($chunk)>65536)return 0;$body.=$chunk;return strlen($chunk);
            }]);
        if($caFile!=='')curl_setopt($ch,CURLOPT_CAINFO,$caFile);
        curl_exec($ch);$result=['body'=>$body,'status'=>(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE),'error'=>curl_errno($ch)];
        curl_close($ch);return $result;
    }
}
