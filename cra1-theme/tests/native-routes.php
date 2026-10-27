<?php
declare(strict_types=1);
namespace {
    require dirname(__DIR__).'/backend/bootstrap.php';
    final class NativeRouteFixture {
        public static array $routes=[];
        public static function rule($path,$target,$method) { self::$routes[]=[$path,$target,$method];return new self(); }
        public function pattern($values) { return $this; }
        public function middleware($value) { return $this; }
    }
    class_alias(NativeRouteFixture::class,'think\\facade\\Route');
    CRA1\Theme\Http\Routes::register();
    $checks=0;
    foreach(NativeRouteFixture::$routes as [$path,$target,$method]) {
        if(!is_string($target)||strpos($target,'\\home\\')===false)throw new RuntimeException('Native V10 string/home route required');$checks++;
        [$class,$action]=explode('@',$target);
        $reflection=new ReflectionMethod($class,$action);
        if(!$reflection->isPublic()||$reflection->isStatic()||$reflection->getNumberOfRequiredParameters()!==1)throw new RuntimeException('Registered native action missing');$checks++;
        if(strpos($path,'console/v1/cra1-theme/')!==0||!in_array($method,['GET','POST','PUT','DELETE'],true))throw new RuntimeException('Native route escaped its scope');$checks++;
    }
    if(count(NativeRouteFixture::$routes)!==10)throw new RuntimeException('Native route coverage changed');$checks++;
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}
