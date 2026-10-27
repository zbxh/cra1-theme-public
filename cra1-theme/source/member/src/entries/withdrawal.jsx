import { mountPage } from '../mountPage'
import WithdrawalPage from '../pages/withdrawal'
import '../app.css'

// 真实页面：外壳（侧栏+顶栏）由 Vue 提供，内容由 React 渲染
mountPage(WithdrawalPage)
