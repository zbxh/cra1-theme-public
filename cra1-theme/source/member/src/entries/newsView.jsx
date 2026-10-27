import { mountPage } from '../mountPage'
import NewsViewPage from '../pages/newsView'
import '../app.css'

// 公告 / 新闻 / 帮助内容页：newsView.htm[?id=]
// 无 id 时读 sessionStorage.viewNewObjData（后台预览），有 id 时走接口
mountPage(NewsViewPage)
