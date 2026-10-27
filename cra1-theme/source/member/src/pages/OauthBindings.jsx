import { useEffect, useRef, useState } from 'react'
import { post } from '../lib'
import { startOAuth } from '../oauth-flow'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Button } from '../ui/button'
import { Alert } from '../ui/feedback'
export default function OauthBindings({account,onChanged}) {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),stop=useRef(null)
  useEffect(()=>()=>stop.current?.(),[])
  if(!account.oauth?.length)return null
  return <Card className="mt-4"><CardHeader><CardTitle>第三方账号</CardTitle></CardHeader><CardContent>{error&&<Alert tone="error">{error}</Alert>}{account.oauth.map(p=><div key={p.name} className="flex justify-between items-center border-b border-line py-3"><span>{p.title}</span><Button variant="outline" disabled={busy} onClick={()=>{
    setError('');setBusy(true)
    if(p.link){if(!window.confirm(`确认解除${p.title}关联？`)){setBusy(false);return}post(`/oauth/unbind/${encodeURIComponent(p.name)}`,{}).then(onChanged).catch(e=>setError(e.message)).finally(()=>setBusy(false))}
    else stop.current=startOAuth(p.name,{onBound:()=>{setBusy(false);onChanged?.()},onResult:()=>{setBusy(false);onChanged?.()},onError:e=>{setBusy(false);setError(e.message)}})
  }}>{p.link?'解除关联':'关联账户'}</Button></div>)}</CardContent></Card>
}
