<?php
if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_media.php';
function theme_admin_media(string $root,string $action): array
{
    try {
    $store=new CRA1ThemeMediaStore($root); $p=read_body(); $actor=theme_actor();
    $manager=in_array($actor['role']??'',['admin','super_admin'],true);
    if ($action==='upload') { $f=$store->upload($_FILES['file']??[],'theme',(int)$actor['id']); return ['status'=>200,'msg'=>'图片已上传，保存配置后生效','data'=>$f]; }
    if ($action==='list'||$action==='attachments') return ['status'=>200,'msg'=>'已读取','data'=>$store->listing($p,$manager,$action==='list')];
    if ($action==='rename') return ['status'=>200,'msg'=>'附件名称已修改','data'=>$store->rename((int)($p['id']??0),(string)($p['name']??''),$manager)];
    if ($action==='delete'||$action==='restore') {
        theme_require_role(['admin','super_admin']);
        return ['status'=>200,'msg'=>$action==='delete'?'附件已移入回收站':'附件已恢复','data'=>$store->remove((int)($p['id']??0),$action==='restore')];
    }
    throw new InvalidArgumentException('未知附件操作');
    } catch (InvalidArgumentException $e) { $status=in_array($e->getCode(),[403,404,409,429],true)?$e->getCode():400; return ['status'=>$status,'msg'=>$e->getMessage()]; }
}
