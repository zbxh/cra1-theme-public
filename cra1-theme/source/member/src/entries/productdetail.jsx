import { mountPage } from '../mountPage'
import ProductPage from '../pages/product'
import '../app.css'

// 产品内页：productdetail.htm?id=产品ID
// 实例管理界面由模块提供（GET /console/v1/host/:id/view → data.content）
mountPage(() => <ProductPage mode="detail" />)
