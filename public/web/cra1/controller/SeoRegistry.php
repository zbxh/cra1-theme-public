<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

/**
 * 酷锐A1主题 SEO 注册表与元信息解析
 *
 * 设计要点：
 *  - 页面清单复用页面模块 manifest（单一真相），不另维护一份 41 页定义。
 *  - 每页默认 title/description/keywords 由服务端静态给出（不依赖系统 SEO 表），
 *    后台可按页覆盖；覆盖值存 seo_page_meta_json（{pages:{<pageKey>:{title,desc,kw,noindex}}}）。
 *  - 输出 canonical / OG / Twitter / JSON-LD；详情页（新闻/公告/文档）标题与描述来自动态数据。
 *  - 只输出白名单字段，任何配置值都不能决定文件路径。
 */
if (!function_exists('cra1_seo_registry')) {

    /**
     * 页面 SEO 注册表：pageKey → 默认元信息。
     * 与 cra1_page_module_manifest() 的 pageKey 完全一致（含斜线页面）。
     */
    function cra1_seo_registry()
    {
        static $reg = null;
        if ($reg !== null) {
            return $reg;
        }
        // 产品 13 页：按产品名生成
        $productMeta = [
            'cloud' => ['云服务器', '弹性云服务器按需创建、按量付费，支持多可用区部署与快照备份，适用于网站、应用与数据库等持续负载场景。'],
            'dedicated' => ['物理裸机', '独享物理服务器资源，CPU、内存、磁盘与网络按业务规格配置，适合数据库、高性能计算与合规隔离部署。'],
            'domain' => ['域名注册', '域名查询与注册服务，支持主流后缀注册、实名认证与解析管理，域名资产集中管理更省心。'],
            'domain_buy' => ['域名购买', '域名购买与转入流程说明：查询可用性、确认实名信息、完成支付后即可在控制台管理解析。'],
            'domain_register' => ['域名查询注册', '域名批量查询与注册，支持多后缀比价与自动续费设置，避免域名到期风险。'],
            'domain_shop' => ['域名商城', '域名商城提供多后缀域名选购与优惠信息，支持在线查询、下单与实名认证一站式办理。'],
            'ssl' => ['SSL 证书', 'SSL 数字证书支持 DV/OV/EV 多种类型，全站 HTTPS 加密传输，提升访问安全与搜索信任度。'],
            'sms' => ['短信服务', '短信服务覆盖验证码、通知与营销场景，三网通道稳定送达，支持模板管理与发送量统计。'],
            'rent' => ['机柜租用', '机柜租用服务按 U 位与电力规格灵活配置，机房提供 BGP 多线网络与 7×24 运维支持。'],
            'trusteeship' => ['服务器托管', '服务器托管提供标准机柜与带宽资源，支持设备上架、网络接入与远程运维协助。'],
            'trademark' => ['商标注册', '商标注册服务覆盖查询、申请与后续维护，专业顾问协助评估类别与注册风险。'],
            'icp' => ['ICP 备案办理', 'ICP 备案办理指引：准备主体与域名材料，按流程提交审核，专业顾问协助跟进备案进度。'],
            'model' => ['企业云基础能力', '面向企业业务场景的云基础能力组合，覆盖计算、网络、存储与安全产品的选型与接入。'],
        ];
        $reg = [];
        foreach ($productMeta as $k => $v) {
            $reg[$k] = ['title' => $v[0], 'description' => $v[1], 'keywords' => $v[0] . ',云计算服务,智简魔方'];
        }
        // 首页
        $reg['home'] = [
            'title' => '云计算服务与行业解决方案',
            'description' => '提供云服务器、物理裸机、域名注册、SSL 证书与短信服务等云产品，覆盖电商、金融、游戏等行业解决方案，支持按需选购与专业咨询。',
            'keywords' => '云服务器,物理裸机,域名注册,SSL证书,云计算服务,行业解决方案',
        ];
        // 行业方案 8 页
        $industryMeta = [
            'ecommerce' => ['电商零售', '面向电商大促与高并发交易场景的云上方案：弹性扩容、全链路加速、交易安全与数据运营支撑。'],
            'finance' => ['金融科技', '面向金融业务合规与连续性要求的云上方案：资源隔离、交易稳定、数据加密与审计追溯能力。'],
            'game' => ['游戏娱乐', '面向游戏研发与运营的云上方案：全球同服低延迟、弹性开合服、高防保障与研发提效。'],
            'auto' => ['汽车出行', '面向汽车与出行行业的云上方案：车联网平台接入、营销官网承载、经销商系统与数据安全。'],
            'travel' => ['文化旅游', '面向文旅行业的云上方案：票务系统峰值承载、智慧景区数据统一与内容全球分发。'],
            'education' => ['在线教育', '面向在线教育的云上方案：直播课堂低延迟、课件海量存储、考试系统弹性与内容安全。'],
            'medical' => ['智慧医疗', '面向医疗行业的云上方案：影像数据存储、在线问诊承载、数据合规与容灾备份。'],
            'agriculture' => ['智慧农业', '面向农业数字化的云上方案：物联网设备接入、监控视频存储、产销平台部署与成本优化。'],
        ];
        foreach ($industryMeta as $k => $v) {
            $reg['solution/' . $k] = [
                'title' => $v[0] . '解决方案',
                'description' => $v[1],
                'keywords' => $v[0] . ',行业解决方案,云上架构,智简魔方',
            ];
        }
        // 独立页与列表页
        $reg['about'] = ['title' => '公司介绍', 'description' => '了解智简魔方的发展历程、资质荣誉与合作案例，以及我们在云服务领域的技术积累与服务承诺。', 'keywords' => '公司介绍,关于我们,资质荣誉,合作案例'];
        $reg['contact'] = ['title' => '联系我们', 'description' => '通过在线咨询、客服热线或邮件联系我们，获取产品选购建议、架构咨询与商务合作支持。', 'keywords' => '联系我们,在线咨询,客服热线,商务合作'];
        $reg['solution'] = ['title' => '全场景云解决方案', 'description' => '按行业理解业务目标，按工作负载拆解资源与架构，从基础设施到上线流程形成可执行的云上方案。', 'keywords' => '云解决方案,行业方案,上云架构,智简魔方'];
        $reg['news'] = ['title' => '新闻资讯', 'description' => '关注智简魔方企业动态、产品进展与行业资讯，了解云服务领域的最新变化与实践经验。', 'keywords' => '新闻资讯,企业动态,行业资讯'];
        $reg['announce'] = ['title' => '官方公告', 'description' => '查看产品调整、服务变更与重要通知等官方公告内容，及时了解平台服务状态。', 'keywords' => '官方公告,服务通知,产品动态'];
        $reg['notifications'] = ['title' => '所有通知', 'description' => '查看最新服务消息与通知。', 'keywords' => '服务消息,通知', 'noindex' => true];
        $reg['news-classify'] = ['title' => '新闻分类', 'description' => '按分类浏览智简魔方的新闻资讯与官方公告，快速定位关注的内容主题。', 'keywords' => '新闻分类,资讯分类,官方公告'];
        $reg['recruit'] = ['title' => '人才招聘', 'description' => '加入智简魔方团队，关注技术平台、产品服务、销售合作等方向的岗位机会与应聘方式。', 'keywords' => '人才招聘,加入我们,招聘岗位'];
        $reg['feedback'] = ['title' => '意见反馈', 'description' => '提交产品建议、问题反馈与服务投诉，我们会逐条跟进并同步处理结果。', 'keywords' => '意见反馈,产品建议,问题反馈'];
        $reg['activities'] = ['title' => '最新活动', 'description' => '查看产品优惠、试用活动与服务更新信息，参与前请阅读适用条件与活动规则。', 'keywords' => '最新活动,优惠活动,产品试用'];
        $reg['service-guarantee'] = ['title' => '服务保障', 'description' => '了解稳定运行、数据安全、响应支持与服务范围等保障内容，具体以产品说明与协议为准。', 'keywords' => '服务保障,技术支持,服务承诺'];
        $reg['document'] = ['title' => '文档中心', 'description' => '产品使用手册、常见问题与接入指南，帮助快速完成产品配置与业务上线。', 'keywords' => '文档中心,使用手册,接入指南,常见问题'];
        $reg['document-result'] = ['title' => '文档搜索', 'description' => '按关键词搜索文档中心的帮助内容，快速定位产品配置与使用说明。', 'keywords' => '文档搜索,帮助搜索,使用说明'];
        $reg['404'] = ['title' => '页面未找到', 'description' => '您访问的页面不存在或已被移除，可从页面入口返回首页、查看文档或联系技术支持。', 'keywords' => '404,页面未找到', 'noindex' => true];
        $reg['partner/cps'] = ['title' => '推广合作', 'description' => '加入智简魔方推广合作计划，获取推广素材与专属对接支持，合作条件以双方确认为准。', 'keywords' => '推广合作,CPS合作,渠道合作'];
        $reg['partner/agent'] = ['title' => '代理伙伴', 'description' => '申请成为智简魔方代理伙伴，获取代理政策、培训赋能与区域支持，具体权益以合作协议为准。', 'keywords' => '代理伙伴,代理商招募,渠道代理'];
        // 详情页（4 个 tpl 共用默认，实际标题/描述由动态数据提供）
        $detailMeta = [
            'news-details' => ['新闻详情', '查看新闻正文、发布时间与相关附件，了解企业动态与行业资讯的完整内容。', '新闻详情,企业动态,行业资讯'],
            'announce-details' => ['公告详情', '查看公告正文、发布时间与相关附件，及时了解产品调整与服务变更信息。', '公告详情,服务通知,产品动态'],
            'document-details' => ['文档详情', '查看产品使用手册、接入指南与常见问题的详细说明，帮助快速完成配置与上线。', '文档详情,使用手册,接入指南'],
            'document-view' => ['文档浏览', '在线浏览产品文档与帮助内容，支持按目录定位与附件下载。', '文档浏览,帮助中心,产品文档'],
        ];
        foreach ($detailMeta as $k => $v) {
            $reg[$k] = ['title' => $v[0], 'description' => $v[1], 'keywords' => $v[2], 'isDetail' => true];
        }
        // 别名页（跟随目标，不单独出 SEO）
        $reg['partner-agent'] = ['title' => '代理伙伴', 'description' => '', 'keywords' => '', 'aliasOf' => 'partner/agent'];
        $reg['partner-reward'] = ['title' => '推广合作', 'description' => '', 'keywords' => '', 'aliasOf' => 'partner/cps'];
        return $reg;
    }
}

