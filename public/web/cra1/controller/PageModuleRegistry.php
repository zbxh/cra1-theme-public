<?php
if(PHP_SAPI!=='cli'&&realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){http_response_code(404);exit;}

/**
 * CRA1 页面模块注册表（服务端唯一 manifest）
 * 同时被前台 hooks.php 与独立管理台 index.php 引入（同目录，__DIR__ 语义一致）。
 * 配置只允许保存白名单模块 ID；Hero 固定不参与排序；partial 路径不出现在配置里。
 */
function cra1_manifest_replace(array $search, array $replace, $value) {
    if (is_array($value)) { foreach ($value as $k => $v) { $value[$k] = cra1_manifest_replace($search, $replace, $v); } return $value; }
    return is_string($value) ? str_replace($search, $replace, $value) : $value;
}

if (!function_exists('cra1_page_module_manifest')) {

    function cra1_page_module_manifest()
    {
        static $mf = null;
        if ($mf !== null) {
            return $mf;
        }
        // 产品页 6 个模块：文案按页配置（§6：前台可见内容全部可在后台控制）
        // 每个模块一条 rows 字段，行格式「页面|标题|描述」（条目另有一条「页面|名称|描述」）
        $productModules = [
            ['id' => 'overview', 'label' => '产品概览', 'fieldKeys' => ['prod_overview_title_text', 'prod_overview_items_text']],
            ['id' => 'advantages', 'label' => '核心优势', 'fieldKeys' => ['prod_advantages_title_text', 'prod_advantages_items_text']],
            ['id' => 'scenarios', 'label' => '适用场景', 'fieldKeys' => ['prod_scenarios_title_text', 'prod_scenarios_items_text']],
            ['id' => 'service', 'label' => '服务与规格', 'fieldKeys' => ['prod_service_title_text', 'prod_service_items_text', 'prod_service_heads_text']],
            ['id' => 'faq', 'label' => '常见问题', 'fieldKeys' => ['prod_faq_title_text', 'prod_faq_items_text']],
            ['id' => 'cta', 'label' => '行动按钮', 'fieldKeys' => ['prod_cta_title_text', 'prod_cta_btn1_text']],
            // 扩充布局（共享模板，行数据按页过滤）
            ['id' => 'spec_matrix', 'label' => '规格口径', 'fieldKeys' => ['show_spec_matrix', 'spec_matrix_title', 'spec_matrix_desc', 'spec_matrix_link', 'spec_matrix_more_text', 'spec_matrix_rows_text']],
            ['id' => 'price_slider', 'label' => '配置价格对照', 'fieldKeys' => ['show_price_slider', 'price_slider_title', 'price_slider_desc', 'price_slider_link', 'price_slider_more_text', 'price_slider_rows_text']],
            ['id' => 'compare_split', 'label' => '常见做法对照', 'fieldKeys' => ['show_compare_split', 'compare_split_title', 'compare_split_desc', 'compare_split_left', 'compare_split_right', 'compare_split_rows_text']],
        ];
        $industryModules = [
            // 每个行业页在注册时替换为对应 sol_ind_<industry>_highlights_text canonical rows 字段
            ['id' => 'highlights', 'label' => '行业亮点', 'fieldKeys' => []],
            ['id' => 'solution_extra', 'label' => '更多服务', 'fieldKeys' => ['show_solution_extra', 'solution_extra_text']],
        ];
        $listModules = [
            ['id' => 'listing_nav', 'label' => '内容导航', 'fieldKeys' => ['%nav_switch%', '%nav_text%']],
            ['id' => 'core_listing', 'label' => '内容列表', 'fieldKeys' => []],
            ['id' => 'listing_foot', 'label' => '底部说明', 'fieldKeys' => ['%foot_switch%', '%foot_text%']],
            // 扩充布局（共享模板，行数据按页过滤）
            ['id' => 'link_tiles', 'label' => '关联入口', 'fieldKeys' => ['show_link_tiles', 'link_tiles_title', 'link_tiles_link', 'link_tiles_more_text', 'link_tiles_rows_text']],
            ['id' => 'icon_ribbon', 'label' => '阅读指引', 'fieldKeys' => ['show_icon_ribbon', 'icon_ribbon_title', 'icon_ribbon_link', 'icon_ribbon_more_text', 'icon_ribbon_rows_text']],
            ['id' => 'faq_board', 'label' => '列表常见问题', 'fieldKeys' => ['show_faq_board', 'faq_board_title', 'faq_board_desc', 'faq_board_link', 'faq_board_more_text', 'faq_board_rows_text']],
        ];
        $detailModules = [
            ['id' => 'core_article', 'label' => '正文内容', 'fieldKeys' => []],
            ['id' => 'detail_rel', 'label' => '相关推荐', 'fieldKeys' => ['show_detail_rel', 'detail_rel_text']],
            ['id' => 'page_cta', 'label' => '继续了解', 'fieldKeys' => ['show_page_cta', 'page_cta_text']],
            ['id' => 'link_tiles', 'label' => '相关入口', 'fieldKeys' => ['show_link_tiles', 'link_tiles_title', 'link_tiles_link', 'link_tiles_more_text', 'link_tiles_rows_text']],
            ['id' => 'spec_matrix', 'label' => '延伸阅读', 'fieldKeys' => ['show_spec_matrix', 'spec_matrix_title', 'spec_matrix_desc', 'spec_matrix_link', 'spec_matrix_more_text', 'spec_matrix_rows_text']],
            ['id' => 'icon_ribbon', 'label' => '内容要点', 'fieldKeys' => ['show_icon_ribbon', 'icon_ribbon_title', 'icon_ribbon_link', 'icon_ribbon_more_text', 'icon_ribbon_rows_text']],
        ];
        $mf = [
            'home' => [
                'label' => '首页', 'route' => '/', 'sortKey' => 'home.v1', 'heroLabel' => '首屏轮播与公告条',
                'modules' => [
                    ['id' => 'capability', 'label' => '轮播下双面板', 'fieldKeys' => ['show_capability', 'cap1_title', 'cap1_desc', 'cap1_link', 'panel_links_text', 'cap_cards_text']],
                    ['id' => 'pricing', 'label' => '产品与价格', 'fieldKeys' => ['show_pricing', 'pricing_title', 'pricing_desc', 'pricing_link', 'pricing_more_text', 'home_products_text', 'home_products_limit', 'home_products_mobile_limit', 'home_products_group']],
                    ['id' => 'solutions', 'label' => '解决方案', 'fieldKeys' => ['show_solutions', 'sol_title', 'sol_desc', 'sol_link', 'sol_more_text', 'sol_home_cards_text']],
                    ['id' => 'steps', 'label' => '快速上手步骤', 'fieldKeys' => ['show_steps', 'band_title', 'band_desc', 'band_link', 'band_more_text', 'band_items_text']],
                    ['id' => 'nodes', 'label' => '全球服务节点', 'fieldKeys' => ['show_nodes', 'nodes_title', 'nodes_desc', 'nodes_link', 'nodes_more_text', 'nodes_text']],
                    ['id' => 'news', 'label' => '新闻公告', 'fieldKeys' => ['show_news', 'news_title', 'news_desc', 'news_link', 'news_more_text']],
                    // —— 扩充布局（v2.27 新增，默认关闭；后台打开开关即上线）——
                    ['id' => 'figure_band', 'label' => '数据带', 'fieldKeys' => ['show_figure_band', 'figure_band_title', 'figure_band_desc', 'figure_band_link', 'figure_band_more_text', 'figure_band_rows_text']],
                    ['id' => 'switch_deck', 'label' => '能力切换台', 'fieldKeys' => ['show_switch_deck', 'switch_deck_title', 'switch_deck_desc', 'switch_deck_link', 'switch_deck_more_text', 'switch_deck_rows_text']],
                    ['id' => 'duo_feature', 'label' => '非对称双栏', 'fieldKeys' => ['show_duo_feature', 'duo_feature_title', 'duo_feature_desc', 'duo_feature_rows_text']],
                    ['id' => 'rail_scroll', 'label' => '横滑卡片轨', 'fieldKeys' => ['show_rail_scroll', 'rail_scroll_title', 'rail_scroll_desc', 'rail_scroll_link', 'rail_scroll_more_text', 'rail_scroll_rows_text']],
                    ['id' => 'choice_ladder', 'label' => '阶梯配置', 'fieldKeys' => ['show_choice_ladder', 'choice_ladder_title', 'choice_ladder_desc', 'choice_ladder_link', 'choice_ladder_more_text', 'choice_ladder_rows_text']],
                    ['id' => 'proof_wall', 'label' => '客户证言墙', 'fieldKeys' => ['show_proof_wall', 'proof_wall_title', 'proof_wall_desc', 'proof_wall_link', 'proof_wall_more_text', 'proof_wall_rows_text']],
                    ['id' => 'step_ribbon', 'label' => '横向进度带', 'fieldKeys' => ['show_step_ribbon', 'step_ribbon_title', 'step_ribbon_desc', 'step_ribbon_link', 'step_ribbon_more_text', 'step_ribbon_rows_text']],
                    ['id' => 'link_tiles', 'label' => '产品磁贴墙', 'fieldKeys' => ['show_link_tiles', 'link_tiles_title', 'link_tiles_link', 'link_tiles_more_text', 'link_tiles_rows_text']],
                    ['id' => 'icon_ribbon', 'label' => '图标能力条', 'fieldKeys' => ['show_icon_ribbon', 'icon_ribbon_title', 'icon_ribbon_link', 'icon_ribbon_more_text', 'icon_ribbon_rows_text']],
                    ['id' => 'spec_matrix', 'label' => '规格对照表', 'fieldKeys' => ['show_spec_matrix', 'spec_matrix_title', 'spec_matrix_desc', 'spec_matrix_link', 'spec_matrix_more_text', 'spec_matrix_rows_text']],
                ],
            ],
            'about' => [
                'label' => '关于页', 'route' => '/about.html', 'sortKey' => 'about.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'about_company', 'label' => '企业信息', 'fieldKeys' => ['copy_about_company_text']],
                    ['id' => 'about_honor', 'label' => '资质与荣誉', 'fieldKeys' => ['show_about_honor', 'about_honor_text']],
                    ['id' => 'about_partner', 'label' => '合作案例', 'fieldKeys' => ['show_about_partner', 'about_partner_text']],
                    ['id' => 'about_timeline', 'label' => '发展历程', 'fieldKeys' => ['show_about_timeline', 'about_timeline_text']],
                    ['id' => 'timeline_road', 'label' => '关键节点时间轴', 'fieldKeys' => ['show_timeline_road', 'timeline_road_title', 'timeline_road_desc', 'timeline_road_link', 'timeline_road_more_text', 'timeline_road_rows_text']],
                    ['id' => 'figure_band', 'label' => '平台规模数据', 'fieldKeys' => ['show_figure_band', 'figure_band_title', 'figure_band_desc', 'figure_band_link', 'figure_band_more_text', 'figure_band_rows_text']],
                    ['id' => 'quote_stage', 'label' => '主张引用', 'fieldKeys' => ['show_quote_stage', 'quote_stage_text', 'quote_stage_author', 'quote_stage_role', 'quote_stage_link', 'quote_stage_more_text', 'quote_stage_points_text']],
                ],
            ],
            'contact' => [
                'label' => '联系页', 'route' => '/contact.html', 'sortKey' => 'contact.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'contact_cards', 'label' => '联系方式卡片', 'fieldKeys' => ['show_contact_cards', 'contact_cards_text']],
                    ['id' => 'contact_form', 'label' => '提交咨询', 'fieldKeys' => ['copy_contact_form_text']],
                    ['id' => 'contact_service', 'label' => '服务与响应', 'fieldKeys' => ['show_contact_service', 'contact_service_text']],
                    ['id' => 'faq_board', 'label' => '常见问题', 'fieldKeys' => ['show_faq_board', 'faq_board_title', 'faq_board_desc', 'faq_board_link', 'faq_board_more_text', 'faq_board_rows_text']],
                    ['id' => 'spec_matrix', 'label' => '服务口径', 'fieldKeys' => ['show_spec_matrix', 'spec_matrix_title', 'spec_matrix_desc', 'spec_matrix_link', 'spec_matrix_more_text', 'spec_matrix_rows_text']],
                    ['id' => 'icon_ribbon', 'label' => '服务能力', 'fieldKeys' => ['show_icon_ribbon', 'icon_ribbon_title', 'icon_ribbon_link', 'icon_ribbon_more_text', 'icon_ribbon_rows_text']],
                ],
            ],
            'solution' => [
                'label' => '方案总览', 'route' => '/solution.html', 'sortKey' => 'solution.overview.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'industry', 'label' => '按行业选择', 'fieldKeys' => ['sol_industry_title', 'sol_industry_desc', 'sol_cards_text']],
                    ['id' => 'workload', 'label' => '按工作负载', 'fieldKeys' => ['copy_workload_text']],
                    ['id' => 'method', 'label' => '方法步骤', 'fieldKeys' => ['copy_method_text']],
                    ['id' => 'process', 'label' => '落地流程', 'fieldKeys' => ['copy_process_text']],
                    ['id' => 'faq', 'label' => '常见问题', 'fieldKeys' => []],
                    ['id' => 'cta', 'label' => '行动按钮', 'fieldKeys' => ['sol_cta_title', 'sol_cta_desc', 'sol_cta_text']],
                    ['id' => 'solution_extra', 'label' => '更多服务', 'fieldKeys' => ['show_solution_extra', 'solution_extra_text']],
                    ['id' => 'stack_board', 'label' => '方案分层', 'fieldKeys' => ['show_stack_board', 'stack_board_title', 'stack_board_desc', 'stack_board_link', 'stack_board_more_text', 'stack_board_rows_text']],
                    ['id' => 'compare_split', 'label' => '做法对照', 'fieldKeys' => ['show_compare_split', 'compare_split_title', 'compare_split_desc', 'compare_split_left', 'compare_split_right', 'compare_split_rows_text']],
                    ['id' => 'proof_wall', 'label' => '客户证言', 'fieldKeys' => ['show_proof_wall', 'proof_wall_title', 'proof_wall_desc', 'proof_wall_link', 'proof_wall_more_text', 'proof_wall_rows_text']],
                ],
            ],
            '404' => [
                'label' => '404 页', 'route' => '/404.html', 'sortKey' => 'error.404.v1', 'heroLabel' => '404 主视觉（固定）',
                // 404 页按 §12.1 豁免：错误页只需一屏内说明情况并给出出口，
                // 不堆模块（出口按钮已在 404 主视觉内），故此处为空
                'modules' => [],
            ],
            'document' => [
                'label' => '文档中心', 'route' => '/document.html', 'sortKey' => 'document.center.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'doc_quick', 'label' => '快捷入口', 'fieldKeys' => ['show_doc_quick', 'doc_quick_text']],
                    ['id' => 'core_listing', 'label' => '文档搜索与分组', 'fieldKeys' => []],
                    ['id' => 'doc_guide', 'label' => '使用指引', 'fieldKeys' => ['show_doc_guide', 'doc_guide_text']],
                    ['id' => 'doc_shelf', 'label' => '文档分册', 'fieldKeys' => ['show_doc_shelf', 'doc_shelf_title', 'doc_shelf_desc', 'doc_shelf_link', 'doc_shelf_more_text', 'doc_shelf_rows_text']],
                    ['id' => 'step_ribbon', 'label' => '接入步骤', 'fieldKeys' => ['show_step_ribbon', 'step_ribbon_title', 'step_ribbon_desc', 'step_ribbon_link', 'step_ribbon_more_text', 'step_ribbon_rows_text']],
                    ['id' => 'faq_board', 'label' => '文档常见问题', 'fieldKeys' => ['show_faq_board', 'faq_board_title', 'faq_board_desc', 'faq_board_link', 'faq_board_more_text', 'faq_board_rows_text']],
                ],
            ],
            'document-result' => [
                'label' => '文档搜索', 'route' => '/document-result.html', 'sortKey' => 'document.search.v1', 'heroLabel' => '搜索主视觉（固定）',
                'modules' => [
                    ['id' => 'core_results', 'label' => '搜索结果', 'fieldKeys' => []],
                    ['id' => 'doc_result', 'label' => '搜索建议', 'fieldKeys' => ['show_doc_result', 'doc_result_text']],
                    ['id' => 'page_cta', 'label' => '继续了解', 'fieldKeys' => ['show_page_cta', 'page_cta_text']],
                    ['id' => 'link_tiles', 'label' => '常用入口', 'fieldKeys' => ['show_link_tiles', 'link_tiles_title', 'link_tiles_link', 'link_tiles_more_text', 'link_tiles_rows_text']],
                    ['id' => 'spec_matrix', 'label' => '搜索口径说明', 'fieldKeys' => ['show_spec_matrix', 'spec_matrix_title', 'spec_matrix_desc', 'spec_matrix_link', 'spec_matrix_more_text', 'spec_matrix_rows_text']],
                ],
            ],
            'news-classify' => [
                'label' => '新闻分类', 'route' => '/news-classify.html', 'sortKey' => 'news.classify.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'core_listing', 'label' => '分类列表', 'fieldKeys' => []],
                    ['id' => 'news_classify_nav', 'label' => '内容导航', 'fieldKeys' => ['show_news_classify_nav', 'news_classify_nav_text']],
                    ['id' => 'page_cta', 'label' => '继续了解', 'fieldKeys' => ['show_page_cta', 'page_cta_text']],
                    ['id' => 'link_tiles', 'label' => '关联入口', 'fieldKeys' => ['show_link_tiles', 'link_tiles_title', 'link_tiles_link', 'link_tiles_more_text', 'link_tiles_rows_text']],
                    ['id' => 'icon_ribbon', 'label' => '分类说明', 'fieldKeys' => ['show_icon_ribbon', 'icon_ribbon_title', 'icon_ribbon_link', 'icon_ribbon_more_text', 'icon_ribbon_rows_text']],
                ],
            ],
            'recruit' => [
                'label' => '人才招聘', 'route' => '/recruit.html', 'sortKey' => 'recruit.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'core_intro', 'label' => '招聘方向', 'fieldKeys' => ['copy_core_intro_text']],
                    ['id' => 'recruit_benefits', 'label' => '福利与成长', 'fieldKeys' => ['show_recruit_benefits', 'recruit_benefits_text']],
                    ['id' => 'recruit_flow', 'label' => '招聘流程', 'fieldKeys' => ['show_recruit_flow', 'recruit_flow_text']],
                    ['id' => 'step_ribbon', 'label' => '应聘步骤', 'fieldKeys' => ['show_step_ribbon', 'step_ribbon_title', 'step_ribbon_desc', 'step_ribbon_link', 'step_ribbon_more_text', 'step_ribbon_rows_text']],
                    ['id' => 'figure_band', 'label' => '团队规模', 'fieldKeys' => ['show_figure_band', 'figure_band_title', 'figure_band_desc', 'figure_band_link', 'figure_band_more_text', 'figure_band_rows_text']],
                    ['id' => 'icon_ribbon', 'label' => '我们看重', 'fieldKeys' => ['show_icon_ribbon', 'icon_ribbon_title', 'icon_ribbon_link', 'icon_ribbon_more_text', 'icon_ribbon_rows_text']],
                ],
            ],
            'feedback' => [
                'label' => '反馈页', 'route' => '/feedback.html', 'sortKey' => 'feedback.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'feedback_channels', 'label' => '反馈渠道', 'fieldKeys' => ['show_feedback_channels', 'feedback_channels_text']],
                    ['id' => 'core_form', 'label' => '反馈表单', 'fieldKeys' => ['copy_core_form_text']],
                    ['id' => 'feedback_flow', 'label' => '处理流程', 'fieldKeys' => ['show_feedback_flow', 'feedback_flow_text']],
                    ['id' => 'faq_board', 'label' => '反馈常见问题', 'fieldKeys' => ['show_faq_board', 'faq_board_title', 'faq_board_desc', 'faq_board_link', 'faq_board_more_text', 'faq_board_rows_text']],
                    ['id' => 'spec_matrix', 'label' => '受理口径', 'fieldKeys' => ['show_spec_matrix', 'spec_matrix_title', 'spec_matrix_desc', 'spec_matrix_link', 'spec_matrix_more_text', 'spec_matrix_rows_text']],
                    ['id' => 'icon_ribbon', 'label' => '受理范围', 'fieldKeys' => ['show_icon_ribbon', 'icon_ribbon_title', 'icon_ribbon_link', 'icon_ribbon_more_text', 'icon_ribbon_rows_text']],
                ],
            ],
            'activities' => [
                'label' => '活动页', 'route' => '/activities.html', 'sortKey' => 'activities.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'core_activities', 'label' => '活动类型', 'fieldKeys' => ['copy_core_activities_text']],
                    ['id' => 'activity_rules', 'label' => '活动说明', 'fieldKeys' => ['show_activity_rules', 'activity_rules_text']],
                    ['id' => 'cta_activities', 'label' => '行动按钮', 'fieldKeys' => ['copy_cta_activities_text']],
                    ['id' => 'choice_ladder', 'label' => '活动档位', 'fieldKeys' => ['show_choice_ladder', 'choice_ladder_title', 'choice_ladder_desc', 'choice_ladder_link', 'choice_ladder_more_text', 'choice_ladder_rows_text']],
                    ['id' => 'faq_board', 'label' => '活动常见问题', 'fieldKeys' => ['show_faq_board', 'faq_board_title', 'faq_board_desc', 'faq_board_link', 'faq_board_more_text', 'faq_board_rows_text']],
                    ['id' => 'spec_matrix', 'label' => '参与须知', 'fieldKeys' => ['show_spec_matrix', 'spec_matrix_title', 'spec_matrix_desc', 'spec_matrix_link', 'spec_matrix_more_text', 'spec_matrix_rows_text']],
                ],
            ],
            'service-guarantee' => [
                'label' => '服务保障', 'route' => '/service-guarantee.html', 'sortKey' => 'service.guarantee.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'support_cards', 'label' => '保障内容', 'fieldKeys' => ['copy_support_cards_text']],
                    ['id' => 'document_band', 'label' => '文档引导', 'fieldKeys' => ['copy_document_band_text']],
                    ['id' => 'cta_guarantee', 'label' => '行动按钮', 'fieldKeys' => ['copy_cta_guarantee_text']],
                    ['id' => 'figure_band', 'label' => '服务指标', 'fieldKeys' => ['show_figure_band', 'figure_band_title', 'figure_band_desc', 'figure_band_link', 'figure_band_more_text', 'figure_band_rows_text']],
                    ['id' => 'spec_matrix', 'label' => 'SLA 口径', 'fieldKeys' => ['show_spec_matrix', 'spec_matrix_title', 'spec_matrix_desc', 'spec_matrix_link', 'spec_matrix_more_text', 'spec_matrix_rows_text']],
                    ['id' => 'faq_board', 'label' => '保障常见问题', 'fieldKeys' => ['show_faq_board', 'faq_board_title', 'faq_board_desc', 'faq_board_link', 'faq_board_more_text', 'faq_board_rows_text']],
                    ['id' => 'region_ledger', 'label' => '服务覆盖清单', 'fieldKeys' => ['show_region_ledger', 'region_ledger_title', 'region_ledger_desc', 'region_ledger_link', 'region_ledger_more_text', 'region_ledger_rows_text']],
                ],
            ],
        ];
        $mf['news'] = [
            'label' => '新闻列表', 'route' => '/news.html', 'sortKey' => 'content.list.v1', 'heroLabel' => '页面主视觉',
            'modules' => cra1_manifest_replace(['%nav_switch%', '%nav_text%', '%foot_switch%', '%foot_text%'],
                ['show_news_nav', 'news_nav_text', 'show_news_foot', 'news_foot_text'], $listModules),
        ];
        $mf['announce'] = [
            'label' => '公告列表', 'route' => '/announce.html', 'sortKey' => 'content.list.v1', 'heroLabel' => '页面主视觉',
            'modules' => cra1_manifest_replace(['%nav_switch%', '%nav_text%', '%foot_switch%', '%foot_text%'],
                ['show_announce_nav', 'announce_nav_text', 'show_announce_foot', 'announce_foot_text'], $listModules),
        ];
        foreach (['news-details' => '新闻详情', 'announce-details' => '公告详情', 'document-details' => '文档详情', 'document-view' => '文档浏览'] as $pk => $lb) {
            $mf[$pk] = [
                'label' => $lb, 'route' => '/' . $pk . '.html', 'sortKey' => 'content.detail.v1', 'heroLabel' => '页面主视觉',
                'modules' => $detailModules,
            ];
        }
        foreach (['cps' => '推广合作', 'agent' => '代理伙伴'] as $k => $lb) {
            $mf['partner/' . $k] = [
                'label' => $lb, 'route' => '/partner/' . $k . '.html', 'sortKey' => 'partner.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'core_program', 'label' => '合作要点', 'fieldKeys' => []],
                    ['id' => 'partner_extra', 'label' => $lb . '权益', 'fieldKeys' => ['show_partner_' . $k . '_extra', 'partner_' . $k . '_extra_text']],
                    ['id' => 'cta', 'label' => '合作政策提示', 'fieldKeys' => []],
                    ['id' => 'step_ribbon', 'label' => '合作步骤', 'fieldKeys' => ['show_step_ribbon', 'step_ribbon_title', 'step_ribbon_desc', 'step_ribbon_link', 'step_ribbon_more_text', 'step_ribbon_rows_text']],
                    ['id' => 'figure_band', 'label' => '合作收益', 'fieldKeys' => ['show_figure_band', 'figure_band_title', 'figure_band_desc', 'figure_band_link', 'figure_band_more_text', 'figure_band_rows_text']],
                    ['id' => 'faq_board', 'label' => '合作常见问题', 'fieldKeys' => ['show_faq_board', 'faq_board_title', 'faq_board_desc', 'faq_board_link', 'faq_board_more_text', 'faq_board_rows_text']],
                ],
            ];
        }
        foreach (['ecommerce' => '电商零售', 'finance' => '金融科技', 'game' => '游戏娱乐', 'auto' => '汽车出行', 'travel' => '文化旅游', 'education' => '在线教育', 'medical' => '智慧医疗', 'agriculture' => '智慧农业'] as $k => $lb) {
            $mf['solution/' . $k] = [
                'label' => '行业方案 · ' . $lb, 'route' => '/solution/' . $k . '.html', 'sortKey' => 'solution.industry.v1', 'heroLabel' => '页面主视觉',
                'modules' => [
                    ['id' => 'highlights', 'label' => '行业亮点', 'fieldKeys' => ['sol_ind_' . $k . '_highlights_text']],
                    ['id' => 'solution_extra', 'label' => '更多服务', 'fieldKeys' => ['show_solution_extra', 'solution_extra_text']],
                    ['id' => 'compare_split', 'label' => '做法对照', 'fieldKeys' => ['show_compare_split', 'compare_split_title', 'compare_split_desc', 'compare_split_left', 'compare_split_right', 'compare_split_rows_text']],
                    ['id' => 'faq_board', 'label' => '行业常见问题', 'fieldKeys' => ['show_faq_board', 'faq_board_title', 'faq_board_desc', 'faq_board_link', 'faq_board_more_text', 'faq_board_rows_text']],
                    ['id' => 'proof_wall', 'label' => '同行业客户', 'fieldKeys' => ['show_proof_wall', 'proof_wall_title', 'proof_wall_desc', 'proof_wall_link', 'proof_wall_more_text', 'proof_wall_rows_text']],
                ],
            ];
        }
        foreach (['cloud' => '云服务器', 'dedicated' => '物理裸机', 'domain' => '域名注册', 'domain_buy' => '域名购买', 'domain_register' => '域名注册服务', 'domain_shop' => '域名商店', 'ssl' => 'SSL 证书', 'sms' => '短信服务', 'rent' => '服务器租用', 'trusteeship' => '服务器托管', 'trademark' => '商标注册', 'icp' => 'ICP 备案', 'model' => '模型服务'] as $k => $lb) {
            $mf[$k] = [
                'label' => '产品 · ' . $lb, 'route' => '/' . $k . '.html', 'sortKey' => 'product.detail.v1', 'heroLabel' => '产品主视觉（固定）',
                'modules' => $productModules,
            ];
        }
        $mf['partner-agent'] = ['label' => '代理伙伴（旧地址）', 'route' => '/partner-agent.html', 'aliasOf' => 'partner/agent'];
        $mf['partner-reward'] = ['label' => '推广合作（旧地址）', 'route' => '/partner-reward.html', 'aliasOf' => 'partner/cps'];
        return $mf;
    }

    function cra1_page_module_registry()
    {
        $out = [];
        foreach (cra1_page_module_manifest() as $pk => $p) {
            if (isset($p['aliasOf'])) {
                continue;
            }
            $ids = [];
            foreach ($p['modules'] as $m) {
                $ids[] = $m['id'];
            }
            $out[$pk] = ['sortKey' => $p['sortKey'], 'modules' => $ids];
        }
        return $out;
    }

    /**
     * 模块入场动画：按模块的**视觉形态**分配动画类型（唯一真相）。
     *
     * 为什么按形态而不是按页面：同一形态的模块（卡片网格 / 列表 / 时间轴 / 双栏…）
     * 用同一种进场方式，跨页面观感才统一；形态不同则动画不同，避免"一刀切"的呆板。
     *
     * 返回 CSS 类名后缀（实际类为 `enter-<type>`），空字符串表示不加动画。
     * 前端 `[data-cra1-module]` 包裹层由 hooks.php 注入 `data-enter="<type>"`。
     *
     * 十二种机制（v2.38 从 6 种扩到 12 种），差异做在**机制**上而非参数上：
     *   grid      卡片错落浮起（等距 18px，逐张）
     *   flow      条目依次推进（自左侧 -18px，横向）
     *   list      整块自上落定（-12px，不逐项）
     *   zoom      地图节点逐点亮起（淡入+上浮，不缩放）
     *   fade      模糊对焦（无位移，opacity + blur）
     *   cta       托起并浮现（包裹层 +16px，文案自左侧依次）
     *   rise      层条按层序收敛升起（位移 26→20→14→8px 递减）
     *   trace     轴线自上而下描绘 + 节点依次点亮（scaleY）
     *   shear     两栏自上下相向合拢（同时存在正负 translateY）
     *   cascade   列优先交错 + 1° 扶正旋转（延迟序列非单调）
     *   count     数字从 0 滚到目标值（动的是内容本身）
     *   spotlight 引语背后光晕放大点亮（等比缩放 + 文字只淡入）
     *
     * 硬约束（与需求文档 7.5 一致）：
     *   - 只用 transform / opacity（GPU 合成，不触发布局与重绘）
     *   - 用 transition 而非 @keyframes：可中断，且不干扰验收脚本的 animation-play-state 暂停
     *     （唯一例外是 FAQ 展开与列表展开，见 src/app.css 的说明）
     *   - 进场位移量都很小（≤ 26px），避免大幅跳动
     *   - 缩放只允许出现在 aria-hidden 的装饰层（轴线/光晕），
     *     包裹层与可点元素一律不缩放（否则会压缩 24px 触控目标，破 WCAG 2.5.8）
     */
    function cra1_module_enter_type($moduleId)
    {
        static $map = [
            // —— 卡片网格：卡片按行列铺开，从下方错落浮起 ——
            'capability'      => 'grid',      // 轮播下双面板（左右分栏面板）
            'pricing'         => 'grid',      // 产品与价格（产品卡网格）
            'solutions'       => 'grid',      // 解决方案（bento 卡拼接）
            'industry'        => 'grid',      // 按行业选择
            'workload'        => 'grid',      // 按工作负载
            'highlights'      => 'grid',      // 行业亮点
            'about_honor'     => 'grid',      // 资质与荣誉
            'about_partner'   => 'grid',      // 合作案例
            'advantage'       => 'grid',      // 核心优势（产品页）
            'advantages'      => 'grid',
            'scenarios'       => 'grid',      // 适用场景
            'contact_cards'   => 'grid',      // 联系方式卡片
            'doc_quick'       => 'grid',      // 文档快捷入口
            'core_activities' => 'grid',      // 活动类型
            'recruit_benefits'=> 'grid',      // 福利与成长
            'feedback_channels' => 'grid',    // 反馈渠道
            'solution_extra'  => 'grid',      // 更多服务
            'support_cards'   => 'grid',
            'partner_extra'   => 'grid',

            // —— 流程 / 时间轴：按顺序逐项推进（横向滑入感） ——
            'steps'           => 'flow',      // 快速上手步骤
            'method'          => 'flow',      // 方法步骤
            'process'         => 'flow',      // 落地流程
            'about_timeline'  => 'flow',      // 发展历程
            'recruit_flow'    => 'flow',      // 招聘流程
            'feedback_flow'   => 'flow',      // 处理流程
            'core_program'    => 'flow',      // 招聘方向
            'service'         => 'flow',      // 服务与规格

            // —— 列表 / 长文：整块淡入上浮，不做逐项交错以免"逐行跳动" ——
            'news'            => 'list',      // 新闻公告（列表 + 卡片混合）
            'faq'             => 'list',      // 常见问题
            'core_listing'    => 'list',      // 内容列表
            'core_results'    => 'list',      // 搜索结果
            'doc_result'      => 'list',
            'core_article'    => 'list',      // 正文
            'detail_rel'      => 'list',      // 相关推荐
            'listing_nav'     => 'list',      // 内容导航
            'listing_foot'    => 'list',      // 底部说明
            'news_classify_nav' => 'list',
            'doc_guide'       => 'list',      // 使用指引
            'activity_rules'  => 'list',      // 活动说明
            'about_company'   => 'list',      // 企业信息
            'core_intro'      => 'list',      // 招聘方向（整块文案）
            'overview'        => 'list',      // 产品概览
            'document_band'   => 'list',

            // —— 暗色区块（全球节点地图）：从深处放大淡入，强调"地图铺开" ——
            'nodes'           => 'zoom',

            // —— 表单：整体淡入（表单内部有自己的焦点动效，不叠加位移） ——
            'contact_form'    => 'fade',
            'core_form'       => 'fade',

            // —— CTA 色带：从下方托起，配合品牌色强调 ——
            'cta'             => 'cta',
            'page_cta'        => 'cta',
            'cta_activities'  => 'cta',
            'cta_guarantee'   => 'cta',
            'contact_service' => 'cta',

            // —— 扩充共享布局（v2.27）：按形态归入既有六种机制 ——
            'figure_band'     => 'count',     // 数据带（暗色满幅 + 数字横排）：数字从 0 滚动到目标值
            'switch_deck'     => 'flow',      // 选项卡切换台：左列逐项滑入
            'duo_feature'     => 'grid',      // 非对称双栏：逐组浮起
            'rail_scroll'     => 'grid',      // 横滑卡片轨：卡片依次浮起
            'choice_ladder'   => 'cascade',   // 阶梯配置卡：列优先的斜向波浪
            'proof_wall'      => 'cascade',   // 证言墙：列优先的斜向波浪
            'step_ribbon'     => 'flow',      // 横向进度带：按顺序推进
            'link_tiles'      => 'grid',      // 产品磁贴墙
            'icon_ribbon'     => 'flow',      // 图标能力条：逐条滑入
            'spec_matrix'     => 'list',      // 规格对照表：整块淡入（逐行交错会跳）
            'timeline_road'   => 'trace',     // 时间轴：轴线自上而下描绘，节点依次点亮
            'compare_split'   => 'shear',     // 左右对照表：两栏自上下相向合拢
            'quote_stage'     => 'spotlight', // 大引用语：背后光晕绽放，文字只淡入
            'faq_board'       => 'list',      // 问答折叠板
            'price_slider'    => 'flow',      // 价格条：逐行推进
            'stack_board'     => 'rise',      // 分层堆叠板：层条按层序收敛升起
            'doc_shelf'       => 'cascade',   // 文档分册：列优先的斜向波浪
            'region_ledger'   => 'list',      // 地区清单账本：整块淡入（长清单逐行交错会零碎）

            // —— 未登记模块：走安全的整块淡入（新增模块不写映射也不会没动画） ——
            '__default'       => 'fade',
        ];
        if (isset($map[$moduleId])) {
            return $map[$moduleId];
        }
        return $map['__default'];
    }

    function cra1_page_layout_raw($rawJson = null)
    {
        static $parsed = null;
        if ($parsed !== null && $rawJson === null) {
            return $parsed;
        }
        $parsed = ['pages' => []];
        if ($rawJson === null) {
            $rawJson = function_exists('cra1_theme_config_raw') ? cra1_theme_config_raw('page_module_orders_json') : '';
        }
        if ((string) $rawJson === '') {
            return $parsed;
        }
        $decoded = json_decode((string) $rawJson, true);
        if (!is_array($decoded) || !isset($decoded['pages']) || !is_array($decoded['pages'])) {
            cra1_layout_audit('normalize', 'fail', 'illegal-json-fallback-default');
            return $parsed;
        }
        $parsed = $decoded;
        return $parsed;
    }

    function cra1_layout_audit($action, $result, $detail = '')
    {
        $line = date('Y-m-d H:i:s') . "\t" . $action . "\t" . $result . ($detail !== '' ? "\t" . $detail : '') . "\n";
        $dir = function_exists('runtime_path') ? runtime_path() . 'cra1_theme/' : dirname(__DIR__, 4) . '/runtime/cra1_theme/';
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }
        @file_put_contents($dir . 'page_layout.log', $line, FILE_APPEND);
    }

    function cra1_page_module_order($pageKey, $pagesDoc = null)
    {
        static $cache = [];
        if ($pagesDoc === null && isset($cache[$pageKey])) {
            return $cache[$pageKey];
        }
        $reg = cra1_page_module_registry();
        if (!isset($reg[$pageKey])) {
            return [];
        }
        $allowed = $reg[$pageKey]['modules'];
        $default = $reg[$pageKey]['modules'];
        $orders = [];
        if ($pagesDoc !== null) {
            $decoded = isset($pagesDoc['pages']) ? $pagesDoc : ['pages' => $pagesDoc];
        } elseif (function_exists('cra1_theme_config_raw')) {
            $raw = cra1_theme_config_raw('page_module_orders_json');
            $decoded = ($raw !== '') ? json_decode((string) $raw, true) : [];
        } else {
            $decoded = [];
        }
        if (is_array($decoded) && isset($decoded['pages']) && is_array($decoded['pages'])) {
            $sk = $reg[$pageKey]['sortKey'];
            if (isset($decoded['pageOverrides'][$pageKey]) && is_array($decoded['pageOverrides'][$pageKey])) {
                $orders = $decoded['pageOverrides'][$pageKey];
            } elseif (isset($decoded['pages'][$sk]) && is_array($decoded['pages'][$sk])) {
                $orders = $decoded['pages'][$sk];
            }
        }
        // 白名单 + 去重
        $seen = [];
        $out = [];
        foreach ($orders as $mid) {
            $mid = trim((string) $mid);
            if (in_array($mid, $allowed, true) && !isset($seen[$mid])) {
                $seen[$mid] = true;
                $out[] = $mid;
            }
        }
        // 补齐缺失（保持默认顺序追加到末尾）
        foreach ($default as $mid) {
            if (!isset($seen[$mid])) {
                $out[] = $mid;
            }
        }
        if ($pagesDoc === null) {
            $cache[$pageKey] = $out;
        }
        return $out;
    }

}

