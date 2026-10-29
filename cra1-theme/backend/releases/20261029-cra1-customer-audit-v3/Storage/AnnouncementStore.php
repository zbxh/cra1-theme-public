<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;

use CRA1\Theme\Files;
use CRA1\Theme\Announcements\PageCatalog;
use CRA1\Theme\Announcements\LegacyMigration;

/** One private document; public results are computed at read time, never snapshotted. */
final class AnnouncementStore
{
    public const MAX_ITEMS=100;
    private string $root;
    private string $file;
    private PageCatalog $catalog;
    public function __construct(string $root, ?PageCatalog $catalog=null) { $this->root=rtrim($root,'/'); $this->file=$this->root.'/runtime/cra1_theme/announcements.json'; $this->catalog=$catalog??new PageCatalog($this->root); }
    public static function defaults(): array { return ['enabled'=>false,'interval'=>6,'hide_single_arrows'=>false,'items'=>[]]; }
    public function catalog(): PageCatalog { return $this->catalog; }
    public function exists(): bool { return is_file($this->file); }
    public function read(): array
    {
        if ($this->exists()) {
            $doc=Files::json($this->file);
            if (($doc['schema']??null)!==1 || !is_int($doc['version']??null) || $doc['version']<1 || !is_array($doc['values']??null)) throw new \RuntimeException('通知数据损坏，原文件已保留');
            // Validate even syntactically valid JSON before projecting or accepting edits.
            $doc['values']=$this->normalize($doc['values'],$doc['values'],false);
            return $doc;
        }
        $legacy=(new LegacyMigration($this->root))->values();
        return ['schema'=>1,'version'=>0,'updated_at'=>0,'values'=>$this->normalize($legacy,$legacy,false)];
    }
    public static function revision(array $values): string { return substr(hash('sha256',json_encode($values,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)),0,24); }
    public function payload(?array $doc=null): array
    {
        $doc=$doc??$this->read(); $values=$doc['values'];
        return ['scopeId'=>'announcements:all','scope'=>['id'=>'announcements:all','label'=>'通知管理','domain'=>'announcements','fields'=>[]],'values'=>$values,'revision'=>self::revision($values),'version'=>$doc['version'],'pages'=>$this->catalog->publicList(),'timezone'=>date_default_timezone_get(),'site_time'=>date('Y-m-d\TH:i:s'),'server_time'=>time(),'max_items'=>self::MAX_ITEMS];
    }
    private static function keys(array $value,array $allowed): void { if (array_diff(array_keys($value),$allowed)) throw new \InvalidArgumentException('通知中包含未知字段'); }
    private static function text($value,int $limit,string $label): string
    {
        if (!is_string($value)||mb_strlen($value)>$limit) throw new \InvalidArgumentException($label.'格式不正确或内容过长');
        return trim($value);
    }
    private static function flag($value): bool { if (!in_array($value,[true,false,0,1],true)) throw new \InvalidArgumentException('通知开关格式不正确'); return (bool)$value; }
    private static function date($value): string
    {
        $text=self::text($value,32,'生效时间');
        if ($text==='') return '';
        $format=strlen($text)===16?'Y-m-d\TH:i':'Y-m-d\TH:i:s';
        $date=\DateTimeImmutable::createFromFormat('!'.$format,$text);
        if (!$date||$date->format($format)!==$text) throw new \InvalidArgumentException('请选择有效的开始或到期时间');
        return $date->format('Y-m-d\TH:i:s');
    }
    public static function safeUrl(string $url): string
    {
        $url=trim($url);
        if ($url==='' ) return '';
        if (preg_match('/^mailto:([^?]+)$/i',$url,$email) && filter_var($email[1],FILTER_VALIDATE_EMAIL)) return $url;
        if (preg_match('/^tel:\+?[0-9][0-9()-]{2,30}$/i',$url)) return $url;
        if (strlen($url)>2048||preg_match('/[\x00-\x20<>"\'\\\\]/',$url)||strpos($url,'//')===0||!preg_match('~^(?:https?://|/(?!/)|#|[A-Za-z0-9_-]+(?:/|\.htm(?:l)?(?:[?#]|$)))~i',$url)) throw new \InvalidArgumentException('请选择有效的站内页面或 HTTP/HTTPS 链接');
        return $url;
    }
    public function normalize(array $values,array $previous=[],bool $validatePages=true): array
    {
        self::keys($values,['enabled','interval','hide_single_arrows','items']);
        $values+=self::defaults();
        if (!is_int($values['interval'])||$values['interval']<3||$values['interval']>300) throw new \InvalidArgumentException('轮播间隔需要在 3 至 300 秒之间');
        if (!is_array($values['items'])||count($values['items'])>self::MAX_ITEMS||($values['items']&&array_keys($values['items'])!==range(0,count($values['items'])-1))) throw new \InvalidArgumentException('通知条目必须为列表，最多 '.self::MAX_ITEMS.' 条');
        $old=array_column($previous['items']??[],null,'id'); $seen=[]; $items=[];
        if (!class_exists(MemberCenterStore::class,false)) require_once __DIR__.'/member_store.php';
        $icons=$this->root.'/public/cra1-shared/icons.php';
        if (is_file($icons)) require_once $icons;
        $sanitizer=new MemberCenterStore($this->root.'/runtime');
        foreach ($values['items'] as $index=>$row) {
            if (!is_array($row)) throw new \InvalidArgumentException('通知条目格式不正确');
            self::keys($row,['id','title','label','icon','summary','detail','action','action_label','url','new_tab','targets','starts_at','ends_at','priority','dismissible','dismiss_for','enabled','extra_actions','revision','published_at']);
            $id=(string)($row['id']??'');
            if (!preg_match('/^[A-Za-z0-9_-]{6,64}$/D',$id)||isset($seen[$id])) throw new \InvalidArgumentException('通知标识缺失或重复');
            $seen[$id]=true;
            $item=['id'=>$id,'title'=>self::text($row['title']??'',160,'标题'),'label'=>self::text($row['label']??'',24,'分类文字'),'icon'=>self::text($row['icon']??'megaphone',300,'图标'),'summary'=>self::text($row['summary']??'',400,'简介')];
            if ($item['title']===''||$item['title']!==strip_tags($item['title'])||$item['label']!==strip_tags($item['label'])) throw new \InvalidArgumentException('请填写纯文字通知标题和分类');
            if ($validatePages && function_exists('cra1_icon_validate_change')) \cra1_icon_validate_change($item['icon'],$old[$id]['icon']??'');
            $item['detail']=$sanitizer->sanitizeContentHtml(self::text($row['detail']??'',65536,'详情'),true);
            $item['action']=(string)($row['action']??'detail');
            if (!in_array($item['action'],['detail','link','none'],true)) throw new \InvalidArgumentException('通知操作方式不存在');
            $item['action_label']=self::text($row['action_label']??'查看详情',20,'操作文字');
            $item['url']=self::safeUrl(self::text($row['url']??'',2048,'跳转链接'));
            if ($item['action']==='link'&&$item['url']==='') throw new \InvalidArgumentException('请选择通知的跳转链接');
            if ($item['action']!=='none'&&$item['action_label']==='') throw new \InvalidArgumentException('请填写操作文字');
            $item['new_tab']=self::flag($row['new_tab']??false);
            $targets=$row['targets']??[];
            if (!is_array($targets)) throw new \InvalidArgumentException('请选择显示页面');
            self::keys($targets,['website','member','cart']); $item['targets']=[]; $chosen=0;
            foreach (['website','member','cart'] as $theme) {
                $target=$targets[$theme]??['all'=>false,'pages'=>[]];
                if (!is_array($target)) throw new \InvalidArgumentException('显示范围格式不正确');
                self::keys($target,['all','pages']);
                $all=self::flag($target['all']??false); $pages=$target['pages']??[];
                if (!is_array($pages)||count($pages)>500) throw new \InvalidArgumentException('显示页面过多或格式不正确');
                $clean=[];
                foreach ($pages as $page) {
                    if (!is_string($page)||strlen($page)>160||!preg_match('~^[A-Za-z0-9_:/-]+$~D',$page)) throw new \InvalidArgumentException('显示页面标识无效');
                    if ($validatePages&&!$this->catalog->page($theme,$page)&&!in_array($page,$old[$id]['targets'][$theme]['pages']??[],true)) throw new \InvalidArgumentException('显示范围包含未知或当前不可用的页面');
                    $clean[]=$page;
                }
                $clean=array_values(array_unique($clean)); sort($clean);
                $item['targets'][$theme]=['all'=>$all,'pages'=>$all?[]:$clean]; $chosen+=$all?1:count($clean);
            }
            if (!$chosen) throw new \InvalidArgumentException('请至少选择一个显示页面');
            $item['starts_at']=self::date($row['starts_at']??''); $item['ends_at']=self::date($row['ends_at']??'');
            if ($item['starts_at']!==''&&$item['ends_at']!==''&&$item['ends_at']<=$item['starts_at']) throw new \InvalidArgumentException('到期时间必须晚于开始时间');
            $priority=$row['priority']??0;
            if (!is_int($priority)||$priority<0||$priority>99) throw new \InvalidArgumentException('优先级需要在 0 至 99 之间');
            $item['priority']=$priority; $item['dismissible']=self::flag($row['dismissible']??true);
            $item['dismiss_for']=$row['dismiss_for']??'day';
            if (!in_array($item['dismiss_for'],['visit','day','revision'],true)) throw new \InvalidArgumentException('关闭记忆方式不存在');
            $item['enabled']=self::flag($row['enabled']??true);
            $extras=$row['extra_actions']??[];
            if (!is_array($extras)||count($extras)>50) throw new \InvalidArgumentException('附加操作最多 50 项');
            $item['extra_actions']=[];
            foreach ($extras as $extra) {
                if (!is_array($extra)) throw new \InvalidArgumentException('附加操作格式错误');
                self::keys($extra,['label','url','new_tab']);
                $label=self::text($extra['label']??'',24,'附加操作文字');$url=self::safeUrl(self::text($extra['url']??'',2048,'附加操作链接'));
                if ($label===''||$url==='') throw new \InvalidArgumentException('请填写附加操作文字和链接');
                $item['extra_actions'][]=['label'=>$label,'url'=>$url,'new_tab'=>self::flag($extra['new_tab']??false)];
            }
            $fingerprint=$item; unset($fingerprint['priority'],$fingerprint['targets']);
            $item['revision']=self::revision($fingerprint);
            $item['published_at']=(int)($old[$id]['published_at']??time());
            $items[]=$item;
        }
        return ['enabled'=>self::flag($values['enabled']),'interval'=>$values['interval'],'hide_single_arrows'=>self::flag($values['hide_single_arrows']),'items'=>$items];
    }

