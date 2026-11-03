<?php
/** Independent theme identities. No v10 administrator table or public initialization. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }
final class CRA1ThemeSecurityError extends RuntimeException {
    public int $status; public string $errorCode;
    public function __construct(string $message, int $status=400, string $code='INVALID_REQUEST') { parent::__construct($message); $this->status=$status; $this->errorCode=$code; }
}
final class CRA1ThemeSecurity {
    public PDO $db; private string $key; public string $root;
    public const ROLES=['operator'=>'操作员','admin'=>'管理员','super_admin'=>'超级管理员'];
    public const HASH_OPTIONS=['memory_cost'=>65536,'time_cost'=>2,'threads'=>1];
    public function __construct(string $root) {
        $this->root=rtrim($root,'/'); $path=$this->root.'/runtime/cra1_theme/security.sqlite'; $key=$this->root.'/config/cra1_theme_security.key';
        if (!is_file($path)||!is_file($key)) throw new CRA1ThemeSecurityError('后台安全服务尚未就绪，请通过维护命令检查。',503,'SECURITY_UNAVAILABLE');
        $raw=file_get_contents($key); $this->key=$raw===false?'':$raw;
        if(strlen($this->key)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES) throw new CRA1ThemeSecurityError('后台安全密钥异常，请联系维护人员。',503,'SECURITY_UNAVAILABLE');
        try {
            $this->db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
            $this->db->exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
            if ($this->scalar("SELECT value FROM meta WHERE key='schema'")!=='1' || !hash_equals((string)$this->scalar("SELECT value FROM meta WHERE key='key_check'"),hash_hmac('sha256','cra1-theme-key-check',$this->key))) throw new RuntimeException('schema/key');
        } catch(Throwable $e) { throw new CRA1ThemeSecurityError('后台安全数据异常，认证已停止，请通过维护命令检查。',503,'SECURITY_UNAVAILABLE'); }
    }
    public static function install(string $root,string $username,string $hash,array $settings=[]): void {
        $dir=rtrim($root,'/').'/runtime/cra1_theme';$cfg=rtrim($root,'/').'/config';
        if(is_file($dir.'/security.sqlite')||is_file($cfg.'/cra1_theme_security.key'))throw new RuntimeException('已有安全数据或密钥，禁止重新初始化');
        foreach([$dir,$cfg]as$p)if(!is_dir($p)&&!mkdir($p,0700,true))throw new RuntimeException('无法创建安全目录');
        self::username($username); if(!password_get_info($hash)['algo'])throw new RuntimeException('原密码哈希无效');
        $key=random_bytes(32);$keyFile=$cfg.'/cra1_theme_security.key';$f=fopen($keyFile,'x');if(!$f)throw new RuntimeException('无法创建密钥');fwrite($f,$key);fclose($f);chmod($keyFile,0600);
        $file=$dir.'/security.sqlite';$pdo=new PDO('sqlite:'.$file,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);chmod($file,0600);
        $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
        $pdo->exec(<<<'SQL'
CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE accounts(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL COLLATE NOCASE UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('operator','admin','super_admin')),enabled INTEGER NOT NULL DEFAULT 1,epoch INTEGER NOT NULL DEFAULT 1,mfa_secret TEXT,last_totp_step INTEGER NOT NULL DEFAULT -1,recovery_hashes TEXT NOT NULL DEFAULT '[]',must_change INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE sessions(hash TEXT PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id),epoch INTEGER NOT NULL,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,expires_at INTEGER NOT NULL,ip TEXT NOT NULL,device TEXT NOT NULL,revoked_at INTEGER NOT NULL DEFAULT 0);
CREATE INDEX sessions_account ON sessions(account_id,revoked_at,expires_at);
CREATE TABLE challenges(hash TEXT PRIMARY KEY,account_id INTEGER REFERENCES accounts(id),kind TEXT NOT NULL,session_hash TEXT NOT NULL,payload TEXT NOT NULL DEFAULT '{}',expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,used_at INTEGER NOT NULL DEFAULT 0);
CREATE INDEX challenges_expiry ON challenges(expires_at);
CREATE TABLE limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,window_start INTEGER NOT NULL,last_failure INTEGER NOT NULL,blocked_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE events(id INTEGER PRIMARY KEY AUTOINCREMENT,time INTEGER NOT NULL,category TEXT NOT NULL,action TEXT NOT NULL,actor_id INTEGER,actor_name TEXT,role TEXT,target TEXT NOT NULL,result TEXT NOT NULL,reason TEXT NOT NULL,risk TEXT NOT NULL,ip TEXT NOT NULL,device TEXT NOT NULL,request_id TEXT NOT NULL,session_hash TEXT NOT NULL,diff TEXT NOT NULL,previous_hash TEXT NOT NULL,integrity TEXT NOT NULL,import_key TEXT UNIQUE);
CREATE INDEX events_time ON events(time DESC,id DESC);
CREATE INDEX events_actor ON events(actor_id,id DESC);
CREATE INDEX events_action ON events(action,id DESC);
CREATE INDEX events_result ON events(result,id DESC);
CREATE INDEX events_risk ON events(risk,id DESC);
CREATE INDEX events_ip ON events(ip,id DESC);
CREATE INDEX events_domain ON events(target,id DESC);
CREATE TABLE alerts(key TEXT PRIMARY KEY,action TEXT NOT NULL,risk TEXT NOT NULL,first_at INTEGER NOT NULL,last_at INTEGER NOT NULL,count INTEGER NOT NULL,read_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
SQL
        );
        $insert=$pdo->prepare('INSERT INTO meta VALUES(?,?)');foreach(['schema'=>'1','key_check'=>hash_hmac('sha256','cra1-theme-key-check',$key),'chain_tail'=>'','dummy_hash'=>password_hash(bin2hex(random_bytes(24)),PASSWORD_ARGON2ID,self::HASH_OPTIONS)]as$k=>$v)$insert->execute([$k,$v]);
        $pdo->prepare('INSERT INTO accounts(username,password_hash,role,created_at,updated_at) VALUES(?,?,?, ?,?)')->execute([$username,$hash,'super_admin',time(),time()]);
        $settings+=['idle_timeout'=>1800,'absolute_timeout'=>43200,'trusted_proxies'=>[],'ip_allowlist'=>[],'canonical_url'=>'','http_test'=>false,'force_https'=>false];
        $st=$pdo->prepare('INSERT INTO settings VALUES(?,?)');foreach($settings as$k=>$v)$st->execute([$k,json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
    }
    public function scalar(string $sql,array $args=[]) { $s=$this->db->prepare($sql);$s->execute($args);return $s->fetchColumn(); }
    public function rows(string $sql,array $args=[]): array { $s=$this->db->prepare($sql);$s->execute($args);return $s->fetchAll(); }
    public function tx(callable $f) { $this->db->exec('BEGIN IMMEDIATE');try{$v=$f();$this->db->exec('COMMIT');return $v;}catch(Throwable $e){$this->db->exec('ROLLBACK');throw $e;} }
    public function settings(): array { $out=[];foreach($this->rows('SELECT * FROM settings')as$r)$out[$r['key']]=json_decode($r['value'],true);return $out; }
    public static function username(string $s): void { if(!preg_match('/^[A-Za-z0-9_-]{3,32}$/D',$s))throw new CRA1ThemeSecurityError('用户名需为 3–32 位字母、数字、下划线或短横线'); }
    public static function password(string $s): string { $n=mb_strlen($s,'UTF-8');if($n<12||$n>128||strpos($s,"\0")!==false)throw new CRA1ThemeSecurityError('新密码需为 12–128 个字符');return password_hash($s,PASSWORD_ARGON2ID,self::HASH_OPTIONS); }
    public static function hashToken(string $token): string { return hash('sha256',$token); }
    public function recoveryHash(string $purpose,string $value): string { return hash_hmac('sha256','cra1-admin-recovery:'.$purpose."\0".$value,$this->key); }
    public function encrypt(string $text): string { $n=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);return base64_encode($n.sodium_crypto_secretbox($text,$n,$this->key)); }
    public function decrypt(string $cipher): string { $b=base64_decode($cipher,true);if(!$b||strlen($b)<40)throw new CRA1ThemeSecurityError('双重验证密钥异常，请通过维护命令恢复。',503,'SECURITY_UNAVAILABLE');$v=sodium_crypto_secretbox_open(substr($b,24),substr($b,0,24),$this->key);if($v===false)throw new CRA1ThemeSecurityError('双重验证密钥异常，请通过维护命令恢复。',503,'SECURITY_UNAVAILABLE');return $v; }
    public function account(int $id): array { $r=$this->rows('SELECT * FROM accounts WHERE id=?',[$id]);if(!$r)throw new CRA1ThemeSecurityError('账号不存在',404,'ACCOUNT_NOT_FOUND');return $r[0]; }
    public static function publicAccount(array $a): array { return ['id'=>(int)$a['id'],'username'=>$a['username'],'role'=>$a['role'],'role_label'=>self::ROLES[$a['role']]??'未知角色','enabled'=>(bool)$a['enabled'],'mfa_enabled'=>!empty($a['mfa_secret']),'must_change'=>(bool)$a['must_change'],'created_at'=>(int)$a['created_at'],'updated_at'=>(int)$a['updated_at']]; }
    private function rateKeys(string $name,string $ip): array { $u=strtolower(trim($name));return ['pair:'.hash('sha256',$u.'|'.$ip),'ip:'.hash('sha256',$ip),'account:'.hash('sha256',$u)]; }
    public function rate(string $name,string $ip,int $now=0): array {
        $now=$now?:time();$captcha=false;$until=0;
        foreach($this->rateKeys($name,$ip)as$k){$r=$this->rows('SELECT * FROM limits WHERE key=?',[$k]);if(!$r)continue;$r=$r[0];$until=max($until,(int)$r['blocked_until']);if($now-(int)$r['window_start']<900&&(int)$r['count']>=3)$captcha=true;}
        return ['blocked'=>$until>$now,'retry_after'=>max(0,$until-$now),'captcha_required'=>$captcha];
    }
    public function fail(string $name,string $ip,int $now=0): void {
        $now=$now?:time();$this->tx(function()use($name,$ip,$now){foreach($this->rateKeys($name,$ip)as$i=>$k){$r=$this->rows('SELECT * FROM limits WHERE key=?',[$k]);$r=$r?$r[0]:['count'=>0,'window_start'=>$now,'last_failure'=>0,'blocked_until'=>0];if($now-(int)$r['window_start']>=900)$r=['count'=>0,'window_start'=>$now,'last_failure'=>0,'blocked_until'=>0];$count=(int)$r['count']+1;$until=(int)$r['blocked_until'];if(($i===0&&$count>=5)||($i===1&&$count>=30))$until=max($until,$now+900);if($i===2&&$count>=5)$until=max($until,$now+min(300,5*(2**min(6,$count-5))));$this->db->prepare('INSERT OR REPLACE INTO limits VALUES(?,?,?,?,?)')->execute([$k,$count,$r['window_start'],$now,$until]);}});
    }
    public function boundedRate(string $key,int $max,int $window): bool {
        return $this->tx(function()use($key,$max,$window){$now=time();$r=$this->rows('SELECT * FROM limits WHERE key=?',[$key]);$r=$r[0]??['count'=>0,'window_start'=>$now];if($now-(int)$r['window_start']>=$window)$r=['count'=>0,'window_start'=>$now];if((int)$r['count']>=$max)return false;$this->db->prepare('INSERT OR REPLACE INTO limits VALUES(?,?,?,?,?)')->execute([$key,(int)$r['count']+1,(int)$r['window_start'],$now,0]);return true;});
    }
    public function clearRate(string $name,string $ip): void { $k=$this->rateKeys($name,$ip);$this->db->prepare('DELETE FROM limits WHERE key IN (?,?)')->execute([$k[0],$k[2]]); }
    public function checkPassword(string $name,string $password): ?array {
        $r=$this->rows('SELECT * FROM accounts WHERE username=? COLLATE NOCASE',[trim($name)]);$a=$r[0]??null;$hash=$a['password_hash']??(string)$this->scalar("SELECT value FROM meta WHERE key='dummy_hash'");$ok=strlen($password)<=2048&&password_verify($password,$hash);
        if(!$ok||!$a||!(int)$a['enabled'])return null;
        if(password_needs_rehash($hash,PASSWORD_ARGON2ID,self::HASH_OPTIONS)){$new=password_hash($password,PASSWORD_ARGON2ID,self::HASH_OPTIONS);$this->db->prepare('UPDATE accounts SET password_hash=? WHERE id=? AND password_hash=?')->execute([$new,$a['id'],$hash]);$a['password_hash']=$new;}
        return $a;
    }
    public function startSession(array $a,string $ip,string $device): string {
        $token=bin2hex(random_bytes(32));$st=$this->settings();$now=time();$this->db->prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,0)')->execute([self::hashToken($token),$a['id'],$a['epoch'],$now,$now,$now+(int)$st['absolute_timeout'],$ip,mb_substr($device,0,180)]);return $token;
    }
    public function authenticate(string $token,bool $touch=true): ?array {
        if(!preg_match('/^[a-f0-9]{64}$/D',$token))return null;$r=$this->rows('SELECT a.*,s.last_seen,s.expires_at,s.created_at AS session_created,s.epoch AS session_epoch FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.hash=? AND s.revoked_at=0',[self::hashToken($token)]);if(!$r)return null;$a=$r[0];$now=time();$st=$this->settings();if(!(int)$a['enabled']||(int)$a['epoch']!==(int)$a['session_epoch']||(int)$a['expires_at']<=$now||$now-(int)$a['last_seen']>=(int)$st['idle_timeout'])return null;
        if($touch&&$now-(int)$a['last_seen']>=15)$this->db->prepare('UPDATE sessions SET last_seen=? WHERE hash=? AND revoked_at=0')->execute([$now,self::hashToken($token)]);return $a;
    }
    public function revoke(int $id,?string $hash=null): void { $this->db->prepare('UPDATE sessions SET revoked_at=? WHERE account_id=? AND revoked_at=0'.($hash!==null?' AND hash=?':''))->execute($hash!==null?[time(),$id,$hash]:[time(),$id]); }
    public function sessionList(int $id,string $current): array { $st=$this->settings();$r=$this->rows('SELECT hash,created_at,last_seen,expires_at,ip,device FROM sessions WHERE account_id=? AND revoked_at=0 AND expires_at>? AND last_seen>? ORDER BY created_at DESC LIMIT 100',[$id,time(),time()-(int)$st['idle_timeout']]);foreach($r as&$s){$s['id']=$s['hash'];$s['current']=hash_equals($s['hash'],self::hashToken($current));unset($s['hash']);}return $r; }
    public function challenge(int $id,string $kind,string $session,array $payload=[]): string {
        $payload['epoch']=(int)$this->account($id)['epoch'];$t=bin2hex(random_bytes(32));$this->db->prepare('INSERT INTO challenges VALUES(?,?,?,?,?,?,0,0)')->execute([self::hashToken($t),$id,$kind,self::hashToken($session),json_encode($payload),time()+300]);return $t;
    }
    private function takeChallenge(string $token,string $kind,string $session): array {
        $r=$this->rows('SELECT * FROM challenges WHERE hash=?',[self::hashToken($token)]);$r=$r[0]??null;if(!$r||$r['kind']!==$kind||!hash_equals($r['session_hash'],self::hashToken($session))||(int)$r['used_at']!==0||(int)$r['attempts']>=5||(int)$r['expires_at']<time())throw new CRA1ThemeSecurityError('验证已失效，请重新开始。',401,'CHALLENGE_EXPIRED');return $r;
    }
    public static function base32(string $bytes): string { $alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';$buffer=0;$bits=0;$s='';foreach(unpack('C*',$bytes)as$b){$buffer=($buffer<<8)|$b;$bits+=8;while($bits>=5){$bits-=5;$s.=$alphabet[($buffer>>$bits)&31];}$buffer&=(1<<$bits)-1;}if($bits)$s.=$alphabet[($buffer<<(5-$bits))&31];return $s; }
    private static function decode32(string $s): string { $buffer=0;$bits=0;$out='';foreach(str_split(strtoupper($s))as$c){$n=strpos('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',$c);if($n===false)throw new RuntimeException('invalid base32');$buffer=($buffer<<5)|$n;$bits+=5;if($bits>=8){$bits-=8;$out.=chr(($buffer>>$bits)&255);}$buffer&=(1<<$bits)-1;}return $out; }
    public static function totp(string $secret,int $step): string { $data=pack('N2',(int)floor($step/4294967296),$step%4294967296);$h=hash_hmac('sha1',$data,self::decode32($secret),true);$o=ord($h[19])&15;$n=unpack('N',substr($h,$o,4))[1]&0x7fffffff;return str_pad((string)($n%1000000),6,'0',STR_PAD_LEFT); }
    private function factor(array $a,string $code,int $now=0,?string $secret=null): bool {
        $now=$now?:time();$key=$secret??$this->decrypt((string)$a['mfa_secret']);$step=(int)floor($now/30);
        if(preg_match('/^[0-9]{6}$/D',$code))foreach([$step,$step-1,$step+1]as$n){if($n<=(int)$a['last_totp_step'])continue;if(hash_equals(self::totp($key,$n),$code)){$st=$this->db->prepare('UPDATE accounts SET last_totp_step=? WHERE id=? AND last_totp_step<?');$st->execute([$n,$a['id'],$n]);return $st->rowCount()===1;}}
        if($secret!==null)return false;
        $codes=json_decode($a['recovery_hashes'],true)?:[];$v=strtoupper(str_replace([' ','-'],'',$code));$h=hash_hmac('sha256',$v,$this->key);
        foreach($codes as$i=>$hash)if(hash_equals($hash,$h)){unset($codes[$i]);$this->db->prepare('UPDATE accounts SET recovery_hashes=? WHERE id=?')->execute([json_encode(array_values($codes)),$a['id']]);return true;}return false;
    }
    public function verifyChallenge(string $token,string $kind,string $session,string $code): array {
        $result=$this->tx(function()use($token,$kind,$session,$code){$c=$this->takeChallenge($token,$kind,$session);$a=$this->account((int)$c['account_id']);if(!(int)$a['enabled'])return ['error'=>true];$payload=json_decode($c['payload'],true)?:[];if((int)($payload['epoch']??0)!==(int)$a['epoch'])return ['error'=>true];$secret=$kind==='enroll'?$this->decrypt($payload['secret']):null;
            if(!$this->factor($a,trim($code),0,$secret)){$this->db->prepare('UPDATE challenges SET attempts=attempts+1 WHERE hash=?')->execute([$c['hash']]);return ['error'=>true];}
            $this->db->prepare('UPDATE challenges SET used_at=? WHERE hash=?')->execute([time(),$c['hash']]);return ['account'=>$this->account((int)$a['id']),'payload'=>$payload];});
        if(isset($result['error']))throw new CRA1ThemeSecurityError('验证失败，请检查动态码或恢复码。',400,'FACTOR_FAILED');return $result;
    }
    public function enrollment(array $a,string $session): array { $secret=self::base32(random_bytes(20));$token=$this->challenge((int)$a['id'],'enroll',$session,['secret'=>$this->encrypt($secret)]);return ['challenge'=>$token,'secret'=>$secret,'uri'=>'otpauth://totp/'.rawurlencode('酷锐A1主题:'.$a['username']).'?secret='.$secret.'&issuer='.rawurlencode('酷锐A1主题').'&algorithm=SHA1&digits=6&period=30','expires_at'=>time()+300]; }
    private function recovery(int $id): array { $plain=[];$hashes=[];for($i=0;$i<10;$i++){$raw=strtoupper(bin2hex(random_bytes(8)));$plain[]=implode('-',str_split($raw,4));$hashes[]=hash_hmac('sha256',$raw,$this->key);}$this->db->prepare('UPDATE accounts SET recovery_hashes=? WHERE id=?')->execute([json_encode($hashes),$id]);return $plain; }
    public function enableMfa(string $challenge,string $session,string $code): array {
        // Challenge/factor use and secret activation are one transaction (no crash window).
        return $this->tx(function()use($challenge,$session,$code){$c=$this->takeChallenge($challenge,'enroll',$session);$a=$this->account((int)$c['account_id']);$p=json_decode($c['payload'],true);if(!(int)$a['enabled']||(int)($p['epoch']??0)!==(int)$a['epoch'])throw new CRA1ThemeSecurityError('绑定状态已失效',401,'CHALLENGE_EXPIRED');if(!$this->factor($a,trim($code),0,$this->decrypt($p['secret']))){$this->db->prepare('UPDATE challenges SET attempts=attempts+1 WHERE hash=?')->execute([$c['hash']]);return ['failed'=>true];}$this->db->prepare('UPDATE challenges SET used_at=? WHERE hash=?')->execute([time(),$c['hash']]);$this->db->prepare('UPDATE accounts SET mfa_secret=?,epoch=epoch+1,updated_at=? WHERE id=?')->execute([$p['secret'],time(),$a['id']]);$codes=$this->recovery((int)$a['id']);$this->revoke((int)$a['id']);return ['recovery_codes'=>$codes];});
    }
    public function reauthenticate(array $a,string $password,string $code,string $session,string $action,string $target): string {
        if(!password_verify($password,$a['password_hash']))throw new CRA1ThemeSecurityError('身份验证失败',400,'REAUTH_FAILED');
        if(!empty($a['mfa_secret'])){$ok=$this->tx(function()use($a,$code){return $this->factor($this->account((int)$a['id']),trim($code));});if(!$ok)throw new CRA1ThemeSecurityError('身份验证失败',400,'REAUTH_FAILED');}
        return $this->challenge((int)$a['id'],'reauth',$session,['action'=>$action,'target'=>$target]);
    }
    public function useReauth(string $token,string $session,string $action,string $target): void {
        if($token==='')throw new CRA1ThemeSecurityError('请重新验证身份后继续，未保存的草稿会保留。',403,'REAUTH_REQUIRED');
        $this->tx(function()use($token,$session,$action,$target){try{$c=$this->takeChallenge($token,'reauth',$session);}catch(CRA1ThemeSecurityError $e){throw new CRA1ThemeSecurityError('身份验证已失效，请重新验证。',403,'REAUTH_REQUIRED');}$p=json_decode($c['payload'],true);if(($p['action']??'')!==$action||($p['target']??'')!==$target)throw new CRA1ThemeSecurityError('验证凭据与本次操作不匹配。',403,'REAUTH_REQUIRED');$this->db->prepare('UPDATE challenges SET used_at=? WHERE hash=?')->execute([time(),$c['hash']]);});
    }
    public function manageAllowed(array $actor,array $target): void { if($actor['role']==='super_admin')return;if($actor['role']!=='admin'||$target['role']!=='operator')throw new CRA1ThemeSecurityError('无权管理该账号',403,'PERMISSION_DENIED'); }
    public function createAccount(array $actor,array $p): array { $role=(string)($p['role']??'operator');if(!isset(self::ROLES[$role])||($actor['role']!=='super_admin'&&($actor['role']!=='admin'||$role!=='operator')))throw new CRA1ThemeSecurityError('无权创建该角色账号',403,'PERMISSION_DENIED');$name=trim((string)($p['username']??''));self::username($name);$hash=self::password((string)($p['password']??''));try{$this->db->prepare('INSERT INTO accounts(username,password_hash,role,must_change,created_at,updated_at) VALUES(?,?,?,1,?,?)')->execute([$name,$hash,$role,time(),time()]);}catch(PDOException $e){if(strpos($e->getMessage(),'UNIQUE')!==false)throw new CRA1ThemeSecurityError('用户名已存在');throw $e;}return self::publicAccount($this->account((int)$this->db->lastInsertId())); }
    public function changeAccount(array $actor,int $id,array $p): array { $hash=array_key_exists('password',$p)?self::password((string)$p['password']):null;return $this->tx(function()use($actor,$id,$p,$hash){$a=$this->account($id);$this->manageAllowed($actor,$a);$role=(string)($p['role']??$a['role']);$enabled=array_key_exists('enabled',$p)?(int)(bool)$p['enabled']:(int)$a['enabled'];if(!isset(self::ROLES[$role])||($actor['role']!=='super_admin'&&$role!=='operator'))throw new CRA1ThemeSecurityError('无权调整该角色',403,'PERMISSION_DENIED');if($a['role']==='super_admin'&&(int)$a['enabled']&&(!$enabled||$role!=='super_admin')&&(int)$this->scalar("SELECT COUNT(*) FROM accounts WHERE role='super_admin' AND enabled=1")<=1)throw new CRA1ThemeSecurityError('必须保留至少一名启用的超级管理员',409,'LAST_SUPER_ADMIN');$this->db->prepare('UPDATE accounts SET role=?,enabled=?,password_hash=?,must_change=?,epoch=epoch+1,updated_at=? WHERE id=?')->execute([$role,$enabled,$hash??$a['password_hash'],$hash?1:$a['must_change'],time(),$id]);if(!empty($p['reset_mfa']))$this->db->prepare("UPDATE accounts SET mfa_secret=NULL,recovery_hashes='[]',last_totp_step=-1 WHERE id=?")->execute([$id]);$this->revoke($id);return self::publicAccount($this->account($id));}); }
    public function changeOwnPassword(array $a,string $password): void { $hash=self::password($password);$this->tx(function()use($a,$hash){$this->db->prepare('UPDATE accounts SET password_hash=?,must_change=0,epoch=epoch+1,updated_at=? WHERE id=?')->execute([$hash,time(),$a['id']]);$this->revoke((int)$a['id']);}); }
    public function mfaAction(int $id,string $action): array { return $this->tx(function()use($id,$action){$a=$this->account($id);if(empty($a['mfa_secret']))throw new CRA1ThemeSecurityError('尚未启用双重验证');$codes=[];if($action==='disable')$this->db->prepare("UPDATE accounts SET mfa_secret=NULL,recovery_hashes='[]',last_totp_step=-1 WHERE id=?")->execute([$id]);elseif($action==='recovery')$codes=$this->recovery($id);else throw new CRA1ThemeSecurityError('未知双重验证操作');$this->db->prepare('UPDATE accounts SET epoch=epoch+1,updated_at=? WHERE id=?')->execute([time(),$id]);$this->revoke($id);return ['recovery_codes'=>$codes];}); }
    public function updateSettings(array $p): void {
        $allowed=['idle_timeout','absolute_timeout','trusted_proxies','ip_allowlist','canonical_url','http_test','force_https'];if(array_diff(array_keys($p),$allowed))throw new CRA1ThemeSecurityError('安全设置含未知字段');
        $current=$this->settings();$v=array_replace($current,$p);if((int)$v['idle_timeout']<300||(int)$v['idle_timeout']>3600||(int)$v['absolute_timeout']<1800||(int)$v['absolute_timeout']>86400||(int)$v['idle_timeout']>(int)$v['absolute_timeout'])throw new CRA1ThemeSecurityError('空闲时长需为 5–60 分钟，总有效期为 30 分钟–24 小时');
        foreach(['trusted_proxies','ip_allowlist']as$k){if(!is_array($v[$k])||count($v[$k])>64)throw new CRA1ThemeSecurityError('地址名单格式不正确');foreach($v[$k]as$ip)if(!self::validCidr((string)$ip))throw new CRA1ThemeSecurityError('地址名单需填写有效 IP 或 CIDR');}
        $url=rtrim((string)$v['canonical_url'],'/');$u=parse_url($url);if(!$u||!in_array($u['scheme']??'',['http','https'],true)||empty($u['host'])||isset($u['user'])||isset($u['pass'])||isset($u['query'])||isset($u['fragment'])||!empty($u['path'])||!filter_var($url,FILTER_VALIDATE_URL))throw new CRA1ThemeSecurityError('规范站点地址需为完整 http/https 域名或 IP，不包含路径');
        if((!empty($v['force_https'])||empty($v['http_test']))&&$u['scheme']!=='https')throw new CRA1ThemeSecurityError('正式部署或强制 HTTPS 前，请先配置有效的 HTTPS 站点');
        $v['canonical_url']=$url;$this->tx(function()use($v){$s=$this->db->prepare('INSERT OR REPLACE INTO settings VALUES(?,?)');foreach($v as$k=>$x)$s->execute([$k,json_encode($x,JSON_UNESCAPED_SLASHES)]);$this->db->prepare('UPDATE sessions SET revoked_at=? WHERE revoked_at=0')->execute([time()]);});
    }
    public static function validCidr(string $s): bool { $p=explode('/',$s);$raw=inet_pton($p[0]);return $raw!==false&&count($p)<=2&&(!isset($p[1])||(ctype_digit($p[1])&&(int)$p[1]<=strlen($raw)*8)); }
    public static function contains(string $ip,string $cidr): bool { $p=explode('/',$cidr);$a=@inet_pton($ip);$b=@inet_pton($p[0]);if(!$a||!$b||strlen($a)!==strlen($b))return false;$bits=isset($p[1])?(int)$p[1]:strlen($a)*8;for($i=0;$i<strlen($a);$i++){$n=min(8,max(0,$bits-$i*8));$m=$n?((255<<(8-$n))&255):0;if((ord($a[$i])&$m)!==(ord($b[$i])&$m))return false;}return true; }
    public static function network(array $server,array $st): array {
        $ip=(string)($server['REMOTE_ADDR']??'');$https=!empty($server['HTTPS'])&&$server['HTTPS']!=='off';$trusted=false;foreach($st['trusted_proxies']??[]as$c)if(self::contains($ip,(string)$c))$trusted=true;
        if($trusted){$chain=array_filter(array_map('trim',explode(',',(string)($server['HTTP_X_FORWARDED_FOR']??''))));$chain[]=$ip;for($i=count($chain)-1;$i>=0;$i--){$candidate=$chain[$i];if(!filter_var($candidate,FILTER_VALIDATE_IP))break;$isProxy=false;foreach($st['trusted_proxies']??[]as$c)if(self::contains($candidate,(string)$c))$isProxy=true;if(!$isProxy){$ip=$candidate;break;}}$https=$https||($server['HTTP_X_FORWARDED_PROTO']??'')==='https';}
        return ['ip'=>$ip,'https'=>$https];
    }
    public static function sameOrigin(array $server,string $canonical,bool $https): bool {
        if(isset($server['HTTP_SEC_FETCH_SITE'])&&!in_array($server['HTTP_SEC_FETCH_SITE'],['same-origin','none'],true))return false;
        $expected=parse_url($canonical);$host=strtolower((string)($server['HTTP_HOST']??''));$authority=strtolower(($expected['host']??'').(isset($expected['port'])?':'.$expected['port']:''));if($authority!==''&&$host!==$authority)return false;
        $o=$server['HTTP_ORIGIN']??null;if($o===null){$ref=$server['HTTP_REFERER']??'';if($ref==='')return false;$p=parse_url($ref);}else{$p=parse_url($o);}
        if(!$p||isset($p['user'])||isset($p['pass']))return false;$actual=strtolower(($p['host']??'').(isset($p['port'])?':'.$p['port']:''));return $actual===$host&&($p['scheme']??'')===($https?'https':'http');
    }
    public static function safeDetail($value): string { $s=mb_substr((string)$value,0,600);$s=preg_replace('/(?:password|secret|token|csrf|cookie|jwt|recovery|sid|st|hd|pt)\s*[:=]\s*[^\s,;]+/i','[敏感信息已隐藏]',$s);return str_replace(["\r","\n","\0"],' ',$s); }
    public function event(string $action,string $result,array $ctx=[],array $diff=[],?string $importKey=null): int {
        return $this->tx(function()use($action,$result,$ctx,$diff,$importKey){if($importKey!==null&&$this->scalar('SELECT id FROM events WHERE import_key=?',[$importKey]))return 0;$risk=(string)($ctx['risk']??'low');$row=['time'=>(int)($ctx['time']??time()),'category'=>$ctx['category']??'operation','action'=>substr($action,0,100),'actor_id'=>$ctx['actor_id']??null,'actor_name'=>$ctx['actor_name']??null,'role'=>$ctx['role']??null,'target'=>mb_substr((string)($ctx['target']??''),0,120),'result'=>$result,'reason'=>self::safeDetail($ctx['reason']??''),'risk'=>$risk,'ip'=>substr((string)($ctx['ip']??''),0,48),'device'=>mb_substr((string)($ctx['device']??''),0,180),'request_id'=>substr((string)($ctx['request_id']??''),0,64),'session_hash'=>substr((string)($ctx['session_hash']??''),0,64),'diff'=>json_encode($diff,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),'previous_hash'=>(string)$this->scalar("SELECT value FROM meta WHERE key='chain_tail'")];$json=json_encode($row,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);$row['integrity']=hash_hmac('sha256',$json,$this->key);$row['import_key']=$importKey;$keys=array_keys($row);$st=$this->db->prepare('INSERT INTO events('.implode(',',$keys).') VALUES('.implode(',',array_fill(0,count($keys),'?')).')');$st->execute(array_values($row));$id=(int)$this->db->lastInsertId();$this->db->prepare("UPDATE meta SET value=? WHERE key='chain_tail'")->execute([$row['integrity']]);if($risk==='high'&&$result!=='attempt'){$k=hash('sha256',$action.'|'.$row['actor_id'].'|'.$row['target'].'|'.$row['ip']);$this->db->prepare('INSERT INTO alerts VALUES(?,?,?,?,?,1,0) ON CONFLICT(key) DO UPDATE SET last_at=excluded.last_at,count=count+1,read_at=0')->execute([$k,$action,$risk,$row['time'],$row['time']]);}return $id;});
    }
    public static function actionLabel(string $a): string {
        if($a==='distribution.overlay_update')return '完成解压覆盖更新';
        if($a==='distribution.overlay_recover')return '恢复解压覆盖更新';
        if($a==='transfer.history.settings.save')return '修改配置历史保留份数';
        $releases=['release.upload'=>'上传主题安装包','release.local.import'=>'导入服务器安装包','release.apply'=>'覆盖更新主题','release.rollback'=>'回退主题更新','release.recover'=>'恢复中断更新'];
        if(isset($releases[$a]))return $releases[$a];
        $map=['login'=>'账号登录','login.mfa'=>'登录双重验证','logout'=>'退出登录','captcha'=>'登录验证码','rate.limit'=>'登录限流','csrf'=>'请求来源校验','permission.denied'=>'越权访问','auth.reauth'=>'重新验证身份','security.password'=>'修改自己的密码','auth.recovery.begin'=>'请求找回后台密码','auth.recovery.finish'=>'邮件重置后台密码','security.recovery.begin'=>'验证找回邮箱','security.recovery.confirm'=>'绑定找回邮箱','security.recovery.remove'=>'解除找回邮箱','security.mfa.begin'=>'开始绑定双重验证','security.mfa.confirm'=>'启用双重验证','security.mfa.cancel'=>'取消绑定双重验证','security.mfa.disable'=>'关闭双重验证','security.mfa.recovery'=>'重新生成恢复码','security.session.revoke'=>'撤销登录会话','security.accounts.create'=>'创建后台账号','security.accounts.update'=>'修改账号与权限','security.settings.save'=>'修改后台安全策略','security.audit.export'=>'导出审计记录','path'=>'修改后台入口','reset'=>'官网整体恢复默认','member.reset'=>'会员中心整体恢复默认','cart.reset'=>'购物车整体恢复默认','workspace.snapshot.rebuild'=>'重建公开快照','snapshot.repair'=>'修复公开快照','migration'=>'迁移独立管理员','recovery'=>'维护恢复账号','seo.generate'=>'生成搜索引擎文件'];
        if(isset($map[$a]))return $map[$a];if(preg_match('/(?:workspace\.)?(?:editor\.)?save|(?:member|cart).*save/',$a))return '保存主题配置';if(strpos($a,'import')!==false)return '导入主题内容';if($a==='media.upload')return '上传主题图片';if($a==='media.rename')return '修改附件名称';if($a==='media.delete')return '附件移入回收站';if($a==='media.restore')return '恢复附件';if($a==='icons.apply')return '导入所选图标';if(strpos($a,'preview')!==false)return '生成草稿预览';if(strpos($a,'page-layout')===0)return '修改页面布局';if(strpos($a,'seo.')===0)return '修改搜索引擎设置';return '其他后台操作';
    }
    public static function resultLabel(string $s): string { return ['ok'=>'成功','fail'=>'失败','attempt'=>'开始操作','partial'=>'部分完成','locked'=>'已限流','denied'=>'已拒绝'][$s]??'未知结果'; }
    public static function present(array $r): array { $r['id']=(int)$r['id'];$r['time']=(int)$r['time'];$r['actor_id']=$r['actor_id']===null?null:(int)$r['actor_id'];$r['action_label']=self::actionLabel($r['action']);$r['result_label']=self::resultLabel($r['result']);$r['actor_name']=$r['actor_name']?:'未记录';$r['role_label']=self::ROLES[$r['role']??'']??'未记录';$r['risk_label']=['low'=>'一般','medium'=>'关注','high'=>'高风险'][$r['risk']]??'未记录';$r['reason_label']=preg_match('/[\x{4e00}-\x{9fff}]/u',$r['reason'])?$r['reason']:($r['result']==='ok'?'操作完成':($r['result']==='attempt'?'已开始执行':'操作未完成，技术详情见下方'));$r['diff']=json_decode($r['diff'],true)?:[];unset($r['previous_hash'],$r['integrity'],$r['import_key']);return $r; }
    private function filter(array $actor,array $p): array { $clauses=[];$args=[];if($actor['role']==='operator'){$clauses[]='actor_id=?';$args[]=$actor['id'];}elseif(!empty($p['actor_id'])){$clauses[]='actor_id=?';$args[]=(int)$p['actor_id'];}foreach(['action','result','risk','ip','category']as$k)if(isset($p[$k])&&$p[$k]!==''){$clauses[]=$k.'=?';$args[]=(string)$p[$k];}if(!empty($p['domain'])){$clauses[]='target LIKE ?';$args[]=str_replace(['%','_'],['',''],(string)$p['domain']).'%';}if(!empty($p['since'])){$clauses[]='time>=?';$args[]=(int)$p['since'];}if(!empty($p['until'])){$clauses[]='time<=?';$args[]=(int)$p['until'];}if(!empty($p['cursor'])){$clauses[]='id<?';$args[]=(int)$p['cursor'];}return [$clauses?' WHERE '.implode(' AND ',$clauses):'',$args]; }
    public function logs(array $actor,array $p,int $limit=50): array { [$where,$args]=$this->filter($actor,$p);$limit=max(1,min(5000,$limit));$r=$this->rows('SELECT * FROM events'.$where.' ORDER BY id DESC LIMIT '.($limit+1),$args);$more=count($r)>$limit;if($more)array_pop($r);return ['list'=>array_map([self::class,'present'],$r),'hasMore'=>$more,'nextCursor'=>$more?(int)end($r)['id']:null]; }
    public function logDetail(array $actor,int $id): array { $r=$this->rows('SELECT * FROM events WHERE id=?',[$id]);if(!$r||($actor['role']==='operator'&&(int)$r[0]['actor_id']!==(int)$actor['id']))throw new CRA1ThemeSecurityError('无权读取该审计记录',403,'PERMISSION_DENIED');return self::present($r[0]); }
    public static function csvCell($s): string { $s=(string)$s;if(preg_match('/^[\s\x00-\x1f]*[=+@-]/u',$s))return "'".$s;return $s; }
    public function verifyIntegrity(): array {
        $archive=$this->root.'/runtime/cra1_theme/security-archive.sqlite';$attached=is_file($archive);$statement=null;
        if($attached)$this->db->exec('ATTACH DATABASE '.$this->db->quote($archive).' AS integrity_archive');
        $this->db->exec('BEGIN');
        try {
            $prev=(string)($this->scalar("SELECT value FROM meta WHERE key='archive_anchor'")?:'');$expected=(string)$this->scalar("SELECT value FROM meta WHERE key='chain_tail'");$count=0;
            $statement=$this->db->query($attached?'SELECT * FROM events UNION SELECT * FROM integrity_archive.events ORDER BY id':'SELECT * FROM events ORDER BY id');
            while($r=$statement->fetch()){$integrity=$r['integrity'];$previous=$r['previous_hash'];unset($r['id'],$r['integrity'],$r['import_key']);$r['time']=(int)$r['time'];$r['actor_id']=$r['actor_id']===null?null:(int)$r['actor_id'];if($previous!==$prev||!hash_equals($integrity,hash_hmac('sha256',json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),$this->key)))throw new RuntimeException('审计完整性校验失败，记录序号 '.$count);$prev=$integrity;$count++;}
            if(!hash_equals($prev,$expected))throw new RuntimeException('审计尾部校验失败');
            $statement->closeCursor();$this->db->exec('COMMIT');return ['verified'=>$count,'tail'=>$prev];
        }catch(Throwable $e){if($statement)$statement->closeCursor();$this->db->exec('ROLLBACK');throw $e;}
        finally{if($attached)$this->db->exec('DETACH DATABASE integrity_archive');}
    }
}
