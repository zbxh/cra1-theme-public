<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

final class Installer
{
    private string $root;
    public function __construct(string $root){$this->root=rtrim($root,'/');}
    public function state(): array
    {
        $dir=$this->root.'/runtime/cra1_theme';
        foreach([$dir.'/install.json',$dir.'/security.sqlite',$this->root.'/config/cra1_theme_security.key']as$path){
            Files::noLinks($path);
            if(file_exists($path)&&!is_file($path))throw new \RuntimeException('主题安装资料格式异常，原资料已保留，请联系网站管理员检查');
        }
        $database=is_file($dir.'/security.sqlite');$key=is_file($this->root.'/config/cra1_theme_security.key');
        if($database!==$key||(is_file($dir.'/install.json')&&(!$database||!$key)))throw new \RuntimeException('主题初始化资料不完整，原资料已保留，请联系网站管理员检查，勿重复安装');
        if($database&&$key){
            // A process may stop after creating both files but before writing an
            // account. Inspect read-only; never turn a partial setup into a new one.
            try{
                $bytes=(string)file_get_contents($this->root.'/config/cra1_theme_security.key');
                $db=new \PDO('sqlite:'.$dir.'/security.sqlite',null,null,[\PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::SQLITE_ATTR_OPEN_FLAGS=>\PDO::SQLITE_OPEN_READONLY]);
                $meta=$db->query('SELECT key,value FROM meta')->fetchAll(\PDO::FETCH_KEY_PAIR);
                if(strlen($bytes)!==32||($meta['schema']??null)!=='1'||!hash_equals((string)($meta['key_check']??''),hash_hmac('sha256','cra1-theme-key-check',$bytes))||(int)$db->query("SELECT COUNT(*) FROM accounts WHERE role='super_admin'")->fetchColumn()<1)throw new \RuntimeException('incomplete identity');
            }catch(\Throwable $error){throw new \RuntimeException('主题初始化资料不完整或损坏，原资料已保留，请联系网站管理员检查，勿重复安装',0,$error);}
        }
        if(is_file($dir.'/install.json'))return ['mode'=>'maintenance','installation'=>Files::json($dir.'/install.json')];
        if($database&&$key)return ['mode'=>'maintenance','legacy'=>true,'message'=>'检测到已有主题账号，保留配置；请从现有主题后台进入主题管理'];
        return ['mode'=>'install'];
    }
    public function preflight(array $options=[]): array
    {
        // After installation the administrator may have renamed the public entry.
        // Resolve it from the protected installation record, never from form input.
        $path=$this->root.'/runtime/cra1_theme/entry.json';
        $record=Files::json($path,true);
        $entry=is_file($path)?($record['entry']??null):'cra1admin';
        if(!is_string($entry)||!preg_match('/^[a-z][a-z0-9]{5,31}$/D',$entry))throw new \RuntimeException('主题后台地址记录无效，请从现有主题后台维护');
        $options['entry']=$entry;
        return InstallationEnvironment::inspect($this->root,$options)+$this->state();
    }