    public function save(string $expected,array $patch,string $operator): array
    {
        return Files::locked($this->file.'.lock',function()use($expected,$patch,$operator){
            $doc=$this->read();
            if ($expected===''||!hash_equals(self::revision($doc['values']),$expected)) return ['status'=>409,'msg'=>'通知已被其他管理员更新，当前草稿已保留','data'=>$this->payload($doc)];
            self::keys($patch,array_keys(self::defaults()));
            $values=$this->normalize(array_replace($doc['values'],$patch),$doc['values']);
            $next=['schema'=>1,'version'=>(int)$doc['version']+1,'updated_at'=>time(),'updated_by'=>$operator,'values'=>$values];
            if (!$this->exists()) (new LegacyMigration($this->root))->backup();
            Files::putJson($this->file,$next);
            (new LegacyMigration($this->root))->cleanupPublic();
            return ['status'=>200,'msg'=>'通知已保存','data'=>$this->payload($next)];
        });
    }

    public function migrate(): void
    {
        Files::locked($this->file.'.lock',function(){
            if (!$this->exists()) {
                $legacy=new LegacyMigration($this->root); $values=$legacy->values(); $values=$this->normalize($values,$values,false); $legacy->backup();
                Files::putJson($this->file,['schema'=>1,'version'=>1,'updated_at'=>time(),'updated_by'=>'migration','values'=>$values]);
            }
            (new LegacyMigration($this->root))->cleanupPublic();
        });
    }

