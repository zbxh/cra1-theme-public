import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Save, RotateCcw, Search, Globe, AlertTriangle, Info, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Input, Textarea, Label } from '@ui/input'
import { Badge, Alert, EmptyState, Skeleton } from '@ui/feedback'
import { useToast } from '@ui/toast'
import { cn } from '@ui/utils'
import { websiteApi } from '../lib/api'
import SwitchControl from '../ui/Switch'
import { FloatingActions } from '../ui/FloatingActions'

/**
 * SEO 设置（官网主题域）
 *
 * 每页 title/description/keywords 默认由服务端静态注册表给出（按页面语义写好），
 * 这里只做按页覆盖 + 全局兜底；保存走 api.seo.* 专用接口（按页增量 + revision 乐观锁）。
 * 前台由 hooks.php 输出 canonical / robots / OG / Twitter / JSON-LD，详情页标题另有前端按动态数据覆盖。
 */

/** 标题/描述长度提示（SEO 实践区间） */
function titleTip(v) {
  const n = (v || '').length
  if (!n) return { tone: 'muted', text: '留空使用主题内置标题' }
  if (n > 60) return { tone: 'warning', text: `偏长（${n} 字），搜索结果显示约 30 字` }
  return { tone: 'ok', text: `${n} 字` }
}
function descTip(v) {
  const n = (v || '').length
  if (!n) return { tone: 'muted', text: '留空使用主题内置描述' }
  if (n < 60) return { tone: 'warning', text: `偏短（${n} 字），建议 60-160 字` }
  if (n > 200) return { tone: 'warning', text: `偏长（${n} 字），建议 160 字以内` }
  return { tone: 'ok', text: `${n} 字` }
}

