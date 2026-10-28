<?php
declare(strict_types=1);
namespace CRA1\Theme\Storage;
use PDO;
use CRA1ThemeSecurity;
use stdClass;
use Throwable;
use RuntimeException;
use InvalidArgumentException;
use DOMDocument;
use DOMElement;
use DOMComment;
use DOMProcessingInstruction;
use DOMText;
use DOMNode;
use CRA1ThemePublicProjection;

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }
/** Composite editors reuse the existing locked stores; no sequential saves. */
trait ThemeEditorStore
{
    private function editor(string $domain,string $id): array
    {
        $key=$domain==='website'?$id:$domain.':'.$id;
        $editor=$this->catalog['editors'][$key]??null;
        if(!is_array($editor)||$editor['domain']!==$domain)throw new InvalidArgumentException('未找到对应配置页');
        return $editor;
    }
    private function pageEditorValues(array $editor,array $raw): array
    {
        $pk=$editor['pageKey'];$cfg=cra1_page_content_config($pk,$this->resolved($raw));
        $doc=$this->document($raw,'page_content_overrides_json');$overrides=$doc['pages'][$pk]['values']??[];
        $out=[];
        foreach($editor['fields'] as $f){
            $visualDefaults=$f['visual']['defaults']??[];
            foreach($f['visual']['legacyCopy']??[] as$column=>$binding){$map=cra1_copy_effective_map($pk,$binding['module'],$cfg);$visualDefaults[$column]=$map[$binding['key']]??($visualDefaults[$column]??'');}
            foreach($f['keys'] as $key){
                if(array_key_exists($key,$overrides)){
                    $value=$overrides[$key];
                    if(($f['visual']['widget']??'')==='copy'){
                        $pageConfig=$cfg;$pageConfig[$key]=$value;$pageConfig['_page_explicit_fields']=array_keys($overrides);
                        $value=cra1_copy_editor_text($pk,substr($key,5,-5),$pageConfig);
                    }
                    if(($f['visual']['widget']??'')==='single-row'&&$value==='')$value=implode('|',array_map(static function($c)use($pk){return $c['key']==='page'?$pk:'';},$f['cols']));
                    $out[$key]=$value;continue;
                }
                $value=$cfg[$key]??'';
                $legacy=$f['legacyPageKey']??null;
                if($legacy && trim((string)($cfg[$legacy]??''))!==''){
                    $value=$cfg[$legacy];
                    if($f['adapter']==='page-rows'){
                        $value=implode("\n",array_map(static function($l)use($pk){preg_match('/^([!>]*)(.*)$/',$l,$m);return $m[1].$pk.'|'.$m[2];},preg_split('/\r?\n/',(string)$value)));
                    }
                }elseif($f['adapter']==='page-rows'){
                    $lines=[];$exact=[];$shared=[];
                    foreach(preg_split('/\r?\n/',(string)$value)as$line){
                        if(trim($line)==='')continue;$target=$this->rowPage($line);
                        if($key==='page_hero_rows_text'&&$target==='')continue;
                        if(!cra1_row_targets_page($target,$pk))continue;
                        $normalized=preg_replace('/^([!>]*)[^|]*\|/','$1'.$pk.'|',$line,1);
                        $lines[]=$normalized;if($target===$pk)$exact[]=$normalized;else$shared[]=$normalized;
                    }
                    // Single-value readers take the first visible row. Keep the
                    // other rows so editing it preserves hidden historical data.
                    if(($f['visual']['widget']??'')==='single-row')$lines=array_merge($exact,$shared);
                    $value=implode("\n",$lines);
                }
                if(($f['visual']['widget']??'')==='rows'&&trim((string)$value)===''&&!empty($f['visual']['fallbackRows']))$value=$f['visual']['fallbackRows'];
                if(($f['visual']['widget']??'')==='copy'){
                    $value=cra1_copy_editor_text($pk,substr($key,5,-5),$cfg);
                }
                if($value==='' && ($f['visual']['widget']??'')==='single-row'){
                    $v=$visualDefaults;
                    foreach($f['visual']['legacyKeys']??[] as$column=>$legacyKey) $v[$column]=$cfg[$legacyKey]??($v[$column]??'');
                    if($key==='page_hero_rows_text'&&strpos($pk,'solution/')===0){$industry=substr($pk,9);$v['title']=$cfg['sol_ind_'.$industry.'_hero_title']??($v['title']??'');$v['desc']=$cfg['sol_ind_'.$industry.'_hero_desc']??($v['desc']??'');}
                    if($v){$row=[];foreach($f['cols']as$c)$row[]=$c['key']==='page'?$pk:($v[$c['key']]??'');$value=implode('|',$row);}
                }
                if(($f['visual']['widget']??'')==='single-row'){
                    $lines=preg_split('/\r?\n/',(string)$value);
                    foreach($lines as$i=>$line){if($line===''||strpos(ltrim($line),'!')===0)continue;$row=explode('|',$line);foreach($f['cols']as$n=>$c)if(trim((string)($row[$n]??''))===''&&isset($visualDefaults[$c['key']]))$row[$n]=$visualDefaults[$c['key']];$lines[$i]=implode('|',$row);break;}
                    $value=implode("\n",$lines);
                }
                $out[$key]=$value;
            }
        }
        return $out;
    }

