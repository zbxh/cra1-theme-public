<?php
declare(strict_types=1);
namespace CRA1\Theme\Release;
use CRA1\Theme\Files;

/** Installation-local connection settings; never included in a release or public snapshot. */
final class OnlineUpdateSettings
{
    private string $file;

    public function __construct(string $root)
    {
        $this->file=rtrim($root,'/').'/runtime/cra1_theme/distribution/online-settings.json';
    }

    public static function prefix(string $value): string
    {
        $value=trim($value);
        if($value==='')return '';
        $url=parse_url($value);
        if(strlen($value)>2048||preg_match('/[\x00-\x20\x7f]/',$value)||!is_array($url)||empty($url['host'])
            ||!in_array(strtolower((string)($url['scheme']??'')),['http','https'],true)
            ||isset($url['user'])||isset($url['pass'])||isset($url['fragment'])){
            throw new \InvalidArgumentException('请填写完整的 GitHub 加速链接前缀，例如 https://加速域名/；留空则直连');
        }
        return isset($url['query'])?$value:rtrim($value,'/').'/';
    }

    public function get(): array
    {
        $data=Files::json($this->file,true);
        return ['github_prefix'=>self::prefix((string)($data['github_prefix']??''))];
    }

    public function save(string $prefix): array
    {
        $prefix=self::prefix($prefix);
        return Files::locked($this->file.'.lock',function()use($prefix){
            $data=Files::json($this->file,true);
            if(($data['github_prefix']??'')!==$prefix){
                $data['github_prefix']=$prefix;
                Files::putJson($this->file,$data,0600);
            }
            return ['github_prefix'=>$prefix];
        });
    }
}
