import { mountPage } from '../mountPage'
import CrossModulePage from '../pages/crossModule'
import '../app.css'

// 跨模块产品列表：crossModule.htm?m=菜单ID
// 数据来自系统接口 GET /console/v1/home/host（结构化 JSON，非模块 HTML）
mountPage(CrossModulePage)
