import { useState, useEffect, useMemo } from 'react'
import {
  Globe, LayoutDashboard, ListTree, Palette, Shield, ExternalLink,
  RefreshCw, Info, Database, UserCog,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader } from '@ui/card'
import { Button } from '@ui/button'
import { Badge, Alert, Skeleton } from '@ui/feedback'
import { cn } from '@ui/utils'
import { memberApi, bootInfo } from '../lib/api'
import schema from '../schema.json'

/**
 * 管理台总览（合并原「官网主题总览」与「会员中心总览」）
 *
 * 一个页面同时反映两个控制域的状态，便于判断「当前生效的是什么、有没有未保存」：
 *   - 官网：可配置字段数、未保存修改数
 *   - 会员中心：侧栏节点数、与系统导航的差异、配置版本
 *   - 后台：管理员、数据存储位置、审计入口
 *
 * 强调隔离：明确标出两条配置线的存储文件不同，避免误以为改一处会影响另一处。
 */
export default function DashboardOverview({
  siteConfig, siteOriginal, siteLoading,
  member, memberLoading, user, onNavigate,
}) {
  const [catalog, setCatalog] = useState(null)
  const [catLoading, setCatLoading] = useState(true)

  useEffect(() => {
    setCatLoading(true)
    memberApi.catalog()
      .then((r) => setCatalog(r.data))
      .catch(() => setCatalog(null))
      .finally(() => setCatLoading(false))
  }, [])

  const siteFields = useMemo(
    () => schema.sections.reduce((n, s) => n + s.items.reduce((k, i) => k + (i.fields?.length || 0), 0), 0),
    []
  )
  const siteDirty = useMemo(() => {
    if (!siteConfig || !siteOriginal) return 0
    return Object.keys(siteConfig).filter((k) => siteConfig[k] !== siteOriginal[k]).length
  }, [siteConfig, siteOriginal])

  const nodes = member?.sidebar?.nodes || []
  const nodeCount = countAll(nodes)
  const diff = catalog?.diff
  const catalogError = catalog?.catalog?.error

  const loading = siteLoading || memberLoading

  return (
    <div className="space-y-4">
      <PageHeader
        title="管理台总览"
        description="官网主题与会员中心主题的状态一览；两者配置互相独立"
        actions={
          <Button variant="outline" size="sm" onClick={() => { setCatLoading(true); memberApi.catalog().then((r) => setCatalog(r.data)).catch(() => {}).finally(() => setCatLoading(false)) }}>
            <RefreshCw className="size-3.5" />刷新
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="space-y-2 p-5">
              <Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-24" />
            </CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Globe} label="官网可配置字段" value={siteFields}
                sub={`分 ${schema.sections.length} 组 · 未保存 ${siteDirty} 项`}
                warn={siteDirty > 0} />
          <Stat icon={ListTree} label="会员中心侧栏" value={nodeCount}
                sub={`${nodes.length} 个一级项 · 配置 v${member?.version ?? '—'}`} />
          <Stat icon={Shield} label="当前管理员" value={user || 'admin'}
                sub="官网与会员中心共用同一账号" />
          <Stat icon={Database} label="数据存储" value="2 份独立配置"
                sub="config.json 与 member_center.json" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 官网主题 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-4 text-brand" aria-hidden="true" />官网主题
            </CardTitle>
            <CardDescription>影响 public/web/cra1 官网，不影响会员中心</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="muted">字段 {siteFields}</Badge>
              <Badge tone={siteDirty ? 'warning' : 'muted'}>未保存 {siteDirty}</Badge>
              <Badge tone="muted">存储 config.json</Badge>
            </div>
            {siteDirty > 0 && (
              <p className="text-xs leading-5 text-muted-foreground">
                有未保存的官网修改，保存后官网前台立即生效。
              </p>
            )}
            <Button size="sm" onClick={() => onNavigate('website-config')}>
              <Palette className="size-3.5" />前往主题配置
            </Button>
          </CardContent>
        </Card>

        {/* 会员中心主题 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="size-4 text-brand" aria-hidden="true" />会员中心主题
            </CardTitle>
            <CardDescription>影响会员中心侧栏与顶栏，不影响官网</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="muted">侧栏节点 {nodeCount}</Badge>
              <Badge tone="muted">配置 v{member?.version ?? '—'}</Badge>
              <Badge tone="muted">存储 member_center.json</Badge>
            </div>

            {catalogError ? (
              <Alert tone="warning">无法读取系统导航：{catalogError}</Alert>
            ) : catLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : diff ? (
              (diff.added.length || diff.changed.length || diff.removed.length) ? (
                <div className="rounded-lg border border-line bg-surface-alt/60 p-3 text-[13px]">
                  <p className="mb-1 font-medium text-ink">与系统导航存在差异</p>
                  <p className="text-muted-foreground">
                    新增 {diff.added.length} · 变更 {diff.changed.length} · 来源失效 {diff.removed.length}
                  </p>
                </div>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">与系统导航一致。</p>
              )
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onNavigate('member-sidebar')}>
                <ListTree className="size-3.5" />侧边栏导航
              </Button>
              <Button size="sm" variant="outline" onClick={() => onNavigate('member-appearance')}>
                <Palette className="size-3.5" />外观设置
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-4 text-brand" aria-hidden="true" />账号与安全
            </CardTitle>
            <CardDescription>后台账号、入口路径与操作审计</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" onClick={() => onNavigate('security')}>
              <Shield className="size-3.5" />前往账号与安全
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4 text-brand" aria-hidden="true" />这两条配置线的边界
            </CardTitle>
            <CardDescription>改动前先确认要影响的是哪一端</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-[13px] leading-6 text-muted-foreground">
              <li>
                <b className="text-ink">主题选择（会员中心用哪个主题）</b>由 v10 系统后台
                「主题设置」控制，本后台不提供入口，避免两处互相覆盖。
              </li>
              <li>
                <b className="text-ink">会员中心侧栏</b>是本主题维护的独立副本，
                保存不会改动系统导航（系统导航仅作为导入来源）。
              </li>
              <li>
                <b className="text-ink">最近访问</b>显示在会员首页顶部，记录按会员分别保存在浏览器，
                后台在「公共设置 → 菜单」里设置标题、保留天数、显示数量及打开方式。
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function countAll(list) {
  return (list || []).reduce((n, x) => n + 1 + countAll(x.children), 0)
}

function Stat({ icon: Icon, label, value, sub, warn }) {
  return (
    <Card className={cn(warn && 'ring-1 ring-[var(--color-warning)]/25')}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Icon className="size-3.5" aria-hidden="true" />{label}
        </div>
        <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-ink">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}
