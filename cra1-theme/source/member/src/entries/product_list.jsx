import { mountPage } from '../mountPage'
import ProductListFramePage from '../pages/productFrame'
import '../app.css'

// 商品订购承载页：product_list.htm?id=商品ID
// 内容来自上游订购系统的 iframe；接口未安装时给出降级说明
mountPage(ProductListFramePage)
