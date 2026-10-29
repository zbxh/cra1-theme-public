<?php
declare(strict_types=1);
namespace CRA1\Theme\Announcements;

use CRA1\Theme\Files;
use CRA1\Theme\Storage\AnnouncementStore;

/** The sole reader of obsolete announcement shapes. Reads and previews never migrate. */
final class LegacyMigration
{
    private string $root;
    public function __construct(string $root) { $this->root=rtrim($root,'/'); }
    private function read(string $name): array { return Files::json($this->root.'/'.$name,true); }
    private function websiteDefaults(): array
    {
        // This reviewed legacy controller displayed defaults even when no values
        // had been saved. Only that known installation inherits these presets;
        // a fresh installation or an unknown controller never invents notices.
        $current=$this->read('runtime/cra1_theme/distribution/current.json');
        $manifest=$current['manifest']??[];
        $source=$manifest['files']['public/web/cra1/controller/Cra1.php']['sha256']??'';
        if (($manifest['product']??'')!=='cra1-theme'||$source!=='617e59a6f8ce48025aa0b826dc4c4ba88e54463b306a58aa51971b14b243e3e2') return [];
        return ['show_notice'=>'1','notice_bar_text'=>"欢迎使用智简魔方云服务平台|/about.html\n查看最新平台公告|/announce.html\n接入文档与使用指南|/document.html",'notice_bar_interval'=>'5','notice_bar_links_text'=>"云文档|/document.html\n官方公告|/announce.html"];
    }
    private static function text(string $html): string { return trim(html_entity_decode(strip_tags($html),ENT_QUOTES|ENT_HTML5,'UTF-8')); }
    private static function item(string $origin,array $row,array $targets): array
    {
        $title=self::text((string)($row['title']??''));
        $detail=(string)($row['content']??$row['html']??'');
        if ($title==='') $title=mb_substr(self::text($detail),0,160)?:'通知';
        $link=(string)($row['link']??'');
        try { $link=AnnouncementStore::safeUrl($link); } catch (\InvalidArgumentException $e) { $link=''; }
        $extras=[];
        foreach ($row['buttons']??[] as $button) {
            try { $url=AnnouncementStore::safeUrl((string)($button['link']??'')); } catch (\InvalidArgumentException $e) { continue; }
            if ($url!==''&&trim((string)($button['label']??''))!=='') $extras[]=['label'=>mb_substr(self::text((string)$button['label']),0,24),'url'=>$url,'new_tab'=>false];
        }
        // Original styled headings remain available in the reader after the bar adopts plain text.
        foreach (['label','title'] as $field) if (strpos((string)($row[$field]??''),'<')!==false) $detail='<p>'.$row[$field].'</p>'.$detail;
        if (mb_strlen($title)>160) $detail='<p>'.htmlspecialchars($title,ENT_QUOTES,'UTF-8').'</p>'.$detail;
        return ['id'=>'legacy-'.substr(hash('sha256',$origin),0,24),'title'=>mb_substr($title,0,160),'label'=>mb_substr(self::text((string)($row['label']??'通知')),0,24),'icon'=>'megaphone','summary'=>'','detail'=>$detail,'action'=>$detail!==''?'detail':($link!==''?'link':'none'),'action_label'=>'查看详情','url'=>$link,'new_tab'=>false,'targets'=>$targets,'starts_at'=>'','ends_at'=>'','priority'=>0,'dismissible'=>(bool)($row['dismissible']??true),'dismiss_for'=>'revision','enabled'=>(bool)($row['enabled']??true),'extra_actions'=>$extras];
    }
    public function values(): array
    {
        $website=array_replace($this->websiteDefaults(),$this->read('public/web/cra1/controller/storage.json'),$this->read('runtime/cra1_theme/config.json'));
        $member=$this->read('runtime/cra1_theme/member_center.json');$content=$member['content']??[];
        return self::fromValues($website,$content);
    }
    /** Also used to recover administrator-only browser drafts, without writing. */
    public static function fromValues(array $website,array $content): array
    {
        $items=[];$enabled=false;$interval=6;
        $notices=$content['notices']??null;
        if (!is_array($notices)&&isset($content['global_notice'])) $notices=['enabled'=>1,'items'=>[array_merge($content['global_notice'],['global'=>1])]];
        if (is_array($notices)) {
            $sourceOn=!empty($notices['enabled']);$enabled=$enabled||$sourceOn;
            $interval=max(3,min(300,(int)($notices['interval']??((int)($notices['interval_ms']??6000)/1000))));
            foreach ($notices['items']??[] as $i=>$row) {
                if (!is_array($row)) continue;
                $targets=['member'=>['all'=>!empty($row['global']),'pages'=>empty($row['global'])?['home']:[]]];
                if (!empty($row['global'])) $targets['cart']=['all'=>true,'pages'=>[]];
                $row['enabled']=$sourceOn&&!empty($row['enabled']??1);
                $items[]=self::item('member:'.($row['id']??$i),$row,$targets);
            }
        }
        $webOn=(string)($website['show_notice']??'0')==='1';$enabled=$enabled||$webOn;
        $side=[];
        foreach (preg_split('/\r?\n/',(string)($website['notice_bar_links_text']??'')) as $line) {
            $parts=explode('|',$line,2);if(count($parts)!==2||trim($parts[0])==='')continue;
            $side[]=['label'=>$parts[0],'link'=>$parts[1]];
        }
        foreach (preg_split('/\r?\n/',(string)($website['notice_bar_text']??'')) as $i=>$line) {
            $parts=explode('|',$line,2);if(trim($parts[0])==='')continue;
            $items[]=self::item('website:'.$i.':'.$line,['title'=>$parts[0],'link'=>$parts[1]??'','enabled'=>$webOn,'buttons'=>$side],['website'=>['all'=>false,'pages'=>['home']]]);
        }
        if (!$items&&$side) $items[]=self::item('website:links',['title'=>'通知','enabled'=>$webOn,'buttons'=>$side],['website'=>['all'=>false,'pages'=>['home']]]);
        foreach ($items as &$item) $item['published_at']=0;
        unset($item);
        return ['enabled'=>$enabled,'interval'=>$interval,'hide_single_arrows'=>false,'items'=>$items];
    }
    public function backup(): void
    {
        $file=$this->root.'/runtime/cra1_theme/announcement-migration/backup.json';
        if (is_file($file)) { Files::json($file); return; }
        $backup=[];
        foreach (['runtime/cra1_theme/config.json','runtime/cra1_theme/member_center.json','runtime/cra1_theme/member_center_public.json','public/web/cra1/controller/storage.json'] as $path) {
            $source=$this->root.'/'.$path;
            if (is_file($source)) { Files::noLinks($source);$bytes=(string)file_get_contents($source);$backup[$path]=['sha256'=>hash('sha256',$bytes),'bytes'=>base64_encode($bytes)]; }
        }
        Files::putJson($file,['created_at'=>time(),'files'=>$backup,'inherited_website_defaults'=>$this->websiteDefaults()],0600);
    }
    public function cleanupPublic(): void
    {
        // Old source fields remain dormant for safe recovery; only public artifacts are scrubbed.
        foreach (['runtime/cra1_theme/member_center_public.json'] as $path) {
            $file=$this->root.'/'.$path;if(!is_file($file))continue;
            Files::locked($file.'.lock',function()use($file,$path){
                $value=Files::json($file);$next=$value;
                if (strpos($path,'member_center')!==false) { unset($next['content']['notices'],$next['content']['home_notice'],$next['content']['global_notice']); if(strpos($path,'_public')!==false)$next['projection_version']=3; }
                if ($next!==$value) Files::putJson($file,$next);
            });
        }
    }
}
