import { useState, useEffect } from 'react'
import { FileText, ExternalLink, ArrowLeft, Calendar, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge, Alert, EmptyState, Skeleton } from '../ui/feedback'
import { get, formatDateTime } from '../lib'

/**
 * 协议 / 帮助文档详情（agreement.htm?id=）
 *
 * 系统里 agreement.htm 与帮助中心的文章详情共用一个数据源：
 *   GET /console/v1/help/:id          （插件 idcsmart_help 提供）
 *   返回 data.help.{id,title,content,keywords,attachment[],create_time,update_time,prev,next}
 *
 * 这个页面在官方主题里属于「免登录」页面（request.js 的 noNeedJwtUrlArr 里有
 * agreement.htm），但当前主题把它挂在外壳里以便阅读时仍能导航。
 *
 * 注意：这个接口是公开的，未登录也能调用，所以即使在登录态失效时页面也应能
 * 正常展示内容；错误处理只针对 id 缺失与文档不存在两种情况。
 */
export default function AgreementPage() {
  const id = new URLSearchParams(location.search).get('id') || ''
  const [docs, setDocs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    setError('')
    get(`/help/${id}`)
      .then((res) => setDocs(res.data?.help || null))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (!id) {
    return (
      <EmptyWrapper>
        <EmptyState
          icon={FileText}
          title="缺少文档参数"
          description="请从页脚的服务条款或隐私政策入口打开文档。"
          action={<Button size="sm" onClick={() => { window.location.href = '/' }}>返回首页</Button>}
        />
      </EmptyWrapper>
    )
  }

  if (loading) {
    return (
      <EmptyWrapper>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </EmptyWrapper>
    )
  }

  if (error) {
    return <EmptyWrapper><Alert tone="error">文档加载失败：{error}</Alert></EmptyWrapper>
  }

  if (!docs || !docs.id) {
    return (
      <EmptyWrapper>
        <EmptyState
          icon={FileText}
          title="文档不存在或已下架"
          description="该协议/帮助文档可能已被删除，或尚未对外公开。"
          action={<Button size="sm" onClick={() => window.history.back()}>返回上一页</Button>}
        />
      </EmptyWrapper>
    )
  }

  const attachments = Array.isArray(docs.attachment) ? docs.attachment.filter(Boolean) : []
  const keywords = String(docs.keywords || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)

  return (
    <div className="mx-auto w-full max-w-[880px] py-6">
      <Card>
        <CardHeader className="border-b border-line">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-[22px] leading-8">{docs.title || '未命名文档'}</CardTitle>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {docs.update_time > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    更新于 {formatDateTime(docs.update_time)}
                  </span>
                )}
                {keywords.length > 0 && (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <Tag className="size-3.5" aria-hidden="true" />
                    {keywords.slice(0, 6).map((k) => <Badge key={k} tone="muted">{k}</Badge>)}
                  </span>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="size-3.5" />返回
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* 内容来自富文本编辑器，属于后台可信录入；用 article 语义包裹并约束排版 */}
          <article
            className="cra1-rich-text"
            dangerouslySetInnerHTML={{ __html: decodeEntities(docs.content || '') }}
          />

          {attachments.length > 0 && (
            <div className="mt-8 border-t border-line pt-5">
              <h2 className="mb-3 text-[13px] font-medium text-ink">相关附件</h2>
              <ul className="space-y-2">
                {attachments.map((url, i) => (
                  <li key={`${url}-${i}`}>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 text-[13px] text-brand hover:underline">
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      {fileName(url, i)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {(docs.prev?.id || docs.next?.id) && (
        <nav className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="相邻文档">
          {docs.prev?.id ? (
            <a href={`/agreement.htm?id=${docs.prev.id}`}
               className="rounded-xl border border-line bg-surface p-4 transition-colors duration-150 hover:border-brand/40 hover:bg-brand/4">
              <span className="text-xs text-muted-foreground">上一篇</span>
              <p className="mt-1 truncate text-[13px] font-medium text-ink">{docs.prev.title}</p>
            </a>
          ) : <span />}
          {docs.next?.id && (
            <a href={`/agreement.htm?id=${docs.next.id}`}
               className="rounded-xl border border-line bg-surface p-4 text-right transition-colors duration-150 hover:border-brand/40 hover:bg-brand/4">
              <span className="text-xs text-muted-foreground">下一篇</span>
              <p className="mt-1 truncate text-[13px] font-medium text-ink">{docs.next.title}</p>
            </a>
          )}
        </nav>
      )}
    </div>
  )
}

function EmptyWrapper({ children }) {
  return <div className="mx-auto w-full max-w-[880px] py-10"><Card><CardContent className="p-6">{children}</CardContent></Card></div>
}

/** 富文本里常见 HTML 实体转义过度，官方主题也做了同样处理 */
function decodeEntities(html) {
  return String(html)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;lt;/g, '<')
    .replace(/&amp;gt;/g, '>')
    .replace(/&amp;quot;/g, '"')
    .replace(/&amp;amp;nbsp;/g, ' ')
    .replace(/&amp;#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function fileName(url, i) {
  try {
    const path = String(url).split('?')[0]
    const name = decodeURIComponent(path.split('/').pop() || '')
    return name || `附件 ${i + 1}`
  } catch {
    return `附件 ${i + 1}`
  }
}
