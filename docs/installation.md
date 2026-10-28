# 酷锐A1主题安装图文教程

适用：**v17.1 测试版 · 智简魔方 V10 10.7.4**。

**QQ 交流群：603107399** · [点击加入](https://qm.qq.com/q/O3d7bVtcoS)

## 01 下载主题包

[下载主题与安装教程合集](https://github.com/zbxh/cra1-theme-public/releases/download/v17.1/CRA1-theme-v17.1.zip)，在电脑上解压 `CRA1-theme-v17.1.zip`。里面的 **`cra1-theme-install.zip`** 是要上传网站的安装包，“安装教程”文件夹留在电脑上阅读。

首次安装按下面步骤操作；已经安装过主题，直接看[已有主题如何更新](#05-已有主题如何更新)。操作前先备份网站。

## 02 主题文件放到哪些目录

打开智简魔方 V10 的**网站根目录**，也就是能看到 `config.php`、`vendor/`、`public/` 的那一层。将 `cra1-theme-install.zip` 上传到这一层并解压，**同名文件夹选择合并**。

安装包已经排好目录，整包解压后会自动放到以下位置。也可以先在电脑上解压，再按表上传、合并。

| 内容 | 对应位置（相对 V10 网站根目录） |
| --- | --- |
| 主题程序 | `cra1-theme/` |
| 官网主题 | `public/web/cra1/` |
| 会员中心主题 | `public/clientarea/template/pc/cra1/`<br>`public/clientarea/template/mobile/cra1/` |
| 购物车主题 | `public/cart/template/pc/cra1/`<br>`public/cart/template/mobile/cra1/` |
| 会员首页主题 | `public/home/template/pc/cra1/`<br>`public/home/template/mobile/cra1/` |
| 共用组件 | `public/cra1-shared/` |
| 主题后台 | `public/cra1admin/` |
| 安装向导 | `public/cra1-install/` |
| 主题辅助文件 | `lib/` 下的 `cra1_theme_*.php`，保留原文件名 |
| 主题辅助文件 | `bin/` 下的 `cra1-theme-*.php`，保留原文件名 |

![文件位置示意：主题文件夹合并到已有 V10 目录中，路径均为示例。](images/install-guide-location.png)

注意：解压位置是 **V10 网站根目录**，不是 `public/` 里面；不要额外套一层安装包文件夹。

## 03 打开安装向导

先在浏览器登录本站的 **智简魔方 V10 超级管理员**账号，再在同一浏览器打开：

```text
https://你的域名/cra1-install/
```

将“你的域名”换成本站域名，点击 **“验证并检查”**。向导只检查 PHP、必要扩展、数据库连接、目录权限、HTTPS 和文件访问保护，检查通过后显示“设置主题后台”表单。

![安装向导示例：点击“验证并检查”。](images/install-guide-start.png)

## 04 设置主题后台并完成安装

1. 填写主题后台地址、管理账号、密码与确认密码。本站 HTTPS 地址保持为自己的网站地址，不带页面路径。
2. 点击 **“安装并启用三个主题”**，等待安装完成。

![填写示例：请设置自己的后台入口和账号；密码区域已遮盖。](images/install-guide-settings.png)

安装成功后，保存页面显示的**后台地址、账号和密码**，点击 **“进入主题后台”**。主题账号是刚才自己设置的，和 V10 系统后台账号独立。

![安装成功示例：保存后台地址和账号，密码已隐藏。](images/install-guide-success.png)

进入后台后，选择“官网”“会员中心”或“购物车”，即可编辑对应页面。三个主题会在安装时自动启用。

![主题后台示例：选择要编辑的主题。](images/install-guide-overview.png)

教程中的域名与账号均为示例，密码已隐藏或遮盖，请填写自己的信息。

## 05 已有主题如何更新

下载并在电脑上解压同一份主题合集。进入主题后台 **“主题管理 → 安装与更新”**，上传其中的 **`cra1-theme-install.zip`**，检查通过后点击 **“确认覆盖更新”**，按提示验证主题后台密码即可。

![更新入口示例：进入“主题管理 → 安装与更新”。](images/install-guide-update.png)

更新会保留已有配置、后台账号、图片、草稿和页面内容，无需重新安装。已有主题请通过后台上传更新，不要直接在服务器解压覆盖。

日常设置方法见[主题使用教程](https://github.com/zbxh/cra1-theme-public/blob/main/docs/usage.md)。
