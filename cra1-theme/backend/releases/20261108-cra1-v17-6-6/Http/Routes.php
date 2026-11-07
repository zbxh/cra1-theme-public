<?php
declare(strict_types=1);
namespace CRA1\Theme\Http;

final class Routes
{
    public static function register(): void
    {
        static $done = false;
        if ($done) return;
        $done = true;
        $actions = [
            ['POST','security/operation/verify','verify'], ['GET','security/operation/status','status'],
            ['GET','member/avatar','avatar'], ['PUT','member/avatar','saveAvatar'], ['POST','member/avatar/upload','uploadAvatar'],
            ['GET','member/products','products'], ['GET','member/host/:id/field/:field','field'],
            ['GET','module/mf_cloud/:id/disk','disks'], ['GET','module/mf_cloud/:id/flow','flow'],
            ['DELETE','module/mf_cloud/:id/disk/:disk/failed','deleteFailedDisk'],
        ];
        foreach ($actions as [$method,$path,$action]) {
            // V10's Dispatch::init inspects a string route to select the native
            // application. A closure is incompatible with that original kernel.
            \think\facade\Route::rule('console/v1/cra1-theme/'.$path, '\\CRA1\\Theme\\Http\\home\\MemberController@'.$action, $method)->pattern(['id'=>'[1-9][0-9]*','field'=>'[1-9][0-9]*','disk'=>'[1-9][0-9]*'])
                ->middleware('app\\http\\middleware\\CheckHome');
        }
    }
}
