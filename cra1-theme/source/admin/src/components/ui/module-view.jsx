import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { get } from '../lib'
import { Card, CardContent } from './card'
import { Button } from './button'
import { Alert, Skeleton } from './feedback'

/**
 * 模块内页容器
 *
 * 系统里有一部分页面（产品内页 / 自定义导航产品列表 / 商品配置页）的内容
 * 是由第三方模块（mf_cloud、mf_dcim、idcsmart_common…）后端渲染好 HTML 再
 * 交给前端注入的。这些 HTML 自带 <script> 和 <link>，依赖全局 Vue、ElementUI、
 * jQuery 与模块自己的 JS，属于「不可重写的第三方边界」。
 *
 * 本组件的职责只有两件事：
 *   1. 把模块 HTML 注入到受控容器里，并保证其中的 <script> 真的执行
 *      （innerHTML 不会执行脚本，必须手工重建 script 节点）；
 *   2. 用 shadcn 的外层卡片包裹，让第三方内容落在统一的内容区里。
 *
 * 注意：模块模板内部仍使用 ElementUI 的 rem 布局，在 CRA1 主题的 rem 基准
 * （html font-size = clientWidth/19.2）下会比 default 主题偏大。样式收敛由
 * cra1-shell.css 的 .cra1-module-view 作用域规则负责。
 */
export function ModuleView({ url, params, title, description, empty, onLoaded, deps = 'list' }) {
  const hostRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [html, setHtml] = useState('')

  // params 是对象，直接进依赖会每次渲染都触发请求；用序列化值做依赖
  const paramsKey = JSON.stringify(params || {})

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    setHtml('')
    // 模块模板的 JS 会以裸标识符引用主题组件（pagination / payDialog…），
    // 必须先确保这些全局绑定就绪，否则 Vue 挂载会抛 "xxx is not defined"，
    // 页面上会残留未编译的 {{lang.xxx}}。
    const ready = window.CRA1ModuleDeps ? window.CRA1ModuleDeps.ensure(deps) : Promise.resolve()
    // 只请求模块渲染接口本身：即使模块的状态/实例接口不可用（产品状态会显示
    // 为故障），只要 /host/:id/view 能返回 HTML，实例管理界面就必须正常渲染。
    Promise.all([ready, get(url, JSON.parse(paramsKey))])
      .then(([, res]) => {
        if (!alive) return
        const content = res.data?.content
        if (!content) {
          setHtml('')
          return
        }
        setHtml(content)
      })
      .catch((e) => {
        if (alive) setError(e.message || '页面错误，请刷新重试')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => { alive = false }
  }, [url, paramsKey, deps])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !html) return

    host.innerHTML = html

    // innerHTML 插入的 <script> 不会执行，需要重建节点。
    // 同时屏蔽模块模板里可能带的 CDN 外链，避免引入站外资源。
    const scripts = Array.from(host.querySelectorAll('script'))
    scripts.forEach((old) => {
      const src = old.getAttribute('src') || ''
      if (src && !src.startsWith('/')) {
        old.remove()
        return
      }
      const next = document.createElement('script')
      Array.from(old.attributes).forEach((a) => next.setAttribute(a.name, a.value))
      // 动态插入的 script 默认 async，会打乱模块依赖顺序（api → lang → 业务脚本）
      next.async = false
      next.text = old.text
      old.parentNode.replaceChild(next, old)
    })

    if (onLoaded) onLoaded(host)

    // 模块模板自带一个 v-if="initLoading" 的全屏 loading 遮罩（.pro-des-loading，
    // position:fixed 白底盖住内容区右侧）。它要靠模块自己的 XHR 成功返回后才置
    // initLoading=false —— 但模块接口连不上（如实例无 host_link 行时
    // /mf_cloud/:id 返回 500）时 Promise 直接 reject，initLoading 永远不会
    // 关闭，页面看起来就是「实例管理界面空白」。这里注入一条兜底规则：
    // 遮罩超过 3 秒仍未消失就淡出移除，实例信息以模块已渲染的部分为准，
    // 状态表现为故障。只对本次注入生效，不污染全局样式。
    const guard = document.createElement('style')
    guard.textContent = `
      .cra1-module-view .pro-des-loading { animation: cra1-module-loading-reap 3s forwards; }
      @keyframes cra1-module-loading-reap { to { opacity: 0; visibility: hidden; } }
    `
    host.appendChild(guard)
    const reapTimer = setTimeout(() => {
      host.querySelectorAll('.pro-des-loading').forEach((el) => el.remove())
    }, 3400)

    // onLoaded 由调用方每次渲染新建，纳入依赖会导致重复注入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-4 p-5">
          <Alert tone="warning">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-3.5" aria-hidden="true" />页面错误，请刷新重试
            </span>
          </Alert>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => { window.location.href = '/productList.htm' }}>
              <ArrowLeft className="size-3.5" />返回产品列表
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!html) {
    return empty || <Alert tone="info">该模块暂无可显示的内容。</Alert>
  }

  return (
    <div className="cra1-module-view" data-module-title={title || ''}>
      {description && <p className="mb-3 text-[13px] text-muted-foreground">{description}</p>}
      <div ref={hostRef} />
    </div>
  )
}
