<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

/**
 * 主题自带图标库（v2.45）
 *
 * 背景：后台图标的「内置键」（如 kefu/phone）此前只在悬浮导航位置可用 ——
 * `cra1_icon_url()` 遇到内置键返回空串，其他 13 处图标列填了它只会落到模板内联的
 * 默认图形，用户以为选了图标却没变化。本文件把「主题自带图标」收敛为**单一真相**：
 *
 *   - `cra1_builtin_icons()`：键 → 图标定义（label + SVG 内容 + 关键字，供后台点选与搜索）
 *   - `cra1_builtin_icon_svg($key)`：键 → 可直接内联输出的 SVG 标记
 *
 * 值域约定（后台「图标」字段接受的全部格式）：
 *   1. 内置键            kefu / phone / qq / wechat / link / shield / clock ...
 *   2. Iconify 图标      mdi:phone、tabler:shield-check（也接受 iconify:mdi:phone 前缀形式）
 *   3. Icons8 图标       icons8:headset（PNG，不可着色）
 *   4. 图片地址          https://... 或 //...（直出，不缓存）
 *   5. 空                → 走各模板自己的默认图形
 *
 * 新增内置图标只需在 `cra1_builtin_icons()` 里加一条（键 + label + svg + keywords），
 * 后台选择器与前台渲染都自动可见，不需要改动任何模板。
 */
