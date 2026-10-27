"""Business labels for the positions consumed by the website templates."""
LABELS = {
    'solutions': {'txt1': '解决方案区块说明'},
    'news': {'txt1': '资讯与文档区块说明'},
    'pricing': {'txt2': '产品列表空态补充说明'},
    'nodes': {'txt1': '地图替代文字'},
    'about_company': {'txt1': '企业联系信息说明'},
    'method': {f'txt{i}': label for i, label in enumerate(['业务梳理说明', '资源需求说明', '产品组合说明', '上线验证说明'], 1)},
    'process': {f'txt{i}': label for i, label in enumerate(['落地流程介绍', '需求确认说明', '方案设计说明', '订单确认说明', '部署联调说明', '持续优化说明'], 1)},
    'core_results': {'txt1': '未找到文档提示', 'txt2': '文档搜索框提示'},
    'core_listing': {
        'document_search_hint': '文档搜索框提示', 'news_read_more': '新闻阅读全文按钮文字',
        'document_empty': '暂无文档提示', 'news_empty': '暂无新闻提示', 'announce_empty': '暂无公告提示',
        'txt2': '暂无分类新闻提示', 'txt3': '分类新闻分页说明', 'txt6': '上一页按钮文字', 'txt7': '下一页按钮文字',
    },
    'core_activities': {f'txt{i}': label for i, label in enumerate(['产品优惠说明', '会员专属活动说明', '服务调整说明', '活动咨询说明'], 1)},
    'cta_activities': {'txt1': '活动咨询说明'},
    'cta_guarantee': {'txt1': '服务咨询说明'},
    'document_band': {'txt1': '文档中心按钮文字'},
    'support_cards': {f'txt{i}': label for i, label in enumerate(['运维支持说明', '问题反馈说明', '安全与备份说明', '方案咨询说明'], 1)},
    'core_article': {
        'txt1': '返回公告列表按钮文字', 'txt2': '公告不存在提示',
        'txt3': '文档页返回按钮文字', 'txt4': '文档不存在提示',
        'txt5': '文档异常时返回按钮文字', 'txt6': '文档异常补充说明',
        'txt7': '返回新闻列表按钮文字', 'txt8': '新闻不存在提示',
        'txt9': '上一篇按钮文字', 'txt10': '下一篇按钮文字', 'txt11': '附件区标题',
    },
    'scenarios': {'txt1': '业务增长与资源调整说明'},
    'overview': {
        f'txt{i}': name + '产品介绍' for i, name in enumerate([
            '物理裸机', '域名注册', '域名注册服务', '域名商店', 'ICP 备案', '模型服务',
            '服务器租用', '短信服务', 'SSL 证书', '商标注册', '服务器托管'], 1)
    },
}
