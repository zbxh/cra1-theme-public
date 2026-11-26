<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;

/** Preserve the failing operation without returning request data or trace arguments. */
final class InstallerFailure extends \RuntimeException
{
    public string $phase;
    private string $state;

    public function __construct(string $phase, \Throwable $previous,string $state='unknown')
    {
        $this->phase=$phase;
        $this->state=$state;
        parent::__construct($previous->getMessage(),0,$previous);
    }

    public static function response(\Throwable $error,string $phase,string $root,array $secrets=[]): array
    {
        if($error instanceof UpdateFailure)return ['status'=>400,'msg'=>$error->message(true),'error'=>$error->details(true)];
        $state=$error instanceof self?$error->state:'unknown';
        if($error instanceof self)$phase=$error->phase;
        foreach(['DATABASE_PASSWORD','DATABASE_USERNAME','DATABASE_NAME','DATABASE_HOSTNAME']as$name)
            if(defined($name))$secrets[]=(string)constant($name);
        $reference=strtoupper(bin2hex(random_bytes(6)));$chain=[];
        for($current=$error;$current!==null&&count($chain)<6;$current=$current->getPrevious()){
            $chain[]=['type'=>get_class($current),'file'=>self::clean($current->getFile(),$root,$secrets),
                'line'=>$current->getLine(),'message'=>self::clean($current->getMessage(),$root,$secrets)];
        }
        $cause=$error instanceof self&&$error->getPrevious()?$error->getPrevious():$error;
        $reason=\CRA1\Theme\Diagnostics::reason($cause,$root,$secrets);
        try{error_log('CRA1 installer '.json_encode(['reference'=>$reference,'phase'=>$phase,'errors'=>$chain],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE));}catch(\Throwable $ignored){}
        $status=$state==='cleaned'?'已清理本次初始化写入，V10 原主题继续使用。':($state==='untouched'?'尚未初始化后台，V10 原主题继续使用。':'本次结果需要重新检测确认。');
        $editInput=$cause instanceof \InvalidArgumentException&&$state==='untouched'&&in_array($phase,['检查填写内容','设置主题后台账号'],true);
        $next=$editInput?'修改填写内容后重新提交。':($state==='recovery_required'?'点击“重新检测”。若仍显示初始化资料不完整，请保留现场并检查写入权限或从备份恢复。':'处理原因后点击“重新检测”。');
        return ['status'=>400,'msg'=>'操作在“'.$phase.'”时失败。'."\n".'原因：'.$reason."\n".$status.$next."\n".'参考编号：'.$reference,
            'error'=>['phase'=>$phase,'reason'=>$reason,'reference'=>$reference,'state'=>$state,'status_text'=>$status,'next'=>$next,'needs_check'=>!$editInput&&!($error instanceof \InvalidArgumentException)]];
    }

    private static function clean(string $value,string $root,array $secrets): string
    {
        return \CRA1\Theme\Diagnostics::clean($value,$root,$secrets);
    }
}
