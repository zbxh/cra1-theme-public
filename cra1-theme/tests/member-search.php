<?php
declare(strict_types=1);

/** Isolated read contracts: the production search implementation runs unchanged. */
namespace CRA1MemberSearchFixture {
    final class State
    {
        public static $visible = null;
        public static $hosts = [];
        public static $native = ['list'=>[]];
        public static $nativeFailure = false;
        public static $databaseFailure = false;
        public static $calls = [];
        public static $checks = [];
        public static function reset(): void
        {
            self::$visible = null;
            self::$hosts = [];
            self::$native = ['list'=>[]];
            self::$nativeFailure = self::$databaseFailure = false;
            self::$calls = [];
        }
    }
    final class Rows
    {
        private $rows;
        public function __construct(array $rows) { $this->rows=$rows; }
        public function toArray(): array { return $this->rows; }
    }
    final class Query
    {
        private $rows;
        private $fields = null;
        public function __construct(array $rows) { $this->rows=$rows; }
        private function key(string $key): string { return substr($key,(int)strrpos('.'.$key,'.')); }
        public function whereIn(string $field,array $ids): self
        {
            State::$calls[]=['whereIn',$field,$ids];
            $key=$this->key($field);
            $this->rows=array_values(array_filter($this->rows,static function(array $row)use($key,$ids):bool {
                return in_array((string)($row[$key]??''),array_map('strval',$ids),true);
            }));
            return $this;
        }
        public function where(string $field,$operator,$value=null): self
        {
            $two=func_num_args()===2;
            if ($two) {$value=$operator;$operator='=';}
            if ($operator!=='=' && $operator!=='eq') throw new \RuntimeException('Unsupported fixture predicate');
            State::$calls[]=['where',$field,$value];
            $key=$this->key($field);
            $this->rows=array_values(array_filter($this->rows,static function(array $row)use($key,$value):bool {
                return array_key_exists($key,$row) && (string)$row[$key]===(string)$value;
            }));
            return $this;
        }
        public function field($fields): self
        {
            State::$calls[]=['field',$fields];
            if (is_string($fields)) $fields=explode(',',$fields);
            if (!is_array($fields) || in_array('*',$fields,true)) throw new \RuntimeException('Search must select explicit public fields');
            $this->fields=array_map(function($field):string { return $this->key(trim((string)$field)); },$fields);
            return $this;
        }
        public function select(): Rows
        {
            State::$calls[]=['select'];
            if (State::$databaseFailure) throw new \RuntimeException('Fixture database read failed');
            if ($this->fields===null) throw new \RuntimeException('Search must not fetch whole host rows');
            return new Rows(array_map(function(array $row):array { return array_intersect_key($row,array_flip($this->fields)); },$this->rows));
        }
    }
    function check(bool $ok,string $message): void
    {
        if (!$ok) throw new \RuntimeException($message);
        State::$checks[]=$message;
    }
    function calls(string $method): array
    {
        return array_values(array_filter(State::$calls,static function(array $call)use($method):bool {return $call[0]===$method;}));
    }
    function host(int $id,int $owner=42,int $deleted=0): array
    {
        return ['id'=>$id,'client_id'=>$owner,'product_id'=>100+$id,'name'=>'instance-'.$id,
            'status'=>'Active','billing_cycle'=>'recurring_prepayment','due_time'=>2000000000,
            'suspend_type'=>'','renew_forbidden'=>0,'change_billing_cycle_id'=>0,'end_grace_time'=>0,'is_delete'=>$deleted,
            'password'=>'private fixture password','base_config_options'=>'private fixture options',
            'downstream_info'=>'private fixture upstream token','self_defined_field_9'=>'private fixture custom value'];
    }
    function prepare(): void
    {
        State::reset();
        State::$hosts=[host(2),host(3),host(4),host(5,99),host(6,42,1),host(7)];
        State::$native=['list'=>[
            ['id'=>4,'name'=>'instance-4','product_name'=>'Translated cloud','match_ip'=>'plugin-private-value'],
            ['id'=>5,'name'=>'foreign instance','product_name'=>'Foreign customer'],
            ['id'=>2,'name'=>'instance-2','product_name'=>'Translated server'],
            ['id'=>2,'name'=>'duplicate instance','product_name'=>'Duplicate title'],
            ['id'=>6,'name'=>'deleted instance','product_name'=>'Deleted title'],
            ['id'=>7,'name'=>'restricted instance','product_name'=>'Restricted title'],
        ]];
    }
}
namespace think\facade {
    final class Db
    {
        public static function name(string $name): \CRA1MemberSearchFixture\Query
        {
            if ($name!=='host') throw new \RuntimeException('Unexpected database table: '.$name);
            \CRA1MemberSearchFixture\State::$calls[]=['name',$name];
            return new \CRA1MemberSearchFixture\Query(\CRA1MemberSearchFixture\State::$hosts);
        }
    }
}
namespace CRA1\Theme\Security {
    final class NativeAuthorization
    {
        public static function visibleHostIds(): ?array
        {
            \CRA1MemberSearchFixture\State::$calls[]=['visibleHostIds'];
            return \CRA1MemberSearchFixture\State::$visible;
        }
    }
}
namespace app\common\model {
    final class HostModel
    {
        public function searchHost($keywords): array
        {
            \CRA1MemberSearchFixture\State::$calls[]=['searchHost',$keywords];
            if (\CRA1MemberSearchFixture\State::$nativeFailure) throw new \RuntimeException('Fixture native search failed');
            return \CRA1MemberSearchFixture\State::$native;
        }
    }
}
namespace CRA1\Theme\Compatibility {
    final class HomeProducts
    {
        public static function augment(array $payload): array
        {
            \CRA1MemberSearchFixture\State::$calls[]=['augment',$payload];
            $hosts=array_column(\CRA1MemberSearchFixture\State::$hosts,null,'id');
            foreach ($payload['data']['list'] as &$row) {
                $host=$hosts[$row['id']]??[];
                foreach (['suspend_type','change_billing_cycle_id','is_delete','end_grace_time'] as $field) {
                    if (array_key_exists($field,$host)) $row[$field]=$host[$field];
                }
                $row['renew_recovery_deadline']=0;
                // Model an expanded upstream payload: the search projection must
                // remain a whitelist when another consumer gains new fields.
                $row['internal_adapter_note']='private fixture note';
            }
            unset($row);
            $payload['data']['overview']=['server_time'=>1900000000,'renewal_enabled'=>true];
            return $payload;
        }
    }
}
namespace {
    function get_client_id($origin=true): int
    {
        \CRA1MemberSearchFixture\State::$calls[]=['get_client_id',$origin];
        return $origin ? 42 : 420;
    }
    require dirname(__DIR__).'/backend/Compatibility/MemberSearch.php';
    use CRA1\Theme\Compatibility\MemberSearch;
    use CRA1MemberSearchFixture\State;
    use function CRA1MemberSearchFixture\check;
    use function CRA1MemberSearchFixture\calls;
    use function CRA1MemberSearchFixture\prepare;