    /** Initialize the independent administrator and theme data without changing V10 theme selection. */
    public function install(array $input,array $preflight,?string $origin=null): array
    {
        $ready=$preflight['installation_ready']??(($preflight['counts']['blocked']??1)===0&&($preflight['counts']['unverified']??1)===0);
        if($ready!==true)throw new \RuntimeException('安装检查尚未通过，请按向导提示处理后重试');
        return Files::locked($this->root.'/runtime/cra1_theme/install.lock',function()use($input,$origin){
            if($this->state()['mode']!=='install')throw new \RuntimeException('已经安装，禁止重新初始化账号或配置');
            foreach(['entry','username','password','canonical']as$field)if(!is_string($input[$field]??null))throw new \InvalidArgumentException('请完整填写后台地址、账号、密码和本站 HTTPS 地址');
            $entry=(string)($input['entry']??'');
            if(!preg_match('/^[a-z][a-z0-9]{5,31}$/D',$entry)||in_array($entry,['console','public','config','upload','plugins','clientarea','cra1-shared','cra1-install'],true))throw new \InvalidArgumentException('后台地址需为 6–32 位小写字母和数字');
            $from=$this->root.'/public/cra1admin';$to=$this->root.'/public/'.$entry;
            Files::noLinks($from);Files::noLinks($to);
            if(!is_dir($from)||($to!==$from&&file_exists($to)))throw new \RuntimeException('后台目录缺失或目标地址已存在');
            if($to!==$from&&(!is_writable(dirname($from))||!is_executable(dirname($from))))throw new \RuntimeException('自定义后台地址需要 PHP 运行用户能在 public/ 中重命名主题后台目录，请在网站面板检查 public/ 的属主及写入权限，或使用默认地址 cra1admin');
            $entryFile=$this->root.'/runtime/cra1_theme/entry.json';$previousEntry=null;
            foreach(['entry','config','member_center','cart_theme']as$name){$path=$this->root.'/runtime/cra1_theme/'.$name.'.json';Files::json($path,true);}
            if(is_file($entryFile))$previousEntry=(string)file_get_contents($entryFile);
            $pointer=$this->root.'/runtime/cra1_theme/distribution/current.json';Files::noLinks($pointer);
            if(file_exists($pointer))throw new \RuntimeException('检测到已有发行指针，禁止覆盖安装记录');
            $release=Files::json($this->root.'/cra1-theme/release.json');
            References::inspect($this->root,$release['references']??[]);
            require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php';
            \CRA1ThemeSecurity::username((string)($input['username']??''));$hash=\CRA1ThemeSecurity::password((string)($input['password']??''));
            $canonical=rtrim((string)($input['canonical']??''),'/');$url=parse_url($canonical);
            if(!filter_var($canonical,FILTER_VALIDATE_URL)||($url['scheme']??'')!=='https'||!empty($url['path'])||isset($url['user'])||isset($url['pass'])||isset($url['query'])||isset($url['fragment']))throw new \InvalidArgumentException('请输入本站有效 HTTPS 源地址');
            if($origin!==null){
                $expected=parse_url($origin);
                if(!$expected||strtolower((string)($url['host']??''))!==strtolower((string)($expected['host']??''))||($url['port']??443)!==($expected['port']??443))throw new \InvalidArgumentException('本站 HTTPS 地址须与当前安装页面一致，请使用浏览器地址栏中的域名和端口');
                $canonical=rtrim($origin,'/');
            }
            $created=[$this->root.'/runtime/cra1_theme/security.sqlite',$this->root.'/config/cra1_theme_security.key'];$renamed=false;
            try{
                \CRA1ThemeSecurity::install($this->root,(string)$input['username'],$hash,['canonical_url'=>$canonical,'force_https'=>true,'http_test'=>false]);
                $created=[$this->root.'/runtime/cra1_theme/security.sqlite',$this->root.'/config/cra1_theme_security.key'];
                if($to!==$from){if(!rename($from,$to))throw new \RuntimeException('无法设置后台地址，请检查 public/ 的属主及重命名权限，处理后重新检查');$renamed=true;}
                Files::putJson($entryFile,['entry'=>$entry],0600);if($previousEntry===null)$created[]=$entryFile;
                foreach(References::apply($this->root,$release['references']??[])as$createdLink)$created[]=$createdLink;
                $security=new \CRA1ThemeSecurity($this->root);
                if($security->scalar('PRAGMA quick_check')!=='ok'||$security->scalar('SELECT COUNT(*) FROM accounts WHERE enabled=1 AND role=\'super_admin\'')!=1)throw new \RuntimeException('主题后台安装后自检失败');
                require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_media.php';
                $mediaFile=$this->root.'/runtime/cra1_theme/attachments.sqlite';$newMedia=!is_file($mediaFile);
                if($newMedia)foreach(['attachments.sqlite','attachments.sqlite-wal','attachments.sqlite-shm']as$file)$created[]=$this->root.'/runtime/cra1_theme/'.$file;
                $media=new \CRA1ThemeMediaStore($this->root,$newMedia);
                if($media->db->query('PRAGMA quick_check')->fetchColumn()!=='ok')throw new \RuntimeException('主题媒体库自检失败');
                foreach(['attachments','member_avatars','media_rates','member_events']as$table)$media->db->query('SELECT * FROM '.$table.' LIMIT 0');
                unset($media);
                foreach(['member_store.php','cart_store.php']as$file)require_once CRA1_THEME_BACKEND.'/Storage/'.$file;
                $defaults=['config'=>[],'member_center'=>\CRA1\Theme\Storage\MemberCenterStore::defaults(),'cart_theme'=>\CRA1\Theme\Storage\CartThemeStore::defaults()];
                foreach($defaults as$name=>$value){$path=$this->root.'/runtime/cra1_theme/'.$name.'.json';if(!is_file($path)){Files::putJson($path,$value);$created[]=$path;}else Files::json($path);}
                $announcementFile=$this->root.'/runtime/cra1_theme/announcements.json';
                if (!is_file($announcementFile)) $created[]=$announcementFile;
                Updater::migrateAnnouncements($this->root,$release);
                $created[]=$pointer;
                $current=['release'=>$release['release']??'legacy-install','manifest'=>$release,'security_epoch'=>$release['security_epoch']??1,'installed_at'=>time()];
                if(isset($release['backend_root']))$current['backend_root']=$release['backend_root'];
                Files::putJson($pointer,$current,0600);
                $record=['entry'=>$entry,'username'=>(string)$input['username'],'installed_at'=>time(),'initialized'=>true,'installer_locked'=>true];
                Files::putJson($this->root.'/runtime/cra1_theme/install.json',$record,0600);
                $security->event('distribution.install','ok',['category'=>'security','actor_id'=>1,'actor_name'=>(string)$input['username'],'role'=>'super_admin','target'=>'theme','reason'=>'通过原生超级管理员身份安装','risk'=>'high']);
                // Plaintext exists only in this response; never write it to session, logs or files.
                return ['admin_url'=>'/'.$entry.'/index.php','username'=>$input['username'],'password'=>$input['password'],'installed'=>true];
            }catch(\Throwable $e){
                unset($security,$media);
                if($renamed&&!rename($to,$from))throw new \RuntimeException('安装失败，后台目录需通过文件管理器恢复',0,$e);
                if($previousEntry!==null)Files::atomic($entryFile,$previousEntry,0600);
                foreach(array_reverse($created)as$file)if(is_file($file)||is_link($file))unlink($file);
                foreach(['security.sqlite-wal','security.sqlite-shm','install.json']as$file){$path=$this->root.'/runtime/cra1_theme/'.$file;if(is_file($path))unlink($path);}
                throw $e;
            }
        });
    }
}
