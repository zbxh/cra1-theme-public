import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { get } from '../lib'
import { sharedReady } from '../shared'
import { Card, CardContent } from './card'
import { Button } from './button'
import { Alert, Skeleton } from './feedback'
import { mountModuleScripts } from './module-scripts'

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
        if (alive) setError(window.CRA1Shared?.Errors?.message(e) || '页面暂时无法加载，请稍后重试')
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

    // The common module normally preloads its password in the detail payload.
    // Keep the upstream template intact and adapt just this row in our host.
    const commonScript = host.querySelector('script[src*="idcsmart_common/template/clientarea/"][src$="/js/common_product_detail.js"]')
    const hostId = /^\/host\/(\d+)\/view$/.exec(url)?.[1]
    const credentialController = new AbortController()
    if (commonScript && hostId) {
      const row = Array.from(host.querySelectorAll('.common_product_detail .item')).find(item => item.getAttribute('v-if') === 'host.password')
      if (row) {
        row.removeAttribute('v-if')
        const label = document.createElement('span'), button = document.createElement('button')
        label.className = 'label'; label.textContent = '登录信息：'
        button.type = 'button'; button.className = 'cui-button cui-button--outline'; button.textContent = '查看登录信息'
        button.setAttribute('data-cra1-read-credentials', '')
        row.replaceChildren(label, button)
      }
    }
    const readCredentials = async event => {
      const button = event.target.closest('[data-cra1-read-credentials]')
      if (!button || button.disabled) return
      button.disabled = true
      try {
        const shared = await sharedReady()
        const module = commonScript?.getAttribute('src').includes('/reserver/') ? 'reidcsmart_common' : 'idcsmart_common'
        await shared.Security.viewCredentials(`/${module}/host/${hostId}/configoption`, { credentials_only: 1 }, { signal: credentialController.signal })
      } catch (error) {
        if (!credentialController.signal.aborted && !error.code?.startsWith('SECURITY_')) (await sharedReady()).UI.toast(error.message || '登录信息读取失败，请重试', 'error')
      } finally { button.disabled = false }
    }
    host.addEventListener('click', readCredentials)

    const scriptController=new AbortController()
    let reapTimer, disposed=false
    function dispose() {
      if(disposed)return
      disposed=true;clearTimeout(reapTimer);scriptController.abort();credentialController.abort();host.removeEventListener('click',readCredentials)
      const instances=new Set([host,...host.querySelectorAll('*')].map(el=>el.__vue__).filter(Boolean))
      instances.forEach(vm=>{if(!vm._isDestroyed)vm.$destroy()})
    }
    mountModuleScripts(host,{signal:scriptController.signal,enabled:src=>!(src.split('?')[0]==='/plugins/addon/flow_packet/template/clientarea/flowPacketUsage.js' && window.__CRA1_RUNTIME__?.features?.flow_packet!==true)})
      .then(()=>{if(!scriptController.signal.aborted)onLoaded?.(host)})
      .catch(()=>{if(!scriptController.signal.aborted){dispose();setError('模块所需资源未能加载。请重试，或联系管理员检查模块及网络。')}})

    // 原生模块接口失败时可能一直保留 loading；明确显示故障与重试入口。
    reapTimer = setTimeout(() => {
      if([...host.querySelectorAll('.pro-des-loading')].some(el=>el.getBoundingClientRect().height>0)){dispose();setError('模块仍未完成加载。请重试，或联系管理员检查产品连接。')}
    }, 12000)

    return dispose

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
    return empty || <Alert tone="info">暂无可显示的内容。</Alert>
  }

  return (
    <div className="cra1-module-view" data-module-title={title || ''}>
      {description && <p className="mb-3 text-[13px] text-muted-foreground">{description}</p>}
      <div ref={hostRef} />
    </div>
  )
}
