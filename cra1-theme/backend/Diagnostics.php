<?php
declare(strict_types=1);
namespace CRA1\Theme;

/** Administrator-only explanations. Public errors use Http\CustomerError. */
final class Diagnostics
{
    public static function runtimeUser(): string
    {
        if(!function_exists('posix_geteuid'))return '无法自动读取，请查看网站 PHP 进程账号';
        $id=posix_geteuid();$row=function_exists('posix_getpwuid')?posix_getpwuid($id):false;
        return ($row['name']??(string)$id).'（UID '.$id.'）';
    }

    public static function clean(string $value,string $root='',array $secrets=[]): string
    {
        foreach(['DATABASE_PASSWORD','DATABASE_USERNAME','DATABASE_NAME','DATABASE_HOSTNAME']as$name)if(defined($name))$secrets[]=(string)constant($name);
        foreach($secrets as$secret)if(is_string($secret)&&strlen($secret)>=3)$value=str_replace($secret,'[已隐藏]',$value);
        if($root!==''){$value=str_replace(rtrim($root,'/').'/', '', $value);$value=str_replace(rtrim($root,'/'),'网站根目录',$value);}
        $value=(string)preg_replace('~https?://[^\s<>"\x27]+~i','[服务地址已隐藏]',$value);
        $value=(string)preg_replace('/Bearer\s+[^\s,;]+/i','Bearer [已隐藏]',$value);
        $value=(string)preg_replace('/\b(password|passwd|pwd|secret|(?:access_|refresh_)?token|csrf|cookie|jwt|authorization|api_key|api_secret|secret_key|client_secret|DATABASE_PASSWORD)\b["\x27]?\s*[:=]\s*(?:"[^"]*"|\x27[^\x27]*\x27|[^\s,;&]+)/i','$1=[已隐藏]',$value);
        $value=(string)preg_replace('~(?<![\w/:])/(?:[^/\s()<>"\x27:]+/)+([^/\s()<>"\x27:]+)~u','[目录]/$1',$value);
        return mb_substr((string)preg_replace('/[\x00-\x1f\x7f\x{202a}-\x{202e}\x{2066}-\x{2069}]/u',' ',$value),0,1800);
    }

    public static function reason(\Throwable $error,string $root='',array $secrets=[]): string
    {
        if($error instanceof Failure)return self::clean($error->describe($root),$root,$secrets);
        if($error instanceof \PDOException){
            $driver=(int)($error->errorInfo[1]??0);$raw=$error->getMessage();
            if($driver===1045||preg_match('/access denied for user|authentication failed/i',$raw))return '数据库拒绝认证，请检查站点数据库账号、密码和连接授权；认证资料已隐藏。';
            if(in_array($driver,[2002,2003,2006],true)||preg_match('/connection refused|server has gone away|could not connect/i',$raw))return '数据库连接不可用，请检查数据库服务、连接地址、端口和本地套接字配置；连接资料已隐藏。';
            if($driver===1044||preg_match('/command denied|permission denied/i',$raw))return '数据库账号缺少本次操作所需权限，请检查该账号对站点数据库的授权。';
            if(preg_match('/database is locked|database table is locked/i',$raw))return '安全数据库正被其他操作占用，请稍后重试；持续出现时检查数据库锁和存储状态。';
            if(preg_match('/readonly database|unable to open database file/i',$raw))return 'SQLite 数据库无法写入或打开，请检查本次操作所用数据库文件及上级目录的属主和写入权限，保留私密目录 700、私密文件 600。';
            if(preg_match('/disk is full|database or disk is full/i',$raw))return '数据库所在磁盘空间已用完，请检查剩余空间、配额和 inode。';
            if($driver===1146||preg_match('/no such table|table.*doesn.t exist/i',$raw))return '所需数据库表不存在，请检查系统或模块升级是否完整；不要手动删除或重建业务表。';
            if($driver===1054||preg_match('/no such column|unknown column/i',$raw))return '数据库缺少本次操作所需字段，请检查系统或模块升级是否完整。';
            if($driver===1064||preg_match('/syntax error/i',$raw))return '数据库查询语句与当前数据库不兼容，请联系主题维护人员检查查询；未返回原始 SQL。';
            return '数据库操作未完成，请根据参考编号检查数据库错误记录；账号、连接资料和原始 SQL 已隐藏。';
        }
        $value=$error->getMessage();
        if(preg_match('/[\x{3400}-\x{9fff}]/u',$value)&&!preg_match('/SQLSTATE|stack trace|fatal error|<[^>]+>|\b(?:Exception|TypeError|ReferenceError)\b/i',$value))return self::clean($value,$root,$secrets);
        return '服务未提供可直接确认的原因，请根据参考编号检查服务端记录。';
    }

    public static function record(\Throwable $error,string $phase,string $root='',string $reference='',array $secrets=[]): string
    {
        $reference=$reference?:strtoupper(bin2hex(random_bytes(6)));$chain=[];
        for($current=$error;$current!==null&&count($chain)<6;$current=$current->getPrevious())$chain[]=['type'=>get_class($current),'message'=>self::reason($current,$root,$secrets),'file'=>self::clean($current->getFile(),$root,$secrets),'line'=>$current->getLine()];
        error_log('CRA1 failure '.json_encode(['reference'=>$reference,'phase'=>self::clean($phase,$root),'errors'=>$chain],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE));
        return $reference;
    }

    public static function response(\Throwable $error,string $phase,string $root,string $reference=''): array
    {
        $reference=self::record($error,$phase,$root,$reference);$reason=self::reason($error,$root);
        return ['status'=>500,'msg'=>$phase.'失败。原因：'.$reason.' 参考编号：'.$reference,'code'=>'OPERATION_FAILED','request_id'=>$reference,
            'error'=>['phase'=>$phase,'reason'=>$reason,'reference'=>$reference]];
    }
}
