<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\PrivatePaths;

$base=sys_get_temp_dir().'/cra1-private-paths-'.bin2hex(random_bytes(6));$checks=0;
function check($value,$message){if(!$value)throw new RuntimeException($message);$GLOBALS['checks']++;}
function cleanup($path){if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')cleanup($path.'/'.$name);rmdir($path);}
function temporaryFiles($root){$found=[];foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS))as$file)if(preg_match('/cra1-(?:probe|check)-[a-f0-9]+\.txt$/',$file->getFilename()))$found[]=$file->getPathname();return $found;}

try{
    Files::atomic($base.'/public/cra1-install/index.php','fixture');
    $requests=[];
    $safe=static function(string $url)use($base,&$requests){
        $path=parse_url($url,PHP_URL_PATH);$requests[]=$path;
        if(strpos($path,'/cra1-install/cra1-probe-')===0)return ['status'=>200,'error'=>0,'body'=>file_get_contents($base.'/public'.$path)];
        return ['status'=>404,'error'=>0,'body'=>'Not found'];
    };
    $proof=PrivatePaths::ensure($base,'https://fixture.invalid',$safe);
    check($proof['passed']&&count($requests)===7,'fresh installation automatically verifies public origin and six private paths');
    check(temporaryFiles($base)===[],'successful self-check removes all temporary files');
    check((fileperms($base.'/runtime/cra1_theme/private-path-check.json')&0777)===0600,'only the private proof remains, with restricted permissions');
    check(strpos(json_encode($proof),'cra1-check-')!==false&&strpos(json_encode($proof),'body')===false,'proof records paths and results, never response bodies or probe secrets');
    check(PrivatePaths::valid($proof,$base,'https://fixture.invalid'),'proof is valid for this installation');
    check(!PrivatePaths::valid($proof,$base.'/other','https://fixture.invalid'),'proof cannot transfer to another installation');
    check(!PrivatePaths::valid($proof,$base,'https://other.invalid'),'proof cannot transfer to another site');
    $cached=PrivatePaths::ensure($base,'https://fixture.invalid',$safe);
    check($cached===$proof&&count($requests)===7,'checking again reuses a valid server-side result');
    $old=$proof;$old['checked_at']=time()-86401;Files::putJson($base.'/runtime/cra1_theme/private-path-check.json',$old);
    check(PrivatePaths::ensure($base,'https://fixture.invalid',$safe)['passed']&&count($requests)===14,'expired result is automatically checked again');
    $future=$proof;$future['checked_at']=time()+60;
    check(!PrivatePaths::valid($future,$base,'https://fixture.invalid'),'future-dated proof cannot pass');
    $requests=[];
    $wrongOrigin=PrivatePaths::check($base,'https://fixture.invalid','',static function($url)use(&$requests){$requests[]=$url;return ['status'=>404,'error'=>0,'body'=>'Not found'];});
    check(!$wrongOrigin['passed']&&count($requests)===1,'an unrelated origin returning 404 cannot pass or trigger private probes');
    check($wrongOrigin['outcome']==='inconclusive'&&PrivatePaths::assessment($wrongOrigin,$base,'https://fixture.invalid')['status']==='warning','an unconfirmed origin is advisory rather than evidence of exposure');
    $fallback=PrivatePaths::check($base,'https://fixture.invalid','',static function($url)use($safe){
        return strpos($url,'/cra1-install/')!==false?$safe($url):['status'=>200,'error'=>0,'body'=>'<html>V10 home or custom not-found page</html>'];
    });
    check($fallback['passed']&&$fallback['outcome']==='protected','a public-root V10 fallback with HTTP 200 does not leak the actual private file');
    $redirect=PrivatePaths::check($base,'https://fixture.invalid','',static function($url)use($safe){return strpos($url,'/cra1-install/')!==false?$safe($url):['status'=>302,'error'=>0,'body'=>''];});
    check(!$redirect['passed']&&$redirect['outcome']==='inconclusive','redirects remain unconfirmed instead of being falsely classified as file exposure');
    check(PrivatePaths::assessment($redirect,$base,'https://fixture.invalid')['status']==='warning','a redirect alone does not block installation');
    $failure=PrivatePaths::check($base,'https://fixture.invalid','',static function(){return ['status'=>0,'error'=>60,'body'=>''];});
    check(!$failure['passed']&&$failure['outcome']==='inconclusive','TLS or network failure is not falsely described as safe');
    check(PrivatePaths::assessment($failure,$base,'https://fixture.invalid')['status']==='warning','a network failure is optional installation information');
    $calls=0;
    $cached=PrivatePaths::ensure($base,'https://fixture.invalid',static function()use(&$calls){$calls++;throw new RuntimeException('must reuse the recent diagnostic');});
    check($cached===$failure&&$calls===0,'install submission reuses a recent inconclusive diagnosis');
    $retried=PrivatePaths::ensure($base,'https://fixture.invalid',$safe,true);
    check($retried['passed'],'clicking check explicitly refreshes a cached inconclusive result');
    $exposed=PrivatePaths::check($base,'https://fixture.invalid','',static function($url)use($base,$safe){
        $path=parse_url($url,PHP_URL_PATH);
        if(strpos($path,'/config/cra1-check-')===0)return ['status'=>200,'error'=>0,'body'=>file_get_contents($base.$path)];
        return $safe($url);
    });
    check(!$exposed['passed']&&$exposed['outcome']==='exposed','only actual private probe content proves exposure');
    check(PrivatePaths::assessment($exposed,$base,'https://fixture.invalid')['status']==='blocked','confirmed exposure still blocks initialization');
    $failure=PrivatePaths::check($base,'https://fixture.invalid','',static function(){return ['status'=>0,'error'=>60,'body'=>''];});
    check($failure['outcome']==='exposed'&&isset($failure['last_attempt_at']),'a failed retry cannot erase an earlier confirmed leak');
    check(PrivatePaths::ensure($base,'https://fixture.invalid',$safe,true)['passed'],'a fresh successful check clears exposure after the real mapping is fixed');
    $legacy=$exposed;unset($legacy['format'],$legacy['outcome']);
    check(PrivatePaths::assessment($legacy,$base,'https://fixture.invalid')['status']==='warning','a legacy failed status without content evidence cannot prove exposure');
    check(PrivatePaths::assessment($exposed,$base,'https://different.invalid')['status']==='warning','an exposure report cannot transfer between sites');
    Files::atomic($base.'/runtime/cra1_theme/private-path-check.json','malformed diagnostic');
    check(PrivatePaths::ensure($base,'https://fixture.invalid',$safe)['passed'],'a malformed optional report can be regenerated without touching theme configuration');
    $rejected=false;try{PrivatePaths::check($base,'https://fixture.invalid','',static function(){throw new RuntimeException('isolated transport failure');});}catch(RuntimeException $error){$rejected=true;}
    check($rejected&&temporaryFiles($base)===[],'unexpected transport failure removes probes before returning');
    foreach(['http://fixture.invalid','https://user:pass@fixture.invalid','https://fixture.invalid/path','https://fixture.invalid?target=elsewhere','https://fixture.invalid#fragment']as$origin){
        $rejected=false;try{PrivatePaths::check($base,$origin,'',$safe);}catch(InvalidArgumentException $error){$rejected=true;}
        check($rejected,'only an HTTPS origin is accepted');
    }
    check(temporaryFiles($base)===[],'invalid requests leave no temporary files');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{cleanup($base);}
