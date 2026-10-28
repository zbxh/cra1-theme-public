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
            &&(!isset($proof['outcome'])||$proof['outcome']==='protected')
            &&hash_equals(hash('sha256',realpath($root)?:$root),(string)($proof['root_hash']??''))
            &&($proof['checked_at']??0)>time()-86400&&($proof['checked_at']??0)<=time();
        return $valid&&($origin===null||rtrim((string)($proof['origin']??''),'/')===rtrim($origin,'/'));
    }

    /** A failed HTTP probe is not evidence that a private file was downloaded. */
    public static function assessment(array $proof,string $root,?string $origin=null): array
    {
        if(self::valid($proof,$root,$origin))return ['status'=>'pass','detail'=>'未发现私有测试文件可被下载'];
        if(self::exposed($proof,$root,$origin))return ['status'=>'blocked','detail'=>'检测到私有测试文件可被下载，请检查站点的目录映射或静态文件规则后重试'];
        return ['status'=>'warning','detail'=>'文件访问诊断暂未完成，不影响安装'];
    }

    private static function exposed(array $proof,string $root,?string $origin): bool
    {
        return ($proof['format']??0)===2&&($proof['outcome']??'')==='exposed'
            &&hash_equals(hash('sha256',realpath($root)?:$root),(string)($proof['root_hash']??''))
            &&($proof['checked_at']??0)>0&&($proof['checked_at']??0)<=time()
            &&($origin===null||rtrim((string)($proof['origin']??''),'/')===rtrim($origin,'/'));
    }

    private static function read(string $root): array
    {
        try{return Files::json($root.'/runtime/cra1_theme/private-path-check.json',true);}
        catch(\Throwable $error){return [];}
    }

    public static function ensure(string $root,string $origin,?callable $fetch=null,bool $refresh=false): array
    {
        return Files::locked($root.'/runtime/cra1_theme/private-path-check.lock',static function()use($root,$origin,$fetch,$refresh){
            $proof=self::read($root);
            $recent=($proof['format']??0)===2&&in_array($proof['outcome']??'',['inconclusive','exposed'],true)
                &&hash_equals(hash('sha256',realpath($root)?:$root),(string)($proof['root_hash']??''))
                &&rtrim((string)($proof['origin']??''),'/')===rtrim($origin,'/')
                &&($proof['checked_at']??0)>time()-300&&($proof['checked_at']??0)<=time();
            return !$refresh&&(self::valid($proof,$root,$origin)||$recent)?$proof:self::check($root,$origin,'',$fetch);
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
            $rows[]=['path'=>$route,'status'=>(int)($response['status']??0),'passed'=>$publicOk,'result'=>$publicOk?'origin':'inconclusive'];
            if($publicOk){
                foreach(['runtime/cra1_theme','config','cra1-theme/backend']as$dir){
                    $relative=$dir.'/cra1-check-'.$id.'.txt';$path=$root.'/'.$relative;
                    Files::atomic($path,$token,0644);$paths[]=$path;
                    foreach(['/'.$relative,'/public/'.$relative]as$route){
                        $response=$fetch($origin.$route);$status=(int)($response['status']??0);
                        // V10 rewrites, custom error pages and SPA fallbacks commonly return 200.
                        // Only this request's unpredictable file contents prove exposure.
                        $leaked=$status>0&&strpos((string)($response['body']??''),$token)!==false;
                        $protected=!$leaked&&($response['error']??1)===0
                            &&(($status>=200&&$status<300)||($status>=400&&$status<500));
                        $rows[]=['path'=>$route,'status'=>$status,'passed'=>$protected,
                            'result'=>$leaked?'exposed':($protected?'protected':'inconclusive')];
                    }
                }
            }
            $results=array_column($rows,'result');
            $outcome=in_array('exposed',$results,true)?'exposed':(count($rows)===7&&!in_array(false,array_column($rows,'passed'),true)?'protected':'inconclusive');
            $proof=['format'=>2,'origin'=>$origin,'root_hash'=>hash('sha256',$root),'checked_at'=>time(),
                'passed'=>$outcome==='protected','outcome'=>$outcome,'checks'=>$rows];
            // An inconclusive retry cannot erase an earlier confirmed leak. A successful
            // fresh diagnostic clears it after the administrator fixes the actual mapping.
            $previous=self::read($root);
            if($outcome==='inconclusive'&&self::exposed($previous,$root,$origin)){
                $proof=$previous;$proof['last_attempt_at']=time();
            }
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
