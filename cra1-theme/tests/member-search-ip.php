<?php
declare(strict_types=1);

/** Real ORM queries over an in-memory fixture; no site database is connected. */
namespace CRA1MemberSearchIpFixture {
    final class State
    {
        public static $actor = 42;
        public static $owner = 42;
        public static $visible = null;
        public static $blocked = [];
        public static $hooks = [];
        public static $checks = [];
    }
    function check(bool $ok, string $message): void
    {
        if (!$ok) throw new \RuntimeException($message);
        State::$checks[] = $message;
    }
}
namespace CRA1\Theme\Security {
    final class NativeAuthorization
    {
        public static function visibleHostIds(): ?array
        {
            return \CRA1MemberSearchIpFixture\State::$actor > 0 ? \CRA1MemberSearchIpFixture\State::$visible : [];
        }
    }
    final class OperationVerification
    {
        public static function redact(array $payload): array { return $payload; }
    }
}
namespace {
    use CRA1MemberSearchIpFixture\State;
    use function CRA1MemberSearchIpFixture\check;
    function get_client_id($origin = true): int { return $origin ? State::$owner : State::$actor; }
    function app($service = null)
    {
        if ($service !== 'http') throw new \RuntimeException('Unexpected application service');
        return new class { public function getName(): string { return 'home'; } };
    }
    function hook(string $name, array $params): array
    {
        State::$hooks[] = [$name, $params['keywords']??null];
        if ($name === 'before_search_host') {
            return $params['keywords'] === 'provider-ticket' ? [['host_id'=>[202,204,205]]] : [];
        }
        if ($name === 'host_search_where_query_append') {
            if (($params['app']??'') !== 'home') throw new \RuntimeException('Wrong native application scope');
            if (State::$blocked) $params['query']->whereNotIn('h.id', State::$blocked);
        }
        return [];
    }
    function hook_one(string $name, array $params): array
    {
        if ($name !== 'multi_language') throw new \RuntimeException('Unexpected translation hook');
        return ['product_name'=>'Translated '.($params['replace']['product_name']??'')];
    }
    function configuration(array $fields): array
    {
        return ['cron_due_terminate_swhitch'=>0,'product_overdue_not_delete_open'=>0];
    }

