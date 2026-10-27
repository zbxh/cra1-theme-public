<?php
/** Shared icon contract. Local render paths never fetch or evict resources. */
if (!function_exists('cra1_icons_root')) {
function cra1_icons_root(): string { return dirname(__DIR__, 2); }
function cra1_icons_version(): string {
    static $version=null;
    if ($version===null) { $d=json_decode((string)@file_get_contents(__DIR__.'/icons/version.json'),true); $version=(string)($d['version']??'20261012-icon-suite-v1'); }
    return preg_match('/^[a-z0-9-]+$/i',$version)?$version:'20261012-icon-suite-v1';
}
function cra1_icons_data(string $name): array {
    static $cache=[];
    if (!preg_match('/^[a-z0-9-]+$/i',$name)) return [];
    if (!isset($cache[$name])) { $d=json_decode((string)@file_get_contents(__DIR__.'/icons/releases/'.cra1_icons_version().'/'.$name.'.json'),true); $cache[$name]=is_array($d)?$d:[]; }
    return $cache[$name];
}
function cra1_icons_presets(): array { return [
 'titanium'=>['label'=>'钛灰银','foreground'=>'#555d67','from'=>'#edf0f3','to'=>'#c9ced4'],
 'graphite'=>['label'=>'石墨暖灰','foreground'=>'#625c55','from'=>'#eeeae5','to'=>'#d1c9bf'],
 'champagne'=>['label'=>'香槟金','foreground'=>'#896d46','from'=>'#f5efe4','to'=>'#dacfbb'],
 'compute'=>['label'=>'计算蓝','foreground'=>'#3562a4','from'=>'#ffffff','to'=>'#e5eefb'],
 'security'=>['label'=>'安全绿','foreground'=>'#19786b','from'=>'#ffffff','to'=>'#e2f3ed'],
 'finance'=>['label'=>'财务金','foreground'=>'#986221','from'=>'#ffffff','to'=>'#faf0d9'],
 'gold'=>['label'=>'业务金','foreground'=>'#896437','from'=>'#ffffff','to'=>'#f4ebdb'],
]; }
function cra1_icon_style_clean($style): ?array {
    if ($style===null || $style===[] || $style==='' || (is_array($style)&&($style['mode']??'')==='theme')) return null;
    if (!is_array($style) || ($style['v']??null)!==1 || !in_array($style['mode']??'', ['preset','custom'],true)) throw new InvalidArgumentException('图标样式版本或方式不正确');
    if ($style['mode']==='preset') {
        if (!isset(cra1_icons_presets()[$style['preset']??''])) throw new InvalidArgumentException('图标配色预设不存在');
        return ['v'=>1,'mode'=>'preset','preset'=>$style['preset']];
    }
    $hex=function($v) { if (!is_string($v)||!preg_match('/^#[0-9a-f]{6}$/i',$v)) throw new InvalidArgumentException('图标颜色必须为六位十六进制颜色');return strtolower($v); };
    $bg=$style['background']??[];$kind=$bg['kind']??'transparent';
    if (!is_array($bg)||!in_array($kind,['transparent','solid','gradient'],true)) throw new InvalidArgumentException('图标背景方式不正确');
    $out=['v'=>1,'mode'=>'custom','foreground'=>$hex($style['foreground']??'')];
    if ($kind==='transparent') $out['background']=['kind'=>'transparent'];
    else {
        $opacity=$bg['opacity']??100;$angle=$bg['angle']??145;
        if (!is_numeric($opacity)||$opacity<0||$opacity>100||!is_numeric($angle)||$angle<0||$angle>360) throw new InvalidArgumentException('背景透明度或渐变方向超出范围');
        $out['background']=['kind'=>$kind,'from'=>$hex($bg['from']??''),'opacity'=>(int)$opacity];
        if ($kind==='gradient') { $out['background']['to']=$hex($bg['to']??'');$out['background']['angle']=(int)$angle; }
    }
    return $out;
}
function cra1_icon_style_vars($style, bool $tile=true): array {
    try { $s=cra1_icon_style_clean($style); } catch (Throwable $e) { return []; }
    if (!$s) return [];
    if ($s['mode']==='preset') { $p=cra1_icons_presets()[$s['preset']];$s=['foreground'=>$p['foreground'],'background'=>['kind'=>'gradient','from'=>$p['from'],'to'=>$p['to'],'angle'=>145,'opacity'=>100]]; }
    $ink=isset($style['preset'])?'var(--cui-icon-'.$style['preset'].','.$s['foreground'].')':$s['foreground'];
    $v=['--cui-icon-ink'=>$ink,'--cui-icon-manual-ink'=>$ink];
    if ($tile) {
        $b=$s['background'];$v['--cui-icon-background']=$b['kind']==='transparent'?'transparent':($b['kind']==='solid'?$b['from']:'linear-gradient('.$b['angle'].'deg,'.$b['from'].','.$b['to'].')');
        if(isset($style['preset']))$v['--cui-icon-background']='linear-gradient(145deg,var(--cui-icon-surface,'.$p['from'].'),var(--cui-icon-'.$style['preset'].'-fill,'.$p['to'].'))';
        $v['--cui-icon-background-opacity']=(string)(($b['opacity']??100)/100);
        if ($b['kind']==='transparent') $v['--cui-icon-halo-opacity']='0';
    }
    return $v;
}
function cra1_icon_style_css($style,bool $tile=true): string { $s='';foreach(cra1_icon_style_vars($style,$tile) as $k=>$v)$s.=$k.':'.$v.';';return $s; }
function cra1_icon_style_attrs($style,bool $tile=true): string { $css=cra1_icon_style_css($style,$tile);return $css===''?'':' data-cui-icon-style="1" style="'.htmlspecialchars($css,ENT_QUOTES,'UTF-8').'"'; }
/** Versioned final column; columns before it (including unknown columns) stay exact. */
function cra1_icon_row_parts(string $line): array {
    $parts=explode('|',$line);$styles=[];$tail=end($parts);
    if (strpos((string)$tail,'@icon-style:v1:')===0) {
        $raw=substr($tail,15);$decoded=base64_decode(strtr($raw,'-_','+/'),true);$doc=json_decode((string)$decoded,true);
        if (is_array($doc)) { foreach($doc as $key=>$s) { try { $clean=cra1_icon_style_clean($s);if($clean)$styles[$key]=$clean; }catch(Throwable $e){} }array_pop($parts); }
    }
    return ['parts'=>array_map('trim',$parts),'styles'=>$styles];
}
function cra1_icon_row_style(string $line): ?array { $p=cra1_icon_row_parts($line);return $p['styles']?reset($p['styles']):null; }
function cra1_icons_sanitize_svg(string $raw): string {
    if (strlen($raw)>131072 || preg_match('/<!DOCTYPE|<!ENTITY/i',$raw) || !class_exists('DOMDocument')) return '';
    $previous=libxml_use_internal_errors(true);$dom=new DOMDocument();$ok=$dom->loadXML($raw,LIBXML_NONET);libxml_clear_errors();libxml_use_internal_errors($previous);
    if (!$ok || !$dom->documentElement || $dom->documentElement->localName!=='svg') return '';
    $tags=['svg','g','path','rect','circle','ellipse','polygon','polyline','line','defs','linearGradient','radialGradient','stop','clipPath','mask','title'];
    $attrs=['xmlns','viewBox','d','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','width','height','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','transform','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','clip-path','mask','maskUnits','color'];
    $walk=function($el) use (&$walk,$tags,$attrs) {
        foreach(iterator_to_array($el->childNodes) as $child) { if($child instanceof DOMElement){if(!in_array($child->localName,$tags,true))$el->removeChild($child);else $walk($child);}else $el->removeChild($child); }
        foreach(iterator_to_array($el->attributes) as $a) if(!in_array($a->name,$attrs,true)||preg_match('/javascript:|https?:|data:|expression|[<>]/i',$a->value))$el->removeAttributeNode($a);
    };$walk($dom->documentElement);$dom->documentElement->setAttribute('xmlns','http://www.w3.org/2000/svg');return (string)$dom->saveXML($dom->documentElement);
}
function cra1_icons_monochrome(string $svg): bool { preg_match_all('/(?:fill|stroke|stop-color)="([^" ]+)"/',$svg,$m);$colors=array_diff(array_unique($m[1]),['none','currentColor','inherit','transparent']);foreach($colors as $c)if(strpos($c,'url(')===0)return false;return count($colors)<=1; }
function cra1_icons_file_descriptor(string $spec,string $url,string $file): array {
    $label=preg_match('/^(?:iconify:)?[a-z0-9-]+:[a-z0-9-]+$/i',$spec)?substr(strrchr($spec,':'),1):(basename($url)?:basename($file));
    $d=['id'=>$spec,'label'=>$label,'category'=>'custom','source'=>'站内图片','url'=>$url,'svg'=>'','colorable'=>false,'available'=>is_file($file)];
    if ($d['available']&&preg_match('/\.svg$/i',$file)) { $d['svg']=cra1_icons_sanitize_svg((string)file_get_contents($file));$d['available']=$d['svg']!=='';$brand=preg_match('/^(?:iconify:)?(?:simple-icons|logos|fa-brands|cib):/i',$spec)||preg_match('/^(?:simple-icons|logos|fa-brands|cib)[-:]/i',basename($file));$d['colorable']=$d['available']&&!$brand&&cra1_icons_monochrome($d['svg']);if($d['colorable'])$d['svg']=preg_replace('/(fill|stroke)="(?!none"|currentColor"|inherit")[^" ]+"/','$1="currentColor"',$d['svg']); }
    return $d;
}
function cra1_icons_resolve(string $spec,string $context='website',string $default=''): array {
    $v=trim($spec);$lookup=cra1_icons_data('lookup');$id=preg_replace('/^iconify:/','',$v);
    if ($v===''&&$default!=='') $id=$default;
    if(strpos($id,'builtin:')===0)$id=substr($id,8);
    elseif ($context==='member-quick'&&isset($lookup['legacy:quick:'.$id])) $id='legacy:quick:'.$id;
    if (isset($lookup[$id])) { [$group,$offset]=$lookup[$id];$all=cra1_icons_data($group);$d=$all[$offset];$d['value']=$spec;$d['isDefault']=$v==='';return $d; }
    $d=['id'=>$spec,'value'=>$spec,'label'=>$v?:'默认图标','category'=>'custom','source'=>'历史值','url'=>'','svg'=>'','colorable'=>false,'available'=>false];
    if ($v==='') { $d['source']='当前位置默认图形';$d['isDefault']=true;return $d; }
    // Icons8 is a legacy PNG provider, not an Iconify collection. Check its
    // original cache before the generic collection:id branch.
    if (strpos($v,'icons8:')===0 && preg_match('/^[a-z0-9-]+$/i',substr($v,7))) {
        foreach([24,36,40,44,48] as $size) {
            $remote='https://img.icons8.com/fluency-systems-filled/'.$size.'/'.substr($v,7).'.png';
            $file=cra1_icons_root().'/public/web/cra1/assets/icons/'.md5($remote).'.png';
            if(is_file($file))return cra1_icons_file_descriptor($spec,'/web/cra1/assets/icons/'.md5($remote).'.png',$file);
        }
        $d['url']='https://img.icons8.com/fluency-systems-filled/48/'.substr($v,7).'.png';$d['source']='Icons8 原色 PNG';$d['available']=true;$d['external']=true;return $d;
    }
    if (preg_match('/^[a-z0-9-]+:[a-z0-9-]+$/i',$id)) {
        foreach([['/cra1-shared/icons/imported/',$id.'.svg'],['/web/cra1/assets/icons/',str_replace(':','-',$id).'.svg']] as [$base,$name]) {
            $url=$base.$name;$file=cra1_icons_root().'/public'.$url;if(is_file($file)){ $d=cra1_icons_file_descriptor($spec,$url,$file);$d['category']=explode(':',$id)[0];$d['source']='本地导入';if(in_array($d['category'],['simple-icons','logos','fa-brands','cib'],true))$d['colorable']=false;return $d; }
        }
        // Old deterministic cache keys were keyed by URL, size and colour.
        foreach([24,36,40,44,48] as $size) foreach(['','#1769e0','#0e9f6e','#d97706'] as $color) {
            $remote='https://api.iconify.design/'.str_replace(':','/',$id).'.svg?height='.$size.($color!==''?'&color='.urlencode($color):'');
            $file=cra1_icons_root().'/public/web/cra1/assets/icons/'.md5($remote).'.svg';if(is_file($file))return cra1_icons_file_descriptor($spec,'/web/cra1/assets/icons/'.md5($remote).'.svg',$file);
        }
        $d['source']='图标库（未导入）';return $d;
    }
    if (preg_match('~^(?:https?:)?//[^\s<>"\'\\\\]+$~i',$v)) { $d['url']=$v;$d['source']='外链图片（保持原色）';$d['available']=true;$d['external']=true;return $d; }
    $path=preg_replace('~^(?:\./)?public/~','/', $v);if(strpos($path,'web/')===0||strpos($path,'upload/')===0||strpos($path,'clientarea/')===0||strpos($path,'cart/')===0)$path='/'.$path;
    if(preg_match('~^/(?!/)[a-z0-9_./:-]+\.(?:svg|png|jpe?g|webp|gif|ico)(?:[?#][^\s<>"\']*)?$~i',$path)&&!preg_match('~(?:^|/)\.\.(?:/|$)~',$path)) {
        $plain=preg_replace('/[?#].*$/','',$path);$file=realpath(cra1_icons_root().'/public'.$plain);$public=realpath(cra1_icons_root().'/public');
        if($file&&strpos($file,$public.'/')===0)return cra1_icons_file_descriptor($spec,$path,$file);
        $d['source']='站内图片（文件不存在）';return $d;
    }
    if ($context==='member-sidebar'&&preg_match('/^icon-[a-z0-9-]+$/i',$v)) $d['source']='会员旧图标（字库中未找到）';
    return $d;
}
function cra1_icons_url(string $spec,int $size=48,string $color=''): string { $d=cra1_icons_resolve($spec);if(!empty($d['available']))return $d['url'];return ''; }
function cra1_icons_page(string $prefix,int $page=0,int $per=60): array {
    $catalog=cra1_icons_data('catalog');$keys=array_column($catalog['categories']??[],'key');if(!in_array($prefix,$keys,true))throw new InvalidArgumentException('图标分类不存在');
    $all=cra1_icons_data($prefix);$per=max(1,min(60,$per));$page=max(0,$page);$more=($page+1)*$per<count($all);
    return ['version'=>cra1_icons_version(),'icons'=>array_slice($all,$page*$per,$per),'total'=>count($all),'per'=>$per,'page'=>$page,'hasMore'=>$more,'nextPage'=>$more?$page+1:null];
}
function cra1_icons_search_text(string $text): string {
    return trim((string)preg_replace('/[\s_-]+/u',' ',mb_strtolower($text)));
}
function cra1_icons_search_aliases(): array { return [
    '云服务器'=>'server cloud cpu','服务器'=>'server cloud cpu database','云主机'=>'server cloud cpu','主机'=>'server cloud cpu','云'=>'cloud server',
    '安全'=>'shield lock key security','防护'=>'shield lock security','客服'=>'headset headphones support message chat','工单'=>'ticket message life-buoy',
    '财务'=>'wallet credit-card banknote coins','支付'=>'credit-card wallet cash','账单'=>'receipt invoice wallet','余额'=>'wallet coins banknote',
    '存储'=>'database storage hard-drive server','数据库'=>'database server','网络'=>'network globe router wifi','带宽'=>'network wifi router',
    '产品'=>'package box shopping-cart','商品'=>'package box shopping-cart','购物车'=>'shopping-cart cart basket','订单'=>'receipt shopping-cart package',
    '设置'=>'settings sliders cog','用户'=>'user users account','账户'=>'user wallet shield','账号'=>'user users account',
    '文档'=>'file book newspaper','帮助'=>'circle-help life-buoy book','邮件'=>'mail email','搜索'=>'search','时间'=>'clock calendar',
    '通知'=>'bell notification','首页'=>'home house','电话'=>'phone call','箭头'=>'arrow chevron','下载'=>'download cra1-download',
    '上传'=>'upload cloud-upload','品牌'=>'brand logo','优惠'=>'gift tag ticket','优惠券'=>'ticket tag gift',
    '阿里云'=>'alibabacloud','腾讯云'=>'tencentcloud','亚马逊'=>'amazonaws','微软'=>'microsoft azure','微信'=>'wechat','支付宝'=>'alipay'
]; }
function cra1_icons_search(string $query,string $prefix='',string $preferred=''): array {
    $raw=mb_strtolower(trim(mb_substr($query,0,80)));
    $raw=(string)preg_replace('/^iconify:/','',$raw);
    $q=cra1_icons_search_text($raw);
    if($q==='')return ['builtin'=>[],'library'=>[],'icons'=>[],'total'=>0,'version'=>cra1_icons_version()];
    // Long business phrases take precedence over overlapping short aliases.
    $matches=[];foreach(cra1_icons_search_aliases() as $zh=>$en)if(mb_strpos($q,$zh)!==false)$matches[$zh]=$en;
    uksort($matches,function($a,$b){return mb_strlen($b)<=>mb_strlen($a);});
    $aliases=[];$covered=[];
    foreach($matches as $zh=>$en){$overlap=false;foreach($covered as $long)if(mb_strpos($long,$zh)!==false){$overlap=true;break;}if($overlap)continue;$covered[]=$zh;foreach(explode(' ',$en) as $term)if(!in_array($term,$aliases,true))$aliases[]=$term;}
    $terms=explode(' ',$q);$ranked=[];$order=0;
    foreach(cra1_icons_data('catalog')['categories']??[] as $c){
        if($prefix!==''&&$prefix!==$c['key'])continue;
        foreach(cra1_icons_data($c['key']) as $it){
            $id=mb_strtolower($it['id']);$colon=strrpos($id,':');$leaf=cra1_icons_search_text(substr($id,$colon===false?0:$colon+1));
            $label=cra1_icons_search_text($it['label']);$words=cra1_icons_search_text($it['keywords']??'');
            $names=$leaf.' '.$label;$hay=$names.' '.$words;$score=0;
            if($id===$raw&&strpos($raw,':')!==false)$score=12000;
            elseif($leaf===$q||$label===$q)$score=11000;
            elseif(in_array($q,explode(' ',$words),true))$score=9400;
            elseif(strpos(' '.$names.' ',' '.$q.' ')!==false)$score=9200;
            elseif(strpos($leaf,$q)===0||strpos($label,$q)===0)$score=9000;
            elseif(mb_strpos($names,$q)!==false)$score=8800;
            elseif(mb_strpos($words,$q)!==false)$score=8600;
            elseif(count($terms)>1){$all=true;foreach($terms as $term)if(mb_strpos($hay,$term)===false){$all=false;break;}if($all)$score=8400;}
            foreach($aliases as $i=>$alias){
                $term=cra1_icons_search_text($alias);$weight=min($i,20)*30;$aliasScore=0;
                if($leaf===$term||$label===$term)$aliasScore=8500-$weight;
                elseif(strpos(' '.$names.' ',' '.$term.' ')!==false)$aliasScore=8100-$weight;
                elseif(strpos($leaf,$term)===0||strpos($label,$term)===0)$aliasScore=7900-$weight;
                elseif(mb_strpos($names,$term)!==false)$aliasScore=7400-$weight;
                elseif(strpos(' '.$words.' ',' '.$term.' ')!==false)$aliasScore=7200-$weight;
                $score=max($score,$aliasScore);
            }
            if($score>0)$ranked[]=['icon'=>$it,'score'=>$score,'preferred'=>$preferred!==''&&$c['key']===$preferred?1:0,'order'=>$order];
            $order++;
        }
    }
    // Rank the complete local corpus before applying the response budget.
    // Current-library preference only breaks equally relevant matches.
    usort($ranked,function($a,$b){return ($b['score']<=>$a['score'])?:($b['preferred']<=>$a['preferred'])?:($a['order']<=>$b['order']);});
    $hits=array_column(array_slice($ranked,0,60),'icon');
    return ['version'=>cra1_icons_version(),'icons'=>$hits,'total'=>count($ranked),'builtin'=>array_values(array_filter($hits,function($d){return $d['category']==='builtin';})),'library'=>array_values(array_filter($hits,function($d){return $d['category']!=='builtin';}))];
}
function cra1_icons_remote_json(string $url): ?array {
    if (!function_exists('curl_init')) throw new RuntimeException('服务器未启用在线图标服务');$ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>4,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_USERAGENT=>'CRA1-Icon-Suite/1']);$raw=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);if(!is_string($raw)||$status!==200)throw new RuntimeException('在线搜索暂时不可用，本地图标仍可使用');return json_decode($raw,true);
}
function cra1_icons_online_search(string $q): array {
    $j=cra1_icons_remote_json('https://api.iconify.design/search?query='.rawurlencode(mb_substr($q,0,80)).'&limit=40');$items=[];
    foreach(array_slice($j['icons']??[],0,40) as $id)if(preg_match('/^[a-z0-9-]+:[a-z0-9-]+$/',$id))$items[]=['id'=>$id,'label'=>substr(strrchr($id,':'),1),'source'=>'在线候选','category'=>explode(':',$id)[0],'candidate'=>true,'available'=>false,'colorable'=>false,'svg'=>'','url'=>''];
    return ['version'=>cra1_icons_version(),'icons'=>$items,'source'=>'online'];
}
/** Max four concurrent downloads, four seconds each, no implicit retries. */
function cra1_icons_online_previews(array $ids): array {
    if(count($ids)>4)throw new InvalidArgumentException('每次最多补充四个预览');$dir=cra1_icons_root().'/runtime/cra1_icons_preview';if(!is_dir($dir))@mkdir($dir,0750,true);$mh=curl_multi_init();$handles=[];$out=[];
    foreach(array_unique($ids) as $id) {
        if(!is_string($id)||!preg_match('/^[a-z0-9-]+:[a-z0-9-]+$/',$id))continue;
        $local=cra1_icons_resolve($id);if(!empty($local['available'])){$out[]=$local;continue;}
        $temp=$dir.'/'.str_replace(':','-',$id).'.svg';if(is_file($temp)){ $d=cra1_icons_file_descriptor($id,'',$temp);$d['source']='在线预览';$d['candidate']=true;$out[]=$d;continue; }
        $ch=curl_init('https://api.iconify.design/'.str_replace(':','/',$id).'.svg');curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>4,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_USERAGENT=>'CRA1-Icon-Suite/1']);curl_multi_add_handle($mh,$ch);$handles[]=['id'=>$id,'ch'=>$ch,'file'=>$temp];
    }
    do { $status=curl_multi_exec($mh,$running);if($running)curl_multi_select($mh,0.1); } while($running&&$status===CURLM_OK);
    foreach($handles as $h) {
        $raw=curl_multi_getcontent($h['ch']);$svg=curl_getinfo($h['ch'],CURLINFO_HTTP_CODE)===200?cra1_icons_sanitize_svg((string)$raw):'';
        if($svg!=='') { $tmp=$h['file'].'.'.bin2hex(random_bytes(4));file_put_contents($tmp,$svg,LOCK_EX);rename($tmp,$h['file']);$d=cra1_icons_file_descriptor($h['id'],'',$h['file']);$d['source']='在线预览';$d['candidate']=true;$out[]=$d; }
        else $out[]=['id'=>$h['id'],'label'=>$h['id'],'source'=>'在线预览失败','available'=>false,'colorable'=>false,'candidate'=>true,'svg'=>'','url'=>''];
        curl_multi_remove_handle($mh,$h['ch']);curl_close($h['ch']);
    }curl_multi_close($mh);return $out;
}
function cra1_icons_import(string $id): array {
    $d=cra1_icons_resolve($id);if(!empty($d['available']))return $d;
    if(!preg_match('/^[a-z0-9-]+:[a-z0-9-]+$/',$id))throw new InvalidArgumentException('图标值不可用');
    $temp=cra1_icons_root().'/runtime/cra1_icons_preview/'.str_replace(':','-',$id).'.svg';if(!is_file($temp))throw new InvalidArgumentException('请先成功加载图标预览');$svg=cra1_icons_sanitize_svg((string)file_get_contents($temp));if($svg==='')throw new InvalidArgumentException('图标预览不可用');
    $dir=__DIR__.'/icons/imported';if(!is_dir($dir))mkdir($dir,0755,true);$target=$dir.'/'.$id.'.svg';$tmp=$target.'.'.bin2hex(random_bytes(4));file_put_contents($tmp,$svg,LOCK_EX);rename($tmp,$target);return cra1_icons_resolve($id);
}
/** Only temporary previews can be evicted. Persistent and pre-imported files are read-only. */
function cra1_icons_clear_temporary(int $olderThan=86400): int {
    $count=0;foreach(glob(cra1_icons_root().'/runtime/cra1_icons_preview/*.svg')?:[] as $f)if(is_file($f)&&filemtime($f)<time()-$olderThan&&unlink($f))$count++;return $count;
}
function cra1_icon_art(string $spec,string $context='website'): string {
    $d=cra1_icons_resolve($spec,$context);if(empty($d['available']))return '';
    if(!empty($d['svg']))return '<span class="cui-icon-art" aria-hidden="true">'.$d['svg'].'</span>';
    $url=htmlspecialchars($d['url'],ENT_QUOTES,'UTF-8');
    return '<span class="cui-icon-art" aria-hidden="true"><img src="'.$url.'" alt="" decoding="async"></span>';
}
function cra1_icon_row_attrs(string $line,bool $tile=true): string { return cra1_icon_style_attrs(cra1_icon_row_style($line),$tile); }

