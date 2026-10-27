import { mountPage } from '../mountPage'
import SecurityPage from '../pages/security'
import '../app.css'

// 安全中心 · 默认打开「SSH 密钥」（官方主题 activeName=2）
mountPage(() => <SecurityPage defaultTab="ssh" />)
