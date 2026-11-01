<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;

use CRA1\Theme\Files;

/** Portable member menus. Numeric navigation/plugin/product ids never identify another site. */
final class MenuTransfer
{
    private string $root;
    private MemberCenterStore $store;
    private ?array $catalog;
    public function __construct(string $root,?array $catalog=null) { $this->root=$root; $this->store=new MemberCenterStore($root.'/runtime');$this->catalog=$catalog; }
    private function catalog(): array { return $this->catalog??($this->catalog=$this->store->readSystemCatalog()); }
    public function siteKey(): string
    {
        $key=$this->root.'/config/cra1_theme_security.key';
        return hash_hmac('sha256','cra1-menu-site',is_file($key)?(string)file_get_contents($key):$this->root);
    }
    public function bindings(?array $catalog=null): array
    {
        $catalog=$catalog??$this->catalog();$navs=[];$plugins=[];
        if(!empty($catalog['error']))throw new \InvalidArgumentException('系统导航暂时无法读取，请稍后重试');
        foreach($catalog['navs']??[]as$n){
            $navs[(string)$n['id']]=array_intersect_key($n,array_flip(['url','plugin','module']));
            if(preg_match('~^/?plugin/(\d+)/~',(string)$n['url'],$m)&&!empty($n['plugin']))$plugins[$m[1]]=$n['plugin'];
        }
        return ['navs'=>$navs,'plugins'=>$plugins];
    }
    public function preview(array $sidebar): array
    {
        self::checkTree($sidebar['nodes']??[]);$errors=$this->store->validateTree($sidebar['nodes']??[],true);if($errors)throw new \InvalidArgumentException(implode('；',array_slice($errors,0,3)));$catalog=$this->catalog();
        if(!empty($catalog['error']))throw new \InvalidArgumentException('系统导航读取失败，本次未能完成菜单检查，请重试');
        $issues=[];$seen=[];$visible=0;$hidden=0;$navs=[];$products=[];
        foreach($catalog['navs']??[]as$nav)$navs[(int)$nav['id']]=$nav;
        foreach($catalog['products']??[]as$product)$products[(int)$product['id']]=true;
        $inspect=function(array $nodes,string $parent='',bool $ancestorHidden=false)use(&$inspect,&$issues,&$seen,&$visible,&$hidden,$navs,$products){
            foreach($nodes as$n){
                $path=$parent===''?$n['label']:$parent.' / '.$n['label'];$suppressed=$ancestorHidden||!empty($n['hidden']);
                if($suppressed){$hidden++;}else{$visible++;}
                $url=trim((string)($n['url']??''));$type=$n['source_type']??'custom';$kids=$n['children']??[];
                $issue=function(string $text)use(&$issues,$n,$path){$issues[]=['id'=>$n['id'],'path'=>$path,'message'=>$text];};
                if(!$suppressed&&$type!=='separator'){
                    if(!$url&&!$kids&&$type!=='module')$issue('该分组或页面没有链接及可用子项');
                    if(in_array($type,['system','plugin'],true)&&!empty($n['source_nav_id'])&&!isset($navs[(int)$n['source_nav_id']]))$issue('原系统导航已不存在，请重新选择链接');
                    if($url&&$url!=='#'){$target=strtolower(ltrim($url,'/'));if(isset($seen[$target]))$issue('与「'.$seen[$target].'」指向相同页面，请确认是否需要保留');else$seen[$target]=$path;}
                    if($url==='#')$issue('链接尚未完成配置');
                    if($type==='module'){
                        $ids=$n['product_id']??[];if(!$ids)$issue('尚未关联商品，请检查产品分类关联');
                        elseif(array_diff($ids,array_keys($products)))$issue('部分关联商品已不可用，请重新确认商品');
                    }
                    if($kids&&!array_filter($kids,static function($child){return empty($child['hidden']);}))$issue('所有直接子项均已隐藏');
                }
                $inspect($kids,$path,$suppressed);
            }
        };$inspect($sidebar['nodes']??[]);
        $caps=$catalog['preview_capabilities']??null;
        $tree=$this->store->sidebarPreview($sidebar['nodes']??[],$caps);
        $liveIds=[];$collect=function(array $nodes)use(&$collect,&$liveIds){foreach($nodes as$n){$liveIds[$n['id']]=true;$collect($n['children']??[]);}};$collect($tree);
        $check=function(array $nodes,string $parent='',bool $ancestorHidden=false)use(&$check,&$issues,$liveIds){foreach($nodes as$n){
            $path=$parent===''?$n['label']:$parent.' / '.$n['label'];$hidden=$ancestorHidden||!empty($n['hidden']);
            if(!$hidden&&!isset($liveIds[$n['id']]))$issues[]=['id'=>$n['id'],'path'=>$path,'message'=>'当前功能或插件不可用，该项不会在前台显示'];
            $check($n['children']??[],$path,$hidden);
        }};$check($sidebar['nodes']??[]);
        return ['nodes'=>$tree,'issues'=>$issues,'counts'=>['configured'=>$visible+$hidden,'hidden'=>$hidden,'projected'=>count($liveIds)],'permission_note'=>'预览包含当前草稿和本站功能状态；正式菜单还会按各会员权限过滤。'];
    }
    public static function checkTree(array $nodes): void
    {
        $seen=[];$count=0;
        $walk=function(array $list,int $depth)use(&$walk,&$seen,&$count){
            if($list&&array_keys($list)!==range(0,count($list)-1))throw new \InvalidArgumentException('菜单条目必须是列表');
            foreach($list as$n){
                if(!is_array($n)||++$count>500||$depth>3)throw new \InvalidArgumentException('菜单最多 500 项、三级层级');
                $id=$n['id']??null;if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{6,64}$/D',$id)||isset($seen[$id]))throw new \InvalidArgumentException('菜单标识缺失或重复');$seen[$id]=true;
                $allowed=['id','label','language','source_type','source_nav_id','url','icon','icon_style','second_reminder','module','res_module','product_id','show_quick_order','quick_order_url','is_cross_module','select_field','select_field_set','select_field_version','hidden','order','import_key','children'];
                if(array_diff(array_keys($n),$allowed))throw new \InvalidArgumentException('菜单包含未知字段，请使用兼容版本导出的文件');
                foreach(['source_type','icon','import_key']as$k)if(isset($n[$k])&&!is_string($n[$k]))throw new \InvalidArgumentException('菜单文字字段格式不正确');
                foreach(['source_nav_id','second_reminder','show_quick_order','is_cross_module','hidden','order','select_field_version']as$k)if(isset($n[$k])&&!is_int($n[$k]))throw new \InvalidArgumentException('菜单数值字段格式不正确');
                if(isset($n['select_field_set'])&&!is_bool($n['select_field_set']))throw new \InvalidArgumentException('菜单显示字段格式不正确');
                foreach(['module','res_module','select_field','product_id','language']as$k)if(isset($n[$k])){
                    $v=is_object($n[$k])?(array)$n[$k]:$n[$k];if(!is_array($v)||count($v)>500)throw new \InvalidArgumentException('菜单关联字段格式不正确');
                    foreach($v as$x)if($k==='product_id'?!is_int($x):!is_string($x))throw new \InvalidArgumentException('菜单关联字段内容不正确');
                }
                if(!is_string($n['label']??null)||mb_strlen($n['label'])>100||$n['label']===''||strip_tags($n['label'])!==$n['label'])throw new \InvalidArgumentException('菜单名称需要是 1 至 100 字纯文字');
                foreach(['url','quick_order_url']as$k)if(isset($n[$k])&&(!is_string($n[$k])||strlen($n[$k])>2048||preg_match('/[\x00-\x20<>"\'\\\\]/',$n[$k])||strpos($n[$k],'//')===0||preg_match('/^(?:javascript|data|vbscript):/i',$n[$k])))throw new \InvalidArgumentException('菜单链接格式不正确');
                if(!is_array($n['children']??[]))throw new \InvalidArgumentException('子菜单格式不正确');$walk($n['children']??[],$depth+1);
            }
        };$walk($nodes,1);
    }
    public static function select(array $nodes,array $ids): array
    {
        if(count($ids)>500)throw new \InvalidArgumentException('所选菜单过多');
        foreach($ids as$id)if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{6,64}$/D',$id))throw new \InvalidArgumentException('所选菜单格式不正确');
        $chosen=array_fill_keys($ids,true);$found=[];
        $walk=function(array $list)use(&$walk,$chosen,&$found){$out=[];foreach($list as$n){$kids=$walk($n['children']??[]);if(isset($chosen[$n['id']]))$found[$n['id']]=true;if(isset($chosen[$n['id']])||$kids){$n['children']=$kids;$out[]=$n;}}return $out;};
        $out=$walk($nodes);if(array_diff_key($chosen,$found))throw new \InvalidArgumentException('所选菜单不存在，请重新选择');return $out;
    }
    public function export(array $sidebar,array $ids,bool $recent): array
    {
        self::checkTree($sidebar['nodes']??[]);
        if(!$ids&&!$recent)throw new \InvalidArgumentException('请至少选择一项导出内容');
        $data=['shape'=>3,'nodes'=>self::select($sidebar['nodes'],$ids)];
        if($recent)$data['recent']=$sidebar['recent']??MemberCenterStore::defaults()['sidebar']['recent'];
        $bindings=$this->bindings();$needed=['navs'=>[],'plugins'=>[]];
        $scan=function(array $ns)use(&$scan,$bindings,&$needed){foreach($ns as$n){$id=(string)($n['source_nav_id']??0);if(isset($bindings['navs'][$id]))$needed['navs'][$id]=$bindings['navs'][$id];foreach(['url','quick_order_url']as$k)if(preg_match('~^/?plugin/(\d+)/~',(string)($n[$k]??''),$m)&&isset($bindings['plugins'][$m[1]]))$needed['plugins'][$m[1]]=$bindings['plugins'][$m[1]];$scan($n['children']??[]);}};$scan($data['nodes']);
        return ['format'=>'cra1-menu','schema'=>1,'site_key'=>$this->siteKey(),'bindings'=>$needed,'sidebar'=>$data];
    }
    public function validate(array $doc): void
    {
        if(($doc['format']??'')!=='cra1-menu'||($doc['schema']??null)!==1||!is_array($doc['sidebar']['nodes']??null)||($doc['sidebar']['shape']??null)!==3||!is_array($doc['bindings']??null)||!is_string($doc['site_key']??null))throw new \InvalidArgumentException('请选择酷锐A1导出的菜单 JSON 文件');
        self::checkTree($doc['sidebar']['nodes']);
        self::checkBindings($doc['bindings']);
        if(array_diff(array_keys($doc['sidebar']),['nodes','shape','recent']))throw new \InvalidArgumentException('菜单文件包含不支持的设置');
        if(isset($doc['sidebar']['recent']))self::checkRecent($doc['sidebar']['recent']);
    }
    public static function checkBindings(array $bindings): void
    {
        if(array_diff(array_keys($bindings),['navs','plugins'])||!is_array($bindings['navs']??null)||!is_array($bindings['plugins']??null)||count($bindings['navs'])>2000||count($bindings['plugins'])>1000)throw new \InvalidArgumentException('菜单来源信息格式不正确');
        foreach($bindings['navs']as$id=>$nav){if(!ctype_digit((string)$id)||!is_array($nav)||array_diff(array_keys($nav),['url','plugin','module']))throw new \InvalidArgumentException('导航来源信息格式不正确');foreach($nav as$v)if(!is_string($v)||strlen($v)>2048)throw new \InvalidArgumentException('导航来源内容不正确');}
        foreach($bindings['plugins']as$id=>$name)if(!ctype_digit((string)$id)||!is_string($name)||!preg_match('/^[A-Za-z][A-Za-z0-9_]*$/D',$name))throw new \InvalidArgumentException('插件来源信息格式不正确');
    }
    public static function checkRecent($recent): void
    {
        if(!is_array($recent)||array_diff(array_keys($recent),['enabled','title','days','max_items','new_tab','open_first']))throw new \InvalidArgumentException('最近访问设置格式不正确');
        foreach($recent as$k=>$v)if($k==='title'?(!is_string($v)||mb_strlen($v)>100):!is_int($v))throw new \InvalidArgumentException('最近访问设置内容不正确');
    }
    public function remap(array $nodes,array $bindings,bool $sameSite,array &$warnings,?array $catalog=null,bool $defaults=false): array
    {
        $catalog=$catalog??$this->catalog();
        if(!empty($catalog['error']))throw new \InvalidArgumentException('系统导航暂时无法读取，尚未导入');
        $target=$this->bindings($catalog);$byPlugin=[];
        foreach($target['plugins']as$id=>$name)if(!empty($catalog['plugins'][$name]['enabled']))$byPlugin[$name]=(int)$id;
        $walk=function(array $list)use(&$walk,$bindings,$target,$catalog,$sameSite,&$warnings,$byPlugin,$defaults){$out=[];
            foreach($list as$n){
                if(!$sameSite)unset($n['import_key']);
                $n['children']=$walk($n['children']??[]);$oldId=(string)($n['source_nav_id']??0);$nav=$bindings['navs'][$oldId]??null;
                if(in_array($n['source_type']??'',['system','plugin'],true)){
                    $matched=null;foreach($target['navs']as$id=>$candidate){if(!empty($candidate['plugin'])&&empty($catalog['plugins'][$candidate['plugin']]['enabled']))continue;if($nav&&($nav['plugin']??'')===($candidate['plugin']??'')&&preg_replace('~^/?plugin/\d+/~','plugin/',(string)($nav['url']??''))===preg_replace('~^/?plugin/\d+/~','plugin/',(string)($candidate['url']??''))){$matched=(int)$id;break;}}
                    if($matched!==null)$n['source_nav_id']=$matched;
                    elseif(!$sameSite){$n['source_type']='custom';$n['source_nav_id']=0;if(($nav['plugin']??'')!=='')$n['hidden']=1;$warnings[]='部分导航未匹配，相关入口已隐藏或保留为普通站内链接，请复核。';}
                }
                foreach(['url','quick_order_url']as$field){$url=(string)($n[$field]??'');
                    if(preg_match('~^(/?)plugin/(\d+)/(.*)$~',$url,$m)){
                        $name=$bindings['plugins'][$m[2]]??null;
                        if($name&&isset($byPlugin[$name]))$n[$field]=$m[1].'plugin/'.$byPlugin[$name].'/'.$m[3];
                        elseif(!$sameSite){$n['hidden']=1;$n[$field]='';if($field==='url'&&!$n['children'])$n[$field]='#';$warnings[]='目标站未启用部分插件，对应菜单已隐藏。';}
                    }
                }
                if(!$sameSite&&!empty($n['product_id'])){$n['product_id']=[];$n['hidden']=1;$warnings[]='商品关联属于原站，相关菜单已隐藏，请在目标站重新选择商品后启用。';}
                if($defaults&&!empty($n['module'])){
                    // Inherit an unambiguous native navigation association, never classify all products by module.
                    $matches=[];foreach($catalog['menu']??[]as$row){
                        if(!in_array($row['source_type']??'',['module','res_module'],true))continue;
                        if(($row['label']??'')!==$n['label'])continue;
                        $source=$row['module']??[];$wanted=$n['module'];sort($source);sort($wanted);if($source===$wanted)$matches[]=$row;
                    }
                    $products=count($matches)===1?array_values(array_unique(array_filter(array_map('intval',$matches[0]['product_id']??[])))):[];
                    $n['product_id']=$products;$n['hidden']=$products?0:1;
                }
                $out[]=$n;
            }return $out;
        };
        $nodes=$walk($nodes);$warnings=array_values(array_unique($warnings));return $nodes;
    }
    /** Rewrite structured plugin links without touching executable custom code. */
    public function remapLinks(array $values,array $bindings,bool $sameSite,array &$warnings): array
    {
        if($sameSite)return $values;
        $catalog=$this->catalog();$target=$this->bindings($catalog);$ids=[];
        foreach($target['plugins']as$id=>$name)if(!empty($catalog['plugins'][$name]['enabled']))$ids[$name]=$id;
        $walk=function($value,string $key='')use(&$walk,$bindings,$ids,&$warnings){
            if(in_array($key,['custom_code','custom_css','custom_js'],true))return $value;
            if(is_array($value)){foreach($value as$k=>&$v)$v=$walk($v,(string)$k);return $value;}
            if(!is_string($value))return $value;
            if(substr($key,-5)==='_json'&&$value!==''){$json=json_decode($value,true);if(is_array($json))return json_encode($walk($json),JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
            // Website row editors and rich text also contain relative plugin links.
            // The boundary excludes external URLs; custom code is skipped above.
            if(strpos($value,'plugin/')!==false)return preg_replace_callback('~(^|[\s|"\x27(<>=])(/?)plugin/(\d+)/([^\s|<>"\x27]+)~u',function($m)use($bindings,$ids,&$warnings){
                $name=$bindings['plugins'][$m[3]]??'';
                if(isset($ids[$name]))return $m[1].$m[2].'plugin/'.$ids[$name].'/'.$m[4];
                $warnings[]='部分插件链接在目标站不可用，已改为无跳转，请重新选择。';return $m[1].'#';
            },$value);
            return $value;
        };
        return $walk($values);
    }
    public function proposal(array $doc,array $ids,bool $recent,array $current,string $mode): array
    {
        $this->validate($doc);self::checkTree($current['nodes']??[]);
        if(!in_array($mode,['append','replace'],true)||(!$ids&&!$recent))throw new \InvalidArgumentException('请选择导入内容与方式');
        $incoming=self::select($doc['sidebar']['nodes'],$ids);$warnings=[];
        $incoming=$this->remap($incoming,$doc['bindings'],hash_equals($this->siteKey(),$doc['site_key']),$warnings);
        $out=$current;
        if($ids){
            $seen=[];$collect=function(array $ns)use(&$collect,&$seen){foreach($ns as$n){$seen[$n['id']]=true;$collect($n['children']??[]);}};$collect($current['nodes']??[]);
            $fresh=function(array $ns)use(&$fresh,&$seen){foreach($ns as&$n){if(isset($seen[$n['id']]))$n['id']=MemberCenterStore::uuid();$seen[$n['id']]=true;$n['children']=$fresh($n['children']??[]);}return $ns;};
            $out['nodes']=$mode==='replace'?$incoming:array_merge($current['nodes']??[],$fresh($incoming));$out['shape']=3;
        }
        if($recent){if(!is_array($doc['sidebar']['recent']??null))throw new \InvalidArgumentException('文件不包含最近访问设置');$out['recent']=$doc['sidebar']['recent'];}
        self::checkTree($out['nodes']);$errors=$this->store->validateTree($out['nodes'],true);if($errors)throw new \InvalidArgumentException(implode('；',array_slice($errors,0,3)));
        $out=$this->store->normalizedPreview(['sidebar'=>$out])['sidebar'];
        return ['sidebar'=>$out,'warnings'=>$warnings,'difference'=>ConfigurationDiff::compare(['member'=>['sidebar'=>$current]],['member'=>['sidebar'=>$out]])];
    }
    public function defaults(): array
    {
        $doc=Files::json(__DIR__.'/member-menu.defaults.json');$warnings=[];
        $this->validate($doc);$catalog=$this->catalog();
        if(!empty($catalog['error']))$catalog=['navs'=>[],'plugins'=>[],'products'=>[]];
        $doc['sidebar']['nodes']=$this->remap($doc['sidebar']['nodes'],$doc['bindings'],false,$warnings,$catalog,true);
        return $doc['sidebar'];
    }
}
