#!/usr/bin/env php
<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
umask(0077);
require_once dirname(__DIR__,2).'/cra1-theme/backend/bootstrap.php';
require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_security.php';
$options=getopt('',['root:','username:','id:','canonical:','http-test','password-stdin','key-file:']);$command=$argv[1]??'help';
// getopt stops at the command: parse long options explicitly, never read passwords from argv.
foreach(array_slice($argv,2)as$v)if(preg_match('/^--([a-z-]+)(?:=(.*))?$/D',$v,$m))$options[$m[1]]=$m[2]??true;
$root=rtrim((string)($options['root']??dirname(__DIR__,2)),'/');
function read_password(): string { global $options;fwrite(STDERR,"请输入新密码（12–128 字符，输入不会写入日志）：\n");$tty=function_exists('posix_isatty')&&posix_isatty(STDIN);if($tty)shell_exec('stty -echo');try{$v=rtrim((string)fgets(STDIN),"\r\n");}finally{if($tty){shell_exec('stty echo');fwrite(STDERR,"\n");}}return $v; }
try {
    if($command==='migrate'||$command==='init'){
        if($command==='migrate'){$old=json_decode((string)file_get_contents($root.'/runtime/cra1_theme/admin.json'),true);if(!is_array($old)||empty($old['username'])||empty($old['password_hash']))throw new RuntimeException('旧账号文件无效，迁移未执行');$name=$old['username'];$hash=$old['password_hash'];}else{$name=(string)($options['username']??'');$hash=CRA1ThemeSecurity::password(read_password());}
        $canonical=rtrim((string)($options['canonical']??''),'/');$url=parse_url($canonical);if(!filter_var($canonical,FILTER_VALIDATE_URL)||!in_array($url['scheme']??'',['http','https'],true)||empty($url['host'])||isset($url['user'])||isset($url['pass'])||isset($url['query'])||isset($url['fragment'])||!empty($url['path'])||(!isset($options['http-test'])&&$url['scheme']!=='https'))throw new RuntimeException('必须提供 --canonical=站点源地址；HTTP 测试站需明确加 --http-test');
        CRA1ThemeSecurity::install($root,$name,$hash,['canonical_url'=>$canonical,'http_test'=>isset($options['http-test']),'force_https'=>!isset($options['http-test'])]);
        $s=new CRA1ThemeSecurity($root);$s->event('migration','ok',['category'=>'security','actor_id'=>1,'actor_name'=>$name,'role'=>'super_admin','target'=>'account:1','risk'=>'high','reason'=>'独立账号迁移完成，双重验证保持关闭','request_id'=>'cli-'.bin2hex(random_bytes(8))]);
        if($command==='migrate'){rename($root.'/runtime/cra1_theme/admin.json',$root.'/runtime/cra1_theme/admin.legacy.disabled.json');chmod($root.'/runtime/cra1_theme/admin.legacy.disabled.json',0600);}
        echo "安全库已建立，现有账号为超级管理员。请分别备份安全库和密钥。\n";
    }elseif($command==='restore-key'){
        $source=(string)($options['key-file']??'');$data=file_get_contents($source);if(strlen((string)$data)!==32)throw new RuntimeException('备份密钥无效');$db=new PDO('sqlite:'.$root.'/runtime/cra1_theme/security.sqlite');$expected=$db->query("SELECT value FROM meta WHERE key='key_check'")->fetchColumn();if(!hash_equals((string)$expected,hash_hmac('sha256','cra1-theme-key-check',$data)))throw new RuntimeException('密钥与安全库不匹配');$target=$root.'/config/cra1_theme_security.key';file_put_contents($target.'.restore',$data,LOCK_EX);chmod($target.'.restore',0600);rename($target.'.restore',$target);echo "原密钥已恢复，未创建新密钥。\n";
    }elseif($command==='recover'){
        $s=new CRA1ThemeSecurity($root);$id=(int)($options['id']??0);$a=$s->account($id);$ctx=['category'=>'security','risk'=>'high','target'=>'account:'.$id,'reason'=>'通过本地维护命令恢复，全部会话和 MFA 作废','request_id'=>'cli-'.bin2hex(random_bytes(8))];$s->event('recovery','attempt',$ctx);$password=read_password();$s->changeAccount(['role'=>'super_admin'],$id,['password'=>$password,'enabled'=>true,'reset_mfa'=>true]);$s->event('recovery','ok',$ctx);echo "账号已恢复，首次登录请修改密码。\n";
    }elseif($command==='policy'){
        $s=new CRA1ThemeSecurity($root);$file=(string)($options['file']??'');if(!$file||!is_file($file)||filesize($file)>16384)throw new RuntimeException('请用 --file=非公开策略 JSON 文件提供要恢复的设置');$policy=json_decode((string)file_get_contents($file),true);if(!is_array($policy)||!$policy)throw new RuntimeException('策略文件必须包含有效设置');$ctx=['category'=>'security','risk'=>'high','target'=>'security','reason'=>'通过本地维护命令恢复安全策略，全部会话作废','request_id'=>'cli-'.bin2hex(random_bytes(8))];$s->event('security.settings.save','attempt',$ctx);try{$s->updateSettings($policy);$s->event('security.settings.save','ok',$ctx);}catch(Throwable $e){$s->event('security.settings.save','fail',$ctx);throw $e;}echo "安全策略已恢复，全部账号需重新登录。\n";
    }elseif($command==='accounts'){
        $s=new CRA1ThemeSecurity($root);foreach($s->rows('SELECT id,username,role,enabled FROM accounts ORDER BY id')as$a)echo $a['id']."\t".$a['username']."\t".(CRA1ThemeSecurity::ROLES[$a['role']]??'未知角色')."\t".($a['enabled']?'启用':'停用')."\n";
    }elseif($command==='import-logs'){
        $s=new CRA1ThemeSecurity($root);$count=0;foreach(['audit.log','page_layout.log','member_audit.log','cart_audit.log','member-center.log','cart-theme.log']as$name){$p=$root.'/runtime/cra1_theme/'.$name;if(!is_file($p))continue;$f=fopen($p,'r');$offset=0;while(($line=fgets($f))!==false){$key=hash('sha256',$name.'|'.$offset.'|'.$line);$offset=ftell($f);$parts=explode("\t",trim($line));$hasIp=filter_var($parts[1]??'',FILTER_VALIDATE_IP)!==false;$action=substr($parts[$hasIp?2:1]??'legacy.unknown',0,100);$result=$parts[$hasIp?3:2]??'fail';$count+=$s->event($action,$result,['time'=>strtotime($parts[0]??'')?:filemtime($p),'ip'=>filter_var($parts[1]??'',FILTER_VALIDATE_IP)?$parts[1]:'','category'=>preg_match('/login|csrf|password|path|setup/i',$action)?'security':'operation','target'=>'legacy','reason'=>'历史记录；原操作人未记录，原文保留于非公开历史文件。','request_id'=>'legacy-'.substr($key,0,24)],[],$key)>0?1:0;}fclose($f);}echo "导入 {$count} 条历史记录，原日志保留。\n";
    }elseif($command==='check'){$s=new CRA1ThemeSecurity($root);if($s->scalar('PRAGMA quick_check')!=='ok')throw new RuntimeException('数据库检查失败');echo json_encode($s->verifyIntegrity(),JSON_UNESCAPED_UNICODE)."\n";
    }elseif($command==='maintenance'){
        $s=new CRA1ThemeSecurity($root);$s->verifyIntegrity();$file=$root.'/runtime/cra1_theme/security-archive.sqlite';
        $archive=new PDO('sqlite:'.$file,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$archive->exec('PRAGMA synchronous=FULL; PRAGMA journal_mode=DELETE;');
        $schema=(string)$s->scalar("SELECT sql FROM sqlite_master WHERE name='events'");$schema=preg_replace('/^CREATE TABLE events/','CREATE TABLE IF NOT EXISTS events',$schema);$archive->exec($schema);chmod($file,0600);
        $now=time();$where="time < CASE WHEN category='security' THEN ".($now-365*86400).' ELSE '.($now-180*86400).' END';$rows=$s->db->query('SELECT * FROM events WHERE '.$where);$first=$rows->fetch(PDO::FETCH_ASSOC);$count=0;
        // Commit the durable archive first. A crash before primary deletion leaves safe duplicates.
        if($first){$keys=array_keys($first);$insert=$archive->prepare('INSERT OR IGNORE INTO events('.implode(',',$keys).') VALUES('.implode(',',array_fill(0,count($keys),'?')).')');$archive->beginTransaction();try{$r=$first;do{$insert->execute(array_values($r));$count++;}while($r=$rows->fetch(PDO::FETCH_ASSOC));$archive->commit();}catch(Throwable $e){$archive->rollBack();throw $e;}}
        $rows->closeCursor();$archive=null;$s->verifyIntegrity();
        $s->db->exec('ATTACH DATABASE '.$s->db->quote($file).' AS retention_archive');
        $s->tx(function()use($s,$where,$now){$s->db->exec('DELETE FROM events WHERE id IN (SELECT id FROM retention_archive.events) AND '.$where);$s->db->prepare('DELETE FROM challenges WHERE expires_at<?')->execute([$now-86400]);$s->db->prepare('DELETE FROM limits WHERE blocked_until<? AND window_start<?')->execute([$now,$now-86400]);$s->db->prepare('DELETE FROM sessions WHERE expires_at<? OR (revoked_at>0 AND revoked_at<?)')->execute([$now-30*86400,$now-30*86400]);});$s->db->exec('DETACH DATABASE retention_archive');$s->verifyIntegrity();echo "归档 {$count} 条到非公开安全归档库，完整性检查通过。\n";
    }elseif($command==='backup'){
        $s=new CRA1ThemeSecurity($root);$p=$root.'/runtime/cra1_theme/backups/security-'.date('Ymd-His').'.sqlite';if(!is_dir(dirname($p)))mkdir(dirname($p),0700,true);$s->db->exec('VACUUM INTO '.$s->db->quote($p));chmod($p,0600);echo "账号与审计库已一致性备份：{$p}\n密钥需另行备份；归档库存在时一同备份。\n";
    }elseif($command==='seo'){
        $s=new CRA1ThemeSecurity($root);require_once CRA1_THEME_BACKEND.'/Support/cra1_theme_seo.php';$ctx=['category'=>'operation','risk'=>'medium','target'=>'website:seo','request_id'=>'cli-'.bin2hex(random_bytes(8))];$s->event('seo.generate','attempt',$ctx);theme_generate_seo($root,$s->settings()['canonical_url']);$s->event('seo.generate','ok',$ctx);echo "搜索引擎文件已按规范地址更新。\n";
    }else echo "用法：php cra1-theme/scripts/security.php migrate|init|recover|restore-key|policy|accounts|import-logs|check|maintenance|backup|seo --root=站点根目录\n迁移：migrate --canonical=https://example.com （测试站才加 --http-test）\n恢复：recover --id=账号ID；密码从标准输入读取。\n恢复原密钥：restore-key --key-file=非公开备份路径\n策略恢复：policy --file=非公开策略JSON文件；账号ID：accounts\n";
}catch(Throwable $e){fwrite(STDERR,'维护失败：'.$e->getMessage()."\n");exit(1);}
