<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

/**
 * 图标库热门集（v2.47）
 *
 * 为什么需要它：直接把图标库「全部」拉出来展示有两个问题 ——
 *   ① Tabler 单库就有 6220 个图标，前端一次渲染上百个跨域 <img> 会触发
 *      Iconify 的限流（实测返回 429），表现为「面板很卡、图标不出现」；
 *   ② 绝大多数图标（a-b、abacus、acorn…）与云服务官网无关，翻找成本高。
 *
 * 因此每个图标库只保留**与本站业务相关、且视觉风格统一**的一小组（约 40~50 个），
 * 作为该分类的默认展示；需要更多时点「显示全部」再按需翻页。
 *
 * 清单按用途分组维护，新增只需在对应分组里加一个图标名（不含前缀）。
 */
if (!function_exists('cra1_icon_popular')) {

    /**
     * 各图标库的热门图标名（不含前缀）：prefix => [用途分组 => [名称…]]
     * 分组名用于前端显示小节标题；同一图标出现在多组时以先出现的为准。
     */
    function cra1_icon_popular()
    {
        static $data = null;
        if ($data !== null) {
            return $data;
        }
        $data = [
            'tabler' => [
                '通用' => ['home', 'user', 'users', 'settings', 'search', 'star', 'heart', 'bookmark', 'share', 'link', 'external-link', 'plus', 'check', 'x', 'arrow-right', 'chevron-right', 'download', 'upload', 'refresh', 'filter', 'eye', 'edit', 'trash'],
                '业务' => ['server', 'server-2', 'cloud', 'database', 'cpu', 'network', 'world', 'globe', 'rocket', 'building', 'briefcase', 'chart-bar', 'chart-line', 'report', 'dashboard', 'activity', 'shield', 'shield-check', 'lock', 'key', 'fingerprint', 'certificate', 'file-text', 'folder', 'credit-card', 'wallet', 'shopping-cart', 'package', 'truck', 'headset', 'message', 'mail', 'bell', 'clock', 'calendar', 'map-pin', 'phone', 'brand-wechat', 'brand-qq', 'device-desktop', 'device-mobile', 'terminal', 'code', 'api', 'plug', 'stack', 'layers'],
            ],
            'mdi' => [
                '通用' => ['home', 'account', 'account-group', 'cog', 'magnify', 'star', 'heart', 'bookmark', 'share-variant', 'link', 'open-in-new', 'plus', 'check', 'close', 'arrow-right', 'chevron-right', 'download', 'upload', 'refresh', 'filter-variant', 'eye', 'pencil', 'delete'],
                '业务' => ['server', 'server-network', 'cloud', 'database', 'cpu-64-bit', 'ip-network', 'web', 'earth', 'rocket-launch', 'office-building', 'briefcase', 'chart-bar', 'chart-line', 'file-document', 'view-dashboard', 'pulse', 'shield-check', 'lock', 'key', 'fingerprint', 'certificate', 'file-document-outline', 'folder', 'credit-card', 'wallet', 'cart', 'package-variant', 'truck-delivery', 'headset', 'message-text', 'email', 'bell', 'clock-outline', 'calendar', 'map-marker', 'phone', 'wechat', 'qqchat', 'desktop-classic', 'cellphone', 'console', 'code-braces', 'api', 'power-plug', 'layers', 'memory'],
            ],
            'ph' => [
                '通用' => ['house', 'user', 'users', 'gear', 'magnifying-glass', 'star', 'heart', 'bookmark-simple', 'share-network', 'link', 'arrow-square-out', 'plus', 'check', 'x', 'arrow-right', 'caret-right', 'download-simple', 'upload-simple', 'arrows-clockwise', 'funnel', 'eye', 'pencil-simple', 'trash'],
                '业务' => ['hard-drives', 'cloud', 'database', 'cpu', 'network', 'globe-hemisphere-west', 'globe', 'rocket-launch', 'buildings', 'briefcase', 'chart-bar', 'chart-line', 'file-text', 'gauge', 'pulse', 'shield-check', 'lock', 'key', 'fingerprint', 'certificate', 'folder', 'credit-card', 'wallet', 'shopping-cart', 'package', 'truck', 'headphones', 'chat', 'envelope', 'bell', 'clock', 'calendar', 'map-pin', 'phone', 'wechat-logo', 'monitor', 'device-mobile', 'terminal-window', 'code', 'plugs', 'stack'],
            ],
            'lucide' => [
                '通用' => ['house', 'user', 'users', 'settings', 'search', 'star', 'heart', 'bookmark', 'share-2', 'link', 'external-link', 'plus', 'check', 'x', 'arrow-right', 'chevron-right', 'download', 'upload', 'refresh-cw', 'filter', 'eye', 'pencil', 'trash-2'],
                '业务' => ['server', 'cloud', 'database', 'cpu', 'network', 'globe', 'rocket', 'building-2', 'briefcase', 'bar-chart-3', 'line-chart', 'file-text', 'layout-dashboard', 'activity', 'shield-check', 'lock', 'key', 'fingerprint', 'award', 'folder', 'credit-card', 'wallet', 'shopping-cart', 'package', 'truck', 'headphones', 'message-circle', 'mail', 'bell', 'clock', 'calendar', 'map-pin', 'phone', 'monitor', 'smartphone', 'terminal', 'code-2', 'plug', 'layers', 'memory-stick'],
            ],
            'solar' => [
                '通用' => ['home-smile-linear', 'user-linear', 'users-group-rounded-linear', 'settings-linear', 'magnifer-linear', 'star-linear', 'heart-linear', 'bookmark-linear', 'share-linear', 'link-linear', 'arrow-right-up-linear', 'add-circle-linear', 'check-circle-linear', 'close-circle-linear', 'arrow-right-linear', 'alt-arrow-right-linear', 'download-linear', 'upload-linear', 'refresh-linear', 'filter-linear', 'eye-linear', 'pen-linear', 'trash-bin-trash-linear'],
                '业务' => ['server-linear', 'server-square-linear', 'cra1-linear', 'database-linear', 'cpu-bolt-linear', 'routing-linear', 'global-linear', 'planet-linear', 'rocket-linear', 'buildings-linear', 'case-linear', 'chart-square-linear', 'chart-2-linear', 'document-text-linear', 'widget-linear', 'pulse-linear', 'shield-check-linear', 'lock-keyhole-linear', 'key-linear', 'fingerprint-linear', 'diploma-linear', 'folder-linear', 'card-linear', 'wallet-linear', 'cart-large-linear', 'box-linear', 'delivery-linear', 'headphones-round-linear', 'chat-round-linear', 'letter-linear', 'bell-linear', 'clock-circle-linear', 'calendar-linear', 'map-point-linear', 'phone-calling-linear', 'monitor-linear', 'smartphone-linear', 'code-square-linear', 'layers-minimalistic-linear', 'ssd-round-linear'],
            ],
            'fa6-solid' => [
                '通用' => ['house', 'user', 'users', 'gear', 'magnifying-glass', 'star', 'heart', 'bookmark', 'share-nodes', 'link', 'arrow-up-right-from-square', 'plus', 'check', 'xmark', 'arrow-right', 'chevron-right', 'download', 'upload', 'arrows-rotate', 'filter', 'eye', 'pen', 'trash'],
                '业务' => ['server', 'cloud', 'database', 'microchip', 'network-wired', 'globe', 'rocket', 'building', 'briefcase', 'chart-column', 'chart-line', 'file-lines', 'gauge-high', 'wave-square', 'shield-halved', 'lock', 'key', 'fingerprint', 'certificate', 'folder', 'credit-card', 'wallet', 'cart-shopping', 'box', 'truck-fast', 'headset', 'comment', 'envelope', 'bell', 'clock', 'calendar', 'location-dot', 'phone', 'desktop', 'mobile-screen', 'terminal', 'code', 'plug', 'layer-group', 'memory'],
            ],
            'material-symbols' => [
                '通用' => ['home', 'person', 'group', 'settings', 'search', 'star', 'favorite', 'bookmark', 'share', 'link', 'open-in-new', 'add', 'check', 'close', 'arrow-forward', 'chevron-right', 'download', 'upload', 'refresh', 'filter-alt', 'visibility', 'edit', 'delete'],
                '业务' => ['dns', 'cloud', 'database', 'memory', 'lan', 'public', 'rocket-launch', 'apartment', 'business-center', 'bar-chart', 'show-chart', 'description', 'dashboard', 'monitor-heart', 'verified-user', 'lock', 'key', 'fingerprint', 'workspace-premium', 'folder', 'credit-card', 'account-balance-wallet', 'shopping-cart', 'inventory-2', 'local-shipping', 'support-agent', 'chat', 'mail', 'notifications', 'schedule', 'calendar-month', 'location-on', 'call', 'desktop-windows', 'smartphone', 'terminal', 'code', 'power', 'layers', 'developer-board'],
            ],
            'ri' => [
                '通用' => ['home-4-line', 'user-3-line', 'group-line', 'settings-3-line', 'search-line', 'star-line', 'heart-3-line', 'bookmark-3-line', 'share-line', 'link', 'external-link-line', 'add-line', 'check-line', 'close-line', 'arrow-right-line', 'arrow-down-s-line', 'download-2-line', 'upload-2-line', 'refresh-line', 'filter-3-line', 'eye-line', 'edit-line', 'delete-bin-line'],
                '业务' => ['server-line', 'cra1-line', 'database-2-line', 'cpu-line', 'router-line', 'global-line', 'earth-line', 'rocket-line', 'building-2-line', 'briefcase-line', 'bar-chart-2-line', 'line-chart-line', 'file-text-line', 'dashboard-3-line', 'pulse-line', 'shield-check-line', 'lock-line', 'key-2-line', 'fingerprint-line', 'award-line', 'folder-line', 'bank-card-line', 'wallet-3-line', 'shopping-cart-2-line', 'box-3-line', 'truck-line', 'customer-service-2-line', 'message-3-line', 'mail-line', 'notification-3-line', 'time-line', 'calendar-line', 'map-pin-line', 'phone-line', 'computer-line', 'smartphone-line', 'terminal-box-line', 'code-s-slash-line', 'plug-line', 'stack-line', 'hard-drive-2-line', 'apps-2-line'],
            ],
            'bx' => [
                '通用' => ['home', 'user', 'group', 'cog', 'search', 'star', 'heart', 'bookmark', 'share-alt', 'link', 'link-external', 'plus', 'check', 'x', 'right-arrow-alt', 'chevron-right', 'download', 'upload', 'refresh', 'filter-alt', 'show', 'edit', 'trash'],
                '业务' => ['server', 'cloud', 'data', 'chip', 'network-chart', 'globe', 'world', 'rocket', 'buildings', 'briefcase', 'bar-chart', 'line-chart', 'file', 'dashboard', 'pulse', 'shield', 'lock', 'key', 'certification', 'folder', 'credit-card', 'wallet', 'cart', 'package', 'truck', 'headphone', 'message-rounded', 'envelope', 'bell', 'time', 'calendar', 'map', 'phone', 'desktop', 'mobile', 'terminal', 'code-alt', 'plug', 'layer', 'memory-card'],
            ],
            'heroicons' => [
                '通用' => ['home', 'user', 'users', 'cog-6-tooth', 'magnifying-glass', 'star', 'heart', 'bookmark', 'share', 'link', 'arrow-top-right-on-square', 'plus', 'check', 'x-mark', 'arrow-right', 'chevron-right', 'arrow-down-tray', 'arrow-up-tray', 'arrow-path', 'funnel', 'eye', 'pencil', 'trash'],
                '业务' => ['server', 'server-stack', 'cloud', 'circle-stack', 'cpu-chip', 'globe-alt', 'globe-asia-australia', 'rocket-launch', 'building-office', 'building-office-2', 'briefcase', 'chart-bar', 'chart-bar-square', 'document-text', 'squares-2x2', 'signal', 'shield-check', 'lock-closed', 'key', 'fingerprint', 'academic-cap', 'folder', 'credit-card', 'wallet', 'shopping-cart', 'cube', 'truck', 'chat-bubble-left-right', 'envelope', 'bell', 'clock', 'calendar-days', 'map-pin', 'phone', 'computer-desktop', 'device-phone-mobile', 'command-line', 'code-bracket', 'bolt', 'rectangle-stack', 'circle-stack'],
            ],
            'octicon' => [
                '通用' => ['home', 'person', 'people', 'gear', 'search', 'star', 'heart', 'bookmark', 'share', 'link', 'link-external', 'plus', 'check', 'x', 'arrow-right', 'chevron-right', 'download', 'upload', 'sync', 'filter', 'eye', 'pencil', 'trash'],
                '业务' => ['server', 'cloud', 'database', 'cpu', 'globe', 'rocket', 'organization', 'briefcase', 'graph', 'chart', 'file', 'project', 'pulse', 'shield-check', 'lock', 'key', 'verified', 'file-directory', 'credit-card', 'package', 'truck', 'comment', 'mail', 'bell', 'clock', 'calendar', 'location', 'device-desktop', 'device-mobile', 'terminal', 'code', 'plug', 'stack', 'apps'],
            ],
            'iconoir' => [
                '通用' => ['home', 'user', 'group', 'settings', 'search', 'star', 'heart', 'bookmark', 'share-ios', 'link', 'open-new-window', 'plus', 'check', 'xmark', 'arrow-right', 'nav-arrow-right', 'download', 'upload', 'refresh', 'filter', 'eye', 'edit-pencil', 'trash'],
                '业务' => ['server', 'cloud', 'database', 'cpu', 'network', 'globe', 'internet', 'rocket', 'building', 'suitcase', 'stats-report', 'graph-up', 'page', 'dashboard', 'activity', 'shield-check', 'lock', 'key', 'fingerprint', 'medal', 'folder', 'credit-card', 'wallet', 'shopping-bag', 'package', 'truck', 'headset-help', 'chat-bubble', 'mail', 'bell', 'clock', 'calendar', 'map-pin', 'phone', 'computer', 'phone-paused', 'terminal', 'code', 'ev-plug', 'stack'],
            ],
            'jam' => [
                '通用' => ['home', 'user', 'users', 'cog', 'search', 'star', 'heart', 'bookmark', 'share-alt', 'link', 'plus', 'check', 'close', 'arrow-right', 'chevron-right', 'download', 'upload', 'refresh', 'filter', 'eye', 'write', 'trash'],
                '业务' => ['cloud', 'database', 'cpu', 'globe', 'rocket', 'building', 'briefcase', 'bar-chart', 'graph', 'document', 'dashboard', 'activity', 'shield-check', 'lock', 'key', 'folder', 'credit-card', 'wallet', 'shopping-cart', 'box', 'truck', 'headset', 'message', 'envelope', 'bell', 'clock', 'calendar', 'map-marker', 'phone', 'desktop', 'mobile', 'terminal', 'code', 'plug', 'layers', 'memory'],
            ],
            'simple-icons' => [
                '品牌' => ['alibabacloud', 'tencentcloud', 'huawei', 'cloudflare', 'amazonaws', 'googlecloud', 'microsoftazure', 'digitalocean', 'linode', 'vercel', 'netlify', 'docker', 'kubernetes', 'nginx', 'apache', 'mysql', 'postgresql', 'redis', 'mongodb', 'elasticsearch', 'grafana', 'prometheus', 'jenkins', 'gitlab', 'github', 'git', 'linux', 'ubuntu', 'debian', 'centos', 'redhat', 'debian', 'windows', 'apple', 'android', 'python', 'nodedotjs', 'php', 'go', 'rust', 'java', 'wechat', 'tencentqq', 'sinaweibo', 'zhihu', 'bilibili', 'douyin', 'xiaohongshu'],
            ],
        ];
        return $data;
    }
}

if (!function_exists('cra1_icon_popular_flat')) {

    /**
     * 拍平为「分类 => [完整图标 id…]」：prefix => [id…]（去重、保序）
     */
    function cra1_icon_popular_flat($prefix)
    {
        $all = cra1_icon_popular();
        if (!isset($all[$prefix])) {
            return [];
        }
        $seen = [];
        $out = [];
        foreach ($all[$prefix] as $group => $names) {
            foreach ($names as $n) {
                $id = $prefix . ':' . $n;
                if (isset($seen[$id])) {
                    continue;
                }
                $seen[$id] = 1;
                $out[] = $id;
            }
        }
        return $out;
    }
}
