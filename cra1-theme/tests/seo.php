<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
require CRA1_THEME_BACKEND.'/Support/cra1_theme_seo.php';
$base=sys_get_temp_dir().'/cra1-seo-'.bin2hex(random_bytes(6));mkdir($base.'/public/web/cra1/controller',0700,true);mkdir($base.'/runtime/cra1_theme',0700,true);
foreach(['SeoRegistry.php','PageModuleRegistry.php']as$file)symlink(CRA1_THEME_ROOT.'/public/web/cra1/controller/'.$file,$base.'/public/web/cra1/controller/'.$file);
$checks=0;function check($ok,$label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
function cleanup($path){if(is_file($path)||is_link($path)){unlink($path);return;}foreach(scandir($path)as$name)if($name!=='.'&&$name!=='..')cleanup($path.'/'.$name);rmdir($path);}
try{
 $robots="User-agent: ShopBot\nDisallow: /private-shop/\nSitemap: https://merchant.invalid/custom.xml\n";
 file_put_contents($base.'/public/robots.txt',$robots);file_put_contents($base.'/public/sitemap.xml','merchant-map');file_put_contents($base.'/runtime/cra1_theme/config.json','{"seo_page_meta_json":""}');
 $hash=hash_file('sha256',$base.'/runtime/cra1_theme/config.json');
 theme_generate_seo($base,'https://fixture.invalid');$result=file_get_contents($base.'/public/robots.txt');
 // Another theme's historical helper must neither suppress CRA1 SEO nor make a second include fatal.
 $probe='function cloud_seo_page_meta(){};include $argv[1];include $argv[1];echo json_encode([function_exists("cra1_seo_page_meta_raw"),function_exists("cra1_seo_resolve_page")]);';
 $pipes=[];$process=proc_open([PHP_BINARY,'-r',$probe,CRA1_THEME_ROOT.'/public/web/cra1/controller/SeoRegistry.php'],[1=>['pipe','w'],2=>['pipe','w']],$pipes);
 $out=stream_get_contents($pipes[1]);$error=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$status=proc_close($process);
 check($status===0&&$error===''&&json_decode($out,true)===[true,true],'CRA1 SEO loads independently and repeated inclusion is safe');
 check(strpos($result,$robots)===0,'merchant robots preserved');check(file_get_contents($base.'/public/sitemap.xml')==='merchant-map','shared sitemap never overwritten');
 check(substr_count($result,'# BEGIN CRA1 THEME')===1,'one managed section');check(strpos($result,'Sitemap: https://fixture.invalid/cra1-sitemap.xml')!==false,'independent sitemap registered');
 check(count(glob($base.'/runtime/cra1_theme/seo-backups/*'))===1,'robots backed up');
 theme_generate_seo($base,'https://fixture.invalid');check(file_get_contents($base.'/public/robots.txt')===$result,'SEO generation idempotent');
 check(hash_file('sha256',$base.'/runtime/cra1_theme/config.json')===$hash,'SEO does not rewrite main config');
 file_put_contents($base.'/public/cra1-sitemap.xml','external change');$failed=false;try{theme_generate_seo($base,'https://fixture.invalid');}catch(RuntimeException $e){$failed=true;}
 check($failed,'external sitemap change must block overwrite');check(file_get_contents($base.'/public/cra1-sitemap.xml')==='external change','external file unchanged');
 file_put_contents($base.'/runtime/cra1_theme/config.json','broken');$failed=false;try{theme_generate_seo($base,'https://fixture.invalid');}catch(RuntimeException $e){$failed=true;}
 check($failed&&file_get_contents($base.'/runtime/cra1_theme/config.json')==='broken','corrupted main JSON preserved');
 echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0])."\n";
}finally{cleanup($base);}
