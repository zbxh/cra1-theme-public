<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;

/** Only native theme selectors may be changed; business and plugin records are never written. */
final class ThemeSelection
{
    public const KEYS=['web_theme','clientarea_theme','cart_theme','home_theme','clientarea_theme_mobile','cart_theme_mobile','home_theme_mobile','clientarea_theme_mobile_switch'];
    private \PDO $db;
    private string $table;
    private $invalidate;
    public function __construct(\PDO $db,string $prefix,callable $invalidate)
    {
        if(!preg_match('/^[A-Za-z0-9_]*$/D',$prefix))throw new \RuntimeException('系统数据库表前缀无效');
        $this->db=$db;$this->table=$prefix.'configuration';$this->invalidate=$invalidate;
    }
    public static function native(string $root): self
    {
        require_once $root.'/config.php';require_once $root.'/vendor/autoload.php';
        foreach(['IDCSMART_ROOT'=>$root.'/','WEB_ROOT'=>$root.'/public/','UPLOAD_DEFAULT'=>$root.'/public/upload/common/default/']as$key=>$value)if(!defined($key))define($key,$value);
        // Initialize native cache configuration without entering its HTTP/auth pipeline.
        // Keep the independent administrator's JSON and diagnostic handlers.
        $exceptionHandler=set_exception_handler(static function():void{});restore_exception_handler();
        $errorHandler=set_error_handler(static function():bool{return false;});restore_error_handler();
        $level=ob_get_level();ob_start();
        try{$app=new \think\App($root.'/');$app->debug(false);$app->initialize();}
        finally{
            while(ob_get_level()>$level)ob_end_clean();
            if($exceptionHandler!==null)set_exception_handler($exceptionHandler);
            if($errorHandler!==null)set_error_handler($errorHandler);
        }
        $prefix=(string)$app->config->get('database.connections.mysql.prefix','idcsmart_');
        $db=new \PDO('mysql:host='.DATABASE_HOSTNAME.';port='.DATABASE_PORT.';dbname='.DATABASE_NAME.';charset='.DATABASE_CHARSET,DATABASE_USERNAME,DATABASE_PASSWORD,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_TIMEOUT=>5]);
        return new self($db,$prefix,static function():void{
            $key=\app\common\logic\CacheLogic::CACHE_CONFIGURATION;
            if(idcsmart_cache($key,null)===false){
                // Native file caches return false when no entry exists; that is
                // already an invalidated cache, not a permissions failure.
                $remaining=idcsmart_cache($key);
                if($remaining!==null&&$remaining!==false&&$remaining!=='')throw new \RuntimeException('系统主题配置缓存无法刷新，请检查当前缓存服务或 runtime/cache/ 的写入权限');
            }
        });
    }
    public function read(bool $lock=false): array
    {
        $sql='SELECT setting,value FROM '.$this->table.' WHERE setting IN ('.implode(',',array_fill(0,count(self::KEYS),'?')).') ORDER BY setting';
        if($lock&&$this->db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql')$sql.=' FOR UPDATE';
        $query=$this->db->prepare($sql);$query->execute(self::KEYS);$values=$query->fetchAll(\PDO::FETCH_KEY_PAIR);ksort($values);return $values;
    }
    public function change(array $expected,array $changes): void
    {
        if(array_diff(array_keys($changes),self::KEYS))throw new \InvalidArgumentException('只能修改系统主题选择，禁止修改其他系统设置');
        $committed=false;$this->db->beginTransaction();
        try{
            $current=$this->read(true);ksort($expected);
            if($current!==$expected)throw new \CRA1ThemeSecurityError('系统主题选择已被其他管理员修改，请重新检查后操作。',409,'THEME_SELECTION_CHANGED');
            $update=$this->db->prepare('UPDATE '.$this->table.' SET value=? WHERE setting=?');
            foreach($changes as$key=>$value){
                if(!array_key_exists($key,$current))throw new \RuntimeException('系统缺少主题设置项：'.$key.'，本次未切换，请先检查 V10 主题设置');
                $update->execute([(string)$value,$key]);
            }
            // Check the cache service before committing, and clear it again after commit.
            ($this->invalidate)();$this->db->commit();$committed=true;($this->invalidate)();
        }catch(\Throwable $error){
            if($this->db->inTransaction())$this->db->rollBack();
            if($committed){
                try{
                    $this->db->beginTransaction();$now=$this->read(true);
                    foreach($changes as$key=>$value)if(($now[$key]??null)!==(string)$value)throw new \RuntimeException('缓存失败后，系统主题选择又发生了变化');
                    $update=$this->db->prepare('UPDATE '.$this->table.' SET value=? WHERE setting=?');
                    foreach($changes as$key=>$value)$update->execute([$expected[$key],$key]);
                    $this->db->commit();($this->invalidate)();
                }catch(\Throwable $restore){
                    if($this->db->inTransaction())$this->db->rollBack();
                    throw new \RuntimeException('系统主题选择或缓存的最终状态尚未确认，主题文件未清理。请先在 V10 后台核对主题设置。原因：'.$restore->getMessage(),0,$error);
                }
            }
            throw $error;
        }
    }
}
