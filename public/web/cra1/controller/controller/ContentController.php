<?php
/**
 * 酷锐A1主题控制器 AJAX 接口
 * 路由（系统内置，带 CheckAdmin + ParamFilter 中间件）：
 *   GET /<系统后台目录>/v1/template/cra1/content/get
 *   save/reset 旧写接口仅返回迁移提示；配置修改使用独立主题后台。
 */
namespace template\cra1\controller\controller;
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}


use template\cra1\controller\Cra1;

if (!function_exists('cra1_text_urls_ok')) {

    /** 多行文本中的链接白名单校验：含协议或协议相对的段必须符合 /、https://、tel:、mailto: */
    function cra1_text_urls_ok($value)
    {
        foreach (preg_split('/\r?\n/', (string) $value) as $line) {
            $line = trim((string) $line);
            // 行首 ! 为「隐藏」标记，校验时剥离
            if ($line !== '' && $line[0] === '!') {
                $line = trim(substr($line, 1));
            }
            foreach (explode('|', $line) as $seg) {
                $seg = trim($seg);
                if ($seg === '') {
                    continue;
                }
                $hasScheme = (bool) preg_match('#^[a-z][a-z0-9+.\-]*:#i', $seg);
                // 图标代码豁免（mdi:headset / material-symbols:rocket / icons8:headset）：
                // 形如「前缀:名称」且不含斜杠/点/空格/@ 的段是图标键而非链接，
                // 前缀不属于真实 URL 协议时跳过链接校验
                if ($hasScheme
                    && preg_match('~^[a-z][a-z0-9-]{1,30}:[a-z0-9][a-z0-9-]{0,60}$~i', $seg)
                    && !preg_match('~^(?:https?|tel|mailto|ftp|ftps|javascript|data|vbscript|file|blob|sms|magnet|ws|wss)$~i', strstr($seg, ':', true))) {
                    continue;
                }
                $isProtocolRelative = (bool) preg_match('#^//#', $seg);
                if (($hasScheme || $isProtocolRelative) && !cra1_url_ok($seg)) {
                    return false;
                }
            }
        }
        return true;
    }
}

class ContentController
{
    public function get()
    {
        return json([
            'status' => 200,
            'msg'    => 'success',
            'data'   => (new CRA1())->resolvedConfig(),
            'read_only'=>true,
        ]);
    }

    public function reset() { return json(['status'=>403,'msg'=>'旧主题管理页已改为只读，请使用独立主题后台。','code'=>'LEGACY_READ_ONLY'],403); }
    public function save() { return json(['status'=>403,'msg'=>'旧主题管理页已改为只读，请使用独立主题后台。','code'=>'LEGACY_READ_ONLY'],403); }
}