/** 布局 revision：pages 对象规范化后的指纹，用于保存冲突检测 */
if (!function_exists('cra1_page_layout_revision')) {

    function cra1_page_layout_revision(array $pages)
    {
        return substr(sha1((string) json_encode(['pages' => (object) $pages, 'schema' => 1], JSON_UNESCAPED_SLASHES)), 0, 12);
    }
}

/** 按页面/家族归一化顺序（独立于配置读取，供保存端校验使用） */
if (!function_exists('cra1_normalize_page_order')) {

    function cra1_normalize_page_order($pageKey, array $orders)
    {
        $mf = cra1_page_module_manifest();
        if (!isset($mf[$pageKey]) || isset($mf[$pageKey]['aliasOf'])) {
            return [];
        }
        $allowed = [];
        foreach ($mf[$pageKey]['modules'] as $m) {
            $allowed[] = $m['id'];
        }
        $seen = [];
        $out = [];
        foreach ($orders as $mid) {
            $mid = trim((string) $mid);
            if (in_array($mid, $allowed, true) && !isset($seen[$mid])) {
                $seen[$mid] = true;
                $out[] = $mid;
            }
        }
        foreach ($allowed as $mid) {
            if (!isset($seen[$mid])) {
                $out[] = $mid;
            }
        }
        return $out;
    }
}

