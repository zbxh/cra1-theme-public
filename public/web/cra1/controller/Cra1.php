<?php
/**
 * 酷锐A1主题控制器（template 模块插件）
 * 机制：TemplateLogic::templateTabList 检测到本类后自动安装；
 *       系统主题控制器接口由当前 V10 后台路由分发；独立主题后台使用自身入口。
 * 配置存储：优先 runtime/cra1_theme/config.json（非 Web 根目录），旧 controller/storage.json 仅兼容读取。
 */
namespace template\cra1\controller;
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

require_once __DIR__ . '/PageContent.php';
require_once __DIR__ . '/HeaderSupport.php';

class Cra1
{
    public $info = [
        'name'        => 'Cra1',
        'title'       => '酷锐A1主题控制器',
        'description' => '酷锐A1官网主题独立管理台：菜单、轮播、首页模块、首页产品、服务节点与悬浮导航',
        'author'      => 'CRA1',
        'version'     => '2.0.0',
    ];

    /** 旧版公开目录存储（仅兼容读取，新写入一律进 runtime） */
    protected $legacyStorage = __DIR__ . '/storage.json';

    /** 运行时存储路径（非 Web 根目录，避免静态下载） */
    protected function storagePath()
    {
        // 本项目 runtime_path($path) 会在尾部补分隔符，因此用 runtime_path() 取基础目录后手动拼接
        if (function_exists('runtime_path')) {
            return runtime_path() . 'cra1_theme/config.json';
        }
        return dirname(__DIR__,4) . '/runtime/cra1_theme/config.json';
    }

    protected function readStorage()
    {
        $preview = \cra1_admin_preview_config();
        if ($preview !== null) return $preview;
        // 旧公开文件作为基底层（保留历史自定义值），runtime 文件覆盖其上
        $data = [];
        if (is_file($this->legacyStorage)) {
            $legacy = json_decode((string) file_get_contents($this->legacyStorage), true);
            if (is_array($legacy)) {
                $data = $legacy;
            }
        }
        $path = $this->storagePath();
        if (is_file($path)) {
            $runtime = json_decode((string) file_get_contents($path), true);
            if (is_array($runtime)) {
                $data = array_merge($data, $runtime);
            }
        }
        return $data;
    }

    public function install()
    {
        return true;
    }

    public function uninstall()
    {
        return true;
    }

    /** PluginModel::install 安装前校验（与官方基类 checkInfo 行为一致） */
    public function checkInfo()
    {
        foreach (['name', 'title', 'description', 'author', 'version'] as $key) {
            if (!array_key_exists($key, $this->info)) {
                return false;
            }
        }
        return true;
    }

    /** 读取已保存配置（无则空数组，展示层用 defaults 兜底） */
    public function getConfig()
    {
        return $this->readStorage();
    }

    /** 原子写入：临时文件 + rename，避免并发写坏 JSON */
    public function saveConfig(array $config, bool $replace = false)
    {
        if (array_key_exists('header_support_json', $config)) {
            try { $config['header_support_json'] = \cra1_support_normalize_json($config['header_support_json']); }
            catch (\Throwable $e) { return false; }
        }
        $path = $this->storagePath();
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
            return false;
        }
        $lock = fopen($path . '.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX)) return false;
        try {
            $current = [];
            if (is_file($path)) {
                $current = json_decode((string) file_get_contents($path), true);
                if (!is_array($current) || json_last_error() !== JSON_ERROR_NONE) return false;
            }
            // System theme forms may know fewer keys than the workspace registry.
            $json = json_encode($replace ? $config : array_replace($current, $config), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false) return false;
            $tmp = $path . '.tmp.' . bin2hex(random_bytes(6));
            if (file_put_contents($tmp, $json) === false) { @unlink($tmp); return false; }
            @chmod($tmp, 0640);
            if (!rename($tmp, $path)) { @unlink($tmp); return false; }
            return true;
        } finally { flock($lock, LOCK_UN); fclose($lock); }

    }

    /** Explicit reset shares the lock and corruption guard used by normal saves. */
    public function resetConfig()
    {
        // Tombstones also override values from a legacy public storage file.
        $defaults = self::defaults();
        $reset = array_fill_keys(array_keys($defaults), '');
        return $this->saveConfig($reset, true);
    }

    /** 返回默认值与已保存值合并后的配置，空字符串回退到默认值。 */
    public function resolvedConfig()
    {
        $defaults = self::defaults();
        $saved = $this->getConfig();
        $explicit = json_decode((string)($saved['public_content_explicit_json'] ?? ''), true);
        $explicit = is_array($explicit) ? $explicit : [];
        foreach ($defaults as $key => $default) {
            if (!array_key_exists($key, $saved) || ($saved[$key] === '' && !array_key_exists($key, $explicit))) {
                $saved[$key] = $default;
            }
        }
        return array_merge($defaults, $saved);
    }

