import { mountStandalonePage } from '../mountPage'
import LoginForm from '../components/LoginForm'
import '../app.css'

// 独立页与其他会员页共用公告和挂载生命周期。
mountStandalonePage(() => <LoginForm config={window.__CRA1_PAGE__ || {}} />, { noticesInLayout: true })