if (!function_exists('cra1_seo_page_meta_raw')) {

    /** 读取后台每页 SEO 覆盖（seo_page_meta_json），非法 JSON 回退空并记录审计 */
    function cra1_seo_page_meta_raw($rawJson = null)
    {
        static $parsed = null;
        if ($parsed !== null && $rawJson === null) {
            return $parsed;
        }
        $parsed = ['pages' => []];
        if ($rawJson === null) {
            $rawJson = function_exists('cra1_theme_config_raw') ? cra1_theme_config_raw('seo_page_meta_json') : '';
        }
        if ((string) $rawJson === '') {
            return $parsed;
        }
        $decoded = json_decode((string) $rawJson, true);
        if (!is_array($decoded) || !isset($decoded['pages']) || !is_array($decoded['pages'])) {
            if (function_exists('cra1_layout_audit')) {
                cra1_layout_audit('seo-normalize', 'fail', 'illegal-seo-meta-json-fallback-default');
            }
            return $parsed;
        }
        $parsed = $decoded;
        return $parsed;
    }

    /**
     * 解析某页最终 SEO 元信息：注册表默认 → 站点级默认 → 每页覆盖。
     * $override 为单页覆盖数组（title/desc/kw/noindex）。
     */
    function cra1_seo_resolve_page($pageKey, $config, $pagesDoc = null, $siteNameOverride = null)
    {
        $reg = cra1_seo_registry();
        $base = isset($reg[$pageKey]) ? $reg[$pageKey] : ['title' => '', 'description' => '', 'keywords' => ''];
        if (isset($base['aliasOf'])) {
            $base = isset($reg[$base['aliasOf']]) ? $reg[$base['aliasOf']] : $base;
        }
        $doc = ($pagesDoc === null) ? cra1_seo_page_meta_raw() : ['pages' => $pagesDoc];
        $ov = (isset($doc['pages'][$pageKey]) && is_array($doc['pages'][$pageKey])) ? $doc['pages'][$pageKey] : [];
        $siteName = $siteNameOverride !== null ? (string) $siteNameOverride : (function_exists('configuration') ? (string) configuration('website_name') : '');
        $suffix = trim((string) ($config['seo_site_title_suffix'] ?? ''));
        if ($suffix === '') {
            $suffix = $siteName;
        }
        $title = trim((string) ($ov['title'] ?? '')) !== '' ? trim((string) $ov['title']) : (string) $base['title'];
        $globalDesc = trim((string) ($config['seo_default_description'] ?? ''));
        $globalKw = trim((string) ($config['seo_default_keywords'] ?? ''));
        $desc = trim((string) ($ov['desc'] ?? '')) !== '' ? trim((string) $ov['desc']) : ($globalDesc !== '' ? $globalDesc : (string) ($base['description'] ?? ''));
        $kw = trim((string) ($ov['kw'] ?? '')) !== '' ? trim((string) $ov['kw']) : ($globalKw !== '' ? $globalKw : (string) ($base['keywords'] ?? ''));
        // 站点级默认兜底（页面既无注册默认也无覆盖时）
        if ($desc === '') {
            $desc = trim((string) ($config['seo_default_description'] ?? ''));
        }
        if ($desc === '') {
            $desc = $siteName;
        }
        if ($kw === '') {
            $kw = trim((string) ($config['seo_default_keywords'] ?? ''));
        }
        if ($kw === '') {
            $kw = $siteName;
        }
        return [
            'title' => $title,
            'titleFull' => $title !== '' && $suffix !== '' ? $title . '-' . $suffix : ($title !== '' ? $title : $suffix),
            'description' => $desc,
            'keywords' => $kw,
            'noindex' => !empty($ov['noindex']) || !empty($base['noindex']),
            'isDetail' => !empty($base['isDetail']),
            'siteName' => $siteName,
            'suffix' => $suffix,
            'sources' => [
                'title' => trim((string) ($ov['title'] ?? '')) !== '' ? 'page' : 'template',
                'description' => trim((string) ($ov['desc'] ?? '')) !== '' ? 'page' : ($globalDesc !== '' ? 'global' : (!empty($base['description']) ? 'template' : 'global')),
                'keywords' => trim((string) ($ov['kw'] ?? '')) !== '' ? 'page' : ($globalKw !== '' ? 'global' : (!empty($base['keywords']) ? 'template' : 'global')),
            ],
        ];
    }
}