    require dirname(__DIR__, 2).'/vendor/autoload.php';
    $database = new \think\DbManager();
    $database->setConfig(['default'=>'isolated','connections'=>['isolated'=>[
        'type'=>'sqlite','database'=>':memory:','prefix'=>'fixture_','fields_strict'=>true,
        'deploy'=>0,'rw_separate'=>false,'fields_cache'=>false,'trigger_sql'=>false,
    ]]]);
    \think\Container::getInstance()->instance('think\DbManager', $database);
    $connection = $database->connect();
    $connection->execute('PRAGMA case_sensitive_like=ON');
    $connection->execute('CREATE TABLE fixture_host (id INTEGER PRIMARY KEY,client_id INTEGER,product_id INTEGER,name TEXT,status TEXT,billing_cycle TEXT,due_time INTEGER,renew_forbidden INTEGER,suspend_type TEXT,change_billing_cycle_id INTEGER,is_delete INTEGER,end_grace_time INTEGER,password TEXT,downstream_info TEXT)');
    $connection->execute('CREATE TABLE fixture_product (id INTEGER PRIMARY KEY,name TEXT)');
    $connection->execute('CREATE TABLE fixture_host_ip (id INTEGER PRIMARY KEY,host_id INTEGER,dedicate_ip TEXT,assign_ip TEXT,ip_num INTEGER,create_time INTEGER,update_time INTEGER)');
    $connection->execute('CREATE TABLE fixture_plugin (name TEXT,module TEXT,status INTEGER)');
    \think\facade\Db::name('product')->insertAll([['id'=>900,'name'=>'Cloud plan'],['id'=>901,'name'=>'Bare metal']]);
    $hosts = [];
    foreach ([201,202,203,204,205,206,207,208] as $id) {
        $hosts[] = ['id'=>$id,'client_id'=>$id===204?99:42,'product_id'=>$id===202?901:900,
            'name'=>$id===201?'edge-primary':'edge-'.$id,'status'=>$id===206?'Cancelled':($id===207?'Pending':($id===208?'Failed':'Active')),
            'billing_cycle'=>'recurring_prepayment','due_time'=>2000000000,'renew_forbidden'=>0,
            'suspend_type'=>'','change_billing_cycle_id'=>0,'is_delete'=>$id===205?1:0,'end_grace_time'=>0,
            'password'=>'fixture credential must stay private','downstream_info'=>'fixture upstream secret'];
    }
    \think\facade\Db::name('host')->insertAll($hosts);
    $ips = [];
    foreach ([201,202,203,204,205,206,207,208] as $id) {
        $ips[] = ['id'=>$id,'host_id'=>$id,'dedicate_ip'=>$id===202?'192.0.2.10':'203.0.113.7',
            'assign_ip'=>$id===201?'198.51.100.4, 2001:db8::21':($id===202?'198.51.100.9,2001:db8::22':''),
            'ip_num'=>3,'create_time'=>0,'update_time'=>0];
    }
    // Historical duplicate index rows must not duplicate one service result.
    $ips[] = ['id'=>299,'host_id'=>201,'dedicate_ip'=>'203.0.113.7','assign_ip'=>'198.51.100.4','ip_num'=>2,'create_time'=>0,'update_time'=>0];
    \think\facade\Db::name('host_ip')->insertAll($ips);
    $native = getenv('CRA1_NATIVE_HOST_MODEL') ?: dirname(__DIR__,2).'/app/common/model/HostModel.php';
    // A private official baseline may be streamed to an unprivileged PHP
    // process without relaxing access to the maintenance directory.
    $nativeSource = (string)file_get_contents($native==='-' ? 'php://stdin' : $native);
    $nativeRestrictionCalls = strpos($nativeSource,'host_search_where_query_append')!==false ? 1 : 0;
    if ($native==='-') {
        if (substr($nativeSource,0,5)!=='<?php') throw new \RuntimeException('Invalid official PHP fixture');
        eval(substr($nativeSource,5));
    } else require $native;
    require dirname(__DIR__).'/backend/Compatibility/HomeProducts.php';
    require dirname(__DIR__).'/backend/Compatibility/MemberSearch.php';
    $search = static function(string $keyword): array { return \CRA1\Theme\Compatibility\MemberSearch::search($keyword)['data']['list']; };
    $ids = static function(array $rows): array { $result=array_map('intval',array_column($rows,'id'));sort($result);return $result; };

    $rows = $search('203.0.113.7');
    check($ids($rows)===[201,203,207,208], 'IPv4 lookup returns owned live records, excluding foreign, deleted and cancelled products');
    check(count(array_column($rows,'id'))===count(array_unique(array_column($rows,'id'))), 'Duplicate native IP index rows return each service once');
    check(array_unique(array_column($rows,'match_ip'))===['203.0.113.7'], 'A matching primary IP is included as a single result hint');
    check($rows[0]['product_name']==='Translated Cloud plan', 'IP-only matches use the original multi-language translation hook');
    check(isset($rows[0]['renew_recovery_deadline'],$rows[0]['suspend_type']), 'Actual shared lifecycle projection still enriches IP search results');
    foreach ($rows as $row) {
        check(!array_intersect(['client_id','password','downstream_info','dedicate_ip','assign_ip'],array_keys($row)), 'IP result '.$row['id'].' excludes credentials, owner identity and complete IP lists');
    }

