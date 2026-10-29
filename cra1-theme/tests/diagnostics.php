<?php
declare(strict_types=1);
require dirname(__DIR__).'/backend/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\Diagnostics;
$root=sys_get_temp_dir().'/cra1-diagnostics-'.bin2hex(random_bytes(6));mkdir($root,0700);$checks=0;
function check($ok,string $label): void {if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function clean(string $path): void {if(is_link($path)||is_file($path)){unlink($path);return;}foreach(scandir($path)as$n)if($n!=='.'&&$n!=='..')clean($path.'/'.$n);rmdir($path);}
try{
 $secret='customer-private-example@example.invalid';
 Files::atomic($root.'/public/web/cra1/example.js','original');
 Files::atomic($root.'/runtime/cra1_theme/config.json',json_encode(['password'=>$secret]));
 mkdir($root.'/public/renamedadmin',0700,true);mkdir($root.'/cra1-theme',0700,true);
 $manifest=['version'=>'v17.3','release'=>'private-release-'.$secret,'release_channel'=>'test',
  'installation_combinations'=>[['system'=>'10.7.4','modules'=>['MfCloud'=>'4.3.0']]],
  'files'=>['public/web/cra1/example.js'=>['sha256'=>hash('sha256','original')],
   'public/cart/template/pc/cra1/missing.js'=>['sha256'=>hash('sha256','missing')]],
  'private_configuration'=>['password'=>$secret]];
 Files::putJson($root.'/runtime/cra1_theme/distribution/current.json',['manifest'=>$manifest]);
 $context=['database'=>true,'system_version'=>'10.7.4','error'=>$secret,'settings'=>['website_url'=>$secret],
  'modules'=>[['name'=>'MfCloud','version'=>'4.3.0','status'=>1],['name'=>$secret,'version'=>$secret,'status'=>1],['name'=>'MfDcim','version'=>$secret,'status'=>0]]];
 $GLOBALS['THEME_REQUEST_ID']=str_repeat('a',24);
 $before=[];foreach(['runtime/cra1_theme/config.json','runtime/cra1_theme/distribution/current.json']as$p)$before[$p]=hash_file('sha256',$root.'/'.$p);
 $out=Diagnostics::collect($root,'renamedadmin',['context'=>$context,'https'=>true]);$data=$out['report'];$text=$out['text'];
 check($data['version']==='v17.3'&&$data['system']==='10.7.4'&&$data['test_build'],'assigned versions and channel are projected');
 check($data['modules']['other_count']===1&&$data['modules']['known']===['MfCloud'=>'4.3.0'],'unknown module identities are counted without disclosure');
 check($data['resources']['website']===['checked'=>1,'missing'=>0,'changed'=>0]&&$data['resources']['cart']['missing']===1,'real resource availability is counted');
 check(in_array('COMBINATION_UNVERIFIED',$data['codes'],true),'unknown combinations remain unverified');
 check(strpos(json_encode($out),$secret)===false&&strpos($text,$root)===false&&strpos($text,'renamedadmin')===false,'no configuration, origin, private release, entry or path leaves the projection');
 check($data['request_id']===$GLOBALS['THEME_REQUEST_ID'],'only a formatted error correlation id is included');
 Files::atomic($root.'/public/web/cra1/example.js','changed');
 check(Diagnostics::collect($root,'renamedadmin',['context'=>$context])['report']['resources']['website']['changed']===1,'changed files are accurately reported');
 foreach($before as$p=>$hash)check(hash_file('sha256',$root.'/'.$p)===$hash,'diagnostics never changes data or version selection');
 $manifest['version']=$secret;$context['system_version']=$secret;$context['modules'][0]['version']=$secret;
 $manifest['files']['../../'.$secret]=['sha256'=>hash('sha256',$secret)];
 Files::putJson($root.'/runtime/cra1_theme/distribution/current.json',['manifest'=>$manifest]);
 $GLOBALS['THEME_REQUEST_ID']=$secret;
 $out=Diagnostics::collect($root,'renamedadmin',['context'=>$context]);
 check($out['report']['version']===null&&$out['report']['system']===null&&$out['report']['request_id']===null,'invalid stored version and correlation strings cannot escape');
 check(strpos(json_encode($out),$secret)===false,'invalid file paths and module versions cannot leak through diagnostics');
 Files::atomic($root.'/runtime/cra1_theme/distribution/pending.json','{}');
 check(Diagnostics::collect($root,'renamedadmin',['context'=>$context])['report']['update_interrupted'],'interrupted update is available as a safe flag');
 Files::atomic($root.'/runtime/cra1_theme/distribution/current.json','{broken');
 $out=Diagnostics::collect($root,'renamedadmin',['context'=>['database'=>false]]);
 check(in_array('THEME_MANIFEST_UNAVAILABLE',$out['report']['codes'],true)&&in_array('SYSTEM_INFO_UNAVAILABLE',$out['report']['codes'],true),'failed reads return fixed codes without exception details');
 echo json_encode(['status'=>'passed','checks'=>$checks])."\n";
}finally{clean($root);}
