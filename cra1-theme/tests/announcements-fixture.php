<?php
/** CLI-only fixture adapter. Never included in runtime packages. */
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
date_default_timezone_set('Asia/Shanghai');
$root=$argv[1];$input=json_decode((string)stream_get_contents(STDIN),true);
$store=new \CRA1\Theme\Storage\AnnouncementStore($root,new \CRA1\Theme\Announcements\PageCatalog($root,[]));
$body=$input['body']??[];
try {
    switch ($input['action']) {
        case 'seed':
            $result=$store->save($store->payload()['revision'],$body,'fixture');break;
        case 'api.workspace.get':$result=['status'=>200,'data'=>$store->payload()];break;
        case 'api.workspace.save':$result=$store->save($body['expectedRevision'],$body['patch'],'fixture');break;
        case 'api.announcements.preview':
            $data=$store->publicPayload($body['theme'],$body['path'],null,$body['values'],true);
            $data['assets']=['css'=>'/shared/cra1-shared.css','js'=>'/shared/announcements-preview.js'];$result=['status'=>200,'data'=>$data];break;
        case 'api.announcements.legacy-draft':
            $source=$body['source'];
            $converted=[];
            foreach (['original','values'] as $key) {
                $values=$source==='member'?\CRA1\Theme\Announcements\LegacyMigration::fromValues([],['notices'=>$body[$key]]):\CRA1\Theme\Announcements\LegacyMigration::fromValues($body[$key],[]);
                $converted[$key]=$store->normalize($values,$values,false)['items'];
            }
            $result=['status'=>200,'data'=>$converted];break;
        case 'public':$result=['status'=>200,'data'=>$store->publicPayload($body['theme'],$body['path'],null,null,($body['viewer_member']??false)===true)];break;
        case 'all-public':$member=($body['viewer_member']??false)===true;$result=['status'=>200,'data'=>$store->allPublicPayload(null,$member)+['member_authenticated'=>$member]];break;
        case 'api.icons.resolve':
            require_once CRA1_THEME_ROOT.'/public/cra1-shared/icons.php';
            $result=['status'=>200,'data'=>['icons'=>array_map(static fn($icon)=>cra1_icons_resolve($icon['value'],$icon['context']),$body['items'])]];break;
        case 'api.icons.catalog':
            require_once CRA1_THEME_ROOT.'/public/cra1-shared/icons.php';
            $result=['status'=>200,'data'=>cra1_icons_data('catalog')+['initial'=>cra1_icons_page($body['category']??'builtin',0)]];break;
        case 'api.icons.page':
            require_once CRA1_THEME_ROOT.'/public/cra1-shared/icons.php';
            $result=['status'=>200,'data'=>cra1_icons_page($body['prefix'],(int)($body['page']??0))];break;
        case 'api.link-options':$result=['status'=>200,'data'=>['pages'=>[['label'=>'首页','url'=>'/index.html'],['label'=>'文档中心','url'=>'/document.html']]]];break;
        case 'api.product-options':$result=['status'=>200,'data'=>['groups'=>[['id'=>1,'name'=>'云服务器'],['id'=>2,'name'=>'域名服务']],'products'=>[['id'=>1,'name'=>'示例云服务器','group'=>'云服务器','url'=>'/cart/goods.htm?id=1'],['id'=>2,'name'=>'示例域名','group'=>'域名服务','url'=>'/cart/goods.htm?id=2']]]];break;
        default:$result=['status'=>200,'data'=>['config'=>[]]];
    }
} catch (Throwable $e) { $result=['status'=>400,'msg'=>$e->getMessage()]; }
echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
