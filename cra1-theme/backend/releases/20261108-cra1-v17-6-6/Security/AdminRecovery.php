<?php
declare(strict_types=1);
namespace CRA1\Theme\Security;

/** Independent administrator recovery; existing SQLite schema remains compatible. */
final class AdminRecovery
{
    private \CRA1ThemeSecurity $security;
    private $sender;
    public const TTL=300;
    public const RETRY=60;
    public function __construct(\CRA1ThemeSecurity $security,?callable $sender=null)
    {
        $this->security=$security;
        $this->sender=$sender??static function(string $email,string $code,string $purpose)use($security):bool{return RecoveryMailer::send($security->root,$email,$code,$purpose);};
    }
    private static function email(string $email): string
    {
        $email=strtolower(trim($email));
        if(strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL))throw new \CRA1ThemeSecurityError('请填写有效的邮箱地址');
        return $email;
    }
    private function bound(int $id): string
    {
        $value=$this->security->scalar('SELECT value FROM meta WHERE key=?',['recovery_email:'.$id]);
        if(!$value)return '';
        $record=json_decode($this->security->decrypt((string)$value),true);
        if(!is_array($record)||($record['version']??0)!==1||empty($record['verified_at']))throw new \CRA1ThemeSecurityError('找回邮箱资料异常，请联系管理员',503,'RECOVERY_UNAVAILABLE');
        return self::email((string)($record['email']??''));
    }
    public function status(int $id): array
    {
        $email=$this->bound($id);
        if($email==='')return ['enabled'=>false,'email'=>''];
        [$local,$domain]=explode('@',$email,2);
        return ['enabled'=>true,'email'=>substr($local,0,1).'***@'.$domain];
    }
    private function throttle(string $purpose,string $name,string $email,string $ip): void
    {
        $s=$this->security;
        foreach([
            ['ip:'.$s->recoveryHash('ip',$ip),20,900],
            ['account:'.$s->recoveryHash('account',strtolower(trim($name))),5,900],
            ['email:'.$s->recoveryHash('email',$email),6,900],
            ['cooldown:'.$purpose.':'.$s->recoveryHash('account',strtolower(trim($name))),1,self::RETRY],
        ]as[$key,$max,$window])if(!$s->boundedRate('recovery:'.$key,$max,$window))throw new \CRA1ThemeSecurityError('请求过于频繁，请稍后再试',429,'RATE_LIMITED');
    }
    private function issue(?array $a,string $purpose,string $session,string $email): array
    {
        $s=$this->security;$token=bin2hex(random_bytes(32));$code=str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);$hash=\CRA1ThemeSecurity::hashToken($token);
        $payload=['epoch'=>$a?(int)$a['epoch']:0,'email'=>$s->encrypt($email),'proof'=>$s->recoveryHash('code',$token.'|'.$code),'ready'=>false];
        $s->tx(function()use($s,$a,$purpose,$session,$hash,$payload){
            if($a)$s->db->prepare('UPDATE challenges SET used_at=? WHERE account_id=? AND kind=? AND used_at=0')->execute([time(),$a['id'],'recovery.'.$purpose]);
            $s->db->prepare('INSERT INTO challenges VALUES(?,?,?,?,?,?,0,0)')->execute([$hash,$a?$a['id']:null,'recovery.'.$purpose,\CRA1ThemeSecurity::hashToken($session),json_encode($payload),time()+self::TTL]);
        });
        $sent=false;
        if($a){try{$sent=($this->sender)($email,$code,$purpose)===true;}catch(\Throwable $e){error_log('[CRA1] admin recovery delivery failed');}}
        if($sent){$payload['ready']=true;$s->db->prepare('UPDATE challenges SET payload=? WHERE hash=? AND used_at=0')->execute([json_encode($payload),$hash]);}
        elseif($a){$s->db->prepare('UPDATE challenges SET used_at=? WHERE hash=?')->execute([time(),$hash]);}
        if($a&&!$sent&&$purpose==='bind')throw new \CRA1ThemeSecurityError('验证码暂时无法发送，请稍后重试或检查系统邮件设置',503,'MAIL_UNAVAILABLE');
        return ['challenge'=>$token,'expires_in'=>self::TTL,'retry_after'=>self::RETRY];
    }
    public function beginBinding(array $actor,string $session,string $email,string $ip): array
    {
        $email=self::email($email);$this->throttle('bind',(string)$actor['username'],$email,$ip);
        $a=$this->security->account((int)$actor['id']);
        if(!(int)$a['enabled']||(int)$a['epoch']!==(int)$actor['epoch'])throw new \CRA1ThemeSecurityError('登录已失效，请重新登录',401,'SESSION_INVALID');
        return $this->issue($a,'bind',$session,$email);
    }
    public function beginReset(string $name,string $email,string $session,string $ip): array
    {
        $name=trim($name);\CRA1ThemeSecurity::username($name);$email=self::email($email);$this->throttle('reset',$name,$email,$ip);
        $rows=$this->security->rows('SELECT * FROM accounts WHERE username=? COLLATE NOCASE',[$name]);$a=$rows[0]??null;
        if($a&&(!(int)$a['enabled']||!hash_equals($this->bound((int)$a['id']),$email)))$a=null;
        // Identical public response for missing, disabled and unmatched accounts.
        return $this->issue($a,'reset',$session,$email);
    }
    private function verify(string $token,string $purpose,string $session,string $code,?int $owner,callable $apply): bool
    {
        $s=$this->security;
        return $s->tx(function()use($s,$token,$purpose,$session,$code,$owner,$apply){
            $rows=$s->rows('SELECT * FROM challenges WHERE hash=?',[\CRA1ThemeSecurity::hashToken($token)]);$c=$rows[0]??null;
            if(!$c||$c['kind']!=='recovery.'.$purpose||!hash_equals($c['session_hash'],\CRA1ThemeSecurity::hashToken($session))||(int)$c['used_at']!==0||(int)$c['attempts']>=5||(int)$c['expires_at']<=time())return false;
            $s->db->prepare('UPDATE challenges SET attempts=attempts+1 WHERE hash=?')->execute([$c['hash']]);
            $p=json_decode($c['payload'],true)?:[];
            if(!preg_match('/^[0-9]{6}$/D',$code)||empty($p['ready'])||empty($c['account_id'])||!hash_equals((string)($p['proof']??''),$s->recoveryHash('code',$token.'|'.$code)))return false;
            $a=$s->account((int)$c['account_id']);
            if(!(int)$a['enabled']||(int)$a['epoch']!==(int)($p['epoch']??0)||($owner!==null&&(int)$a['id']!==$owner))return false;
            $email=self::email($s->decrypt((string)$p['email']));
            if($purpose==='reset'&&!hash_equals($this->bound((int)$a['id']),$email))return false;
            $apply($a,$email);
            $s->db->prepare('UPDATE accounts SET epoch=epoch+1,updated_at=? WHERE id=?')->execute([time(),$a['id']]);
            $s->db->prepare('UPDATE challenges SET used_at=? WHERE account_id=? AND used_at=0')->execute([time(),$a['id']]);
            $s->revoke((int)$a['id']);
            return true;
        });
    }
    private static function failure(): void {throw new \CRA1ThemeSecurityError('验证码错误或已失效，请重新获取',400,'RECOVERY_INVALID');}
    public function finishBinding(array $actor,string $token,string $session,string $code): void
    {
        $s=$this->security;
        if(!$this->verify($token,'bind',$session,trim($code),(int)$actor['id'],static function(array $a,string $email)use($s){
            $record=$s->encrypt(json_encode(['version'=>1,'email'=>$email,'verified_at'=>time()]));
            $s->db->prepare('INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)')->execute(['recovery_email:'.$a['id'],$record]);
        }))self::failure();
    }
    public function removeBinding(array $actor): void
    {
        $s=$this->security;$s->tx(static function()use($s,$actor){
            $a=$s->account((int)$actor['id']);
            if(!(int)$a['enabled']||(int)$a['epoch']!==(int)$actor['epoch'])throw new \CRA1ThemeSecurityError('登录已失效，请重新登录',401,'SESSION_INVALID');
            $s->db->prepare('DELETE FROM meta WHERE key=?')->execute(['recovery_email:'.$a['id']]);
            $s->db->prepare('UPDATE accounts SET epoch=epoch+1,updated_at=? WHERE id=?')->execute([time(),$a['id']]);
            $s->db->prepare('UPDATE challenges SET used_at=? WHERE account_id=? AND used_at=0')->execute([time(),$a['id']]);$s->revoke((int)$a['id']);
        });
    }
    public function finishReset(string $token,string $session,string $code,string $password,string $ip): void
    {
        $s=$this->security;
        if(!$s->boundedRate('recovery:verify:'.$s->recoveryHash('ip',$ip),30,900))throw new \CRA1ThemeSecurityError('验证次数过多，请稍后重试',429,'RATE_LIMITED');
        $hash=\CRA1ThemeSecurity::password($password);
        if(!$this->verify($token,'reset',$session,trim($code),null,static function(array $a,string $email)use($s,$hash){
            $s->db->prepare('UPDATE accounts SET password_hash=?,must_change=0 WHERE id=?')->execute([$hash,$a['id']]);
        }))self::failure();
    }
}
