import { mountPage } from '../mountPage'
import ProductListPage from '../pages/productList'
import '../app.css'

// 我的产品总览：GET /console/v1/host?tab=using|expiring|overdue|deleted
mountPage(ProductListPage)
