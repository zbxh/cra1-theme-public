<?php
declare(strict_types=1);
if(!defined('CRA1_THEME_BACKEND'))define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
use CRA1\Theme\Files;
use CRA1\Theme\Release\Identity;
$source=dirname(__DIR__,2);$base=sys_get_temp_dir().'/cra1-identity-'.bin2hex(random_bytes(6));$checks=0;
function check($value,$label){if(!$value)throw new RuntimeException($label);$GLOBALS['checks']++;}
function clean($p){if(is_file($p)||is_link($p)){unlink($p);return;}foreach(scandir($p)as$n)if($n!=='.'&&$n!=='..')clean($p.'/'.$n);rmdir($p);}
try{
 $identity=Identity::read($source);$text=file_get_contents($source.'/cra1-theme/LICENSE.txt');
 Files::putJson($base.'/cra1-theme/docs/product-identity.json',$identity);
 Files::atomic($base.'/cra1-theme/LICENSE.txt',$text);
 $terms=json_decode(file_get_contents($source.'/cra1-theme/docs/repository-license.json'),true,512,JSON_THROW_ON_ERROR);
 check($terms['version']===3&&strpos($text,$terms['title'])===0,'repository license revision matches the current text');
 check(!isset($identity['license'])&&!method_exists(Identity::class,'license'),'runtime identity does not expose repository terms');
 check($identity['session_cookie']==='CRA1THEMEID'&&$identity['member_api_prefix']==='/console/v1/cra1-theme/','public contracts retain the CRA1 identity');
 foreach(['100,000 元（含本数）','超过人民币 100,000 元','连续 90 个自然日','低于人民币 80,000 元','80,000 元（含本数）','已结束的完整自然季度','不重新计算宽限期','不因后来未补办而追溯','须事先取得单独的书面授权','不采集或上传营业收入','不是允许无限制商用']as$clause)check(strpos($text,$clause)!==false,'full license retains agreed clause: '.$clause);
 $summary=implode("\n",$terms['summary']);
 check(file_get_contents($source.'/LICENSE')===$text,'repository license copies are byte identical');
 foreach(['官网公共页脚和主题后台主内容底部','主题：酷锐A1','明确允许移除底部署名的付费书面授权','不自动包含去署名权利']as$clause)check(strpos($text,$clause)!==false,'footer attribution terms: '.$clause);
 check(strpos($summary,'付费书面授权')!==false&&strpos($summary,'不自动包含去署名权利')!==false,'summary distinguishes paid attribution waiver from deployment authorization');
 foreach(['全部业务营业收入','100,000 元（含本数）','连续 90 个自然日','80,000 元（含本数）','已结束的完整自然季度','转授权','不远端激活','第三方']as$clause)check(strpos($summary,$clause)!==false,'displayed summary retains agreed clause: '.$clause);
 unlink($base.'/cra1-theme/LICENSE.txt');
 check(Identity::read($base)===$identity,'runtime identity works without any repository license file');
 $legacy=$identity+['license'=>$terms,'credential'=>['subject'=>'private-fixture'],'unknown'=>'private-fixture'];
 Files::putJson($base.'/cra1-theme/docs/product-identity.json',$legacy);
 check(Identity::read($base)===$identity,'old identity projects only product information');
 $legacy['theme_id']='different';Files::putJson($base.'/cra1-theme/docs/product-identity.json',$legacy);
 $rejected=false;try{Identity::read($base);}catch(Throwable $e){$rejected=true;}check($rejected,'invalid identity is still rejected');
 unlink($base.'/cra1-theme/docs/product-identity.json');
 $rejected=false;try{Identity::read($base);}catch(Throwable $e){$rejected=true;}check($rejected,'missing runtime identity remains an error');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
}finally{if(is_dir($base))clean($base);}