/** Shared visibility contract used by the admin and the website renderer. */
function cra1_module_visibility_key(string $pageKey, string $moduleId): ?string
{
    $manifest = cra1_page_module_manifest();
    foreach (($manifest[$pageKey]['modules'] ?? []) as $module) {
        if ($module['id'] !== $moduleId) continue;
        foreach ($module['fieldKeys'] as $key) {
            if (strpos($key, 'show_') === 0) return $key;
        }
    }
    return null;
}

function cra1_visibility_legacy_raw(): array
{
    if (function_exists('cra1_admin_preview_config')) { $preview = cra1_admin_preview_config(); if ($preview !== null) return $preview; }
    static $raw = null;
    if ($raw !== null) return $raw;
    $runtime = function_exists('runtime_path') ? runtime_path() : dirname(__DIR__, 4) . '/runtime/';
    $raw = [];
    // Preserve the legacy resolver's precedence during migration.
    foreach ([$runtime . 'cra1_theme/config.json', __DIR__ . '/storage.json'] as $file) {
        if (is_file($file)) {
            $data = json_decode((string) file_get_contents($file), true);
            if (is_array($data)) $raw = array_merge($raw, $data);
        }
    }
    return $raw;
}

function cra1_module_visible(string $moduleId, string $pageKey, array $resolved, ?array $raw = null): bool
{
    $raw = $raw ?? cra1_visibility_legacy_raw();
    $key = cra1_module_visibility_key($pageKey, $moduleId);
    if ($key === null) return true;
    $doc = json_decode((string) ($raw['page_module_visibility_json'] ?? ''), true);
    if (is_array($doc)) {
        if (isset($doc['pages'][$pageKey]) && array_key_exists($moduleId, $doc['pages'][$pageKey])) {
            return $doc['pages'][$pageKey][$moduleId] === true;
        }
        if (isset($doc['defaults']) && array_key_exists($moduleId, $doc['defaults'])) {
            return $doc['defaults'][$moduleId] === true;
        }
    }
    $shared = function_exists('cra1_shared_module_keys') && isset(cra1_shared_module_keys()[$moduleId]);
    if (!$shared) return (string) ($resolved[$key] ?? '') === '1';
    if (array_key_exists($key, $raw) && $raw[$key] !== '' && $raw[$key] !== null) {
        return (string) $raw[$key] === '1';
    }
    $off = [];
    foreach (preg_split('/\r?\n/', (string) ($resolved['shared_module_off_text'] ?? '')) as $line) {
        if (trim($line) === '' || strpos(ltrim($line), '!') === 0) continue;
        $parts = array_map('trim', explode('|', $line));
        $off[$parts[0]] = array_values(array_filter(preg_split('/[,，\s]+/u', $parts[1] ?? '')));
    }
    if (isset($off[$moduleId]) && (!$off[$moduleId] || in_array('*', $off[$moduleId], true) || in_array($pageKey, $off[$moduleId], true))) return false;
    return true;
}
