<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/public/cra1admin/preview.php';
$root=sys_get_temp_dir().'/cra1-preview-assets-'.bin2hex(random_bytes(6));
$path='/cra1-shared/icons/releases/test/icon.svg';$file=$root.'/public'.$path;
mkdir(dirname($file),0700,true);file_put_contents($file,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>');
$checks=0;
function previewAssetsCheck(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
try{
    $data=cra1_preview_icon_data($root,$path,'https://preview.invalid');
    previewAssetsCheck(strpos($data,'data:image/svg+xml;base64,')===0,'A local CSS mask uses an in-document asset');
    previewAssetsCheck(cra1_preview_icon_data($root,'https://foreign.invalid'.$path,'https://preview.invalid')==='','Foreign hosts are never read through the local asset path');
    previewAssetsCheck(cra1_preview_icon_data($root,'/cra1-shared/icons/../../private.svg','https://preview.invalid')==='','Traversal is rejected');
    previewAssetsCheck(cra1_preview_icon_data($root,'/private/key.svg','https://preview.invalid')==='','Only public theme icon files can be embedded');
    $html='<span style="--icon:url(\''.$path.'\')"></span><script>var items='.json_encode([['icon_img'=>$path]]).';</script>';
    $next=cra1_preview_inline_icons($root,$html,['item'=>['icon_img'=>$path]],'https://preview.invalid');
    previewAssetsCheck(strpos($next,$path)===false&&strpos($next,str_replace('/','\\/',$path))===false,'Both server-rendered and JSON-escaped dynamic icon paths are embedded');
    preg_match('~var items=(.*);</script>~',$next,$m);$decoded=json_decode($m[1],true);
    previewAssetsCheck(is_array($decoded)&&$decoded[0]['icon_img']===$data,'Inline preview icon data preserves valid JSON');
    echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{unlink($file);for($p=dirname($file);strpos($p,$root)===0;$p=dirname($p))rmdir($p);}
