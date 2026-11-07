<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;

/** A lossless, text-only comparison for administrator review. Never render values as HTML. */
final class ConfigurationDiff
{
    private const LABELS=['website'=>'官网','member'=>'会员中心','cart'=>'购物车','notifications'=>'通知',
        'sidebar'=>'侧栏菜单','nodes'=>'菜单','recent'=>'最近访问','shape'=>'层级','appearance'=>'外观','content'=>'内容',
        'custom_code'=>'自定义代码','custom_css'=>'自定义 CSS','custom_js'=>'自定义 JS','css'=>'CSS','js'=>'JS',
        'enabled'=>'启用','hidden'=>'隐藏','label'=>'名称','title'=>'标题','description'=>'说明','url'=>'链接',
        'icon'=>'图标','order'=>'排序','children'=>'子菜单','items'=>'条目','product_id'=>'关联商品',
        'source_type'=>'菜单类型','source_nav_id'=>'系统导航关联','module'=>'模块','res_module'=>'代理模块',
        'select_field'=>'显示字段','new_tab'=>'新标签页','days'=>'保留天数','max_items'=>'最多条数',
        'language'=>'多语言名称','css_enabled'=>'启用 CSS','js_enabled'=>'启用 JS','values'=>'设置'];

    public static function compare(array $before,array $after,array $labels=[]): array
    {
        $rows=[];$counts=['added'=>0,'removed'=>0,'changed'=>0];
        $name=static function(string $key)use($labels):string{return (string)($labels[$key]??self::LABELS[$key]??$key);};
        $value=static function($v):string{return is_string($v)?$v:json_encode($v,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);};
        $add=function(string $path,string $label,$a,$b,bool $hasA,bool $hasB)use(&$rows,&$counts,$value){
            $kind=!$hasA?'added':(!$hasB?'removed':'changed');$counts[$kind]++;
            $rows[]=['path'=>$path,'label'=>$label,'kind'=>$kind,'before'=>$hasA?$value($a):null,'after'=>$hasB?$value($b):null];
        };
        $walk=function($a,$b,string $path,string $label,bool $hasA=true,bool $hasB=true,int $depth=0)use(&$walk,$add,$name){
            if($hasA&&$hasB&&$a===$b)return;
            if($depth>32)throw new \InvalidArgumentException('配置层级过深，无法生成差异');
            // JSON-backed layout fields are compared by their actual settings, not escaped strings.
            foreach(['a','b']as$which){
                $v=$which==='a'?$a:$b;
                if(is_string($v)&&preg_match('/(?:_json|^json)$/',substr($path,strrpos($path,'.')+1))){
                    $d=json_decode($v,true,32);if(is_array($d)){if($which==='a')$a=$d;else$b=$d;}
                }
            }
            if(is_object($a))$a=(array)$a;if(is_object($b))$b=(array)$b;
            if(is_array($a)&&is_array($b)){
                $isList=static function(array $v):bool{return !$v||array_keys($v)===range(0,count($v)-1);};
                $identity=static function(array $v):?array{
                    $out=[];foreach($v as$item){if(!is_array($item)||!isset($item['id'])||!is_scalar($item['id'])||isset($out[(string)$item['id']]))return null;$out[(string)$item['id']]=$item;}return $out;
                };
                if($isList($a)&&$isList($b)&&($aa=$identity($a))!==null&&($bb=$identity($b))!==null){
                    if(array_keys($aa)!==array_keys($bb)&&$aa&&$bb){
                        $titles=static function(array $list):array{return array_map(static function($n){return (string)($n['label']??$n['title']??$n['id']);},array_values($list));};
                        $add($path.'.@order',$label.' / 条目顺序',$titles($aa),$titles($bb),true,true);
                    }
                    foreach(array_unique(array_merge(array_keys($aa),array_keys($bb)))as$key){
                        $left=$aa[$key]??null;$right=$bb[$key]??null;$item=$right??$left;
                        $walk($left,$right,$path.'.['.$key.']',$label.' / '.(string)($item['label']??$item['title']??$key),isset($aa[$key]),isset($bb[$key]),$depth+1);
                    }return;
                }
                $keys=array_unique(array_merge(array_keys($a),array_keys($b)));
                foreach($keys as$key){
                    if($depth<=1&&in_array($key,['schema','schema_version','version','updated_at','updated_by'],true))continue;
                    $walk($a[$key]??null,$b[$key]??null,$path===''?(string)$key:$path.'.'.$key,$label===''?$name((string)$key):$label.' / '.$name((string)$key),array_key_exists($key,$a),array_key_exists($key,$b),$depth+1);
                }return;
            }
            if($hasA&&$hasB&&$a===$b)return;
            $add($path,$label,$a,$b,$hasA,$hasB);
        };
        $walk($before,$after,'','');
        return ['total'=>count($rows),'summary'=>$counts,'entries'=>$rows];
    }
}