    /** 全部可配置字段与默认值（新增字段需同步独立管理台 dashboard.html） */
    public static function defaults()
    {
        return [
            'cloud_menu_text' => '首页|/||0
产品服务|/cart/goodsList.htm|按分类选购产品与服务|0|cart|cart
产品介绍|/#pricing|了解产品能力、规格与价格|0|cloud
>计算与基础设施|/cloud.html|云端算力与服务器服务|0|server
>>云服务器|/cloud.html|按需配置的弹性云端算力|0|cloud
>>物理裸机|/dedicated.html|独享物理资源与稳定性能|0|server
>>服务器租用|/rent.html|面向业务负载的服务器租赁|0|cpu
>>服务器托管|/trusteeship.html|专业机房与设备运维服务|0|network
>>模型服务|/model.html|模型接入与应用开发支持|0|database
>域名与品牌|/domain.html|域名选购与品牌保护|0|globe
>>域名注册|/domain.html|查询并注册适合业务的域名|0|globe
>>域名购买|/domain_buy.html|浏览域名购买与交易服务|0|cart
>>域名注册服务|/domain_register.html|了解注册流程与域名管理|0|book
>>域名商店|/domain_shop.html|查找适合品牌的域名资源|0|tag
>>商标注册|/trademark.html|商标申请与品牌权益保护|0|shield
>安全与通信|/ssl.html|网站加密、通信与合规支持|0|shield-check
>>SSL 证书|/ssl.html|网站身份验证与加密传输|0|lock
>>短信服务|/sms.html|业务通知与验证码服务|0|message
>>ICP 备案|/icp.html|网站备案流程与申请支持|0|file
>价格方案|/#pricing|查看产品规格与计费方案|0|wallet
解决方案|/solution.html|按行业场景规划云端业务|0|network
>电商零售|/solution/ecommerce.html|支撑交易、营销与高并发业务|0|cart
>金融科技|/solution/finance.html|面向金融业务的可靠基础设施|0|shield
>游戏娱乐|/solution/game.html|稳定运行与快速响应的游戏场景|0|cpu
>汽车出行|/solution/auto.html|连接出行服务与数据应用|0|network
>文化旅游|/solution/travel.html|面向旅游服务与文化内容的方案|0|globe
>在线教育|/solution/education.html|课堂、课程与学习平台基础设施|0|book
>智慧医疗|/solution/medical.html|医疗服务与健康数据应用场景|0|activity
>智慧农业|/solution/agriculture.html|农业管理与智能生产应用场景|0|chart
资源支持|/document.html|文档、资讯与服务支持|0|book
>文档中心|/document.html|查阅产品文档与使用指南|0|book
>文档搜索|/document-result.html|按关键词查找文档与帮助|0|search
>新闻资讯|/news.html|了解产品动态与行业资讯|0|news
>新闻分类|/news-classify.html|按主题浏览新闻资讯|0|list
>官方公告|/announce.html|查看服务通知与平台公告|0|bell
>活动专区|/activities.html|了解当前活动与优惠信息|0|gift
>服务保障|/service-guarantee.html|查看服务承诺与支持范围|0|shield-check
>意见反馈|/feedback.html|提交使用建议与问题反馈|0|message
合作伙伴|/partner/cps.html|与合作伙伴共同拓展业务|0|users
>推广合作|/partner/cps.html|了解推广规则与合作权益|0|chart
>代理伙伴|/partner/agent.html|了解代理合作与服务体系|0|users
关于我们|/about.html|了解团队并与我们联系|0|user
>公司介绍|/about.html|了解企业、团队与发展历程|0|user
>联系我们|/contact.html|咨询产品、方案与合作事宜|0|headset
>人才招聘|/recruit.html|查看岗位与团队机会|0|users',
            'cloud_menu_aside_text' => '文档中心|/document.html||0|book
联系咨询|/contact.html||0|headset',
            'slides_text' => '/web/cra1/assets/img/banner/banner-hw-1.jpg|/cart/goodsList.htm|让云与算力变得更简单|一站式 IDC 云服务平台，从算力、网络到安全防护，为企业把基础设施落到业务里|查看产品|/cart/goodsList.htm
/web/cra1/assets/img/banner/banner-hw-2.jpg|/cloud.html|弹性计算，随业务而动|云服务器按需创建，配置灵活，支持多种计费模式|选购云服务器|/cloud.html
/web/cra1/assets/img/banner/banner-hw-3.jpg|/contact.html|获取专属上云方案|提交业务场景与需求，由团队协助规划落地路径|咨询方案|/contact.html',
            'slides_effect' => 'cube',
            'show_capability' => '1',
            'cap1_title' => '丰富的云产品矩阵',
            'cap1_desc' => '从计算资源到安全服务，按业务组合选择。',
            'cap1_link' => '/cart/goodsList.htm',
            'panel_links_text' => '云服务器|/cloud.html
物理裸机|/dedicated.html
域名注册|/domain.html
SSL 证书|/ssl.html
短信服务|/sms.html
ICP 备案|/icp.html',
            'cap2_title' => '高性能基础设施',
            'cap2_desc' => '面向不同负载提供清晰的产品路径。',
            'cap2_link' => '/dedicated.html',
            'cap3_title' => '服务与支持',
            'cap3_desc' => '文档、公告、工单和人工咨询统一入口。',
            'cap3_link' => '/service-guarantee.html',
            'cap4_title' => '企业咨询',
            'cap4_desc' => '留下需求，由团队协助规划上云路径。',
            'cap4_link' => '/contact.html',
            // 功能卡（可增删改，v2.42）：每行「名称|描述|链接|图标」；旧 cap2~cap4_* 保留为回退
            'cap_cards_text' => '高性能基础设施|面向不同负载提供清晰的产品路径。|/dedicated.html|tabler:server-2
服务与支持|文档、公告、工单和人工咨询统一入口。|/service-guarantee.html|tabler:shield-check
企业咨询|留下需求，由团队协助规划上云路径。|/contact.html|tabler:headset',
            'show_pricing' => '1',
            'pricing_title' => '灵活的产品与计费',
            'pricing_desc' => '按需付费、包年包月多种模式，满足不同业务场景需求。',
            'pricing_link' => '/cart/goodsList.htm',
            'pricing_more_text' => '查看全部商品',
            'show_solutions' => '1',
            'sol_title' => '全场景全栈解决方案',
            'sol_desc' => '专业架构师针对丰富的业务场景，为千行百业构建稳定、易用的高性价比解决方案。',
            'sol_link' => '/solution.html',
            'sol_more_text' => '查看全部方案',
            'sol1_title' => '电商零售',
            'sol1_desc' => '面向活动流量、交易连续性和数据运营的基础设施组合。',
            'sol1_url' => '/solution/ecommerce.html',
            'sol2_title' => '金融科技',
            'sol2_desc' => '围绕安全、合规和可观测性规划业务承载能力。',
            'sol2_url' => '/solution/finance.html',
            'sol3_title' => '游戏娱乐',
            'sol3_desc' => '从计算、网络到运维支持，构建稳定的业务底座。',
            'sol3_url' => '/solution/game.html',
            'sol4_title' => '更多场景',
            'sol4_desc' => '教育、医疗、汽车、文旅和农业等行业方案总览。',
            'sol4_url' => '/solution.html',
            // 方案卡片（可增删改，v2.42）：每行「名称|描述|链接」；旧 sol1~sol4_* 保留为回退
            'sol_home_cards_text' => '电商零售|面向活动流量、交易连续性和数据运营的基础设施组合。|/solution/ecommerce.html
金融科技|围绕安全、合规和可观测性规划业务承载能力。|/solution/finance.html
游戏娱乐|围绕版本发布、联机访问和突发流量规划。|/solution/game.html
更多场景|教育、医疗、汽车、文旅和农业等行业方案总览。|/solution.html',
            'show_steps' => '1',
            'band_title' => '四步开启云上业务',
            'band_desc' => '从注册到产品开通，官网与会员中心保持一致的操作链路；文档与人工支持全程可用。',
            'band_link' => '/document.html',
            'band_more_text' => '查看接入文档',
            'band_item1_title' => '注册账户',
            'band_item1_desc' => '完成注册与实名认证，即可进入产品选购',
            'band_item2_title' => '选配产品',
            'band_item2_desc' => '按业务负载选择产品与规格，订单金额实时可见',
            'band_item3_title' => '在线开通',
            'band_item3_desc' => '支付后按产品规则开通，控制台统一管理',
            'band_item4_title' => '文档与支持',
            'band_item4_desc' => '接入文档、公告与人工咨询持续可用',
            // 快速上手步骤（可增删改，v2.42）：每行「标题|描述」；旧 band_item1~4_* 保留为回退
            'band_items_text' => '注册账户|完成注册与实名认证，即可进入产品选购
选配产品|按业务负载选择产品与规格，订单金额实时可见
在线开通|支付后按产品规则开通，控制台统一管理
文档与支持|接入文档、公告与人工咨询持续可用',
            'show_nodes' => '1',
            'nodes_title' => '全球服务地区',
            'nodes_desc' => '多地域资源接入与服务支持，地区持续扩展中。',
            'nodes_link' => '/contact.html',
            'nodes_more_text' => '咨询节点接入',
            'nodes_stat_text' => '覆盖地区|
服务节点|
机房数量|',
            'nodes_panel_text' => 'node|节点
rack|机房',
            'nodes_lines_text' => 'CN2 线路, 精品线路, 国际线路',
            'nodes_text' => '北京|116.41|39.90|BGP 多线接入 · 华北核心节点|18|6|BGP 多线
上海|121.47|31.23|华东双活机房 · 金融专区|22|7|精品线路|国际线路
成都|104.07|30.57|西南节点 · 灾备中心|9|3|国际线路
广州|113.26|23.13|华南出口 · 低时延骨干|14|5|CN2 线路|国际线路
香港|114.17|22.32|CN2 机房 · 三网直连|12|4|CN2 线路|精品线路
新加坡|103.82|1.35|东南亚枢纽 · 国际出口|10|3|国际线路
东京|139.69|35.69|日本节点 · 亚太低时延|8|3|精品线路
首尔|126.98|37.57|韩国节点 · 游戏加速|6|2|精品线路
孟买|72.88|19.08|南亚节点 · Tier III 机房|7|2|国际线路
迪拜|55.27|25.20|中东枢纽 · 欧亚中转|5|2|国际线路
法兰克福|8.68|50.11|欧洲核心 · DE-CIX 互联|11|4|国际线路|精品线路
伦敦|-0.13|51.51|欧洲节点 · 跨大西洋链路|9|3|国际线路
圣何塞|-121.89|37.34|北美西岸 · 科技园区|12|4|CN2 线路|国际线路
弗吉尼亚|-77.49|39.03|北美东岸 · 主干枢纽|13|5|精品线路|国际线路
圣保罗|-46.63|-23.55|南美节点 · 区域枢纽|6|2|国际线路
约翰内斯堡|28.05|-26.20|非洲节点 · 南部枢纽|4|2|国际线路
悉尼|151.21|-33.87|大洋洲节点 · 亚太南向|7|3|国际线路',
            'show_news' => '1',
            'news_title' => '新动向，新机遇',
            'news_desc' => '最新发展动态、最热行业资讯，与智简魔方一起见证云时代精彩瞬间。',
            'news_link' => '/document.html',
            'news_more_text' => '进入文档中心',
            'home_products_text' => '',
            'home_products_limit' => '8',
            'home_products_mobile_limit' => '3',
            'home_products_group' => '0',
            'show_figure_band' => '1',
            'figure_band_title' => '用数字看清平台规模',
            'figure_band_desc' => '节点、机房、服务响应与在线率，关键指标一次讲清。',
            'figure_band_link' => '/about.html',
            'figure_band_more_text' => '了解平台',
            'figure_band_rows_text' => 'home|服务地区|覆盖亚太与欧美主要城市||||30
home|自建机房|多线 BGP 接入，合规机房||||60
home|在线率|年度可用性承诺，不达标赔付|||%|99.9
home|响应时效|7×24 值守的首次响应时效|||分钟|15
about|团队规模|技术团队占比超过六成|||人|120+
about|服务客户|覆盖电商、金融、教育等行业||||5000+
about|运营年限|持续提供稳定服务的年限|||年|9
about|机房自建|自建与合作机房的合计数量||||60
recruit|技术岗位|研发与运维岗位持续招聘|||个|12
recruit|团队规模|技术与服务团队总人数|||人|120+
recruit|平均在职|核心团队平均在职时长|||年|3.5
service-guarantee|可用性|单实例月度可用性承诺|||%|99.9
service-guarantee|首次响应|P1 故障的首次响应时限|||分钟|15
service-guarantee|解决时效|P1 故障给出方案时限|||小时|2
service-guarantee|赔付比例|可用性不达标的最高补偿|||%|100
partner/cps|佣金比例|有效订单的最高佣金比例|||%|20
partner/cps|结算周期|佣金对账与到账周期|||月|次月
partner/cps|推广素材|可领取的推广素材类型|||类|6
partner/agent|折扣阶梯|代理等级对应的折扣档位|||档|5
partner/agent|专属支持|签约后配备的专属对接人|||人|1
partner/agent|市场物料|可申请的市场物料类型|||类|8
',
            'page_hero_rows_text' => 'about|关于智简魔方|了解站点配置的企业信息、资质荣誉与合作案例。||||
activities|最新活动|关注官网发布的产品活动与服务通知，活动规则以实际公告为准。||||
announce-details|公告详情|查看公告正文、发布时间与相关附件。||||
announce|官方公告|产品动态、系统通知与重要提醒，公告内容以实际发布信息为准。||||
cloud|云服务器|按需使用的弹性计算服务，覆盖从官网、应用后端到开发测试的常见业务负载，配置与费用随业务阶段调整。|选购云服务器|/cart/goodsList.htm|咨询上云方案|/contact.html
contact|联系我们|提交您的产品或业务需求，方便我们为您安排后续咨询。||||
dedicated|物理裸机|独享物理服务器资源，适合对性能隔离、硬件规格或部署边界有明确要求的业务。|查看裸机产品|/cart/goodsList.htm|咨询配置方案|/contact.html
document-details|文档详情|||||
document-result|文档搜索|||||
document-view|文档浏览|||||
document|文档中心|产品使用手册、常见问题与接入指南。||||
domain|域名注册|从域名查询、注册到解析和续费，集中管理企业品牌与业务入口，后缀和注册规则以选购页展示为准。|选购域名|/cart/goodsList.htm|咨询注册方案|/contact.html
domain_buy|域名购买指引|从查询到解析，用清晰的步骤完成域名购买与上线准备。|开始购买|/cart/goodsList.htm|咨询办理流程|/contact.html
domain_register|域名查询注册|输入品牌或项目关键词，先确认后缀可用状态，再进入注册流程。|查询可选域名|/cart/goodsList.htm||
domain_shop|域名商城|集中浏览常见域名后缀，按品牌、地域和业务属性选择注册方向，实时价格以购买流程为准。|浏览域名产品|/cart/goodsList.htm|咨询后缀选择|/contact.html
feedback|意见反馈|留下建议、问题或使用体验，帮助我们持续改进产品与服务。||||
icp|ICP 备案办理|围绕网站备案主体、域名、接入和材料准备提供流程协助，审核结果与办理周期以主管部门要求为准。|查看备案服务|/cart/goodsList.htm|咨询备案流程|/contact.html
model|企业云基础能力|以计算、网络、存储、安全和运维为基础，帮助企业按业务阶段搭建可管理、可扩展的云上环境。|查看云产品|/cart/goodsList.htm|咨询能力组合|/contact.html
news-classify|新闻分类|按分类浏览新闻资讯，分类内容以接口返回数据为准。||||
news-details|新闻详情|查看新闻正文、发布时间与相关附件。||||
news|新闻资讯|关注企业动态、产品进展与行业资讯。||||
recruit|人才招聘|关注云计算、基础设施与企业服务的伙伴，欢迎通过联系我们页面了解招聘信息。||||
rent|机柜租用|为服务器、网络设备和存储设备规划机柜空间，按 U 位、功耗、线路和扩容需求确认租用方案。|查看机柜产品|/cart/goodsList.htm|咨询机柜方案|/contact.html
service-guarantee|服务保障|从产品使用、故障反馈到业务咨询，提供清晰的支持入口与服务说明。||||
sms|短信服务|面向验证码、通知和营销等场景的短信发送能力，提供模板、接口、状态回执和用量管理，实际通道与计费以产品规则为准。|选购短信产品|/cart/goodsList.htm|咨询接入方案|/contact.html
ssl|SSL 证书|为网站和 API 配置 HTTPS 证书，覆盖证书选型、申请、部署和续期管理，具体品牌与验证方式以产品列表为准。|选购 SSL 证书|/cart/goodsList.htm|咨询证书方案|/contact.html
trademark|商标注册|围绕商标查询、注册申请、进度跟进和后续维护提供办理支持，审查结果与办理周期以主管部门规则为准。|查看办理服务|/cart/goodsList.htm|咨询注册方案|/contact.html
trusteeship|服务器托管|为自有服务器提供机房空间、网络、电力与运维协同，机房、线路、U 位和服务范围以实际订单与咨询确认内容为准。|查看托管产品|/cart/goodsList.htm|咨询托管方案|/contact.html
404|页面未找到|您访问的页面不存在或已被移除。可以从下方入口返回首页、查看文档，或直接联系我们的技术支持。|返回首页|/|查看文档|/document.html',
            'page_hero_anchor_text' => 'cloud|产品概览#overview,核心优势#advantages,适用场景#scenarios,计费与服务#service,常见问题#faq
dedicated|产品概览#overview,核心优势#advantages,适用场景#scenarios,服务保障#service,常见问题#faq
domain|产品概览#overview,核心优势#advantages,适用场景#scenarios,计费与服务#service,常见问题#faq
domain_buy|流程概览#overview,购买要点#advantages,适用场景#scenarios,服务说明#service,常见问题#faq
domain_register|查询概览#overview,查询要点#advantages,适用场景#scenarios,注册服务#service,常见问题#faq
domain_shop|商城概览#overview,选购优势#advantages,适用场景#scenarios,价格与服务#service,常见问题#faq
icp|服务概览#overview,服务优势#advantages,适用场景#scenarios,办理说明#service,常见问题#faq
model|能力概览#overview,核心能力#advantages,业务负载#scenarios,服务边界#service,常见问题#faq
rent|服务概览#overview,核心能力#advantages,适用场景#scenarios,计费与服务#service,常见问题#faq
sms|产品概览#overview,核心优势#advantages,适用场景#scenarios,计费与服务#service,常见问题#faq
ssl|产品概览#overview,核心优势#advantages,适用场景#scenarios,计费与服务#service,常见问题#faq
trademark|服务概览#overview,服务优势#advantages,适用场景#scenarios,办理说明#service,常见问题#faq
trusteeship|服务概览#overview,核心能力#advantages,适用场景#scenarios,服务范围#service,常见问题#faq
solution|按行业#industry,按工作负载#workload,方案方法#method,落地流程#process,常见问题#faq',
            'copy_partner_cps_program_text' => 't1|合作规则
d1|推广资格、适用产品和审核流程以当前合作政策为准。
t2|数据记录
d2|合作数据和有效订单按平台规则记录，具体口径以后台及协议为准。
t3|推广物料
d3|可用的产品介绍、活动信息与品牌素材以官方提供内容为准。
t4|专属沟通
d4|请提交推广渠道和受众信息，由合作团队确认后续安排。',
            'copy_partner_agent_program_text' => 't1|产品支持
d1|围绕产品能力与适用场景提供合作前的资料沟通。
t2|技术沟通
d2|根据客户场景协同讨论部署方式与服务边界。
t3|市场协同
d3|合作物料、品牌使用和联合推广以授权范围为准。
t4|持续对接
d4|合作政策、结算方式和支持级别请以双方确认内容为准。',
            'copy_partner_cps_cta_text' => 'title|合作政策需要单独确认
desc|页面不预设收益或佣金数据，实际合作条件请以双方确认的正式信息为准。
btn|联系合作团队
url|/contact.html',
            'copy_partner_agent_cta_text' => 'title|先描述您的合作场景
desc|留下所在区域、客户类型和计划推广的产品方向，方便合作团队进一步沟通。
btn|联系合作团队
url|/contact.html',
            'copy_page404_text' => 'desc|您访问的页面不存在或已被移除。可以从下方入口返回首页、查看文档，或直接联系我们的技术支持。
btn1|返回首页
url1|/
btn2|查看文档
url2|/document.html',
            'show_timeline_road' => '0',
            'timeline_road_title' => '一路走来的关键节点',
            'timeline_road_desc' => '从机房起步到算力平台，每一步都围绕「把基础设施做实」。',
            'timeline_road_link' => '/about.html',
            'timeline_road_more_text' => '查看企业信息',
            'timeline_road_rows_text' => 'about|机房起步|以自建机房承接第一批托管业务|2016
about|多线接入|完成三网直连与 BGP 多线改造|2018
about|云化升级|推出云服务器与裸金属产品线|2021
about|算力平台|上线模型服务与算力调度能力|2024',
            'show_compare_split' => '0',
            'compare_split_title' => '换个做法，差别在哪',
            'compare_split_desc' => '同样是上云，路径与后续维护成本可以完全不同。',
            'compare_split_left' => '常见做法',
            'compare_split_right' => '我们的做法',
            'compare_split_rows_text' => '*|资源按年包死，闲时也付费|按需与包年并行，闲时可释放|支持随时升降配
*|出问题只给工单编号|专属技术对接，直达工程师|平均 15 分钟响应
*|网络走公网，高峰抖动|三网直连 + BGP 多线|高峰期自动切换
cloud|只给固定几个规格|按 CPU、内存、云盘自由组合|配置灵活
cloud|扩容需要停机迁移|在线升配，多数变更重启即生效|少停机
cloud|快照另收高价|快照按实际容量计费，支持自定义策略|计费透明
dedicated|资源存在超卖|物理整机独享，性能表现可预期|零超卖
dedicated|需自行联系机房|提供带外管理与现场运维支持|有求必应
dedicated|网络类型单一|三网直连与 BGP 多线可选，跨境线路可选|线路可选
ssl|签发要等好几天|DV 证书分钟级签发，OV/EV 明确时效|最快 10 分钟
ssl|部署要自己摸索|提供安装指引与常见平台部署脚本|免费协助
ssl|到期容易忘续|到期前多渠道提醒，支持自动续费|主动提醒
sms|通道单一易延迟|三网合一通道，支持多通道热备|高到达率
sms|按提交量计费|按成功下发条数计费，失败不计费|按成功计费
sms|模板审核慢|提供模板预检，减少反复驳回|预检加速
domain|注册后解析另收费|基础 DNS 解析免费，支持常用记录类型|解析免费
domain|转移流程繁琐|提供转移码与转移指引，流程可查|流程透明
domain|到期即被抢注|到期前多次提醒，支持自动续费与赎回期说明|主动保护
icp|流程不清楚反复退|提供材料清单与填写示例，减少退回|一次通过
icp|进度无法查询|提交后可在控制台查看当前环节|进度可见
icp|收取服务费|备案协助全程免费|免费协助
trademark|类别选择没建议|按业务给出类别建议，避免漏类被抢注|专业建议
trademark|进度不透明|形式审查与实质审查节点同步通知|节点可查
trademark|到期忘记续展|到期前提醒并协助办理续展|主动提醒
model|算力规格不透明|按 GPU 型号与显存明示档位|规格透明
model|环境要自己搭|预置主流框架镜像，加载权重即可用|开箱即用
model|只有推理没有训练|推理与微调训练两类负载都支持|两类负载
rent|周期不灵活|支持月付与年付，长周期可申请折扣|周期灵活
rent|硬件不可定制|按业务指定 CPU、内存与硬盘组合|按需定制
rent|故障无人处理|租用期内硬件由平台维护更换|平台维护
trusteeship|按整柜起租|支持整柜与零散 U 位托管|按 U 计费
trusteeship|机房条件参差|双路市电 + UPS + 柴发，恒温恒湿|T3+ 标准
trusteeship|现场无人响应|提供重启、重装与硬件更换的现场服务|7×24 响应
solution|方案只给清单|按业务场景梳理架构并说明取舍|有取舍
solution|落地没人跟进|提供落地路径与阶段目标建议|陪跑落地
solution|成本不透明|给出分阶段投入与成本预估|预算可控
',
            'show_quote_stage' => '0',
            'quote_stage_text' => '把复杂留给平台，把简单留给业务——这是我们做每一个产品时的判断标准。',
            'quote_stage_author' => '智简魔方',
            'quote_stage_role' => '产品与技术团队',
            'quote_stage_link' => '/about.html',
            'quote_stage_more_text' => '了解我们的坚持',
            'quote_stage_points_text' => '*|稳定优先|宁可少一个功能，也不让线上多一次抖动
*|口径透明|计费、规格、SLA 全部写清楚，不藏条件
*|可迁移|不用私有锁绑定业务，随时可以搬走',
            'show_rail_scroll' => '1',
            'rail_scroll_title' => '按业务阶段选型',
            'rail_scroll_desc' => '从验证到规模化，每个阶段都有对应的产品组合。',
            'rail_scroll_link' => '/solution.html',
            'rail_scroll_more_text' => '查看解决方案',
            'rail_scroll_rows_text' => '*|验证期|用按量实例快速搭起环境，验证业务模型|||轻量起步
*|成长期|接入负载均衡与多可用区，支撑访问增长|||弹性扩容
*|成熟期|混合部署与专线接入，兼顾成本与合规|||稳定承载',
            'show_icon_ribbon' => '1',
            'icon_ribbon_title' => '平台基础能力',
            'icon_ribbon_link' => '/cloud.html',
            'icon_ribbon_more_text' => '查看产品',
            'icon_ribbon_rows_text' => '*|监控告警|指标、日志与告警联动，异常先于业务感知||tabler:activity|运维
*|快照备份|自动快照与异地备份，误操作可回滚||tabler:shield-check|安全
*|开放接口|API 与控制台能力一致，支持自动化编排||tabler:code|集成
*|迁移协助|提供迁移方案与执行支持，降低迁云成本||tabler:headset|服务
*|账单明细|费用构成逐项可查，支持按项目分摊核对||tabler:receipt|账务
*|备案协助|免费协助 ICP 备案，材料与流程全程跟进||tabler:file-text|合规
contact|电话直达|紧急问题可拨热线直达值班工程师||tabler:phone|通道
contact|工单跟踪|提交后可在控制台查看处理进度||tabler:ticket|通道
contact|在线咨询|工作日在线答疑，非工作时间留言||tabler:message|通道
news-classify|产品发布|新功能与新规格上线通知||tabler:rocket|分类
news-classify|行业观察|趋势解读与最佳实践分享||tabler:chart-line|分类
news-classify|活动公告|优惠活动与规则说明||tabler:gift|分类
recruit|技术氛围|每周技术分享与内部开源文化||tabler:bulb|文化
recruit|成长路径|双通道晋升，技术与管理并行发展||tabler:trending-up|发展
recruit|工作方式|弹性工时与远程协作，结果导向||tabler:home|方式
feedback|产品缺陷|功能异常与性能问题反馈||tabler:bug|缺陷
feedback|功能建议|新需求与改进想法提交||tabler:bulb|建议
feedback|服务体验|支持过程与响应质量的评价||tabler:star|体验
news|产品动态|功能发布与规格调整||tabler:rocket|动态
news|价格调整|计费变化与优惠说明||tabler:receipt|价格
news|机房动态|节点上线与线路优化||tabler:world|网络
announce|产品变更|规格与功能调整公告||tabler:adjustments|变更
announce|维护计划|计划内维护时间安排||tabler:tool|维护
announce|政策调整|服务条款与规则更新||tabler:file-text|政策
news-details|标注版本|技术内容标注适用版本||tabler:versions|版本
news-details|附带指引|重要公告附操作说明||tabler:list-check|指引
news-details|相关阅读|同主题内容关联推荐||tabler:link|关联
announce-details|生效时间|明确标注变更生效时点||tabler:clock|时间
announce-details|影响范围|列出受影响产品与地域||tabler:target|范围
announce-details|操作建议|给出需要用户执行的动作||tabler:checklist|建议
document-details|适用版本|标注适用产品版本||tabler:versions|版本
document-details|示例代码|可运行片段便于调试||tabler:code|示例
document-details|参数说明|逐项说明字段含义与取值||tabler:list-details|参数
document-view|多方式检索|按产品名或错误码查找||tabler:search|检索
document-view|章节导航|长文档支持章节快速跳转||tabler:list|导航
document-view|一键反馈|文档有误可直接反馈||tabler:message-report|反馈
service-guarantee|分级响应|按故障等级匹配响应时限||tabler:alert-triangle|响应
service-guarantee|赔付机制|不达标按比例补偿代金券||tabler:cash|赔付
service-guarantee|维护窗口|计划维护提前公告并避开高峰||tabler:calendar|维护
',
            'show_spec_matrix' => '1',
            'spec_matrix_title' => '规格与计费口径',
            'spec_matrix_desc' => '下面这些参数决定实际账单，选型前建议先确认。',
            'spec_matrix_link' => '/document.html',
            'spec_matrix_more_text' => '查看计费文档',
            'spec_matrix_rows_text' => 'home|计费方式|按量计费按小时结算，包年包月一次性支付||支持随时切换
home|带宽口径|独享带宽与共享带宽分别计费，超出按峰值补差||峰值计费
home|快照与备份|快照占用独立存储空间，按实际容量计费||独立计费
home|退款规则|包年包月产品 3 天内无理由退款，按量产品不涉及||3 天无忧
cloud|弹性升降配|支持在线升配 CPU 与内存，云盘扩容无需停机||随时调整
cloud|镜像与快照|系统与应用镜像可选，快照保留回滚窗口||开箱即用
cloud|网络与安全组|私有网络隔离实例，安全组按需放行端口||灵活组网
dedicated|整机独享|物理资源不与他人共享，性能表现可预期||零超卖
dedicated|带外管理|提供 IPMI/KVM 带外控制台，可远程装系统||独立控制
dedicated|多线接入|三网直连与 BGP 多线，跨境线路可选||低延迟
ssl|证书类型|DV/OV/EV 三类可选，按验证强度与展示效果区分||按需选择
ssl|签发时效|DV 证书分钟级签发，OV/EV 需人工核验资质||最快 10 分钟
ssl|部署支持|提供安装指引与常见平台的一键部署脚本||免费协助
sms|发送通道|三网合一通道，支持验证码与通知两类模板||高到达率
sms|计费单位|按成功下发条数计费，失败不计费||按量计费
sms|签名与模板|签名与模板需先报备审核，通过后即可调用||合规报备
domain|域名后缀|覆盖 .com/.cn/.net 等主流后缀，实时查询可注册状态||多种后缀
domain|实名认证|国内域名需完成实名认证后方可解析生效||合规要求
domain|解析服务|免费提供基础 DNS 解析，支持 A/CNAME/MX 等记录||免费用
icp|备案主体|企业或个人主体均可备案，需与域名实名信息一致||主体一致
icp|审核时长|提交后由接入商初审，通常 1-3 个工作日出结果||1-3 工作日
icp|免费协助|提供材料清单与流程指导，全程免费协助提交||免费
trademark|注册类别|按尼斯分类共 45 类，可多类同时申请||45 类可选
trademark|审查周期|形式审查约 1 个月，实质审查约 4-6 个月||4-6 个月
trademark|专用期限|注册商标专用权有效期 10 年，期满可续展||10 年
model|算力规格|按 GPU 型号与显存容量划分档位，支持按需与包月||多档可选
model|推理与训练|同时支持模型推理与微调训练两类负载||两类负载
model|镜像环境|预置主流框架镜像，开箱即可加载模型权重||预置镜像
rent|租用周期|支持月付与年付，长周期可申请折扣||灵活周期
rent|硬件配置|可按业务指定 CPU/内存/硬盘组合，整机交付||按需定制
rent|产权归属|租用期内设备由平台维护，期满可续租或升级||平台维护
trusteeship|托管规格|按 U 位与电力计费，支持整柜与零散托管||按 U 计费
trusteeship|机房条件|双路市电 + UPS + 柴发备份，恒温恒湿环境||T3+ 标准
trusteeship|运维支持|提供重启、重装与硬件更换等现场运维服务||7×24 响应
domain_buy|域名来源|已注册优质域名，可一口价直接购买||现成可购
domain_buy|过户流程|协助完成域名过户与解析交接||全程协助
domain_buy|价格说明|一口价含域名费用，续费按注册局标准||价格透明
domain_register|注册年限|支持 1-10 年注册，长年限享优惠||灵活年限
domain_register|实名要求|国内后缀需实名认证后解析生效||合规要求
domain_register|解析赠送|注册即赠基础 DNS 解析服务||免费赠送
domain_shop|抢注服务|监控到期域名并自动尝试抢注||自动监控
domain_shop|经纪服务|一对一协助与持有人谈判购买||专人协助
domain_shop|价值评估|提供域名价值评估参考报告||参考报告
contact|响应时效|工单 15 分钟内首次响应，紧急问题电话直达工程师||15 分钟
contact|服务时段|技术支持 7×24 值守，商务咨询工作日 9:00-18:00||7×24 值守
contact|服务范围|涵盖产品选型、迁移协助、故障排查与架构咨询||全流程
feedback|受理范围|产品缺陷、功能建议、服务体验与文档纠错均可提交||四类受理
feedback|处理时效|一般反馈 2 个工作日内答复，缺陷类问题优先处理||2 工作日
feedback|闭环回访|问题解决后进行一次回访确认，避免同问题重复提交||跟踪闭环
activities|参与资格|完成实名认证的注册用户均可参与，企业用户享专场权益||实名即可
activities|优惠叠加|活动优惠与代金券可叠加使用，不与渠道折扣同享||可叠加
activities|有效期|活动优惠自领取起 30 天内有效，逾期自动失效||30 天
service-guarantee|可用性承诺|单实例月度可用性不低于 99.9%，不达标按比例赔付||99.9%
service-guarantee|故障响应|P1 级故障 15 分钟响应、2 小时内给出处理方案||分级响应
service-guarantee|数据可靠性|关键数据多副本存储，提供快照与备份双重保护||多副本
news|更新频率|产品动态与行业资讯按周更新，重要通知当日发布||按周更新
news|内容范畴|涵盖产品发布、价格调整、机房动态与行业观察||四类内容
news|订阅方式|支持文档中心订阅与公告栏实时查看两种方式||两种方式
announce|公告类型|分为产品变更、维护计划与政策调整三类公告||三类
announce|生效说明|涉及计费与规格的变更提前 30 天公告，保障过渡期||提前 30 天
announce|历史查询|历史公告在列表页按时间归档，可回溯查询||可回溯
document-result|搜索范围|覆盖接入指南、产品手册、常见问题与 API 文档||四类文档
document-result|结果排序|按相关度排序，标题命中优先于正文命中||相关度优先
news-classify|分类导航|按产品发布、行业资讯、活动公告等维度分类浏览||多维分类
news-classify|相关推荐|同分类下的热门内容在列表侧展示，便于连续阅读||关联阅读
news-details|内容时效|技术类内容标注适用版本，过期内容会加注说明||标注版本
news-details|延伸材料|重要公告附带操作指引或文档链接，便于落地执行||附带指引
announce-details|执行时间|涉及变更的公告明确标注生效时间与影响范围||明确标注
announce-details|影响范围|说明受影响的产品、地域与用户类型，便于自查||范围清晰
document-details|适用版本|每篇文档标注适用产品版本，避免跨版本误用||标注版本
document-details|示例代码|接口类文档附带可运行示例，复制即可调试||附带示例
document-view|检索建议|支持按产品名或错误码检索，快速定位到章节||多方式检索
document-view|反馈入口|文档有误可一键反馈，编辑团队会核实并修订||可反馈
',
            'show_faq_board' => '0',
            'faq_board_title' => '上云前，这些常被问到',
            'faq_board_desc' => '如果下面没有你要的答案，直接联系技术支持，我们按你的场景给出结论。',
            'faq_board_link' => '/contact.html',
            'faq_board_more_text' => '联系技术支持',
            'faq_board_rows_text' => '*|需要备案才能使用吗|面向中国大陆的网站需要完成 ICP 备案，平台提供免费备案协助；纯后端接口或境外业务可免备案。
*|可以随时升级配置吗|支持在线升配，CPU 与内存变更通常在重启后生效；云盘扩容无需停机。
*|数据能迁走吗|可以。平台不限制数据导出，也提供迁移协助，避免业务被绑定。
*|怎样获得发票|控制台提交开票申请，审核通过后开具电子发票，支持专票与普票。
contact|多久能收到回复|工单 15 分钟内首次响应；紧急故障可走电话通道直达值班工程师。
contact|可以上门或远程协助吗|支持远程协助排查；涉及机房的现场操作由运维团队代为执行。
contact|能先做方案评估吗|可以。提交业务场景与规模，架构师会给出选型与成本评估建议。
404|找不到想要的页面怎么办|可能是地址已变更。建议从产品目录或文档中心重新进入，或直接联系技术支持。
404|旧地址还能访问吗|部分旧地址保留跳转，若已失效请以导航栏与页脚入口为准。
document|文档看不懂怎么办|每篇文档底部可提交反馈；也可通过工单把具体章节发给技术团队，会补充说明。
document|有视频教程吗|快速开始类文档配有操作截图与命令示例，视频教程正在陆续补充中。
feedback|反馈后多久有结果|一般反馈 2 个工作日内答复；缺陷类问题会优先处理并同步进展。
feedback|可以匿名反馈吗|支持匿名提交；若希望收到答复，建议留下联系方式以便回访。
activities|优惠券没到账|请在控制台「我的优惠券」确认；若仍未到账，提交工单并附上活动页面截图。
activities|活动能叠加吗|活动优惠与代金券可叠加，但不与渠道专属折扣同享，以活动规则为准。
service-guarantee|可用性怎么计算|按单实例月度实际可用时间占比计算，排除计划内维护窗口。
service-guarantee|不达标怎么赔付|经核实后在次月账单中以代金券形式按比例补偿，具体标准见 SLA 文档。
news|资讯可以订阅吗|可以在文档中心订阅更新，或关注公告栏获取产品变更与维护通知。
announce|维护会提前通知吗|计划内维护至少提前 24 小时公告，紧急维护会同步说明原因与影响。
news-classify|分类会调整吗|分类随内容体系演进调整，历史内容会自动归入新的分类下。
news-details|内容过期了怎么办|标注适用版本的内容过期后会加注说明，可参考最新版本文档。
announce-details|变更影响我的业务吗|公告中会列出受影响产品与地域；如有疑问可提交工单确认。
document-details|示例代码能直接用吗|示例为最小可运行片段，生产环境请补充错误处理与鉴权配置。
document-view|找不到某个接口|可用错误码或产品名检索；仍未找到请反馈，会补充到文档中。
partner/cps|如何加入推广计划|注册账号后在合作页面提交申请，审核通过即可获取推广链接与素材。
partner/cps|佣金如何结算|按有效订单金额的比例结算，次月对账后打入账户余额，可申请提现。
partner/agent|代理权益有哪些|包含阶梯折扣、专属支持与市场物料，具体权益按签约等级确定。
partner/agent|如何升级等级|按累计业绩自动评估等级，达到门槛后在合作后台提交升级申请。
solution|方案可以定制吗|可以。把业务场景与规模提交给架构师，会给出针对性的选型与部署建议。
solution|方案落地要多久|标准方案通常 1-3 天完成部署；涉及迁移与专线的方案按评估周期执行。
solution/ecommerce|大促前需要提前扩容吗|建议提前压测并按峰值预留资源，支持临时升配与弹性扩容应对流量高峰。
solution/ecommerce|如何保障交易数据安全|通过私网隔离、安全组与 SSL 加密传输，结合快照与备份保证数据可恢复。
solution/finance|满足合规要求吗|机房与网络满足等保要求，支持专线接入与数据不出域部署方案。
solution/finance|能否做双活部署|支持多可用区双活架构，配合负载均衡实现故障自动切换。
solution/game|能应对开服峰值吗|支持分钟级批量创建实例，配合弹性伸缩应对开服与活动期流量峰值。
solution/game|延迟敏感怎么选线路|建议选择 BGP 多线与就近机房，跨境业务可选 CN2 精品线路降低延迟。
solution/auto|车联网数据量大怎么办|采用对象存储承载海量数据，配合消息队列削峰，按实际用量计费。
solution/auto|需要多地部署吗|建议按业务覆盖区域就近部署，减少数据传输延迟并满足属地合规。
solution/travel|旅游旺季流量波动大|用弹性伸缩按负载自动增减实例，闲时释放以控制成本。
solution/travel|图片视频存储成本高|建议转存对象存储并配合 CDN 分发，显著降低带宽与存储开销。
solution/education|在线课堂卡顿怎么办|优先排查带宽与线路质量，建议使用独享带宽并接入就近节点。
solution/education|考试期间如何保稳|考试前完成压测与资源预留，关键时段关闭非必要变更操作。
solution/medical|医疗数据能出域吗|建议采用私有化部署或专属区域，确保数据不出域并满足行业监管要求。
solution/medical|影像数据存储方案|大容量影像建议使用对象存储，配合生命周期策略降低长期保存成本。
solution/agriculture|采集点分散怎么接入|通过公网或专线就近接入，边缘侧做数据汇聚后统一回传。
solution/agriculture|设备离线影响业务吗|边缘侧支持断网续传，恢复后自动补传，避免数据缺失。
',
            'show_step_ribbon' => '1',
            'step_ribbon_title' => '五步完成接入',
            'step_ribbon_desc' => '从注册到业务上线，每步都有对应文档与人工支持。',
            'step_ribbon_link' => '/document.html',
            'step_ribbon_more_text' => '开始接入',
            'step_ribbon_rows_text' => '*|注册与实名|完成账号注册与实名认证|1 个工作日
*|选择产品|按业务场景确定规格与计费方式|当天
*|创建实例|选择镜像与网络，分钟级开通|10 分钟
*|部署业务|迁移数据、配置域名与安全组|按需
*|观察与优化|结合监控调整规格与网络|持续
document|定位文档|按产品名或错误码检索|即时
document|按需阅读|接入指南、手册或常见问题|按需
document|动手验证|按示例创建实例并联调|当天
document|反馈补充|文档未覆盖的问题可提交|2 工作日
recruit|投递简历|选择方向提交简历与作品|即时
recruit|简历筛选|HR 与技术负责人双向评估|3 个工作日
recruit|技术面试|围绕实际项目与技术深度交流|1-2 轮
recruit|发放 Offer|沟通岗位与薪酬细节|1 周内
partner/cps|注册账号|完成注册与实名认证|即时
partner/cps|提交申请|在合作页面提交推广申请|即时
partner/cps|获取素材|审核通过后领取推广链接|1 个工作日
partner/cps|结算佣金|次月对账后打入账户余额|次月
partner/agent|提交意向|填写代理申请与业务背景|即时
partner/agent|资质评估|评估业务能力与合作等级|3 个工作日
partner/agent|签约开通|签署协议并开通代理后台|1 周内
partner/agent|业务支持|获取折扣、物料与专属支持|持续
',
            'show_duo_feature' => '1',
            'duo_feature_title' => '四个被反复验证的工程决定',
            'duo_feature_desc' => '这些决定不炫技，但决定了业务在高峰时是否稳。',
            'duo_feature_rows_text' => '*|网络先行|先把线路与互联做扎实，再谈上层产品。高峰期是否抖动，取决于这一步。|||可用性|99.9
*|存储双活|关键数据落双副本，配合快照保留回滚窗口，避免单点故障演变成事故。|||副本数|2
*|资源隔离|独享型实例不与他人争抢资源，性能表现可预期。|||超卖率|0
*|计费透明|规格、带宽、快照的计费口径全部写在文档里，账单可逐项核对。|||口径透明|100%',
            'show_choice_ladder' => '1',
            'choice_ladder_title' => '三档配置，按需选择',
            'choice_ladder_desc' => '同一产品线下的典型档位，也可完全自定义。',
            'choice_ladder_link' => '/cart/goodsList.htm',
            'choice_ladder_more_text' => '对比全部配置',
            'choice_ladder_rows_text' => '*|入门型|适合个人站点与测试环境，2 核 4G 起步|/cloud.html||/ 月起|69
*|推荐型|适合中小生产业务，4 核 8G 配独享带宽|/cloud.html||推荐|199
*|企业型|适合核心业务，8 核起配多可用区部署|/dedicated.html||/ 月起|599',
            'show_link_tiles' => '1',
            'link_tiles_title' => '全部产品入口',
            'link_tiles_link' => '/cart/goodsList.htm',
            'link_tiles_more_text' => '商品目录',
            'link_tiles_rows_text' => '*|云服务器|弹性计算|/cloud.html|tabler:server
*|物理裸机|独享算力|/dedicated.html|tabler:cpu
*|域名注册|域名与解析|/domain.html|tabler:world
*|SSL 证书|站点加密|/ssl.html|tabler:shield-lock
*|短信服务|通知与验证码|/sms.html|tabler:message
*|ICP 备案|免费协助|/icp.html|tabler:file-text
*|服务器租用|整机租用|/rent.html|tabler:building-warehouse
*|服务器托管|机房托管|/trusteeship.html|tabler:server-2
*|商标注册|知识产权|/trademark.html|tabler:certificate
*|模型服务|算力与推理|/model.html|tabler:cpu-2
*|对象存储|弹性容量|/cloud.html|tabler:database
*|负载均衡|流量分发|/cloud.html|tabler:arrows-split-2',

            // 各页独立磁贴（v2.43）：页面专属入口不再混在首页磁贴里，后台按页独立编辑
            'link_tiles_news_text' => '公告列表|平台公告与变更通知|/announce.html|tabler:speakerphone
文档中心|接入指南与产品手册|/document.html|tabler:book
解决方案|按场景选择架构|/solution.html|tabler:layout-grid',
            'link_tiles_announce_text' => '新闻资讯|行业动态与观察|/news.html|tabler:news
文档中心|接入指南与手册|/document.html|tabler:book
服务保障|SLA 与支持说明|/service-guarantee.html|tabler:shield-check',
            'link_tiles_document_result_text' => '文档中心|返回文档首页|/document.html|tabler:book
常见问题|高频问题速查|/document.html|tabler:help-circle
联系支持|提交工单咨询|/contact.html|tabler:headset',
            'link_tiles_news_classify_text' => '新闻资讯|行业动态与观察|/news.html|tabler:news
官方公告|平台公告与通知|/announce.html|tabler:speakerphone
文档中心|技术文档与指引|/document.html|tabler:book',
            'link_tiles_news_details_text' => '返回列表|浏览更多资讯|/news.html|tabler:list
文档中心|查阅技术文档|/document.html|tabler:book
联系支持|有问题随时咨询|/contact.html|tabler:headset',
            'link_tiles_announce_details_text' => '返回公告列表|查看全部公告|/announce.html|tabler:list
服务保障|了解 SLA 承诺|/service-guarantee.html|tabler:shield-check
联系支持|提交工单咨询|/contact.html|tabler:headset',
            'link_tiles_document_details_text' => '返回文档中心|浏览全部文档|/document.html|tabler:book
搜索文档|按关键词检索|/document-result.html|tabler:search
联系支持|文档未覆盖的问题|/contact.html|tabler:headset',
            'link_tiles_document_view_text' => '文档中心|返回文档首页|/document.html|tabler:book
搜索文档|按关键词检索|/document-result.html|tabler:search
联系支持|提交工单咨询|/contact.html|tabler:headset',

            // 各页磁贴标题/链接（v2.43）：避免首页标题「全部产品入口」被跨页复用
            'link_tiles_news_title' => '关联入口',
            'link_tiles_news_more_text' => '新闻首页',
            'link_tiles_news_link' => '/news.html',
            'link_tiles_announce_title' => '关联入口',
            'link_tiles_announce_more_text' => '公告首页',
            'link_tiles_announce_link' => '/announce.html',
            'link_tiles_document_result_title' => '常用入口',
            'link_tiles_document_result_more_text' => '文档中心',
            'link_tiles_document_result_link' => '/document.html',
            'link_tiles_news_classify_title' => '关联入口',
            'link_tiles_news_classify_more_text' => '新闻首页',
            'link_tiles_news_classify_link' => '/news.html',
            'link_tiles_news_details_title' => '相关入口',
            'link_tiles_news_details_more_text' => '新闻首页',
            'link_tiles_news_details_link' => '/news.html',
            'link_tiles_announce_details_title' => '相关入口',
            'link_tiles_announce_details_more_text' => '公告首页',
            'link_tiles_announce_details_link' => '/announce.html',
            'link_tiles_document_details_title' => '相关入口',
            'link_tiles_document_details_more_text' => '文档中心',
            'link_tiles_document_details_link' => '/document.html',
            'link_tiles_document_view_title' => '相关入口',
            'link_tiles_document_view_more_text' => '文档中心',
            'link_tiles_document_view_link' => '/document.html',
            'show_price_slider' => '0',
            'price_slider_title' => '主流配置的价格对照',
            'price_slider_desc' => '同一口径下的典型配置，实际价格以选购页为准。',
            'price_slider_link' => '/cart/goodsList.htm',
            'price_slider_more_text' => '查看全部配置',
            'price_slider_rows_text' => '*|2 核 4G|通用型，适合个人站点与开发测试|/cloud.html||轻量|69
*|4 核 8G|通用型，适合中小生产业务|/cloud.html||推荐|199
*|8 核 16G|计算型，适合中高并发与数据处理|/cloud.html||高频|399
*|16 核 32G|计算型，适合核心业务与集群节点|/cloud.html||企业|799',
            'price_slider_dedicated_text' => 'E5 单路|独享物理整机，适合中等负载业务|/dedicated.html||入门|899
E5 双路|双路 CPU 与更大内存，适合数据库场景|/dedicated.html||推荐|1699
金牌双路|高主频金牌 CPU，适合高并发计算|/dedicated.html||高频|2599',
            'price_slider_ssl_text' => 'DV 单域名|分钟级签发，适合个人与测试站点|/ssl.html||入门|免费
OV 单域名|需企业资质核验，展示组织信息|/ssl.html||推荐|399
EV 多域名|最高验证等级，地址栏展示企业名|/ssl.html||企业|1999',
            'price_slider_sms_text' => '1 万条|验证码与通知短信，按成功条数计费|/sms.html||轻量|450
10 万条|适合中大型业务的月度用量|/sms.html||推荐|4200
50 万条|大批量发送，单价进一步降低|/sms.html||高频|19500',
            'price_slider_domain_text' => '.com|主流国际后缀，注册与续费同价|/domain.html||常用|79
.cn|国内常用后缀，需实名认证|/domain.html||国内|39
.net|老牌国际后缀，适合技术类站点|/domain.html||常用|89',
            'price_slider_icp_text' => '备案协助|材料指导与流程跟进，全程免费|/icp.html||免费|0',
            'price_slider_trademark_text' => '单类申请|一个类别的商标注册申请|/trademark.html||基础|300
三类申请|覆盖主营与关联类别|/trademark.html||推荐|800
全类保护|45 类全类注册保护品牌|/trademark.html||企业|9800',
            'price_slider_model_text' => '入门算力|单卡推理，适合模型验证与小流量|/model.html||入门|899
标准算力|多卡推理，适合生产环境部署|/model.html||推荐|2999
训练算力|多卡训练集群，适合微调训练|/model.html||高频|8980',
            'price_slider_rent_text' => '月付租用|按月计费的整机租用方案|/rent.html||灵活|499
年付租用|年付享折扣，适合长期稳定业务|/rent.html||推荐|4990',
            'price_slider_trusteeship_text' => '1U 托管|单个 U 位托管，含基础电力|/trusteeship.html||入门|199
半柜托管|半个机柜，含更多电力与带宽|/trusteeship.html||推荐|1299
整柜托管|整柜独享，电力与带宽可定制|/trusteeship.html||企业|2399',
            'price_slider_domain_buy_text' => '.com 一口价|已注册优质域名的购买方案|/domain_buy.html||精品|1200
.cn 一口价|国内后缀的一口价域名|/domain_buy.html||常用|680',
            'price_slider_domain_register_text' => '.com 注册|主流国际后缀注册|/domain_register.html||常用|79
.cn 注册|国内后缀注册，需实名|/domain_register.html||国内|39
.net 注册|技术类站点常用后缀|/domain_register.html||常用|89',
            'price_slider_domain_shop_text' => '域名抢注|到期域名监控与抢注服务|/domain_shop.html||增值|99
域名经纪|一对一协助谈判购买心仪域名|/domain_shop.html||增值|500
域名评估|提供域名价值评估参考报告|/domain_shop.html||增值|199',


            'show_stack_board' => '0',
            'stack_board_title' => '平台按这四层搭起来',
            'stack_board_desc' => '从物理延伸到业务入口，每层各自可替换、可独立演进。',
            'stack_board_link' => '/document.html',
            'stack_board_more_text' => '查看技术文档',
            'stack_board_rows_text' => '*|物理设施|自建与合规机房，多线 BGP 接入，双路市电与柴发备份|||基础设施
*|资源层|计算、存储、网络的池化管理，支持独享与共享两种形态|||资源池化
*|平台服务|镜像、快照、监控、备份与 API，构成日常运维的基本面|||平台能力
*|业务入口|负载均衡、域名解析、证书与防护，把流量安全送到业务|||接入层',
            'show_proof_wall' => '1',
            'proof_wall_title' => '客户怎么说',
            'proof_wall_desc' => '来自不同规模业务的真实反馈，帮助我们持续校准产品方向。',
            'proof_wall_link' => '/contact.html',
            'proof_wall_more_text' => '成为客户',
            'proof_wall_rows_text' => '*|王工|迁移过程比预想顺利，网络调优是他们主动帮我们做的，业务几乎没停。|电商平台 技术负责人
*|李先生|高峰期的稳定性是我们最看重的，换到这边之后，大促没有再出现过抖动。|在线教育 运维主管
*|张女士|计费口径写得清楚，账单能逐项核对，这点在预算管理上很省心。|SaaS 创业公司 财务
*|陈工|技术支持响应快，问题能直接对到工程师，不用反复描述背景。|游戏工作室 后端
*|刘先生|跨境线路质量比之前用的方案稳定，延迟曲线明显平了不少。|跨境业务 架构师
solution|赵架构师|按我们的业务峰值做了架构梳理，给出的方案没有多余组件，落地很快。|物流平台 架构师
solution|孙主管|方案里把扩容路径写清楚了，我们按阶段投入，没有一次性压太多预算。|连锁零售 运维主管
solution/ecommerce|周工|大促前他们协助做了压测和预留，当天峰值比去年高一倍，系统没出问题。|电商平台 技术负责人
solution/ecommerce|吴女士|订单数据做了双备份，上次误删几分钟就回滚了，没影响到用户。|美妆品牌 数据负责人
solution/finance|郑工|合规要求比较严，他们提供了专线和数据不出域的方案，顺利过了内部审计。|支付公司 安全负责人
solution/finance|王主管|双活架构上线后做过一次故障演练，切换时间在可接受范围内。|证券机构 运维主管
solution/game|何工|开服当天批量创建实例很快就绪，没有出现排队等待的情况。|游戏工作室 后端
solution/game|杨先生|换了 CN2 线路之后，玩家反馈的延迟投诉明显减少了。|手游发行 技术负责人
solution/auto|徐工|车端数据量很大，用对象存储加消息队列之后，写入没有出现过堆积。|车联网 平台架构师
solution/auto|马女士|按区域就近部署之后，数据回传延迟下降了不少，成本也可控。|出行服务 技术经理
solution/travel|朱主管|旺季用弹性伸缩自动扩容，淡季释放掉，整体成本比包年方案低。|在线旅游 运维主管
solution/travel|胡工|图片转对象存储加 CDN 之后，带宽费用降了大概一半。|民宿平台 技术负责人
solution/education|林老师|上课时段最怕卡顿，用了独享带宽之后学生反馈稳定多了。|在线教育 教学负责人
solution/education|高工|考试期间按建议关闭了非必要变更，全程没有出现异常。|教育科技 运维主管
solution/medical|曹主任|影像数据量大，生命周期的策略帮我们把长期存储成本压下来了。|医疗信息化 负责人
solution/medical|袁工|私有化部署满足了数据不出域的要求，顺利通过了行业检查。|医疗软件 架构师
solution/agriculture|邓工|边缘侧支持断网续传，田间信号不稳也没有丢数据。|智慧农业 技术负责人
solution/agriculture|范女士|采集点分散接入没想象中麻烦，就近接入后汇聚回传很顺畅。|农业物联网 项目经理
',
            'show_switch_deck' => '1',
            'switch_deck_title' => '按能力逐个看清',
            'switch_deck_desc' => '切换左侧条目，查看每项能力的说明与适用场景。',
            'switch_deck_link' => '/cloud.html',
            'switch_deck_more_text' => '查看全部能力',
            'switch_deck_rows_text' => '*|弹性计算|按需创建与释放实例，支持在线升配；配合镜像与快照，环境可快速复制。适合流量波动明显的业务。|/cloud.html||热门
*|多线网络|三网直连与 BGP 多线接入，跨境线路可选；高峰期自动切换，减少抖动对业务的影响。|/cloud.html||线路
*|数据与备份|快照、备份与加密存储三层保护，关键数据保留回滚窗口，避免误操作演变成事故。|/ssl.html||安全
*|可观测与告警|监控指标、日志检索与告警联动，问题在影响业务前就被发现。|/document.html||运维',
            'show_region_ledger' => '0',
            'region_ledger_title' => '服务覆盖与线路',
            'region_ledger_desc' => '各地区的线路类型与接入能力，可按业务就近选择。',
            'region_ledger_link' => '/contact.html',
            'region_ledger_more_text' => '咨询线路方案',
            'region_ledger_rows_text' => '*|华北地区|多线 BGP 接入，覆盖京津冀与周边省份||三网直连|30 个机房
*|华东地区|精品线路与国际出口，适合跨境业务||国际出口|42 个机房
*|华南地区|低延迟直连港澳，跨境专线可选||港澳直连|26 个机房
*|海外地区|香港、新加坡与欧美节点，就近接入||CN2 线路|18 个机房',
            'show_doc_shelf' => '0',
            'doc_shelf_title' => '按主题找文档',
            'doc_shelf_desc' => '常见问题、接入指南与产品手册，按主题分册整理。',
            'doc_shelf_link' => '/document.html',
            'doc_shelf_more_text' => '进入文档中心',
            'doc_shelf_rows_text' => '*|快速开始|注册、实名与首次创建实例的完整路径|/document.html||入门|12 篇
*|产品手册|各产品的规格、计费口径与使用限制|/document.html||规格|28 篇
*|网络与安全|安全组、线路选择与证书配置说明|/document.html||网络|16 篇
*|常见问题|高频问题的排查步骤与结论|/document.html||排障|34 篇',
            'shared_module_off_text' => '',
            'prod_overview_title_text' => 'cloud|把计算资源交给业务节奏|从单台实例起步，按需调整 CPU、内存、云盘与网络配置。控制台提供实例、镜像、网络和安全组等基础管理能力。
dedicated|为关键负载保留清晰的资源边界|
domain|让域名成为稳定的业务入口|
domain_buy|四步完成域名上线准备|
domain_register|从关键词找到合适的域名|
domain_shop|按业务找到合适的后缀|
icp|把备案准备变成可核对的清单|
model|用基础能力支撑不同业务阶段|
rent|从一个 U 位到完整机柜|
sms|把消息发送接入业务流程|
ssl|从证书选型到 HTTPS 上线|
trademark|把品牌名称纳入长期规划|
trusteeship|让自有硬件获得稳定的运行环境|',
            'prod_overview_items_text' => 'cloud|弹性配置|根据访问量与任务量选择计算、存储和网络资源。
cloud|镜像启动|使用系统或应用镜像，减少环境准备工作。
cloud|网络隔离|通过私有网络与安全组管理实例间的访问边界。
cloud|资源可观测|结合监控指标观察实例运行状态和资源使用情况。
dedicated|资源独享|整机资源专属使用，便于评估持续负载。
dedicated|规格可选|按计算、存储和网络需求匹配机型。
dedicated|系统自定义|结合业务软件栈安排系统安装与初始化。
dedicated|混合部署|可与云服务器及私有网络协同规划。
domain|后缀选择|按品牌、地域和业务属性筛选适合的后缀。
domain|状态查询|下单前查询域名的可注册状态与价格。
domain|解析管理|集中维护常用 DNS 记录和业务指向。
domain|续费提醒|关注到期时间，按规则完成续费和资料维护。
domain_buy|确认可用状态|输入关键词并选择后缀，查看可注册状态和实时价格。
domain_buy|选择周期与资料|确认注册年限、主体信息和订单内容。
domain_buy|提交审核材料|按后缀与注册局要求完成实名认证。
domain_buy|连接业务服务|配置 DNS 记录，将域名指向网站或应用。
domain_register|关键词联想|为品牌名、产品名和拼音准备备选组合。
domain_register|后缀筛选|结合业务属性和受众选择域名后缀。
domain_register|状态确认|提交前查看当前可注册状态与价格。
domain_register|资料准备|提前准备对应主体的实名认证材料。
domain_shop|.com|常见通用后缀，适合企业和产品品牌。
domain_shop|.cn|面向中国市场的业务可考虑使用。
domain_shop|.net|技术、网络和平台类项目常见选择。
domain_shop|其他后缀|更多后缀及规则以产品列表实时展示为准。
icp|主体核对|确认个人或企业主体信息与证件资料。
icp|域名准备|核对域名注册、实名认证和接入关系。
icp|材料整理|按当地管局要求准备核验和网站资料。
icp|节点跟进|记录提交、补充材料和审核状态。
model|计算|云服务器或物理裸机承载应用、数据库和批处理任务。
model|网络|通过私有网络、安全组和线路规划访问边界。
model|数据与安全|结合云盘、快照、SSL 和防护能力管理数据风险。
model|运营支撑|以监控、日志、备案和咨询支持上线后的持续管理。
rent|空间灵活|按 U 位、半柜或整柜规划设备布局。
rent|功耗核对|按设备功耗和机房供电条件确认方案。
rent|线路选择|根据访问来源和业务带宽匹配线路资源。
rent|预留扩展|结合设备增长安排空间与网络资源。
sms|API 接入|按接口文档完成验证码和通知类消息对接。
sms|模板管理|区分业务模板和变量，按要求提交审核。
sms|状态回执|结合回执记录处理重试与异常排查。
sms|用量可控|根据业务量和通道规则规划发送预算。
ssl|多种类型|可按单域名、多域名或通配符等需求选择。
ssl|验证匹配|结合 DV、OV 等验证方式评估申请材料。
ssl|部署指导|按服务器、负载均衡或网关环境安排部署。
ssl|续期管理|关注证书有效期，提前规划替换和验证。
trademark|申请前查询|围绕名称、类别和近似情况准备候选。
trademark|材料整理|按主体类型准备申请所需资料。
trademark|节点跟进|记录提交、受理和审查等办理节点。
trademark|后续维护|结合有效期和业务变化规划续展与变更。
trusteeship|空间规划|按 U 位、设备尺寸和扩容计划规划托管空间。
trusteeship|供电协同|根据设备功耗与机房条件确认供电安排。
trusteeship|网络接入|按线路、带宽和地址需求匹配网络资源。
trusteeship|现场协作|按服务边界协调上架、巡检或远程支持事项。',
            'prod_advantages_title_text' => 'cloud|从创建到扩容，管理路径更清晰|
dedicated|把性能、隔离和运维放在同一张方案里|
domain|注册、管理、上线一条路径|
domain_buy|购买前先确认三个要点|
domain_register|查询时关注名称、后缀和规则|
domain_shop|先看规则，再确认名称|
icp|让网站上线前的合规事项更清晰|
model|从资源选择走向整体能力组合|
rent|把机柜租用变成可执行的资源清单|
sms|让发送链路更易接入和追踪|
ssl|让加密、信任和运维可持续|
trademark|让资料和节点更易管理|
trusteeship|把硬件、网络和运维边界先确认|',
            'prod_advantages_items_text' => 'dedicated|稳定的硬件边界|独享计算与存储资源，适合长期运行的核心应用和数据库。
dedicated|可控的变更流程|装机、系统变更、备份和迁移可按业务窗口计划执行。
dedicated|按需组合能力|可结合云盘、网络、安全和监控产品完善整体架构。
domain|透明选购|价格、年限和后缀在购买流程中确认，避免使用固定示例价格。
domain|集中管理|域名、解析和续费统一处理，减少多处维护成本。
domain|业务联动|可与云服务器、SSL 和备案服务一起规划上线流程。
domain_buy|主体资料|准备与注册主体一致的实名资料，减少审核往返。
domain_buy|后缀规则|不同后缀的注册资格、年限和审核要求可能不同。
domain_buy|上线依赖|网站上线还需准备服务器、证书和备案等配套服务。
domain_register|名称易识别|优先选择便于记忆、拼写和口头传播的组合。
domain_register|后缀相匹配|不同后缀的注册资格和管理规则可能不同。
domain_register|状态以实时为准|查询结果会变化，确认后应及时提交注册订单。
domain_shop|信息透明|后缀、年限与价格在正式购买步骤中核对。
domain_shop|组合规划|可分别规划品牌主域名、业务域名和邮箱域名。
domain_shop|流程连续|查询、注册、实名、解析和续费可按一条流程推进。
icp|流程梳理|按主体、域名、接入商和网站信息拆解准备工作。
icp|材料核对|提交前检查资料一致性，减少因信息遗漏产生的往返。
icp|状态同步|根据实际审核节点跟进需要补充或修改的内容。
model|按负载匹配|依据持续负载、峰值流量、数据量和延迟要求选择资源。
model|按边界治理|将网络访问、证书、备份和权限放进统一的变更计划。
model|按阶段演进|从开发测试到生产运行逐步补齐产品和运维能力。
rent|规格清楚|以设备尺寸、重量和功耗为基础核对空间和供电。
rent|网络匹配|按业务访问方向和带宽需求确认线路。
rent|扩容有据|预先记录设备增长和运维进入需求，便于后续调整。
sms|接入清晰|围绕接口、签名、模板和回执组织接入步骤。
sms|场景分层|验证码、业务通知和营销消息按用途分别管理。
sms|状态可查|保留必要请求与回执信息，便于定位发送问题。
ssl|加密传输|为浏览器与服务端之间的传输建立 HTTPS 加密通道。
ssl|证书匹配|根据域名范围与组织验证需求选择产品规格。
ssl|变更可规划|将申请、部署、测试和续期纳入统一的发布流程。
trademark|流程梳理|按主体、类别和使用计划拆解申请准备工作。
trademark|材料核对|提交前检查名称、类别和主体资料的一致性。
trademark|结果跟进|根据办理状态及时同步需要处理的事项。
trusteeship|硬件可控|使用自有设备，便于按硬件规格和软件环境部署。
trusteeship|资源可规划|提前确认空间、功耗、带宽和扩容边界。
trusteeship|责任清晰|将设备管理、网络支持和现场服务范围写入确认内容。',
            'prod_scenarios_title_text' => 'cloud|适合持续迭代的业务场景|
dedicated|适用场景|
domain|适用场景|
domain_buy|适用场景|
domain_register|适用场景|
domain_shop|适用场景|
icp|适用场景|
model|按业务负载选择起点|
rent|适用场景|
sms|适用场景|
ssl|适用场景|
trademark|适用场景|
trusteeship|适用场景|',
            'prod_scenarios_items_text' => 'cloud|网站与应用|承载企业官网、管理后台、小程序和 App 后端等服务。
cloud|活动与峰值|为促销、报名、发布等有明显波峰的业务预留扩展空间。
cloud|开发与测试|快速创建隔离环境，支持版本验证、联调和临时任务。
dedicated|数据库与中间件|为持续运行的数据库、缓存和消息系统保留专属资源。
dedicated|高性能计算|承载批处理、渲染、分析等对硬件规格敏感的任务。
dedicated|合规隔离部署|适合需要明确物理边界和访问策略的业务系统。
domain|企业品牌|为官网、邮箱和品牌活动建立易识别的访问入口。
domain|业务应用|为网站、API、小程序后台配置稳定的业务域名。
domain|多项目管理|为不同产品和环境分别规划域名与解析记录。
domain_buy|新建官网|从品牌域名开始搭建企业官网和邮箱体系。
domain_buy|新业务发布|为活动、产品和应用准备独立访问入口。
domain_buy|域名迁移|梳理现有解析记录，安排续费、转入或切换。
domain_register|品牌官网|围绕企业或品牌名称查询主域名与备用域名。
domain_register|产品项目|为新产品、活动和应用准备独立访问地址。
domain_register|域名组合|统一规划官网、邮箱和不同业务线的域名结构。
domain_shop|品牌建设|为企业官网、品牌传播和线上邮箱准备入口。
domain_shop|业务分域|按产品、地区或环境划分域名，方便运营管理。
domain_shop|项目试运营|先注册合适名称，再结合业务验证安排解析。
icp|新网站上线|为企业官网、品牌站和业务站准备备案材料。
icp|主体或域名变更|网站主体、域名或接入关系变化时梳理办理事项。
icp|备案信息维护|根据实际业务和管局要求及时更新备案信息。
model|网站与 API|以云服务器、域名和 SSL 为起点，逐步配置网络和备份。
model|数据与计算|根据持续计算、存储容量和隔离要求选择云服务器或裸机。
model|波动与协作|为活动流量、开发测试和多团队协作预留调整空间。
rent|小规模上架|为少量设备安排独立 U 位和基础网络资源。
rent|整柜部署|集中部署服务器、存储和网络设备，统一规划功耗与布线。
rent|持续扩容|为业务增长预留空间、带宽和现场运维安排。
sms|登录与注册|发送登录、注册、找回密码等身份校验消息。
sms|业务通知|传达订单、物流、审批和服务状态。
sms|会员触达|在合规前提下发送活动提醒和服务通知。
ssl|企业官网|保护登录、表单和官网访问，减少浏览器安全提示。
ssl|API 与后台|为接口、管理后台和移动应用服务提供 HTTPS。
ssl|多域名业务|结合域名数量和架构入口选择合适的证书覆盖范围。
trademark|新品牌上线|在产品、官网和宣传投入前规划品牌名称保护。
trademark|企业日常经营|围绕核心业务类别办理注册与后续管理。
trademark|到期与变更|结合主体、地址和有效期变化安排维护事项。
trusteeship|自有设备上架|企业已有服务器，需要机房空间和网络环境。
trusteeship|核心系统部署|对硬件、系统和访问边界有明确要求的业务。
trusteeship|混合架构|将自有设备与云服务器、备份和安全产品协同使用。',
            'prod_service_title_text' => 'cloud|按使用方式选择计费|
dedicated|配置与服务按订单确认|
domain|按后缀和年限计费|
domain_buy|每一步都有可确认的信息|
domain_register|查询后进入正式注册|
domain_shop|不同后缀对应不同规则|
icp|办理结果取决于资料和审核要求|
model|产品规格与支持边界清晰可查|
rent|按空间、功耗和网络配置|
sms|按消息类型和用量核算|
ssl|按覆盖范围和验证方式计费|
trademark|办理周期和结果以审查规则为准|
trusteeship|按空间、线路和服务范围确认|',
            'prod_faq_title_text' => 'cloud|常见问题|
dedicated|常见问题|
domain|常见问题|
domain_buy|常见问题|
domain_register|常见问题|
domain_shop|常见问题|
icp|常见问题|
model|常见问题|
rent|常见问题|
sms|常见问题|
solution|常见问题|
ssl|常见问题|
trademark|常见问题|
trusteeship|常见问题|',
            'prod_cta_title_text' => 'cloud|准备好部署业务了吗？|
dedicated|为核心业务选择专属算力|
domain|开始规划你的业务域名|
domain_buy|现在开始查询域名|
domain_register|开始查询你的域名|
domain_shop|浏览域名产品|
icp|为网站准备合规上线流程|
model|从业务需求开始组合云能力|
rent|为设备找到合适的机柜空间|
sms|让消息能力稳定接入业务|
ssl|为网站配置可信 HTTPS|
trademark|从一次查询开始保护品牌|
trusteeship|为自有设备规划托管环境|',
            'prod_cta_btn1_text'        => 'cloud|查看云产品|/cart/goodsList.htm
dedicated|查看产品|/cart/goodsList.htm
domain|去选购|/cart/goodsList.htm
domain_buy|进入购买|/cart/goodsList.htm
domain_register|查询并选购|/cart/goodsList.htm
domain_shop|进入商城|/cart/goodsList.htm
icp|查看服务|/cart/goodsList.htm
model|查看产品|/cart/goodsList.htm
rent|查看产品|/cart/goodsList.htm
sms|查看产品|/cart/goodsList.htm
ssl|查看证书|/cart/goodsList.htm
trademark|查看服务|/cart/goodsList.htm
trusteeship|查看产品|/cart/goodsList.htm',
            'copy_about_company_text' => 'title|企业信息
title2|联系信息
desc|以下信息来自站点的真实配置；未配置的字段不会被虚构展示。
txt4|企业联系信息
l1|企业名称
l2|联系电话
l3|联系邮箱
l4|公司地址',
            'copy_footer_text' => 'links_title|友情链接
terms|用户协议
privacy|隐私政策',
            'copy_header_text' => 'ph_search|搜索产品、新闻、公告、文档
searching|搜索中...
noresult|未找到相关内容
nav_title|网站导航
tab_basic|基本资料
tab_security|安全设置
tab_overview|安全概览
menu_account|账户信息
menu_console|管理控制台
menu_security|安全中心
menu_key|密钥
menu_finance|财务信息
logout|退出登录',
            'copy_core_activities_text' => 'title|产品活动
title2|会员活动
title3|服务更新
title4|活动咨询
txt5|产品优惠、试用与服务调整将通过官网活动页面或官方公告发布。
txt6|会员专属活动以账户可见的活动规则为准，参与前请阅读适用条件。
txt7|服务能力、产品范围和使用规则如有变化，将及时在公告中说明。
txt8|对活动内容有疑问时，可通过在线咨询提交具体产品和业务场景。',
            'copy_cta_activities_text' => 'title|需要了解适合您的产品吗？
txt2|先咨询业务场景，再根据实际需求选择产品和服务。',
            'copy_contact_form_text' => 'title|提交咨询
title2|提交成功
title3|联系方式
txt4|请留下可用的联系方式和需求描述，便于我们准确跟进。
txt5|我们已收到您的咨询，后续将根据您留下的联系方式跟进。
txt6|咨询内容越具体，越有助于我们准备匹配的产品与方案信息。
txt7|与邮箱二选一必填
txt8|与手机号二选一必填
txt9|请描述您想咨询的产品或业务场景
l1|联系人
l2|公司名称
l3|手机号码
l4|联系邮箱
l5|咨询内容
b1|提交咨询
b2|提交中',
            'copy_core_form_text' => 'title|提交反馈
title2|反馈已提交
txt3|请提供准确的反馈类型和问题描述，联系方式可按需填写。
txt4|暂无可用反馈类型
txt5|感谢你的反馈，我们会尽快跟进处理。
txt6|一句话概括你的反馈
txt7|请描述具体问题或建议
txt8|手机号 / 邮箱，方便我们回复你
txt9|联系方式（选填）
l1|反馈类型
l2|请选择类型
l3|标题
l4|详细内容
b1|提交反馈
b2|提交中',
            'copy_core_intro_text' => 'title|一起建设可靠的云服务
title2|应聘咨询
desc|岗位开放情况、职责要求和投递方式以实际招聘通知为准，页面不展示未经确认的岗位或待遇信息。
item1|技术与平台｜关注云平台、自动化运维、网络与安全等方向。
item2|产品与服务｜关注企业客户需求，持续优化产品体验与服务流程。
item3|销售与合作｜连接客户与合作伙伴，推动业务场景落地。
item4|开放沟通｜欢迎通过官方联系方式咨询当前招聘安排。
txt8|关注云平台、自动化运维、网络与安全等方向。
txt9|关注企业客户需求，持续优化产品体验与服务流程。
txt10|连接客户与合作伙伴，推动业务场景落地。
txt11|欢迎通过官方联系方式咨询当前招聘安排。
txt12|请在咨询内容中注明应聘方向，并留下可用联系方式。
txt13|联系招聘团队',
            'copy_cta_guarantee_text' => 'title|需要专属支持？
txt2|提交业务场景和联系方式，我们会根据实际情况协助跟进。',
            'copy_document_band_text' => 'title|先从文档开始
desc|使用手册、接入指南和常见问题集中在文档中心。
txt3|打开文档中心',
            'copy_support_cards_text' => 'title|稳定运行
title2|问题响应
title3|安全支持
title4|专业咨询
txt5|围绕基础设施、网络和数据安全提供持续的运行维护支持，具体服务范围以产品说明为准。
txt6|遇到产品使用问题，可通过文档中心、反馈表单或联系我们页面提交信息。
txt7|建议根据业务重要程度设置访问控制、备份与监控策略，并参考对应产品文档。
txt8|需要规划产品组合或部署架构时，可提交业务场景，由专业人员进一步沟通。',
            'copy_method_text' => 'title|从问题到可执行架构
item1|明确挑战｜梳理业务目标、访问模式、数据量和合规边界。
item2|拆解负载｜区分持续、峰值、批处理和专属资源需求。
item3|组合产品｜选择计算、网络、存储、安全和支持产品。
item4|验证上线｜通过测试、监控、备份和变更流程逐步上线。
txt6|梳理业务目标、访问模式、数据量和合规边界。
txt7|区分持续、峰值、批处理和专属资源需求。
txt8|选择计算、网络、存储、安全和支持产品。
txt9|通过测试、监控、备份和变更流程逐步上线。',
            'copy_process_text' => 'title|落地流程
txt2|方案落地节奏取决于业务复杂度、资料完整度和产品交付条件，以下为通用协作路径。
txt3|确认目标、现状和约束。
txt4|形成产品与网络组合。
txt5|按规格和周期确认订单。
txt6|完成联调、备份和监控。
txt7|依据实际指标持续调整。
tl1|需求访谈
tl2|架构设计
tl3|资源选购
tl4|部署验证
tl5|运行优化',
            'copy_workload_text' => 'title|按工作负载选择架构起点
item1|网站与业务系统｜以云服务器为计算起点，组合域名、SSL、云盘、网络与备份能力。
item2|活动与实时访问｜先识别流量波峰、静态内容和数据写入压力，再安排扩展和防护。
item3|数据库与高性能计算｜根据资源隔离、硬件规格和数据边界评估物理裸机或托管服务。
txt5|以云服务器为计算起点，组合域名、SSL、云盘、网络与备份能力。
txt6|先识别流量波峰、静态内容和数据写入压力，再安排扩展和防护。
txt7|数据库与高性能计算
txt8|根据资源隔离、硬件规格和数据边界评估物理裸机或托管服务。
txt9|网站与业务系统
txt10|了解云服务器
txt11|活动与实时访问
txt12|查看基础产品
txt13|了解专属算力
tl1|持续负载
tl2|峰值负载
tl3|专属负载',
            'prod_faq_items_text' => 'cloud|如何选择云服务器配置？|可从当前并发、应用类型、数据量和增长计划出发，先选择基础配置，再根据监控和业务测试结果调整。
cloud|购买后可以调整资源吗？|是否支持升降配及具体操作条件，以控制台和所选产品规则为准；涉及生产变更时建议先完成备份并安排维护窗口。
cloud|云服务器是否包含备案服务？|备案通常需要单独办理，业务可通过 ICP 备案页面了解流程并提交咨询。
dedicated|裸机适合什么业务？|适合持续负载、对硬件规格或物理隔离有要求的数据库、计算和核心应用。
dedicated|可以自定义系统和软件吗？|可结合机型与交付方式安排系统安装及初始化，具体以订单和服务确认内容为准。
dedicated|如何确认价格？|在产品列表查看可选配置，若需求涉及定制硬件、网络或迁移，请通过咨询入口确认。
domain|注册域名需要哪些资料？|通常需要按主体类型提交实名资料，具体字段和审核要求以购买流程及注册局规则为准。
domain|注册后如何指向网站？|在解析管理中添加对应记录，将域名指向网站或应用使用的地址，生效时间受 DNS 缓存影响。
domain|域名到期后还能续费吗？|续费和赎回窗口受后缀注册规则约束，请关注到期时间并按页面提示及时处理。
domain_buy|实名认证没通过怎么办？|先按提示核对主体名称、证件和联系方式，再根据后缀规则补充或重新提交资料。
domain_buy|买完域名就能访问网站吗？|还需要准备网站服务并配置 DNS；如属于需要备案的业务，还应完成相应备案流程。
domain_buy|购买流程在哪里开始？|点击页面的购买入口进入产品列表，选择域名类商品后再查看具体后缀与价格。
domain_register|查询结果代表已经注册成功吗？|不是。查询只反映当前可用状态，需要在购买流程中提交订单并完成后续审核。
domain_register|为什么同一个名称有多个价格？|价格会受到后缀、注册年限和注册局规则影响，最终以订单页实时信息为准。
domain_register|没有理想域名怎么办？|可以尝试拼音、英文、组合词或其他后缀，也可以通过咨询入口一起梳理候选方案。
domain_shop|商城展示的后缀都能注册吗？|是否可注册需要以查询时的实时状态、主体资格和注册局规则为准。
domain_shop|如何挑选主域名？|优先考虑品牌一致性、易记性、业务范围和长期维护成本，再核对后缀规则。
domain_shop|需要同时购买多个后缀吗？|是否组合注册取决于品牌保护和业务规划，可先咨询后再决定。
icp|备案前需要准备什么？|通常需要主体、域名、接入和网站相关资料，具体清单取决于主体所在地和备案类型。
icp|备案审核需要多长时间？|审核时间受地区、材料完整度和管局工作安排影响，无法预设固定时长。
icp|备案期间网站能访问吗？|是否可以访问取决于域名、接入和相关监管要求，建议按备案规则安排上线节奏。
model|应该先买单个产品还是先做方案？|需求明确且负载简单时可先查看产品列表；涉及多产品、迁移或合规边界时建议先咨询。
model|云产品是否适合所有业务？|需要结合负载、数据、网络和合规要求判断，具体产品能力以详情页和服务协议为准。
model|如何估算整体成本？|列出计算、存储、带宽、安全、域名和运维支持等资源，再按实际规格和周期核算。
rent|怎样估算需要多少 U 位？|统计设备高度、数量、布线和后续扩容空间，再结合机柜规格确认可用 U 位。
rent|机柜租用包含设备运维吗？|空间、网络和现场服务范围需要按具体产品及服务协议确认，不默认包含设备系统运维。
rent|后续可以增加设备吗？|需要结合剩余空间、功耗、带宽和机房条件评估，可在咨询时一并提交扩容计划。
sms|短信模板为什么需要审核？|签名、内容和发送场景需要符合相关运营商及平台规则，审核通过后才能按规则发送。
sms|如何处理发送失败？|先根据接口响应和状态回执区分参数、模板、号码或通道问题，再按业务策略重试。
sms|短信服务如何计费？|计费方式受短信类型、套餐和实际用量影响，购买前以产品页面展示的规则为准。
solution|行业方案是否只能使用固定架构？|不是。行业页面用于识别常见挑战，最终产品组合需要结合你的业务负载、数据和合规要求确认。
solution|方案是否包含实施服务？|实施、迁移和运维支持范围取决于具体产品与服务协议，咨询时可逐项确认。
solution|如何开始咨询？|准备业务类型、访问峰值、数据量、现有架构和上线计划，通过咨询入口提交即可。
ssl|如何选择 DV、OV 证书？|可根据业务信任展示、组织验证材料和域名范围选择，具体差异以产品详情和 CA 要求为准。
ssl|证书买完后会自动部署吗？|是否包含部署协助取决于所选服务，服务器、网关和负载均衡环境通常需要按实际架构安排。
ssl|证书快到期了怎么处理？|建议提前核对域名和验证资料，安排新证书申请、替换测试与上线切换。
trademark|商标注册一定能成功吗？|不能保证。最终结果取决于申请内容、在先权利和主管部门审查，办理前可先进行查询与评估。
trademark|需要准备什么材料？|材料取决于申请主体和办理事项，咨询时可提供主体类型与计划类别以便核对清单。
trademark|注册后还需要维护吗？|需要关注有效期、主体信息和实际使用情况，并按规则办理续展、变更等事项。
trusteeship|托管需要先提供哪些信息？|建议提供设备数量、尺寸、功耗、带宽、IP 和业务上线计划，便于核对空间与线路。
trusteeship|服务器故障由谁处理？|设备硬件、系统和机房服务的责任边界以订单及服务协议约定为准，可在咨询时逐项确认。
trusteeship|能否与云资源一起使用？|可以结合业务网络和安全策略规划混合架构，具体互联方式需根据实际资源确认。',
            'prod_service_items_text' => 'cloud|包年包月|长期稳定负载|按选择的周期购买，便于预算规划。
cloud|按需使用|短期或波动负载|按选购页展示的用量规则结算。
cloud|运维支持|上线前后|可通过文档与咨询入口获取配置和迁移建议。
cloud|__desc__||实际价格以选购页的配置、地域、带宽和计费周期为准，页面不预设固定承诺。
dedicated|硬件规格|CPU、内存、磁盘与网络组合|选购页或售前确认
dedicated|交付安排|装机、初始化和上线时间|订单及服务确认
dedicated|运维边界|远程协助与故障处理范围|按产品规则确认
dedicated|__desc__||裸机价格受机型、存储、带宽、机房和周期影响，具体以选购页与咨询确认结果为准。
domain|注册|后缀、年限和域名选择|以注册局可用状态为准
domain|实名认证|按要求提交主体和证件资料|审核规则因后缀而异
domain|解析与续费|DNS 记录和到期管理|按页面及注册局规则操作
domain|__desc__||域名价格、注册年限、实名认证和续费规则以购买流程的实时信息为准。
domain_buy|查询|后缀、状态和价格|选定可注册域名
domain_buy|下单|年限与主体资料|订单提交成功
domain_buy|解析|记录类型与目标地址|业务域名可访问
domain_buy|__desc__||价格、注册局审核和 DNS 生效时间会因后缀与网络环境而变化，购买流程中的实时信息优先。
domain_register|查询|输入关键词并选后缀|获得候选域名
domain_register|注册|确认年限和资料|提交订单与实名审核
domain_register|解析|配置 DNS 记录|连接网站或应用
domain_register|__desc__||查询页用于发现候选域名，价格、注册年限、实名审核和解析管理以正式购买流程为准。
domain_shop|后缀|适用方向与注册要求|查询时
domain_shop|年限与价格|周期、优惠及续费信息|下单时
domain_shop|实名与解析|材料与 DNS 管理方式|注册后
domain_shop|__desc__||域名价格、注册年限、实名认证和续费窗口以选购页的实时信息及注册局规则为准。
icp|准备|主体、域名和网站信息|主体类型与地区
icp|提交|核验资料并提交申请|管局材料要求
icp|审核|跟进补正和审核结果|实际审查情况
icp|__desc__||备案协助服务是否收费、材料清单、审核周期和补正要求，以主体所在地及主管部门规则为准，不作固定时效或通过承诺。
model|基础资源|云服务器、物理裸机、机柜|规格、周期和交付
model|业务入口|域名、SSL、备案|主体、验证和合规要求
model|消息与支持|短信、托管、咨询|用量、服务范围和协议
model|__desc__||各产品的计费、可用规格、交付和支持范围不同，选购前应以产品详情、订单和服务协议为准。
rent|空间|设备数量与尺寸|U 位、半柜或整柜
rent|供电|设备功耗与冗余需求|机房供电条件
rent|网络|带宽、线路和 IP 需求|可用资源与周期
rent|__desc__||租用价格与机房、U 位、功耗、带宽、IP 和服务周期相关，具体以选购页和咨询确认结果为准。
sms|开通|账户、签名和权限配置|产品规则
sms|审核|模板与发送内容审核|运营商及平台要求
sms|发送|接口调用、回执和用量|实际发送记录
sms|__desc__||短信单价、套餐、签名模板审核、通道和发送限制以产品列表及平台规则为准，不预设到达率或固定时延承诺。
ssl|选型|域名范围与验证级别|产品列表及 CA 要求
ssl|签发|域名或组织验证|申请资料与审核结果
ssl|部署与续期|安装证书及替换|服务器环境与有效期
ssl|__desc__||证书品牌、类型、域名数量、有效期和验证材料会影响价格与办理周期，具体以选购页和 CA 规则为准。
trademark|查询与评估|名称、类别和主体资料整理|申请人需求
trademark|提交申请|填报信息并提交材料|主管部门要求
trademark|审查与维护|跟进结果并规划后续事项|实际审查结果
trademark|__desc__||服务费用、官方规费、申请类别、材料要求和办理周期根据实际事项确认，不作成功率或固定时效承诺。
trusteeship|机房空间|U 位、设备尺寸和功耗|设备清单与机房条件
trusteeship|网络资源|线路、带宽和 IP|业务访问需求
trusteeship|现场服务|上架、巡检和协助边界|服务协议
trusteeship|__desc__||托管费用与机房等级、U 位、功耗、带宽、IP 及现场服务有关，具体以选购页和售前确认结果为准。',
            'prod_service_heads_text' => 'cloud|项目|适用方式|说明
dedicated|项目|说明|确认方式
domain|服务项|包含内容|注意事项
domain_buy|阶段|需要确认|完成标志
domain_register|步骤|操作|结果
domain_shop|选购信息|查看内容|确认时机
icp|阶段|办理内容|影响因素
model|能力层|可组合产品|确认重点
rent|配置项|需要提供|确认内容
sms|阶段|主要内容|确认信息
ssl|服务阶段|主要工作|确认内容
trademark|阶段|主要工作|依据
trusteeship|项目|确认内容|依据',
            'copy_core_article_text' => 'txt1|← 返回公告列表
txt2|公告不存在或已删除
txt3|← 返回文档中心
txt4|文档不存在或已删除，可返回文档中心查找其他内容。
txt5|← 返回文档中心
txt6|文档不存在或已删除，可返回文档中心查找其他内容。
txt7|← 返回新闻列表
txt8|新闻不存在或已删除
txt9|上一篇
txt10|下一篇
txt11|相关附件',
            'copy_core_listing_text' => 'txt1|搜索文档标题...
txt2|该分类下暂无新闻
txt3|阅读全文 →
txt4|分类新闻加载中
txt5|分类新闻分页
txt6|上一页
txt7|下一页
txt8|暂无内容
txt9|加载中',
            'copy_core_results_text' => 'txt1|未找到相关文档，换个关键字试试
txt2|搜索文档标题...
hint|请输入关键字搜索文档标题。
of|的搜索结果',
            'copy_cta_text' => 'desc_cloud|先查看可选配置，再让我们根据业务负载给出上云建议。
btn_cloud|咨询架构建议
desc_dedicated|查看现有机型，或提交业务负载与配置需求。
btn_dedicated|咨询配置
desc_domain|查询可用后缀，或让我们协助梳理品牌与业务域名。
btn_domain|咨询域名方案
desc_domain_buy|按流程选择后缀，遇到资料或上线问题可直接咨询。
btn_domain_buy|咨询流程
desc_domain_register|进入产品列表选择域名服务，查看可用后缀和注册信息。
btn_domain_register|咨询命名方案
desc_domain_shop|查看当前可选后缀与注册信息，选择适合你的业务入口。
btn_domain_shop|咨询选择
desc_icp|查看备案服务，或提交主体和域名情况获得办理建议。
btn_icp|咨询备案
desc_model|查看可选产品，或提交负载与上线计划获得组合建议。
btn_model|咨询能力组合
desc_rent|查看机柜产品，或提交设备清单获取资源建议。
btn_rent|咨询租用
desc_sms|查看短信产品规则，或提交发送场景和日常用量获得接入建议。
btn_sms|咨询接入
desc_ssl|查看证书产品，或提交域名数量和部署环境获得建议。
btn_ssl|咨询证书
desc_trademark|查看办理服务，或提交名称、类别和主体信息获得建议。
btn_trademark|咨询商标
desc_trusteeship|查看托管产品，或提交设备和线路需求获取方案建议。
btn_trusteeship|咨询托管',
            'copy_news_text' => 'txt1|接入指南、产品手册与常见问题
txt2|进入文档中心',
            'copy_nodes_text' => 'txt1|全球服务地区分布点阵地图',
            'copy_overview_text' => 'txt1|从 CPU、内存、磁盘到网络，根据业务和机型选择资源。物理机交付、装机和迁移安排以订单及服务确认内容为准。
txt2|支持常见域名后缀的查询、注册、解析和续费管理。域名实名认证、注册年限和可用后缀受注册局规则影响。
txt3|域名查询是注册前的第一步。可先围绕品牌、产品和地域准备多个候选，再结合后缀规则、实名认证和预算完成选择。
txt4|商城用于浏览与选择域名产品。下方仅说明后缀的常见使用方向，不代表注册资格、库存或固定价格。
txt5|从主体、域名和接入关系开始梳理材料，按流程完成提交、初审和管局审核。不同地区、主体和网站类型的要求可能不同。
txt6|从单一产品开始，按业务的访问、数据、合规和运维要求组合能力。具体产品规格和价格以产品列表实时信息为准。
txt7|根据设备数量、尺寸、功耗和线路规划空间。可选的 U 位、带宽、IP 和机房条件以产品列表与售前确认内容为准。
txt8|通过标准接口提交短信请求，使用模板管理内容，并结合回执与日志观察发送结果。模板审核和发送限制以运营商及平台规则为准。
txt9|根据域名数量、验证级别和组织需求选择证书。证书签发、部署方式、有效期和续期规则以具体产品与 CA 要求为准。
txt10|从申请前查询到提交材料和进度跟进，按类别、主体和使用计划整理办理路径。是否核准由主管部门审查决定。
txt11|围绕机柜空间、供电、网络和现场协同规划托管方案。具体可用资源、线路和访问权限需要结合机房及订单确认。',
            'copy_pricing_text' => 'txt1|暂无可展示商品，请前往
txt2|加载更多产品
txt3|查看可用服务。',
            'copy_scenarios_text' => 'txt1|先按当前负载完成部署，再依据实际监控数据和增长计划调整资源。',
            'copy_solutions_text' => 'txt1|描述业务场景，获取专属架构建议
txt2|查看全部方案
txt3|查看方案 →',
            'hotline' => '400-000-0000',
            'header_support_json' => '',
            'float_enable' => '1',
            'float_items_text' => '在线客服|/contact.html|kefu
电话咨询|tel:400-000-0000|phone',
            'footer_promise_items_text' => '3天 无忧退款|tabler:shield-check
0元 免费备案|tabler:file-upload
1V1 专属客服|tabler:headset
7×24 小时服务|tabler:clock',
            'footer_about' => '一站式 IDC 云服务平台，让云与算力变得更简单。',
            'footer_menu_text' => \cra1_footer_default_text(),
            'show_footer_links' => '1',
            'footer_links_text' => '',
            'show_footer_bottom' => '1',
            'footer_icp_text' => '',
            'footer_icp_url' => 'https://beian.miit.gov.cn/',
            'footer_copyright_text' => '',
            'show_footer_promise' => '1',
            'show_footer_menu' => '1',
            'show_footer_cta' => '1',
            'footer_cta_text' => '查看产品|/cart/goodsList.htm
咨询方案|/contact.html',
            'cap2_icon' => 'tabler:server-2',
            'cap3_icon' => 'tabler:shield-check',
            'cap4_icon' => 'tabler:headset',
            'show_contact_cards' => '1',
            'contact_cards_text' => '客服热线|工作日 9:00-18:00 提供产品与工单咨询。|mdi:phone
联系邮箱|商务合作与方案咨询，1 个工作日内回复。|mdi:email
在线工单|控制台提交工单，可随时跟进处理进度。|mdi:ticket-confirmation
公司地址|欢迎到访洽谈，请提前与我们预约。|mdi:map-marker',
            'show_contact_service' => '1',
            'contact_service_text' => '响应时间|提交咨询后，工作日平均 2 小时内响应。
服务时间|7×24 提交入口，人工服务时间为工作日 9:00-18:00。
专业团队|由产品与技术顾问跟进，按业务场景给出建议。',
            'show_doc_quick' => '1',
            'doc_quick_text' => '新手入门|账号与实名、选配与开通的基础流程。|/document.html
常见问题|整理高频问题与处理步骤。|/document.html
公告与更新|产品与服务的变更通知。|/announce.html',
            'show_doc_guide' => '1',
            'doc_guide_text' => '善用搜索|输入文档标题关键词可快速定位目标内容。
分类浏览|文档按分组展示，可按主题逐篇查阅。
没有找到|检索不到时可通过意见反馈告诉我们，我们会补充完善。',
            'show_news_nav' => '1',
            'news_nav_text' => '官方公告|产品动态、系统通知与重要提醒。|/announce.html
文档中心|产品手册、常见问题与接入指南。|/document.html
联系咨询|想深入了解？欢迎提交咨询。|/contact.html',
            'show_news_foot' => '1',
            'news_foot_text' => '持续更新|新闻与动态会持续发布，欢迎定期关注。
内容转载|引用或转载本站内容请提前与我们沟通并注明来源。',
            'show_announce_nav' => '1',
            'announce_nav_text' => '产品动态|新功能与产品调整第一时间在新闻页公布。|/news.html
服务通知|维护、升级与服务变更参见文档与公告。|/document.html
历史公告|支持分页浏览历史公告内容。|/announce.html',
            'show_announce_foot' => '1',
            'announce_foot_text' => '公告效力|公告内容以实际发布信息为准，重要变更会提前通知。
订阅建议|建议定期查看本页，获取最新服务与产品信息。',
            'show_recruit_benefits' => '1',
            'recruit_benefits_text' => '成长空间|云计算与企业服务赛道，业务与技术双通道发展。
团队协作|小团队高效协作，方案与代码都能被认真讨论。
培训资源|产品与技术培训资料，帮助新同学快速上手。
福利保障|薪酬与福利以 HR 沟通为准，欢迎面谈了解。',
            'show_recruit_flow' => '1',
            'recruit_flow_text' => '投递咨询|通过联系我们页面注明应聘方向。
初步沟通|HR 与用人团队了解背景与意向。
深度交流|技术或业务场景的深度交流。
双方确认|确认岗位与合作细节后办理入职。',
            'show_feedback_channels' => '1',
            'feedback_channels_text' => '产品建议|对产品功能与体验的建议和期望。
问题反馈|使用过程中遇到的异常或体验问题。
服务投诉|对服务过程的意见与投诉。',
            'show_feedback_flow' => '1',
            'feedback_flow_text' => '提交反馈|选择反馈类型并描述具体问题。
跟进处理|相关团队确认并跟进处理。
结果回复|留下联系方式时会同步处理结果。',
            'show_activity_rules' => '1',
            'activity_rules_text' => '活动规则|具体活动以官方公告发布的规则与时间为准。
参与咨询|对活动有疑问时可通过在线咨询提交产品和业务场景。
合规说明|活动参与需遵守平台规则与相关法律法规。',
            'show_detail_rel' => '1',
            'detail_rel_text' => '文档中心|产品手册、常见问题与接入指南。|/document.html
官方公告|产品动态、系统通知与重要提醒。|/announce.html
联系咨询|提交咨询，获取产品与方案建议。|/contact.html',
            'show_page_cta' => '1',
            'page_cta_text' => '产品与服务|浏览云服务器、物理裸机等产品。|/cart/goodsList.htm
解决方案|按行业场景查看上云方案。|/solution.html
关于我们|了解公司信息与服务保障。|/about.html',
            'show_doc_result' => '1',
            'doc_result_text' => '检查关键词|尝试更短或更通用的关键词。
浏览全部分类|按分组浏览全部文档内容。|/document.html
联系我们|没有找到时欢迎提交咨询。|/contact.html',
            'show_news_classify_nav' => '1',
            'news_classify_nav_text' => '全部新闻|浏览全部新闻与动态。|/news.html
官方公告|查看产品与服务公告。|/announce.html
文档中心|接入指南与产品手册。|/document.html',
            'show_about_timeline' => '1',
            'about_timeline_text' => '2021|团队组建，开始构建云服务基础能力。
2022|云服务平台上线，首批产品开放选购。
2023|服务客户数量与节点规模持续增长。
2024|产品体系完善，行业解决方案陆续发布。
2025|平台能力与服务网络进一步扩展。',
            'show_solution_extra' => '1',
            'solution_extra_text' => '选购产品|浏览云服务器、物理裸机等产品配置。|/cart/goodsList.htm
咨询方案|提交业务场景，获取架构建议。|/contact.html
文档中心|接入指南与产品使用手册。|/document.html',
            'show_partner_cps_extra' => '1',
            'partner_cps_extra_text' => '推广素材|提供官网与产品推广素材，降低制作成本。|/contact.html
结算透明|推广数据可查，结算规则以合作协议为准。|/contact.html
专属对接|合作顾问一对一沟通推广方案。|/contact.html',
            'show_partner_agent_extra' => '1',
            'partner_agent_extra_text' => '代理权益|代理政策与权益以合作协议为准。|/contact.html
培训赋能|产品与技术培训帮助代理团队快速上手。|/contact.html
区域保护|合作区域与客户归属规则面谈确认。|/contact.html',
            'show_about_honor' => '1',
            'about_honor_text' => '信息安全管理体系|通过 ISO/IEC 27001 信息安全管理体系认证。|/web/cra1/assets/img/ref/sol-data.jpg
质量管理认证|通过 ISO 9001 质量管理体系认证。|/web/cra1/assets/img/ref/sol-office.jpg
行业资质证书|具备增值电信业务相关经营资质。|/web/cra1/assets/img/ref/sol-industry.jpg
软件著作权|自研平台软件取得多项著作权登记。|/web/cra1/assets/img/ref/sol-media.jpg',
            'show_about_partner' => '1',
            'about_partner_text' => '政务云项目|为政务业务提供合规、稳定的算力底座。|/web/cra1/assets/img/ref/prod-cloud.jpg
电商平台支撑|大促期间弹性扩容，平稳支撑交易峰值。|/web/cra1/assets/img/ref/prod-ssl.jpg
制造企业数字化|专有网络与数据备份支撑生产系统上云。|/web/cra1/assets/img/ref/prod-bare.jpg',
            'footer_qrcode_url' => '',
            'header_slogan' => '让云与算力变得更简单',
            'show_header_slogan' => '1',
            'sol_ind_ecommerce_highlights_text' => '高并发承载|弹性扩容应对大促流量洪峰，活动结束按需释放，成本可控。
全链路加速|CDN 静态加速与 BGP 多线网络，南北访问快人一步。
交易安全|DDoS 防护与 WAF 保障交易链路，SSL 加密全站数据。
数据洞察|订单与用户数据可靠存储，支撑精细化运营决策。',
            'sol_ind_finance_highlights_text' => '合规隔离|物理级隔离与私有网络，满足金融级安全合规要求。
交易稳定|高可用架构与多可用区容灾，保障 7×24 交易连续性。
数据加密|全链路加密传输与存储，敏感数据精细管控。
审计追溯|完善操作日志与监控告警，满足审计要求。',
            'sol_ind_game_highlights_text' => '全球同服|多地节点与全球加速，低延迟联机体验。
弹性开合服|开服分钟级部署，合服资源快速回收。
高防保障|T 级 DDoS 防护，保障服内体验不掉线。
研发提效|开发测试环境一键搭建，聚焦玩法创新。',
            'sol_ind_auto_highlights_text' => '车联网平台|海量设备接入与消息处理，车辆数据实时上云。
营销官网|官网与小程序稳定承载，促销活动弹性扩容。
经销商系统|多门店系统统一部署，数据集中管理。
数据安全|车主流通数据加密存储，隐私合规有保障。',
            'sol_ind_travel_highlights_text' => '票务系统|节假日购票高峰弹性承载，出票稳定。
智慧景区|视频、Wi-Fi、闸机数据统一上云管理。
内容分发|景区宣传内容全球 CDN 加速触达。
稳定运维|7×24 监控运维，旺季保障无忧。',
            'sol_ind_education_highlights_text' => '直播课堂|低延迟直播与高并发承载，上课体验流畅。
课件存储|海量课程资源对象存储，播放快速缓冲。
考试系统|考试周高并发弹性支撑，成绩数据可靠。
内容安全|传输加密与权限管控，保护教学内容。',
            'sol_ind_medical_highlights_text' => '影像存储|PACS 影像数据大容量低成本存储。
问诊平台|在线问诊系统稳定承载，就医体验顺畅。
数据合规|数据加密与访问审计，满足医疗数据合规。
容灾备份|核心业务数据异地备份，有备无患。',
            'sol_ind_agriculture_highlights_text' => '物联网接入|传感器与设备数据稳定上云，农情实时可视。
监控直播|茶园果园监控视频云端存储与回看。
产销平台|农产品电商系统一站式部署运营。
成本优化|按需付费模式，农业信息化轻资产起步。',
            'page_module_visibility_json' => '',
            'price_slider_cloud_text' => '',
            'page_module_orders_json' => '{"schema":1,"pages":{}}',
            'seo_site_title_suffix' => '',
            'seo_default_description' => '',
            'seo_default_keywords' => '',
            'seo_og_image' => '',
            'seo_page_meta_json' => '{"schema":1,"pages":{}}',
            'custom_css' => '',
            'custom_js' => '',
            'custom_css_enabled' => '1',
            'custom_js_enabled' => '1',
            'page_content_overrides_json' => '',
            'public_content_explicit_json' => '',
            'sol_page_title' => '全场景云解决方案',
            'sol_page_desc' => '按行业理解业务目标，按工作负载拆解资源与架构，从基础设施到上线流程形成可执行的云上方案。',
            'sol_hero_btn_text' => '按行业选择|#industry
咨询定制方案|/contact.html',
            'sol_industry_title' => '按行业选择解决方案',
            'sol_industry_desc' => '从行业场景出发识别访问、数据、合规和协作要求，再组合适合的基础产品。',
            'sol_cards_text' => '电商零售|围绕活动峰值、交易链路和数据运营规划架构。|/solution/ecommerce.html
金融科技|围绕隔离、审计、数据安全和业务连续性规划。|/solution/finance.html
游戏娱乐|围绕版本发布、联机访问和突发流量规划。|/solution/game.html
汽车出行|围绕设备接入、业务平台和数据协作规划。|/solution/auto.html
文化旅游|围绕票务高峰、内容分发和景区系统规划。|/solution/travel.html
在线教育|围绕直播、课程资源和考试业务规划。|/solution/education.html
智慧医疗|围绕影像数据、问诊服务和访问审计规划。|/solution/medical.html
智慧农业|围绕设备采集、视频资料和产销平台规划。|/solution/agriculture.html',
            'sol_cta_title' => '让方案从业务问题出发',
            'sol_cta_desc' => '选择行业方向，或提交工作负载和上线目标，获取架构咨询。',
            'sol_cta_text' => '查看云产品|/cart/goodsList.htm
咨询定制方案|/contact.html',
            'sol_ind_ecommerce_hero_title' => '电商零售解决方案',
            'sol_ind_ecommerce_hero_desc' => '有效应对大促带来的业务高并发问题，助力电商客户快速实现营销创新与业务增收。',
            'sol_ind_ecommerce_c1_title' => '高并发承载',
            'sol_ind_ecommerce_c1_desc' => '弹性扩容应对大促流量洪峰，活动结束按需释放，成本可控。',
            'sol_ind_ecommerce_c2_title' => '全链路加速',
            'sol_ind_ecommerce_c2_desc' => 'CDN 静态加速与 BGP 多线网络，南北访问快人一步。',
            'sol_ind_ecommerce_c3_title' => '交易安全',
            'sol_ind_ecommerce_c3_desc' => 'DDoS 防护与 WAF 保障交易链路，SSL 加密全站数据。',
            'sol_ind_ecommerce_c4_title' => '数据洞察',
            'sol_ind_ecommerce_c4_desc' => '订单与用户数据可靠存储，支撑精细化运营决策。',
            'sol_ind_finance_hero_title' => '金融科技解决方案',
            'sol_ind_finance_hero_desc' => '助力金融机构打造面向垂直场景的创新方案，实现金融机构与用户之间的高效触达。',
            'sol_ind_finance_c1_title' => '合规隔离',
            'sol_ind_finance_c1_desc' => '物理级隔离与私有网络，满足金融级安全合规要求。',
            'sol_ind_finance_c2_title' => '交易稳定',
            'sol_ind_finance_c2_desc' => '高可用架构与多可用区容灾，保障 7×24 交易连续性。',
            'sol_ind_finance_c3_title' => '数据加密',
            'sol_ind_finance_c3_desc' => '全链路加密传输与存储，敏感数据精细管控。',
            'sol_ind_finance_c4_title' => '审计追溯',
            'sol_ind_finance_c4_desc' => '完善操作日志与监控告警，满足审计要求。',
            'sol_ind_game_hero_title' => '游戏娱乐解决方案',
            'sol_ind_game_hero_desc' => '构建高质量、全方位、深度体验的游戏云平台，提升研发效率，增强交互体验。',
            'sol_ind_game_c1_title' => '全球同服',
            'sol_ind_game_c1_desc' => '多地节点与全球加速，低延迟联机体验。',
            'sol_ind_game_c2_title' => '弹性开合服',
            'sol_ind_game_c2_desc' => '开服分钟级部署，合服资源快速回收。',
            'sol_ind_game_c3_title' => '高防保障',
            'sol_ind_game_c3_desc' => 'T 级 DDoS 防护，保障服内体验不掉线。',
            'sol_ind_game_c4_title' => '研发提效',
            'sol_ind_game_c4_desc' => '开发测试环境一键搭建，聚焦玩法创新。',
            'sol_ind_auto_hero_title' => '汽车出行解决方案',
            'sol_ind_auto_hero_desc' => '面向汽车行业提供全场景信息化解决方案，助力车企打造更开放的新型连接生态。',
            'sol_ind_auto_c1_title' => '车联网平台',
            'sol_ind_auto_c1_desc' => '海量设备接入与消息处理，车辆数据实时上云。',
            'sol_ind_auto_c2_title' => '营销官网',
            'sol_ind_auto_c2_desc' => '官网与小程序稳定承载，促销活动弹性扩容。',
            'sol_ind_auto_c3_title' => '经销商系统',
            'sol_ind_auto_c3_desc' => '多门店系统统一部署，数据集中管理。',
            'sol_ind_auto_c4_title' => '数据安全',
            'sol_ind_auto_c4_desc' => '车主流通数据加密存储，隐私合规有保障。',
            'sol_ind_travel_hero_title' => '文化旅游解决方案',
            'sol_ind_travel_hero_desc' => '通过"科技+文化旅游"的融合创新及落地应用，推动文旅行业智慧化发展。',
            'sol_ind_travel_c1_title' => '票务系统',
            'sol_ind_travel_c1_desc' => '节假日购票高峰弹性承载，出票稳定。',
            'sol_ind_travel_c2_title' => '智慧景区',
            'sol_ind_travel_c2_desc' => '视频、Wi-Fi、闸机数据统一上云管理。',
            'sol_ind_travel_c3_title' => '内容分发',
            'sol_ind_travel_c3_desc' => '景区宣传内容全球 CDN 加速触达。',
            'sol_ind_travel_c4_title' => '稳定运维',
            'sol_ind_travel_c4_desc' => '7×24 监控运维，旺季保障无忧。',
            'sol_ind_education_hero_title' => '在线教育解决方案',
            'sol_ind_education_hero_desc' => '实现数据互联、可视化、高交互的云上教育环境，打造云时代教育治理新模式。',
            'sol_ind_education_c1_title' => '直播课堂',
            'sol_ind_education_c1_desc' => '低延迟直播与高并发承载，上课体验流畅。',
            'sol_ind_education_c2_title' => '课件存储',
            'sol_ind_education_c2_desc' => '海量课程资源对象存储，播放快速缓冲。',
            'sol_ind_education_c3_title' => '考试系统',
            'sol_ind_education_c3_desc' => '考试周高并发弹性支撑，成绩数据可靠。',
            'sol_ind_education_c4_title' => '内容安全',
            'sol_ind_education_c4_desc' => '传输加密与权限管控，保护教学内容。',
            'sol_ind_medical_hero_title' => '智慧医疗解决方案',
            'sol_ind_medical_hero_desc' => '协助医疗机构打造资源共享、再利用的数据生态循环，提高资源配置效率。',
            'sol_ind_medical_c1_title' => '影像存储',
            'sol_ind_medical_c1_desc' => 'PACS 影像数据大容量低成本存储。',
            'sol_ind_medical_c2_title' => '问诊平台',
            'sol_ind_medical_c2_desc' => '在线问诊系统稳定承载，就医体验顺畅。',
            'sol_ind_medical_c3_title' => '数据合规',
            'sol_ind_medical_c3_desc' => '数据加密与访问审计，满足医疗数据合规。',
            'sol_ind_medical_c4_title' => '容灾备份',
            'sol_ind_medical_c4_desc' => '核心业务数据异地备份，有备无患。',
            'sol_ind_agriculture_hero_title' => '智慧农业解决方案',
            'sol_ind_agriculture_hero_desc' => '助力农企构建智慧农业生产服务体系，提升农业精细化种植与管理水平。',
            'sol_ind_agriculture_c1_title' => '物联网接入',
            'sol_ind_agriculture_c1_desc' => '传感器与设备数据稳定上云，农情实时可视。',
            'sol_ind_agriculture_c2_title' => '监控直播',
            'sol_ind_agriculture_c2_desc' => '茶园果园监控视频云端存储与回看。',
            'sol_ind_agriculture_c3_title' => '产销平台',
            'sol_ind_agriculture_c3_desc' => '农产品电商系统一站式部署运营。',
            'sol_ind_agriculture_c4_title' => '成本优化',
            'sol_ind_agriculture_c4_desc' => '按需付费模式，农业信息化轻资产起步。',
        ];
    }
}
