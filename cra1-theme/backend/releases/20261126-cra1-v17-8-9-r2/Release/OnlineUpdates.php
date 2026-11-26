<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;

/** Public release discovery and streaming downloads; application uses the ordinary updater. */
final class OnlineUpdates
{
    public const REPOSITORY='zbxh/cra1-theme-public';
    private const API='https://api.github.com/repos/'.self::REPOSITORY;
    private $transport;
    private string $prefix;

    public function __construct(?callable $transport=null,string $prefix='')
    {
        $this->transport=$transport??[self::class,'request'];
        $this->prefix=OnlineUpdateSettings::prefix($prefix);
    }

    public function latest(array $current,bool $includeTest): array
    {
        $releases=$this->json(self::API.'/releases?per_page=100',true);$choices=[];
        foreach($releases as $row){
            if(!is_array($row)||!empty($row['draft'])||(!$includeTest&&!empty($row['prerelease'])))continue;
            $release=self::release($row);
            if($release!==null)$choices[]=$release;
        }
        usort($choices,static function($a,$b){return version_compare(self::number($b['version']),self::number($a['version']));});
        $latest=$choices[0]??null;
        return ['current_version'=>$current['version']??null,'include_test'=>$includeTest,'checked_at'=>time(),
            'update_available'=>$latest!==null&&self::newer($latest['version'],$current),'latest'=>$latest===null?null:self::publicRelease($latest)];
    }

    public function download(string $version,string $destination,array $current): array
    {
        if(!self::version($version))throw new \InvalidArgumentException('版本信息无效，请重新检查最新版本');
        if(!self::newer($version,$current))throw new \InvalidArgumentException('当前已是此版本或更新版本，无需重复更新');
        // The browser supplies a version, never a repository, URL or filesystem path.
        $release=self::release($this->json(self::API.'/releases/tags/'.$version));
        if($release===null||$release['version']!==$version)throw new \InvalidArgumentException('该版本的安装包暂不可用，请重新检查最新版本');
        \CRA1\Theme\Files::noLinks($destination);
        if(file_exists($destination)||is_link($destination))throw new \InvalidArgumentException('安装包暂存位置已有同名文件，原文件未覆盖，请重新检查更新');
        $file=\CRA1\Theme\Failure::attempt('保存下载的安装包',$destination,static function()use($destination){return fopen($destination,'xb');},0600);
        $bytes=0;$complete=false;
        try{
            chmod($destination,0600);
            $this->fetch($release['download_url'],static function(string $chunk)use($file,$destination,&$bytes){
                $length=strlen($chunk);\CRA1\Theme\Failure::attempt('写入文件',$destination,static function()use($file,$chunk,$length){return fwrite($file,$chunk)===$length;},0600);
                $bytes+=$length;
            },LocalPackages::MAX_BYTES,75);
            if(!fflush($file))throw new \InvalidArgumentException('安装包保存未完成，请重新下载');
            if($bytes!==$release['bytes'])throw new \InvalidArgumentException('安装包下载不完整，请重试或手动上传安装包');
            $digest=hash_file('sha256',$destination);
            if($release['sha256']!==null&&!hash_equals($release['sha256'],$digest))throw new \InvalidArgumentException('安装包下载校验未通过，请重新检查最新版本后重试');
            $complete=true;
            return self::publicRelease($release)+['sha256'=>$digest];
        }finally{
            fclose($file);
            if(!$complete&&is_file($destination))unlink($destination);
        }
    }

