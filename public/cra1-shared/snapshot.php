<?php
/** Public display data; never starts an administrator session or writes a snapshot. */
declare(strict_types=1);
$root=dirname(__DIR__,2);$domain=(string)($GLOBALS['THEME_PUBLIC_DOMAIN']??$_GET['domain']??'');
header('Content-Type: application/json; charset=utf-8');header('X-Content-Type-Options: nosniff');header('Cache-Control: no-store');header('X-Robots-Tag: noindex');
if(!in_array($domain,['member','cart'],true)){http_response_code(404);echo json_encode(['status'=>404,'msg'=>'未知展示配置','code'=>'NOT_FOUND']);exit;}
try{
    if(is_file($root.'/runtime/cra1_theme/distribution/pending.json'))throw new RuntimeException('主题更新尚未完成');
    require_once $root.'/cra1-theme/backend/bootstrap.php';
    require_once CRA1_THEME_BACKEND.'/Storage/member_store.php';
    require_once CRA1_THEME_BACKEND.'/Storage/cart_store.php';
    if($domain==='member'){$store=new \CRA1\Theme\Storage\MemberCenterStore($root.'/runtime');$config=$store->read();$data=$store->snapshotProjection($config);}
    else{$store=new \CRA1\Theme\Storage\CartThemeStore($root.'/runtime');$config=$store->read();$data=['schema_version'=>\CRA1\Theme\Storage\CartThemeStore::SCHEMA_VERSION,'version'=>(int)$config['version'],'content'=>$store->publicContent($config),'custom_code'=>CRA1ThemePublicProjection::code($config['custom_code']),'projection_version'=>2];}
    // Effective features and disabled content are projected by the same store implementation.
    echo json_encode(['status'=>200,'msg'=>'已读取','code'=>'OK','data'=>$data],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
}catch(Throwable $e){http_response_code(503);echo json_encode(['status'=>503,'msg'=>'展示配置暂时无法读取','code'=>'SNAPSHOT_UNAVAILABLE'],JSON_UNESCAPED_UNICODE);}
