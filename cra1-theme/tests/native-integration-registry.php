<?php
declare(strict_types=1);
define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
require CRA1_THEME_BACKEND.'/bootstrap.php';
$root=realpath($argv[1]??'');$official=realpath($argv[2]??'');
if(!$root||!$official)throw new InvalidArgumentException('Installed and official read-only source roots are required');
$registry=json_decode(file_get_contents(CRA1_THEME_BACKEND.'/Compatibility/native-contracts.json'),true,512,JSON_THROW_ON_ERROR);
$profiles=json_decode(file_get_contents(dirname(__DIR__).'/source/native-integration-profiles.json'),true,512,JSON_THROW_ON_ERROR);
$review=hash_file('sha256',dirname(__DIR__).'/docs/native-integration-review.md');$checks=0;
$check=static function($ok,$label)use(&$checks){if(!$ok)throw new RuntimeException($label);$checks++;};
$security=$registry['systems']['10.7.4'];$module=$registry['modules']['MfCloud']['4.3.0'];
foreach([$security['profiles'][0],$module['profiles'][0],$profiles['profiles'][0]]as$profile)$check($profile['review_sha256']===$review,'review evidence hash matches');
foreach([[$security['security_files'],$security['profiles']],[$module['files'],$module['profiles']]]as[$files,$alternates]){
    $check(\CRA1\Theme\Compatibility\KnownContracts::matchProfile($root,$files,$alternates)===$alternates[0]['id'],'installed integration matches complete registered combination');
    $check(\CRA1\Theme\Compatibility\KnownContracts::matchProfile($official,$files,$alternates)==='official','original official files remain accepted');
    foreach($alternates[0]['files']as$path=>$hash)$check(($profiles['profiles'][0]['files'][$path]??'')===$hash,'runtime and release profiles share dependency fingerprints');
}
echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