    public function publicPayload(string $theme,string $path,?int $now=null,?array $draft=null,bool $member=false): array
    {
        $page=$this->catalog->resolve($theme,$path);
        if (!$page) return self::emptyPublicPayload($now??time());
        return $this->project($page,$theme,$now??time(),$draft,$member);
    }

    /** Viewer identity is supplied only by the server, never by request parameters. */
    public function allPublicPayload(?int $now=null,bool $member=false): array
    {
        $out=$this->project(null,'',$now??time(),null,$member);
        $fields=array_flip(['id','revision','title','label','summary','detail','action_label','url','new_tab','extra_actions','expires_in']);
        $out['items']=array_map(static function(array $item)use($fields):array{return array_intersect_key($item,$fields);},$out['items']);
        return $out;
    }

    private static function emptyPublicPayload(int $now): array
    {
        return ['items'=>[],'interval'=>6,'hide_single_arrows'=>false,'server_time'=>$now,'day'=>date('Y-m-d',$now),'refresh_after'=>30];
    }

    private function hasDestination(array $item,array $themes): bool
    {
        foreach ($themes as $theme) {
            $target=$item['targets'][$theme]??[];
            if (!empty($target['all'])) return true;
            foreach ($target['pages']??[] as $id) if ($this->catalog->page($theme,$id)) return true;
        }
        return false;
    }