    prepare();
    State::$visible=[2,4,5,6];
    $payload=MemberSearch::search('云 + & <测试>');
    $rows=$payload['data']['list']??[];
    check(array_column($rows,'id')===[4,2],'Native matches retain order while duplicate, foreign, deleted and unassigned hosts are removed');
    check(array_column($rows,'product_name')===['Translated cloud','Translated server'],'Native translated product names survive lifecycle enrichment');
    check(calls('searchHost')===[['searchHost','云 + & <测试>']],'Keywords and special characters reach native search unchanged');
    check(!isset($rows[0]['match_ip']),'Native plugin payloads cannot inject an unchecked matched IP hint');
    check(calls('get_client_id') && calls('get_client_id')[0][1]===true,'Host ownership uses the parent owner identity while assignment uses the native subaccount projection');
    check(count(calls('augment'))===1 && isset($payload['data']['overview']['server_time']),'The lifecycle projection receives the filtered result and supplies its overview');
    check(isset($rows[0]['product_id'],$rows[0]['billing_cycle'],$rows[0]['due_time']),'The result retains fields needed for actual lifecycle and renewal checks');
    check(isset($rows[0]['suspend_type'],$rows[0]['end_grace_time'],$rows[0]['renew_recovery_deadline']),'The search retains lifecycle decisions supplied by the common product projection');
    check(($payload['status']??0)===200 && ($payload['data']['count']??-1)===2,'The response count describes the filtered hosts rather than native unchecked matches');
    foreach ($rows as $row) {
        check(!array_intersect(['client_id','password','base_config_options','downstream_info','self_defined_field_9','internal_adapter_note'],array_keys($row)),'Search excludes identity, credentials and expanded private fields for host '.$row['id']);
    }

