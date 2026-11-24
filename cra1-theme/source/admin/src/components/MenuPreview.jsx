import {useEffect, useRef, useState} from 'react'
import {Eye, Folder, ChevronRight, Monitor, Smartphone} from 'lucide-react'
import {Button} from '@ui/button'
import {Card, CardHeader, CardTitle, CardContent} from '@ui/card'
import {Alert} from '@ui/feedback'
import {api} from '../lib/api'

function Icon({node}){return node.icon_resolved?.url?<img className="size-4 shrink-0" src={node.icon_resolved.url} alt=""/>:<Folder className="size-4 shrink-0"/>}
function PrimaryItem({node,active,choose,expand}) {
  const hasLink = !!node.target
  return <div className={'flex min-w-0 items-stretch rounded-lg '+(active?'bg-brand text-white':'hover:bg-surface')}>
    <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm"
      aria-expanded={hasLink ? undefined : active} onClick={hasLink ? choose : expand}>
      <Icon node={node}/><span className="min-w-0 break-words">{node.name}</span>
    </button>
    {hasLink && !!node.children?.length && <button type="button" className="grid w-10 shrink-0 place-items-center rounded-lg"
      aria-expanded={active} aria-label={'展开'+node.name+'菜单'} onClick={expand}><ChevronRight className="size-4" aria-hidden="true"/></button>}
  </div>
}
function Target({node}) {
  return <p className="break-all text-xs text-muted-foreground">
    {node.target ? <>跳转地址：<code>{node.target}</code></> : '无直接跳转'}
  </p>
}
function Pages({nodes,choose,selected,level=2}) {
  return <ul className="space-y-2">{nodes.map(node=>node.type==='separator'?<li key={node.id}><hr/></li>:
    <li key={node.id} className={level===2?'space-y-1 rounded-lg border border-line p-3':'ml-2 space-y-1'}>
      <button type="button" className="flex min-h-10 w-full min-w-0 items-center gap-2 text-left text-sm hover:text-brand" aria-pressed={selected?.id===node.id} onClick={()=>choose(node)}>
        <Icon node={node}/><span className="min-w-0 break-words font-medium">{node.name}</span>{node.target&&<ChevronRight className="ml-auto size-3 shrink-0"/>}
      </button>
      <Target node={node}/>
      {!!node.children?.length&&<Pages nodes={node.children} choose={choose} selected={selected} level={level+1}/>}
    </li>)}</ul>
}
export default function MenuPreview({sidebar,refresh,disabled,onEdit}) {
  const [data,setData]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[snapshot,setSnapshot]=useState(''),[mobile,setMobile]=useState(false),[primary,setPrimary]=useState(''),[selected,setSelected]=useState(null)
  const sequence=useRef(0),revision=useRef(refresh)
  const serialized=JSON.stringify(sidebar),stale=!!data&&snapshot!==serialized
  async function preview(){
    const request=++sequence.current
    setBusy(true);setError('')
    try {
      const r=await api('api.menu.preview',{sidebar})
      if(r.status!==200)throw new Error(r.msg||'菜单预览未完成')
      if(sequence.current!==request)return
      setData(r.data);setSnapshot(serialized);setSelected(null)
      setPrimary(id=>r.data.nodes.some(node=>node.id===id)?id:r.data.nodes.find(node=>node.type!=='separator')?.id||'')
    } catch(e) {
      if(sequence.current===request)setError(e.message)
    } finally {
      if(sequence.current===request)setBusy(false)
    }
  }
  useEffect(()=>{
    if(!disabled&&revision.current!==refresh){revision.current=refresh;preview()}
  },[refresh,disabled])
  const roots=data?.nodes||[],active=roots.find(n=>n.id===primary)
  function choose(node){setSelected(node)}
  return <Card><CardHeader><CardTitle>菜单效果预览与检查</CardTitle></CardHeader><CardContent className="min-w-0 space-y-4"><p className="text-sm text-muted-foreground">预览当前草稿和跳转地址，检查结果可直接打开对应菜单项。</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled||busy} onClick={preview}><Eye className="size-4"/>{busy?'正在检查…':data?'重新生成预览':'预览并检查当前菜单'}</Button>{data&&<><Button variant={mobile?'outline':'default'} size="sm" onClick={()=>setMobile(false)}><Monitor className="size-4"/>桌面</Button><Button variant={mobile?'default':'outline'} size="sm" onClick={()=>setMobile(true)}><Smartphone className="size-4"/>手机</Button></>}</div>
    {error&&<Alert tone="error">{error}</Alert>}{stale&&<Alert tone="warning">草稿已修改，请重新生成预览后再确认效果。</Alert>}
    {data&&<><p className="text-xs text-muted-foreground">配置 {data.counts.configured} 项 · 手动隐藏 {data.counts.hidden} 项 · 当前可展示 {data.counts.projected} 项。{data.permission_note}</p>
      <div aria-label={mobile?'手机菜单预览':'桌面菜单预览'} className={'overflow-x-auto rounded-card border border-line '+(mobile?'mx-auto w-full max-w-[360px]':'w-full')}>
        <div className="border-b border-line bg-surface-alt px-4 py-3 text-sm font-medium">会员中心 · 菜单预览</div>
        {!roots.length?<p className="p-4 text-sm text-muted-foreground">当前草稿没有可展示的菜单。</p>:<div className={(mobile?'max-h-[60vh] overflow-y-auto':'max-h-[60vh] overflow-y-auto grid min-w-[400px] grid-cols-[minmax(90px,140px)_minmax(0,1fr)]')}>
          <nav aria-label="预览一级菜单" className={'min-w-0 bg-surface-alt p-2 '+(mobile?'flex flex-wrap gap-1 border-b border-line':'space-y-1 border-r border-line')}>{roots.map(node=>node.type==='separator'?<hr key={node.id} className="my-2 w-full"/>:<PrimaryItem key={node.id} node={node} active={node.id===primary}
            choose={()=>{setPrimary(node.id);choose(node)}} expand={()=>{setPrimary(node.id);setSelected(null)}}/>)}</nav>
          <div className="min-w-0 space-y-3 p-3">{active&&<>
            <div className="space-y-1"><p className="text-sm font-semibold">{active.name}</p><Target node={active}/></div>
            {active.children?.length>0&&<Pages nodes={active.children} selected={selected} choose={choose}/>}
          </>}
          {selected&&<div role="status" className="space-y-2 border-t border-line pt-3"><p className="text-sm font-medium">{selected.name}</p><Target node={selected}/><Button variant="outline" size="sm" disabled={disabled||busy||stale} onClick={()=>onEdit(selected.id)}>编辑所选菜单</Button></div>}
          </div>
        </div>}
      </div>
      <div className="space-y-2"><p className="text-sm font-medium">检查结果</p>{data.issues.length?<ul className="max-h-64 space-y-2 overflow-y-auto">{data.issues.map((issue,i)=><li key={issue.id+'-'+i} className="rounded-lg border border-line p-3 text-sm"><p className="break-words font-medium">{issue.path}</p><p className="mt-1 text-muted-foreground">{issue.message}</p>{issue.target&&<Target node={issue}/>}<Button className="mt-2" variant="outline" size="sm" disabled={disabled||busy||stale} onClick={()=>onEdit(issue.id,issue)}>编辑此菜单项</Button></li>)}</ul>:<p className="text-sm text-muted-foreground">未发现空入口、失效关联或重复目标等常见问题。具体会员的权限和业务页面仍需在前台确认。</p>}</div>
    </>}
  </CardContent></Card>
}
