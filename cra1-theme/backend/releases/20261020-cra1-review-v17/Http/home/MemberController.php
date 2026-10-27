<?php
declare(strict_types=1);
namespace CRA1\Theme\Http\home;

/** String controller routes preserve V10's native home application selection. */
final class MemberController
{
    private function run(string $action, \think\Request $request)
    {
        return (new \CRA1\Theme\Http\MemberController())->dispatch($action, $request);
    }
    public function verify(\think\Request $request) { return $this->run('verify', $request); }
    public function status(\think\Request $request) { return $this->run('status', $request); }
    public function avatar(\think\Request $request) { return $this->run('avatar', $request); }
    public function saveAvatar(\think\Request $request) { return $this->run('saveAvatar', $request); }
    public function uploadAvatar(\think\Request $request) { return $this->run('uploadAvatar', $request); }
    public function products(\think\Request $request) { return $this->run('products', $request); }
    public function field(\think\Request $request) { return $this->run('field', $request); }
    public function disks(\think\Request $request) { return $this->run('disks', $request); }
    public function flow(\think\Request $request) { return $this->run('flow', $request); }
    public function deleteFailedDisk(\think\Request $request) { return $this->run('deleteFailedDisk', $request); }
}
