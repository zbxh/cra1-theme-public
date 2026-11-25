<?php
declare(strict_types=1);
namespace CRA1\Theme\Security;

/** Uses V10's configured mail transport without altering native templates or tables. */
final class RecoveryMailer
{
    public static function send(string $root,string $email,string $code,string $purpose): bool
    {
        try {
            require_once $root.'/config.php';require_once $root.'/vendor/autoload.php';
            if(!defined('IDCSMART_ROOT'))define('IDCSMART_ROOT',$root.'/');
            if(!defined('WEB_ROOT'))define('WEB_ROOT',$root.'/public/');
            if(!defined('UPLOAD_DEFAULT'))define('UPLOAD_DEFAULT',WEB_ROOT.'upload/common/default/');
            $app=new \think\App($root.'/');$app->debug(false);$app->initialize();
            $transport=(string)configuration('send_email');
            if($transport==='')return false;
            $task=$purpose==='bind'?'绑定找回邮箱':'重置后台密码';
            $reply=(new \app\common\logic\EmailLogic())->sendBase([
                'email_name'=>$transport,'email'=>$email,'subject'=>'酷锐A1主题后台 · '.$task,
                'message'=>'<p>您正在'.$task.'，验证码为：</p><p style="font-size:26px;font-weight:bold;letter-spacing:5px">'.$code.'</p><p>5 分钟内有效，请勿向他人透露。如非本人操作，请忽略本邮件。</p>',
                'attachments'=>[],'template_param'=>[],
            ]);
            return (int)($reply['status']??0)===200;
        } catch(\Throwable $e) {
            // Transport details may contain credentials. Never return or log the raw message.
            error_log('[CRA1] admin recovery mail transport unavailable');
            return false;
        }
    }
}
