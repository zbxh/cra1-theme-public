import { useState, useEffect } from 'react'
import { ExternalLink, ArrowRight, Layers, Eye, EyeOff, Plus } from 'lucide-react'
import { Button } from '@ui/button'
import { Input, Label, Textarea, Select } from '@ui/input'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@ui/card'
import { Alert, Badge } from '@ui/feedback'
import registry from '../workspace.registry.json'
import Field from './FieldWidget'
import WorkspaceFrame from '../components/WorkspaceFrame'
import PagePicker from '../components/PagePicker'
import { DragHandle, useFlatDrag, DropBadge, DragAnnouncer } from '../ui/dragSort'
import { clone, equal, useWorkspaces } from '../lib/workspace'

function Fields({ workspace: w, navigate, query = '' }) {
  const scope = w.data.scope
  const setField = (key, value) => w.setValues((v) => ({ ...v, [key]: value }))
  const [section, setSection] = useState('all')
  useEffect(() => {
    const params = new URLSearchParams(query)
    const module = params.get('module')
    const field = params.get('field')
    setSection(module || 'all')
    if (field) requestAnimationFrame(() => document.getElementById(`field-${field}`)?.scrollIntoView({ block:'center' }))
  }, [query, scope.id])
  const sections = [...new Map(scope.fields.map((f) => [f.moduleId || scope.id, registry.pages[scope.pageKey]?.modules.find((m) => m.id === f.moduleId)?.label || '页面设置'])).entries()]
  return <>
    {scope.kind === 'shared' && <Alert tone="info">公共内容由以下页面引用：{(scope.affectedPageKeys || []).map((pk) => registry.pages[pk]?.label).join('、') || '主题组件'}。保存公共默认值会影响继承它的页面。</Alert>}
    {sections.length > 1 && <div className="flex flex-wrap gap-2"><Button variant={section === 'all' ? 'secondary' : 'ghost'} onClick={() => setSection('all')}>全部内容</Button>{sections.map(([id,label]) => <Button key={id} variant={section === id ? 'secondary' : 'ghost'} onClick={() => setSection(id)}>{label}</Button>)}</div>}
    {!scope.fields.length && <Alert tone="info">本页没有独立内容字段。公共内容可通过下面的来源入口编辑，模块顺序和显隐在“模块布局”中设置。</Alert>}
    {scope.fields.filter((f) => section === 'all' || (f.moduleId || scope.id) === section).map((definition) => {
      const f = clone(definition)
      if (f.adapter === 'page-rows') {
        f.cols = f.cols.slice(1)
        f.hint = '仅编辑当前页面条目。页面归属自动设置，公共回退内容在公共模块管理。'
      }
      const bound = (text) => String(text || '').split('\n').filter((l) => l.trim()).map((line) => { const match = line.match(/^([!>]*)(.*)$/); return `${match[1]}${scope.pageKey}|${match[2]}` }).join('\n')
      const unbound = (text) => String(text || '').split('\n').filter((l) => l.trim()).map((line) => line.replace(/^([!>]*)[^|]*\|/, '$1')).join('\n')
      const value = w.values[f.key]
      const source = w.data.sources?.[f.key]
      return <Card key={f.key} id={`field-${f.key}`}><CardContent className="p-5">
        <Field field={f} value={f.adapter === 'page-rows' ? unbound(value) : value} onChange={(v) => setField(f.key, f.adapter === 'page-rows' ? bound(v) : v)} config={w.values} setField={setField} />
        {source?.value && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-alt p-3"><span className="text-xs text-muted-foreground">{source.overriddenBy ? '本页专属条目已优先生效，此处是回退内容' : source.mode === 'append' ? '此页同时展示公共共享条目' : value ? '当前页内容优先，留空继承公共内容' : '当前页继承公共内容'}</span><Button size="sm" variant="ghost" onClick={() => navigate(`/website/shared/${encodeURIComponent(source.scopeId.slice(7))}`)}>查看公共内容<ArrowRight className="size-3" /></Button></div>}
      </CardContent></Card>
    })}
    {!!scope.references?.length && <Card><CardHeader><CardTitle>引用的公共内容</CardTitle><CardDescription>这些内容在公共模块统一编辑。</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{scope.references.map((id) => <Button key={id} variant="outline" className="justify-between" onClick={() => navigate(`/website/shared/${encodeURIComponent(id.slice(7))}`)}>{registry.scopes[id].label}<ArrowRight className="size-4" /></Button>)}</CardContent></Card>}
    {scope.kind === 'shared' && w.values.pageVisibility && <SharedVisibility w={w} />}
  </>
}
function SharedVisibility({ w }) {
  const [selected, setSelected] = useState([])
  const [mode, setMode] = useState('inherit')
  const states = w.values.pageVisibility
  return <Card><CardHeader><CardTitle>页面显隐规则</CardTitle><CardDescription>公共默认值只影响“继承”页面。勾选页面后可批量设置。</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Select aria-label="批量显隐规则" className="w-auto" value={mode} onChange={(e) => setMode(e.target.value)}><option value="inherit">继承公共默认值</option><option value="show">显示</option><option value="hide">隐藏</option></Select><Button variant="outline" disabled={!selected.length} onClick={() => w.setValues((v) => ({ ...v, pageVisibility: { ...v.pageVisibility, ...Object.fromEntries(selected.map((pk) => [pk,mode])) } }))}>应用到 {selected.length} 个页面草稿</Button></div>
    <div className="divide-y divide-line">{Object.entries(states).map(([pk,state]) => <div className="flex flex-wrap items-center gap-3 py-3" key={pk}><label className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" checked={selected.includes(pk)} onChange={(e) => setSelected(e.target.checked ? [...selected,pk] : selected.filter((x) => x !== pk))} />{registry.pages[pk].label}</label><Select className="w-auto" aria-label={`${registry.pages[pk].label}显隐`} value={state} onChange={(e) => w.setValues((v) => ({ ...v, pageVisibility: { ...v.pageVisibility, [pk]: e.target.value } }))}><option value="inherit">继承公共默认值</option><option value="show">显示</option><option value="hide">隐藏</option></Select></div>)}</div>
  </CardContent></Card>
}
function Layout({ workspace: w, page, navigate }) {
  const [announcement, setAnnouncement] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const order = w.values.order
  const drag = useFlatDrag({ count: order.length, onAnnounce: setAnnouncement,
    onPickup: () => ({ order:clone(w.values.order), inheritOrder:w.values.inheritOrder }),
    onCancel: (snapshot) => w.setValues((v) => ({ ...v, ...snapshot })),
    onMove: (from,to) => w.setValues((v) => { const next = v.order.slice(); const [item] = next.splice(from,1); next.splice(to,0,item); return { ...v, order:next, inheritOrder:false } }) })
  return <><Alert tone="info">当前页独立排序与显隐。{w.values.inheritOrder ? '顺序继承同类页面。' : '已设置当前页独立顺序。'}</Alert><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => w.setValues((v) => ({ ...v, inheritOrder:true, order: clone(w.data.resolved.inheritedOrder) }))}>继承同类页面顺序</Button><Button variant="outline" onClick={() => w.setValues((v) => ({ ...v, inheritOrder:false, order:page.modules.map((m) => m.id) }))}>使用模板默认顺序</Button></div><DragAnnouncer message={announcement} />
    <div className="space-y-2" role="list" aria-label="页面模块排序">{order.map((mid,i) => {
      const module = page.modules.find((m) => m.id === mid)
      const state = w.values.visibility[mid]
      const effective = state === 'inherit' ? w.data.resolved.inheritedVisibility[mid] : state === 'show'
      return <Card key={mid} draggable {...drag.itemProps(i)} className={drag.isOver(i) ? 'border-brand' : ''}><div className="flex flex-wrap items-center gap-3 p-4"><DragHandle {...drag.handleProps(i, `移动${module.label}`)} /><button type="button" aria-expanded={!collapsed[mid]} className="min-w-0 flex-1 text-left font-medium" onClick={() => setCollapsed({ ...collapsed,[mid]:!collapsed[mid] })}>{module.label}</button>{drag.isOver(i) && <DropBadge pos={drag.dropPos} />}
        {module.visibilityKey ? <Select className="w-auto" aria-label={`${module.label}显示规则`} value={state} onChange={(e) => w.setValues((v) => ({ ...v,visibility:{ ...v.visibility,[mid]:e.target.value } }))}><option value="inherit">继承 · {effective ? '显示' : '隐藏'}</option><option value="show">当前页显示</option><option value="hide">当前页隐藏</option></Select> : <Badge>显隐固定</Badge>}
      </div>{!collapsed[mid] && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted-foreground"><span>{module.visibilityKey ? (effective ? '当前页生效：显示' : '当前页生效：隐藏') : '固定显示，支持排序与内容编辑'} · 可折叠后拖动</span><Button size="sm" variant="ghost" onClick={() => navigate(`/website/pages/${encodeURIComponent(w.data.scope.pageKey)}/content?module=${encodeURIComponent(mid)}`)}>编辑模块内容<ArrowRight className="size-3" /></Button></div>}</Card>
    })}</div></>
}
function Seo({ workspace: w, pageKey }) {
  const cfg = w.data.resolved.seoDefault || {}
  const title = w.values.title.trim() || cfg.title
  const fullTitle = title && cfg.suffix ? `${title}-${cfg.suffix}` : title || cfg.suffix
  const locked = pageKey === '404'
  const set = (key,value) => w.setValues((v) => ({ ...v,[key]:value }))
  return <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>页面 SEO 覆盖</CardTitle><CardDescription>留空继承页面默认值及全局设置。</CardDescription></CardHeader><CardContent className="space-y-4">{[['title','页面标题'],['desc','页面描述'],['kw','关键词']].map(([key,label]) => <div key={key}><Label>{label}</Label>{key === 'desc' ? <Textarea value={w.values[key]} onChange={(e) => set(key,e.target.value)} maxLength={300} /> : <Input value={w.values[key]} onChange={(e) => set(key,e.target.value)} maxLength={300} />}</div>)}<label className="flex items-center gap-2"><input type="checkbox" checked={locked || w.values.noindex} disabled={locked} onChange={(e) => set('noindex',e.target.checked)} />不收录本页 {locked && '· 404 系统固定策略'}</label></CardContent></Card><Card><CardHeader><CardTitle>搜索结果预览</CardTitle><CardDescription>当前草稿与服务端默认值合并后的预览</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-xs text-success">{registry.pages[pageKey].route}</p><p className="break-words text-lg text-brand">{fullTitle}</p><p className="break-words text-sm text-muted-foreground">{w.values.desc || cfg.description}</p>{(locked || w.values.noindex || cfg.noindex) && <Badge tone="warning">不收录本页</Badge>}<p className="text-xs text-muted-foreground">{w.values.title ? '标题：页面覆盖' : '标题：继承模板默认'} · {w.values.desc ? '描述：页面覆盖' : cfg.sources?.description === 'global' ? '描述：继承全局设置' : '描述：继承模板默认'}</p></CardContent></Card></div>
}
export default function WebsiteWorkspace({ area, selected, tab = 'content', query = '', navigate }) {
  const { records } = useWorkspaces()
  let entries, id, title
  if (area === 'pages') {
    entries = Object.entries(registry.pages).map(([id,p]) => ({ id,label:p.label,category:p.category,scopes:['content','layout','seo'].map((t) => `page:${id}:${t}`) }))
    entries.push(...Object.entries(registry.pageAliases).map(([id,p]) => ({id,label:`${p.label}（旧地址 → ${registry.pages[p.aliasOf].label}）`,category:'旧地址别名',scopes:[]})))
    selected = registry.pages[selected] ? selected : 'home'
    id = `page:${selected}:${tab}`; title = registry.pages[selected].label
  } else {
    const kind = area === 'site' ? 'site' : 'shared'
    entries = Object.values(registry.scopes).filter((s) => s.domain === 'website' && s.kind === kind).map((s) => ({ id:area === 'site' ? s.id : s.id.slice(7),label:s.label,scopes:[s.id] }))
    selected = entries.some((e) => e.id === selected) ? selected : entries[0]?.id
    id = area === 'site' ? selected : `shared:${selected}`; title = registry.scopes[id]?.label
  }
  if (!id || !registry.scopes[id]) return <Alert tone="error">配置范围不存在</Alert>
  const page = registry.pages[selected]
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">{area === 'pages' ? '页面管理' : area === 'site' ? '全站设置' : '公共模块'}</h1><p className="mt-1 text-sm text-muted-foreground">{area === 'pages' ? '页面内容、模块布局与 SEO' : area === 'site' ? '官网全站信息与公共组件' : '共享内容、默认值与引用页面'}</p></div><div className="flex max-w-full flex-wrap gap-2"><PagePicker entries={entries} value={selected} label={area === 'pages' ? '选择官网页面' : '选择配置组'} onChange={(next) => navigate(`/website/${area}/${encodeURIComponent(next)}${area === 'pages' ? '/'+tab : ''}`)} />{page && <Button variant="outline" asChild><a href={page.route} target="_blank" rel="noreferrer">访问前台<ExternalLink className="size-4" /></a></Button>}</div></div>
    {area === 'pages' && <div className="workspace-tabs" role="tablist" aria-label="页面配置">{[['content','内容'],['layout','模块布局'],['seo','SEO']].map(([key,label]) => <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => navigate(`/website/pages/${encodeURIComponent(selected)}/${key}`)}>{label}{records[`page:${selected}:${key}`]?.values && !equal(records[`page:${selected}:${key}`].values,records[`page:${selected}:${key}`].original) && <span className="draft-dot" />}</button>)}</div>}
    <WorkspaceFrame key={id} domain="website" scopeId={id} title={`${title}${area === 'pages' ? ({content:'内容',layout:'布局',seo:' SEO'}[tab]) : ''}`}>{(w) => area === 'pages' && tab === 'layout' ? <Layout workspace={w} page={page} navigate={navigate} /> : area === 'pages' && tab === 'seo' ? <Seo workspace={w} pageKey={selected} /> : <Fields workspace={w} navigate={navigate} query={query} />}</WorkspaceFrame>
  </div>
}
export function SeoOverview({ navigate }) {
  const [query,setQuery] = useState('')
  return <div className="space-y-5"><h1 className="text-2xl font-semibold tracking-tight">SEO 管理</h1><p className="text-sm text-muted-foreground">全局默认值在此编辑；页面覆盖统一在页面工作区设置。</p><WorkspaceFrame domain="website" scopeId="site:seo" title="全局 SEO">{(w) => <>
    <Fields workspace={w} navigate={navigate} />
    <Card><CardHeader><CardTitle>页面 SEO 生效状态</CardTitle><CardDescription>显示当前已保存的最终标题和继承来源。页面覆盖只在对应页面编辑。</CardDescription></CardHeader><CardContent>
      <Input aria-label="搜索 SEO 页面" placeholder="搜索页面…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mt-3 divide-y divide-line">{Object.entries(registry.pages).filter(([pk,p]) => `${p.label} ${pk}`.includes(query)).map(([pk,p]) => {
        const seo = w.data.resolved.pageSeo?.[pk]
        const hasOverride = seo && Object.values(seo.sources).includes('page')
        return <div key={pk} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{p.label}</p><p className="truncate text-xs text-muted-foreground">{seo?.titleFull || p.route}</p></div><Badge tone={hasOverride ? 'default' : 'muted'}>{hasOverride ? '页面覆盖' : '继承默认'}</Badge>{seo?.noindex && <Badge tone="warning">{pk === '404' ? '系统锁定不收录' : '不收录'}</Badge>}<Button variant="ghost" onClick={() => navigate(`/website/pages/${encodeURIComponent(pk)}/seo`)}>查看与编辑<ArrowRight className="size-4" /></Button></div>
      })}</div>
    </CardContent></Card>
  </>}</WorkspaceFrame></div>
}
