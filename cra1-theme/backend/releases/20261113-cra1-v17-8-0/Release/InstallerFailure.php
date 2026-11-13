<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;

/** Preserve the failing operation without returning request data or trace arguments. */
final class InstallerFailure extends \RuntimeException
{
    public string $phase;

    public function __construct(string $phase, \Throwable $previous)
    {
        $this->phase=$phase;
        parent::__construct($previous->getMessage(),0,$previous);
    }

    public static function response(\Throwable $error,string $phase,string $root,array $secrets=[]): array
    {
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
        return ['status'=>400,'msg'=>'操作在“'.$phase.'”时失败。'."\n".'原因：'.$reason."\n".'参考编号：'.$reference,
            'error'=>['phase'=>$phase,'reason'=>$reason,'reference'=>$reference,'needs_check'=>!($error instanceof \InvalidArgumentException)]];
    }

    private static function clean(string $value,string $root,array $secrets): string
    {
        return \CRA1\Theme\Diagnostics::clean($value,$root,$secrets);
    }
}
