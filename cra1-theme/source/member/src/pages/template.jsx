import { useState, useEffect } from 'react'
import { Palette, CheckCircle2, XCircle, Info, LayoutDashboard } from 'lucide-react'
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Badge, Alert } from '../ui/feedback'
import { commonData } from '../lib'

/**
 * 主题信息（template.htm）
 *
 * 系统里 template.htm 只在后台上导航存在（idcsmart_nav.type = 'admin'），
 * 前台会员中心没有任何菜单指向它；官方 default 主题的 template.php 也是一个
 * 只显示「模板页面」四个字的占位。
 *
 * 与其保留空白，这里做成主题自检页：渲染当前主题的关键运行时信息，
 * 便于排查「页面样式不对 / 组件没加载」这类问题时有据可查。
 */
export default function TemplatePage() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const c = commonData() || {}
    setInfo({
      website: c.website_name || '—',
      logo: c.system_logo || '',
      lang: localStorage.getItem('lang') || document.documentElement.lang || 'zh-cn',
      theme: document.documentElement.getAttribute('theme') || 'default',
      rootFontSize: window.getComputedStyle(document.documentElement).fontSize,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      shellReady: !!window.__CRA1_SHELL_READY__,
      jquery: typeof window.jQuery !== 'undefined',
      vue: typeof window.Vue !== 'undefined',
      element: typeof window.ELEMENT !== 'undefined' || !!window.Vue?.prototype?.$message,
      react: !!document.getElementById('cra1-content-slot')?.children.length,
    })
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader title="主题信息" description="当前会员中心主题的运行时环境与依赖状态" />

      <Alert tone="info">
        本页不在前台菜单中，仅供排查显示问题时查看。若下方任一依赖显示未加载，页面可能出现样式错乱或交互失效。
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4 text-brand" aria-hidden="true" />主题与品牌
            </CardTitle>
            <CardDescription>来自系统设置的展示信息</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Row label="网站名称" value={info?.website} />
              <Row label="界面语言" value={info?.lang} mono />
              <Row label="配色方案" value={info?.theme} mono />
              <Row label="Logo" value={info?.logo ? '已配置' : '未配置（使用文字标识）'} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="size-4 text-brand" aria-hidden="true" />渲染环境
            </CardTitle>
            <CardDescription>用于判断 rem 基准与布局是否正常</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Row label="视口尺寸" value={info?.viewport} mono />
              <Row label="根字号" value={info?.rootFontSize} mono />
              <Row label="像素比" value={info?.dpr} mono />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>依赖状态</CardTitle>
          <CardDescription>外壳（Vue）与内容区（React）各自依赖的运行时</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-line">
            <Dep label="Vue 运行时" ok={info?.vue} note="侧边栏与顶栏组件依赖" />
            <Dep label="ElementUI" ok={info?.element} note="模块内页（产品详情等）的第三方模板依赖" />
            <Dep label="jQuery" ok={info?.jquery} note="验证码弹窗与部分模块脚本依赖，按需加载" />
            <Dep label="外壳就绪标志" ok={info?.shellReady} note="未就绪时内容区会一直显示骨架屏" />
            <Dep label="内容区已渲染" ok={info?.react} note="React 是否已挂载到 #cra1-content-slot" />
          </ul>
        </CardContent>
      </Card>

      <Alert tone="warning">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Info className="size-3.5" aria-hidden="true" />根字号说明
        </span>
        <span className="mt-1 block">
          js/common/common.js 会把 html 的 font-size 设为 视口宽度 / 19.2，
          桌面端约 75px。第三方模块模板沿用 ElementUI 的 rem 布局，因此在本主题下
          会比官方主题偏大，已由 cra1-shell.css 的 .cra1-module-view 作用域收敛。
        </span>
      </Alert>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-[13px] text-ink ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </dd>
    </div>
  )
}

function Dep({ label, ok, note }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={
        'flex size-7 shrink-0 items-center justify-center rounded-lg ' +
        (ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')
      }>
        {ok
          ? <CheckCircle2 className="size-4" aria-hidden="true" />
          : <XCircle className="size-4" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      </div>
      <Badge tone={ok ? 'success' : 'danger'}>{ok ? '正常' : '未加载'}</Badge>
    </li>
  )
}
