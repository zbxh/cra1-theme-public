import { useState, useEffect } from 'react'
import {
  ShoppingCart, ExternalLink, AlertTriangle, ShieldCheck, Package,
} from 'lucide-react'
import { PageHeader, Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Alert, EmptyState, Skeleton } from '../ui/feedback'
import { get } from '../lib'

/**
 * 商品订购承载页（product_list.htm?id=商品ID）
 *
 * 这个页面本身没有内容：它把「上游商品订购系统」的页面嵌在 iframe 里。
 * 官方实现（default/js/product_list.js）做三件事：
 *   1. GET /console/v1/baidu_cloud/list?id=  取上游订购页地址
 *   2. GET /console/v1/baidu_cloud/token     取单点登录 token
 *   3. 拼成 {上游地址}/login/securitytoken?redirectUrl=..&signinSecurityToken=..
 *
 * ⚠️ 这里是系统级边界：/baidu_cloud/* 这组接口由外部对接方植入，
 *    当前环境并未安装（请求会落到路由兜底，返回整页 HTML 而不是 JSON）。
 *    上游地址与 SSO 参数格式也都由对方定义，无法在本主题内实现。
 *
 * 所以本页的职责是：能取到地址就正常嵌入；取不到就明确说明原因，
 * 并给出替代入口，而不是显示一个空白 iframe 或一直转圈。
 *
 * 侧边栏「订购产品」菜单指向的是 cart/goodsList.htm（购物车/商品列表），
 * 不是本页；本页只在直接访问 product_list.htm?id= 时出现。
 */
export default function ProductListFramePage() {
  const id = new URLSearchParams(location.search).get('id') || ''
  const [frameUrl, setFrameUrl] = useState('')
  const [state, setState] = useState('loading')   // loading | ready | unavailable
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!id) { setState('unavailable'); setReason('请选择需要订购的商品。'); return }

    let alive = true
    // 两个请求都可能在接口缺失时返回 HTML，lib 的 api() 会因 JSON 解析失败抛错，
    // 正好用来说明「对接未安装」。
    Promise.all([
      get('/baidu_cloud/list', { id }),
      get('/baidu_cloud/token'),
    ])
      .then(([listRes, tokenRes]) => {
        if (!alive) return
        const url = listRes.data?.url
        const token = tokenRes.data?.token
        if (!url || !token) {
          setState('unavailable')
          setReason('页面错误，请刷新重试')
          return
        }
        // 只允许 https，避免 token 在明文连接上泄露
        const base = String(url).replace(/\/+$/, '')
        if (!/^https:\/\//i.test(base)) {
          setState('unavailable')
          setReason('暂时无法安全打开此商品，请联系工作人员。')
          return
        }
        setFrameUrl(
          `${base}/login/securitytoken?redirectUrl=${encodeURIComponent(url)}` +
          `&signinSecurityToken=${encodeURIComponent(token)}`
        )
        setState('ready')
      })
      .catch(() => {
        if (!alive) return
        setState('unavailable')
        setReason('页面错误，请刷新重试')
      })
    return () => { alive = false }
  }, [id])

  return (
    <div className="space-y-4">
      <PageHeader
        title="商品订购"
        description="选择商品并完成配置"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { window.location.href = '/cart/goodsList.htm' }}>
              <Package className="size-3.5" />浏览本站商品
            </Button>
            {state === 'ready' && (
              <>
                <Button size="sm" onClick={() => window.open(frameUrl, '_blank', 'noopener')}>
                  <ExternalLink className="size-3.5" />新窗口打开
                </Button>
              </>
            )}
          </div>
        }
      />

      {state === 'loading' && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-[420px] w-full" />
          </CardContent>
        </Card>
      )}

      {state === 'unavailable' && (
        <>
          <Alert tone="warning">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-3.5" aria-hidden="true" />{reason}
            </span>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>继续选购商品</CardTitle>
              <CardDescription>也可以从商品列表选择，或管理已购买的产品</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-3 text-[13px] leading-6 text-muted-foreground">
                <li className="flex gap-3">
                  <ShoppingCart className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>
                    请从商品列表选择需要的产品，再完成配置与订购。
                  </span>
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>
                    若当前商品持续无法打开，请联系工作人员协助处理。
                  </span>
                </li>
                <li className="flex gap-3">
                  <Package className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>
                    如需在本站直接购买，请从
                    <a href="/cart/goodsList.htm" className="mx-1 text-brand hover:underline">商品列表</a>
                    选择产品下单；已购买的产品可在
                    <a href="/productList.htm" className="mx-1 text-brand hover:underline">我的产品</a>
                    中管理。
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {state === 'ready' && (
        <Card>
          <CardContent className="p-0">
            <iframe
              src={frameUrl}
              title="商品配置"
              className="block h-[70vh] min-h-[520px] w-full rounded-xl border-0"
              // 上游是独立系统，给最小必要权限
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
