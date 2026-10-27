import { useId, useState, useEffect } from 'react'
import { Input, Textarea, Label, Select } from '@ui/input'
import { Button } from '@ui/button'
import { websiteApi } from '../lib/api'
import Field from '../pages/FieldWidget'
import LinkPicker from '../pages/LinkPicker'
import MediaPicker from './MediaPicker'
import SupportContacts from './SupportContacts'
import { parseRows,serializeRows,updateCopyText } from '../lib/row-contract'

function TextControl({control,value,onChange}){const id=useId();return <div className="space-y-2"><Label htmlFor={id}>{control.label}</Label>{control.type==='link'?<LinkPicker value={value} onChange={onChange}/>:control.type==='textarea'?<Textarea id={id} value={value} rows={3} onChange={e=>onChange(e.target.value)}/>:<Input id={id} value={value} onChange={e=>onChange(e.target.value)}/>}</div>}
function ProductGroup({field,value,onChange}){const [groups,setGroups]=useState([]);useEffect(()=>{websiteApi.productOptions().then(r=>{if(r.status===200)setGroups(r.data.products||[])}).catch(()=>{})},[]);const options=[...new Map(groups.map(p=>[String(p.group_id),{id:p.group_id,label:[p.group,p.sub].filter(Boolean).join(' / ')}])).values()];return <div className="space-y-2"><p className="text-sm font-medium">{field.label}</p><Select aria-label={field.label} value={value==='0'?'':value||''} onChange={e=>onChange(e.target.value)}><option value="">全部商品分类</option>{value&&value!=='0'&&!options.some(o=>String(o.id)===String(value))&&<option value={value}>原有商品分类</option>}{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</Select></div>}
export default function VisualField({field:f,value,onChange,config,setField,modules=[]}){
  const widget=f.visual?.widget
  if(widget==='support-contacts')return <SupportContacts value={value} onChange={onChange}/>
  if(widget==='product-group')return <ProductGroup field={f} value={value} onChange={onChange}/>
  if(widget==='copy'||widget==='nodes-units'){
    const rows=parseRows(value,f.cols), controls=f.visual.controls||[],identity=f.cols[0].key,content=f.cols[1].key
    const update=(key,v)=>onChange(updateCopyText(value,f.cols,key,v))
    if(!controls.length)return <details className="advanced-details"><summary>高级兼容文案</summary><Field field={f} value={value} onChange={onChange} config={config} setField={setField}/></details>
    return <div className="grid gap-5">{controls.map(c=>{const found=rows.findLast(r=>r.row[identity]===c.key&&!r.hidden);return <TextControl key={c.key} control={c} value={found?.row[content]??c.default??''} onChange={v=>update(c.key,v)}/>})}</div>
  }
  if(widget==='single-row'){
    const rows=parseRows(value,f.cols),index=rows.findIndex(r=>!r.hidden),current=rows[index]?.row||{},defaults=f.visual.defaults||{}
    return <div className="grid gap-5">{f.visual.publicDefault&&<p className="text-sm text-muted-foreground">这里设置统一文案。尚未统一设置时，各页面使用自己的预置内容；页面内单独修改的内容优先。</p>}{f.cols.filter(c=>c.key!=='page'&&(!f.visual?.visibleColumns||f.visual.visibleColumns.includes(c.key))).map(c=><TextControl key={c.key} control={c} value={current[c.key]??defaults[c.key]??''} onChange={v=>{const next=rows.map(r=>({...r,row:{...r.row}}));if(index<0)next.unshift({row:{...defaults,page:f.boundPage||'*',[c.key]:v},level:1,hidden:false});else next[index].row[c.key]=v;onChange(serializeRows(next,f.cols))}}/>)}</div>
  }
  if(widget==='anchors'){
    const rows=parseRows(value,f.cols),index=rows.findIndex(r=>!r.hidden),row=rows[index]?.row||{page:f.boundPage,anchors:''},anchors=String(row.anchors||'').split(',').filter(Boolean).map(s=>{const i=s.indexOf('#');return {name:s.slice(0,i),id:s.slice(i+1)}})
    const write=next=>{const list=rows.map(r=>({...r,row:{...r.row}})),v={...row,anchors:next.map(a=>`${a.name}#${a.id}`).join(',')};if(index<0)list.unshift({row:v,level:1,hidden:false});else list[index].row=v;onChange(serializeRows(list,f.cols))}
    return <div className="space-y-3"><p className="text-sm font-medium">页内导航</p>{anchors.map((a,i)=><div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input aria-label={`第${i+1}个导航名称`} value={a.name} onChange={e=>write(anchors.map((x,n)=>n===i?{...x,name:e.target.value}:x))}/><Select aria-label={`第${i+1}个导航目标`} value={a.id} onChange={e=>write(anchors.map((x,n)=>n===i?{...x,id:e.target.value}:x))}>{!modules.some(m=>m.id===a.id)&&<option value={a.id}>原有区块</option>}{modules.filter(m=>!m.fixed).map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</Select><Button variant="ghost" onClick={()=>write(anchors.filter((_,n)=>n!==i))}>删除</Button></div>)}<Button variant="outline" onClick={()=>{const first=modules.find(m=>!m.fixed);if(first)write([...anchors,{name:first.label,id:first.id}])}}>添加导航</Button></div>
  }
  if(widget==='image')return <div className="space-y-2"><p className="text-sm font-medium">{f.label}</p><MediaPicker value={value} onChange={onChange} label={f.label}/></div>
  if(widget==='link')return <div className="space-y-2"><p className="text-sm font-medium">{f.label}</p><LinkPicker value={value} onChange={onChange}/></div>
  return <Field field={f} value={value} onChange={onChange} config={config} setField={setField}/>
}
