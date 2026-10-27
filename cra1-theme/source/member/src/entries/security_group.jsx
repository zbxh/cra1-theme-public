import { mountPage } from '../mountPage'
import SecurityPage from '../pages/security'
import '../app.css'

// 安全中心 · 默认打开「安全组」（官方主题 activeName=4）
mountPage(() => <SecurityPage defaultTab="group" />)