    /** Import is a proposal; only the editor's Save commits it. */
    public function editorImport(string $mode='merge',?array $draftNodes=null,?int $draftShape=null): array
    {
        $catalog=$this->member->readSystemCatalog();if(!empty($catalog['error']))throw new RuntimeException($catalog['error']);
        $current=$this->member->read();
        if($draftNodes!==null)$current['sidebar']['nodes']=$draftNodes;
        if($draftShape!==null)$current['sidebar']['shape']=$draftShape;
        $proposal=$this->member->proposeImport($catalog,$mode,$current['sidebar']);
        return ['status'=>200,'msg'=>$proposal['added']?'菜单已应用到草稿，保存后生效':'没有新增菜单','data'=>$proposal];
    }
    private function editorPayload(array $editor,array $raw): array
    {
        $values=[];$revisions=[];$scopes=[];$resolved=[];
        foreach($editor['sections']as$name=>$id){
            $scope=$this->scope($editor['domain'],$id);
            if($name==='content'&&$editor['domain']==='website'&&$editor['kind']==='page'){
                $v=$this->pageEditorValues($editor,$raw);$scope['fields']=$editor['fields'];
            }else{$part=$this->payload($scope,$raw);$v=$part['values'];$resolved[$name]=$part['resolved']??[];}
            $values[$name]=$v;$revisions[$name]=theme_workspace_revision($v);$scopes[$name]=$scope;
        }
        $defaults=[];
        if(isset($editor['pageKey'])){$unoverridden=$raw;unset($unoverridden['page_content_overrides_json']);$defaults=$this->pageEditorValues($editor,$unoverridden);}
        $overlay=isset($editor['pageKey'])?$this->document($raw,'page_content_overrides_json'):[];
        return ['editorId'=>$editor['id'],'editor'=>$editor,'scope'=>['label'=>$editor['label']],'scopes'=>$scopes,'values'=>$values,
            'revision'=>theme_workspace_revision($values),'revisions'=>$revisions,'resolved'=>$resolved,'defaults'=>$defaults,
            'overriddenFields'=>isset($editor['pageKey'])?array_keys($overlay['pages'][$editor['pageKey']]['values']??[]):[],
            'contentSources'=>$editor['domain']==='website'&&$editor['kind']==='public'?$this->publicContentSources($editor,$raw):[],
            'version'=>$raw['version']??null];
    }
    public function editorGet(string $domain,string $id): array
    {
        $editor=$this->editor($domain,$id);$raw=$this->editorRead($domain);
        $data=$this->editorPayload($editor,$raw);
        if($domain==='website'&&$id==='header'){
            $this->seoResolve('home',$this->resolved($raw),[]);
            $data['systemInfo']=['siteName'=>$this->siteName,'settingsUrl'=>defined('DIR_ADMIN')?'/'.DIR_ADMIN.'/configuration_system.htm':null];
        }
        return ['status'=>200,'msg'=>'已读取','data'=>$data];
    }
    /** Describe actual field inheritance, including untouched template page data. */
    private function publicContentSources(array $editor,array $raw): array
    {
        $cfg=$this->resolved($raw);$doc=$this->document($raw,'page_content_overrides_json');$out=[];
        foreach($editor['sections'] as$section=>$scopeId){
            $scope=$this->scope('website',$scopeId);
            if($scope['kind']!=='shared')continue;
            foreach($scope['fields']as$f){
                if(($f['adapter']!=='shared-rows'&&!in_array($f['moduleId']??'', ['price_slider','link_tiles'],true))||$f['adapter']==='visibility-default')continue;
                $key=$f['key'];$entries=[];
                foreach($scope['affectedPageKeys']as$pk){
                    $kind='public';$v=$doc['pages'][$pk]['values']??[];$pageField=null;
                    foreach($this->catalog['editors']['page:'.$pk]['fields']??[]as$pf)if($pf['key']===$key){$pageField=$pf;break;}
                    if(!$pageField)continue;
                    if(array_key_exists($key,$v))$kind='page';
                    else{
                        $legacy=$pageField['legacyPageKey']??null;
                        if($legacy&&trim((string)($v[$legacy]??$cfg[$legacy]??''))!=='')$kind=array_key_exists($legacy,$raw)||array_key_exists($legacy,$v)?'page':'template';
                        elseif($f['adapter']==='shared-rows'&&array_key_exists($key,$raw)){
                            foreach(preg_split('/\r?\n/',(string)($cfg[$key]??''))as$line){
                                if(trim($line)!==''&&strpos(ltrim($line),'!')!==0&&$this->rowPage($line)===$pk){$kind=array_key_exists($key,$raw)?'page':'template';break;}
                            }
                        }
                    }
                    $entries[]=['pageKey'=>$pk,'name'=>$this->catalog['pages'][$pk]['name']??$pk,'kind'=>$kind];
                }
                $out[$section][$key]=$entries;
            }
        }
        return $out;
    }
    private function editorRead(string $domain): array
    {
        return $domain==='website'?self::readJson($this->configFile):($domain==='member'?$this->member->read():$this->cart->read());
    }
    private function applyEditor(array $editor,array $raw,array $patch): array
    {
        $this->validateKeys($patch,array_keys($editor['sections']));
        foreach($patch as$name=>$values){
            if(!is_array($values))throw new InvalidArgumentException('配置内容格式不正确');
            if($name==='content'&&$editor['domain']==='website'&&$editor['kind']==='page'){
                $allowed=[];$defs=[];foreach($editor['fields']as$f)foreach($f['keys']as$k){$allowed[]=$k;$defs[$k]=$f;}
                $this->validateKeys($values,$allowed);$doc=$this->document($raw,'page_content_overrides_json');$doc+=['schema'=>1,'pages'=>[]];$pk=$editor['pageKey'];
                foreach($values as$key=>$value){
                    if($value===null){unset($doc['pages'][$pk]['values'][$key]);continue;}
                    if(!is_scalar($value)||strlen((string)$value)>1048576)throw new InvalidArgumentException(($defs[$key]['label']??'内容').'格式不正确');
                    $value=(string)$value;
                    if(function_exists('config_normalize_value')){[$valid,$normal]=config_normalize_value($key,$value);if(!$valid)throw new InvalidArgumentException(($defs[$key]['label']??'内容').'：'.$normal);$value=$normal;}
                    if($defs[$key]['adapter']==='page-rows')foreach(preg_split('/\r?\n/',$value)as$line)if(trim($line)!==''&&$this->rowPage($line)!==$pk)throw new InvalidArgumentException('条目不属于当前页面');
                    $currentValues=$this->pageEditorValues($editor,$raw);
                    $this->validateIconField((string)$key,(string)$value,(string)($currentValues[$key]??''));
                    $doc['pages'][$pk]['values'][$key]=$value;
                    $legacy=$defs[$key]['legacyPageKey']??null;
                    if($legacy && in_array($key,[$defs[$key]['key']],true)) unset($doc['pages'][$pk]['values'][$legacy]);
                }
                $raw['page_content_overrides_json']=$this->encode($doc);
            }else{
                $scope=$this->scope($editor['domain'],$editor['sections'][$name]);
                $raw=$editor['domain']==='website'?$this->applyWebsite($scope,$raw,$values):array_replace($raw,$this->applyDomain($scope,$raw,$values));
            }
        }
        return $raw;
    }
    public function editorSave(string $domain,string $id,array $expected,array $patch,string $operator): array
    {
        $editor=$this->editor($domain,$id);if(!$patch)throw new InvalidArgumentException('没有需要保存的修改');
        $check=function($raw)use($editor,$expected){$payload=$this->editorPayload($editor,$raw);foreach($editor['sections']as$name=>$scope)if(!isset($expected[$name])||!is_string($expected[$name])||!hash_equals($payload['revisions'][$name],$expected[$name]))return $payload;return null;};
        if($domain==='website'){
            $lock=fopen($this->configFile.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('存储锁不可用');
            try{$raw=self::readJson($this->configFile);$conflict=$check($raw);if($conflict)return ['status'=>409,'msg'=>'当前页面已有更新，你的修改已保留','data'=>$conflict];$next=$this->applyEditor($editor,$raw,$patch);if($next!==$raw)$this->writeMain($next);return ['status'=>200,'msg'=>'当前配置页已保存','data'=>$this->editorPayload($editor,$next)];}
            finally{flock($lock,LOCK_UN);fclose($lock);}
        }
        $raw=$this->editorRead($domain);$conflict=$check($raw);if($conflict)return ['status'=>409,'msg'=>'当前页面已有更新，你的修改已保留','data'=>$conflict];
        $store=$domain==='member'?$this->member:$this->cart;
        $result=$store->save([],$operator,0,['expectedRevision'=>theme_workspace_revision($this->editorPayload($editor,$raw)['values']),
            'project'=>function($r)use($editor){return $this->editorPayload($editor,$r)['values'];},
            'merge'=>function($r)use($editor,$patch){$next=$this->applyEditor($editor,$r,$patch);return array_intersect_key($next,array_flip(['appearance','sidebar','content','custom_code']));}]);
        if($result['status']===409)return ['status'=>409,'msg'=>$result['msg'],'data'=>$this->editorPayload($editor,$this->editorRead($domain))];
        if($result['status']!==200)return $result;
        $payload=$this->editorPayload($editor,$result['data']['config']);$payload['snapshot_ok']=$result['data']['snapshot_ok'];
        return ['status'=>200,'msg'=>$result['msg'],'data'=>$payload];
    }
    public function preview(string $domain,string $id,array $patch,array $related=[]): array
    {
        $editor=$this->editor($domain,$id);$raw=$this->editorRead($domain);
        foreach($related as$relatedId=>$p){$e=$this->editor($domain,(string)$relatedId);if($e['kind']!=='public')throw new InvalidArgumentException('预览只能合并本主题公共设置');$raw=$this->applyEditor($e,$raw,$p);}
        $raw=$this->applyEditor($editor,$raw,$patch);$dir=$this->root.'/runtime/cra1_theme/previews';
        if($domain==='member')$raw=$this->member->normalizedPreview($raw);
        if($domain==='cart')$raw=$this->cart->normalizedPreview($raw);
        if(!is_dir($dir)&&!mkdir($dir,0750,true))throw new RuntimeException('预览目录不可写');
        foreach(glob($dir.'/*.json')?:[]as$file)if(filemtime($file)<time()-900)@unlink($file);
        $files=glob($dir.'/*.json')?:[];if(count($files)>200){usort($files,static function($a,$b){return filemtime($a)<=>filemtime($b);});foreach(array_slice($files,0,count($files)-200)as$file)@unlink($file);}
        $token=bin2hex(random_bytes(32));$doc=['domain'=>$domain,'editorId'=>$id,'pageKey'=>$editor['pageKey']??null,'expires'=>time()+900,'config'=>$raw,'owner_id'=>(int)(theme_actor()['id']??0),'session_hash'=>CRA1ThemeSecurity::hashToken((string)($_SESSION['security_token']??'')),'message_nonce'=>bin2hex(random_bytes(24))];
        if(file_put_contents($dir.'/'.$token.'.json',$this->encode($doc))===false)throw new RuntimeException('无法生成预览');@chmod($dir.'/'.$token.'.json',0640);
        $base=basename(dirname($_SERVER['SCRIPT_NAME']??'/cra1admin/index.php'));
        $url='/'.$base.'/index.php?r=preview&__theme_preview='.$token;
        if($domain==='member'&&$id==='server')$url.='&id=1';
        if($domain==='cart'&&$id==='orderresult')$url.='&status=success&order_id=1';
        return ['status'=>200,'msg'=>'预览已生成','data'=>['url'=>$url,'expires'=>$doc['expires'],'nonce'=>$doc['message_nonce']]];
    }
}
