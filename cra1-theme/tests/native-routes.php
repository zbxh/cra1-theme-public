<?php
declare(strict_types=1);
namespace {
    define('CRA1_THEME_BACKEND', dirname(__DIR__).'/backend');
    require dirname(__DIR__).'/backend/bootstrap.php';
    final class NativeRouteFixture {
        public static array $routes=[];
        public static function rule($path,$target,$method) { self::$routes[]=[$path,$target,$method];return new self(); }
        public function pattern($values) { return $this; }
        public function middleware($value) { return $this; }
    }
    class_alias(NativeRouteFixture::class,'think\\facade\\Route');
    if(($argv[1]??'')==='search-only'){
        CRA1\Theme\Http\Routes::register(true);
        if(count(NativeRouteFixture::$routes)!==1||NativeRouteFixture::$routes[0][0]!=='console/v1/cra1-theme/member/search'||NativeRouteFixture::$routes[0][2]!=='GET')throw new RuntimeException('Website-only search must not register member operations');
        echo 'search-only passed';exit;
    }
    CRA1\Theme\Http\Routes::register();
    $checks=0;
    foreach(NativeRouteFixture::$routes as [$path,$target,$method]) {
        if(!is_string($target)||strpos($target,'\\home\\')===false)throw new RuntimeException('Native V10 string/home route required');$checks++;
        [$class,$action]=explode('@',$target);
        $reflection=new ReflectionMethod($class,$action);
        if(!$reflection->isPublic()||$reflection->isStatic()||$reflection->getNumberOfRequiredParameters()!==1)throw new RuntimeException('Registered native action missing');$checks++;
        if(strpos($path,'console/v1/cra1-theme/')!==0||!in_array($method,['GET','POST','PUT','DELETE'],true))throw new RuntimeException('Native route escaped its scope');$checks++;
    }
    $routes=array_map(static function(array $row): string {return $row[2].' '.$row[0];},NativeRouteFixture::$routes);
    if(count($routes)!==14||count(array_unique($routes))!==14
        ||!in_array('PUT console/v1/cra1-theme/member/product-list/:id/pin',$routes,true)
        ||!in_array('GET console/v1/cra1-theme/member/host/:id/ticket-entry',$routes,true))
        throw new RuntimeException('Native route coverage changed');$checks++;
    $pipes=[];$process=proc_open([PHP_BINARY,__FILE__,'search-only'],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
    $out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    if(proc_close($process)!==0||$out!=='search-only passed')throw new RuntimeException('Website-only route isolation failed: '.$error);$checks++;
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}
