import { mountPage } from '../mountPage'
import { GroupRulesPage } from '../pages/securityGroup'
import '../app.css'

// 安全组规则：group_rules.htm?id=安全组ID
// 这是独立页面（不是安全中心的标签），从安全组列表点名称进入
mountPage(GroupRulesPage)
