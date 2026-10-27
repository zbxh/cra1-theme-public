import { mountPage } from '../mountPage'
import AgreementPage from '../pages/agreement'
import '../app.css'

// 协议 / 帮助文档详情：agreement.htm?id=文档ID
// 数据源与帮助中心共用（GET /console/v1/help/:id）
mountPage(AgreementPage)
