<?php
declare(strict_types=1);
namespace think\facade {
    class Db {static function name($table){return new Query($table);}}
    class Query {private string $table;function __construct($table){$this->table=$table;}function where(...$args){return $this;}function find(){return $this->table==='plugin'?['status'=>1]:null;}function value($key){return '4.3.0';}}
    class Cache {static function has($key){return false;}}
}
namespace app\home\model {class ClientareaAuthRuleModel {function getAuthName($rule){return 'native permission';}}}
namespace app\common\model {
    class HostModel {
        static function where($key,$value){return (new HostQuery())->where($key,$value);}
    }
    class HostQuery {
        private array $filters=[];
        function where($key,$value){$this->filters[$key]=$value;return $this;}
        function find(){return ($this->filters['id']??0)===24&&($this->filters['client_id']??0)===7?new Host():null;}
    }
    class Host extends \ArrayObject {function __construct(){parent::__construct(['id'=>24]);}function getModule(){return 'mf_cloud';}}
}
namespace server\mf_cloud\controller\home {
    class CloudController {
        function disk(){return $this->read('disks');}function flowDetail(){return $this->read('flow');}function diskUnmount(){throw new \RuntimeException('mutation reached');}
        private function read($action){$GLOBALS['reads']++;if($GLOBALS['throw'])throw new \RuntimeException('private provider exception');return new \Reply($GLOBALS['native'][$action]);}
    }
}
namespace {
    $root=sys_get_temp_dir().'/cra1-read-fallback-'.bin2hex(random_bytes(5));mkdir($root,0700);define('CRA1_THEME_ROOT',$root);
    if(!defined('CRA1_THEME_BACKEND'))define('CRA1_THEME_BACKEND',dirname(__DIR__).'/backend');
    require dirname(__DIR__).'/backend/bootstrap.php';
    use CRA1\Theme\Compatibility\ModuleAdapter;
    $checks=0;$reads=0;$throw=false;$allowed=true;$visible=null;$client=7;
    function check($ok,$label){if(!$ok)throw new RuntimeException($label);$GLOBALS['checks']++;}
    function configuration($name){return $name==='system_version'?'10.7.4':0;}function parse_name($name,$type){return 'MfCloud';}function get_client_id($parent=true){return $GLOBALS['client'];}
    function hook($name,$args=[]){if($name==='home_check_access')return [['status'=>$GLOBALS['allowed']?200:403]];if($name==='get_client_host_id'&&$GLOBALS['visible']!==null)return [['status'=>200,'data'=>['host'=>$GLOBALS['visible']]]];return [];}
    class Reply {private array $data;function __construct($data){$this->data=$data;}function getData(){return $this->data;}}
    class Req {public string $verb='GET';public int $id=24;function method(){return $this->verb;}function param($key){return $key==='id'?$this->id:1;}}
    $native=[
        'disks'=>['status'=>200,'msg'=>'private provider','data'=>['list'=>[['id'=>55,'name'=>'data','size'=>40,'type2'=>'data','status'=>4,'rel_id'=>900,'upstream_id'=>800,'can_delete'=>true,'failure_reason'=>'private provider','password'=>'secret']],'internal'=>'secret']],
        'flow'=>['status'=>200,'data'=>['total'=>'100GB','used'=>'20GB','total_num'=>100,'used_num'=>20,'reset_flow_time'=>'2026-11-04 00:00:00','flow_reset_cycle'=>'month','flow_reset_cycle_num'=>1,'flow_packet'=>['leave_size'=>27,'total_size'=>30,'used_size'=>3,'secret'=>'private'],'api_secret'=>'private']],
    ];
    try {
        $r=new Req();$disks=ModuleAdapter::run('disks',$r);
        check($disks['status']===200&&$disks['data']['list'][0]['id']===55,'ordinary native disk read works without enhanced contract');
        check($disks['data']['list'][0]['can_delete']===false,'fallback cannot enable enhanced failed disk deletion');
        check(strpos(json_encode($disks),'private')===false&&strpos(json_encode($disks),'secret')===false&&!isset($disks['data']['list'][0]['rel_id'],$disks['data']['list'][0]['upstream_id']),'disk projection omits provider fields and diagnostics');
        $flow=ModuleAdapter::run('flow',$r);
        check($flow['status']===200&&$flow['data']['flow_packet']['leave_size']===27,'native flow and packet display retained');
        check($flow['data']['reset_flow_time']==='2026-11-04 00:00:00'&&$flow['data']['flow_reset_cycle']==='month','exact reset time and cycle retained');
        check(strpos(json_encode($flow),'private')===false,'flow projection excludes unknown provider configuration');
        $before=$reads;$r->verb='DELETE';$reply=ModuleAdapter::run('deleteFailedDisk',$r);check($reply['status']===503&&$reads===$before,'unverified enhanced deletion stays blocked');
        $reply=ModuleAdapter::run('disks',$r);check($reply['status']===405&&$reads===$before,'native read fallback never accepts mutation verbs');$r->verb='GET';
        $allowed=false;$reply=ModuleAdapter::run('disks',$r);check($reply['status']===403&&$reads===$before,'native route permissions precede any fallback read');$allowed=true;
        $visible=[];$reply=ModuleAdapter::run('flow',$r);check($reply['status']===404&&$reads===$before,'unassigned child account cannot read parent host');$visible=null;
        $r->id=25;$reply=ModuleAdapter::run('flow',$r);check($reply['status']===404&&$reads===$before,'foreign or missing host cannot reach native controller');$r->id=24;
        $client=0;$reply=ModuleAdapter::run('disks',$r);check($reply['status']===403&&$reads===$before,'anonymous caller cannot enter read fallback');$client=7;
        $native['disks']=['status'=>400,'msg'=>'private upstream path','data'=>['password'=>'secret']];$reply=ModuleAdapter::run('disks',$r);check($reply===['status'=>503,'msg'=>'磁盘信息暂时无法获取，请稍后重试'],'native errors are not forwarded to customers');
        $native['disks']=['status'=>200,'data'=>['list'=>'invalid']];$reply=ModuleAdapter::run('disks',$r);check($reply['status']===503,'unknown native response shape is not presented as an empty disk list');
        $throw=true;$reply=ModuleAdapter::run('flow',$r);check($reply===['status'=>503,'msg'=>'流量信息暂时无法获取，请稍后重试'],'native exceptions stay private');
        echo json_encode(['status'=>'passed','checks'=>$checks,'production_writes'=>0]).PHP_EOL;
    } finally {rmdir($root);}
}