    prepare();
    State::$visible=[];
    $payload=MemberSearch::search('云');
    check(($payload['data']['list']??null)===[],'An empty native subaccount assignment yields no hosts');
    check(calls('searchHost')===[] && calls('select')===[],'An empty assignment never searches the parent inventory');

    prepare();
    $payload=MemberSearch::search('   ');
    check(($payload['data']['list']??null)===[] && calls('searchHost')===[] && calls('select')===[],'A blank keyword is a no-op rather than an all-products read');

    prepare();
    $payload=MemberSearch::search('0');
    check(($payload['data']['list']??null)===[] && calls('searchHost')===[] && calls('select')===[],'The zero keyword follows native global search and cannot become an unfiltered inventory query');

    prepare();
    State::$native=['list'=>[]];
    $payload=MemberSearch::search('not-found');
    check(($payload['data']['list']??null)===[] && calls('select')===[],'No native matches produce no unbounded database query');

    prepare();
    State::$native['list']=[['id'=>'3oops','product_name'=>'Invalid identifier'],['id'=>0],['id'=>-2],['id'=>'1e2'],['id'=>null]];
    $payload=MemberSearch::search('invalid');
    check(($payload['data']['list']??null)===[] && calls('select')===[],'Malformed native identifiers cannot become valid owned host IDs by coercion');

    prepare();
    State::$native['list']=[null,'invalid row',['id'=>[]],['id'=>2,'product_name'=>['unexpected'=>'object']]];
    $payload=MemberSearch::search('cloud');
    check(array_column($payload['data']['list']??[],'id')===[2] && is_string($payload['data']['list'][0]['product_name']),'Malformed native rows and translated titles cannot break the response shape');

    prepare();
    $payload=MemberSearch::search('cloud');
    check(array_column($payload['data']['list']??[],'id')===[4,2,7],'An unrestricted primary account retains all owned nondeleted native matches');

    prepare();
    State::$hosts[0]['status']='Pending';
    State::$hosts[2]['status']='Failed';
    $payload=MemberSearch::search('cloud');
    check(array_column($payload['data']['list']??[],'status')===['Failed','Pending','Active'],'The backend projects real service states without inventing running-only search restrictions');

    prepare();
    State::$native=['unexpected'=>'shape'];
    $failed=false;
    try { MemberSearch::search('cloud'); } catch (\Throwable $e) { $failed=true; }
    check($failed && calls('select')===[],'An incompatible native response is reported as a read failure');

    prepare();
    State::$nativeFailure=true;
    $failed=false;
    try { MemberSearch::search('cloud'); } catch (\Throwable $e) { $failed=true; }
    check($failed && calls('select')===[],'A native search failure propagates and cannot masquerade as an empty successful result');

    prepare();
    State::$databaseFailure=true;
    $failed=false;
    try { MemberSearch::search('cloud'); } catch (\Throwable $e) { $failed=true; }
    check($failed,'A lifecycle database failure propagates rather than publishing unchecked native matches');
    check(array_filter(State::$calls,static function(array $call):bool {return in_array($call[0],['insert','update','delete','execute'],true);})===[],'Search uses only read operations');

    echo json_encode(['status'=>'passed','checks'=>count(State::$checks),'scenarios'=>State::$checks,'production_writes'=>0],JSON_UNESCAPED_UNICODE),PHP_EOL;
}
