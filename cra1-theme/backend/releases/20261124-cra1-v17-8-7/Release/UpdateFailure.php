<?php
declare(strict_types=1);

namespace CRA1\Theme\Release;

final class UpdateFailure extends \RuntimeException
{
    public string $phase;
    public string $reason;
    public string $state;
    public ?string $reference;

    public function __construct(string $phase,string $reason,string $state,\Throwable $previous,?string $reference=null)
    {
        $this->phase=$phase;$this->reason=$reason;$this->state=$state;$this->reference=$reference;
        parent::__construct($this->message(),0,$previous);
    }

    public function details(bool $installer=false): array
    {
        if($this->state==='recovery_required'){
            $status='当前生效状态待确认，恢复记录已保留。';
            $next=$installer?'点击“重新检测”，再恢复未完成的更新。':'打开“备份与回退”，恢复中断更新后再重试。';
        }elseif($this->state==='unknown'){
            $status='尚未确认原主题是否仍在生效。';
            $next=$installer?'点击“重新检测”确认当前状态，再决定重试或恢复。':'刷新并在“备份与回退”确认当前版本和恢复状态，再决定重试或回退。';
        }else{
            $status=$this->state==='restored'?'原主题文件和生效版本已恢复。':'本次操作未切换生效版本。';
            $next=$installer?'处理原因后点击“重新检测”再试。':'处理原因后重新选择安装包，再执行检查和更新。';
        }
        return ['phase'=>$this->phase,'reason'=>$this->reason,'state'=>$this->state,'status_text'=>$status,'next'=>$next,'reference'=>$this->reference,'needs_check'=>true];
    }

    public function message(bool $installer=false): string
    {
        $data=$this->details($installer);
        return '操作在“'.$this->phase.'”阶段失败。原因：'.$this->reason.' '.$data['status_text'].' '.$data['next'].($this->reference?' 参考编号：'.$this->reference:'');
    }
}
