import { mountPage } from '../mountPage'
import SecurityPage from '../pages/security'
import '../app.css'

// 安全中心 · 默认打开「安全概览」（官方主题 activeName=1）
mountPage(() => <SecurityPage defaultTab="overview" />)
