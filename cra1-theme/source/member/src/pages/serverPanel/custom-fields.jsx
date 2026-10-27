import {useEffect,useRef,useState} from 'react'
import {get} from '../../lib'
import {Button} from '../../ui/button'
import {useAccess} from '../../ui/access'
import {copyToClipboard} from './clipboard'
import {useToast} from '../../ui/toast'
import {Copy,Eye,EyeOff} from 'lucide-react'
function SecretField({hostId,field}){
 const [secret,setSecret]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''), timer=useRef(),generation=useRef(0),toast=useToast()
 const clear=()=>{generation.current++;clearTimeout(timer.current);setSecret(null)}
 useEffect(()=>{const hide=()=>{if(document.hidden)clear()};document.addEventListener('visibilitychange',hide);document.addEventListener('api:unauthorized',clear);return()=>{generation.current++;clearTimeout(timer.current);document.removeEventListener('visibilitychange',hide);document.removeEventListener('api:unauthorized',clear)}},[hostId,field.id])
 async function read(copy){if(busy)return;const ticket=++generation.current;setBusy(true);setError('');try{const r=await get(`/theme/host/${hostId}/field/${field.id}`);if(ticket!==generation.current)return;const value=String(r.data?.value ?? '');if(copy){const ok=await copyToClipboard(value);toast(ok?'已复制':'复制失败，请重试',ok?'success':'error')}else{setSecret(value);const expires=Number(r.data?.verification_expires_at);timer.current=setTimeout(clear,expires?Math.max(0,Math.min(60000,expires*1000-Date.now())):60000)}}catch(e){if(ticket===generation.current)setError(e.message)}finally{setBusy(false)}}
 return <span className="flex flex-wrap items-center justify-end gap-1"><span>{secret===null?'••••••••':secret || '—'}</span><Button permission="action:control" size="sm" variant="ghost" className="h-7 px-1" disabled={busy} aria-label={secret===null?'查看内容':'隐藏内容'} onClick={()=>secret===null?read(false):clear()}>{secret===null?<Eye className="size-3.5"/>:<EyeOff className="size-3.5"/>}</Button><Button permission="action:control" size="sm" variant="ghost" className="h-7 px-1" disabled={busy} aria-label="复制内容" onClick={()=>read(true)}><Copy className="size-3.5"/></Button>{error&&<span role="alert" className="w-full text-xs text-danger">{error}</span>}</span>
}
export default function HostCustomFields({host}){
 const {can}=useAccess()
 return (host?.self_defined_field || []).map(f=>{
  const value=String(f.value ?? ''),type=f.field_type
  let content=value || '—'
  if(type==='password')content=can('action:control')?<SecretField key={`${host.id}:${f.id}`} hostId={host.id} field={f}/>:<span>••••••••</span>
  else if(type==='checkbox'||type==='tickbox')content=Number(f.value)===1?'是':'否'
  else if(type==='link'){try{const u=new URL(value,location.origin);if(['http:','https:','mailto:','tel:'].includes(u.protocol))content=<a className="text-brand underline" href={u.href} target="_blank" rel="noopener noreferrer">{value}</a>}catch{}}
  return <div key={f.id} className="flex items-start justify-between gap-3 border-b border-line/50 py-1"><dt className="shrink-0 text-xs text-muted-foreground">{f.field_name}</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-right text-xs font-medium text-ink">{content}</dd></div>
 })
}
