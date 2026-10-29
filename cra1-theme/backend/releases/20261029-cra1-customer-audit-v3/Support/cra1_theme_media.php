<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

/** Theme-owned attachments and member avatars. Never changes the core client table. */
final class CRA1ThemeMediaStore
{
    public $db;
    private $root;
    private $referenceTexts = null;
    public const PRESETS = ['titanium', 'graphite', 'champagne', 'sage', 'ocean', 'lavender'];

    public function __construct(string $root, bool $create = false)
    {
        $this->root = rtrim($root, '/');
        $file = $this->root . '/runtime/cra1_theme/attachments.sqlite';
        if (!$create && !is_file($file)) throw new RuntimeException('附件服务尚未准备好，请联系管理员。');
        $this->db = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        $this->db->exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
        if ($create) {
            $this->db->exec("CREATE TABLE IF NOT EXISTS attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
                kind TEXT NOT NULL, owner_id INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL,
                mime TEXT NOT NULL, bytes INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
                created_at INTEGER NOT NULL, deleted_at INTEGER NOT NULL DEFAULT 0);
                CREATE INDEX IF NOT EXISTS attachments_page ON attachments(deleted_at,kind,id);
                CREATE INDEX IF NOT EXISTS attachments_owner ON attachments(owner_id,kind);
                CREATE TABLE IF NOT EXISTS member_avatars (member_id INTEGER PRIMARY KEY, mode TEXT NOT NULL,
                preset TEXT NOT NULL DEFAULT '', attachment_id INTEGER REFERENCES attachments(id), revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
                CREATE INDEX IF NOT EXISTS avatar_attachment ON member_avatars(attachment_id);
                CREATE TABLE IF NOT EXISTS media_rates (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS member_events (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL, action TEXT NOT NULL, target INTEGER, time INTEGER NOT NULL);");
            @chmod($file, 0600);
        }
    }

    private function rows(string $sql, array $params = []): array
    {
        $s = $this->db->prepare($sql); $s->execute($params); $rows=$s->fetchAll();
        // PHP 7.4 PDO may stringify SQLite numbers. Keep the public JSON types stable.
        foreach ($rows as &$row) foreach (['id','owner_id','bytes','width','height','created_at','deleted_at','attachment_id','member_id','revision','count','window','n'] as $key) {
            if (isset($row[$key])) $row[$key]=(int)$row[$key];
        }
        return $rows;
    }
    private function transaction(callable $work)
    {
        $this->db->exec('BEGIN IMMEDIATE');
        try { $out = $work(); $this->db->exec('COMMIT'); return $out; }
        catch (Throwable $e) { $this->db->exec('ROLLBACK'); throw $e; }
    }
    public function lock(bool $exclusive = false)
    {
        $h = fopen($this->root.'/runtime/cra1_theme/attachments.lock', 'c');
        if (!$h || !flock($h, $exclusive ? LOCK_EX : LOCK_SH)) throw new RuntimeException('附件暂时忙，请稍后重试。');
        @chmod($this->root.'/runtime/cra1_theme/attachments.lock', 0600); return $h;
    }
    private function rate(int $member, string $action, int $limit, int $duration): void
    {
        $this->transaction(function () use ($member, $action, $limit, $duration) {
            $key=$action.':'.$member; $window=(int)(floor(time()/$duration)*$duration);
            $row=$this->rows('SELECT * FROM media_rates WHERE key=?',[$key])[0]??null;
            $count=$row && (int)$row['window']===$window ? (int)$row['count'] : 0;
            if ($count >= $limit) throw new InvalidArgumentException('操作太频繁，请稍后再试。',429);
            $this->db->prepare('INSERT OR REPLACE INTO media_rates VALUES(?,?,?)')->execute([$key,$window,$count+1]);
        });
    }
    private static function name(string $value): string
    {
        $value=trim(preg_replace('/[\x00-\x1f\x7f]/u','',strip_tags(basename(str_replace('\\','/',$value)))));
        if ($value==='') throw new InvalidArgumentException('请填写附件名称。');
        return mb_substr($value,0,120);
    }
    public function attachment(int $id): array
    {
        $r=$this->rows('SELECT * FROM attachments WHERE id=?',[$id]);
        if (!$r) throw new InvalidArgumentException('附件不存在或已移除。',404); return $r[0];
    }
    public function avatar(int $member): array
    {
        $r=$this->rows('SELECT a.mode,a.preset,a.attachment_id,a.revision,f.url,f.deleted_at FROM member_avatars a LEFT JOIN attachments f ON f.id=a.attachment_id WHERE a.member_id=?',[$member]);
        if (!$r) return ['mode'=>'default','revision'=>0];
        $a=$r[0]; $out=['mode'=>$a['mode'],'revision'=>(int)$a['revision']];
        if ($a['mode']==='preset' && in_array($a['preset'],self::PRESETS,true)) $out['preset']=$a['preset'];
        elseif ($a['mode']==='upload' && $a['url'] && (int)$a['deleted_at']===0 && is_file($this->root.'/public'.$a['url'])) $out+=['url'=>$a['url'],'attachment_id'=>(int)$a['attachment_id']];
        else $out['mode']='default';
        return $out;
    }
    public static function avatarFor(string $root, int $member): array
    {
        if ($member<=0 || !is_file($root.'/runtime/cra1_theme/attachments.sqlite')) return ['mode'=>'default','revision'=>0];
        try { return (new self($root))->avatar($member); }
        catch (Throwable $e) { error_log('Theme avatar read failed'); return ['mode'=>'default','revision'=>0,'unavailable'=>true]; }
    }
    public function saveAvatar(int $member, array $p): array
    {
        if ($member<=0) throw new InvalidArgumentException('请先登录。',401);
        $this->rate($member,'save',60,900); $lock=$this->lock();
        try {
            return $this->transaction(function () use ($member,$p) {
                $mode=(string)($p['mode']??''); $preset=''; $attachment=null;
                if (!in_array($mode,['default','preset','upload'],true)) throw new InvalidArgumentException('请选择预设头像或上传图片。');
                $current=$this->avatar($member);
                if (!isset($p['expected_revision']) || (int)$p['expected_revision']!==$current['revision']) throw new InvalidArgumentException('头像已在其他页面更新，请刷新后重新选择。',409);
                if ($mode==='preset') { $preset=(string)($p['preset']??''); if (!in_array($preset,self::PRESETS,true)) throw new InvalidArgumentException('这个预设头像不可用，请重新选择。'); }
                if ($mode==='upload') {
                    $f=$this->attachment((int)($p['attachment_id']??0));
                    if ($f['kind']!=='avatar' || (int)$f['owner_id']!==$member || $f['deleted_at'] || !is_file($this->root.'/public'.$f['url'])) throw new InvalidArgumentException('请选择自己上传的头像。',403);
                    $attachment=(int)$f['id'];
                }
                $this->db->prepare('INSERT OR REPLACE INTO member_avatars VALUES(?,?,?,?,?,?)')->execute([$member,$mode,$preset,$attachment,$current['revision']+1,time()]);
                $this->db->prepare('INSERT INTO member_events(member_id,action,target,time) VALUES(?,?,?,?)')->execute([$member,'avatar.save',$attachment,time()]);
                return $this->avatar($member);
            });
        } finally { flock($lock,LOCK_UN); fclose($lock); }
    }

    /** Decode/re-encode member images; never trusts filename, browser MIME or member ID. */
    public function upload(array $f, string $kind, int $owner): array
    {
        $avatar=$kind==='avatar'; $max=($avatar?3:5)*1024*1024;
        if (!in_array($kind,['theme','avatar'],true) || ($avatar && $owner<=0)) throw new InvalidArgumentException('上传身份无效。',403);
        if (!isset($f['tmp_name']) || ($f['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name']) || (int)($f['size']??0)>$max || filesize($f['tmp_name'])>$max) throw new InvalidArgumentException($avatar?'请选择不超过 3MB 的图片。':'请选择不超过 5MB 的图片。');
        if ($avatar) $this->rate($owner,'upload',30,86400);
        $mime=(new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        $extensions=['image/png'=>'png','image/jpeg'=>'jpg','image/webp'=>'webp'];
        if (!$avatar) $extensions+=['image/gif'=>'gif','image/x-icon'=>'ico','image/vnd.microsoft.icon'=>'ico'];
        if (!isset($extensions[$mime])) throw new InvalidArgumentException($avatar?'头像支持 JPG、PNG 和 WebP 图片。':'仅支持 PNG、JPEG、WebP、GIF、ICO 图片。');
        $size=@getimagesize($f['tmp_name']);
        if (!$size && $extensions[$mime]==='ico') {
            $head=file_get_contents($f['tmp_name'],false,null,0,22);
            if (strlen($head)>=22 && substr($head,0,4)==="\x00\x00\x01\x00") $size=[ord($head[6])?:256,ord($head[7])?:256];
        }
        if (!$size || $size[0]>4096 || $size[1]>4096 || $size[0]*$size[1]>($avatar?9000000:16000000) || min($size[0],$size[1])<($avatar?32:1)) throw new InvalidArgumentException($avatar?'图片尺寸需至少 32×32，最长边不超过 4096 像素，总像素不超过 900 万。':'图片尺寸过大或文件损坏，请换一张图片。');
        $dir=$this->root.'/public/upload/cra1-theme'.($avatar?'/avatars':'');
        if (!is_dir($dir) && !mkdir($dir,0755,true)) throw new RuntimeException('图片目录不可写，请联系管理员。');
        $extension=$avatar?'webp':$extensions[$mime]; $name=bin2hex(random_bytes(16)).'.'.$extension;
        $path=$dir.'/'.$name; $image=null; $output=null;
        try {
            if (in_array($extensions[$mime],['png','jpg','webp'],true)) {
                $image=@imagecreatefromstring((string)file_get_contents($f['tmp_name']));
                if (!$image) throw new InvalidArgumentException('图片文件损坏，请换一张图片。');
                if ($avatar) {
                    $edge=min($size[0],$size[1]); $output=imagecreatetruecolor(512,512); imagealphablending($output,false); imagesavealpha($output,true);
                    imagecopyresampled($output,$image,0,0,(int)(($size[0]-$edge)/2),(int)(($size[1]-$edge)/2),512,512,$edge,$edge);
                    $ok=imagewebp($output,$path,82); $size=[512,512]; $mime='image/webp';
                } elseif ($extension==='png') { imagesavealpha($image,true); $ok=imagepng($image,$path,6); }
                elseif ($extension==='jpg') $ok=imagejpeg($image,$path,90);
                else $ok=imagewebp($image,$path,88);
            } else $ok=move_uploaded_file($f['tmp_name'],$path);
            if (!$ok || !filesize($path)) throw new RuntimeException('图片上传失败，请重试。');
            chmod($path,0644); $url=substr($path,strlen($this->root.'/public'));
            return $this->transaction(function () use ($f,$kind,$owner,$mime,$size,$path,$url) {
                $this->db->prepare('INSERT INTO attachments(url,name,kind,owner_id,source,mime,bytes,width,height,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')->execute([$url,self::name($f['name']??'图片'),$kind,$owner,'managed',$mime,filesize($path),$size[0],$size[1],time()]);
                $id=(int)$this->db->lastInsertId();
                if ($kind==='avatar') $this->db->prepare('INSERT INTO member_events(member_id,action,target,time) VALUES(?,?,?,?)')->execute([$owner,'avatar.upload',$id,time()]);
                return $this->attachment($id);
            });
        } catch (Throwable $e) { if (is_file($path)) unlink($path); throw $e; }
        finally { if ($image) imagedestroy($image); if ($output) imagedestroy($output); }
    }

    /** One-time CLI index; runtime listing is a bounded SQLite query. */
    public function indexExisting(): int
    {
        $count=0;
        foreach (['/upload/cra1-theme'=>'theme','/web/cra1/assets/images'=>'builtin','/upload/common'=>'builtin'] as $rel=>$kind) {
            $base=$this->root.'/public'.$rel; if (!is_dir($base)) continue;
            foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base,FilesystemIterator::SKIP_DOTS)) as $file) {
                if (!$file->isFile() || $file->isLink() || !preg_match('/\.(png|jpe?g|webp|gif|ico)$/i',$file->getFilename()) || strpos($file->getPathname(),'/avatars/')!==false) continue;
                $url=substr($file->getPathname(),strlen($this->root.'/public')); $size=@getimagesize($file->getPathname())?:[0,0];
                $s=$this->db->prepare('INSERT OR IGNORE INTO attachments(url,name,kind,source,mime,bytes,width,height,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
                $s->execute([$url,self::name($file->getFilename()),$kind,$kind==='builtin'?'builtin':'managed',(new finfo(FILEINFO_MIME_TYPE))->file($file->getPathname()),$file->getSize(),$size[0],$size[1],$file->getMTime()]); $count+=$s->rowCount();
            }
        } return $count;
    }
    public function references(array $f): array
    {
        $refs=[];
        foreach ($this->rows("SELECT member_id FROM member_avatars WHERE mode='upload' AND attachment_id=? LIMIT 50",[$f['id']]) as $r) $refs[]='会员 #'.$r['member_id'].' 的头像';
        if ($this->referenceTexts === null) {
            $files=glob($this->root.'/runtime/cra1_theme/*.json')?:[];
            foreach (['previews','backups'] as $folder) $files=array_merge($files,glob($this->root.'/runtime/cra1_theme/'.$folder.'/*.json')?:[]);
            $files[]=$this->root.'/public/web/cra1/controller/storage.json';
            $this->referenceTexts=[];
            foreach ($files as $file) {
                if (!is_file($file)) continue;
                $text=str_replace('\\/','/',(string)file_get_contents($file));
                if (strpos($file,'/previews/')!==false) { $doc=json_decode($text,true); if (($doc['expires_at']??$doc['expires']??PHP_INT_MAX)<time()) continue; }
                $key=basename($file); $labels=['config.json'=>'官网主题','member_center.json'=>'会员中心主题','cart_theme.json'=>'购物车主题','member_center_public.json'=>'会员中心快照','cart_theme_public.json'=>'购物车快照','storage.json'=>'兼容主题配置'];
                $label=$labels[$key]??(strpos($file,'/previews/')!==false?'未过期的预览草稿':'主题备份或设置');
                $this->referenceTexts[]=[$label,$text,rawurldecode($text)];
            }
        }
        foreach ($this->referenceTexts as [$label,$text,$decoded]) if (strpos($text,$f['url'])!==false||strpos($decoded,$f['url'])!==false) $refs[]=$label;
        return array_values(array_unique($refs));
    }
    public function listing(array $p, bool $manager, bool $picker=false): array
    {
        $kind=(string)($p['kind']??'all'); $trash=!empty($p['trash']);
        if (($kind==='avatar'||$trash) && !$manager) throw new InvalidArgumentException('当前账号无权查看会员头像或回收站。',403);
        $where=[$trash?'deleted_at>0':'deleted_at=0']; $values=[];
        if ($picker || !$manager) $where[]="kind!='avatar'";
        if (in_array($kind,['theme','avatar','builtin'],true)) { $where[]='kind=?'; $values[]=$kind; }
        $search=mb_substr(trim((string)($p['search']??'')),0,120);
        if ($search!=='') { $where[]="(name LIKE ? ESCAPE '\\' OR CAST(owner_id AS TEXT)=?)"; $values[]='%'.strtr($search,['\\'=>'\\\\','%'=>'\\%','_'=>'\\_']).'%'; $values[]=$search; }
        $sql=implode(' AND ',$where); $offset=max(0,min(100000,(int)($p['offset']??0))); $limit=$picker?60:36;
        $count=$this->rows('SELECT COUNT(*) AS n FROM attachments WHERE '.$sql,$values)[0]['n'];
        $items=$this->rows('SELECT * FROM attachments WHERE '.$sql.' ORDER BY id DESC LIMIT '.$limit.' OFFSET '.$offset,$values);
        foreach ($items as &$f) { $f['updated']=$f['created_at']; if (!$picker) { $f['references']=$this->references($f); $f['in_use']=count($f['references'])>0; } }
        return ['items'=>$items,'total'=>(int)$count,'hasMore'=>$offset+count($items)<$count];
    }
    public function rename(int $id, string $name, bool $manager): array
    {
        $f=$this->attachment($id);
        if ($f['source']!=='managed' || $f['deleted_at'] || ($f['kind']==='avatar' && !$manager)) throw new InvalidArgumentException('这个附件不支持修改名称。',403);
        $this->db->prepare('UPDATE attachments SET name=? WHERE id=?')->execute([self::name($name),$id]); return $this->attachment($id);
    }
    public function remove(int $id, bool $restore=false): array
    {
        $lock=$this->lock(true); $from=''; $to=''; $moved=false;
        try {
            return $this->transaction(function () use ($id,$restore,&$from,&$to,&$moved) {
                $f=$this->attachment($id);
                if ($f['source']!=='managed' || !preg_match('~^/upload/cra1-theme/(?:avatars/)?[a-f0-9]{32}\.(?:png|jpg|webp|gif|ico)$~D',$f['url'])) throw new InvalidArgumentException('系统图片只可选择，不能删除。',403);
                if ((!$restore && $f['deleted_at']) || ($restore && !$f['deleted_at'])) throw new InvalidArgumentException('附件状态已变化，请刷新列表。',409);
                $refs=$this->references($f); if (!$restore && $refs) throw new InvalidArgumentException('附件正在使用，请先更换引用位置：'.implode('、',$refs),409);
                $trash=$this->root.'/runtime/cra1_theme/media-trash'; if (!is_dir($trash)) mkdir($trash,0700,true);
                $public=$this->root.'/public'.$f['url']; $private=$trash.'/'.$id.'-'.basename($f['url']);
                $from=$restore?$private:$public; $to=$restore?$public:$private;
                if (!is_file($from)||is_link($from)||is_file($to)||!rename($from,$to)) throw new RuntimeException('文件暂时无法移动，请联系管理员。');
                $moved=true; chmod($to,$restore?0644:0600);
                $this->db->prepare('UPDATE attachments SET deleted_at=? WHERE id=?')->execute([$restore?0:time(),$id]);
                return $this->attachment($id);
            });
        } catch (Throwable $e) { if ($moved && is_file($to)) { rename($to,$from); chmod($from,$restore?0600:0644); } throw $e; }
        finally { flock($lock,LOCK_UN); fclose($lock); }
    }
}
