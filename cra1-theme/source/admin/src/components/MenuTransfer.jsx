import {useEffect, useRef, useState} from 'react'
import {Download, Upload} from 'lucide-react'
import {Button} from '@ui/button'
import {Input} from '@ui/input'
import {MenuSelect} from '@ui/select'
import {Alert} from '@ui/feedback'
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter} from '@ui/dialog'
import {api, bootInfo} from '../lib/api'
import ConfigurationDiff from './ConfigurationDiff'

export function downloadJson(value, name) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'}))
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export function treeIds(nodes) {return (nodes||[]).flatMap(n=>[n.id,...treeIds(n.children)])}

function SelectionTree({nodes, selected, onChange, disabled, depth=0}) {
  return <ul className={depth?'ml-3 border-l pl-3':'space-y-1'}>{nodes.map(n=><SelectionNode key={n.id} node={n} selected={selected} onChange={onChange} disabled={disabled} depth={depth}/>)}</ul>
}
function SelectionNode({node,selected,onChange,disabled,depth}) {
  const ids=treeIds([node]),count=ids.filter(id=>selected.includes(id)).length,ref=useRef(null)
  useEffect(()=>{if(ref.current)ref.current.indeterminate=count>0&&count<ids.length},[count,ids.length])
  return <li><label className="flex min-h-10 items-center gap-2 py-1 text-sm"><input ref={ref} type="checkbox" aria-label={node.label} checked={count===ids.length} disabled={disabled} onChange={e=>onChange(e.target.checked?[...new Set([...selected,...ids])]:selected.filter(id=>!ids.includes(id)))}/><span className="min-w-0 break-words">{node.label}</span><span className="shrink-0 text-xs text-muted-foreground">{depth+1}级</span></label>{!!node.children?.length&&<SelectionTree nodes={node.children} selected={selected} onChange={onChange} disabled={disabled} depth={depth+1}/>}</li>
}

export default function MenuTransfer({sidebar, disabled, onApply, onBusy}) {
  const [mode,setMode]=useState(''),[document,setDocument]=useState(null),[selected,setSelected]=useState([]),[recent,setRecent]=useState(false),[method,setMethod]=useState('append'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[warnings,setWarnings]=useState([]),[proposal,setProposal]=useState(null)
  const source=mode==='export'?sidebar:document?.sidebar,nodes=source?.nodes||[],all=treeIds(nodes)
  const canImport=['admin','super_admin'].includes(bootInfo.role)
  function open(value) {setProposal(null);setMode(value);setDocument(null);setSelected(value==='export'?treeIds(sidebar.nodes):[]);setRecent(value==='export');setMethod('append');setError('');setWarnings([])}
  async function call(action,body) {const r=await api('api.menu.'+action,body);if(r.status!==200)throw new Error(r.msg||'操作未完成');return r.data}
  async function run(fn) {if(busy)return;setBusy(true);onBusy?.(true);setError('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false);onBusy?.(false)}}
  async function choose(file) {
    if(!file)return
    await run(async()=>{setProposal(null);setDocument(null);setSelected([]);setRecent(false);if(file.size>3*1024*1024)throw new Error('菜单文件不能超过 3MB');let doc;try{doc=JSON.parse(await file.text())}catch{throw new Error('请选择有效的菜单 JSON 文件')}await call('inspect',{document:doc});setDocument(doc);setSelected(treeIds(doc.sidebar.nodes));setRecent(!!doc.sidebar.recent)})
  }
  async function submit() {
    await run(async()=>{
      if(mode==='export'){const doc=await call('export',{sidebar,selected,recent});downloadJson(doc,'酷锐A1-会员菜单.json');setMode('')}
      else if(!proposal){const data=await call('import',{document,sidebar,selected,recent,mode:method});setProposal(data)}else{onBusy?.(false);onApply(proposal.sidebar);setWarnings(proposal.warnings||[]);setMode('')}
    })
  }
  return <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled||busy} onClick={()=>open('export')}><Download className="size-4"/>导出菜单</Button>{canImport&&<Button variant="outline" disabled={disabled||busy} onClick={()=>open('import')}><Upload className="size-4"/>导入菜单</Button>}</div>{warnings.length>0&&<Alert>{warnings.join(' ')} 已应用到草稿，请检查后保存。</Alert>}
    <Dialog open={!!mode} onOpenChange={v=>{if(!v&&!busy)setMode('')}}><DialogContent className="flex max-h-[88vh] w-[min(94vw,640px)] flex-col overflow-hidden"><DialogHeader><DialogTitle>{mode==='export'?'导出菜单':'导入菜单'}</DialogTitle><DialogDescription>{mode==='export'?'选择要导出的菜单和最近访问设置。导出包含当前草稿。':'选择文件和导入内容。导入只改变当前草稿，保存后生效。'}</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
      {error&&<Alert tone="error">{error}</Alert>}
      {mode==='import'&&<label className="mb-4 block text-sm">菜单 JSON 文件<Input className="mt-2" type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';choose(file)}}/></label>}
      {source&&<><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-sm">已选 {selected.length} / {all.length} 项</span><div className="flex gap-2"><Button size="sm" variant="ghost" disabled={busy} onClick={()=>{setProposal(null);setSelected(all)}}>全选</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>{setProposal(null);setSelected([])}}>清空</Button></div></div><div className="max-h-[38vh] overflow-y-auto rounded-lg border p-3"><SelectionTree nodes={nodes} selected={selected} onChange={value=>{setProposal(null);setSelected(value)}} disabled={busy}/>{!nodes.length&&<p className="text-sm text-muted-foreground">文件中没有菜单条目。</p>}</div>{source.recent&&<label className="my-3 flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={recent} disabled={busy} onChange={e=>{setProposal(null);setRecent(e.target.checked)}}/>包含最近访问设置</label>}
      {mode==='import'&&<label className="mt-3 block text-sm">导入方式<MenuSelect aria-label="导入方式" className="mt-2 w-full" value={method} disabled={busy} onChange={e=>{setProposal(null);setMethod(e.target.value)}}><option value="append">追加到当前菜单（保留现有条目）</option><option value="replace">替换整份菜单为所选内容</option></MenuSelect>{method==='replace'&&<span className="mt-2 block text-xs text-muted-foreground">当前菜单将替换为所选内容，可在保存前撤销。</span>}</label>}</>}
      {proposal&&<div className="mt-4 space-y-3">{proposal.warnings?.map((text,i)=><Alert key={i}>{text}</Alert>)}<ConfigurationDiff key={JSON.stringify(proposal.sidebar)} difference={proposal.difference}/><p className="text-xs text-muted-foreground">确认后只应用到当前草稿；仍需保存菜单配置才会生效。</p></div>}
      </div><DialogFooter className="shrink-0 flex-wrap border-t border-line pt-3"><Button variant="outline" disabled={busy} onClick={()=>setMode('')}>取消</Button><Button disabled={busy||!source||(!selected.length&&!recent)} onClick={submit}>{busy?'处理中…':mode==='export'?'下载所选内容':proposal?'应用到草稿':'预览所选差异'}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>
}
