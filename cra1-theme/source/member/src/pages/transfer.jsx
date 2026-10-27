import { useState, useEffect } from 'react'
import { ExternalLink, ShieldAlert, ArrowLeft, Link2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Alert, EmptyState } from '../ui/feedback'
import { commonData } from '../lib'

/**
 * 外链跳转确认页（transfer.htm?target=URL）
 *
 * 侧边栏遇到「外部链接」类型菜单时，若该菜单开启了二次提醒
 * （second_reminder === 1），会先跳到本页确认，而不是直接打开目标站点。
 * 见 cloud/components/asideMenu/asideMenu.js 的 navigate()。
 *
 * 安全要求：target 来自 URL，属于用户可控输入。
 *   - 只允许 http/https，杜绝 javascript: / data: 伪协议
 *   - 展示完整目标地址，让用户在跳转前能核对域名
 */
export default function TransferPage() {
  const target = new URLSearchParams(location.search).get('target') || ''
  const [siteName, setSiteName] = useState('')

  useEffect(() => {
    const c = commonData()
    setSiteName(c?.website_name || '')
    document.title = `即将离开${c?.website_name ? ' ' + c.website_name : ''}`
  }, [])

  const decoded = safeDecode(target)
  const safe = isSafeUrl(decoded)

  if (!target) {
    return (
      <Wrapper>
        <EmptyState
          icon={Link2}
          title="缺少跳转地址"
          description="本页用于确认跳转到外部站点，请从侧边栏的外部链接进入。"
          action={<Button size="sm" onClick={() => { window.location.href = '/home.htm' }}>返回首页</Button>}
        />
      </Wrapper>
    )
  }

  if (!safe) {
    return (
      <Wrapper>
        <Alert tone="error">
          <span className="font-medium">该链接不可访问。</span>
          目标地址不是合法的 http/https 链接，已被拦截。
          <code className="mt-2 block break-all font-mono text-[11px]">{decoded || target}</code>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="size-3.5" />返回
          </Button>
        </div>
      </Wrapper>
    )
  }

  let host = ''
  try { host = new URL(decoded).host } catch { host = '' }

  return (
    <Wrapper>
      <Card>
        <CardHeader>
          <CardTitle className="text-[18px]">即将离开{siteName || '本站'}</CardTitle>
          <CardDescription>你正在访问外部站点，请确认目标地址无误</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-line bg-muted-bg p-4">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/8 text-brand">
              <ShieldAlert className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">外部链接不受本站控制</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                请勿在目标站点输入账号、密码或支付信息，除非你确认该站点可信。
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">目标地址</p>
            <code className="block break-all rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-xs leading-5 text-ink">
              {decoded}
            </code>
            {host && <p className="mt-2 text-xs text-muted-foreground">域名：<span className="font-medium text-ink">{host}</span></p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => { window.location.href = decoded }}>
              <ExternalLink className="size-3.5" />继续访问
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="size-3.5" />留在本站
            </Button>
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  )
}

function Wrapper({ children }) {
  return <div className="mx-auto w-full max-w-[600px] py-10">{children}</div>
}

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch { return v }
}

function isSafeUrl(url) {
  if (!url) return false
  try {
    const u = new URL(url, location.origin)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