    $rows = $search('198.51.100.9');
    check($ids($rows)===[202] && $rows[0]['match_ip']==='198.51.100.9', 'Additional IPv4 addresses in the standard comma-separated index are searchable');
    check($rows[0]['name']==='edge-202' && $rows[0]['product_name']==='Translated Bare metal', 'IP-only matches retain the real host identifier and translated product title');
    $rows = $search('198.51.100');
    check($ids($rows)===[201,202], 'IPv4 fragments search both primary and additional address fields');
    $rows = $search('2001:DB8::');
    check($ids($rows)===[201,202] && $rows[0]['match_ip']==='2001:db8::21', 'IPv6 address fragments match without case sensitivity');
    check($ids($search('2001:db8::22'))===[202], 'An exact additional IPv6 address matches its service');

    State::$visible=[202,204,205];
    check($ids($search('2001:db8'))===[202], 'IP lookup intersects the native subaccount product assignment');
    check($search('203.0.113.7')===[], 'A subaccount cannot search unassigned primary addresses or foreign or deleted assigned records');
    State::$visible=[];
    $before=count(State::$hooks);
    check($search('198.51.100.9')===[] && count(State::$hooks)===$before, 'An empty subaccount assignment does not invoke native search or IP extension hooks');
    State::$visible=null;
    State::$actor=0;
    $before=count(State::$hooks);
    check($search('198.51.100.9')===[] && count(State::$hooks)===$before, 'An unauthenticated identity cannot read or search the IP index');
    State::$actor=42;
    State::$blocked=[201,203];
    check($ids($search('203.0.113.7'))===[207,208], 'IP search applies the original host_search_where_query_append plugin restrictions');
    State::$blocked=[];
    $before=count(array_filter(State::$hooks,static function(array $call):bool {return $call[0]==='host_search_where_query_append';}));
    $search('198.51.100.9');
    $after=count(array_filter(State::$hooks,static function(array $call):bool {return $call[0]==='host_search_where_query_append';}));
    check($after-$before===$nativeRestrictionCalls+1, 'The extra IP lookup preserves the original restriction hook on each supported native query');

    $rows=$search('provider-ticket');
    check($ids($rows)===[202], 'Original before_search_host module matches remain supported and are rescoped against account ownership');
    check($ids($search('edge-primary'))===[201], 'The original host identifier search remains unchanged');
    check(in_array(201,$ids($search('201')),true), 'The original service ID search remains supported');
    $rows=$search('edge');
    check(!array_filter($rows,static function(array $row):bool {return isset($row['match_ip']);}), 'An ordinary host-name match does not expose unrelated IP addresses');
    check($search('192.0.2.10,203.0.113.7')===[], 'A match cannot be manufactured across multiple IP list entries');
    check($search('0')===[] && $search(' ')===[], 'Empty and native zero keywords cannot read the whole inventory');
    foreach (['%','_','!','\\'] as $keyword) {
        $before=count(array_filter(State::$hooks,static function(array $call):bool{return $call[0]==='host_search_where_query_append';}));
        $search($keyword);
        $after=count(array_filter(State::$hooks,static function(array $call):bool{return $call[0]==='host_search_where_query_append';}));
        check($after-$before===$nativeRestrictionCalls, 'IP extension does not interpret LIKE wildcard or escape character '.json_encode($keyword).' as an IP fragment');
    }
    $routes=(string)file_get_contents(dirname(__DIR__).'/backend/Http/Routes.php');
    $controller=(string)file_get_contents(dirname(__DIR__).'/backend/Http/MemberController.php');
    check(strpos($routes,"['GET','member/search','search']")!==false && strpos($routes,"middleware('app\\\\http\\\\middleware\\\\CheckHome')")!==false, 'The member search route remains behind the V10 login middleware');
    check(strpos($controller,"NativeAuthorization::allows('app\\\\home\\\\controller\\\\HostController::homeHostList')")!==false, 'The controller retains the actual native product-list permission requirement');
    echo json_encode(['status'=>'passed','checks'=>count(State::$checks),'scenarios'=>State::$checks,'driver'=>'real Think ORM with SQLite :memory:','native_model_sha256'=>hash('sha256',$nativeSource),'production_writes'=>0],JSON_UNESCAPED_UNICODE),PHP_EOL;
}