    private static function version(string $version): bool {return preg_match('/^v\d+\.\d+(?:\.\d+)?$/D',$version)===1;}
    private static function number(string $version): string
    {
        $number=substr($version,1);return substr_count($number,'.')===1?$number.'.0':$number;
    }
    private static function newer(string $version,array $current): bool
    {
        $installed=(string)($current['version']??'');
        return !self::version($installed)||version_compare(self::number($version),self::number($installed),'>');
    }
    private static function publicRelease(array $release): array
    {
        return array_intersect_key($release,array_flip(['version','release_channel','published_at','notes','release_url','bytes']));
    }
    private static function release(array $row): ?array
    {
        $version=(string)($row['tag_name']??'');
        if(!self::version($version)||!empty($row['draft'])||empty($row['published_at']))return null;
        $name='CRA1-theme-'.$version.'-install.zip';
        $url='https://github.com/'.self::REPOSITORY.'/releases/download/'.$version.'/'.$name;
        foreach($row['assets']??[] as $asset){
            if(!is_array($asset)||($asset['name']??'')!==$name||($asset['browser_download_url']??'')!==$url||($asset['state']??'')!=='uploaded')continue;
            $bytes=(int)($asset['size']??0);if($bytes<1||$bytes>LocalPackages::MAX_BYTES)continue;
            $digest=$asset['digest']??null;
            if($digest!==null&&!preg_match('/^sha256:([a-f0-9]{64})$/D',(string)$digest))continue;
            $notes=trim((string)($row['body']??''));preg_match('/^.{0,12000}/us',$notes,$short);
            return ['version'=>$version,'release_channel'=>!empty($row['prerelease'])?'test':'stable',
                'published_at'=>(string)$row['published_at'],'notes'=>$short[0]??'',
                'release_url'=>'https://github.com/'.self::REPOSITORY.'/releases/tag/'.$version,
                'download_url'=>$url,'bytes'=>$bytes,'sha256'=>$digest===null?null:substr($digest,7)];
        }
        return null;
    }
    private function json(string $url,bool $list=false): array
    {
        $deadline=microtime(true)+15;$attempts=$this->prefix===''?[false]:[true,false];$failure=null;
        foreach($attempts as$accelerated){
            try{
                $remaining=(int)ceil($deadline-microtime(true));
                if($remaining<1)throw new \InvalidArgumentException('连接 GitHub 超时，请重试或手动上传安装包');
                $body='';$this->fetch($url,static function(string $chunk)use(&$body){$body.=$chunk;},2*1024*1024,$accelerated?min(8,$remaining):$remaining,$accelerated);
                $data=json_decode($body,true);
                if(!is_array($data)||json_last_error()!==JSON_ERROR_NONE||substr(ltrim($body),0,1)!==($list?'[':'{')||($list?$data!==array_values($data):!is_string($data['tag_name']??null))){
                    throw new \InvalidArgumentException('GitHub 返回的版本信息无法读取，请稍后重试；也可手动上传安装包');
                }
                return $data;
            }catch(\InvalidArgumentException $error){$failure=$error;}
        }
        if($this->prefix!=='')throw new \InvalidArgumentException('加速地址和 GitHub 直连均未能获取版本信息，请检查加速前缀或稍后重试；也可手动上传安装包',0,$failure);
        throw $failure;
    }
    private function address(string $url): string
    {
        return $this->prefix.(strpos($this->prefix,'?')===false?$url:rawurlencode($url));
    }
    private function fetch(string $url,callable $write,int $limit,int $timeout,bool $usePrefix=true): void
    {
        self::url($url);
        $accelerated=$usePrefix&&$this->prefix!=='';
        if($accelerated)$url=$this->address($url);
        $received=0;$deadline=microtime(true)+$timeout;
        $sink=static function(string $chunk)use($write,$limit,&$received){
            $received+=strlen($chunk);
            if($received>$limit)throw new \InvalidArgumentException('远程文件超过允许大小，请使用正式主题安装包');
            $write($chunk);
        };
        for($redirects=0;$redirects<=5;$redirects++){
            self::url($url,$accelerated);
            $remaining=(int)ceil($deadline-microtime(true));
            if($remaining<1)throw new \InvalidArgumentException('连接 GitHub 超时，请重试或手动上传安装包');
            $response=($this->transport)($url,$sink,$limit,$remaining);
            $status=(int)($response['status']??0);$headers=array_change_key_case($response['headers']??[],CASE_LOWER);
            if($status===200)return;
            if(in_array($status,[301,302,303,307,308],true)&&isset($headers['location'])){
                $next=(string)$headers['location'];
                $p=parse_url($url);$origin=$p['scheme'].'://'.$p['host'].(isset($p['port'])?':'.$p['port']:'');
                if(strpos($next,'//')===0)$next=$p['scheme'].':'.$next;
                elseif(strpos($next,'/')===0)$next=$origin.$next;
                elseif(strpos($next,'?')===0)$next=$origin.($p['path']??'/').$next;
                elseif(!preg_match('~^[a-z][a-z0-9+.-]*:~i',$next))$next=$origin.rtrim(dirname($p['path']??'/'),'/').'/'.$next;
                // A proxy may expose its own redirect/CDN, or return an upstream
                // GitHub redirect. Keep GitHub destinations on the chosen route.
                if($accelerated){
                    $target=parse_url($next);$host=strtolower((string)($target['host']??''));
                    if(in_array($host,self::hosts(),true))$next=$this->address($next);
                }
                $url=$next;continue;
            }
            if($status===403||$status===429)throw new \InvalidArgumentException(($accelerated?'加速服务':'GitHub').'暂时限制了版本查询或下载，请稍后重试；也可手动上传安装包');
            if($status===404)throw new \InvalidArgumentException($accelerated?'加速服务暂未提供该版本或安装包，请检查加速前缀或手动上传安装包':'该版本或安装包暂不可用，请重新检查最新版本');
            throw new \InvalidArgumentException('连接 GitHub 未完成（HTTP '.$status.'），请稍后重试；也可手动上传安装包');
        }
        throw new \InvalidArgumentException('安装包下载跳转未完成，请重试或手动上传安装包');
    }
    private static function hosts(): array {return ['api.github.com','github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'];}
    private static function url(string $url,bool $custom=false): void
    {
        $p=parse_url($url);
        if(!is_array($p)||empty($p['host'])||!in_array(strtolower((string)($p['scheme']??'')),$custom?['http','https']:['https'],true)
            ||(!$custom&&(!in_array(strtolower((string)($p['host']??'')),self::hosts(),true)||(isset($p['port'])&&$p['port']!==443)))
            ||isset($p['user'])||isset($p['pass'])||isset($p['fragment'])||preg_match('/[\x00-\x20\x7f]/',$url))throw new \InvalidArgumentException('安装包连接地址无效，请检查加速前缀，或从主题 GitHub 发布页手动下载安装包');
    }
    /** No site identity, credentials, GitHub token or customer configuration is sent. */
    private static function request(string $url,callable $write,int $limit,int $timeout): array
    {
        if(!function_exists('curl_init'))throw new \InvalidArgumentException('服务器未启用 cURL，暂不能在线更新；仍可手动上传安装包');
        $headers=[];$status=0;$tooLarge=false;$failure=null;
        $curl=curl_init($url);
        curl_setopt_array($curl,[CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>$timeout,
            CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS|CURLPROTO_HTTP,
            CURLOPT_USERAGENT=>'CRA1-Theme-Updater',CURLOPT_HTTPHEADER=>['Accept: application/vnd.github+json','X-GitHub-Api-Version: 2022-11-28'],
            CURLOPT_HEADERFUNCTION=>static function($handle,string $line)use(&$headers,&$status,&$tooLarge,$limit){
                if(preg_match('~^HTTP/\S+\s+(\d+)~i',$line,$match)){$status=(int)$match[1];$headers=[];}
                elseif(strpos($line,':')!==false){[$key,$value]=explode(':',$line,2);$headers[strtolower(trim($key))]=trim($value);}
                if($status===200&&isset($headers['content-length'])&&(int)$headers['content-length']>$limit){$tooLarge=true;return 0;}
                return strlen($line);
            },CURLOPT_WRITEFUNCTION=>static function($handle,string $chunk)use($write,&$status,&$failure){
                if($status!==200)return strlen($chunk);
                try{$write($chunk);return strlen($chunk);}catch(\Throwable $error){$failure=$error;return 0;}
            }]);
        try{
            $ok=curl_exec($curl);$code=curl_errno($curl);
            if($failure!==null)throw $failure;
            if($tooLarge)throw new \InvalidArgumentException('远程文件超过允许大小，请使用正式主题安装包');
            if($ok===false){
                if($code===CURLE_OPERATION_TIMEDOUT)throw new \InvalidArgumentException('连接更新服务超时，请重试或手动上传安装包');
                if(in_array($code,[CURLE_SSL_CONNECT_ERROR,CURLE_PEER_FAILED_VERIFICATION],true))throw new \InvalidArgumentException('服务器未能与更新服务建立安全连接，请检查服务器证书环境，或手动上传安装包');
                throw new \InvalidArgumentException('服务器暂时无法连接 GitHub 或加速服务，请检查外网连接与加速前缀，或手动上传安装包');
            }
            return ['status'=>(int)curl_getinfo($curl,CURLINFO_HTTP_CODE),'headers'=>$headers];
        }finally{curl_close($curl);}
    }
}
