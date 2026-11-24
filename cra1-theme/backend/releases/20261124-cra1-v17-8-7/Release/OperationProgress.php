<?php
declare(strict_types=1);

namespace CRA1\Theme\Release;

use CRA1\Theme\Files;

final class OperationProgress
{
    private string $directory;
    private string $file;
    public string $phase='';

    public function __construct(string $root,string $session,$token)
    {
        $this->directory=$root.'/runtime/cra1_theme/distribution/progress';
        if(!is_string($token)||!preg_match('/^[0-9a-f]{32}$/D',$token)||$session==='')throw new \InvalidArgumentException('操作进度标识无效');
        $this->file=$this->directory.'/'.hash('sha256',$session.':'.$token).'.json';
    }

    public function step(string $phase): void
    {
        $this->phase=$phase;
        // Feedback is optional. A site that cannot store it must still be able to use the updater.
        try{
            Files::noLinks($this->file);
            if(!is_dir($this->directory))Files::directory($this->directory,0700);
            Files::putJson($this->file,['phase'=>$phase,'time'=>time()],0600);
        }catch(\Throwable $ignored){}
    }

    public function read(): ?array
    {
        $row=Files::json($this->file,true);
        if(!$row||($row['time']??0)<time()-900)return null;
        return ['phase'=>$row['phase']];
    }

    public function finish(): void
    {
        try{
            Files::noLinks($this->file);
            if(is_file($this->file))@unlink($this->file);
            $cutoff=time()-900;
            foreach(glob($this->directory.'/*.json')?:[] as $file){
                if(!is_link($file)&&is_file($file)&&(@filemtime($file)?:time())<$cutoff)@unlink($file);
            }
        }catch(\Throwable $ignored){}
    }
}
