import {useDeferredValue, useMemo, useState} from 'react'
import {Button} from '@ui/button'
import {Input} from '@ui/input'

const kinds={added:'新增',removed:'删除',changed:'修改'}
function Value({value}) {
  const [expanded,setExpanded]=useState(false)
  if(value===null)return <span className="text-xs text-muted-foreground">未设置</span>
  const long=value.length>300
  return <div className="min-w-0"><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs leading-5">{value===''?'（空文本）':expanded?value:value.slice(0,300)+(long?'…':'')}</pre>{long&&<Button variant="ghost" size="sm" className="mt-1" onClick={()=>setExpanded(v=>!v)}>{expanded?'收起':`查看完整内容（${value.length} 字符）`}</Button>}</div>
}
export default function ConfigurationDiff({difference}) {
  const [search,setSearch]=useState(''),[page,setPage]=useState(0),query=useDeferredValue(search)
  const rows=useMemo(()=>{const q=query.trim().toLowerCase();return (difference?.entries||[]).filter(r=>!q||[r.label,r.path,r.before,r.after].some(s=>s?.toLowerCase().includes(q)))},[difference,query])
  const size=20,pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.min(page,pages-1)
  if(!difference)return null
  return <section aria-label="具体配置差异" className="min-w-0 space-y-3">
    <p className="text-sm font-medium">共 {difference.total} 项差异：新增 {difference.summary.added}、删除 {difference.summary.removed}、修改 {difference.summary.changed}</p>
    {difference.total>0?<><Input aria-label="搜索配置差异" placeholder="搜索设置名称或前后内容" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/>
      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">{rows.slice(current*size,(current+1)*size).map(r=><article key={r.path} className="min-w-0 rounded-lg border border-line p-3">
        <p className="break-words text-sm font-medium">{kinds[r.kind]} · {r.label}</p><p className="mt-1 break-all text-[11px] text-muted-foreground">{r.path}</p>
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2"><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">修改前</p><Value value={r.before}/></div><div className="min-w-0"><p className="mb-1 text-xs text-muted-foreground">修改后</p><Value value={r.after}/></div></div>
      </article>)}{!rows.length&&<p className="text-sm text-muted-foreground">没有匹配的差异。</p>}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>匹配 {rows.length} 项 · 第 {current+1} / {pages} 页</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={current===0} onClick={()=>setPage(current-1)}>上一页</Button><Button variant="outline" size="sm" disabled={current===pages-1} onClick={()=>setPage(current+1)}>下一页</Button></div></div>
    </>:<p className="text-sm text-muted-foreground">与当前配置一致。</p>}
  </section>
}
