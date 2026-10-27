import {AccessProvider} from '../ui/access'
import { mountPage, mountStandalonePage } from '../mountPage'
import HomePage from '../pages/home'
import '../app.css'

// 会员中心首页 /home.htm
// 外层由 public/home/template/pc/cra1/home.php 提供（会员中心外壳 + 内容槽），
// 内容区走 /console/v1/index、/index/host、/ticket、/news/index
if(document.getElementById('root') && !document.getElementById('cra1-content-slot'))mountStandalonePage(()=> <AccessProvider><HomePage/></AccessProvider>);else mountPage(HomePage)