    private function project(?array $page,string $theme,int $now,?array $draft,bool $member): array
    {
        // Retain the old storage key without letting it hide navigation in older clients.
        $out=self::emptyPublicPayload($now);
        $values=$draft===null?$this->read()['values']:$this->normalize($draft,$this->read()['values']);
        if (empty($values['enabled'])) return $out;
        $out['interval']=(int)$values['interval'];
        $list=[];
        foreach ($values['items'] as $i=>$item) {
            if (empty($item['enabled'])) continue;
            // Website and cart placements are public. Only-member entries require
            // native member authentication, even when callers forge a page path.
            if (!$this->hasDestination($item,$member?['website','cart','member']:['website','cart'])) continue;
            if ($page!==null) {
                $target=$item['targets'][$theme]??[];
                if (empty($target['all'])&&!in_array($page['id'],$target['pages']??[],true)) continue;
            }
            $start=$item['starts_at']===''?0:(int)strtotime($item['starts_at']);$end=$item['ends_at']===''?0:(int)strtotime($item['ends_at']);
            if ($start>$now) { $out['refresh_after']=min($out['refresh_after'],max(1,$start-$now));continue; }
            if ($end>0&&$end<=$now) continue;
            if ($end>$now) $out['refresh_after']=min($out['refresh_after'],max(1,$end-$now));
            $public=array_intersect_key($item,array_flip(['id','revision','title','label','icon','summary','detail','action','action_label','url','new_tab','dismissible','dismiss_for','extra_actions']));
            if ($public['label']==='公告') $public['label']='通知';
            if (trim($public['summary'])==='') {
                // Derive display text from sanitized content without changing the merchant's draft.
                $text=preg_replace('~<(?:br\b[^>]*|/(?:p|div|li|h[1-6]|tr|blockquote)\s*)>~i',' ',$public['detail']);
                $text=html_entity_decode(strip_tags($text),ENT_QUOTES|ENT_HTML5,'UTF-8');
                $public['summary']=mb_substr(trim(preg_replace('/[\s\x{00a0}\x{200b}]+/u',' ',$text)),0,400,'UTF-8');
            }
            $public['revision']=$public['revision']??self::revision($item);
            $public['icon_html']=$page!==null&&function_exists('cra1_icon_art')?\cra1_icon_art($item['icon'],'website'):'';
            $public['expires_in']=$end?max(0,$end-$now):null;
            $list[]=['value'=>$public,'priority'=>(int)$item['priority'],'order'=>$i,'start'=>$start?:($item['published_at']??0)];
        }
        usort($list,static function($a,$b){return $b['priority']<=>$a['priority']?:$a['order']<=>$b['order']?:$b['start']<=>$a['start']?:strcmp($a['value']['id'],$b['value']['id']);});
        $out['items']=array_column($list,'value');
        return $out;
    }
}