function cra1_icon_validate_change($value,$old,string $context='website'): void {
    if(!is_string($value))throw new InvalidArgumentException('图标值必须为文字');
    if($value===$old||trim($value)==='')return;
    if(strlen($value)>2000)throw new InvalidArgumentException('图标值过长');
    $d=cra1_icons_resolve($value,$context);if(empty($d['available']))throw new InvalidArgumentException('新图标不可用，请先选择并确认预览');
}
function cra1_icons_validate_nodes(array $nodes,array $oldNodes,string $context='member-sidebar'): void {
    $before=[];$flatten=function($list)use(&$flatten,&$before){foreach($list as $n){$before[$n['id']??'']=$n;$flatten($n['children']??[]);}};$flatten($oldNodes);
    $walk=function($list)use(&$walk,$before,$context){foreach($list as $n){cra1_icon_validate_change($n['icon']??'', $before[$n['id']??'']['icon']??null,$context);if(isset($n['icon_style']))cra1_icon_style_clean($n['icon_style']);$walk($n['children']??[]);}};$walk($nodes);
}
function cra1_icons_validate_row_text(string $value,string $old,int $iconColumn): void {
    if($value===$old)return;$oldIcons=[];
    foreach(preg_split('/\r?\n/',$old) as $line){$p=cra1_icon_row_parts($line)['parts'];if(isset($p[$iconColumn]))$oldIcons[$p[$iconColumn]]=true;}
    foreach(preg_split('/\r?\n/',$value) as $line){
        $parts=explode('|',$line);$tail=end($parts);
        if(strpos((string)$tail,'@icon-style:v1:')===0){$d=json_decode((string)base64_decode(strtr(substr($tail,15),'-_','+/'),true),true);if(!is_array($d))throw new InvalidArgumentException('图标样式尾列格式不正确');foreach($d as $style)cra1_icon_style_clean($style);}
        $p=cra1_icon_row_parts($line)['parts'];$icon=$p[$iconColumn]??'';cra1_icon_validate_change($icon,isset($oldIcons[$icon])?$icon:null);
    }
}

}
