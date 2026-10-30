<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Cache-Control: no-store');header('X-Robots-Tag: noindex, nofollow');header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
ini_set('session.use_strict_mode','1');session_name('CRA1INSTALL');
session_set_cookie_params(['lifetime'=>0,'path'=>'/cra1-install/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);$sessionReady=@session_start();
if($sessionReady&&empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
$csrf=$sessionReady?$_SESSION['csrf']:'';
$assetsReady=is_readable(__DIR__.'/installer.js')&&is_readable(__DIR__.'/installer.css');
$assetVersion=$assetsReady?substr(hash('sha256',(string)file_get_contents(__DIR__.'/installer.js').(string)file_get_contents(__DIR__.'/installer.css')),0,16):'unavailable';
$startupError=!$sessionReady?'安装会话无法保存，请在网站面板检查 PHP 会话目录的写入权限后重新打开安装页。':(!$assetsReady?'安装页面资源无法读取，请重新解压安装包，并检查 public/cra1-install/ 目录及文件的读取权限。':'');
?><!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>酷锐A1主题安装与维护</title><link rel="stylesheet" href="installer.css?v=<?=$assetVersion?>"></head><body>
<main id="installer" data-csrf="<?=htmlspecialchars($csrf,ENT_QUOTES,'UTF-8')?>">
<h1>酷锐A1主题安装与维护</h1><p>先在同一浏览器登录 V10 超级管理员账号，再开始检查。首次安装设置主题后台；已有主题完整解压新版安装包后，可在这里完成更新。两种操作均保留当前主题启用状态。</p>
<ol><li>验证管理员与检查文件</li><li>首次安装或完成更新</li><li>进入主题后台</li></ol>
<button type="button" id="check"<?=$startupError!==''?' disabled':''?>>验证并检查</button><p id="status" role="status"><?=htmlspecialchars($startupError,ENT_QUOTES,'UTF-8')?></p><div id="checks"></div>
<form id="setup" hidden autocomplete="off" novalidate><h2>设置主题后台</h2>
<label>后台地址<input name="entry" pattern="[a-z][a-z0-9]{5,31}" minlength="6" maxlength="32" required placeholder="例如 cra1admin"></label>
<label>管理账号<input name="username" pattern="[A-Za-z0-9_\-]{3,32}" minlength="3" maxlength="32" required autocomplete="off"></label>
<label>管理密码<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label>
<label>确认密码<input name="confirm" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label>
<label>本站 HTTPS 地址<input name="canonical" type="url" required></label>
<p id="setup-status" role="status" aria-live="polite" tabindex="-1" hidden></p>
<button type="submit" id="install" disabled>完成安装</button></form>
<section id="maintenance" hidden><h2 id="maintenance-title">完成主题更新</h2><p id="maintenance-summary"></p>
<div id="update-options" hidden><p>更新会保留原后台地址、账号、配置、菜单、图片和草稿。请先备份网站；此入口无法还原解压前已被覆盖的文件。</p>
<label class="backup-confirm"><input type="checkbox" id="backup-confirmed">我已备份网站，可以完成更新</label></div>
<button type="button" id="update" disabled>完成更新</button><p id="update-status" role="status" aria-live="polite" tabindex="-1" hidden></p>
<a id="existing-admin-link">登录原主题后台</a></section>
<section id="update-success" hidden><h2>更新完成</h2><p>原后台地址、账号、配置和主题启用状态已保留。请刷新前台和主题后台页面。</p><a id="updated-admin-link">登录主题后台</a></section>
<section id="success" hidden><h2>安装成功</h2><p>请保存以下信息，密码仅在本次流程显示。点击“登录主题后台”，输入下方账号和密码，先配置官网、会员中心和购物车的内容。</p><dl id="credentials"></dl><a id="admin-link">登录主题后台</a><button type="button" id="hide-password">隐藏密码</button><p>配置完成后，再到 V10 系统后台的主题设置中手动选择需要启用的主题。安装不会自动切换当前网站。</p></section>
</main><script src="installer.js?v=<?=$assetVersion?>"></script></body></html>
