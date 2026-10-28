<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Cache-Control: no-store');header('X-Robots-Tag: noindex, nofollow');header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'");
ini_set('session.use_strict_mode','1');session_name('CRA1INSTALL');
session_set_cookie_params(['lifetime'=>0,'path'=>'/cra1-install/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);session_start();
if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
$csrf=$_SESSION['csrf'];
$assetVersion=substr(hash('sha256',(string)file_get_contents(__DIR__.'/installer.js').(string)file_get_contents(__DIR__.'/installer.css')),0,16);
?><!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>酷锐A1主题安装与维护</title><link rel="stylesheet" href="installer.css?v=<?=$assetVersion?>"></head><body>
<main id="installer" data-csrf="<?=htmlspecialchars($csrf,ENT_QUOTES,'UTF-8')?>">
<h1>酷锐A1主题安装与维护</h1><p>先在同一浏览器登录 V10 超级管理员账号，再开始检查。安装保留当前主题选择，完成后请先登录主题后台配置内容，再到 V10 系统后台手动启用。</p>
<ol><li>验证管理员与运行环境</li><li>设置主题后台</li><li>安装完成</li></ol>
<button type="button" id="check">验证并检查</button><p id="status" role="status"></p><div id="checks"></div>
<form id="setup" hidden autocomplete="off"><h2>设置主题后台</h2>
<label>后台地址<input name="entry" pattern="[a-z][a-z0-9]{5,31}" minlength="6" maxlength="32" required placeholder="例如 cra1admin"></label>
<label>管理账号<input name="username" pattern="[A-Za-z0-9_-]{3,32}" required autocomplete="off"></label>
<label>管理密码<input name="password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label>
<label>确认密码<input name="confirm" type="password" minlength="12" required autocomplete="new-password"></label>
<label>本站 HTTPS 地址<input name="canonical" type="url" required></label>
<button type="submit">完成安装</button></form>
<section id="success" hidden><h2>安装成功</h2><p>请保存以下信息，密码仅在本次流程显示。点击“登录主题后台”，输入下方账号和密码，先配置官网、会员中心和购物车的内容。</p><dl id="credentials"></dl><a id="admin-link">登录主题后台</a><button type="button" id="hide-password">隐藏密码</button><p>配置完成后，再到 V10 系统后台的主题设置中手动选择需要启用的主题。安装不会自动切换当前网站。</p></section>
</main><script src="installer.js?v=<?=$assetVersion?>"></script></body></html>