export default function SeoManager({ registerDirty, onNavigate }) {
  const toast = useToast()
  /* 页头操作区引用：悬浮操作条观察它是否滚出视野（Hook 顺序需稳定，故在所有提前 return 之前声明） */
  const actionsRef = useRef(null)
  const [data, setData] = useState(null)
  const [revision, setRevision] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeKey, setActiveKey] = useState('home')
  const [drafts, setDrafts] = useState({})     // pageKey → {title,desc,kw,noindex}
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    return websiteApi.seoGet()
      .then((r) => {
        if (r.status !== 200) throw new Error(r.msg || '读取失败')
        setData(r.data.pages)
        setRevision(r.data.revision)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  /** 某页当前生效值（草稿优先，否则服务端已保存的 override，最后内置默认） */
  const valueOf = useCallback((pk) => {
    const p = data?.[pk]
    if (!p) return { title: '', desc: '', kw: '', noindex: false }
    if (drafts[pk]) return drafts[pk]
    const o = p.override
    return {
      title: o?.title || '',
      desc: o?.desc || '',
      kw: o?.kw || '',
      noindex: !!o?.noindex,
    }
  }, [data, drafts])

  const dirtyKeys = useMemo(() => {
    if (!data) return new Set()
    const out = new Set()
    Object.keys(drafts).forEach((pk) => {
      const cur = drafts[pk]
      const saved = data[pk]?.override
      const same = (a, b) => (a || '') === (b || '')
      if (!same(cur.title, saved?.title) || !same(cur.desc, saved?.desc)
        || !same(cur.kw, saved?.kw) || !!cur.noindex !== !!saved?.noindex) out.add(pk)
    })
    return out
  }, [data, drafts])

  useEffect(() => {
    registerDirty?.('seo', dirtyKeys.size)
    return () => registerDirty?.('seo', 0)
  }, [dirtyKeys, registerDirty])

  const groups = useMemo(() => {
    if (!data) return {}
    const g = {}
    Object.entries(data).forEach(([pk, p]) => {
      let k = '独立页面'
      if (pk === 'home') k = '首页'
      else if (/^(news|announce|news-classify|news-details|announce-details)/.test(pk)) k = '内容 / 新闻'
      else if (/^(document|document-result|document-details|document-view)/.test(pk)) k = '文档中心'
      else if (/^solution\//.test(pk)) k = '行业方案'
      else if (pk === 'solution') k = '方案总览'
      else if (/^partner\//.test(pk)) k = '渠道合作'
      else if (['cloud', 'dedicated', 'domain', 'domain_buy', 'domain_register', 'domain_shop', 'ssl', 'sms', 'rent', 'trusteeship', 'trademark', 'icp', 'model'].includes(pk)) k = '产品详情'
      g[k] = g[k] || []
      g[k].push({ key: pk, ...p })
    })
    return g
  }, [data])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    const out = {}
    Object.entries(groups).forEach(([k, list]) => {
      const hit = list.filter((p) => p.label.toLowerCase().includes(q) || p.route.toLowerCase().includes(q) || p.key.includes(q))
      if (hit.length) out[k] = hit
    })
    return out
  }, [groups, query])

  const cur = data?.[activeKey]
  const val = valueOf(activeKey)

  function setVal(patch) {
    setDrafts((d) => ({ ...d, [activeKey]: { ...valueOf(activeKey), ...patch } }))
  }

  function revert() {
    setDrafts((d) => { const n = { ...d }; delete n[activeKey]; return n })
  }

  async function save() {
    if (!dirtyKeys.has(activeKey)) { toast('当前页面没有需要保存的修改'); return }
    setSaving(true)
    try {
      const r = await websiteApi.seoSave({ pageKey: activeKey, ...valueOf(activeKey), expectedRevision: revision })
      if (r.status === 200) {
        setDrafts((d) => { const n = { ...d }; delete n[activeKey]; return n })
        toast(r.msg || '已保存，前台已生效')
        await load()
      } else if (r.status === 409) {
        toast(r.msg || '配置已被其他会话修改，请刷新后重试', 'error')
        await load()
      } else {
        toast(r.msg || '保存失败', 'error')
      }
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error) return <Alert tone="error">SEO 配置加载失败：{error}</Alert>
  if (!data) return <EmptyState title="没有可显示的内容" description="请刷新页面重试" />

  const tip = cur ? { title: titleTip(val.title), desc: descTip(val.desc) } : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="SEO 设置"
        description="按页面覆盖标题/描述/关键词；留空使用主题内置默认（已按页面语义写好）。前台自动输出 canonical、robots、OG、Twitter 卡片与结构化数据。"
        actions={
          <div ref={actionsRef} data-page-actions className="flex flex-wrap items-center gap-2">
            {dirtyKeys.size > 0 && <Badge tone="warning">{dirtyKeys.size} 个页面未保存</Badge>}
            {dirtyKeys.has(activeKey) && (
              <Button variant="outline" size="sm" onClick={revert} disabled={saving}>
                <RotateCcw className="size-3.5" />撤销
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={saving || !dirtyKeys.has(activeKey)}>
              <Save className="size-3.5" />{saving ? '保存中…' : '保存本页'}
            </Button>
          </div>
        }
      />

      <Alert tone="info">
        <Info className="size-4" />
        sitemap.xml 与 robots.txt 由主题按 41 个真实页面自动生成维护（404 与旧跳转地址不收录）。
        站点级默认（标题后缀 / 默认描述 / 默认关键词 / 社交分享图）在
        <button
          type="button"
          className="mx-1 font-medium text-brand underline underline-offset-2 transition-colors duration-150 hover:text-brand-hover"
          onClick={() => onNavigate?.('website/site/site-info')}
        >「主题设置 → 系统设置 → 网站信息」</button>
        下方「SEO 全局」分组中设置。
      </Alert>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="p-3">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索页面…" className="pl-8" aria-label="搜索页面" />
            </div>
            <div className="max-h-[62vh] space-y-3 overflow-y-auto">
              {Object.entries(filtered).map(([g, list]) => (
                <div key={g}>
                  <div className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">{g}</div>
                  {list.map((p) => (
                    <button key={p.key} type="button" onClick={() => setActiveKey(p.key)}
                            aria-current={activeKey === p.key ? 'page' : undefined}
                            className={cn('flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors duration-150',
                                          activeKey === p.key ? 'bg-brand/10 font-medium text-brand' : 'text-body hover:bg-surface-alt')}>
                      <span className="min-w-0 truncate">{p.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {p.resolvedNoindex && <Badge tone="muted">noindex</Badge>}
                        {p.override && <Badge tone="default">自定义</Badge>}
                        {dirtyKeys.has(p.key) && <span className="size-1.5 rounded-full bg-[var(--color-warning)]" title="有未保存修改" />}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              {Object.keys(filtered).length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">没有匹配的页面</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {cur?.label}
                <code className="rounded bg-muted-bg px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{cur?.route}</code>
                {cur?.isDetail && <Badge tone="muted">详情页：标题按内容动态覆盖</Badge>}
              </CardTitle>
              <CardDescription>
                留空即使用内置默认；修改后保存立即生效（前台 canonical / OG / 结构化数据同步）。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {cur?.isDetail && (
                <Alert tone="warning">
                  <AlertTriangle className="size-4" />
                  详情页（新闻/公告/文档）的标题与描述由具体内容动态生成，此处填写的值仅作为服务端兜底（例如内容加载前的 SEO 抓取）。
                </Alert>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label>页面标题</Label>
                  {tip && <span className={cn('text-[11px]', tip.title.tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-muted-foreground')}>{tip.title.text}</span>}
                </div>
                <Input value={val.title} onChange={(e) => setVal({ title: e.target.value })}
                       placeholder={cur?.defaultTitle || '（使用内置默认）'} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  内置默认：<span className="text-body">{cur?.defaultTitle || '—'}</span>
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <Label>页面描述</Label>
                  {tip && <span className={cn('text-[11px]', tip.desc.tone === 'warning' ? 'text-[var(--color-warning)]' : 'text-muted-foreground')}>{tip.desc.text}</span>}
                </div>
                <Textarea rows={3} value={val.desc} onChange={(e) => setVal({ desc: e.target.value })}
                          placeholder={cur?.defaultDesc || '（使用内置默认）'} />
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  内置默认：<span className="text-body">{cur?.defaultDesc || '—'}</span>
                </p>
              </div>

              <div>
                <Label className="mb-1.5 block">关键词</Label>
                <Input value={val.kw} onChange={(e) => setVal({ kw: e.target.value })}
                       placeholder={cur?.defaultKw || '（使用内置默认）'} />
                <p className="mt-1.5 text-xs text-muted-foreground">英文逗号分隔。内置默认：<span className="text-body">{cur?.defaultKw || '—'}</span></p>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">搜索引擎不收录本页（noindex）</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">开启后前台输出 noindex,follow，适合临时页或重复内容页。</p>
                </div>
                <SwitchControl data-seo-noindex label="搜索引擎不收录本页" checked={val.noindex}
                               onCheckedChange={(next) => setVal({ noindex: next })} />
              </div>
            </CardContent>
          </Card>

          {/* 前台效果预览 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="size-4" />搜索结果预览</CardTitle>
              <CardDescription>大致对应搜索引擎结果页的展示效果</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Globe className="size-3.5" />
                  <span className="truncate">{cur?.route}</span>
                </div>
                <p className="mt-1 truncate text-[15px] font-medium text-[#1a0dab]">
                  {val.title || cur?.defaultTitle}{' '}
                  <span className="text-muted-foreground">-{data.home?.resolvedTitle?.split('-').slice(-1)[0] || ''}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-body">
                  {val.desc || cur?.defaultDesc || '（未设置描述）'}
                </p>
                {val.noindex && <p className="mt-2 text-[11px] text-[var(--color-warning)]">当前设置：不收录（noindex）</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 悬浮操作条：页头按钮滚出视野后出现，承载同一组操作 */}
      <FloatingActions
        anchorRef={actionsRef}
        saving={saving}
        dirtyCount={dirtyKeys.size}
        dirtyLabel={`${dirtyKeys.size} 个页面未保存`}
        onSave={save}
        onRevert={revert}
        revertLabel="撤销"
        revertDisabled={!dirtyKeys.has(activeKey)}
      />
    </div>
  )
}
