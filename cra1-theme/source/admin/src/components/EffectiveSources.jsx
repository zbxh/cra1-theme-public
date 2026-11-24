import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, ListTree } from 'lucide-react'
import { Alert, Badge } from '@ui/feedback'
import { Button } from '@ui/button'
import { Input, Select } from '@ui/input'
import { api } from '../lib/api'
import { routeFor } from '../lib/navigation'
import { findProductCategory, productListEntries, productListSources, productNavigationCategories } from '../../../member/src/lib/product-config'

const stateLabel = { current: '磁盘快照已同步', stale: '磁盘快照与已保存设置有差异', missing: '未找到磁盘快照', invalid: '磁盘快照无法读取' }
const menuState = { published: '已发布', hidden: '已隐藏', unavailable: '前台未发布' }
const menuType = { custom:'自定义菜单', module:'服务器模块', res_module:'代理模块', plugin:'插件', separator:'分隔线' }
const tabs = [['current','当前产品'],['using','使用中'],['expiring','即将到期'],['overdue','已逾期'],['all','全部'],['deleted','已删除']]

function ProductSources({ data, onEditProduct, onEditMenu }) {
  const [entry,setEntry] = useState('all'), [tab,setTab] = useState('current')
  const language = document.documentElement.lang.toLowerCase() || 'zh-cn'
  const entries = useMemo(() => productListEntries(data.nav), [data.nav])
  const categories = useMemo(() => productNavigationCategories(data.nav, language), [data.nav, language])
  const labels = new Map([['all','全部分类']])
  const names = (nodes, parent = '') => {
    for (const node of nodes || []) {
      const name = parent + (node.name || '')
      if (entries.has(String(node.id))) labels.set(String(node.id), name)
      names(node.children, name ? name + ' → ' : '')
    }
  }
  names(data.nav)
  const key = labels.has(entry) ? entry : 'all'
  const category = findProductCategory(categories, key)
  const source = productListSources(data.productList, entries, key, tab, category)
  const labelFor = key => key === 'default' ? '全局默认设置' : key === 'category' ? '分类名称' : labels.get(key) || '主题默认'
  const entryParams = new URLSearchParams({ tab })
  if (key !== 'all') entryParams.set('cloud_menu', key)
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">结果基于站点菜单。会员自己的权限会影响可见分类与产品。</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <Select aria-label="选择要核对的产品入口" value={key} onChange={event=>{setEntry(event.target.value);setTab(entries.get(event.target.value)?.tab || 'current')}}>{[...labels].map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select>
      <Select aria-label="选择产品状态页签" value={tab} onChange={event=>setTab(event.target.value)}>{tabs.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
    </div>
    <dl className="grid gap-2 rounded-lg border border-line p-3 text-sm">
      <div><dt className="font-medium">标题 · {labelFor(source.titleSource)}</dt><dd className="break-words">{source.title}</dd></div>
      <div><dt className="font-medium">说明 · {labelFor(source.descriptionSource)}</dt><dd className="break-words">{source.description}</dd></div>
      {source.copy?.html && <div><dt className="font-medium">介绍 · {labelFor(source.copySource)}</dt><dd>此入口已配置介绍内容。</dd></div>}
      <div><dt className="font-medium">购买按钮 · {labelFor(source.purchaseSource)}</dt><dd className="break-all">{source.purchase ? `${source.purchase.text} · ${source.purchase.newTab ? '新标签页' : '当前页'} · ${source.purchase.url}（${{button:'购买按钮设置',menu:'菜单关联商品',theme:'购物车首页'}[source.purchaseUrlSource]}）` : '隐藏'}</dd></div>
      {category && <div><dt className="font-medium">关联商品 · 侧边栏菜单</dt><dd>{category.product_id.join('、') || '未关联商品'}</dd></div>}
    </dl>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" asChild><a href={data.url+'?'+entryParams} target="_blank" rel="noreferrer">访问此入口<ExternalLink className="size-4"/></a></Button>
      {onEditProduct && <Button size="sm" variant="outline" onClick={()=>onEditProduct(source.selectedKey)}>编辑此入口</Button>}
      {onEditMenu && key !== 'all' && <Button size="sm" variant="outline" onClick={()=>onEditMenu(key)}>编辑关联菜单</Button>}
    </div>
  </div>
}

function MenuSources({ data, onEditMenu }) {
  const [search,setSearch] = useState('')
  const [limit,setLimit] = useState(20)
  const query = search.trim().toLowerCase()
  const items = data.items.filter(item=>!query || [item.path, item.url, item.savedUrl].some(value=>String(value || '').toLowerCase().includes(query)))
  return <div className="space-y-2">
    <Input aria-label="按菜单名称或地址搜索" placeholder="按菜单名称或地址搜索" value={search} onChange={event=>{setSearch(event.target.value);setLimit(20)}} />
    {items.slice(0,limit).map(item=><div key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line p-3 text-sm">
      <div className="min-w-0 space-y-1">
        <p className="break-words font-medium">{item.path} <Badge tone={item.state==='unavailable'?'warning':'muted'}>{menuState[item.state]}</Badge></p>
        <p className="break-all">{menuType[item.type] || '系统导航'} · {item.url || '无跳转地址'}</p>
        {item.savedUrl && item.savedUrl !== item.url && <p className="break-all text-muted-foreground">保存的菜单地址 {item.savedUrl}</p>}
        {!!item.products?.length && <p className="text-muted-foreground">关联商品 {item.products.join('、')}</p>}
      </div>
      <Button size="sm" variant="outline" onClick={()=>onEditMenu(item.id)}>编辑菜单</Button>
    </div>)}
    {!items.length && <p className="text-sm text-muted-foreground">没有匹配的菜单项。</p>}
    {items.length>limit && <Button variant="outline" onClick={()=>setLimit(limit+20)}>显示更多菜单</Button>}
  </div>
}

function WebsiteSources({ data, navigate, id }) {
  const [section,setSection] = useState('')
  const module = data.modules.find(m=>m.id===section) || data.modules[0]
  return <div className="space-y-3">
    <p className="text-sm">模块排序来自{data.orderSource}</p>
    <Select aria-label="选择要核对的模块" value={module?.id || ''} onChange={event=>setSection(event.target.value)}>
      {data.modules.map(m=><option key={m.id} value={m.id}>{m.position ? m.position + '. ' : ''}{m.label}{m.visible ? '' : '（隐藏）'}</option>)}
    </Select>
    {module && <div className="space-y-2">
      <p className="text-sm">{module.visible ? '已显示' : '已隐藏'} · {module.visibilitySource}</p>
      {module.fields.map(f=><div key={f.key} className="rounded-lg border border-line p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><span>{f.label} <Badge tone="muted">{f.source}</Badge></span>{f.shared && <Button size="sm" variant="outline" onClick={()=>navigate(routeFor('website','common:'+f.shared,{field:f.key}))}>编辑公共设置</Button>}</div>
        <p className="whitespace-pre-wrap break-all text-muted-foreground">{f.value || '空值'}</p>
      </div>)}
      <Button size="sm" variant="outline" onClick={()=>navigate(routeFor('website',id,{module:module.id}))}>编辑此页面模块</Button>
    </div>}
  </div>
}

export default function EffectiveSources({ domain, id, dirty, revision, navigate, onEditMenu, onEditProduct }) {
  const [open,setOpen] = useState(false)
  const [request,setRequest] = useState(0)
  const [result,setResult] = useState(null)
  const [error,setError] = useState('')
  useEffect(()=>{
    if (!open) return
    const controller = new AbortController()
    setResult(null)
    setError('')
    api('api.workspace.sources.get', { domain, editorId:id }, { signal:controller.signal })
      .then(response=>{
        if (controller.signal.aborted) return
        if (response.status !== 200) throw new Error(response.msg || '页面来源暂时不可读')
        setResult(response.data)
      })
      .catch(failure=>{if (!controller.signal.aborted) setError(failure.message)})
    return ()=>controller.abort()
  },[domain,id,open,request,revision])
  const theme = result?.theme
  return <details className="advanced-details rounded-lg border border-line bg-surface px-4 py-3" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary><span className="inline-flex items-center gap-2"><ListTree className="size-4" aria-hidden="true"/>页面生效来源</span></summary>
    {open && <div className="space-y-3 pt-3">
      {dirty && <Alert tone="info">当前有未保存修改。这里核对前台读取的内容。</Alert>}
      {error && <Alert tone="error">{error} <Button size="sm" variant="outline" onClick={()=>setRequest(n=>n+1)}>重试</Button></Alert>}
      {!error && !result && <p role="status" className="text-sm text-muted-foreground">正在读取生效来源…</p>}
      {result && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {theme?.available ? <p className="text-sm">默认主题 · 桌面 {theme.pc || '未启用'} · 手机 {theme.phone || '未启用'}</p> : <p className="text-sm">暂时无法读取 V10 默认主题选择</p>}
          <Button size="sm" variant="outline" onClick={()=>setRequest(n=>n+1)}>刷新来源</Button>
        </div>
        {theme?.shellPc && <p className="text-sm">会员导航 · 桌面 {theme.shellPc} · 手机 {theme.shellPhone}</p>}
        {theme?.note && <p className="text-xs text-muted-foreground">{theme.note}</p>}
        {theme?.available && !theme.active && <Alert tone="warning">此页面的站点默认设置当前未使用酷锐A1。下面可核对已保存的主题设置。</Alert>}
        {result.snapshot && <Alert tone="info">{stateLabel[result.snapshot]}。已保存配置 {result.savedVersion}，磁盘快照 {result.version ?? '不可用'}。下方按前台接口实时读取的配置展示。</Alert>}
        {result.note && <p className="text-sm text-muted-foreground">{result.note}</p>}
        {result.modules && <WebsiteSources data={result} navigate={navigate} id={id}/>}
        {result.items && <MenuSources data={result} onEditMenu={onEditMenu}/>}
        {id==='products' && <ProductSources data={result} onEditMenu={onEditMenu} onEditProduct={onEditProduct}/>}
        {result.blocks && <div className="space-y-2">{result.blocks.map(block=><div key={block.key} className="rounded-lg border border-line p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{block.label}</span><Button size="sm" variant="outline" onClick={()=>navigate(routeFor('cart',id,{module:block.id}))}>编辑</Button></div>
          <dl className="grid gap-2 sm:grid-cols-2">{block.fields.map((f,index)=><div className="min-w-0" key={index}>
            <dt className="text-muted-foreground">{f.label} <Badge tone="muted">{f.source}</Badge></dt>
            <dd className="break-all">{f.value || '空值'}</dd>
          </div>)}</dl>
        </div>)}</div>}
        {id!=='products' && result.url && <Button size="sm" variant="outline" asChild><a href={result.url} target="_blank" rel="noreferrer">打开前台页面<ExternalLink className="size-4"/></a></Button>}
      </>}
    </div>}
  </details>
}
