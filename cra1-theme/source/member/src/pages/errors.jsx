import { Button } from '../ui/button'
import { commonData } from '../lib'
import { FileQuestion, WifiOff, ShieldAlert } from 'lucide-react'

/**
 * 错误类页面（独立整页，不使用侧边栏外壳）
 * 对应 default 主题的 404 / networkErro / noPermissions
 * 统一结构：图标 + 标题 + 说明 + 主/次操作
 *
 * 视觉（硬性标准 §12.1：错误页豁免 1.5 屏，约一屏、不堆内容）：
 * 淡色大号背景码（品牌色 4% 透明度铺底）+ 图标块 + 居中操作组，
 * 与会员中心整体浅蓝渐变背景衔接。
 */
function ErrorPage({ icon: Icon, code, title, description, primary, secondary }) {
  const cfg = commonData()
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10 text-center">
      {/* 背景装饰：超大错误码 + 雾块，低透明度不抢主体（纯装饰，reduce-motion 下静止） */}
      {code && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[62%] select-none font-mono text-[220px] font-bold leading-none tracking-tighter text-brand/[0.05]"
        >
          {code}
        </span>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-brand/6 blur-3xl"
      />
      <div className="relative z-10">
        <span className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl border border-line bg-surface text-brand shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <Icon className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted">{description}</p>}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {primary}
          {secondary}
        </div>
        {cfg.website_name && <p className="mt-12 text-xs text-muted">© {new Date().getFullYear()} {cfg.website_name}</p>}
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <ErrorPage
      icon={FileQuestion}
      code="404"
      title="页面不存在"
      description="你访问的页面可能已被移除、重命名，或暂时不可用。"
      primary={<Button onClick={() => { window.location.href = '/home.htm' }}>返回控制台</Button>}
      secondary={<Button variant="outline" onClick={() => history.back()}>返回上一页</Button>}
    />
  )
}

export function NetworkErrorPage() {
  return (
    <ErrorPage
      icon={WifiOff}
      code="ERR"
      title="网络连接异常"
      description="页面错误，请刷新重试"
      secondary={<Button variant="outline" onClick={() => { window.location.href = '/home.htm' }}>返回控制台</Button>}
    />
  )
}

export function NoPermissionPage() {
  return (
    <ErrorPage
      icon={ShieldAlert}
      code="403"
      title="无访问权限"
      description="当前账户没有访问该页面的权限。若你是子账户，请联系主账户管理员分配权限。"
      primary={<Button onClick={() => { window.location.href = '/home.htm' }}>返回控制台</Button>}
    />
  )
}
