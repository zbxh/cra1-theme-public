import { mountPage } from '../mountPage'
import ProductPage from '../pages/product'
import '../app.css'

// 自定义导航产品列表：product.htm?m=菜单ID
// 列表由菜单对应的模块后端渲染（GET /console/v1/menu/:id/host → data.content）
mountPage(() => <ProductPage mode="customnav" />)
