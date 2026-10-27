import { mountPage } from '../mountPage'
import SecurityPage from '../pages/security'
import '../app.css'

// 安全中心 · 默认打开「操作日志」（官方主题 activeName=3）
mountPage(() => <SecurityPage defaultTab="log" />)
