<?php
/** Self-contained recovery copy; it works after all public CRA1 code has been removed. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
function cra1_recovery_main(): void
{
    $backup=__DIR__;$root=dirname($backup,3);
    if(basename(dirname($backup))!=='cra1-theme-uninstall'||basename(dirname($backup,2))!=='runtime'||!preg_match('/^\d{8}-\d{6}-[a-f0-9]{12}$/D',basename($backup)))throw new RuntimeException('请运行卸载备份目录中生成的 recover.php，不能直接运行源码文件');
    $noLinks=static function(string $path)use($root):void{for($p=$path;;$p=dirname($p)){if(is_link($p))throw new RuntimeException('恢复路径包含软链接，已停止');if($p===$root)break;if(dirname($p)===$p)throw new RuntimeException('恢复路径超出网站目录');}};
    $noLinks($backup.'/record.json');$record=json_decode((string)file_get_contents($backup.'/record.json'),true);
    if(!is_array($record)||($record['format']??null)!==1||($record['id']??'')!==basename($backup)||!is_array($record['paths']??null))throw new RuntimeException('卸载备份记录不完整，未移动文件');
    $entry=$record['entry']??'';
    if(!is_string($entry)||!preg_match('/^[a-z][a-z0-9]{5,31}$/D',$entry)||in_array($entry,['console','public','config','upload','plugins','clientarea','cra1-shared','cra1-install'],true))throw new RuntimeException('后台地址记录无效');
    $allowed=['cra1-theme','runtime/cra1_theme','config/cra1_theme_security.key','public/web/cra1','public/cra1-shared','public/cra1admin','public/'.$entry,'public/cra1-install','public/upload/cra1-theme',
        'lib/cra1_theme_admin.php','lib/cra1_theme_security.php','lib/cra1_theme_media.php','lib/cra1_theme_seo.php','lib/cra1_theme_client_actions.php','bin/cra1-theme-security.php','bin/cra1-theme-media.php'];
    foreach(['clientarea','cart','home']as$domain)foreach(['pc','mobile']as$device)$allowed[]='public/'.$domain.'/template/'.$device.'/cra1';
    $lockPath=$root.'/runtime/cra1-theme-lifecycle.lock';$noLinks($lockPath);$lock=fopen($lockPath,'c+b');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('还有主题请求正在运行，请稍候再恢复');
    $paths=[];
    foreach($record['paths']as$relative){
        if(!is_string($relative)||!in_array($relative,$allowed,true))throw new RuntimeException('备份包含未允许恢复的路径，已停止');
        $from=$backup.'/files/'.$relative;$to=$root.'/'.$relative;$noLinks(dirname($from));$noLinks($to);
        if(is_link($from)){
            if(!isset($record['links'][$relative])||readlink($from)!==$record['links'][$relative])throw new RuntimeException('备份依赖链接与卸载记录不一致，已停止');
        }else $noLinks($from);
        if(!file_exists($from)&&!is_link($from))continue;
        if(file_exists($to))throw new RuntimeException('目标已存在，未覆盖：'.$relative.'。请先核对现有文件');
        if(!is_writable(dirname($to)))throw new RuntimeException('恢复需要网站运行用户写入目录：'.dirname($relative));
        $paths[$relative]=[$from,$to];
    }
    if(!$paths){echo "没有待恢复的主题文件，现有站点保持原样。\n";return;}
    $moved=[];
    try{
        foreach($paths as$relative=>[$from,$to]){if(!rename($from,$to))throw new RuntimeException('恢复文件失败：'.$relative);$moved[$relative]=[$from,$to];}
        $state=$record['restore_state']??['state'=>'disabled','before'=>$record['before']??[],'changes'=>$record['changes']??[],'time'=>time()];
        if(!is_array($state)||($state['state']??'')!=='disabled')throw new RuntimeException('恢复后的主题状态记录无效');
        $stateFile=$root.'/runtime/cra1_theme/lifecycle.json';
        if(is_dir(dirname($stateFile))&&file_put_contents($stateFile,json_encode($state,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)."\n",LOCK_EX)===false)throw new RuntimeException('无法写入恢复后的停用记录');
        if(is_file($stateFile))chmod($stateFile,0600);
        $record['state']='restored';$record['restored_at']=time();
        if(file_put_contents($backup.'/record.json',json_encode($record,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)."\n",LOCK_EX)===false)throw new RuntimeException('恢复记录写入失败');
        $pending=$root.'/runtime/cra1-theme-uninstall/pending.json';$noLinks($pending);
        if(is_file($pending)&&((json_decode((string)file_get_contents($pending),true)['id']??'')===basename($backup)))unlink($pending);
    }catch(Throwable $error){
        foreach(array_reverse($moved)as[$from,$to])if(!file_exists($from))@rename($to,$from);
        throw $error;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
    echo "主题文件、原账号和配置已恢复；网站继续使用当前系统主题。请登录原主题后台，在“主题管理 → 停用与卸载”中重新检查并启用。\n";
}
try{cra1_recovery_main();}catch(Throwable $error){fwrite(STDERR,'恢复未完成：'.$error->getMessage()."\n");exit(1);}
