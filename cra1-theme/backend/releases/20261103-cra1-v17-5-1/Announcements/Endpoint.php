<?php
declare(strict_types=1);
namespace CRA1\Theme\Announcements;

use CRA1\Theme\Storage\AnnouncementStore;

final class Endpoint
{
    public static function serve(): void
    {
        self::respond(false);
    }

    public static function serveAll(): void
    {
        self::respond(true);
    }

    private static function respond(bool $all): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: private, no-store, max-age=0');
        header('Vary: Authorization, Cookie');
        header('X-Content-Type-Options: nosniff');
        header('X-Robots-Tag: noindex, nofollow');
        try {
            if (($_SERVER['REQUEST_METHOD']??'')!=='POST') { http_response_code(405);header('Allow: POST');throw new \InvalidArgumentException('请求方式不支持'); }
            if ((int)($_SERVER['CONTENT_LENGTH']??0)>8192) throw new \InvalidArgumentException('请求内容过长');
            if (is_file(CRA1_THEME_ROOT.'/runtime/cra1_theme/distribution/pending.json')) throw new \RuntimeException('update pending');
            $raw=(string)file_get_contents('php://input',false,null,0,8193);
            if (strlen($raw)>8192) throw new \InvalidArgumentException('请求内容过长');
            $input=json_decode($raw,true);
            if (!is_array($input)||array_diff(array_keys($input),$all?[]:['theme','path'])) throw new \InvalidArgumentException('通知请求格式不正确');
            $store=new AnnouncementStore(CRA1_THEME_ROOT);
            $member=NativeMember::authenticated(CRA1_THEME_ROOT,(string)($_SERVER['HTTP_AUTHORIZATION']??$_SERVER['REDIRECT_HTTP_AUTHORIZATION']??''));
            if ($all) {
                echo json_encode(['status'=>200,'msg'=>'success','data'=>$store->allPublicPayload(null,$member)+['member_authenticated'=>$member]],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_HEX_TAG|JSON_HEX_AMP|JSON_THROW_ON_ERROR);
                return;
            }
            $theme=$input['theme']??'';$path=$input['path']??'';
            if (!is_string($theme)||!is_string($path)) throw new \InvalidArgumentException('通知页面格式不正确');
            if (!$store->catalog()->resolve($theme,$path)) throw new \InvalidArgumentException('通知页面不存在');
            echo json_encode(['status'=>200,'msg'=>'success','data'=>$store->publicPayload($theme,$path,null,null,$member)],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_HEX_TAG|JSON_HEX_AMP|JSON_THROW_ON_ERROR);
        } catch (\InvalidArgumentException $e) { echo json_encode(['status'=>400,'msg'=>'通知请求不可用','data'=>['items'=>[]]],JSON_UNESCAPED_UNICODE); }
        catch (\Throwable $e) { error_log('CRA1 announcement read failed: '.get_class($e));http_response_code(503);echo json_encode(['status'=>503,'msg'=>'通知暂时不可用','data'=>['items'=>[]]],JSON_UNESCAPED_UNICODE); }
    }
}
