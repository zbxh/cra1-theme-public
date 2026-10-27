import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@ui/dialog'
import { Input, Label } from '@ui/input'
import { Button } from '@ui/button'
import { Alert } from '@ui/feedback'
import { api, bootInfo } from '../lib/api'
export default function Reauth(){
 const [pending,setPending]=useState(null),[password,setPassword]=useState(''),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{const listener=e=>{setPending(e.detail);setPassword('');setCode('');setError('')};window.addEventListener('theme-reauth',listener);return()=>window.removeEventListener('theme-reauth',listener)},[])
 const cancel=()=>{if(busy)return;pending?.resolve(null);setPending(null);setPassword('');setCode('')}
 const verify=async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await api('api.auth.reauth',{password,code,action:pending.action,target:pending.target},{reauth:false});if(r.status!==200)throw new Error(r.msg);pending.resolve(r.data.credential);setPending(null);setPassword('');setCode('')}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <Dialog open={!!pending} onOpenChange={v=>!v&&cancel()}><DialogContent className="max-w-[420px]"><DialogHeader><DialogTitle>重新验证身份</DialogTitle><DialogDescription>此验证仅用于当前操作，有效期 5 分钟。草稿会保留。</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={verify}><div><Label htmlFor="reauth-password">当前密码</Label><Input id="reauth-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required autoFocus disabled={busy}/></div>{bootInfo.mfa_enabled&&<div><Label htmlFor="reauth-code">动态码或恢复码</Label><Input id="reauth-code" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} required disabled={busy}/><p className="mt-1 text-xs text-muted-foreground">请使用新的动态码，已用过的动态码不能重复验证。</p></div>}{error&&<Alert tone="error">{error}</Alert>}<DialogFooter><Button type="button" variant="ghost" onClick={cancel} disabled={busy}>取消</Button><Button type="submit" disabled={busy}>{busy?'验证中…':'验证并继续'}</Button></DialogFooter></form></DialogContent></Dialog>
}
