<?php
declare(strict_types=1);
/** Real original module/ORM contracts with provider responses replaced inside a private fixture. */
if(!defined('CRA1_NATIVE_MODULE_FIXTURE')){
    ob_start();
    require __DIR__.'/native-pipeline.php';
    ob_end_clean();
}elseif(CRA1_NATIVE_MODULE_FIXTURE!==true||\think\facade\Db::query('SELECT @@socket AS socket')[0]['socket']==='/tmp/mysql.sock')throw new RuntimeException('An isolated module fixture is required');
if($result['status']!==200||$result['native_client_id']<=0)throw new RuntimeException('Native member authentication required before fixture writes');
use think\facade\Db;
use CRA1\Theme\Compatibility\MfCloudAdapter;
$checks=[];
$check=static function(bool $ok,string $label)use(&$checks):void {if(!$ok)throw new RuntimeException($label);$checks[]=$label;};
final class NativeModuleProviderFixture {
    public array $remote=['status'=>200,'data'=>['disk'=>[]]];
    public function cloudDetail($id):array {return $this->remote;}
    public function netInfo($id):array {return ['status'=>200,'data'=>['meta'=>['traffic_quota'=>100,'tmp_traffic'=>10,'traffic_type'=>3,'flow_reset_time'=>'2026-11-04 12:34:56','reset_flow_day'=>4],'info'=>['30_day'=>['accept'=>0,'send'=>1073741824,'total'=>1073741824]]]];}
}
final class NativeModuleDownstreamFixture {public function isDownstream():bool {return false;}}
$hostId=0;$otherId=0;
try {
    $module=Db::name('plugin')->where('name','MfCloud')->where('module','server')->value('version');
    $check($module==='4.3.0','original official upgrade reports MfCloud 4.3.0');
    $check(\CRA1\Theme\Compatibility\KnownContracts::security(),'native security source matches registered original contracts');
    $check(\CRA1\Theme\Compatibility\KnownContracts::module('MfCloud',$module),'native module source matches registered original contracts');
    $native=new ReflectionClass('server\\mf_cloud\\logic\\CloudLogic');
    foreach(['hostModel','id','idcsmartCloud','downstreamHostLogic']as$property)$check($native->hasProperty($property)&&!$native->getProperty($property)->isPrivate(),'inherited property '.$property);
    foreach(['diskList','flowDetail']as$method)$check($native->getMethod($method)->isPublic()&&!$native->getMethod($method)->isFinal(),'native callable '.$method);
    $now=time();$client=(int)$result['native_client_id'];
    $hostId=(int)Db::name('host')->insertGetId(['client_id'=>$client,'name'=>'native-module-fixture','status'=>'Active','create_time'=>$now,'due_time'=>$now+86400]);
    $otherId=(int)Db::name('host')->insertGetId(['client_id'=>$client+100000,'name'=>'native-other-owner','status'=>'Active','create_time'=>$now]);
    $disk=static function(int $owner,array $row)use($now):int {return (int)Db::name('module_mf_cloud_disk')->insertGetId($row+['host_id'=>$owner,'name'=>'native-fixture','type2'=>'data','size'=>50,'status'=>3,'create_time'=>$now-20]);};
    $system=$disk($hostId,['type2'=>'system','size'=>20,'status'=>1,'rel_id'=>11]);
    $failed=$disk($hostId,[]);
    $bound=$disk($hostId,['size'=>100,'status'=>1,'rel_id'=>77]);
    Db::name('system_log')->insert(['type'=>'host','rel_id'=>$hostId,'create_time'=>$now-10,'description'=>'订购失败磁盘(GB):50,原因:quota exceeded;']);
    $provider=new NativeModuleProviderFixture();
    $reflection=new ReflectionClass(MfCloudAdapter::class);$logic=$reflection->newInstanceWithoutConstructor();
    foreach(['hostModel'=>['id'=>$hostId,'client_id'=>$client,'create_time'=>$now],'id'=>999,'idcsmartCloud'=>$provider,'downstreamHostLogic'=>new NativeModuleDownstreamFixture()]as$key=>$value){$p=$native->getProperty($key);$p->setAccessible(true);$p->setValue($logic,$value);}
    $rows=$logic->readDisks();$map=array_column($rows['list'],null,'id');
    $check($map[$failed]['status']===4&&$map[$failed]['can_delete']===true,'native parent disk result receives terminal failure state');
    $check($map[$failed]['failure_reason']==='磁盘创建失败'&&strpos(json_encode($rows),'quota exceeded')===false,'provider failure reason stays private');
    $check(!isset($map[$failed]['rel_id'],$map[$failed]['upstream_id']),'disk projection omits remote resource identifiers');
    $flow=$logic->readFlow();
    $check($flow['status']===200&&$flow['data']['reset_flow_time']==='2026-11-04 12:34:56','native flow parent keeps exact reset seconds');
    $check($flow['data']['reset_flow_timestamp']===strtotime('2026-11-04 12:34:56'),'exact flow timestamp matches display');
    $provider->remote=['status'=>503];$reply=$logic->removeFailed($failed);
    $check($reply['status']===409&&Db::name('module_mf_cloud_disk')->where('id',$failed)->count()===1,'unknown remote state forbids deleting a local failure');
    $provider->remote=['status'=>200,'data'=>['disk'=>[]]];
    $reply=$logic->removeFailed($bound);$check($reply['status']===409&&Db::name('module_mf_cloud_disk')->where('id',$bound)->count()===1,'bound remote resource cannot be removed as a failure');
    $foreign=$disk($otherId,['status'=>4]);$reply=$logic->removeFailed($foreign);
    $check($reply['status']===409&&Db::name('module_mf_cloud_disk')->where('id',$foreign)->count()===1,'another owner disk cannot be deleted');
    $reply=$logic->removeFailed($failed);
    $check($reply['status']===200&&Db::name('module_mf_cloud_disk')->where('id',$failed)->count()===0,'proven failed unbound disk is removed through the real ORM transaction');
    $check(Db::name('module_mf_cloud_disk')->whereIn('id',[$bound,$system])->count()===2,'failure cleanup preserves existing disks');
    echo json_encode(['status'=>'passed','checks'=>count($checks),'results'=>$checks,'system'=>'10.7.4','module'=>'MfCloud 4.3.0','native_module'=>true,'native_authentication'=>true,'provider'=>'simulated responses; no provider network or live server writes','production_writes'=>0],JSON_UNESCAPED_UNICODE).PHP_EOL;
} finally {
    foreach([$hostId,$otherId]as$id)if($id>0){Db::name('module_mf_cloud_disk')->where('host_id',$id)->delete();Db::name('system_log')->where('type','host')->where('rel_id',$id)->delete();Db::name('host')->where('id',$id)->delete();}
}
