<?php
declare(strict_types=1);
namespace CRA1\Theme;

/** A failed filesystem operation with evidence, never a guessed permission error. */
final class Failure extends \RuntimeException
{
    public string $phase;
    public string $target;
    public string $warning;
    public ?int $mode;

    public function __construct(string $phase, string $target, string $warning = '', ?int $mode = null)
    {
        $this->phase=$phase; $this->target=$target; $this->warning=$warning; $this->mode=$mode;
        parent::__construct($this->describe(defined('CRA1_THEME_ROOT') ? CRA1_THEME_ROOT : ''));
    }

    public static function attempt(string $phase, string $path, callable $operation, ?int $mode = null)
    {
        $warning='';
        set_error_handler(static function(int $level,string $message)use(&$warning):bool{$warning=$message;return true;});
        try { $result=$operation(); }
        finally { restore_error_handler(); }
        if ($result===false) throw new self($phase,$path,$warning,$mode);
        return $result;
    }

    public function describe(string $root): string
    {
        $path=Diagnostics::clean($this->target,$root);
        $prefix=$this->phase.'失败：'.$path.'。';
        if (stripos($this->warning,'open_basedir')!==false) return $prefix.'PHP 的 open_basedir 限制阻止访问此位置，请在网站面板将此主题所需目录加入允许范围。';
        if (preg_match('/read-only file system/i',$this->warning)) return $prefix.'文件系统为只读，请联系服务器管理员恢复该目录所在磁盘的写入能力。';
        if (preg_match('/disk quota exceeded/i',$this->warning)) return $prefix.'网站账号的磁盘配额已用完，请增加配额或清理可删除文件后重试。';
        if (preg_match('/no space left|disk (?:is )?full/i',$this->warning)) return $prefix.'磁盘空间或文件数量已用完，请检查可用空间和 inode 后重试。';
        if (preg_match('/permission denied|operation not permitted/i',$this->warning)) return $prefix.$this->permissions($root);
        if (preg_match('/no such file|not a directory/i',$this->warning)) return $prefix.'目标或上级目录不存在，或路径中有同名文件，请检查该位置是否完整。';
        if (preg_match('/is a directory|directory not empty/i',$this->warning)) return $prefix.'目标文件位置已有同名目录，无法替换。请先核对并移走该同名目录，不要删除真实业务文件。';
        if (preg_match('/file exists/i',$this->warning)) return $prefix.'目标位置已有同名文件，未覆盖原文件。请刷新状态后重新操作。';
        if (preg_match('/too many open files/i',$this->warning)) return $prefix.'PHP 进程可打开的文件数量已达上限，请检查进程文件限制。';
        if ($this->phase==='获取配置锁') return $prefix.'未能取得文件锁，请稍后重试；持续出现时请检查文件系统是否支持文件锁。';
        if ($this->phase==='写入文件') return $prefix.'内容未完整写入，未替换原文件。请检查磁盘空间、配额及存储服务状态。';
        return $prefix.'系统未提供可确认的原因，请让服务器管理员检查该位置和对应请求记录。';
    }

    private function permissions(string $root): string
    {
        $write=!preg_match('/读取/',$this->phase);
        $directory=in_array($this->phase,['创建目录','创建临时文件','替换文件','移出主题文件'],true);
        $at=$directory?dirname($this->target):$this->target;
        for($n=0;$n<64&&!@file_exists($at)&&dirname($at)!==$at;$n++)$at=dirname($at);
        // A blocked ancestor, rather than the destination, can be the cause.
        for($p=dirname($at);$p!==dirname($p);$p=dirname($p))if(@is_dir($p)&&!@is_executable($p))$at=$p;
        $mode=@fileperms($at);$uid=@fileowner($at);$gid=@filegroup($at);
        $owner=$uid===false?'未知':(string)$uid;$group=$gid===false?'未知':(string)$gid;
        if($uid!==false&&function_exists('posix_getpwuid')){$row=posix_getpwuid($uid);$owner=$row['name']??$owner;}
        if($gid!==false&&function_exists('posix_getgrgid')){$row=posix_getgrgid($gid);$group=$row['name']??$group;}
        $actor=Diagnostics::runtimeUser();
        $private=($this->mode!==null&&($this->mode&0077)===0)||strpos($this->target,'/runtime/cra1_theme/')!==false;
        $needed=@is_dir($at)?($write?'读取、写入和进入权限':'读取和进入权限'):($write?'读取和写入权限':'读取权限');
        $suggest=@is_dir($at)?($private?'700':'755'):($private?'600':'640');
        return '权限不足。检查位置：'.Diagnostics::clean($at,$root).'；PHP 运行账号：'.$actor.'；当前属主/组：'.$owner.':'.$group.'；权限：'.($mode===false?'无法读取':sprintf('%04o',$mode&0777)).'。请将此位置交给正确的网站运行账号，并给予'.$needed.'（属主正确时可使用 '.$suggest.'；共享组写入需单独配置）。不要将整站改为 777。';
    }
}
