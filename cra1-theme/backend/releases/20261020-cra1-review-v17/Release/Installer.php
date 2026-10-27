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
        if(is_file($dir.'/install.json'))return ['mode'=>'maintenance','installation'=>Files::json($dir.'/install.json')];
        if(is_file($dir.'/security.sqlite')||is_file($this->root.'/config/cra1_theme_security.key'))return ['mode'=>'maintenance','legacy'=>true,'message'=>'检测到已有主题账号，保留配置；请从现有主题后台进入主题管理'];
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
        return Inspector::inspect($this->root,$options)+$this->state();
    }

    /** Both callbacks are native API contracts; tests provide fully isolated implementations. */
    public function install(array $input,callable $readThemes,callable $saveThemes,array $preflight): array
    {
        $ready=$preflight['installation_ready']??(($preflight['counts']['blocked']??1)===0&&($preflight['counts']['unverified']??1)===0);
        if($ready!==true)throw new \RuntimeException('安装技术预检仍有阻断或未验证项，请先完成兼容与私有路径自检');
        return Files::locked($this->root.'/runtime/cra1_theme/install.lock',function()use($input,$readThemes,$saveThemes){
            if($this->state()['mode']!=='install')throw new \RuntimeException('已经安装，禁止重新初始化账号或配置');
            $entry=(string)($input['entry']??'');
            if(!preg_match('/^[a-z][a-z0-9]{5,31}$/D',$entry)||in_array($entry,['console','public','config','upload','plugins','clientarea','cra1-shared','cra1-install'],true))throw new \InvalidArgumentException('后台地址需为 6–32 位小写字母和数字');
            $from=$this->root.'/public/cra1admin';$to=$this->root.'/public/'.$entry;
            if(!is_dir($from)||is_link($from)||($to!==$from&&file_exists($to)))throw new \RuntimeException('后台目录缺失或目标地址已存在');
            require_once $this->root.'/lib/cra1_theme_security.php';
            \CRA1ThemeSecurity::username((string)($input['username']??''));$hash=\CRA1ThemeSecurity::password((string)($input['password']??''));
            $canonical=rtrim((string)($input['canonical']??''),'/');$url=parse_url($canonical);
            if(!filter_var($canonical,FILTER_VALIDATE_URL)||($url['scheme']??'')!=='https'||!empty($url['path'])||isset($url['user'])||isset($url['query'])||isset($url['fragment']))throw new \InvalidArgumentException('请输入本站有效 HTTPS 源地址');
            $previous=$readThemes();if(!is_array($previous)||empty($previous['admin_theme']))throw new \RuntimeException('无法读取原生主题设置，未执行安装');
            $next=$previous;
            foreach(['web_theme','clientarea_theme','clientarea_theme_mobile','cart_theme','cart_theme_mobile','home_theme','home_theme_mobile']as$key)$next[$key]='cra1';
            $next['web_switch']=1;$next['clientarea_theme_mobile_switch']=1;
            // Preserve all native module detail-theme maps and unrelated settings.
            Files::putJson($this->root.'/runtime/cra1_theme/install-previous-themes.json',$previous,0600);
            $created=[$this->root.'/runtime/cra1_theme/security.sqlite',$this->root.'/config/cra1_theme_security.key'];$renamed=false;$activationAttempted=false;
            try{
                \CRA1ThemeSecurity::install($this->root,(string)$input['username'],$hash,['canonical_url'=>$canonical,'force_https'=>true,'http_test'=>false]);
                $created=[$this->root.'/runtime/cra1_theme/security.sqlite',$this->root.'/config/cra1_theme_security.key'];
                if($to!==$from){if(!rename($from,$to))throw new \RuntimeException('无法设置后台地址');$renamed=true;}
                Files::putJson($this->root.'/runtime/cra1_theme/entry.json',['entry'=>$entry],0600);$created[]=$this->root.'/runtime/cra1_theme/entry.json';
                $release=Files::json($this->root.'/cra1-theme/release.json');
                foreach(References::apply($this->root,$release['references']??[])as$createdLink)$created[]=$createdLink;
                $security=new \CRA1ThemeSecurity($this->root);
                if($security->scalar('PRAGMA quick_check')!=='ok'||$security->scalar('SELECT COUNT(*) FROM accounts WHERE enabled=1 AND role=\'super_admin\'')!=1)throw new \RuntimeException('主题后台安装后自检失败');
                require_once $this->root.'/lib/cra1_theme_media.php';
                $mediaFile=$this->root.'/runtime/cra1_theme/attachments.sqlite';$newMedia=!is_file($mediaFile);
                if($newMedia)foreach(['attachments.sqlite','attachments.sqlite-wal','attachments.sqlite-shm']as$file)$created[]=$this->root.'/runtime/cra1_theme/'.$file;
                $media=new \CRA1ThemeMediaStore($this->root,$newMedia);
                if($media->db->query('PRAGMA quick_check')->fetchColumn()!=='ok')throw new \RuntimeException('主题媒体库自检失败');
                foreach(['attachments','member_avatars','media_rates','member_events']as$table)$media->db->query('SELECT * FROM '.$table.' LIMIT 0');
                unset($media);
                foreach(['member_store.php','cart_store.php']as$file)require_once CRA1_THEME_BACKEND.'/Storage/'.$file;
                $defaults=['config'=>[],'member_center'=>\CRA1\Theme\Storage\MemberCenterStore::defaults(),'cart_theme'=>\CRA1\Theme\Storage\CartThemeStore::defaults()];
                foreach($defaults as$name=>$value){$path=$this->root.'/runtime/cra1_theme/'.$name.'.json';if(!is_file($path)){Files::putJson($path,$value);$created[]=$path;}else Files::json($path);}
                $activationAttempted=true;$result=$saveThemes($next);
                if((int)($result['status']??0)!==200)throw new \RuntimeException('原生主题设置未通过，安装中止');
                $pointer=$this->root.'/runtime/cra1_theme/distribution/current.json';
                if(is_file($pointer))throw new \RuntimeException('检测到已有发行指针，禁止覆盖安装记录');
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
                if($activationAttempted){$restore=$saveThemes($previous);if((int)($restore['status']??0)!==200)throw new \RuntimeException('安装未完成且原主题选择恢复失败，请用系统后台恢复；主题身份数据已保留以便维护',0,$e);}
                unset($security,$media);
                if($renamed&&!rename($to,$from))throw new \RuntimeException('安装失败，后台目录需通过文件管理器恢复',0,$e);
                foreach(array_reverse($created)as$file)if(is_file($file)||is_link($file))unlink($file);
                foreach(['security.sqlite-wal','security.sqlite-shm','install.json']as$file){$path=$this->root.'/runtime/cra1_theme/'.$file;if(is_file($path))unlink($path);}
                throw $e;
            }
        });
    }
}
