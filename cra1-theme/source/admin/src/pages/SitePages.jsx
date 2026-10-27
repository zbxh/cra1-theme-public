import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FileText, ExternalLink, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Alert, EmptyState, Skeleton } from '@ui/feedback'
import { websiteApi } from '../lib/api'
import { cn } from '@ui/utils'
import { DRAG_ROW_BASE, DRAG_LIST_BASE } from '../ui/dragSort'

/**
 * 主题页面（前台主题自带页面一览）
 *
 * 用途：把前台主题自带的页面集中列出来，便于对照检查与快速打开。
 *   每行：页面标题 + 说明 + 页面路径（不含域名）+ 右侧超链接图标（新标签页打开）。
 *
 * 数据来源：服务端 api.site-pages，由 cra1_page_module_manifest()（route/label）
 *   与 cra1_seo_registry()（title/description）合成 —— 前台新增页面只要进了
 *   这两个注册表就自动出现在这里，本页不维护第二份页面清单。
 *
 * 样式：完全复用拖拽排序那套（DRAG_ROW_BASE / DRAG_LIST_BASE），不新写行样式；
 *   分类的展开/收缩复用树行的 folder / chevron 视觉。
 */

/** 行内的只读图标按钮位（与拖拽排序操作列同一套视觉，此处仅放外链） */
function LinkIcon({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-surface-alt hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
    >
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  )
}

export default function SitePages() {
  const [groups, setGroups] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 分类展开态：默认全部展开（页面不多，摊开更好对照）
  const [collapsed, setCollapsed] = useState({})

  const load = () => {
    setLoading(true)
    setError('')
    websiteApi
      .sitePages()
      .then((res) => {
        if (res.status !== 200) {
          setError(res.msg || '加载失败')
          setGroups([])
          return
        }
        setGroups(res.data?.groups || [])
        setTotal(res.data?.total || 0)
      })
      .catch((e) => setError(e?.message || '加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const allCollapsed = useMemo(
    () => (groups || []).length > 0 && (groups || []).every((g) => collapsed[g.group]),
    [groups, collapsed],
  )

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsed({})
    } else {
      const next = {}
      ;(groups || []).forEach((g) => { next[g.group] = true })
      setCollapsed(next)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="主题页面" description="前台主题自带页面一览" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="主题页面"
        description="前台主题自带的页面清单；点右侧图标在新标签页打开。新增前台页面会自动出现在这里。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleAll} disabled={!groups?.length}>
              {allCollapsed ? '全部展开' : '全部收起'}
            </Button>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden="true" />
              刷新
            </Button>
          </div>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {!error && groups && groups.length === 0 && (
        <EmptyState title="暂无页面" description="页面注册表中还没有可展示的页面。" />
      )}

      {!error && groups && groups.length > 0 && (
        <>
          <div className="text-[11px] text-muted-foreground">
            共 {groups.length} 个分类、{total} 个页面
          </div>

          <div className="space-y-4">
            {groups.map((g) => {
              const isOpen = !collapsed[g.group]
              return (
                <Card key={g.group}>
                  <CardHeader className="border-b border-line/60 py-3">
                    <button
                      type="button"
                      onClick={() => setCollapsed((s) => ({ ...s, [g.group]: !s[g.group] }))}
                      aria-expanded={isOpen ? 'true' : 'false'}
                      aria-label={isOpen ? '收起该分类' : '展开该分类'}
                      className="flex min-h-6 w-full items-center gap-2 text-left"
                    >
                      {isOpen
                        ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      {isOpen
                        ? <FolderOpen className="size-3.5 shrink-0 text-brand/80" aria-hidden="true" />
                        : <Folder className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      <CardTitle className="text-[13px] font-medium text-brand">{g.group}</CardTitle>
                      <span className="shrink-0 rounded bg-surface-alt px-1 py-px text-[10px] leading-4 text-muted-foreground">
                        {g.pages.length}
                      </span>
                    </button>
                  </CardHeader>

                  {isOpen && (
                    <CardContent className="p-0">
                      {/* 复用拖拽排序的列表容器 + 行样式，不新写样式 */}
                      <ul className={cn(DRAG_LIST_BASE, 'rounded-none border-0')}>
                        {g.pages.map((p) => (
                          <li
                            key={p.key}
                            className={cn(DRAG_ROW_BASE, 'min-h-14 h-auto py-2')}
                          >
                            <FileText className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />

                            {/* 标题 + 说明 */}
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="truncate text-[13px] text-ink" title={p.title}>
                                  {p.title}
                                </span>
                                {p.isDetail && (
                                  <span className="shrink-0 rounded bg-surface-alt px-1 py-px text-[10px] leading-4 text-muted-foreground">
                                    详情页
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground" title={p.description}>
                                {p.description || '—'}
                              </div>
                            </div>

                            {/* 页面路径（不含域名） */}
                            <div className="hidden w-56 shrink-0 sm:block">
                              <span className="block truncate font-mono text-[11px] text-muted-foreground" title={p.route}>
                                {p.route}
                              </span>
                            </div>

                            {/* 右侧超链接图标：新标签页打开 */}
                            <div className="flex w-[78px] shrink-0 items-center justify-end gap-0.5">
                              <LinkIcon href={p.route} label={`在新标签页打开：${p.title}`} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
