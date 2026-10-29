import { useState, useEffect } from 'react'
import { Newspaper, Calendar, ExternalLink, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Alert, EmptyState, Skeleton } from '../ui/feedback'
import { get, formatDateTime } from '../lib'

/**
 * 新闻 / 公告 / 帮助预览页（newsView.htm）
 *
 * 这个页面有两种进入方式，必须都支持：
 *
 *   ① 后台「预览」——管理端在 sessionStorage 写入 viewNewObjData 后 window.open
 *      该 JSON 形如 { title, keywords, content, attachment[] }，此时页面展示的是
 *      尚未保存的草稿内容，因此不能去调接口（官方主题也只读 sessionStorage）。
 *
 *   ② 前台「查看详情」——带 ?id= 进入，此时应拉取真实内容：
 *      GET /console/v1/news/:id       （插件 idcsmart_news）
 *      GET /console/v1/help/:id       （插件 idcsmart_help）
 *      接口可用时优先用接口，失败再退回 sessionStorage，避免后台预览白屏。
 *
 * 官方主题只实现了 ①，导致前台进入 newsView.htm?id=x 时因为 sessionStorage
 * 为空直接报错。
 */
export default function NewsViewPage() {
  const id = new URLSearchParams(location.search).get('id') || ''
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    // 预览模式：管理端把草稿放在 sessionStorage，不请求接口
    if (!id) {
      try {
        const raw = sessionStorage.getItem('viewNewObjData')
        setDoc(raw ? JSON.parse(raw) : null)
      } catch {
        setDoc(null)
      }
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    let alive = true
    // Independent content namespaces must never turn a failed news read into
    // a different help article with the same numeric ID.
    const kind = new URLSearchParams(location.search).get('type') === 'help' ? 'help' : 'news'
    get(`/${kind}/${id}`)
      .then((res) => {
        if (!alive) return
        const item = kind === 'help' ? res.data?.help : res.data?.news || res.data?.idcsmart_news
        setDoc(item && (item.id || item.title) ? item : null)
      })
      .catch((e) => { if (alive) { setDoc(null); if (Number(e.status) !== 404) setError(e.message) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, attempt])

  if (loading) {
    return (
      <Wrapper>
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </Wrapper>
    )
  }

  if (error && !doc) {
    return <Wrapper><Alert tone="error">页面错误，请刷新重试</Alert></Wrapper>
  }

  if (!doc) {
    return (
      <Wrapper>
        <EmptyState
          icon={Newspaper}
          title="没有可显示的内容"
          description={id
            ? '该内容不存在或已下架，可返回资讯列表查看其他内容。'
            : '请选择需要查看的文章，可返回首页重新选择。'}
          action={<Button size="sm" onClick={() => { window.location.href = '/home.htm' }}>返回首页</Button>}
        />
      </Wrapper>
    )
  }

  const attachments = Array.isArray(doc.attachment)
    ? doc.attachment.filter(Boolean).map((a) => (typeof a === 'string' ? { url: a } : a))
    : []

  return (
    <Wrapper>
      <Card>
        <CardHeader className="border-b border-line">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-[22px] leading-8">{doc.title || '未命名内容'}</CardTitle>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {doc.create_time > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    {formatDateTime(doc.create_time)}
                  </span>
                )}
                {doc.update_time > 0 && <span>更新于 {formatDateTime(doc.update_time)}</span>}
                {doc.keywords && <span>关键词：{doc.keywords}</span>}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="size-3.5" />返回
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <article
            className="cra1-rich-text"
            dangerouslySetInnerHTML={{ __html: decodeEntities(doc.content || '') }}
          />

          {attachments.length > 0 && (
            <div className="mt-8 border-t border-line pt-5">
              <h2 className="mb-3 text-[13px] font-medium text-ink">相关附件</h2>
              <ul className="space-y-2">
                {attachments.map((a, i) => (
                  <li key={`${a.url}-${i}`}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-2 text-[13px] text-brand hover:underline">
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      {a.name || fileName(a.url, i)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </Wrapper>
  )
}

function Wrapper({ children }) {
  return <div className="mx-auto w-full max-w-[880px] py-6">{children}</div>
}

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
