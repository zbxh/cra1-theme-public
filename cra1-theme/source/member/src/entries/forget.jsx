import { mountStandalonePage } from '../mountPage'
import ForgetPage from '../pages/forget'
import '../app.css'

// 独立页与其他会员页共用公告和挂载生命周期。
mountStandalonePage(ForgetPage, { noticesInLayout: true })