if (!function_exists('cra1_builtin_icons')) {

    /**
     * 主题自带图标清单：键 => ['label' => 中文名, 'svg' => SVG 内部标记, 'keywords' => 搜索词]
     *
     * svg 一律为「无 fill/stroke 硬编码」的描边图标（stroke="currentColor" 由模板设置），
     * 这样能随父元素文字色变化，与 Iconify 的 mask 着色保持一致的观感。
     */
    function cra1_builtin_icons()
    {
        static $icons = null;
        if ($icons !== null) {
            return $icons;
        }
        // 描边图标（与主题既有内联图标同一套几何：24 视窗、stroke-width 2、圆角端点）
        $stroke = [
            // —— 悬浮按钮既有 5 键（保持与前台 app.js 的 floatButtons 完全一致）——
            'kefu'    => ['客服', 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z', '客服 咨询 气泡'],
            'phone'   => ['电话', 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z', '电话 联系 热线'],
            'qq'      => ['QQ', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', 'QQ 社交 客服'],
            'wechat'  => ['微信', 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z', '微信 社交 客服'],
            'link'    => ['链接', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71', '链接 跳转 外链'],

            // —— 安全与保障 ——
            'shield'  => ['安全盾牌', 'M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z', '安全 防护 盾牌'],
            'shield-check' => ['盾牌对勾', 'M12 3 5 6v5c0 4.5 2.7 7.8 7 10 4.3-2.2 7-5.5 7-10V6l-7-3Z M9 12l2 2 4-4', '安全 认证 通过'],
            'lock'    => ['锁', 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4', '加密 锁 安全 密码'],
            'check'   => ['对勾', 'M20 6 9 17l-5-5', '完成 通过 确认'],

            // —— 产品与技术 ——
            'server'  => ['服务器', 'rect:2,4,20,7,2 rect:2,13,20,7,2 M6 7.5h.01M6 16.5h.01', '服务器 主机 计算'],
            'cloud'   => ['云', 'M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.6A4 4 0 0 0 6.5 19Z', '云 云计算 云服务'],
            'database'=> ['数据库', 'ellipse:12,5,8,3 M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3', '数据库 存储 数据'],
            'cpu'     => ['处理器', 'rect:4,4,16,16,2 rect:9,9,6,6,1 M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2', 'CPU 算力 处理器 性能'],
            'network' => ['网络', 'circle:12,12,9 M3 12h18 M12 3a15 15 0 0 1 0 18 M12 3a15 15 0 0 0 0 18', '网络 线路 全球化'],
            'globe'   => ['全球', 'circle:12,12,9 M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z', '全球 地区 节点'],

            // —— 服务与支持 ——
            'headset' => ['客服耳机', 'M4 14v-2a8 8 0 0 1 16 0v2 M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2Z M20 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2Z', '客服 支持 耳机'],
            'message' => ['消息', 'M21 12a8 8 0 0 1-8 8H7l-4 4V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z', '消息 通知 沟通'],
            'mail'    => ['邮件', 'rect:2,5,20,14,2 M2 10l10 5 10-5', '邮件 邮箱 联系'],
            'clock'   => ['时钟', 'circle:12,12,9 M12 8v4l3 2', '时间 响应 时效'],
            'activity'=> ['监控告警', 'M22 12h-4l-3 8-6-16-3 8H2', '监控 告警 指标 活动'],

            // —— 业务与财务 ——
            'wallet'  => ['钱包', 'M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z M3 7V6a2 2 0 0 1 2-2h11 M16 13h.01', '钱包 财务 余额'],
            'card'    => ['银行卡', 'rect:2,5,20,14,2 M2 10h20', '支付 银行卡 付款 计费'],
            'cart'    => ['购物车', 'circle:9,20,1.4 circle:18,20,1.4 M2.5 3h2.2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L20 7H6', '购物车 订购 购买'],
            'tag'     => ['标签', 'M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a1.4 1.4 0 0 1 0 1.9Z M7.5 7.5h.01', '标签 优惠 分类'],
            'gift'    => ['礼物', 'rect:3,8,18,4,1 M12 8v13 M5 12v9h14v-9 M12 8C10 8 7.5 7 7.5 5A2.5 2.5 0 0 1 12 4a2.5 2.5 0 0 1 4.5 1C16.5 7 14 8 12 8Z', '礼物 活动 福利'],

            // —— 文档与内容 ——
            'file'    => ['文档', 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z M14 3v5h5 M9 13h6 M9 17h4', '文档 文件 资料'],
            'book'    => ['手册', 'M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z M8 3v18', '文档 手册 指南 教程'],
            'list'    => ['列表', 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01', '列表 目录 索引'],
            'news'    => ['资讯', 'M4 5h11a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2Z M17 9h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2 M7 9h6M7 13h6', '新闻 资讯 动态'],
            'bell'    => ['公告', 'M18 8a6 6 0 0 0-12 0c0 7-2 9-2 9h16s-2-2-2-9 M10.5 21a2 2 0 0 0 3 0', '公告 通知 提醒'],
            'megaphone' => ['喇叭', 'M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1Z M13 8a5 5 0 0 1 0 8', '公告 宣传 广播'],

            // —— 通用动作 ——
            'search'  => ['搜索', 'circle:11,11,7 M20 20l-4-4', '搜索 查找 检索'],
            'user'    => ['用户', 'circle:12,8,4 M4 21v-1a7 7 0 0 1 14 0v1', '用户 账号 会员'],
            'users'   => ['用户组', 'circle:9,8,3.5 M2 21v-1a6 6 0 0 1 12 0v1 M17 4.5a3.5 3.5 0 0 1 0 7 M22 21v-1a5.5 5.5 0 0 0-3.5-5.1', '用户组 团队 子账户'],
            'key'     => ['密钥', 'circle:8,15,4 M11 12l9-9 M17 6l2 2 M20 3l2 2', '密钥 授权 API'],
            'chart'   => ['图表', 'M4 20V10M10 20V4M16 20v-7M22 20H2', '图表 统计 数据 报表'],
            'rocket'  => ['火箭', 'M12 3c3 1.5 5 4.5 5 8l-2.5 2.5h-5L7 11c0-3.5 2-6.5 5-8Z M9.5 13.5 7 16l1 4 2.5-2.5 M14.5 13.5 17 16l-1 4-2.5-2.5', '火箭 上线 快速 提速'],
            'star'    => ['星标', 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z', '星标 推荐 精选'],
            'settings'=> ['设置', 'circle:12,12,3 M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1', '设置 配置 参数'],
            'refresh' => ['刷新', 'M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5', '刷新 同步 更新 续期'],
            'arrow-right' => ['箭头', 'M5 12h14 M12 5l7 7-7 7', '箭头 前往 更多'],
        ];
        $icons = [];
        foreach ($stroke as $key => $def) {
            list($label, $body, $kw) = $def;
            $icons[$key] = [
                'key'      => $key,
                'label'    => $label,
                'keywords' => $kw,
                'stroke'   => true,
                'body'     => $body,
            ];
        }
        return $icons;
    }
}

if (!function_exists('cra1_builtin_icon_body')) {

    /**
     * 内置图标的 SVG 内部标记（`<svg>` 内层），供模板内联输出。
     * 复合几何用简写语法表达（rect:x,y,w,h,r / circle:cx,cy,r / ellipse:cx,cy,rx,ry），
     * 便于清单保持紧凑可读；此处展开为真实标签。
     *
     * @param string $key 内置键
     * @return string 可直接放进 <svg> 的标记；未命中返回空串
     */
    function cra1_builtin_icon_body($key)
    {
        $all = cra1_builtin_icons();
        if (!isset($all[$key])) {
            return '';
        }
        $body = $all[$key]['body'];
        // 简写展开
        $body = preg_replace_callback('~\\brect:([\\d.]+),([\\d.]+),([\\d.]+),([\\d.]+),([\\d.]+)~', function ($m) {
            return '<rect x="' . $m[1] . '" y="' . $m[2] . '" width="' . $m[3] . '" height="' . $m[4] . '" rx="' . $m[5] . '"></rect>';
        }, $body);
        $body = preg_replace_callback('~\\bcircle:([\\d.]+),([\\d.]+),([\\d.]+)~', function ($m) {
            return '<circle cx="' . $m[1] . '" cy="' . $m[2] . '" r="' . $m[3] . '"></circle>';
        }, $body);
        $body = preg_replace_callback('~\\bellipse:([\\d.]+),([\\d.]+),([\\d.]+),([\\d.]+)~', function ($m) {
            return '<ellipse cx="' . $m[1] . '" cy="' . $m[2] . '" rx="' . $m[3] . '" ry="' . $m[4] . '"></ellipse>';
        }, $body);
        // 剩余裸路径段（以 M/m 开头、到下一个命令字或串尾）包成 <path d="...">
        $body = preg_replace_callback('~(?<![">])\\b([Mm][^<>]*?)(?=\\s+[A-Za-z][a-z]*\\d|\\s+<|$)~', function ($m) {
            $d = trim($m[1]);
            return '<path d="' . $d . '"></path>';
        }, $body);
        return $body;
    }
}

if (!function_exists('cra1_builtin_icon_svg')) {

    /**
     * 内置图标的完整 `<svg>` 标记（描边风格，随 currentColor 着色）。
     *
     * @param string $key  内置键
     * @param string $cls  附加 class（尺寸由调用方决定）
     */
    function cra1_builtin_icon_svg($key, $cls = '')
    {
        $body = cra1_builtin_icon_body($key);
        if ($body === '') {
            return '';
        }
        $c = $cls !== '' ? ' class="' . htmlspecialchars($cls, ENT_QUOTES, 'UTF-8') . '"' : '';
        return '<svg' . $c . ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
            . ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $body . '</svg>';
    }
}
