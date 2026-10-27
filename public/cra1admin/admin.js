/**
 * CRA1 官网独立管理台
 * 技术栈：Alpine.js（复用主题的 alpine.min.js）+ daisyUI(CRA1 主题) + Tailwind
 * 结构：分组折叠侧边栏（带设置搜索） / 概览 / 配置页 / 安全与后台
 * 保存：分页面保存 + 脏值追踪 + 离开拦截（Ctrl/Cmd + S 保存本页）
 */
(function () {
  'use strict';

  /* 行业详情页字段生成器（每行业：Hero 标题/描述 + 4×卡片标题/描述） */
  function indFields(key, name) {
    var cap = [['c1', '亮点 1'], ['c2', '亮点 2'], ['c3', '亮点 3'], ['c4', '亮点 4']];
    var fields = [
      { key: 'sol_ind_' + key + '_hero_title', label: '页面主标题', type: 'text' },
      { key: 'sol_ind_' + key + '_hero_desc', label: '页面描述', type: 'textarea', rows: 3 },
    ];
    cap.forEach(function (c) {
      fields.push({ key: 'sol_ind_' + key + '_' + c[0] + '_title', label: name + ' · ' + c[1] + '标题', type: 'text' });
      fields.push({ key: 'sol_ind_' + key + '_' + c[0] + '_desc', label: name + ' · ' + c[1] + '描述', type: 'text' });
    });
    return fields;
  }

  var SECTIONS = [
    { key: 'site', label: '系统设置', items: [
      { key: 'site-info', label: '网站信息', fields: [
        { key: 'hotline', label: '客服热线（移动端抽屉底部展示）', type: 'text' },
      ], hint: '网站名称 / Logo / 备案号 / 版权等请使用 v10 原生「网站信息配置」维护；页脚相关内容在「页脚设置」中配置。' },
      { key: 'site-menu', label: '菜单导航', fields: [
        { key: 'cloud_menu_text', label: '菜单结构', type: 'rows', addLabel: '添加菜单项', tree: true, menuLike: true,
          hint: '支持四级菜单；完整的多级拖拽与自动商品目录预览请使用当前主题后台。数据来源为购物车时，下级由商品管理自动同步。各菜单左侧内容请在当前主题后台的对应菜单编辑窗口中设置。',
          cols: [
            { key: 'name', label: '名称', placeholder: '云服务器', required: true },
            { key: 'url', label: '链接', placeholder: '/cloud.html', url: true },
            { key: 'desc', label: '简介', placeholder: '弹性云服务器' },
            { key: 'level', label: '级别', type: 'select', options: [['1', '一级'], ['2', '二级'], ['3', '三级'], ['4', '四级']] },
            { key: 'blank', label: '新窗口打开', type: 'checkbox' },
            { key: 'icon', label: '图标', type: 'icon' },
            { key: 'source', label: '下级数据来源（仅一级）', type: 'select', options: [['', '手工菜单'], ['cart', '购物车分类与商品（自动同步）']] },
          ] },
      ]},
      { key: 'site-notice', label: '顶部信息条', fields: [
        { key: 'show_notice', label: '显示顶部信息条', type: 'switch' },
        { key: 'notice_bar_text', label: '左侧公告', type: 'rows', addLabel: '添加公告',
          hint: '多条公告自动轮播；点击「编辑」在弹窗中修改，眼睛图标可临时隐藏。',
          cols: [
            { key: 'text', label: '文字', placeholder: '欢迎使用智简魔方云服务平台', required: true },
            { key: 'url', label: '链接', placeholder: '/about.html', url: true },
          ] },
        { key: 'notice_bar_interval', label: '公告轮播间隔（秒，最小 3）', type: 'text' },
        { key: 'notice_bar_links_text', label: '右侧文本链接', type: 'rows', addLabel: '添加链接',
          cols: [
            { key: 'text', label: '文字', placeholder: '云文档', required: true },
            { key: 'url', label: '链接', placeholder: '/document.html', url: true },
          ] },
      ]},
      { key: 'site-float', label: '悬浮导航', fields: [
        { key: 'float_items_text', label: '右侧悬浮导航', type: 'rows', addLabel: '添加悬浮按钮',
          hint: '返回顶部按钮始终内置。图标可选内置键或图标库（点击「选择图标」搜索 Iconify / Icons8，保存后自动缓存到本站）。',
          cols: [
            { key: 'name', label: '名称', placeholder: '在线客服', required: true },
            { key: 'url', label: '链接', placeholder: '/contact.html', url: true },
            { key: 'icon', label: '图标', type: 'icon', placeholder: '内置 kefu 或 mdi:headset / icons8:headset' },
          ] },
        { key: 'float_enable', label: '显示右侧悬浮导航', type: 'switch' },
        { key: 'mega_notes_text', label: '「产品服务」下拉商品卡简介', type: 'rows', addLabel: '添加简介',
          hint: '按商品名称或 ID 匹配；未命中时显示通用文案。',
          cols: [
            { key: 'match', label: '商品名称或 ID', placeholder: '魔方云自定义-示例', required: true },
            { key: 'note', label: '简介', placeholder: '弹性云服务器，支持按需自定义配置' },
          ] },
      ]},
      { key: 'site-footer', label: '页脚设置', fields: [
        { key: 'show_footer_promise', label: '显示服务承诺条', type: 'switch' },
        { key: 'footer_promise_items_text', label: '服务承诺条', type: 'rows', addLabel: '添加承诺',
          hint: '每行：承诺文案|图标。每条承诺配独立图标（点选或搜索选择）。',
          cols: [
            { key: 'name', label: '承诺文案', placeholder: '3天 无忧退款', required: true },
            { key: 'icon', label: '图标', type: 'icon', placeholder: 'tabler:shield-check' },
          ] },
        { key: 'footer_about', label: '品牌简介', type: 'text' },
        { key: 'show_footer_cta', label: '显示行动按钮', type: 'switch' },
        { key: 'footer_cta_text', label: '行动按钮', type: 'rows', addLabel: '添加按钮',
          hint: '每行：按钮文字|链接。拖拽排序（第 1 个为渐变主按钮），眼睛隐藏后前台不渲染。',
          cols: [
            { key: 'name', label: '按钮文字', placeholder: '查看产品', required: true },
            { key: 'url', label: '链接', placeholder: '/cart/goodsList.htm', url: true },
          ] },
        { key: 'show_footer_links', label: '显示友情链接', type: 'switch' },
        { key: 'footer_links_text', label: '友情链接', type: 'rows', addLabel: '添加友链',
          hint: '每行：名称|链接|新窗口(1)。留空时显示 v10 系统友情链接。',
          cols: [
            { key: 'name', label: '名称', placeholder: '合作伙伴', required: true },
            { key: 'url', label: '链接', placeholder: 'https://example.com', url: true },
            { key: 'blank', label: '新窗口打开', type: 'checkbox' },
          ] },
        { key: 'show_footer_menu', label: '显示底部菜单栏', type: 'switch' },
        { key: 'footer_menu_text', label: '底部菜单栏', type: 'rows', addLabel: '添加底部栏目', tree: true, menuLike: true,
          hint: '与「菜单导航」同一套操作：树形展示、弹窗编辑、拖拽排序（拖一级整组移动）。一级项 = 底部栏目标题，其二级项 = 栏目内链接。首次打开已预填默认栏目，可直接增删改；清空全部栏目并保存时会回退默认渲染。',
          cols: [
            { key: 'name', label: '名称', placeholder: '产品', required: true },
            { key: 'url', label: '链接', placeholder: '/cloud.html', url: true },
            { key: 'desc', label: '简介（底部不展示）', placeholder: '' },
            { key: 'level', label: '级别', type: 'select', options: [['1', '一级（栏目标题）'], ['2', '二级（栏目链接）']] },
            { key: 'blank', label: '新窗口打开', type: 'checkbox' },
          ] },
        { key: 'show_footer_bottom', label: '显示底部信息行', type: 'switch' },
        { key: 'footer_icp_text', label: 'ICP 备案文案', type: 'text',
          hint: '留空时使用 v10 原生「ICP 备案号」配置；两者都为空则不显示。' },
        { key: 'footer_icp_url', label: 'ICP 备案链接', type: 'text', placeholder: 'https://beian.miit.gov.cn/' },
        { key: 'footer_copyright_text', label: '版权文案', type: 'text',
          hint: '留空时使用 v10 原生「版权信息」配置。' },
        { key: 'footer_qrcode_url', label: '客服二维码图片', type: 'text',
          hint: '留空时使用 v10 原生「客服二维码」；支持 https:// 图片地址或站内路径。' },
      ], hint: '页脚全部内容：服务承诺条、品牌简介与行动按钮、底部菜单栏、友情链接、底部信息行（用户协议 / 隐私政策 / ICP 备案 / 版权）。企业名称 / 电话 / 邮箱 / 二维码请使用 v10 原生配置。'},
      { key: 'site-custom', label: '自定义代码', fields: [
        { key: 'custom_css', label: '自定义 CSS', type: 'textarea', rows: 12,
          hint: '注入于全站样式表之后，级联最高优先级，无需 !important 即可覆盖主题样式。' },
        { key: 'custom_js', label: '自定义 JavaScript', type: 'textarea', rows: 12,
          hint: '在主题脚本与 Alpine 初始化完成之后执行（DOMContentLoaded 后、全局作用域）；定义全局变量请使用 window.xxx = ...。' },
      ]},
    ]},
    { key: 'home', label: '首页配置', items: [
      { key: 'home-carousel', label: '首屏轮播', fields: [
        { key: 'slides_text', label: '轮播内容', type: 'rows', addLabel: '添加轮播',
          hint: '支持 jpg/png/webp 图片与 mp4/webm 视频。点击「编辑」在弹窗中填写各段内容；拖拽排序，眼睛图标可临时隐藏。',
          cols: [
            { key: 'img', label: '图片/视频地址', placeholder: '/web/cra1/assets/img/banner/banner-hw-1.jpg', required: true },
            { key: 'url', label: '整页链接', placeholder: '/cloud.html', url: true },
            { key: 'title', label: '标题', placeholder: '弹性计算' },
            { key: 'desc', label: '描述', type: 'textarea', rows: 2, placeholder: '按需创建云服务器' },
            { key: 'btn', label: '按钮文字', placeholder: '查看产品' },
            { key: 'btn_url', label: '按钮链接', placeholder: '/cart/goodsList.htm', url: true },
          ] },
      ]},
      { key: 'home-capability', label: '轮播下双面板', fields: [
        { key: 'show_capability', label: '显示此区块', type: 'switch' },
        { key: 'cap1_title', label: '左栏标题', type: 'text' },
        { key: 'cap1_desc', label: '左栏描述', type: 'text' },
        { key: 'cap1_link', label: '左栏链接', type: 'text' },
        { key: 'panel_links_text', label: '左栏快捷链接', type: 'rows', addLabel: '添加快捷链接',
          hint: '建议 6 条，两行三列展示。',
          cols: [
            { key: 'text', label: '文字', placeholder: '云服务器', required: true },
            { key: 'url', label: '链接', placeholder: '/cloud.html', url: true },
          ] },
        { key: 'cap_cards', label: '右侧功能卡', type: 'cards',
          hint: '首屏下方面板右侧的 3 张功能入口卡。',
          items: [
            { key: 'cap2', label: '卡 2' },
            { key: 'cap3', label: '卡 3' },
            { key: 'cap4', label: '卡 4' },
          ],
          fields: [
            { key: 'icon', label: '图标', type: 'icon', placeholder: 'mdi:server / icons8:server' },
            { key: 'title', label: '标题', type: 'text' },
            { key: 'desc', label: '描述', type: 'textarea', rows: 3 },
            { key: 'link', label: '链接', type: 'text', placeholder: '/dedicated.html' },
          ] },
      ]},
      { key: 'home-pricing', label: '产品与价格模块', fields: [
        { key: 'show_pricing', label: '显示此区块', type: 'switch' },
        { key: 'pricing_title', label: '模块标题', type: 'text' },
        { key: 'pricing_desc', label: '模块描述', type: 'text' },
        { key: 'pricing_link', label: '右上链接', type: 'text' },
        { key: 'pricing_more_text', label: '右上链接文字', type: 'text' },
      ]},
      { key: 'home-products', label: '首页产品', fields: [
        { key: 'home_products_text', label: '指定商品', type: 'rows', addLabel: '添加商品',
          hint: '留空时按分组自动展示。名称与价格实时读取商品接口，此处只保存选择与顺序。',
          cols: [
            { key: 'id', label: '商品 ID', placeholder: '101', required: true },
            { key: 'order', label: '排序', placeholder: '1' },
            { key: 'tag', label: '展示标签', placeholder: '热门产品' },
          ] },
        { key: 'home_products_limit', label: '最多显示数量（1-12）', type: 'text' },
        { key: 'home_products_mobile_limit', label: '手机端显示产品数量（1-12）', type: 'text',
          hint: '仅作用于手机端（<640px）：超出该数量的产品默认隐藏，存在更多时显示「加载更多产品」文字按钮；PC 端始终全部显示，默认 3。' },
        { key: 'home_products_group', label: '默认分组 ID（0 为全部）', type: 'text' },
      ]},
      { key: 'home-solutions', label: '解决方案模块', fields: [
        { key: 'show_solutions', label: '显示此区块', type: 'switch' },
        { key: 'sol_title', label: '模块标题', type: 'text' },
        { key: 'sol_desc', label: '模块描述', type: 'text' },
        { key: 'sol_link', label: '右上链接', type: 'text' },
        { key: 'sol_more_text', label: '右上链接文字', type: 'text' },
        { key: 'sol_home_cards', label: '方案卡片', type: 'cards',
          hint: '首页解决方案模块的 4 张方案卡。',
          items: [
            { key: 'sol1', label: '方案 1' },
            { key: 'sol2', label: '方案 2' },
            { key: 'sol3', label: '方案 3' },
            { key: 'sol4', label: '方案 4' },
          ],
          fields: [
            { key: 'title', label: '标题', type: 'text' },
            { key: 'desc', label: '描述', type: 'textarea', rows: 3 },
            { key: 'url', label: '链接', type: 'text', placeholder: '/solution/ecommerce.html' },
          ] },
      ]},
      { key: 'home-steps', label: '快速上手步骤', fields: [
        { key: 'show_steps', label: '显示此区块', type: 'switch' },
        { key: 'band_title', label: '模块标题', type: 'text' },
        { key: 'band_desc', label: '模块描述', type: 'text' },
        { key: 'band_link', label: '右上链接', type: 'text' },
        { key: 'band_more_text', label: '右上链接文字', type: 'text' },
        { key: 'band_items', label: '步骤内容', type: 'cards',
          hint: '快速上手模块的 4 个步骤。',
          items: [
            { key: 'band_item1', label: '步骤 1' },
            { key: 'band_item2', label: '步骤 2' },
            { key: 'band_item3', label: '步骤 3' },
            { key: 'band_item4', label: '步骤 4' },
          ],
          fields: [
            { key: 'title', label: '标题', type: 'text' },
            { key: 'desc', label: '描述', type: 'textarea', rows: 3 },
          ] },
      ]},
      { key: 'home-nodes', label: '全球服务节点', fields: [
        { key: 'show_nodes', label: '显示此区块', type: 'switch' },
        { key: 'nodes_title', label: '模块标题', type: 'text' },
        { key: 'nodes_desc', label: '模块描述', type: 'text' },
        { key: 'nodes_link', label: '右上链接', type: 'text' },
        { key: 'nodes_more_text', label: '右上链接文字', type: 'text' },
        { key: 'nodes_text', label: '节点列表', type: 'rows', addLabel: '添加节点',
          hint: '经度 -180~180（东经为正），纬度 -85~85（北纬为正）。地区可留空，仅作标签展示。经纬度非数字的行前台会忽略。',
          cols: [
            { key: 'name', label: '节点名称', placeholder: '北京', required: true },
            { key: 'region', label: '地区', placeholder: '华北' },
            { key: 'lng', label: '经度', placeholder: '116.41', number: true },
            { key: 'lat', label: '纬度', placeholder: '39.90', number: true },
          ] },
      ]},
      { key: 'home-news', label: '新闻公告模块', fields: [
        { key: 'show_news', label: '显示此区块', type: 'switch' },
        { key: 'news_title', label: '模块标题', type: 'text' },
        { key: 'news_desc', label: '模块描述', type: 'text' },
        { key: 'news_link', label: '右上链接', type: 'text' },
        { key: 'news_more_text', label: '右上链接文字', type: 'text' },
      ]},
    ]},
    { key: 'sol', label: '解决方案配置', items: [
      { key: 'sol-overview', label: '方案总览页', fields: [
        { key: 'sol_page_title', label: '页面主标题', type: 'text' },
        { key: 'sol_page_desc', label: '页面描述', type: 'textarea', rows: 3 },
        { key: 'sol_hero_btn_text', label: '主视觉按钮', type: 'rows', addLabel: '添加按钮',
          hint: '每行：按钮文字|链接。拖拽排序（第 1 个为渐变主按钮），眼睛隐藏后前台不渲染。',
          cols: [
            { key: 'name', label: '按钮文字', placeholder: '按行业选择', required: true },
            { key: 'url', label: '链接', placeholder: '#industry', url: true },
          ] },
        { key: 'sol_industry_title', label: '行业区块标题', type: 'text' },
        { key: 'sol_industry_desc', label: '行业区块描述', type: 'text' },
        { key: 'sol_cards_text', label: '行业卡片列表', type: 'rows', addLabel: '添加行业卡片',
          hint: '总览页「按行业选择」的卡片；增删行即增删卡片，拖拽调整展示顺序。',
          cols: [
            { key: 'name', label: '行业名称', placeholder: '电商零售', required: true },
            { key: 'desc', label: '描述', type: 'textarea', rows: 2, placeholder: '围绕活动峰值、交易链路和数据运营规划架构。' },
            { key: 'url', label: '链接', placeholder: '/solution/ecommerce.html', url: true },
          ] },
        { key: 'sol_cta_title', label: 'CTA 标题', type: 'text' },
        { key: 'sol_cta_desc', label: 'CTA 描述', type: 'text' },
        { key: 'sol_cta_text', label: 'CTA 按钮', type: 'rows', addLabel: '添加按钮',
          hint: '每行：按钮文字|链接。拖拽排序（第 1 个为渐变主按钮），眼睛隐藏后前台不渲染。',
          cols: [
            { key: 'name', label: '按钮文字', placeholder: '查看云产品', required: true },
            { key: 'url', label: '链接', placeholder: '/cart/goodsList.htm', url: true },
          ] },
      ]},
      { key: 'sol-ecommerce', label: '行业 · 电商零售', fields: indFields('ecommerce', '电商零售') },
      { key: 'sol-finance', label: '行业 · 金融科技', fields: indFields('finance', '金融科技') },
      { key: 'sol-game', label: '行业 · 游戏娱乐', fields: indFields('game', '游戏娱乐') },
      { key: 'sol-auto', label: '行业 · 汽车出行', fields: indFields('auto', '汽车出行') },
      { key: 'sol-travel', label: '行业 · 文化旅游', fields: indFields('travel', '文化旅游') },
      { key: 'sol-education', label: '行业 · 在线教育', fields: indFields('education', '在线教育') },
      { key: 'sol-medical', label: '行业 · 智慧医疗', fields: indFields('medical', '智慧医疗') },
      { key: 'sol-agriculture', label: '行业 · 智慧农业', fields: indFields('agriculture', '智慧农业') },
    ]},
    { key: 'content', label: '内容页面', items: [
      { key: 'page-contact', label: '联系页', fields: [
        { key: 'show_contact_cards', label: '显示联系方式卡片', type: 'switch' },
        { key: 'contact_cards_text', label: '联系方式卡片', type: 'rows', addLabel: '添加卡片',
          hint: '每行：标题|描述|图标（可在弹窗中选择图标库图标）。',
          cols: [
            { key: 'name', label: '标题', placeholder: '客服热线', required: true },
            { key: 'desc', label: '描述', placeholder: '工作日 9:00-18:00 提供咨询。' },
            { key: 'icon', label: '图标', type: 'icon', placeholder: 'mdi:phone' },
          ] },
        { key: 'show_contact_service', label: '显示服务与响应', type: 'switch' },
        { key: 'contact_service_text', label: '服务与响应', type: 'rows', addLabel: '添加条目',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '响应时间', required: true },
            { key: 'desc', label: '描述', placeholder: '工作日平均 2 小时内响应。' },
          ] },
      ], hint: '联系页（/contact.html）的联系方式卡片与服务与响应模块。' },
      { key: 'page-document', label: '文档中心页', fields: [
        { key: 'show_doc_quick', label: '显示快捷入口', type: 'switch' },
        { key: 'doc_quick_text', label: '文档快捷入口', type: 'rows', addLabel: '添加入口',
          hint: '每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '新手入门', required: true },
            { key: 'desc', label: '描述', placeholder: '基础流程指引。' },
            { key: 'url', label: '链接', placeholder: '/document.html', url: true },
          ] },
        { key: 'show_doc_guide', label: '显示使用指引', type: 'switch' },
        { key: 'doc_guide_text', label: '使用指引', type: 'rows', addLabel: '添加条目',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '善用搜索', required: true },
            { key: 'desc', label: '描述', placeholder: '关键词快速定位内容。' },
          ] },
      ], hint: '文档中心页（/document.html）的快捷入口与使用指引模块。' },
      { key: 'page-news', label: '新闻资讯页', fields: [
        { key: 'show_news_nav', label: '显示内容导航', type: 'switch' },
        { key: 'news_nav_text', label: '内容导航卡片', type: 'rows', addLabel: '添加导航卡',
          hint: '每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '官方公告', required: true },
            { key: 'desc', label: '描述', placeholder: '产品动态与重要提醒。' },
            { key: 'url', label: '链接', placeholder: '/announce.html', url: true },
          ] },
        { key: 'show_news_foot', label: '显示底部说明', type: 'switch' },
        { key: 'news_foot_text', label: '底部说明', type: 'rows', addLabel: '添加条目',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '持续更新', required: true },
            { key: 'desc', label: '描述', placeholder: '欢迎定期关注。' },
          ] },
      ], hint: '新闻资讯页（/news.html）的内容导航与底部说明模块。' },
      { key: 'page-announce', label: '官方公告页', fields: [
        { key: 'show_announce_nav', label: '显示相关入口', type: 'switch' },
        { key: 'announce_nav_text', label: '相关入口卡片', type: 'rows', addLabel: '添加入口卡',
          hint: '每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '产品动态', required: true },
            { key: 'desc', label: '描述', placeholder: '新功能与产品调整。' },
            { key: 'url', label: '链接', placeholder: '/news.html', url: true },
          ] },
        { key: 'show_announce_foot', label: '显示公告说明', type: 'switch' },
        { key: 'announce_foot_text', label: '公告说明', type: 'rows', addLabel: '添加条目',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '公告效力', required: true },
            { key: 'desc', label: '描述', placeholder: '以实际发布信息为准。' },
          ] },
      ], hint: '官方公告页（/announce.html）的相关入口与公告说明模块。' },
      { key: 'page-recruit', label: '人才招聘页', fields: [
        { key: 'show_recruit_benefits', label: '显示福利与成长', type: 'switch' },
        { key: 'recruit_benefits_text', label: '福利与成长', type: 'rows', addLabel: '添加条目',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '成长空间', required: true },
            { key: 'desc', label: '描述', placeholder: '双通道发展。' },
          ] },
        { key: 'show_recruit_flow', label: '显示招聘流程', type: 'switch' },
        { key: 'recruit_flow_text', label: '招聘流程', type: 'rows', addLabel: '添加步骤',
          hint: '每行：标题|描述。按顺序渲染步骤序号。',
          cols: [
            { key: 'name', label: '标题', placeholder: '投递咨询', required: true },
            { key: 'desc', label: '描述', placeholder: '注明应聘方向。' },
          ] },
      ], hint: '人才招聘页（/recruit.html）的福利与成长、招聘流程模块。' },
      { key: 'page-feedback', label: '反馈页', fields: [
        { key: 'show_feedback_channels', label: '显示反馈渠道', type: 'switch' },
        { key: 'feedback_channels_text', label: '反馈渠道', type: 'rows', addLabel: '添加渠道',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '产品建议', required: true },
            { key: 'desc', label: '描述', placeholder: '功能与体验建议。' },
          ] },
        { key: 'show_feedback_flow', label: '显示处理流程', type: 'switch' },
        { key: 'feedback_flow_text', label: '处理流程', type: 'rows', addLabel: '添加步骤',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '提交反馈', required: true },
            { key: 'desc', label: '描述', placeholder: '选择类型并描述问题。' },
          ] },
      ], hint: '反馈页（/feedback.html）的反馈渠道与处理流程模块。' },
      { key: 'page-activity', label: '活动页', fields: [
        { key: 'show_activity_rules', label: '显示活动说明', type: 'switch' },
        { key: 'activity_rules_text', label: '活动说明', type: 'rows', addLabel: '添加条目',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '活动规则', required: true },
            { key: 'desc', label: '描述', placeholder: '以官方公告为准。' },
          ] },
      ], hint: '活动页（/activities.html）的活动说明模块。' },
      { key: 'page-detail', label: '详情类页面', fields: [
        { key: 'show_detail_rel', label: '显示相关推荐', type: 'switch' },
        { key: 'detail_rel_text', label: '相关推荐卡片', type: 'rows', addLabel: '添加卡片',
          hint: '应用于新闻详情 / 公告详情 / 文档详情 / 文档浏览页。每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '文档中心', required: true },
            { key: 'desc', label: '描述', placeholder: '产品手册与常见问题。' },
            { key: 'url', label: '链接', placeholder: '/document.html', url: true },
          ] },
        { key: 'show_page_cta', label: '显示继续了解', type: 'switch' },
        { key: 'page_cta_text', label: '继续了解卡片', type: 'rows', addLabel: '添加卡片',
          hint: '应用于全部详情类页面与新闻分类页。每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '产品与服务', required: true },
            { key: 'desc', label: '描述', placeholder: '浏览云服务器等产品。' },
            { key: 'url', label: '链接', placeholder: '/cart/goodsList.htm', url: true },
          ] },
      ], hint: '详情类页面（新闻详情 / 公告详情 / 文档详情 / 文档浏览页）的相关推荐与继续了解模块。' },
      { key: 'page-doc-result', label: '文档搜索页', fields: [
        { key: 'show_doc_result', label: '显示搜索建议', type: 'switch' },
        { key: 'doc_result_text', label: '搜索建议', type: 'rows', addLabel: '添加建议',
          hint: '每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '检查关键词', required: true },
            { key: 'desc', label: '描述', placeholder: '尝试更通用的关键词。' },
            { key: 'url', label: '链接', placeholder: '/document.html', url: true },
          ] },
      ], hint: '文档搜索页（/document-result.html）的搜索建议模块。' },
      { key: 'page-classify', label: '新闻分类页', fields: [
        { key: 'show_news_classify_nav', label: '显示内容导航', type: 'switch' },
        { key: 'news_classify_nav_text', label: '内容导航卡片', type: 'rows', addLabel: '添加导航卡',
          hint: '每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '全部新闻', required: true },
            { key: 'desc', label: '描述', placeholder: '浏览全部新闻与动态。' },
            { key: 'url', label: '链接', placeholder: '/news.html', url: true },
          ] },
      ], hint: '新闻分类页（/news-classify.html）的内容导航模块。' },
      { key: 'page-404', label: '404 页', fields: [
        { key: 'show_404_links', label: '显示常用页面', type: 'switch' },
        { key: '404_links_text', label: '常用页面卡片', type: 'rows', addLabel: '添加卡片',
          hint: '每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '返回首页', required: true },
            { key: 'desc', label: '描述', placeholder: '浏览产品与解决方案。' },
            { key: 'url', label: '链接', placeholder: '/', url: true },
          ] },
        { key: 'show_404_help', label: '显示获取帮助', type: 'switch' },
        { key: '404_help_text', label: '获取帮助', type: 'rows', addLabel: '添加条目',
          hint: '每行：标题|描述。',
          cols: [
            { key: 'name', label: '标题', placeholder: '检查地址', required: true },
            { key: 'desc', label: '描述', placeholder: '确认网址拼写。' },
          ] },
      ], hint: '404 页的常用页面与获取帮助模块。' },
      { key: 'page-about', label: '关于页', fields: [
        { key: 'show_about_honor', label: '显示资质与荣誉', type: 'switch' },
        { key: 'about_honor_text', label: '资质与荣誉', type: 'rows', addLabel: '添加荣誉',
          hint: '每行：名称|描述|图片链接。默认图片为主题占位素材，可替换为自己的图片地址。',
          cols: [
            { key: 'name', label: '名称', placeholder: '信息安全管理体系认证', required: true },
            { key: 'desc', label: '描述', placeholder: '认证说明（选填）' },
            { key: 'url', label: '图片链接', placeholder: '/web/cra1/assets/img/ref/sol-data.jpg', url: true },
          ] },
        { key: 'show_about_partner', label: '显示合作案例', type: 'switch' },
        { key: 'about_partner_text', label: '合作案例', type: 'rows', addLabel: '添加案例',
          hint: '每行：名称|描述|图片链接。图片为主题占位素材，可替换。',
          cols: [
            { key: 'name', label: '名称', placeholder: '政务云项目', required: true },
            { key: 'desc', label: '描述', placeholder: '项目场景说明（选填）' },
            { key: 'url', label: '图片链接', placeholder: '/web/cra1/assets/img/ref/prod-cloud.jpg', url: true },
          ] },
        { key: 'show_about_timeline', label: '显示发展历程', type: 'switch' },
        { key: 'about_timeline_text', label: '发展历程', type: 'rows', addLabel: '添加历程',
          hint: '每行：年份|事件。按填写顺序展示。',
          cols: [
            { key: 'name', label: '年份', placeholder: '2024', required: true },
            { key: 'desc', label: '事件', placeholder: '平台能力进一步扩展。' },
          ] },
      ], hint: '关于页（/about.html）的发展历程模块。' },
      { key: 'page-solution', label: '行业方案页', fields: [
        { key: 'show_solution_extra', label: '显示更多服务', type: 'switch' },
        { key: 'solution_extra_text', label: '更多服务卡片', type: 'rows', addLabel: '添加卡片',
          hint: '应用于全部 8 个行业方案页。每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '选购产品', required: true },
            { key: 'desc', label: '描述', placeholder: '浏览产品配置。' },
            { key: 'url', label: '链接', placeholder: '/cart/goodsList.htm', url: true },
          ] },
      ], hint: '行业方案页（/solution/*.html，8 页共用）的更多服务模块。' },
      { key: 'page-partner-cps', label: '渠道 · 推广合作页', fields: [
        { key: 'show_partner_cps_extra', label: '显示推广权益', type: 'switch' },
        { key: 'partner_cps_extra_text', label: '推广权益卡片', type: 'rows', addLabel: '添加权益',
          hint: '每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '推广素材', required: true },
            { key: 'desc', label: '描述', placeholder: '官网与产品推广素材。' },
            { key: 'url', label: '链接', placeholder: '/contact.html', url: true },
          ] },
      ], hint: '推广合作页（/partner/cps.html）的推广权益模块。' },
      { key: 'page-partner-agent', label: '渠道 · 代理伙伴页', fields: [
        { key: 'show_partner_agent_extra', label: '显示代理权益', type: 'switch' },
        { key: 'partner_agent_extra_text', label: '代理权益卡片', type: 'rows', addLabel: '添加权益',
          hint: '每行：标题|描述|链接。',
          cols: [
            { key: 'name', label: '标题', placeholder: '代理权益', required: true },
            { key: 'desc', label: '描述', placeholder: '以合作协议为准。' },
            { key: 'url', label: '链接', placeholder: '/contact.html', url: true },
          ] },
      ], hint: '代理伙伴页（/partner/agent.html）的代理权益模块。' },
    ]},
  ];

  /* 底部菜单默认栏目种子：与前台 hooks.php 的默认渲染完全一致。
     页脚设置的底部菜单为空时，编辑器预填此内容（所见即所得），
     保存后写入配置，之后以配置为准。 */
  var FOOTER_MENU_SEED = [
    '产品|||0',
    '>云服务器|/cloud.html||0',
    '>物理裸机|/dedicated.html||0',
    '>域名注册|/domain.html||0',
    '>SSL 证书|/ssl.html||0',
    '方案|||0',
    '>全部方案|/solution.html||0',
    '>电商零售|/solution/ecommerce.html||0',
    '>金融科技|/solution/finance.html||0',
    '支持|||0',
    '>文档中心|/document.html||0',
    '>官方公告|/announce.html||0',
    '>联系我们|/contact.html||0',
    '账户|||0',
    '>管理控制台|/home.htm||0',
    '>我的订单|/finance.htm||0',
    '>账户信息|/account.htm||0',
    '关于|||0',
    '>公司介绍|/about.html||0',
    '>新闻资讯|/news.html||0',
    '>服务保障|/service-guarantee.html||0',
  ].join('\n');

  /* 全量字段索引：具体 form key → { itemKey, sectionKey, label }。
     cards 类型字段（固定项分组）按「项键_字段键」展开为多个具体 key。 */
  var FIELD_INDEX = {};
  var ITEM_KEYS = {};   // 配置页 key → 该页全部具体 form key
  var FIELD_MAP = {};   // 字段定义 key → 字段定义（rows / cards 等）
  SECTIONS.forEach(function (sec) {
    sec.items.forEach(function (item) {
      var keys = [];
      item.fields.forEach(function (f) {
        FIELD_MAP[f.key] = f;
        if (f.type === 'cards') {
          f.items.forEach(function (it) {
            f.fields.forEach(function (cf) {
              var ck = it.key + '_' + cf.key;
              FIELD_INDEX[ck] = { itemKey: item.key, sectionKey: sec.key, label: f.label + ' · ' + it.label + ' · ' + cf.label };
              keys.push(ck);
            });
          });
          return;
        }
        FIELD_INDEX[f.key] = { itemKey: item.key, sectionKey: sec.key, label: f.label };
        keys.push(f.key);
      });
      ITEM_KEYS[item.key] = keys;
    });
  });

  /* ================= 登录 / 初始化页 ================= */
  var authForm = document.getElementById('authForm');
  if (authForm) {
    // 初始化模式：入口随机建议
    var randBtn = document.getElementById('entryRand');
    var entryInput = document.getElementById('entryInput');
    if (randBtn && entryInput) {
      randBtn.addEventListener('click', function () {
        var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        var out = 'mf';
        for (var i = 0; i < 10; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
        entryInput.value = out;
        entryInput.focus();
      });
    }

    authForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var errBox = document.getElementById('authErr');
      var errText = errBox.querySelector('span');
      errBox.hidden = true;
      var data = new FormData(authForm);
      var payload = {
        username: data.get('username') || '',
        password: data.get('password') || '',
        password_confirm: data.get('password_confirm') || '',
        entry: data.get('entry') || '',
        _csrf: data.get('_csrf') || '',
      };
      fetch('?r=' + authForm.dataset.mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (res) { return res.json(); }).then(function (body) {
        if (body && body.status === 200) {
          // 初始化后若入口变更，跳转到新地址的登录页
          if (body.data && body.data.url) {
            location.href = body.data.url + '?r=login';
          } else {
            location.href = location.pathname + '?r=dashboard';
          }
        } else {
          errText.textContent = (body && body.msg) || '操作失败';
          errBox.hidden = false;
        }
      }).catch(function () {
        errText.textContent = '网络错误，请稍后重试';
        errBox.hidden = false;
      });
    });
    return;
  }

  /* ================= 管理台 Alpine 组件 ================= */
  document.addEventListener('alpine:init', function () {
    Alpine.data('cra1Admin', function () {
      var app = document.getElementById('app');
      return {
        /* 状态 */
        user: (app && app.dataset.user) || '',
        baseUrl: (app && app.dataset.base) || '',
        csrf: (app && app.dataset.csrf) || '',
        sections: SECTIONS,
        active: 'overview',
        query: '',
        openSections: { site: true, home: false, sol: false },
        drawerOpen: false,
        saving: false,
        form: {},
        original: {},
        logs: [],
        leaveModal: false,
        resetModal: false,
        pendingTarget: null,
        toastShow: false,
        toastMsg: '',
        toastErr: false,
        _toastTimer: null,
        _rowCache: {},
        rowRev: 0,
        expandedList: {},   // 长列表是否展开（key → bool），超过阈值默认折叠
        _rowCacheRev: -1,
        _drag: null,
        _dragOver: -1,
        stats: [],
        modules: [],
        switchList: [],
        /* 列表项编辑弹窗（rows 字段）与固定项编辑弹窗（cards 字段） */
        rowModal: { open: false, fieldKey: '', index: -1, insertAt: -1, hidden: false, cols: [] },
        rowModalError: '',
        cardModal: { open: false, fieldKey: '', itemIndex: -1, itemKey: '', values: {} },
        cardModalError: '',
        /* 菜单树分组折叠状态（键：字段:一级名称；默认展开） */
        menuCollapsed: {},
        menuGroupOpen: function (fieldKey, title) {
            return !this.menuCollapsed[fieldKey + ':' + String(title || '')];
        },
        toggleMenuGroup: function (fieldKey, title) {
            var k = fieldKey + ':' + String(title || '');
            this.menuCollapsed[k] = !this.menuCollapsed[k];
        },

        /* 图标选择器（内置图标 / Iconify 搜索 / Icons8 手输） */
        iconPicker: {
          open: false, mode: 'iconify', query: '', prefix: 'all',
          results: [], searching: false, searchError: '',
          icons8Slug: '', manual: '',
          target: null, // { kind: 'rowModal', colIndex } 或 { kind: 'cardModal', cfKey }
        },

        /* 生命周期 */
        init: function () {
          var self = this;
          this.restoreUiState();
          this.loadConfig();

          // 关闭/刷新页面时拦截未保存修改
          window.addEventListener('beforeunload', function (e) {
            if (self.dirtyCount > 0) {
              e.preventDefault();
              e.returnValue = '';
            }
          });

          // Ctrl/Cmd + S 保存本页
          window.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 's') {
              e.preventDefault();
              if (self.active !== 'overview' && self.active !== 'security') {
                self.saveCurrent();
              }
            }
          });
        },
        /** 恢复上次浏览的配置页与分组展开状态（仅当前会话内） */
        restoreUiState: function () {
          try {
            var raw = sessionStorage.getItem('cra1AdminUi');
            if (!raw) return;
            var saved = JSON.parse(raw);
            if (saved && typeof saved.active === 'string') this.active = saved.active;
            if (saved && saved.openSections) this.openSections = saved.openSections;
          } catch (e) { /* 忽略损坏的会话状态 */ }
        },
        persistUiState: function () {
          try {
            sessionStorage.setItem('cra1AdminUi', JSON.stringify({
              active: this.active,
              openSections: this.openSections,
            }));
          } catch (e) { /* 忽略写入失败 */ }
        },

        /* 计算属性 */
        get activeItem() {
          var key = this.active;
          var found = null;
          SECTIONS.forEach(function (sec) {
            sec.items.forEach(function (item) {
              if (item.key === key) found = item;
            });
          });
          return found;
        },
        get activeLabel() {
          if (this.active === 'overview') return '概览';
          if (this.active === 'security') return '安全与后台';
          var item = this.activeItem;
          return item ? item.label : '';
        },
        get activeHint() {
          var item = this.activeItem;
          return item && item.hint ? item.hint : '';
        },
        get activeFields() {
          var item = this.activeItem;
          return item ? item.fields : [];
        },
        /** 待跳转目标的显示名（离开确认模态用） */
        get pendingTargetLabel() {
          var key = this.pendingTarget;
          if (!key) return '';
          if (key === 'overview') return '概览';
          if (key === 'security') return '安全与后台';
          var label = '';
          SECTIONS.forEach(function (sec) {
            sec.items.forEach(function (item) {
              if (item.key === key) label = item.label;
            });
          });
          return label || key;
        },
        /** 有改动的配置页集合（用于侧边栏圆点） */
        get dirtyKeys() {
          var map = {};
          var self = this;
          Object.keys(FIELD_INDEX).forEach(function (key) {
            if (self.form[key] !== self.original[key]) {
              map[FIELD_INDEX[key].itemKey] = true;
            }
          });
          return map;
        },
        get dirtyCount() {
          var n = 0;
          var self = this;
          Object.keys(FIELD_INDEX).forEach(function (key) {
            if (self.form[key] !== self.original[key]) n++;
          });
          return n;
        },
        get searchResults() {
          var q = this.query.trim().toLowerCase();
          if (!q) return [];
          var out = [];
          SECTIONS.forEach(function (sec) {
            sec.items.forEach(function (item) {
              var fieldHay = item.fields.map(function (f) {
                var hay = f.label + ' ' + f.key;
                if (f.type === 'cards') {
                  hay += ' ' + f.items.map(function (it) { return it.label; }).join(' ');
                }
                return hay;
              }).join(' ');
              var hay = (item.label + ' ' + (item.hint || '') + ' ' + fieldHay).toLowerCase();
              if (hay.indexOf(q) > -1) {
                out.push({ key: item.key, label: item.label, section: sec.label });
              }
            });
          });
          // 账号区（不在分组配置内，但应可被搜索到）
          var accountHay = ('安全与后台 密码 修改密码 后台路径 操作日志 退出登录 admin security password').toLowerCase();
          if (accountHay.indexOf(q) > -1) {
            out.push({ key: 'security', label: '安全与后台', section: '账号' });
          }
          return out;
        },

        /* 导航 */
        toggleSection: function (key) {
          this.openSections[key] = !this.openSections[key];
          this.persistUiState();
        },
        sectionDirtyCount: function (secKey) {
          var n = 0;
          var self = this;
          SECTIONS.forEach(function (sec) {
            if (sec.key !== secKey) return;
            sec.items.forEach(function (item) {
              item.fields.forEach(function (f) {
                if (self.form[f.key] !== self.original[f.key]) n++;
              });
            });
          });
          return n;
        },
        go: function (key) {
          if (key === this.active) return;
          if (this.dirtyCount > 0) {
            this.pendingTarget = key;
            this.leaveModal = true;
            return;
          }
          this.applyGo(key);
        },
        applyGo: function (key) {
          var self = this;
          this.active = key;
          this._rowCache = {}; this.rowRev++;
          this.drawerOpen = false;
          this.query = '';
          SECTIONS.forEach(function (sec) {
            sec.items.forEach(function (item) {
              if (item.key === key) self.openSections[sec.key] = true;
            });
          });
          if (key === 'security') this.loadLogs();
          this.persistUiState();
          window.scrollTo({ top: 0 });
        },
        saveThenGo: function () {
          var self = this;
          this.leaveModal = false;
          this.saveAll(true).then(function (ok) {
            if (ok && self.pendingTarget) self.applyGo(self.pendingTarget);
            self.pendingTarget = null;
          });
        },
        discardThenGo: function () {
          var target = this.pendingTarget;
          this.leaveModal = false;
          this.pendingTarget = null;
          this.form = JSON.parse(JSON.stringify(this.original));
          this._rowCache = {}; this.rowRev++;
          if (target) this.applyGo(target);
        },

        /* 数据 */
        api: function (action, payload) {
          return fetch('?r=api.' + action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf },
            body: JSON.stringify(payload || {}),
          }).then(function (res) { return res.json(); });
        },
        loadConfig: function () {
          var self = this;
          this.api('get').then(function (body) {
            if (body.status === 401 || body.status === 403) {
              if (!sessionStorage.getItem('cra1AuthRetry')) {
                sessionStorage.setItem('cra1AuthRetry', '1');
                location.replace(location.pathname + '?r=login');
              } else {
                sessionStorage.removeItem('cra1AuthRetry');
                self.toast('登录状态校验失败，请重新登录', true);
              }
              return;
            }
            sessionStorage.removeItem('cra1AuthRetry');
            if (body.status !== 200) {
              self.toast(body.msg || '读取配置失败', true);
              return;
            }
            self.form = Object.assign({}, body.data);
            self.original = JSON.parse(JSON.stringify(self.form));
            // 底部菜单为空时预填默认栏目（与前台默认渲染一致），所见即所得
            if (!String(self.form.footer_menu_text || '').trim()) {
                self.form.footer_menu_text = FOOTER_MENU_SEED;
                self.original.footer_menu_text = FOOTER_MENU_SEED;
            }
            self._rowCache = {};
            self.refreshStats();
            self.refreshSwitchList();
          }).catch(function () {
            self.toast('读取配置失败，请刷新重试', true);
          });
        },
        /* ============ 与前台一致的可见性解析 ============
           前台 hooks.php 的解析器会丢弃：行首 ! 隐藏项、首列为空项、
           链接不合法项、经纬度非数字项。这里的计数必须复刻同一规则，
           否则「后台模块状态」就会与官网实际渲染对不上。 */
        urlOk: function (v) {
          v = String(v || '').trim();
          if (v === '') return true;
          if (v.indexOf('//') === 0) return false;
          return /^(#|\/|https:\/\/|tel:|mailto:)/i.test(v);
        },
        isNumeric: function (v) {
          v = String(v || '').trim();
          return v !== '' && !isNaN(Number(v));
        },
        /** 取某行式字段的「未被隐藏」的行（解析结果与前台一致） */
        visibleRows: function (key) {
          var field = FIELD_MAP[key];
          if (!field) return [];
          return this.rowsOf(field).filter(function (r) { return !r.hidden; });
        },
        /** 两段式（名称|链接）：首列非空 + 链接合法 */
        countPairs: function (key) {
          var ok = this.urlOk;
          return this.visibleRows(key).filter(function (r) {
            return String(r.cols[0] || '').trim() !== '' && ok(r.cols[1]);
          }).length;
        },
        countSlides: function () {
          var ok = this.urlOk;
          return this.visibleRows('slides_text').filter(function (r) {
            return String(r.cols[0] || '').trim() !== '' && ok(r.cols[1]) && ok(r.cols[5]);
          }).length;
        },
        countNodes: function () {
          var num = this.isNumeric;
          return this.visibleRows('nodes_text').filter(function (r) {
            return String(r.cols[0] || '').trim() !== ''
              && num(r.cols[2]) && num(r.cols[3]);
          }).length;
        },
        /** 菜单：一级 + 二级中「名称非空且链接合法」的项（与 cra1_parse_menu 一致） */
        countMenuItems: function () {
          var ok = this.urlOk;
          var n = 0;
          this.menuGroups(FIELD_MAP.cloud_menu_text).forEach(function (g) {
            if (String(g.parent.cols[0] || '').trim() !== '' && ok(g.parent.cols[1])) n++;
            g.children.forEach(function (c) {
              if (String(c.row.cols[0] || '').trim() !== '' && ok(c.row.cols[1])) n++;
            });
          });
          return n;
        },
        countProducts: function () {
          return this.visibleRows('home_products_text').filter(function (r) {
            return parseInt(r.cols[0], 10) > 0;
          }).length;
        },
        countFloat: function () {
          var ok = this.urlOk;
          return this.visibleRows('float_items_text').filter(function (r) {
            return String(r.cols[0] || '').trim() !== '' && ok(r.cols[1]);
          }).length;
        },

        /** 概览：全后台模块开关总览（含内容页面与页脚开关） */
        refreshSwitchList: function () {
          var self = this;
          var out = [];
          this.sections.forEach(function (sec) {
            sec.items.forEach(function (item) {
              item.fields.forEach(function (f) {
                if (f.type === 'switch') {
                  out.push({
                    key: f.key,
                    label: f.label.replace(/^显示/, ''),
                    page: item.label,
                    pageKey: item.key,
                    on: String(self.form[f.key] ?? '') === '1',
                  });
                }
              });
            });
          });
          this.switchList = out;
        },
        /** 点击开关徽标跳转到对应设置页 */
        goToSwitch: function (key) {
          var hit = null;
          this.sections.forEach(function (sec) {
            sec.items.forEach(function (item) {
              if (item.fields.some(function (f) { return f.key === key; })) hit = item.key;
            });
          });
          if (hit) this.go(hit);
        },

        /** 概览统计卡 */
        refreshStats: function () {
          var hasCustom = String(this.form.custom_css || '').trim() !== '' || String(this.form.custom_js || '').trim() !== '';
          this.stats = [
            { label: '轮播图', value: this.countSlides() },
            { label: '服务节点', value: this.countNodes() },
            { label: '导航菜单项', value: this.countMenuItems() },
            { label: '自定义代码', value: hasCustom ? '已启用' : '未启用' },
          ];
          this.modules = this.buildModules();
        },
        /**
         * 前台模块实际状态：开关条件 + 数据可见性均与 index.html 的
         * 渲染条件逐一对应（含「无有效数据时整块不渲染」的模块）。
         */
        buildModules: function () {
          var f = this.form;
          var on = function (v) { return String(v) === '1'; };
          var hasText = function (v) { return String(v || '').trim() !== ''; };
          var hasCustom = hasText(f.custom_css) || hasText(f.custom_js);
          var slides = this.countSlides();
          var nodes = this.countNodes();
          var products = this.countProducts();
          return [
            { key: 'show_notice', label: '顶部信息条', show: on(f.show_notice), detail: this.countPairs('notice_bar_text') + ' 条公告（无公告时显示默认文案）', fallback: false },
            { key: 'slides', label: '首屏轮播', show: slides > 0, detail: slides + ' 张', fallback: false, alwaysOn: true },
            { key: 'show_capability', label: '轮播下双面板', show: on(f.show_capability), detail: this.countPairs('panel_links_text') + ' 个快捷链接', fallback: false },
            { key: 'show_pricing', label: '产品与价格', show: on(f.show_pricing), detail: products > 0 ? products + ' 个指定商品' : '自动按分组展示', fallback: false },
            { key: 'show_solutions', label: '解决方案模块', show: on(f.show_solutions), detail: '4 张方案卡', fallback: false },
            { key: 'show_steps', label: '快速上手步骤', show: on(f.show_steps), detail: '4 个步骤', fallback: false },
            { key: 'show_nodes', label: '全球服务节点', show: on(f.show_nodes) && nodes > 0, detail: nodes > 0 ? nodes + ' 个节点' : '无有效节点（前台不显示）', fallback: false },
            { key: 'show_news', label: '新闻公告', show: on(f.show_news), detail: '公告与新闻内容来自系统，非主题配置', fallback: false },
            { key: 'float_enable', label: '右侧悬浮导航', show: on(f.float_enable), detail: this.countFloat() + ' 个按钮 + 返回顶部', fallback: false },
            { key: 'custom', label: '自定义 CSS / JS', show: hasCustom, detail: hasCustom ? '已注入（CSS 最高优先级）' : '未配置', fallback: false },
          ];
        },
        /* ================= 行式列表编辑器（列表 + 编辑弹窗 + 拖拽排序） =================
           存储仍是「字段1|字段2|...」多行文本，行首 ! 表示该项在后台隐藏（前台不输出）。
           列表视图一行一项只展示摘要；新增/编辑通过弹窗完成，避免多输入框并排。 */

        /** 已隐藏行数（Alpine 表达式不支持匿名函数体，抽成方法） */
        hiddenCountOf: function (field) {
          var n = 0;
          this.rowsOf(field).forEach(function (r) { if (r.hidden) n++; });
          return n;
        },
        /** 列表行摘要：主标题 + 次要信息（按字段格式取最有辨识度的列） */
        rowSummary: function (field, row) {
          var c = row.cols;
          var title = '', sub = [];
          if (field.menuLike) {
            title = String(c[0] || '').trim() || '未命名菜单';
            if (c[1]) sub.push(c[1]);
            if (c[2]) sub.push(c[2]);
          } else if (field.key === 'nodes_text') {
            title = String(c[0] || '').trim() || '未命名节点';
            if (c[1]) sub.push(c[1]);
            if (String(c[2] || '') !== '' || String(c[3] || '') !== '') sub.push(c[2] + ', ' + c[3]);
          } else if (field.key === 'slides_text') {
            var img = String(c[0] || '');
            title = String(c[2] || '').trim() || (img.split('/').pop() || '未命名轮播');
            if (img) sub.push(img.length > 40 ? img.slice(0, 40) + '…' : img);
            if (c[1]) sub.push(c[1]);
            if (c[4]) sub.push('按钮：' + c[4]);
          } else if (field.key === 'home_products_text') {
            title = '商品 ID：' + (String(c[0] || '').trim() || '—');
            if (c[2]) sub.push(c[2]);
            if (String(c[1] || '') !== '') sub.push('排序 ' + c[1]);
          } else {
            title = String(c[0] || '').trim() || '未命名';
            for (var i = 1; i < c.length; i++) { if (c[i]) sub.push(c[i]); }
          }
          return { title: title, sub: sub.join(' · ') };
        },
        /** 菜单树：按「级别」列分组；返回带平铺下标的组（供操作与拖拽定位） */
        menuGroups: function (field) {
          void this.rowRev; // 依赖行版本号：行变动后重新分组
          var rows = this.rowsOf(field);
          var groups = [];
          rows.forEach(function (r, i) {
            var isSub = Number(r.cols[3] || 1) > 1;
            if (!isSub || groups.length === 0) {
              groups.push({ parent: r, pIndex: i, start: i, end: i, children: [] });
            } else {
              var g = groups[groups.length - 1];
              g.children.push({ row: r, index: i });
              g.end = i;
            }
          });
          return groups;
        },
        /** 取某字段的行数组（含隐藏标记，保持原始顺序） */
        rowsOf: function (field) {
          var key = field.key;
          // 版本号不一致时重建缓存（rowRev 只由改动了行的操作递增，
          // 这里严禁自行 rowRev++，否则每次调用都会重建，导致
          // 「rowsOf → menuGroups → 变更 → syncRows」读写到不同数组）
          var rev = this.rowRev;
          if (this._rowCacheRev !== rev) {
            this._rowCache = {};
            this._rowCacheRev = rev;
          }
          if (!this._rowCache[key]) {
            var raw = String(this.form[key] || '');
            this._rowCache[key] = raw.split('\n')
              .map(function (l) { return l.trim(); })
              .filter(function (l) { return l !== ''; })
              .map(function (line) {
                var hidden = line[0] === '!';
                if (hidden) line = line.slice(1).trim();

                // 菜单：> 前缀 → 级别列（二级）
                var menuLevel = 1;
                while (field.menuLike && line[0] === '>') {
                  menuLevel++;
                  line = line.slice(1).trim();
                }

                var parts = line.split('|').map(function (s) { return s.trim(); });
                var obj = { hidden: hidden, cols: [] };

                if (field.menuLike) {
                  obj.cols = [parts[0] || '', parts[1] || '', parts[2] || '', String(menuLevel), parts[3] === '1' ? '1' : ''];
                  if (field.key === 'cloud_menu_text') obj.cols.push(parts[4] || '', parts[5] || '');
                  obj.extra = parts.slice(field.key === 'cloud_menu_text' ? 6 : 4).join('|');
                  return obj;
                }

                // 节点有两种存储格式，需分别映射到「名称|地区|经度|纬度」四列：
                //   旧三段式：名称|经度|纬度
                //   新五段式：名称|地区|经度|纬度|是否显示
                if (key === 'nodes_text') {
                  if (parts.length >= 5) {
                    if (parts[4] === '0') obj.hidden = true;
                    obj.cols = [parts[0] || '', parts[1] || '', parts[2] || '', parts[3] || ''];
                  } else {
                    obj.cols = [parts[0] || '', '', parts[1] || '', parts[2] || ''];
                  }
                  obj.extra = '';
                  return obj;
                }

                var n = field.cols.length;
                for (var i = 0; i < n; i++) obj.cols.push(parts[i] || '');
                // 保留超出定义的额外列，避免数据丢失
                obj.extra = parts.slice(n).join('|');
                return obj;
              });
          }
          return this._rowCache[key];
        },
        /** 行数组 → 多行文本，写回 form（按字段格式做特异性转换） */
        syncRows: function (field) {
          var rows = this._rowCache[field.key] || [];
          var key = field.key;
          this.form[key] = rows.map(function (r) {
            var cols = r.cols.map(function (c) { return String(c || '').replace(/\|/g, ' ').trim(); });

            // 菜单类：级别列 → > 前缀（二级）；末列 → 新窗口 0/1
            if (field.menuLike) {
              var menuLevel = Math.max(1, Math.min(4, Number(cols[3]) || 1));
              var blank = String(cols[4] || '') === '1' ? '1' : '0';
              var mline = [cols[0] || '', cols[1] || '', cols[2] || '', blank].join('|');
              if (field.key === 'cloud_menu_text') mline += '|' + (cols[5] || '') + '|' + (cols[6] || '');
              if (r.extra) mline += '|' + r.extra;
              return (r.hidden ? '!' : '') + '>'.repeat(menuLevel - 1) + mline;
            }

            // 节点：地区为空时保持旧三段式，避免改变既有配置语义
            if (key === 'nodes_text') {
              var n = cols[0] || '', region = cols[1] || '', lng = cols[2] || '', lat = cols[3] || '';
              var nline = region === '' ? [n, lng, lat].join('|') : [n, region, lng, lat, '1'].join('|');
              return (r.hidden ? '!' : '') + nline.replace(/(\|)+$/, '');
            }

            var line = cols.join('|');
            if (r.extra) line += '|' + r.extra;
            line = line.replace(/(\|)+$/, '');
            return (r.hidden ? '!' : '') + line;
          }).join('\n');
        },
        /** 弹窗当前字段 */
        get rowField() {
          return FIELD_MAP[this.rowModal.fieldKey] || null;
        },
        /** 弹窗当前卡片字段定义 */
        get cardField() {
          return FIELD_MAP[this.cardModal.fieldKey] || null;
        },
        get cardItemLabel() {
          var f = this.cardField;
          return f && f.items[this.cardModal.itemIndex] ? f.items[this.cardModal.itemIndex].label : '';
        },
        /** 打开编辑弹窗（编辑已有项） */
        openRowEdit: function (field, index) {
          var row = this.rowsOf(field)[index];
          if (!row) return;
          this.rowModalError = '';
          this.rowModal = {
            open: true,
            fieldKey: field.key,
            index: index,
            insertAt: -1,
            hidden: row.hidden,
            cols: field.cols.map(function (c, i) { return String(row.cols[i] || ''); }),
          };
          this.$nextTick(function () {
            var el = document.querySelector('[data-row-modal] input:not([type=checkbox])');
            if (el) el.focus();
          });
        },
        /** 打开新增弹窗；field 为菜单且传 groupIndex 时，在该组下新增二级项 */
        openRowAdd: function (field, groupIndex) {
          var cols = field.cols.map(function (c) { return c.default || ''; });
          var insertAt = this.rowsOf(field).length;
          if (field.menuLike && typeof groupIndex === 'number') {
            var g = this.menuGroups(field)[groupIndex];
            if (g) {
              insertAt = g.end + 1;
              field.cols.forEach(function (c, i) { if (c.key === 'level') cols[i] = '2'; });
            }
          }
          this.rowModalError = '';
          this.rowModal = { open: true, fieldKey: field.key, index: -1, insertAt: insertAt, hidden: false, cols: cols };
          this.$nextTick(function () {
            var el = document.querySelector('[data-row-modal] input:not([type=checkbox])');
            if (el) el.focus();
          });
        },
        /** 弹窗校验：复刻前台解析器的丢弃规则，避免「前台悄悄不显示」 */
        validateRowCols: function (field, cols) {
          for (var i = 0; i < field.cols.length; i++) {
            var col = field.cols[i];
            var v = String(cols[i] || '').trim();
            if (i === 0 && col.required && v === '') {
              return '「' + col.label + '」不能为空，前台会忽略首列为空的项';
            }
            if (col.url && v !== '' && !this.urlOk(v)) {
              return '「' + col.label + '」需以 #、/、https://、tel: 或 mailto: 开头';
            }
            if (col.number && v !== '' && !this.isNumeric(v)) {
              return '「' + col.label + '」需为数字';
            }
          }
          return '';
        },
        /** 保存弹窗（新增或编辑） */
        saveRowModal: function () {
          var field = this.rowField;
          if (!field) { this.rowModal.open = false; return; }
          var cols = this.rowModal.cols.map(function (v) { return String(v || '').replace(/\|/g, ' ').trim(); });
          var err = this.validateRowCols(field, cols);
          if (err) { this.rowModalError = err; return; }
          var rows = this.rowsOf(field);
          if (this.rowModal.index >= 0) {
            var row = rows[this.rowModal.index];
            if (row) {
              row.cols = cols;
              row.hidden = this.rowModal.hidden;
            }
          } else {
            rows.splice(this.rowModal.insertAt >= 0 ? this.rowModal.insertAt : rows.length, 0,
              { hidden: this.rowModal.hidden, cols: cols, extra: '' });
          }
          this.syncRows(field);
          this.rowRev++;
          this.rowModal.open = false;
          this.toast(this.rowModal.index >= 0 ? '已保存修改' : '已添加');
        },
        /** 删除一行（菜单：删除一级项时其二级项上移为一级，避免成为前台忽略的「无上级」项） */
        removeRow: function (field, index) {
          var rows = this.rowsOf(field);
          if (field.menuLike && rows[index]
            && String(rows[index].cols[3] || '1') !== '2') {
            for (var i = index + 1; i < rows.length; i++) {
              if (String(rows[i].cols[3] || '1') !== '2') break;
              rows[i].cols[3] = '1';
            }
          }
          rows.splice(index, 1);
          this.syncRows(field);
          this.rowRev++;
        },
        /** 复制一行（含隐藏状态），插到原行之后 */
        duplicateRow: function (field, index) {
          var rows = this.rowsOf(field);
          var src = rows[index];
          if (!src) return;
          var copy = { hidden: src.hidden, cols: src.cols.slice(), extra: src.extra };
          // 名称类首列加「副本」，便于区分
          if (copy.cols.length && copy.cols[0]) copy.cols[0] = copy.cols[0] + '-副本';
          rows.splice(index + 1, 0, copy);
          this.syncRows(field);
          this.rowRev++;
          this.toast('已复制一行');
        },
        /** 上移/下移：菜单按层级语义（一级整组移动、二级在兄弟间移动） */
        moveRowUp: function (field, index) {
          if (field.menuLike) { this.moveMenuDir(field, index, -1); return; }
          this.moveRow(field, index, index - 1);
        },
        moveRowDown: function (field, index) {
          if (field.menuLike) { this.moveMenuDir(field, index, 1); return; }
          this.moveRow(field, index, index + 1);
        },
        /** 长列表阈值：超过则该列表默认折叠，避免页面过长 */
        rowCollapseThreshold: 8,
        needsCollapse: function (field) {
          return !field.menuLike && this.rowsOf(field).length > this.rowCollapseThreshold;
        },
        isListExpanded: function (field) {
          return !!this.expandedList[field.key];
        },
        toggleListExpand: function (field) {
          this.expandedList[field.key] = !this.expandedList[field.key];
        },
        /** 折叠时隐藏的行数（用于提示"还有 N 项"） */
        collapsedCount: function (field) {
          if (!this.needsCollapse(field) || this.isListExpanded(field)) return 0;
          var visible = this.rowCollapseThreshold;
          return Math.max(0, this.rowsOf(field).length - visible - 1);
        },
        /** 切换显示/隐藏 */
        toggleRow: function (field, index) {
          var rows = this.rowsOf(field);
          rows[index].hidden = !rows[index].hidden;
          this.syncRows(field);
          this.rowRev++;
        },
        /** 拖拽排序：把 from 行移动到 to 位置 */
        moveRow: function (field, from, to) {
          var rows = this.rowsOf(field);
          if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
          var moved = rows.splice(from, 1)[0];
          rows.splice(to, 0, moved);
          this.syncRows(field);
          this.rowRev++;
        },
        /** 菜单方向移动：dir -1 上移 / 1 下移 */
        moveMenuDir: function (field, index, dir) {
          var rows = this.rowsOf(field);
          var groups = this.menuGroups(field);
          var gOf = function (idx) {
            for (var i = 0; i < groups.length; i++) {
              if (idx >= groups[i].start && idx <= groups[i].end) return i;
            }
            return groups.length - 1;
          };
          var g = gOf(index);
          var isSub = index !== groups[g].pIndex;
          if (!isSub) {
            var t = g + dir;
            if (t < 0 || t >= groups.length) return;
            var len = groups[g].end - groups[g].start + 1;
            var moved = rows.splice(groups[g].start, len);
            // 向上：目标组在删除点之前，下标不变；向下：目标组整体前移 len
            var insertAt = dir < 0 ? groups[t].start : groups[t].end + 1 - len;
            rows.splice.apply(rows, [insertAt, 0].concat(moved));
            this.syncRows(field);
            this.rowRev++;
          } else {
            var to = index + dir;
            // 只能在同组兄弟间移动：目标不能越过所属一级项
            if (dir < 0 && to <= groups[g].pIndex) return;
            if (dir > 0 && to > groups[g].end) return;
            this.moveRow(field, index, to);
          }
        },
        /** 拖拽事件 */
        onRowDragStart: function (event, field, index) {
          this._drag = { key: field.key, index: index };
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
          }
        },
        onRowDragOver: function (event, field, index) {
          if (!this._drag || this._drag.key !== field.key) return;
          event.preventDefault();
          this._dragOver = index;
        },
        /**
         * 放置：普通列表按平铺位置移动；菜单按层级语义——
         * 一级项拖到一级项上 = 整组放到该组前面，拖到二级项上 = 放到该组后面；
         * 二级项拖到同组 = 兄弟间排序，拖到其他组 = 并入该组末尾（更换上级）。
         */
        onRowDrop: function (event, field, to) {
          event.preventDefault();
          var from = this._drag && this._drag.key === field.key ? this._drag.index : -1;
          this._drag = null;
          this._dragOver = -1;
          if (from < 0 || from === to) return;
          if (!field.menuLike) {
            this.moveRow(field, from, to);
            return;
          }
          var rows = this.rowsOf(field);
          var groups = this.menuGroups(field);
          var gOf = function (idx) {
            for (var i = 0; i < groups.length; i++) {
              if (idx >= groups[i].start && idx <= groups[i].end) return i;
            }
            return groups.length - 1;
          };
          var fromG = gOf(from);
          var toG = gOf(to);
          var fromIsSub = from !== groups[fromG].pIndex;
          var toIsParent = to === groups[toG].pIndex;
          if (!fromIsSub) {
            if (fromG === toG) return;
            var len = groups[fromG].end - groups[fromG].start + 1;
            var moved = rows.splice(groups[fromG].start, len);
            var insertAt;
            if (groups[fromG].start < groups[toG].start) {
              // 原组在目标组之前：删除后目标组整体前移 len
              insertAt = toIsParent ? groups[toG].start - len : groups[toG].end + 1 - len;
            } else {
              insertAt = toIsParent ? groups[toG].start : groups[toG].end + 1;
            }
            rows.splice.apply(rows, [insertAt, 0].concat(moved));
          } else {
            if (fromG === toG) {
              this.moveRow(field, from, to);
              return;
            }
            // 跨组：并入目标组末尾（二级项保持二级）
            var row = rows.splice(from, 1)[0];
            row.cols[3] = '2';
            var endIdx = groups[toG].end - (from < groups[toG].end ? 1 : 0);
            rows.splice(endIdx + 1, 0, row);
          }
          this.syncRows(field);
          this.rowRev++;
        },
        onRowDragEnd: function () {
          this._drag = null;
          this._dragOver = -1;
        },

        /* ================= 固定项分组（cards）：编辑按钮 + 弹窗 ================= */
        /** 读取某卡片项某字段的值（form key = 项键_字段键） */
        cardValue: function (field, itemIndex, fieldIndex) {
          var it = field.items[itemIndex];
          var cf = field.fields[fieldIndex];
          if (!it || !cf) return '';
          return String(this.form[it.key + '_' + cf.key] || '');
        },
        /** 卡片摘要：第 which 个非图标字段的值（0=标题，1=描述） */
        cardTextValue: function (field, itemIndex, which) {
          var seen = -1;
          for (var i = 0; i < field.fields.length; i++) {
            if (field.fields[i].type === 'icon') continue;
            seen++;
            if (seen === which) return this.cardValue(field, itemIndex, i);
          }
          return '';
        },
        /** 卡片摘要：图标字段的值（无图标字段返回 ''） */
        cardIconValue: function (field, itemIndex) {
          for (var i = 0; i < field.fields.length; i++) {
            if (field.fields[i].type === 'icon') return this.cardValue(field, itemIndex, i);
          }
          return '';
        },
        cardIconPreview: function (field, itemIndex) {
          return this.iconPreviewUrl(this.cardIconValue(field, itemIndex), 28);
        },
        openCardEdit: function (field, itemIndex) {
          var item = field.items[itemIndex];
          if (!item) return;
          var values = {};
          var self = this;
          field.fields.forEach(function (cf) {
            values[cf.key] = String(self.form[item.key + '_' + cf.key] || '');
          });
          this.cardModalError = '';
          this.cardModal = { open: true, fieldKey: field.key, itemIndex: itemIndex, itemKey: item.key, values: values };
          this.$nextTick(function () {
            var el = document.querySelector('[data-card-modal] input, [data-card-modal] textarea');
            if (el) el.focus();
          });
        },
        saveCardEdit: function () {
          var field = this.cardField;
          if (!field) { this.cardModal.open = false; return; }
          var item = field.items[this.cardModal.itemIndex];
          if (!item) { this.cardModal.open = false; return; }
          var self = this;
          field.fields.forEach(function (cf) {
            var k = item.key + '_' + cf.key;
            self.form[k] = String(self.cardModal.values[cf.key] || '').replace(/\|/g, ' ').trim();
          });
          this.cardModal.open = false;
          this.toast('已保存修改');
        },

        /* ================= 图标选择器（内置 / Iconify / Icons8） =================
           存储格式：内置键（kefu/phone/qq/wechat/link）、
           Iconify 简写（mdi:headset）、Icons8（icons8:headset）。
           前台由 hooks.php 的 cra1_icon_url() 解析并缓存到本站。 */
        ICON_BUILTINS: [
          { key: 'kefu', label: '客服', path: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z' },
          { key: 'phone', label: '电话', path: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' },
          { key: 'qq', label: 'QQ', path: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
          { key: 'wechat', label: '微信', path: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' },
          { key: 'link', label: '链接', path: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
        ],
        ICON_PREFIXES: ['all', 'mdi', 'tabler', 'ph', 'lucide', 'solar', 'fa6-solid', 'simple-icons'],
        /* Icons8 常用代码库（输入即过滤；列表外的代码也可直接使用） */
        ICON8_LIST: ['headset', 'phone', 'phone-call', 'voicemail', 'mail', 'email-open', 'chat', 'message', 'comments', 'server', 'database', 'hard-disk', 'cpu', 'memory-slot', 'network', 'wifi', 'cloud', 'cloud-upload', 'cra1-download', 'shield', 'lock', 'key', 'password', 'fingerprint', 'globe', 'earth-planet', 'map-marker', 'rocket', 'star', 'heart', 'thumb-up', 'check', 'ok', 'plus', 'minus', 'settings', 'gear', 'tools', 'wrench', 'dashboard', 'chart', 'combo-chart', 'graph', 'money', 'dollar', 'wallet', 'credit-card', 'shopping-cart', 'buy', 'tag', 'gift', 'download', 'upload', 'refresh', 'sync', 'search', 'zoom-in', 'edit', 'pencil', 'trash', 'folder', 'document', 'file', 'book', 'notebook', 'calendar', 'alarm-clock', 'timer', 'time', 'info', 'question-message', 'warning', 'error', 'bug', 'code', 'api', 'terminal', 'link', 'share', 'eye', 'bell', 'briefcase', 'building', 'home', 'idea', 'light-on', 'speedometer', 'traffic-light', 'user', 'users', 'manager', 'customer-support', 'delivery', 'truck', 'server-security', 'firewall', 'raid', 'ssl', 'domain', 'website', 'browser'],
        /** 图标预览 URL（与前台 cra1_icon_url 同规则的远程直连，用于后台预览） */
        iconPreviewUrl: function (value, size) {
          var v = String(value || '').trim();
          var s = size || 40;
          if (!v) return '';
          if (v.indexOf('icons8:') === 0 && /^[a-z0-9-]+$/i.test(v.slice(7))) {
            return 'https://img.icons8.com/fluency-systems-filled/' + s + '/' + v.slice(7) + '.png';
          }
          if (v.indexOf('iconify:') === 0) v = v.slice(8);
          if (/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/i.test(v)) {
            // 斜杠格式（mdi/headset.svg）：带冒号的路径在部分浏览器会被 ORB 拦截
            return 'https://api.iconify.design/' + v.split(':').join('/') + '.svg?height=' + s;
          }
          return '';
        },
        /** 当前列表字段里图标列的下标（无则 -1） */
        iconColIndex: function (field) {
          for (var i = 0; i < field.cols.length; i++) {
            if (field.cols[i].type === 'icon') return i;
          }
          return -1;
        },
        /** 图标选择器当前值 */
        /** Icons8：按输入过滤常用代码库（同时支持直接输入列表外的 slug） */
        get icon8Filtered() {
          var q = String(this.iconPicker.icons8Slug || '').toLowerCase().trim();
          var list = this.ICON8_LIST;
          if (!q) return list;
          return list.filter(function (slug) { return slug.indexOf(q) > -1; });
        },
        iconPickerValue: function () {
          var t = this.iconPicker.target;
          if (!t) return '';
          if (t.kind === 'rowModal') return String(this.rowModal.cols[t.colIndex] || '');
          if (t.kind === 'cardModal') return String(this.cardModal.values[t.cfKey] || '');
          if (t.kind === 'form') return String(this.form[t.key] || '');
          return '';
        },
        openIconPicker: function (target) {
          this.iconPicker.target = target;
          var value = '';
          if (target.kind === 'rowModal') value = String(this.rowModal.cols[target.colIndex] || '');
          else if (target.kind === 'cardModal') value = String(this.cardModal.values[target.cfKey] || '');
          var isBuiltin = this.ICON_BUILTINS.some(function (b) { return b.key === value; });
          this.iconPicker.mode = value.indexOf('icons8:') === 0 ? 'icons8' : (value && !isBuiltin ? 'iconify' : 'builtins');
          this.iconPicker.icons8Slug = value.indexOf('icons8:') === 0 ? value.slice(7) : '';
          this.iconPicker.manual = value;
          this.iconPicker.query = '';
          this.iconPicker.results = [];
          this.iconPicker.searchError = '';
          this.iconPicker.open = true;
        },
        applyIcon: function (value) {
          var t = this.iconPicker.target;
          if (!t) { this.iconPicker.open = false; return; }
          var v = String(value || '').trim();
          if (t.kind === 'rowModal') {
            this.rowModal.cols[t.colIndex] = v;
          } else if (t.kind === 'cardModal') {
            this.cardModal.values[t.cfKey] = v;
          } else if (t.kind === 'form') {
            this.form[t.key] = v;
          }
          this.iconPicker.open = false;
          this.toast(v ? '图标已选择：' + v : '已恢复内置图标');
        },
        searchIcons: function () {
          var self = this;
          var q = String(this.iconPicker.query || '').trim();
          if (!q) { this.iconPicker.results = []; return; }
          if (this.iconPicker.prefix !== 'all') q = this.iconPicker.prefix + ' ' + q;
          this.iconPicker.searching = true;
          this.iconPicker.searchError = '';
          fetch('https://api.iconify.design/search?query=' + encodeURIComponent(q) + '&limit=24')
            .then(function (res) { return res.json(); })
            .then(function (body) {
              self.iconPicker.results = ((body && body.icons) || []).map(function (r) {
                return { id: r, url: 'https://api.iconify.design/' + r.split(':').join('/') + '.svg?height=28' };
              });
              self.iconPicker.searching = false;
              if (!self.iconPicker.results.length) self.iconPicker.searchError = '没有匹配的图标，可换个关键词或前缀';
            })
            .catch(function () {
              self.iconPicker.searching = false;
              self.iconPicker.searchError = '搜索服务连接失败（网络受限），可在下方手动输入图标代码';
            });
        },

        /** 收集脏字段（当前页只提交该页展开后的具体 form key） */
        dirtyPayload: function (onlyCurrent) {
          var payload = {};
          var keys = onlyCurrent
            ? (ITEM_KEYS[this.active] || [])
            : Object.keys(FIELD_INDEX);
          var self = this;
          keys.forEach(function (key) {
            if (self.form[key] !== self.original[key]) {
              payload[key] = self.form[key];
            }
          });
          return payload;
        },
        /** 保存当前页 */
        saveCurrent: function () {
          var payload = this.dirtyPayload(true);
          if (!Object.keys(payload).length) {
            this.toast('当前页面没有需要保存的修改');
            return Promise.resolve(true);
          }
          return this.doSave(payload);
        },
        /** 保存全部 */
        saveAll: function (silent) {
          var payload = this.dirtyPayload(false);
          if (!Object.keys(payload).length) {
            if (!silent) this.toast('没有需要保存的修改');
            return Promise.resolve(true);
          }
          return this.doSave(payload);
        },
        doSave: function (payload) {
          var self = this;
          this.saving = true;
          return this.api('save', payload).then(function (body) {
            if (body.status === 200) {
              // 服务端返回完整 resolved 配置：以响应为准同步表单与基线
              if (body.config && typeof body.config === 'object') {
                self.form = Object.assign({}, body.config);
                // 底部菜单空态预填保持所见即所得
                if (!String(self.form.footer_menu_text || '').trim()) {
                  self.form.footer_menu_text = self.FOOTER_MENU_SEED;
                }
                self.original = JSON.parse(JSON.stringify(self.form));
              } else {
                Object.keys(payload).forEach(function (key) {
                  self.original[key] = payload[key];
                });
              }
              self._rowCache = {};
              self.refreshStats();
              self.refreshSwitchList();
              self.toast(body.msg || '保存成功，前台已生效');
              return true;
            }
            self.toast(body.msg || '保存失败', true);
            return false;
          }).catch(function () {
            self.toast('保存失败，请稍后重试', true);
            return false;
          }).then(function (ok) {
            self.saving = false;
            return ok;
          });
        },
        /** 撤销当前页修改（cards 展开后的具体 key 一并撤销） */
        revertCurrent: function () {
          var self = this;
          (ITEM_KEYS[this.active] || []).forEach(function (key) {
            self.form[key] = self.original[key];
          });
          this._rowCache = {}; this.rowRev++;
          this.toast('已撤销本页修改');
        },
        doReset: function () {
          var self = this;
          this.saving = true;
          this.api('reset').then(function (body) {
            self.resetModal = false;
            self.toast(body.msg || '已恢复默认', body.status !== 200);
            if (body.status === 200) return self.loadConfig();
          }).catch(function () {
            self.toast('操作失败，请稍后重试', true);
          }).then(function () {
            self.saving = false;
          });
        },

        /* 安全与后台 */
        savePassword: function () {
          var self = this;
          var oldPwd = document.getElementById('pwdOld').value;
          var newPwd = document.getElementById('pwdNew').value;
          var newPwd2 = document.getElementById('pwdNew2').value;
          if (!oldPwd || !newPwd) { this.toast('请填写完整', true); return; }
          if (newPwd !== newPwd2) { this.toast('两次输入的新密码不一致', true); return; }
          this.saving = true;
          this.api('password', { current_password: oldPwd, new_password: newPwd }).then(function (body) {
            self.toast(body.msg || '密码已更新', body.status !== 200);
            if (body.status === 200) {
              document.getElementById('pwdOld').value = '';
              document.getElementById('pwdNew').value = '';
              document.getElementById('pwdNew2').value = '';
            }
          }).catch(function () {
            self.toast('操作失败，请稍后重试', true);
          }).then(function () {
            self.saving = false;
          });
        },
        randomPath: function () {
          var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
          var out = 'mf';
          for (var i = 0; i < 10; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
          document.getElementById('pathInput').value = out;
        },
        changePath: function () {
          var self = this;
          var newPath = document.getElementById('pathInput').value.trim();
          if (!newPath) { this.toast('请输入新路径', true); return; }
          this.saving = true;
          this.api('path', { new_path: newPath }).then(function (body) {
            if (body.status === 200 && body.data && body.data.url) {
              self.saving = false;
              self.toast('路径已更新，正在跳转新地址…');
              setTimeout(function () { location.href = body.data.url + '?r=login'; }, 1200);
            } else {
              self.toast(body.msg || '修改失败', true);
              self.saving = false;
            }
          }).catch(function () {
            self.toast('操作失败，请稍后重试', true);
            self.saving = false;
          });
        },
        loadLogs: function () {
          var self = this;
          this.api('logs').then(function (body) {
            self.logs = (body.data && body.data.list) || [];
          }).catch(function () {
            self.logs = [];
          });
        },
        copyBase: function () {
          var input = document.getElementById('ovUrl');
          if (!input) return;
          input.select();
          try {
            document.execCommand('copy');
            this.toast('已复制');
          } catch (e) {
            this.toast('复制失败，请手动复制', true);
          }
        },
        logout: function () {
          var toLogin = function () { location.href = location.pathname + '?r=login'; };
          this.api('logout').then(toLogin).catch(toLogin);
        },

        /* 提示 */
        toast: function (msg, isErr) {
          var self = this;
          this.toastMsg = msg;
          this.toastErr = !!isErr;
          this.toastShow = true;
          clearTimeout(this._toastTimer);
          this._toastTimer = setTimeout(function () { self.toastShow = false; }, 2600);
        },
      };
    });
  });
})();
