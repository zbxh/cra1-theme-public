import { useState, useEffect, lazy, Suspense, Component } from 'react'
import { Command } from 'cmdk'
import { Globe, UsersRound, ShoppingCart, House, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Menu, Search, ChevronRight, ChevronDown, Settings, KeyRound, ScrollText, LogOut, ArrowRight, Image } from 'lucide-react'
import { Button } from '@ui/button'
import { Input } from '@ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card'
import { Alert, Badge } from '@ui/feedback'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@ui/sheet'
import { useToast } from '@ui/toast'
import { websiteApi, memberApi, cartApi, bootInfo } from './lib/api'
import { WorkspaceProvider, useWorkspaces, equal, rememberRoute, restoredRoute } from './lib/workspace'
import { menuLabel, PUBLIC_SETTINGS, publicEditors, publicSelection, publicSettingRoute, routeFor, scopeRoute, normalizeRoute } from './lib/navigation'
export { scopeRoute, normalizeRoute } from './lib/navigation'
import registry from './workspace.registry.json'
const Attachments=lazy(()=>import('./pages/Attachments'))
const Announcements=lazy(()=>import('./pages/Announcements'))
const MemberAuth=lazy(()=>import('./pages/MemberAuth'))
const VisualWebsite=lazy(()=>import('./pages/VisualWebsite'))
const CodeEditor=lazy(()=>import('./pages/VisualWebsite').then(m=>({default:m.CodeEditor})))
import WorkspaceFrame from './components/WorkspaceFrame'
import Reauth from './components/Reauth'
const MemberContent=lazy(()=>import('./pages/MemberContent')),MemberAppearance=lazy(()=>import('./pages/MemberAppearance')),MemberSidebar=lazy(()=>import('./pages/MemberSidebar')),CartContent=lazy(()=>import('./pages/CartContent')),Security=lazy(()=>import('./pages/Security'))
const leaf=(label,domain,id)=>({label:menuLabel(label),id:routeFor(domain,id),editor:id,domain})
const publicLeaf=domain=>({label:'公共设置',id:`/${domain}/settings`,domain,public:true})
const pageGroups=['产品','解决方案','资讯与文档','企业与服务','合作与特殊页面']
const ThemeManagement=lazy(()=>import('./pages/ThemeManagement'))
export const NAV=[
 {label:'管理台',icon:LayoutDashboard,items:[{label:'总览',id:'/overview'},{label:'通知管理',id:'/notifications'}]},
 {label:'官网主题',icon:Globe,items:[leaf('首页','website','page:home'),publicLeaf('website'),...pageGroups.map(category=>({label:category==='产品'?'产品页面':category,key:'website-'+category,children:Object.entries(registry.pages).filter(([id,p])=>p.category===category).map(([id,p])=>leaf(p.editorLabel,'website','page:'+id))}))]},
 {label:'会员中心',icon:UsersRound,items:['home','products','server','ticket','login','regist'].map(id=>leaf(registry.editors['member:'+id].label,'member',id)).concat([publicLeaf('member')])},
 {label:'购物车',icon:ShoppingCart,items:['goodslist','shoppingcar','settlement','orderresult'].map(id=>leaf(registry.editors['cart:'+id].label,'cart',id)).concat([publicLeaf('cart')])},
 {label:'资源管理',icon:Image,items:[{label:'附件管理',id:'/attachments'}]},
 {label:'后台管理',icon:Settings,items:[{label:'主题管理',id:'/admin/theme'},{label:'我的安全',id:'/admin/me'},{label:'账号管理',id:'/admin/accounts'},{label:'审计日志',id:'/admin/audit'},{label:'后台安全',id:'/admin/settings'}].filter(n=>n.id==='/admin/settings'?bootInfo.role==='super_admin':['/admin/accounts','/admin/theme'].includes(n.id)?bootInfo.role!=='operator':true)},
]
export default function App(){return <WorkspaceProvider><Shell/></WorkspaceProvider>}
function Shell(){
 const ctx=useWorkspaces(),toast=useToast(),[route,setRoute]=useState(()=>normalizeRoute(window.location.hash||restoredRoute())),[collapsed,setCollapsed]=useState(()=>localStorage.getItem('cra1AdminNavCollapsed')==='1'),[mobile,setMobile]=useState(false),[search,setSearch]=useState(''),[command,setCommand]=useState(false),[query,setQuery]=useState(''),[expanded,setExpanded]=useState(()=>{try{return JSON.parse(localStorage.getItem('cra1AdminGroups')||'{}')}catch{return{}}})
 const [testNotice,setTestNotice]=useState(()=>bootInfo.http_test&&sessionStorage.getItem(`security-test-notice:${bootInfo.user_id}`)!=='1')
 const navigate=next=>{next=normalizeRoute(next);window.location.hash=next;setRoute(next);rememberRoute(next);setMobile(false);setCommand(false)}
 useEffect(()=>{if(!window.location.hash||window.location.hash.slice(1)!==route)window.history.replaceState(null,'',window.location.pathname+window.location.search+'#'+route);const changed=()=>{const next=normalizeRoute(window.location.hash);if(window.location.hash.slice(1)!==next)window.history.replaceState(null,'',window.location.pathname+window.location.search+'#'+next);setRoute(next);rememberRoute(next)};window.addEventListener('hashchange',changed);const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCommand(v=>!v)}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('hashchange',changed);window.removeEventListener('keydown',key)}},[])
 useEffect(()=>{localStorage.setItem('cra1AdminNavCollapsed',collapsed?'1':'0')},[collapsed])
 useEffect(()=>{localStorage.setItem('cra1AdminGroups',JSON.stringify(expanded))},[expanded])
 const dirty=Object.entries(ctx.records).filter(([,r])=>r.values&&!equal(r.values,r.original)),path=route.split('?')[0]
 useEffect(()=>{const current=NAV.flatMap(g=>g.items).find(n=>n.children?.some(x=>path===x.id));if(current)setExpanded(v=>v[current.key]===true?v:{...v,[current.key]:true})},[path])
 const toggle=k=>setExpanded(v=>({...v,[k]:!v[k]}))
 const matches=(node)=>{
  if(!search||node.label.includes(search)||node.children?.some(matches))return true
  const editors=node.public?publicEditors(node.domain).map(item=>registry.editors[node.domain==='website'?item.id:node.domain+':'+item.id]):[node.editor&&registry.editors[node.domain==='website'?node.editor:node.domain+':'+node.editor]]
  return editors.filter(Boolean).some(e=>{const fields=e.fields.length?e.fields:Object.values(e.sections).flatMap(s=>registry.scopes[s].fields||[]);return e.label.includes(search)||fields.some(f=>f.label.includes(search)||f.controlLabels?.some(label=>label.includes(search)))||e.modules?.some(m=>m.label.includes(search))})||registry.legacyEntries.some(old=>old.label.includes(search)&&old.destinations.some(d=>scopeRoute(d).split('?')[0]===node.id))
 }
 const nodeButton=(n)=>{const active=path===n.id,draft=dirty.some(([id])=>scopeRoute(id).split('?')[0]===n.id);return <button key={n.id} type="button" className={`nav-item ${active?'active':''}`} onClick={()=>navigate(n.id)} aria-label={n.label} aria-description={draft?'有未保存修改':undefined} aria-current={active?'page':undefined}><span className="nav-label min-w-0 flex-1 truncate text-left">{n.label}</span>{draft&&<span className="draft-dot" aria-label="有未保存修改"/>}</button>}
 const nav=<>
  <div className="sidebar-brand"><span className="brand-mark" aria-label="CRA1">CRA1</span>{!collapsed&&<div><p className="font-semibold">酷锐A1主题</p><p className="text-xs text-muted-foreground">选择页面，直接修改</p></div>}</div>
  {!collapsed&&<div className="sidebar-search"><Input aria-label="搜索配置入口" placeholder="搜索页面或设置…" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){setQuery(search);setCommand(true)}}}/></div>}
  <nav className="sidebar-nav" aria-label="主题配置菜单">{NAV.map(g=><div className="nav-group" key={g.label}>
   {collapsed?<button type="button" title={g.label} aria-label={g.label} className="theme-nav-icon" onClick={()=>{setCollapsed(false);if(g.items[0].id)navigate(g.items[0].id)}}><g.icon className="size-5"/></button>:<>
    <div className="theme-nav-label"><g.icon className="size-4"/><span className="nav-label">{g.label}</span></div>
    <div className="nav-group-items">{g.items.filter(n=>n.domain!=='cart'||!n.public||bootInfo.role==='super_admin').filter(matches).map(n=>{
     if(!n.children)return nodeButton(n)
     const open=!!search||expanded[n.key]===true||expanded[n.key]===undefined&&n.children.some(x=>path===x.id)
     return <div className="nav-category" key={n.key}>
      <button type="button" className="nav-category-trigger" aria-expanded={open} onClick={()=>toggle(n.key)}>
       {open?<ChevronDown className="size-3.5"/>:<ChevronRight className="size-3.5"/>}<span className="nav-label">{n.label}</span>
       {n.children.some(x=>dirty.some(([id])=>scopeRoute(id).split('?')[0]===x.id))&&<span className="draft-dot"/>}
      </button>
      {open&&<div className="nav-category-items">{n.children.filter(matches).map(nodeButton)}</div>}
     </div>
    })}</div>
   </>}
  </div>)}</nav>
  <div className="sidebar-footer">{!collapsed&&<span className="flex-1 truncate text-xs text-muted-foreground">{bootInfo.user}</span>}<Button variant="ghost" aria-label="退出登录" onClick={async()=>{if(dirty.length&&!window.confirm('还有未保存的修改，退出会清除草稿。确认退出？'))return;try{const r=await websiteApi.logout();if(r.status!==200)throw new Error(r.msg);ctx.clear();window.location.href='index.php?r=login'}catch(e){toast(e.message,'error')}}}><LogOut className="size-4"/></Button></div>
 </>
 const commands=Object.values(registry.editors).filter(e=>e.id!=='custom'||bootInfo.role==='super_admin').flatMap(e=>{
  const group={website:'官网主题',member:'会员中心',cart:'购物车'}[e.domain],fields=e.fields.length?e.fields:Object.values(e.sections).flatMap(s=>registry.scopes[s].fields||[])
  return [{label:e.label,group,id:routeFor(e.domain,e.id),terms:fields.map(f=>f.label).join(' ')},...fields.flatMap(f=>{
   const params=new URLSearchParams()
   if(e.domain==='website'){params.set('field',f.key);params.set(e.kind==='page'?'module':'section',e.kind==='page'?f.moduleId:Object.keys(e.sections).find(part=>registry.scopes[e.sections[part]].fields.some(x=>x.key===f.key))||'')}
   return [f.label,...(f.controlLabels||[])].map(label=>({label,group:group+' / '+e.label,id:routeFor(e.domain,e.id,params),terms:f.controlLabels?.join(' ')||''}))
  })]
 }).concat([{label:'通知管理',group:'管理台',id:'/notifications',terms:'通知 公告 轮播 显示位置 开始时间 到期时间 优先级 关闭记忆 顶部信息条'}]).concat(registry.legacyEntries.flatMap(e=>e.destinations.map(s=>({label:e.label,group:'旧入口',id:scopeRoute(s),terms:e.path}))))

 return <><Reauth/><div className={`admin-shell ${collapsed?'sidebar-collapsed':''}`}><aside className="admin-sidebar">{nav}</aside><Sheet open={mobile} onOpenChange={setMobile}><SheetContent side="left" className="mobile-sidebar"><SheetHeader><SheetTitle>主题配置</SheetTitle></SheetHeader>{nav}</SheetContent></Sheet><div className="admin-main"><header className="admin-header"><Button className="desktop-only" variant="ghost" aria-label={collapsed?'展开侧栏':'折叠侧栏'} onClick={()=>setCollapsed(!collapsed)}>{collapsed?<PanelLeftOpen className="size-4"/>:<PanelLeftClose className="size-4"/>}</Button><Button className="mobile-only" variant="ghost" aria-label="打开菜单" onClick={()=>{setCollapsed(false);setMobile(true)}}><Menu className="size-4"/></Button><button type="button" className="text-sm text-muted-foreground" onClick={()=>navigate('/overview')}>酷锐A1主题</button><Button variant="ghost" className="ml-auto" onClick={()=>setCommand(true)}><Search className="size-4"/>查找设置</Button></header><main className="admin-content">{testNotice&&<Alert tone="warning">HTTP 测试站 · 正式部署需使用有效 HTTPS。<Button variant="ghost" onClick={e=>{sessionStorage.setItem(`security-test-notice:${bootInfo.user_id}`,'1');setTestNotice(false)}}>知道了</Button></Alert>}{bootInfo.must_change&&<Alert tone="warning">请先到“我的安全”修改初始密码。</Alert>}{ctx.persistenceError&&<Alert tone="warning">{ctx.persistenceError}</Alert>}<Boundary key={path}><Suspense fallback={<p role="status">正在加载配置页…</p>}><Content route={route} navigate={navigate}/></Suspense></Boundary></main><footer className="admin-attribution"><a href="https://github.com/zbxh/cra1-theme-public" target="_blank" rel="noopener noreferrer">主题：酷锐A1</a></footer></div><Dialog open={command} onOpenChange={setCommand}><DialogContent><DialogHeader><DialogTitle>查找页面与设置</DialogTitle><DialogDescription>输入中文页面、区块或设置名称。</DialogDescription></DialogHeader><Command label="搜索所有设置"><Command.Input aria-label="搜索所有设置" placeholder="例如：轮播图、联系我们、按钮…" value={query} onValueChange={setQuery}/><Command.List><Command.Empty>没有找到相关设置</Command.Empty>{commands.map((n,i)=><Command.Item key={i} value={`${n.group} ${n.label} ${n.terms} ${i}`} onSelect={()=>navigate(n.id)}>{n.label}<span className="ml-auto text-xs text-muted-foreground">{n.group}</span></Command.Item>)}</Command.List></Command></DialogContent></Dialog></div></>
}
function Content({route,navigate}){
 const [path,query='']=route.split('?'),bits=path.split('/').filter(Boolean)
 if(bootInfo.role!=='super_admin'&&(query.includes('item=custom')||bits[2]==='custom'||bits[1]==='settings'&&bits[0]==='cart'))return <Alert tone="warning">当前账号无权修改自定义代码。</Alert>
 if(bits[0]==='admin'&&(bits[1]==='settings'&&bootInfo.role!=='super_admin'||bits[1]==='accounts'&&bootInfo.role==='operator'))return <Alert tone="warning">当前账号无权访问此页。</Alert>
 if(bits[0]==='website'&&bits[1]==='edit')return <VisualWebsite editorId={decodeURIComponent(bits[2])} query={query} navigate={navigate}/>
 if(PUBLIC_SETTINGS[bits[0]]&&bits[1]==='settings')return <PublicSettings domain={bits[0]} query={query} navigate={navigate}/>
 if(['member','cart'].includes(bits[0])&&bits[1]==='edit')return <ThemeEditor domain={bits[0]} id={decodeURIComponent(bits[2])} query={query} navigate={navigate}/>
 if(path==='/attachments')return <Attachments/>
 if(path==='/notifications')return <Announcements/>
 if(path==='/admin/theme')return bootInfo.role==='operator'?<Alert tone="warning">当前账号无权访问此页。</Alert>:<ThemeManagement/>
 if(bits[0]==='admin')return <Security mode={bits[1]} user={bootInfo.user} logsApi={websiteApi}/>
 return <Overview navigate={navigate}/>
}
function ThemeEditor({domain,id,query,navigate,embedded=false}){
 const e=registry.editors[domain+':'+id]
 const frame=<WorkspaceFrame key={domain+id} domain={domain} editorId={id} title={e.label} saveDescription={embedded?'保存当前设置的全部修改':undefined}>{w=>{
  const child={...w,values:w.values.main,original:w.original.main,data:{...w.data,scope:w.data.scopes.main},setValues:fn=>w.setValues(v=>({...v,main:typeof fn==='function'?fn(v.main):fn}))}
  if(id==='custom')return <CodeEditor code={child.values.custom_code} onChange={v=>child.setValues({...child.values,custom_code:v})}/>
  return <div className="embedded-editor">{id==='sidebar'?<MemberSidebar workspace={child} member={{...child.values,version:w.data.version}} loading={false} reload={()=>w.reload()}/>:id==='appearance'?<MemberAppearance workspace={child} member={{...child.values,version:w.data.version}} loading={false} reload={()=>w.reload()}/>:<BusinessContent domain={domain} id={id} query={query} navigate={navigate} workspace={child}/>}</div>
 }}</WorkspaceFrame>
 return embedded?frame:<div className="space-y-5"><div><p className="text-sm text-muted-foreground">{domain==='member'?'会员中心':'购物车'}</p><h1 className="text-2xl font-semibold">{e.label}</h1></div>{frame}</div>
}
const HEADER_SECTIONS=[['site-info','头部文字'],['site-menu','导航菜单'],['site-support','客服信息']]
function PublicSettings({domain,query,navigate}){
 const ctx=useWorkspaces(),params=new URLSearchParams(query),selected=publicSelection(domain,params.get('item')),items=PUBLIC_SETTINGS[domain].filter(x=>x.id!=='custom'||bootInfo.role==='super_admin'),common=selected.startsWith('common:')
 const [commonOpen,setCommonOpen]=useState(common)
 useEffect(()=>{if(common)setCommonOpen(true)},[selected])
 const section=HEADER_SECTIONS.some(([key])=>key===params.get('section'))?params.get('section'):'site-info'
 const dirty=Object.entries(ctx.records).filter(([,r])=>r.domain===domain&&r.values&&!equal(r.values,r.original))
 const hasDraft=id=>dirty.some(([key])=>new URLSearchParams(scopeRoute(key).split('?')[1]).get('item')===id)
 const pick=(id,part)=>navigate(publicSettingRoute(domain,id,part?{section:part}:''))
 const choice=(item,part)=>{
  const active=selected===item.id&&(!part||section===part)
  return <button key={part||item.id} type="button" className={'block-choice '+(active?'active':'')} data-setting-id={item.id} data-setting-section={part} aria-label={item.label} aria-description={!part&&hasDraft(item.id)?'有未保存修改':undefined} aria-current={active?'true':undefined} onClick={()=>pick(item.id,part)}><span>{item.label}</span>{!part&&hasDraft(item.id)&&<span className="draft-dot" aria-label="有未保存修改"/>}</button>
 }
 return <div className="space-y-5"><div><p className="text-sm text-muted-foreground">{{website:'官网主题',member:'会员中心',cart:'购物车'}[domain]}</p><h1 className="text-2xl font-semibold">公共设置</h1></div>
  <div className="visual-workspace public-settings-workspace">
   <aside className="block-picker public-settings-picker" aria-label="公共设置选择"><p className="block-picker-heading">选择要修改的部分</p>
    <select className="mobile-block-picker w-full rounded border border-line p-2" aria-label="选择公共设置" value={selected==='header'?'header|'+section:selected} onChange={e=>{const [id,part]=e.target.value.split('|');pick(id,part)}}>
     {items.map(item=>item.id==='header'?<optgroup label="头部" key="header">{HEADER_SECTIONS.map(([key,label])=><option key={key} value={'header|'+key}>{label}</option>)}</optgroup>:item.children?<optgroup key={item.id} label={item.label}>{item.children.map(child=><option key={child.id} value={child.id}>{child.label}</option>)}</optgroup>:<option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    <div className="desktop-block-picker">{items.map(item=>item.children?<div key={item.id}>
     <button type="button" className={'block-choice '+(common?'active':'')} aria-label={item.label} aria-expanded={commonOpen} onClick={()=>{if(!common){setCommonOpen(true);pick(item.children[0].id)}else setCommonOpen(!commonOpen)}}><span>{item.label}</span>{item.children.some(child=>hasDraft(child.id))&&<span className="draft-dot" aria-label="有未保存修改"/>}{commonOpen?<ChevronDown className="size-3.5"/>:<ChevronRight className="size-3.5"/>}</button>
     {commonOpen&&<div className="settings-group-items">{item.children.map(child=>choice(child))}</div>}
    </div>:<div key={item.id}>{choice(item)}{item.id==='header'&&selected==='header'&&<div className="settings-group-items">{HEADER_SECTIONS.map(([part,label])=>choice({id:'header',label},part))}</div>}</div>)}</div>
   </aside>
   <div className="min-w-0">{domain==='website'?<VisualWebsite editorId={selected} query={query} navigate={navigate} embedded/>:<ThemeEditor domain={domain} id={selected} query={query} navigate={navigate} embedded/>}</div>
  </div>
 </div>
}
const BUSINESS_BLOCKS={
 'member:home':[['banner','活动推荐'],['todo','待办事项'],['quick','常用功能'],['news','公告时间轴'],['security','账户安全概览']],
 'cart:goodslist':[['copy','标题与说明'],['grid','商品卡片排列'],['card_sections','卡片显示内容'],['default_selection','默认商品'],['config_panel','选配区域'],['heading_icons','标题图标']],
 'cart:shoppingcar':[['empty','购物车为空时'],['recommendations','推荐商品']],
 'cart:settlement':[['copy','结算文案']], 'cart:orderresult':[['copy','订单结果文案']]
}
function BusinessContent({domain,id,query,navigate,workspace}){
 const blocks=BUSINESS_BLOCKS[domain+':'+id],key=new URLSearchParams(query).get('module'),selected=blocks?.find(b=>b[0]===key)?.[0]||blocks?.[0][0]
 const content=<div className="embedded-editor">{domain==='cart'?<CartContent workspace={workspace} scope={id} block={selected}/>:['login','regist'].includes(id)?<MemberAuth key={id} workspace={workspace} kind={id}/>:<MemberContent workspace={workspace} scope={id} block={selected}/>}</div>
 if(!blocks||blocks.length===1)return content
 return <div className="visual-workspace"><aside className="block-picker"><p className="block-picker-heading">选择要修改的部分</p><select aria-label="选择页面区块" className="mobile-block-picker w-full rounded border border-line p-2" value={selected} onChange={e=>navigate(routeFor(domain,id)+'?module='+e.target.value)}>{blocks.map(([k,label])=><option key={k} value={k}>{label}</option>)}</select><div className="desktop-block-picker">{blocks.map(([k,label])=><button className={'block-choice '+(k===selected?'active':'')} type="button" key={k} onClick={()=>navigate(routeFor(domain,id)+'?module='+k)}>{label}</button>)}</div></aside><div className="min-w-0">{content}</div></div>
}
function Overview({navigate}){
 const ctx=useWorkspaces(),dirty=Object.entries(ctx.records).filter(([,r])=>r.values&&!equal(r.values,r.original)),[state,setState]=useState({}),[loading,setLoading]=useState(false)
 const refresh=async()=>{setLoading(true);const responses=await Promise.allSettled([websiteApi.get(),memberApi.get(),cartApi.get()]);setState(Object.fromEntries(responses.map((r,i)=>{const domain=['website','member','cart'][i];return [domain,r.status==='fulfilled'&&r.value.status===200?{version:r.value.data?.config?.version||r.value.data?.version||null,updated:r.value.meta?.updated_at}: {error:r.status==='fulfilled'?r.value.msg:r.reason.message}]})));setLoading(false)}
 useEffect(()=>{refresh()},[])
 return <div className="space-y-6"><div className="flex justify-between gap-3"><h1 className="text-2xl font-semibold">酷锐A1主题</h1><Button variant="outline" disabled={loading} onClick={refresh}>{loading?'刷新中…':'刷新状态'}</Button></div><p className="text-muted-foreground">选择要修改的主题，再进入对应页面或公共设置。</p><div className="grid gap-4 lg:grid-cols-3">{[['website','官网主题','首页、产品页面与解决方案','page:home',Globe],['member','会员中心','会员页面与菜单','home',UsersRound],['cart','购物车','商品展示、购物车与结算','goodslist',ShoppingCart]].map(([d,name,desc,id,Icon])=><Card key={d}><CardHeader><Icon className="size-6"/><CardTitle>{name}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{desc}</p>{state[d]?.error?<Alert tone="error">{state[d].error}</Alert>:<p className="text-xs text-muted-foreground">{loading?'正在读取状态…':'配置可正常读取'}{state[d]?.version?` · 配置版本 ${state[d].version}`:''} · {dirty.filter(([,r])=>r.domain===d).length} 页未保存</p>}<Button className="w-full justify-between" variant="outline" onClick={()=>navigate(routeFor(d,id))}>开始配置<ArrowRight className="size-4"/></Button></CardContent></Card>)}</div><Card><CardHeader><CardTitle>未保存的修改</CardTitle></CardHeader><CardContent>{dirty.length?dirty.map(([id,r])=><button type="button" className="picker-row w-full justify-between" key={id} onClick={()=>navigate(scopeRoute(id))}><span>{r.data?.editor?.label||r.data?.scope?.label||'页面配置'}</span><Badge tone="warning">未保存</Badge></button>):<p className="text-sm text-muted-foreground">当前没有未保存的修改。</p>}</CardContent></Card></div>
}
class Boundary extends Component{state={error:null};static getDerivedStateFromError(error){return{error}};render(){return this.state.error?<Alert tone="error">页面错误，请刷新重试</Alert>:this.props.children}}
